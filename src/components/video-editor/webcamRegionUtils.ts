import type { WebcamRegion } from "./types";

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
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
): WebcamRegion["position"] {
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
		anchor === "free"
			? region.position
			: resolveAnchoredPosition(anchor, size, marginPct);
	const position = clampWebcamPosition(anchoredPosition, size);

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

export function getWebcamPixelRect(
	region: WebcamRegion,
	containerWidth: number,
	containerHeight: number,
) {
	const normalizedRegion = normalizeWebcamRegion(region);
	const marginPx =
		(normalizedRegion.marginPct / 100) * Math.min(containerWidth, containerHeight);

	if (normalizedRegion.shape === "circle" || normalizedRegion.shape === "square") {
		const sidePx = (normalizedRegion.size.width / 100) * Math.min(containerWidth, containerHeight);
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
