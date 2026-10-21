import type {
	CameraLayoutMode,
	CameraLayoutRegion,
	CursorTelemetryPoint,
	WebcamMotionPreset,
	WebcamRegion,
	WebcamSourceCrop,
	ZoomRegion,
	ZoomTimingSettings,
} from "./types";
import { CAMERA_ZOOM_SCALE_DISABLED } from "./types";
import { easeOutScreenStudio } from "./videoPlayback/mathUtils";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";
import { smoothZoomValue } from "./videoPlayback/zoomTransform";
import {
	createFreeWebcamRegionFromPixelRect,
	getWebcamPixelRect,
	getWebcamPixelRectInRect,
	getWebcamSizeFromPixelRect,
	normalizeWebcamRegion,
} from "./webcamRegionUtils";

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

const WEBCAM_MOTION_FIXED_STEP_MS = 1000 / 120;
const WEBCAM_MOTION_MAX_SUBSTEPS = 12;
const WEBCAM_MOTION_MAX_FRAME_DELTA_MS = 250;
const WEBCAM_RESTORE_SETTLE_PROGRESS_EPSILON = 0.015;
const WEBCAM_RESTORE_SETTLE_SCALE_EPSILON = 0.008;
const WEBCAM_RESTORE_SETTLE_RECT_EPSILON_PX = 9;
const WEBCAM_POST_ZOOM_RESTORE_WINDOW_MS = 220;

export interface ResolvedCameraLayoutState {
	mode: CameraLayoutMode;
	region: WebcamRegion;
	baseRegion: WebcamRegion;
	mirror: boolean;
	scale: number;
	isZoomScaled: boolean;
	activeLayoutId: string | null;
	layoutProgress: number;
	motionPreset: WebcamMotionPreset;
}

export interface ResolvedWebcamZoomMotion {
	region: WebcamRegion;
	scale: number;
	isZoomScaled: boolean;
	smoothedZoomProgress: number;
	targetZoomProgress: number;
	smoothedWebcamScale: number;
}

export interface WebcamZoomMotionState {
	homeRegion: WebcamRegion;
	activeRegion: WebcamRegion;
	scale: number;
	progress: number;
	lastPlaybackTimeMs: number | null;
	motionKey: string | null;
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

export function resolveWebcamSourceCrop(
	sourceSize: WebcamSourceSize | null | undefined,
	displayRect: PixelRect,
	trim?: WebcamSourceCrop | null,
): PixelRect | null {
	if (!sourceSize || !trim || (!trim.top && !trim.right && !trim.bottom && !trim.left)) {
		return getCoverCropRect(sourceSize, displayRect);
	}
	// Cover-fit inside the trimmed frame, then shift back into source pixels.
	const x = sourceSize.width * trim.left;
	const y = sourceSize.height * trim.top;
	const trimmedSize = {
		width: Math.max(1, sourceSize.width * (1 - trim.left - trim.right)),
		height: Math.max(1, sourceSize.height * (1 - trim.top - trim.bottom)),
	};
	const crop = getCoverCropRect(trimmedSize, displayRect);
	return crop ? { ...crop, x: crop.x + x, y: crop.y + y } : null;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clampPercent(value: number) {
	return clamp(value, 0, 100);
}

function cloneWebcamRegion(region: WebcamRegion): WebcamRegion {
	const clonedRegion = {
		...region,
		position: { ...region.position },
		size: { ...region.size },
	};

	if (clonedRegion.anchor === "free") {
		return clonedRegion;
	}

	return normalizeWebcamRegion(clonedRegion);
}

function clampWebcamMotionDeltaMs(deltaMs: number) {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
		return 0;
	}

	return Math.min(WEBCAM_MOTION_MAX_FRAME_DELTA_MS, deltaMs);
}

function getWebcamMotionSubstepDeltaMs(deltaMs: number) {
	if (deltaMs <= 0) {
		return [];
	}

	const stepCount = Math.max(
		1,
		Math.min(WEBCAM_MOTION_MAX_SUBSTEPS, Math.ceil(deltaMs / WEBCAM_MOTION_FIXED_STEP_MS)),
	);
	const stepDeltaMs = deltaMs / stepCount;
	return Array.from({ length: stepCount }, () => stepDeltaMs);
}

function getWebcamRegionSignature(region: WebcamRegion) {
	return [
		region.anchor,
		region.shape,
		region.position.x.toFixed(3),
		region.position.y.toFixed(3),
		region.size.width.toFixed(3),
		region.size.height.toFixed(3),
		region.borderRadius.toFixed(3),
		region.borderWidth.toFixed(3),
		region.borderColor,
		region.opacity.toFixed(4),
		region.marginPct.toFixed(3),
	].join(":");
}

function rectCenter(rect: PixelRect) {
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2,
	};
}

function getRectEdges(rect: PixelRect) {
	return {
		left: rect.x,
		right: rect.x + rect.width,
		top: rect.y,
		bottom: rect.y + rect.height,
	};
}

function hasEquivalentWebcamStyling(left: WebcamRegion, right: WebcamRegion, epsilon = 0.01) {
	return (
		left.shape === right.shape &&
		Math.abs(left.borderRadius - right.borderRadius) <= epsilon &&
		Math.abs(left.borderWidth - right.borderWidth) <= epsilon &&
		left.borderColor === right.borderColor &&
		Math.abs(left.opacity - right.opacity) <= 0.001
	);
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

function areEquivalentRects(left: PixelRect, right: PixelRect, epsilon = 0.5) {
	return (
		Math.abs(left.x - right.x) <= epsilon &&
		Math.abs(left.y - right.y) <= epsilon &&
		Math.abs(left.width - right.width) <= epsilon &&
		Math.abs(left.height - right.height) <= epsilon
	);
}

function areEquivalentWebcamRegions(
	left: WebcamRegion,
	right: WebcamRegion,
	compositionRect: PixelRect,
	epsilon = 0.5,
) {
	const leftRect = getWebcamPixelRectInRect(left, compositionRect);
	const rightRect = getWebcamPixelRectInRect(right, compositionRect);

	return (
		areEquivalentRects(leftRect, rightRect, epsilon) &&
		left.shape === right.shape &&
		Math.abs(left.borderRadius - right.borderRadius) <= 0.01 &&
		Math.abs(left.borderWidth - right.borderWidth) <= 0.01 &&
		left.borderColor === right.borderColor &&
		Math.abs(left.opacity - right.opacity) <= 0.001
	);
}

function createFreePositionRegion(
	region: WebcamRegion,
	xPx: number,
	yPx: number,
	containerWidth: number,
	containerHeight: number,
): WebcamRegion {
	return createFreeWebcamRegionFromPixelRect(
		region,
		{
			x: xPx,
			y: yPx,
			width: getWebcamPixelRect(region, containerWidth, containerHeight).width,
			height: getWebcamPixelRect(region, containerWidth, containerHeight).height,
		},
		{ x: 0, y: 0, width: containerWidth, height: containerHeight },
	);
}

function convertRegionToFreePosition(
	region: WebcamRegion,
	compositionRect: PixelRect,
): WebcamRegion {
	const localRect = getWebcamPixelRect(region, compositionRect.width, compositionRect.height);
	return createFreePositionRegion(
		{
			...region,
			anchor: "free",
		},
		localRect.x,
		localRect.y,
		compositionRect.width,
		compositionRect.height,
	);
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

	return normalizeWebcamRegion({
		...region,
		position:
			region.anchor === "free"
				? {
						x: clampPercent(region.position.x),
						y: clampPercent(region.position.y),
					}
				: region.position,
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

function findCursorSampleAtTime(
	cursorTelemetry: CursorTelemetryPoint[] | undefined,
	timeMs: number,
): CursorTelemetryPoint | null {
	if (!cursorTelemetry?.length) {
		return null;
	}

	let best: CursorTelemetryPoint | null = null;
	for (const sample of cursorTelemetry) {
		if (sample.timeMs > timeMs) {
			break;
		}
		best = sample;
	}

	if (!best) {
		best = cursorTelemetry[0] ?? null;
	}

	return best && Math.abs(best.timeMs - timeMs) <= 600 ? best : null;
}

function getCursorAttentionRect(
	cursorTelemetry: CursorTelemetryPoint[] | undefined,
	timeMs: number,
	contentRect: PixelRect,
	compositionRect: PixelRect,
): PixelRect | null {
	const sample = findCursorSampleAtTime(cursorTelemetry, timeMs);
	if (!sample) {
		return null;
	}

	const baseSize = Math.min(contentRect.width, contentRect.height);
	const intensity =
		sample.cursorType === "text" ||
		sample.interactionType === "click" ||
		sample.interactionType === "mousedown"
			? 0.2
			: 0.14;
	const width = Math.max(48, contentRect.width * intensity);
	const height = Math.max(42, contentRect.height * (intensity * 0.85));
	const centerX = contentRect.x + sample.cx * contentRect.width;
	const centerY = contentRect.y + sample.cy * contentRect.height;

	return inflateRectWithinBounds(
		{
			x: centerX - width / 2,
			y: centerY - height / 2,
			width,
			height,
		},
		baseSize * 0.04,
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
	allowFullSizeFallback?: boolean;
}): { region: WebcamRegion; scale: number } {
	const {
		baseRegion,
		attentionRect,
		compositionRect,
		preferredScale,
		allowFullSizeFallback = true,
	} = params;
	const baseRect = getWebcamPixelRectInRect(baseRegion, compositionRect);
	const baseCenter = rectCenter(baseRect);
	const containerDiagonal = Math.hypot(compositionRect.width, compositionRect.height) || 1;
	const baseSafeArea = rectIntersectionArea(baseRect, attentionRect);
	const desiredShrinkScale = clamp(preferredScale, 0.4, CAMERA_ZOOM_SCALE_DISABLED);
	const scaleCandidateSource = allowFullSizeFallback
		? [desiredShrinkScale, 0.9, 0.82, 0.72, 0.6, CAMERA_ZOOM_SCALE_DISABLED]
		: [desiredShrinkScale, 0.9, 0.82, 0.72, 0.6];
	const scaleCandidates = Array.from(
		new Set(
			scaleCandidateSource
				.filter((value) => value > 0 && value <= CAMERA_ZOOM_SCALE_DISABLED)
				.filter(
					(value) =>
						value <= desiredShrinkScale + 0.0001 ||
						(allowFullSizeFallback && value >= CAMERA_ZOOM_SCALE_DISABLED - 0.0001),
				)
				.map((value) => Math.round(value * 1000) / 1000),
		),
	).sort((left, right) => {
		const leftIsFullSize = left >= CAMERA_ZOOM_SCALE_DISABLED - 0.0001;
		const rightIsFullSize = right >= CAMERA_ZOOM_SCALE_DISABLED - 0.0001;
		if (leftIsFullSize !== rightIsFullSize) {
			return leftIsFullSize ? 1 : -1;
		}

		return right - left;
	});

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
	cursorTelemetry?: CursorTelemetryPoint[];
	timeMs: number;
	connectZooms: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	cameraSizeDuringZoom: number;
	enableCursorAvoidance?: boolean;
	compositionRect: PixelRect;
	contentRect: PixelRect;
}) {
	const {
		baseRegion,
		zoomRegions,
		cursorTelemetry,
		timeMs,
		connectZooms,
		zoomTiming,
		cameraSizeDuringZoom,
		enableCursorAvoidance = false,
		compositionRect,
		contentRect,
	} = params;
	const dominantRegion = findDominantRegion(zoomRegions, timeMs, { connectZooms, zoomTiming });

	if (!dominantRegion.region || dominantRegion.strength <= 0) {
		if (enableCursorAvoidance) {
			const cursorAttentionRect = getCursorAttentionRect(
				cursorTelemetry,
				timeMs,
				contentRect,
				compositionRect,
			);
			if (cursorAttentionRect) {
				const subtleCursorSafeRegion = resolveZoomSafeRegion({
					baseRegion,
					attentionRect: cursorAttentionRect,
					compositionRect,
					preferredScale: Math.max(cameraSizeDuringZoom, 0.88),
					allowFullSizeFallback: true,
				});
				return {
					region: lerpWebcamRegion(
						baseRegion,
						subtleCursorSafeRegion.region,
						easeOutScreenStudio(0.68),
					),
					scale: lerp(CAMERA_ZOOM_SCALE_DISABLED, subtleCursorSafeRegion.scale, 0.45),
					isZoomScaled: subtleCursorSafeRegion.scale < CAMERA_ZOOM_SCALE_DISABLED,
					targetZoomProgress: 0,
				};
			}
		}

		return {
			region: cloneWebcamRegion(baseRegion),
			scale: CAMERA_ZOOM_SCALE_DISABLED,
			isZoomScaled: false,
			targetZoomProgress: 0,
		};
	}

	const zoomSafeRegion = {
		region: scaleWebcamRegion(baseRegion, cameraSizeDuringZoom),
		scale: clamp(cameraSizeDuringZoom, 0.4, CAMERA_ZOOM_SCALE_DISABLED),
	};
	const isPostZoomRestore = dominantRegion.region != null && timeMs > dominantRegion.region.endMs;
	const transitionProgress = isPostZoomRestore
		? clamp(1 - (timeMs - dominantRegion.region.endMs) / WEBCAM_POST_ZOOM_RESTORE_WINDOW_MS, 0, 1)
		: clamp(dominantRegion.strength, 0, 1);
	if (transitionProgress <= WEBCAM_RESTORE_SETTLE_PROGRESS_EPSILON) {
		return {
			region: cloneWebcamRegion(baseRegion),
			scale: CAMERA_ZOOM_SCALE_DISABLED,
			isZoomScaled: false,
			targetZoomProgress: 0,
		};
	}
	const interpolatedRegion = lerpWebcamRegion(
		baseRegion,
		zoomSafeRegion.region,
		easeOutScreenStudio(transitionProgress),
	);

	return {
		region: interpolatedRegion,
		scale: lerp(CAMERA_ZOOM_SCALE_DISABLED, zoomSafeRegion.scale, transitionProgress),
		isZoomScaled: zoomSafeRegion.scale < CAMERA_ZOOM_SCALE_DISABLED,
		targetZoomProgress: transitionProgress,
	};
}

function resolveWebcamMotionKey(params: {
	baseRegion: WebcamRegion;
	compositionRect: PixelRect;
	contentRect: PixelRect;
	cameraSizeDuringZoom: number;
	enableCursorAvoidance: boolean;
	connectZooms: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
}) {
	const {
		baseRegion,
		compositionRect,
		contentRect,
		cameraSizeDuringZoom,
		enableCursorAvoidance,
		connectZooms,
		zoomTiming,
	} = params;

	return [
		getWebcamRegionSignature(baseRegion),
		compositionRect.x.toFixed(3),
		compositionRect.y.toFixed(3),
		compositionRect.width.toFixed(3),
		compositionRect.height.toFixed(3),
		contentRect.x.toFixed(3),
		contentRect.y.toFixed(3),
		contentRect.width.toFixed(3),
		contentRect.height.toFixed(3),
		cameraSizeDuringZoom.toFixed(4),
		enableCursorAvoidance ? "avoid" : "steady",
		connectZooms ? "connected" : "split",
		zoomTiming ? JSON.stringify(zoomTiming) : "default-timing",
	].join(":");
}

function smoothWebcamRegion(
	currentRegion: WebcamRegion,
	targetRegion: WebcamRegion,
	compositionRect: PixelRect,
	deltaSeconds: number,
) {
	if (areEquivalentWebcamRegions(currentRegion, targetRegion, compositionRect)) {
		return cloneWebcamRegion(targetRegion);
	}

	if (targetRegion.anchor !== "free") {
		const currentRect = getWebcamPixelRectInRect(currentRegion, compositionRect);
		const targetRect = getWebcamPixelRectInRect(targetRegion, compositionRect);
		const currentEdges = getRectEdges(currentRect);
		const targetEdges = getRectEdges(targetRect);
		const nextWidth = smoothZoomValue(currentRect.width, targetRect.width, deltaSeconds);
		const nextHeight = smoothZoomValue(currentRect.height, targetRect.height, deltaSeconds);
		const nextLeft = smoothZoomValue(currentEdges.left, targetEdges.left, deltaSeconds);
		const nextRight = smoothZoomValue(currentEdges.right, targetEdges.right, deltaSeconds);
		const nextTop = smoothZoomValue(currentEdges.top, targetEdges.top, deltaSeconds);
		const nextBottom = smoothZoomValue(currentEdges.bottom, targetEdges.bottom, deltaSeconds);
		const nextRect = (() => {
			switch (targetRegion.anchor) {
				case "top-left":
					return {
						x: nextLeft,
						y: nextTop,
						width: nextWidth,
						height: nextHeight,
					};
				case "top-right":
					return {
						x: nextRight - nextWidth,
						y: nextTop,
						width: nextWidth,
						height: nextHeight,
					};
				case "bottom-left":
					return {
						x: nextLeft,
						y: nextBottom - nextHeight,
						width: nextWidth,
						height: nextHeight,
					};
				case "bottom-right":
					return {
						x: nextRight - nextWidth,
						y: nextBottom - nextHeight,
						width: nextWidth,
						height: nextHeight,
					};
				default:
					return currentRect;
			}
		})();

		if (currentRegion.anchor === targetRegion.anchor) {
			const nextRegion = normalizeWebcamRegion({
				...targetRegion,
				size: getWebcamSizeFromPixelRect(targetRegion.shape, nextRect, compositionRect),
				borderRadius: smoothZoomValue(
					currentRegion.borderRadius,
					targetRegion.borderRadius,
					deltaSeconds,
				),
				borderWidth: smoothZoomValue(
					currentRegion.borderWidth,
					targetRegion.borderWidth,
					deltaSeconds,
				),
				opacity: smoothZoomValue(currentRegion.opacity, targetRegion.opacity, deltaSeconds),
			});

			return areEquivalentRects(nextRect, targetRect, 0.75) &&
				hasEquivalentWebcamStyling(nextRegion, targetRegion)
				? cloneWebcamRegion(targetRegion)
				: nextRegion;
		}

		const nextRegion = createFreeWebcamRegionFromPixelRect(
			{
				...targetRegion,
				borderRadius: smoothZoomValue(
					currentRegion.borderRadius,
					targetRegion.borderRadius,
					deltaSeconds,
				),
				borderWidth: smoothZoomValue(
					currentRegion.borderWidth,
					targetRegion.borderWidth,
					deltaSeconds,
				),
				opacity: smoothZoomValue(currentRegion.opacity, targetRegion.opacity, deltaSeconds),
			},
			nextRect,
			compositionRect,
		);

		return areEquivalentRects(nextRect, targetRect, 0.75) &&
			hasEquivalentWebcamStyling(nextRegion, targetRegion)
			? cloneWebcamRegion(targetRegion)
			: nextRegion;
	}

	const currentFreeRegion = convertRegionToFreePosition(currentRegion, compositionRect);
	const targetFreeRegion = convertRegionToFreePosition(targetRegion, compositionRect);
	const nextFreeRegion = normalizeWebcamRegion({
		...targetFreeRegion,
		anchor: "free",
		position: {
			x: smoothZoomValue(currentFreeRegion.position.x, targetFreeRegion.position.x, deltaSeconds),
			y: smoothZoomValue(currentFreeRegion.position.y, targetFreeRegion.position.y, deltaSeconds),
		},
		size: {
			width: smoothZoomValue(
				currentFreeRegion.size.width,
				targetFreeRegion.size.width,
				deltaSeconds,
			),
			height: smoothZoomValue(
				currentFreeRegion.size.height,
				targetFreeRegion.size.height,
				deltaSeconds,
			),
		},
		borderRadius: smoothZoomValue(
			currentFreeRegion.borderRadius,
			targetFreeRegion.borderRadius,
			deltaSeconds,
		),
		borderWidth: smoothZoomValue(
			currentFreeRegion.borderWidth,
			targetFreeRegion.borderWidth,
			deltaSeconds,
		),
		opacity: smoothZoomValue(currentFreeRegion.opacity, targetFreeRegion.opacity, deltaSeconds),
	});

	return areEquivalentWebcamRegions(nextFreeRegion, targetRegion, compositionRect, 2)
		? cloneWebcamRegion(targetRegion)
		: nextFreeRegion;
}

function shouldSnapToRestoredHomeRegion(params: {
	targetZoomProgress: number;
	currentScale: number;
	currentRegion: WebcamRegion;
	homeRegion: WebcamRegion;
	compositionRect: PixelRect;
}) {
	const { targetZoomProgress, currentScale, currentRegion, homeRegion, compositionRect } = params;

	return (
		targetZoomProgress <= WEBCAM_RESTORE_SETTLE_PROGRESS_EPSILON &&
		Math.abs(currentScale - CAMERA_ZOOM_SCALE_DISABLED) <= WEBCAM_RESTORE_SETTLE_SCALE_EPSILON &&
		areEquivalentWebcamRegions(
			currentRegion,
			homeRegion,
			compositionRect,
			WEBCAM_RESTORE_SETTLE_RECT_EPSILON_PX,
		)
	);
}

function shouldSnapImmediatelyToResolvedHomeRegion(params: {
	targetZoomProgress: number;
	targetRegion: WebcamRegion;
	homeRegion: WebcamRegion;
	compositionRect: PixelRect;
}) {
	const { targetZoomProgress, targetRegion, homeRegion, compositionRect } = params;

	return (
		targetZoomProgress <= WEBCAM_RESTORE_SETTLE_PROGRESS_EPSILON &&
		areEquivalentWebcamRegions(targetRegion, homeRegion, compositionRect, 0.75)
	);
}

export function createWebcamZoomMotionState(initialRegion: WebcamRegion): WebcamZoomMotionState {
	return {
		homeRegion: cloneWebcamRegion(initialRegion),
		activeRegion: cloneWebcamRegion(initialRegion),
		scale: CAMERA_ZOOM_SCALE_DISABLED,
		progress: 0,
		lastPlaybackTimeMs: null,
		motionKey: null,
	};
}

export function evaluateWebcamZoomMotionFrame(params: {
	state: WebcamZoomMotionState;
	playbackTimeMs: number;
	baseRegion: WebcamRegion;
	zoomRegions: ZoomRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	cameraSizeDuringZoom?: number;
	enableCursorAvoidance?: boolean;
	compositionRect: PixelRect;
	contentRect: PixelRect;
	shouldSmooth: boolean;
}) {
	const {
		state,
		playbackTimeMs,
		baseRegion,
		zoomRegions,
		cursorTelemetry = [],
		connectZooms = true,
		zoomTiming,
		cameraSizeDuringZoom = CAMERA_ZOOM_SCALE_DISABLED,
		enableCursorAvoidance = false,
		compositionRect,
		contentRect,
		shouldSmooth,
	} = params;
	const targetState = resolveDefaultModeRegion({
		baseRegion,
		zoomRegions,
		cursorTelemetry,
		timeMs: playbackTimeMs,
		connectZooms,
		zoomTiming,
		cameraSizeDuringZoom,
		enableCursorAvoidance,
		compositionRect,
		contentRect,
	});
	const motionKey = resolveWebcamMotionKey({
		baseRegion,
		compositionRect,
		contentRect,
		cameraSizeDuringZoom,
		enableCursorAvoidance,
		connectZooms,
		zoomTiming,
	});
	const hasMatchingContext = state.motionKey === motionKey;
	const playbackDeltaMs =
		state.lastPlaybackTimeMs == null ? 0 : Math.max(0, playbackTimeMs - state.lastPlaybackTimeMs);
	const frameDeltaMs = clampWebcamMotionDeltaMs(playbackDeltaMs);
	const shouldSnap =
		!shouldSmooth ||
		!hasMatchingContext ||
		state.lastPlaybackTimeMs == null ||
		playbackTimeMs < state.lastPlaybackTimeMs;
	const nextHomeRegion = cloneWebcamRegion(baseRegion);
	let nextRegion = cloneWebcamRegion(targetState.region);
	let nextScale = targetState.scale;
	let nextProgress = targetState.targetZoomProgress;

	if (shouldSnap) {
		nextRegion = cloneWebcamRegion(targetState.region);
		nextScale = targetState.scale;
		nextProgress = targetState.targetZoomProgress;
	} else if (frameDeltaMs <= 0) {
		const shouldSnapHomeImmediately = shouldSnapImmediatelyToResolvedHomeRegion({
			targetZoomProgress: targetState.targetZoomProgress,
			targetRegion: targetState.region,
			homeRegion: nextHomeRegion,
			compositionRect,
		});
		nextRegion = shouldSnapHomeImmediately
			? cloneWebcamRegion(nextHomeRegion)
			: cloneWebcamRegion(state.activeRegion);
		nextScale = shouldSnapHomeImmediately ? CAMERA_ZOOM_SCALE_DISABLED : state.scale;
		nextProgress = shouldSnapHomeImmediately ? 0 : state.progress;
	} else {
		const substeps = getWebcamMotionSubstepDeltaMs(frameDeltaMs);
		let steppedRegion = cloneWebcamRegion(state.activeRegion);
		let steppedScale = state.scale;
		let steppedProgress = state.progress;
		let elapsedMs = 0;
		let finalTargetState = targetState;

		for (const stepDeltaMs of substeps) {
			elapsedMs += stepDeltaMs;
			const stepProgress = frameDeltaMs > 0 ? elapsedMs / frameDeltaMs : 1;
			const stepPlaybackTimeMs =
				state.lastPlaybackTimeMs == null
					? playbackTimeMs
					: state.lastPlaybackTimeMs + playbackDeltaMs * stepProgress;
			finalTargetState = resolveDefaultModeRegion({
				baseRegion,
				zoomRegions,
				cursorTelemetry,
				timeMs: stepPlaybackTimeMs,
				connectZooms,
				zoomTiming,
				cameraSizeDuringZoom,
				enableCursorAvoidance,
				compositionRect,
				contentRect,
			});
			const stepDeltaSeconds = stepDeltaMs / 1000;
			steppedRegion = smoothWebcamRegion(
				steppedRegion,
				finalTargetState.region,
				compositionRect,
				stepDeltaSeconds,
			);
			steppedScale = smoothZoomValue(steppedScale, finalTargetState.scale, stepDeltaSeconds);
			steppedProgress = smoothZoomValue(
				steppedProgress,
				finalTargetState.targetZoomProgress,
				stepDeltaSeconds,
			);

			if (
				shouldSnapToRestoredHomeRegion({
					targetZoomProgress: finalTargetState.targetZoomProgress,
					currentScale: steppedScale,
					currentRegion: steppedRegion,
					homeRegion: nextHomeRegion,
					compositionRect,
				})
			) {
				steppedRegion = cloneWebcamRegion(nextHomeRegion);
				steppedScale = CAMERA_ZOOM_SCALE_DISABLED;
				steppedProgress = 0;
			}
		}

		nextRegion = steppedRegion;
		nextScale = steppedScale;
		nextProgress = steppedProgress;
	}
	const nextState: WebcamZoomMotionState = {
		homeRegion: nextHomeRegion,
		activeRegion: nextRegion,
		scale: nextScale,
		progress: nextProgress,
		lastPlaybackTimeMs: playbackTimeMs,
		motionKey,
	};

	return {
		state: nextState,
		motion: {
			region: cloneWebcamRegion(nextRegion),
			scale: nextScale,
			isZoomScaled:
				nextScale < CAMERA_ZOOM_SCALE_DISABLED - 0.001 ||
				targetState.isZoomScaled ||
				nextProgress > 0.001,
			smoothedZoomProgress: nextProgress,
			targetZoomProgress: targetState.targetZoomProgress,
			smoothedWebcamScale: nextScale,
		} satisfies ResolvedWebcamZoomMotion,
	};
}

export function resolveCameraLayoutState(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: ZoomRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	cameraSizeDuringZoom?: number;
	enableCursorAvoidance?: boolean;
	containerWidth?: number;
	containerHeight?: number;
	compositionRect?: PixelRect;
	contentRect?: PixelRect;
	resolvedDefaultMotion?: ResolvedWebcamZoomMotion | null;
	resolvedTargetDefaultMotion?: ResolvedWebcamZoomMotion | null;
}): ResolvedCameraLayoutState {
	const {
		timeMs,
		webcamRegion,
		showWebcam,
		mirrorWebcam = false,
		cameraLayouts = [],
		zoomRegions = [],
		cursorTelemetry = [],
		connectZooms = true,
		zoomTiming,
		cameraSizeDuringZoom = CAMERA_ZOOM_SCALE_DISABLED,
		enableCursorAvoidance = false,
		containerWidth = 1920,
		containerHeight = 1080,
		compositionRect: compositionRectInput,
		contentRect: contentRectInput,
		resolvedDefaultMotion = null,
		resolvedTargetDefaultMotion = null,
	} = params;
	const compositionRect = compositionRectInput ?? {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight,
	};
	const contentRect = contentRectInput ?? compositionRect;

	const activeLayout = showWebcam ? getActiveCameraLayout(cameraLayouts, timeMs) : null;
	const baseDefaultState =
		resolvedDefaultMotion ??
		resolveDefaultModeRegion({
			baseRegion: webcamRegion,
			zoomRegions,
			cursorTelemetry,
			timeMs,
			connectZooms,
			zoomTiming,
			cameraSizeDuringZoom,
			enableCursorAvoidance,
			compositionRect,
			contentRect,
		});
	const layoutTargetRegion = activeLayout
		? mergeWebcamRegion(webcamRegion, activeLayout.regionOverride)
		: webcamRegion;
	const targetDefaultState =
		resolvedTargetDefaultMotion ??
		resolveDefaultModeRegion({
			baseRegion: layoutTargetRegion,
			zoomRegions,
			cursorTelemetry,
			timeMs,
			connectZooms,
			zoomTiming,
			cameraSizeDuringZoom,
			enableCursorAvoidance,
			compositionRect,
			contentRect,
		});
	const activeProgress = activeLayout
		? Math.min(
				activeLayout.transitionInMs && activeLayout.transitionInMs > 0
					? clamp((timeMs - activeLayout.startMs) / activeLayout.transitionInMs, 0, 1)
					: 1,
				activeLayout.transitionOutMs && activeLayout.transitionOutMs > 0
					? clamp((activeLayout.endMs - timeMs) / activeLayout.transitionOutMs, 0, 1)
					: 1,
			)
		: 0;
	const motionProgress =
		activeLayout?.motionPreset === "instant"
			? activeProgress > 0
				? 1
				: 0
			: activeLayout?.motionPreset === "smooth"
				? easeOutScreenStudio(activeProgress * activeProgress)
				: easeOutScreenStudio(activeProgress);
	const mode = showWebcam ? (activeLayout?.mode ?? "default") : "hidden";
	const resolvedRegion =
		mode === "default"
			? lerpWebcamRegion(baseDefaultState.region, targetDefaultState.region, motionProgress)
			: cloneWebcamRegion(baseDefaultState.region);

	return {
		mode,
		region: resolvedRegion,
		baseRegion: cloneWebcamRegion(baseDefaultState.region),
		mirror: mirrorWebcam,
		scale: lerp(baseDefaultState.scale, targetDefaultState.scale, motionProgress),
		isZoomScaled: targetDefaultState.isZoomScaled || baseDefaultState.isZoomScaled,
		activeLayoutId: activeLayout?.id ?? null,
		layoutProgress: activeLayout ? motionProgress : 0,
		motionPreset: activeLayout?.motionPreset ?? "focused",
	};
}

export function resolveWebcamRenderModel(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: ZoomRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	cameraSizeDuringZoom?: number;
	enableCursorAvoidance?: boolean;
	containerWidth: number;
	containerHeight: number;
	sourceSize?: WebcamSourceSize | null;
	compositionRect?: PixelRect;
	contentRect?: PixelRect;
	resolvedDefaultMotion?: ResolvedWebcamZoomMotion | null;
	resolvedTargetDefaultMotion?: ResolvedWebcamZoomMotion | null;
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
	const baseDisplayRect = getWebcamPixelRectInRect(cameraState.baseRegion, compositionRect);

	if (cameraState.mode === "fullscreen") {
		const progress = clamp(cameraState.layoutProgress, 0, 1);
		const displayRect = {
			x: lerp(baseDisplayRect.x, compositionRect.x, progress),
			y: lerp(baseDisplayRect.y, compositionRect.y, progress),
			width: lerp(baseDisplayRect.width, compositionRect.width, progress),
			height: lerp(baseDisplayRect.height, compositionRect.height, progress),
		};

		return {
			...cameraState,
			displayRect,
			sourceCrop: getCoverCropRect(sourceSize, displayRect),
			clipShape: "round-rect",
			borderRadiusPx: lerp(cameraState.baseRegion.borderRadius, 0, progress),
			borderWidthPx: lerp(cameraState.baseRegion.borderWidth, 0, progress),
			shadowBlurPx: lerp(16, 0, progress),
			shadowOffsetYPx: lerp(6, 0, progress),
			shadowOpacity: lerp(0.34, 0, progress),
			opacity: 1,
		};
	}

	const displayRect =
		cameraState.mode === "hidden"
			? {
					x: lerp(
						baseDisplayRect.x,
						baseDisplayRect.x + baseDisplayRect.width * 0.04,
						cameraState.layoutProgress,
					),
					y: lerp(
						baseDisplayRect.y,
						baseDisplayRect.y + baseDisplayRect.height * 0.04,
						cameraState.layoutProgress,
					),
					width: lerp(
						baseDisplayRect.width,
						baseDisplayRect.width * 0.92,
						cameraState.layoutProgress,
					),
					height: lerp(
						baseDisplayRect.height,
						baseDisplayRect.height * 0.92,
						cameraState.layoutProgress,
					),
				}
			: getWebcamPixelRectInRect(cameraState.region, compositionRect);
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
