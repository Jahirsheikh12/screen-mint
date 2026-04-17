import type { CameraLayoutMode, CameraLayoutRegion, WebcamRegion, ZoomRegion } from "./types";
import { CAMERA_ZOOM_SCALE_DISABLED, ZOOM_DEPTH_SCALES } from "./types";
import { easeOutScreenStudio } from "./videoPlayback/mathUtils";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";
import { getWebcamPixelRect, normalizeWebcamRegion } from "./webcamRegionUtils";

export interface PixelRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface WebcamSourceSize {
	width: number;
	height: number;
}

export interface ResolvedCameraLayoutState {
	mode: CameraLayoutMode;
	region: WebcamRegion;
	mirror: boolean;
	scale: number;
	isZoomScaled: boolean;
	activeLayoutId: string | null;
}

export interface ResolvedWebcamRenderModel extends ResolvedCameraLayoutState {
	displayRect: PixelRect;
	sourceCrop: PixelRect | null;
	clipShape: "circle" | "round-rect";
	borderRadiusPx: number;
	borderWidthPx: number;
	shadowBlurPx: number;
	shadowOffsetYPx: number;
	shadowOpacity: number;
	opacity: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clampPercent(value: number) {
	return clamp(value, 0, 100);
}

function cloneWebcamRegion(region: WebcamRegion): WebcamRegion {
	return normalizeWebcamRegion({
		...region,
		position: { ...region.position },
		size: { ...region.size },
	});
}

function rectCenter(rect: PixelRect) {
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2,
	};
}

function offsetRect(rect: PixelRect, offsetX: number, offsetY: number): PixelRect {
	return {
		x: rect.x + offsetX,
		y: rect.y + offsetY,
		width: rect.width,
		height: rect.height,
	};
}

function getRectBounds(rect: PixelRect) {
	return {
		minX: rect.x,
		maxX: rect.x + rect.width,
		minY: rect.y,
		maxY: rect.y + rect.height,
	};
}

function rectIntersectionArea(left: PixelRect, right: PixelRect) {
	const x = Math.max(left.x, right.x);
	const y = Math.max(left.y, right.y);
	const rightEdge = Math.min(left.x + left.width, right.x + right.width);
	const bottomEdge = Math.min(left.y + left.height, right.y + right.height);

	if (rightEdge <= x || bottomEdge <= y) {
		return 0;
	}

	return (rightEdge - x) * (bottomEdge - y);
}

function inflateRectWithinBounds(rect: PixelRect, amount: number, bounds: PixelRect) {
	const rectBounds = getRectBounds(bounds);
	const expandedX = rect.x - amount;
	const expandedY = rect.y - amount;
	const expandedRight = rect.x + rect.width + amount;
	const expandedBottom = rect.y + rect.height + amount;

	return {
		x: clamp(expandedX, rectBounds.minX, rectBounds.maxX),
		y: clamp(expandedY, rectBounds.minY, rectBounds.maxY),
		width: clamp(
			expandedRight - clamp(expandedX, rectBounds.minX, rectBounds.maxX),
			0,
			bounds.width,
		),
		height: clamp(
			expandedBottom - clamp(expandedY, rectBounds.minY, rectBounds.maxY),
			0,
			bounds.height,
		),
	};
}

function getWebcamPixelRectInRect(region: WebcamRegion, compositionRect: PixelRect): PixelRect {
	const localRect = getWebcamPixelRect(region, compositionRect.width, compositionRect.height);
	return offsetRect(localRect, compositionRect.x, compositionRect.y);
}

function createFreePositionRegion(
	region: WebcamRegion,
	xPx: number,
	yPx: number,
	containerWidth: number,
	containerHeight: number,
): WebcamRegion {
	return normalizeWebcamRegion({
		...region,
		anchor: "free",
		position: {
			x: (xPx / containerWidth) * 100,
			y: (yPx / containerHeight) * 100,
		},
	});
}

function createAnchoredRegion(region: WebcamRegion, anchor: WebcamRegion["anchor"]): WebcamRegion {
	return normalizeWebcamRegion({
		...region,
		anchor,
	});
}

function dedupeCandidateRegions(regions: WebcamRegion[]) {
	const seen = new Set<string>();

	return regions.filter((region) => {
		const key = [
			region.anchor,
			region.position.x.toFixed(2),
			region.position.y.toFixed(2),
			region.size.width.toFixed(2),
			region.size.height.toFixed(2),
		].join(":");

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

export function mergeWebcamRegion(
	baseRegion: WebcamRegion,
	override?: Partial<WebcamRegion>,
): WebcamRegion {
	if (!override) {
		return cloneWebcamRegion(baseRegion);
	}

	return normalizeWebcamRegion({
		...baseRegion,
		...override,
		position: {
			...baseRegion.position,
			...override.position,
		},
		size: {
			...baseRegion.size,
			...override.size,
		},
	});
}

export function scaleWebcamRegion(region: WebcamRegion, scale: number): WebcamRegion {
	if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.0001) {
		return cloneWebcamRegion(region);
	}

	const scaledWidth = clampPercent(region.size.width * scale);
	const scaledHeight = clampPercent(region.size.height * scale);
	const deltaX = (region.size.width - scaledWidth) / 2;
	const deltaY = (region.size.height - scaledHeight) / 2;

	return normalizeWebcamRegion({
		...region,
		position: {
			x: clampPercent(region.position.x + deltaX),
			y: clampPercent(region.position.y + deltaY),
		},
		size: {
			width: scaledWidth,
			height: scaledHeight,
		},
	});
}

export function getActiveCameraLayout(
	cameraLayouts: CameraLayoutRegion[] | undefined,
	timeMs: number,
): CameraLayoutRegion | null {
	if (!cameraLayouts?.length) {
		return null;
	}

	const active = cameraLayouts
		.filter((layout) => timeMs >= layout.startMs && timeMs <= layout.endMs)
		.sort((a, b) => {
			if (a.startMs !== b.startMs) {
				return a.startMs - b.startMs;
			}

			return a.endMs - b.endMs;
		});

	return active.length > 0 ? active[active.length - 1] : null;
}

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

function lerpWebcamRegion(baseRegion: WebcamRegion, targetRegion: WebcamRegion, amount: number) {
	const progress = clamp(amount, 0, 1);
	if (progress <= 0) {
		return cloneWebcamRegion(baseRegion);
	}
	if (progress >= 1) {
		return cloneWebcamRegion(targetRegion);
	}

	return normalizeWebcamRegion({
		...baseRegion,
		position: {
			x: lerp(baseRegion.position.x, targetRegion.position.x, progress),
			y: lerp(baseRegion.position.y, targetRegion.position.y, progress),
		},
		size: {
			width: lerp(baseRegion.size.width, targetRegion.size.width, progress),
			height: lerp(baseRegion.size.height, targetRegion.size.height, progress),
		},
		borderRadius: lerp(baseRegion.borderRadius, targetRegion.borderRadius, progress),
		borderWidth: lerp(baseRegion.borderWidth, targetRegion.borderWidth, progress),
		opacity: lerp(baseRegion.opacity, targetRegion.opacity, progress),
	});
}

function getCoverCropRect(
	sourceSize: WebcamSourceSize | null | undefined,
	displayRect: PixelRect,
): PixelRect | null {
	if (!sourceSize || sourceSize.width <= 0 || sourceSize.height <= 0) {
		return null;
	}

	if (displayRect.width <= 0 || displayRect.height <= 0) {
		return {
			x: 0,
			y: 0,
			width: sourceSize.width,
			height: sourceSize.height,
		};
	}

	const sourceAspect = sourceSize.width / sourceSize.height;
	const displayAspect = displayRect.width / displayRect.height;

	if (Math.abs(sourceAspect - displayAspect) < 0.0001) {
		return {
			x: 0,
			y: 0,
			width: sourceSize.width,
			height: sourceSize.height,
		};
	}

	if (sourceAspect > displayAspect) {
		const width = sourceSize.height * displayAspect;
		return {
			x: (sourceSize.width - width) / 2,
			y: 0,
			width,
			height: sourceSize.height,
		};
	}

	const height = sourceSize.width / displayAspect;
	return {
		x: 0,
		y: (sourceSize.height - height) / 2,
		width: sourceSize.width,
		height,
	};
}

function getZoomAttentionRect(
	region: ZoomRegion,
	scale: number,
	contentRect: PixelRect,
	compositionRect: PixelRect,
): PixelRect {
	const visibleWidth = contentRect.width / Math.max(1, scale);
	const visibleHeight = contentRect.height / Math.max(1, scale);
	const centerX = contentRect.x + region.focus.cx * contentRect.width;
	const centerY = contentRect.y + region.focus.cy * contentRect.height;
	const padding = Math.min(contentRect.width, contentRect.height) * 0.08;

	return inflateRectWithinBounds(
		{
			x: centerX - visibleWidth / 2,
			y: centerY - visibleHeight / 2,
			width: visibleWidth,
			height: visibleHeight,
		},
		padding,
		compositionRect,
	);
}

function buildCandidateRegions(
	region: WebcamRegion,
	containerWidth: number,
	containerHeight: number,
): WebcamRegion[] {
	const rect = getWebcamPixelRect(region, containerWidth, containerHeight);
	const marginPx = (region.marginPct / 100) * Math.min(containerWidth, containerHeight);
	const freeCandidates = [
		createFreePositionRegion(
			region,
			clamp((containerWidth - rect.width) / 2, 0, containerWidth - rect.width),
			clamp(marginPx, 0, containerHeight - rect.height),
			containerWidth,
			containerHeight,
		),
		createFreePositionRegion(
			region,
			clamp((containerWidth - rect.width) / 2, 0, containerWidth - rect.width),
			clamp(containerHeight - rect.height - marginPx, 0, containerHeight - rect.height),
			containerWidth,
			containerHeight,
		),
		createFreePositionRegion(
			region,
			clamp(marginPx, 0, containerWidth - rect.width),
			clamp((containerHeight - rect.height) / 2, 0, containerHeight - rect.height),
			containerWidth,
			containerHeight,
		),
		createFreePositionRegion(
			region,
			clamp(containerWidth - rect.width - marginPx, 0, containerWidth - rect.width),
			clamp((containerHeight - rect.height) / 2, 0, containerHeight - rect.height),
			containerWidth,
			containerHeight,
		),
	];

	return dedupeCandidateRegions([
		cloneWebcamRegion(region),
		createAnchoredRegion(region, "top-left"),
		createAnchoredRegion(region, "top-right"),
		createAnchoredRegion(region, "bottom-left"),
		createAnchoredRegion(region, "bottom-right"),
		...freeCandidates,
	]);
}

function resolveZoomSafeRegion(params: {
	baseRegion: WebcamRegion;
	attentionRect: PixelRect;
	compositionRect: PixelRect;
	preferredScale: number;
}): { region: WebcamRegion; scale: number } {
	const { baseRegion, attentionRect, compositionRect, preferredScale } = params;
	const baseRect = getWebcamPixelRectInRect(baseRegion, compositionRect);
	const baseCenter = rectCenter(baseRect);
	const containerDiagonal = Math.hypot(compositionRect.width, compositionRect.height) || 1;
	const baseSafeArea = rectIntersectionArea(baseRect, attentionRect);
	const desiredShrinkScale = clamp(preferredScale, 0.4, CAMERA_ZOOM_SCALE_DISABLED);
	const scaleCandidates = Array.from(
		new Set(
			[CAMERA_ZOOM_SCALE_DISABLED, desiredShrinkScale, 0.9, 0.82, 0.72, 0.6]
				.filter((value) => value > 0 && value <= CAMERA_ZOOM_SCALE_DISABLED)
				.map((value) => Math.round(value * 1000) / 1000),
		),
	).sort((left, right) => right - left);

	let bestChoice: { region: WebcamRegion; scale: number; score: number } | null = null;

	for (const scale of scaleCandidates) {
		const scaledRegion = scaleWebcamRegion(baseRegion, scale);
		for (const candidate of buildCandidateRegions(
			scaledRegion,
			compositionRect.width,
			compositionRect.height,
		)) {
			const candidateRect = getWebcamPixelRectInRect(candidate, compositionRect);
			const overlapArea = rectIntersectionArea(candidateRect, attentionRect);
			const candidateCenter = rectCenter(candidateRect);
			const distance =
				Math.hypot(candidateCenter.x - baseCenter.x, candidateCenter.y - baseCenter.y) /
				containerDiagonal;
			const scalePenalty = (CAMERA_ZOOM_SCALE_DISABLED - scale) * 0.9;
			const overlapPenalty =
				overlapArea > 0
					? (overlapArea / Math.max(1, candidateRect.width * candidateRect.height)) * 8
					: 0;
			const score = overlapPenalty + scalePenalty + distance;

			if (overlapArea <= 1) {
				if (!bestChoice || score < bestChoice.score) {
					bestChoice = { region: candidate, scale, score };
				}
				continue;
			}

			if (!bestChoice && overlapArea < baseSafeArea) {
				bestChoice = { region: candidate, scale, score };
			}
		}
	}

	if (bestChoice) {
		return { region: bestChoice.region, scale: bestChoice.scale };
	}

	return { region: cloneWebcamRegion(baseRegion), scale: CAMERA_ZOOM_SCALE_DISABLED };
}

function resolveDefaultModeRegion(params: {
	baseRegion: WebcamRegion;
	zoomRegions: ZoomRegion[];
	timeMs: number;
	connectZooms: boolean;
	cameraSizeDuringZoom: number;
	compositionRect: PixelRect;
	contentRect: PixelRect;
}) {
	const {
		baseRegion,
		zoomRegions,
		timeMs,
		connectZooms,
		cameraSizeDuringZoom,
		compositionRect,
		contentRect,
	} = params;
	const dominantRegion = findDominantRegion(zoomRegions, timeMs, { connectZooms });

	if (!dominantRegion.region || dominantRegion.strength <= 0) {
		return {
			region: cloneWebcamRegion(baseRegion),
			scale: CAMERA_ZOOM_SCALE_DISABLED,
			isZoomScaled: false,
		};
	}

	const zoomScale = dominantRegion.blendedScale ?? ZOOM_DEPTH_SCALES[dominantRegion.region.depth];
	const attentionRect = getZoomAttentionRect(
		dominantRegion.region,
		zoomScale,
		contentRect,
		compositionRect,
	);
	const zoomSafeRegion = resolveZoomSafeRegion({
		baseRegion,
		attentionRect,
		compositionRect,
		preferredScale: cameraSizeDuringZoom,
	});
	const transitionProgress = clamp(dominantRegion.strength, 0, 1);
	const interpolatedRegion = lerpWebcamRegion(
		baseRegion,
		zoomSafeRegion.region,
		easeOutScreenStudio(transitionProgress),
	);

	return {
		region: interpolatedRegion,
		scale: lerp(CAMERA_ZOOM_SCALE_DISABLED, zoomSafeRegion.scale, transitionProgress),
		isZoomScaled: zoomSafeRegion.scale < CAMERA_ZOOM_SCALE_DISABLED,
	};
}

export function resolveCameraLayoutState(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: ZoomRegion[];
	connectZooms?: boolean;
	cameraSizeDuringZoom?: number;
	containerWidth?: number;
	containerHeight?: number;
	compositionRect?: PixelRect;
	contentRect?: PixelRect;
}): ResolvedCameraLayoutState {
	const {
		timeMs,
		webcamRegion,
		showWebcam,
		mirrorWebcam = false,
		cameraLayouts = [],
		zoomRegions = [],
		connectZooms = true,
		cameraSizeDuringZoom = CAMERA_ZOOM_SCALE_DISABLED,
		containerWidth = 1920,
		containerHeight = 1080,
		compositionRect: compositionRectInput,
		contentRect: contentRectInput,
	} = params;
	const compositionRect = compositionRectInput ?? {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight,
	};
	const contentRect = contentRectInput ?? compositionRect;

	const activeLayout = getActiveCameraLayout(cameraLayouts, timeMs);
	const mode = activeLayout?.mode ?? (showWebcam ? "default" : "hidden");
	const mergedRegion = mergeWebcamRegion(webcamRegion, activeLayout?.regionOverride);
	const defaultModeRegion =
		mode === "default"
			? resolveDefaultModeRegion({
					baseRegion: mergedRegion,
					zoomRegions,
					timeMs,
					connectZooms,
					cameraSizeDuringZoom,
					compositionRect,
					contentRect,
				})
			: {
					region: cloneWebcamRegion(mergedRegion),
					scale: CAMERA_ZOOM_SCALE_DISABLED,
					isZoomScaled: false,
				};

	return {
		mode,
		region: defaultModeRegion.region,
		mirror: mirrorWebcam,
		scale: defaultModeRegion.scale,
		isZoomScaled: defaultModeRegion.isZoomScaled,
		activeLayoutId: activeLayout?.id ?? null,
	};
}

export function resolveWebcamRenderModel(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: ZoomRegion[];
	connectZooms?: boolean;
	cameraSizeDuringZoom?: number;
	containerWidth: number;
	containerHeight: number;
	sourceSize?: WebcamSourceSize | null;
	compositionRect?: PixelRect;
	contentRect?: PixelRect;
}): ResolvedWebcamRenderModel {
	const {
		containerWidth,
		containerHeight,
		sourceSize = null,
		compositionRect: compositionRectInput,
		contentRect: contentRectInput,
		...layoutParams
	} = params;
	const compositionRect = compositionRectInput ?? {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight,
	};
	const contentRect = contentRectInput ?? compositionRect;
	const cameraState = resolveCameraLayoutState({
		...layoutParams,
		containerWidth,
		containerHeight,
		compositionRect,
		contentRect,
	});

	if (cameraState.mode === "fullscreen") {
		const displayRect = compositionRect;

		return {
			...cameraState,
			displayRect,
			sourceCrop: getCoverCropRect(sourceSize, displayRect),
			clipShape: "round-rect",
			borderRadiusPx: 0,
			borderWidthPx: 0,
			shadowBlurPx: 0,
			shadowOffsetYPx: 0,
			shadowOpacity: 0,
			opacity: 1,
		};
	}

	const displayRect = getWebcamPixelRectInRect(cameraState.region, compositionRect);
	const minDimension = Math.min(displayRect.width, displayRect.height);
	const shadowScale = Math.max(0.65, Math.min(1.6, minDimension / 180));

	return {
		...cameraState,
		displayRect,
		sourceCrop: getCoverCropRect(sourceSize, displayRect),
		clipShape: cameraState.region.shape === "circle" ? "circle" : "round-rect",
		borderRadiusPx:
			cameraState.region.shape === "circle" ? minDimension / 2 : cameraState.region.borderRadius,
		borderWidthPx: cameraState.region.borderWidth,
		shadowBlurPx: 18 * shadowScale,
		shadowOffsetYPx: 6 * shadowScale,
		shadowOpacity: 0.34,
		opacity: cameraState.mode === "hidden" ? 0 : cameraState.region.opacity,
	};
}
