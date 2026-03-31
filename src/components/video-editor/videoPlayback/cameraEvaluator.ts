import type { ZoomFocus, ZoomRegion } from "../types";
import { ZOOM_DEPTH_SCALES } from "../types";
import { DEFAULT_FOCUS, ZOOM_SCALE_DEADZONE, ZOOM_TRANSLATION_DEADZONE_PX } from "./constants";
import type { CursorEvaluation, CursorSimulationPath } from "./cursorSimulation";
import { evaluateCursorPath } from "./cursorSimulation";
import { resolveZoomRegionFocus } from "./smartZoomController";
import { findDominantRegion } from "./zoomRegionUtils";
import { computeFocusFromTransform, computeZoomTransform, smoothZoomValue } from "./zoomTransform";

export interface PlaybackCameraState {
	scale: number;
	appliedScale: number;
	focusX: number;
	focusY: number;
	progress: number;
	x: number;
	y: number;
	lastUpdateMs: number | null;
}

export interface CameraEvaluationGeometry {
	stageSize: { width: number; height: number };
	baseMask: { x: number; y: number; width: number; height: number };
}

export interface CameraEvaluationResult {
	state: PlaybackCameraState;
	transform: { scale: number; x: number; y: number };
	targetFocus: ZoomFocus;
	targetScaleFactor: number;
	targetProgress: number;
	motionIntensity: number;
	motionVector: { x: number; y: number };
	simulatedCursor: CursorEvaluation | null;
	region: ZoomRegion | null;
}

export function createPlaybackCameraState(): PlaybackCameraState {
	return {
		scale: 1,
		appliedScale: 1,
		focusX: DEFAULT_FOCUS.cx,
		focusY: DEFAULT_FOCUS.cy,
		progress: 0,
		x: 0,
		y: 0,
		lastUpdateMs: null,
	};
}

export function evaluatePlaybackCameraFrame(args: {
	state: PlaybackCameraState;
	frameTimeMs: number;
	playbackTimeMs: number;
	cursorSimulationPath: CursorSimulationPath | null;
	zoomRegions: ZoomRegion[];
	connectZooms?: boolean;
	geometry: CameraEvaluationGeometry;
	shouldSmooth: boolean;
}): CameraEvaluationResult {
	const {
		state,
		frameTimeMs,
		playbackTimeMs,
		cursorSimulationPath,
		zoomRegions,
		connectZooms,
		geometry,
		shouldSmooth,
	} = args;

	const simulatedCursor = evaluateCursorPath(cursorSimulationPath, playbackTimeMs);
	const deltaSeconds =
		state.lastUpdateMs === null ? 0 : Math.max(0, (frameTimeMs - state.lastUpdateMs) / 1000);
	const { region, strength, blendedScale, transition } = findDominantRegion(
		zoomRegions,
		playbackTimeMs,
		{
			connectZooms,
		},
	);

	let targetScaleFactor = 1;
	let targetFocus = DEFAULT_FOCUS;
	let targetProgress = 0;

	if (region && strength > 0) {
		const zoomScale = blendedScale ?? ZOOM_DEPTH_SCALES[region.depth];
		const regionFocus = resolveZoomRegionFocus(
			region,
			simulatedCursor,
			{
				cx: state.focusX,
				cy: state.focusY,
			},
			deltaSeconds,
		);

		targetScaleFactor = zoomScale;
		targetFocus = regionFocus;
		targetProgress = strength;

		if (transition) {
			const startTransform = computeZoomTransform({
				stageSize: geometry.stageSize,
				baseMask: geometry.baseMask,
				zoomScale: transition.startScale,
				zoomProgress: 1,
				focusX: transition.startFocus.cx,
				focusY: transition.startFocus.cy,
			});
			const endTransform = computeZoomTransform({
				stageSize: geometry.stageSize,
				baseMask: geometry.baseMask,
				zoomScale: transition.endScale,
				zoomProgress: 1,
				focusX: transition.endFocus.cx,
				focusY: transition.endFocus.cy,
			});

			const interpolatedTransform = {
				scale:
					startTransform.scale + (endTransform.scale - startTransform.scale) * transition.progress,
				x: startTransform.x + (endTransform.x - startTransform.x) * transition.progress,
				y: startTransform.y + (endTransform.y - startTransform.y) * transition.progress,
			};

			targetScaleFactor = interpolatedTransform.scale;
			targetFocus = computeFocusFromTransform({
				stageSize: geometry.stageSize,
				baseMask: geometry.baseMask,
				zoomScale: interpolatedTransform.scale,
				x: interpolatedTransform.x,
				y: interpolatedTransform.y,
			});
			targetProgress = 1;
		}
	}

	const prevScale = state.appliedScale;
	const prevX = state.x;
	const prevY = state.y;
	const nextState: PlaybackCameraState = {
		...state,
		lastUpdateMs: frameTimeMs,
		scale: shouldSmooth
			? smoothZoomValue(state.scale, targetScaleFactor, deltaSeconds)
			: targetScaleFactor,
		focusX: shouldSmooth
			? smoothZoomValue(state.focusX, targetFocus.cx, deltaSeconds)
			: targetFocus.cx,
		focusY: shouldSmooth
			? smoothZoomValue(state.focusY, targetFocus.cy, deltaSeconds)
			: targetFocus.cy,
		progress: shouldSmooth
			? smoothZoomValue(state.progress, targetProgress, deltaSeconds)
			: targetProgress,
	};

	const projectedTransform = computeZoomTransform({
		stageSize: geometry.stageSize,
		baseMask: geometry.baseMask,
		zoomScale: nextState.scale,
		zoomProgress: nextState.progress,
		focusX: nextState.focusX,
		focusY: nextState.focusY,
	});

	const appliedScale =
		Math.abs(projectedTransform.scale - prevScale) < ZOOM_SCALE_DEADZONE
			? projectedTransform.scale
			: projectedTransform.scale;
	const appliedX =
		Math.abs(projectedTransform.x - prevX) < ZOOM_TRANSLATION_DEADZONE_PX
			? projectedTransform.x
			: projectedTransform.x;
	const appliedY =
		Math.abs(projectedTransform.y - prevY) < ZOOM_TRANSLATION_DEADZONE_PX
			? projectedTransform.y
			: projectedTransform.y;

	nextState.appliedScale = appliedScale;
	nextState.x = appliedX;
	nextState.y = appliedY;

	const motionIntensity = Math.max(
		Math.abs(appliedScale - prevScale),
		Math.abs(appliedX - prevX) / Math.max(1, geometry.stageSize.width),
		Math.abs(appliedY - prevY) / Math.max(1, geometry.stageSize.height),
	);
	const motionVector = {
		x: appliedX - prevX,
		y: appliedY - prevY,
	};

	return {
		state: nextState,
		transform: { scale: appliedScale, x: appliedX, y: appliedY },
		targetFocus,
		targetScaleFactor,
		targetProgress,
		motionIntensity,
		motionVector,
		simulatedCursor,
		region,
	};
}
