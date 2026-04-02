import type { ZoomFocus, ZoomRegion } from "../types";
import { ZOOM_DEPTH_SCALES } from "../types";
import { DEFAULT_FOCUS } from "./constants";
import type { CursorMotionSnapshot, CursorSimulationPath } from "./cursorSimulation";
import { evaluateCursorMotionSnapshot } from "./cursorSimulation";
import { resolveZoomRegionFocus } from "./smartZoomController";
import { findDominantRegion } from "./zoomRegionUtils";
import { computeFocusFromTransform, computeZoomTransform, smoothZoomValue } from "./zoomTransform";

const CAMERA_FIXED_STEP_MS = 1000 / 120;
const CAMERA_MAX_SUBSTEPS = 12;
const CAMERA_MAX_FRAME_DELTA_MS = 250;
const CAMERA_FOCUS_SMOOTH_TIME_SECONDS = 0.18;
const CAMERA_FOCUS_MAX_SPEED = 8.0;
const SMOOTH_TIME_FACTOR_RESPONSE = 6;

export interface PlaybackCameraState {
	scale: number;
	appliedScale: number;
	focusX: number;
	focusY: number;
	focusVelocityX: number;
	focusVelocityY: number;
	smoothTimeFactor: number;
	progress: number;
	x: number;
	y: number;
	lastUpdateMs: number | null;
	lastPlaybackTimeMs: number | null;
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
	simulatedCursor: CursorMotionSnapshot | null;
	region: ZoomRegion | null;
}

interface CameraTargets {
	motionSnapshot: CursorMotionSnapshot | null;
	region: ZoomRegion | null;
	targetFocus: ZoomFocus;
	targetScaleFactor: number;
	targetProgress: number;
	smoothTimeFactor: number;
}

function smoothDamp(
	current: number,
	target: number,
	currentVelocity: number,
	smoothTime: number,
	maxSpeed: number,
	deltaTime: number,
) {
	const safeSmoothTime = Math.max(0.0001, smoothTime);
	const omega = 2 / safeSmoothTime;
	const x = omega * deltaTime;
	const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

	let change = current - target;
	const originalTarget = target;
	const maxChange = maxSpeed * safeSmoothTime;
	if (Math.abs(change) > maxChange) {
		change = Math.sign(change) * maxChange;
	}

	target = current - change;
	const temp = (currentVelocity + omega * change) * deltaTime;
	let nextVelocity = (currentVelocity - omega * temp) * exp;
	let output = target + (change + temp) * exp;

	const overshot =
		(originalTarget > current && output > originalTarget) ||
		(originalTarget < current && output < originalTarget);
	if (overshot) {
		output = originalTarget;
		nextVelocity = 0;
	}

	return {
		value: output,
		velocity: nextVelocity,
	};
}

function clampDeltaMs(deltaMs: number) {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
		return 0;
	}

	return Math.min(CAMERA_MAX_FRAME_DELTA_MS, deltaMs);
}

function getSubstepDeltaMs(deltaMs: number) {
	if (deltaMs <= 0) {
		return [];
	}

	const stepCount = Math.max(1, Math.min(CAMERA_MAX_SUBSTEPS, Math.ceil(deltaMs / CAMERA_FIXED_STEP_MS)));
	const stepDeltaMs = deltaMs / stepCount;
	return Array.from({ length: stepCount }, () => stepDeltaMs);
}

function resolveCameraTargets(args: {
	playbackTimeMs: number;
	previousPlaybackTimeMs: number | null;
	cursorSimulationPath: CursorSimulationPath | null;
	zoomRegions: ZoomRegion[];
	connectZooms?: boolean;
	geometry: CameraEvaluationGeometry;
	currentFocus: ZoomFocus;
	deltaSeconds: number;
}): CameraTargets {
	const {
		playbackTimeMs,
		previousPlaybackTimeMs,
		cursorSimulationPath,
		zoomRegions,
		connectZooms,
		geometry,
		currentFocus,
		deltaSeconds,
	} = args;

	const motionSnapshot = evaluateCursorMotionSnapshot(
		cursorSimulationPath,
		playbackTimeMs,
		previousPlaybackTimeMs,
	);
	const { region, strength, blendedScale, transition } = findDominantRegion(zoomRegions, playbackTimeMs, {
		connectZooms,
	});

	let targetScaleFactor = 1;
	let targetFocus = DEFAULT_FOCUS;
	let targetProgress = 0;
	let smoothTimeFactor = 1.0;

	if (region && strength > 0) {
		const zoomScale = blendedScale ?? ZOOM_DEPTH_SCALES[region.depth];
		const regionResult = resolveZoomRegionFocus(region, motionSnapshot, currentFocus, deltaSeconds);

		targetScaleFactor = zoomScale;
		targetFocus = regionResult.focus;
		targetProgress = strength;
		smoothTimeFactor = regionResult.smoothTimeFactor;

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

	return {
		motionSnapshot,
		region,
		targetFocus,
		targetScaleFactor,
		targetProgress,
		smoothTimeFactor,
	};
}

export function createPlaybackCameraState(): PlaybackCameraState {
	return {
		scale: 1,
		appliedScale: 1,
		focusX: DEFAULT_FOCUS.cx,
		focusY: DEFAULT_FOCUS.cy,
		focusVelocityX: 0,
		focusVelocityY: 0,
		smoothTimeFactor: 1.0,
		progress: 0,
		x: 0,
		y: 0,
		lastUpdateMs: null,
		lastPlaybackTimeMs: null,
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

	const previousPlaybackTimeMs = state.lastPlaybackTimeMs;
	const previousFocus = {
		cx: state.focusX,
		cy: state.focusY,
	};
	const prevScale = state.appliedScale;
	const prevX = state.x;
	const prevY = state.y;

	let nextState: PlaybackCameraState = {
		...state,
		lastUpdateMs: frameTimeMs,
		lastPlaybackTimeMs: playbackTimeMs,
	};

	let finalTargets: CameraTargets = resolveCameraTargets({
		playbackTimeMs,
		previousPlaybackTimeMs,
		cursorSimulationPath,
		zoomRegions,
		connectZooms,
		geometry,
		currentFocus: previousFocus,
		deltaSeconds: 0,
	});

	if (!shouldSmooth) {
		nextState.scale = finalTargets.targetScaleFactor;
		nextState.focusX = finalTargets.targetFocus.cx;
		nextState.focusY = finalTargets.targetFocus.cy;
		nextState.focusVelocityX = 0;
		nextState.focusVelocityY = 0;
		nextState.smoothTimeFactor = finalTargets.smoothTimeFactor;
		nextState.progress = finalTargets.targetProgress;
	} else {
		const frameDeltaMs =
			state.lastUpdateMs === null ? 0 : clampDeltaMs(frameTimeMs - state.lastUpdateMs);
		const playbackDeltaMs =
			previousPlaybackTimeMs === null ? 0 : Math.max(0, playbackTimeMs - previousPlaybackTimeMs);
		const substeps = getSubstepDeltaMs(frameDeltaMs);
		let steppedFocus = previousFocus;
		let steppedScale = state.scale;
		let steppedProgress = state.progress;
		let steppedFocusVelocityX = state.focusVelocityX;
		let steppedFocusVelocityY = state.focusVelocityY;
		let steppedSmoothTimeFactor = state.smoothTimeFactor;
		let elapsedMs = 0;

		if (substeps.length === 0) {
			finalTargets = resolveCameraTargets({
				playbackTimeMs,
				previousPlaybackTimeMs,
				cursorSimulationPath,
				zoomRegions,
				connectZooms,
				geometry,
				currentFocus: steppedFocus,
				deltaSeconds: 0,
			});
			steppedFocus = finalTargets.targetFocus;
			steppedFocusVelocityX = 0;
			steppedFocusVelocityY = 0;
			steppedSmoothTimeFactor = finalTargets.smoothTimeFactor;
			steppedScale = finalTargets.targetScaleFactor;
			steppedProgress = finalTargets.targetProgress;
		} else {
			for (const stepDeltaMs of substeps) {
				elapsedMs += stepDeltaMs;
				const stepProgress = frameDeltaMs > 0 ? elapsedMs / frameDeltaMs : 1;
				const stepPlaybackTimeMs =
					previousPlaybackTimeMs === null
						? playbackTimeMs
						: previousPlaybackTimeMs + playbackDeltaMs * stepProgress;
				const stepDeltaSeconds = stepDeltaMs / 1000;

				finalTargets = resolveCameraTargets({
					playbackTimeMs: stepPlaybackTimeMs,
					previousPlaybackTimeMs,
					cursorSimulationPath,
					zoomRegions,
					connectZooms,
					geometry,
					currentFocus: steppedFocus,
					deltaSeconds: stepDeltaSeconds,
				});

				const smoothTimeAlpha = 1 - Math.exp(-SMOOTH_TIME_FACTOR_RESPONSE * stepDeltaSeconds);
				steppedSmoothTimeFactor +=
					(finalTargets.smoothTimeFactor - steppedSmoothTimeFactor) * smoothTimeAlpha;

				if (finalTargets.motionSnapshot?.isDiscontinuous) {
					steppedFocus = finalTargets.targetFocus;
					steppedFocusVelocityX = 0;
					steppedFocusVelocityY = 0;
				} else {
					const effectiveSmoothTime =
						CAMERA_FOCUS_SMOOTH_TIME_SECONDS * steppedSmoothTimeFactor;
					const nextFocusX = smoothDamp(
						steppedFocus.cx,
						finalTargets.targetFocus.cx,
						steppedFocusVelocityX,
						effectiveSmoothTime,
						CAMERA_FOCUS_MAX_SPEED,
						stepDeltaSeconds,
					);
					const nextFocusY = smoothDamp(
						steppedFocus.cy,
						finalTargets.targetFocus.cy,
						steppedFocusVelocityY,
						effectiveSmoothTime,
						CAMERA_FOCUS_MAX_SPEED,
						stepDeltaSeconds,
					);
					steppedFocus = {
						cx: nextFocusX.value,
						cy: nextFocusY.value,
					};
					steppedFocusVelocityX = nextFocusX.velocity;
					steppedFocusVelocityY = nextFocusY.velocity;
				}
				steppedScale = smoothZoomValue(steppedScale, finalTargets.targetScaleFactor, stepDeltaSeconds);
				steppedProgress = smoothZoomValue(
					steppedProgress,
					finalTargets.targetProgress,
					stepDeltaSeconds,
				);
			}
		}

		nextState.focusX = steppedFocus.cx;
		nextState.focusY = steppedFocus.cy;
		nextState.focusVelocityX = steppedFocusVelocityX;
		nextState.focusVelocityY = steppedFocusVelocityY;
		nextState.smoothTimeFactor = steppedSmoothTimeFactor;
		nextState.scale = steppedScale;
		nextState.progress = steppedProgress;
	}

	const projectedTransform = computeZoomTransform({
		stageSize: geometry.stageSize,
		baseMask: geometry.baseMask,
		zoomScale: nextState.scale,
		zoomProgress: nextState.progress,
		focusX: nextState.focusX,
		focusY: nextState.focusY,
	});

	nextState.appliedScale = projectedTransform.scale;
	nextState.x = projectedTransform.x;
	nextState.y = projectedTransform.y;

	const motionIntensity = Math.max(
		Math.abs(projectedTransform.scale - prevScale),
		Math.abs(projectedTransform.x - prevX) / Math.max(1, geometry.stageSize.width),
		Math.abs(projectedTransform.y - prevY) / Math.max(1, geometry.stageSize.height),
	);
	const motionVector = {
		x: projectedTransform.x - prevX,
		y: projectedTransform.y - prevY,
	};

	return {
		state: nextState,
		transform: {
			scale: projectedTransform.scale,
			x: projectedTransform.x,
			y: projectedTransform.y,
		},
		targetFocus: finalTargets.targetFocus,
		targetScaleFactor: finalTargets.targetScaleFactor,
		targetProgress: finalTargets.targetProgress,
		motionIntensity,
		motionVector,
		simulatedCursor: finalTargets.motionSnapshot,
		region: finalTargets.region,
	};
}
