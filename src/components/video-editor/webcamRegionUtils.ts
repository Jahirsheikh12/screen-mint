import type { WebcamRegion } from "./types";

export interface WebcamPixelRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function isFixedAspectShape(shape: WebcamRegion["shape"]) {
	return shape === "circle" || shape === "square";
}

function resolveAnchoredPosition(
	anchor: WebcamRegion["anchor"],
	size: WebcamRegion["size"],
	marginPct: number,
): WebcamRegion["position"] {
	if (anchor === "free") {
		return { x: 0, y: 0 };
	}

	const x =
		anchor === "top-left" || anchor === "bottom-left"
			? marginPct
			: Math.max(0, 100 - size.width - marginPct);
	const y =
		anchor === "top-left" || anchor === "top-right"
			? marginPct
			: Math.max(0, 100 - size.height - marginPct);

	return { x, y };
}

export function normalizeWebcamSize(
	size: WebcamRegion["size"],
	shape: WebcamRegion["shape"],
): WebcamRegion["size"] {
	if (shape === "circle" || shape === "square") {
		const side = clamp(Math.max(size.width, size.height), 1, 100);
		return { width: side, height: side };
	}

	return {
		width: clamp(size.width, 1, 100),
		height: clamp(size.height, 1, 100),
	};
}

export function clampWebcamPosition(
	position: WebcamRegion["position"],
	size: WebcamRegion["size"],
	shape: WebcamRegion["shape"] = "rectangle",
): WebcamRegion["position"] {
	if (isFixedAspectShape(shape)) {
		return {
			x: clamp(position.x, 0, 100),
			y: clamp(position.y, 0, 100),
		};
	}

	return {
		x: clamp(position.x, 0, Math.max(0, 100 - size.width)),
		y: clamp(position.y, 0, Math.max(0, 100 - size.height)),
	};
}

export function normalizeWebcamRegion(region: WebcamRegion): WebcamRegion {
	const size = normalizeWebcamSize(region.size, region.shape);
	const marginPct = clamp(region.marginPct, 0, 12);
	const anchor = region.anchor ?? "free";
	const anchoredPosition =
		anchor === "free" ? region.position : resolveAnchoredPosition(anchor, size, marginPct);
	const position = clampWebcamPosition(anchoredPosition, size, region.shape);

	return {
		...region,
		anchor,
		marginPct,
		position,
		size,
		borderRadius: region.shape === "circle" ? 50 : clamp(region.borderRadius, 0, 100),
		opacity: clamp(region.opacity, 0, 1),
		borderWidth: clamp(region.borderWidth, 0, 20),
	};
}

function getFixedAspectSidePx(
	size: WebcamRegion["size"],
	containerWidth: number,
	containerHeight: number,
) {
	return (size.width / 100) * Math.min(containerWidth, containerHeight);
}

function getWebcamPositionBounds(
	size: WebcamRegion["size"],
	shape: WebcamRegion["shape"],
	containerWidth: number,
	containerHeight: number,
) {
	const safeWidth = Math.max(1, containerWidth);
	const safeHeight = Math.max(1, containerHeight);

	if (isFixedAspectShape(shape)) {
		const sidePx = getFixedAspectSidePx(size, safeWidth, safeHeight);
		return {
			maxX: (Math.max(0, safeWidth - sidePx) / safeWidth) * 100,
			maxY: (Math.max(0, safeHeight - sidePx) / safeHeight) * 100,
		};
	}

	return {
		maxX: Math.max(0, 100 - size.width),
		maxY: Math.max(0, 100 - size.height),
	};
}

export function normalizeWebcamRegionForRect(
	region: WebcamRegion,
	containerWidth: number,
	containerHeight: number,
): WebcamRegion {
	const normalizedRegion = normalizeWebcamRegion(region);

	if (normalizedRegion.anchor !== "free") {
		return normalizedRegion;
	}

	const bounds = getWebcamPositionBounds(
		normalizedRegion.size,
		normalizedRegion.shape,
		containerWidth,
		containerHeight,
	);
	const rawX = Number.isFinite(region.position.x) ? region.position.x : normalizedRegion.position.x;
	const rawY = Number.isFinite(region.position.y) ? region.position.y : normalizedRegion.position.y;

	return {
		...normalizedRegion,
		position: {
			x: clamp(rawX, 0, bounds.maxX),
			y: clamp(rawY, 0, bounds.maxY),
		},
	};
}

function rectWidthToPercent(
	shape: WebcamRegion["shape"],
	widthPx: number,
	compositionRect: WebcamPixelRect,
) {
	if (isFixedAspectShape(shape)) {
		return (widthPx / Math.max(1, Math.min(compositionRect.width, compositionRect.height))) * 100;
	}

	return (widthPx / Math.max(1, compositionRect.width)) * 100;
}

function rectHeightToPercent(
	shape: WebcamRegion["shape"],
	heightPx: number,
	compositionRect: WebcamPixelRect,
) {
	if (isFixedAspectShape(shape)) {
		return (heightPx / Math.max(1, Math.min(compositionRect.width, compositionRect.height))) * 100;
	}

	return (heightPx / Math.max(1, compositionRect.height)) * 100;
}

export function getWebcamSizeFromPixelRect(
	shape: WebcamRegion["shape"],
	rect: WebcamPixelRect,
	compositionRect: WebcamPixelRect,
): WebcamRegion["size"] {
	if (isFixedAspectShape(shape)) {
		const sidePercent = rectWidthToPercent(shape, rect.width, compositionRect);
		return { width: sidePercent, height: sidePercent };
	}

	return {
		width: rectWidthToPercent(shape, rect.width, compositionRect),
		height: rectHeightToPercent(shape, rect.height, compositionRect),
	};
}

export function createFreeWebcamRegionFromPixelRect(
	region: WebcamRegion,
	rect: WebcamPixelRect,
	compositionRect: WebcamPixelRect,
): WebcamRegion {
	const localRect = {
		x: rect.x - compositionRect.x,
		y: rect.y - compositionRect.y,
		width: rect.width,
		height: rect.height,
	};
	const size = getWebcamSizeFromPixelRect(region.shape, localRect, compositionRect);

	return normalizeWebcamRegionForRect(
		{
			...region,
			anchor: "free",
			position: {
				x: (localRect.x / Math.max(1, compositionRect.width)) * 100,
				y: (localRect.y / Math.max(1, compositionRect.height)) * 100,
			},
			size,
		},
		compositionRect.width,
		compositionRect.height,
	);
}

export function getWebcamPixelRect(
	region: WebcamRegion,
	containerWidth: number,
	containerHeight: number,
) {
	const normalizedRegion = normalizeWebcamRegionForRect(region, containerWidth, containerHeight);
	const marginPx = (normalizedRegion.marginPct / 100) * Math.min(containerWidth, containerHeight);

	if (isFixedAspectShape(normalizedRegion.shape)) {
		const sidePx = getFixedAspectSidePx(normalizedRegion.size, containerWidth, containerHeight);
		const xPx =
			normalizedRegion.anchor === "free"
				? clamp(
						(normalizedRegion.position.x / 100) * containerWidth,
						0,
						Math.max(0, containerWidth - sidePx),
					)
				: normalizedRegion.anchor === "top-left" || normalizedRegion.anchor === "bottom-left"
					? marginPx
					: Math.max(0, containerWidth - sidePx - marginPx);
		const yPx =
			normalizedRegion.anchor === "free"
				? clamp(
						(normalizedRegion.position.y / 100) * containerHeight,
						0,
						Math.max(0, containerHeight - sidePx),
					)
				: normalizedRegion.anchor === "top-left" || normalizedRegion.anchor === "top-right"
					? marginPx
					: Math.max(0, containerHeight - sidePx - marginPx);

		return {
			x: xPx,
			y: yPx,
			width: sidePx,
			height: sidePx,
		};
	}

	const widthPx = (normalizedRegion.size.width / 100) * containerWidth;
	const heightPx = (normalizedRegion.size.height / 100) * containerHeight;
	const xPx =
		normalizedRegion.anchor === "free"
			? clamp(
					(normalizedRegion.position.x / 100) * containerWidth,
					0,
					Math.max(0, containerWidth - widthPx),
				)
			: normalizedRegion.anchor === "top-left" || normalizedRegion.anchor === "bottom-left"
				? marginPx
				: Math.max(0, containerWidth - widthPx - marginPx);
	const yPx =
		normalizedRegion.anchor === "free"
			? clamp(
					(normalizedRegion.position.y / 100) * containerHeight,
					0,
					Math.max(0, containerHeight - heightPx),
				)
			: normalizedRegion.anchor === "top-left" || normalizedRegion.anchor === "top-right"
				? marginPx
				: Math.max(0, containerHeight - heightPx - marginPx);

	return {
		x: xPx,
		y: yPx,
		width: widthPx,
		height: heightPx,
	};
}

export function getWebcamPixelRectInRect(
	region: WebcamRegion,
	compositionRect: WebcamPixelRect,
): WebcamPixelRect {
	const localRect = getWebcamPixelRect(region, compositionRect.width, compositionRect.height);
	return {
		x: localRect.x + compositionRect.x,
		y: localRect.y + compositionRect.y,
		width: localRect.width,
		height: localRect.height,
	};
}
