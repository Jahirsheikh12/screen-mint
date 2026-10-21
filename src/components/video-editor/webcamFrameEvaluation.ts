import {
	createWebcamZoomMotionState,
	evaluateWebcamZoomMotionFrame,
	getActiveCameraLayout,
	mergeWebcamRegion,
	type PixelRect,
	resolveWebcamRenderModel,
	type WebcamZoomMotionState,
} from "./cameraLayouts";
import type {
	CameraLayoutRegion,
	CursorTelemetryPoint,
	WebcamEffects,
	WebcamPreviewMode,
	WebcamRegion,
	ZoomRegion,
	ZoomTimingSettings,
} from "./types";
import { DEFAULT_WEBCAM_EFFECTS, DEFAULT_WEBCAM_REGION } from "./types";
import { resolveWebcamRenderPlan, type WebcamRenderPlan } from "./webcamRenderPlan";
import type { WebcamPreviewBudget, WebcamRenderSpec } from "./webcamRenderSpec";

export interface WebcamFrameEvaluationState {
	baseMotionState: WebcamZoomMotionState;
	layoutMotionState: WebcamZoomMotionState;
}

export interface WebcamFrameEvaluationInput {
	state?: Partial<WebcamFrameEvaluationState> | null;
	playbackTimeMs: number;
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
	compositionRect: PixelRect;
	contentRect: PixelRect;
	containerWidth: number;
	containerHeight: number;
	sourceSize?: { width: number; height: number } | null;
	effects?: WebcamEffects | null;
	renderMode: "preview" | "export";
	previewMode?: WebcamPreviewMode;
	previewBudget?: WebcamPreviewBudget | null;
	sourceKey?: string;
	segmentationUnavailable?: boolean;
	shouldSmooth: boolean;
	backgroundCacheKey?: string | null;
}

export interface WebcamFrameEvaluationResult extends WebcamRenderPlan {
	baseMotionState: WebcamZoomMotionState;
	layoutMotionState: WebcamZoomMotionState;
	renderSpec: WebcamRenderSpec;
}

function cloneRegion(region: WebcamRegion): WebcamRegion {
	return {
		...region,
		position: { ...region.position },
		size: { ...region.size },
	};
}

function cloneMotionState(state: WebcamZoomMotionState): WebcamZoomMotionState {
	return {
		homeRegion: cloneRegion(state.homeRegion),
		activeRegion: cloneRegion(state.activeRegion),
		scale: state.scale,
		progress: state.progress,
		lastPlaybackTimeMs: state.lastPlaybackTimeMs,
		motionKey: state.motionKey,
	};
}

function getInitialMotionState(
	state: WebcamZoomMotionState | null | undefined,
	webcamRegion: WebcamRegion,
): WebcamZoomMotionState {
	return state ? cloneMotionState(state) : createWebcamZoomMotionState(webcamRegion);
}

export function evaluateWebcamFrame(
	input: WebcamFrameEvaluationInput,
): WebcamFrameEvaluationResult {
	const baseMotionState = getInitialMotionState(input.state?.baseMotionState, input.webcamRegion);
	const layoutMotionState = getInitialMotionState(
		input.state?.layoutMotionState,
		input.webcamRegion,
	);
	const baseMotion = evaluateWebcamZoomMotionFrame({
		state: baseMotionState,
		playbackTimeMs: input.playbackTimeMs,
		baseRegion: input.webcamRegion,
		zoomRegions: input.zoomRegions ?? [],
		cursorTelemetry: input.cursorTelemetry ?? [],
		connectZooms: input.connectZooms,
		zoomTiming: input.zoomTiming,
		cameraSizeDuringZoom: input.cameraSizeDuringZoom,
		enableCursorAvoidance: input.enableCursorAvoidance,
		compositionRect: input.compositionRect,
		contentRect: input.contentRect,
		shouldSmooth: input.shouldSmooth,
	});
	const activeCameraLayout = input.showWebcam
		? getActiveCameraLayout(input.cameraLayouts, input.playbackTimeMs)
		: null;
	const layoutBaseRegion = activeCameraLayout
		? mergeWebcamRegion(input.webcamRegion, activeCameraLayout.regionOverride)
		: input.webcamRegion;
	const targetLayoutMotion = evaluateWebcamZoomMotionFrame({
		state: layoutMotionState,
		playbackTimeMs: input.playbackTimeMs,
		baseRegion: layoutBaseRegion,
		zoomRegions: input.zoomRegions ?? [],
		cursorTelemetry: input.cursorTelemetry ?? [],
		connectZooms: input.connectZooms,
		zoomTiming: input.zoomTiming,
		cameraSizeDuringZoom: input.cameraSizeDuringZoom,
		enableCursorAvoidance: input.enableCursorAvoidance,
		compositionRect: input.compositionRect,
		contentRect: input.contentRect,
		shouldSmooth: input.shouldSmooth,
	});
	const renderModel = resolveWebcamRenderModel({
		timeMs: input.playbackTimeMs,
		webcamRegion: input.webcamRegion,
		showWebcam: input.showWebcam,
		mirrorWebcam: input.mirrorWebcam,
		cameraLayouts: input.cameraLayouts,
		zoomRegions: input.zoomRegions,
		cursorTelemetry: input.cursorTelemetry,
		connectZooms: input.connectZooms,
		zoomTiming: input.zoomTiming,
		cameraSizeDuringZoom: input.cameraSizeDuringZoom,
		enableCursorAvoidance: input.enableCursorAvoidance,
		containerWidth: input.containerWidth,
		containerHeight: input.containerHeight,
		sourceSize: input.sourceSize,
		compositionRect: input.compositionRect,
		contentRect: input.contentRect,
		resolvedDefaultMotion: baseMotion.motion,
		resolvedTargetDefaultMotion: targetLayoutMotion.motion,
	});
	const plan = resolveWebcamRenderPlan({
		timeMs: input.playbackTimeMs,
		webcamRegion: input.webcamRegion,
		showWebcam: input.showWebcam,
		resolvedRenderModel: renderModel,
		mirrorWebcam: input.mirrorWebcam,
		cameraLayouts: input.cameraLayouts,
		zoomRegions: input.zoomRegions,
		cursorTelemetry: input.cursorTelemetry,
		connectZooms: input.connectZooms,
		zoomTiming: input.zoomTiming,
		cameraSizeDuringZoom: input.cameraSizeDuringZoom,
		enableCursorAvoidance: input.enableCursorAvoidance,
		containerWidth: input.containerWidth,
		containerHeight: input.containerHeight,
		sourceSize: input.sourceSize,
		compositionRect: input.compositionRect,
		contentRect: input.contentRect,
		effects: input.effects ?? DEFAULT_WEBCAM_EFFECTS,
		renderMode: input.renderMode,
		previewMode: input.previewMode,
		previewBudget: input.previewBudget,
		sourceKey: input.sourceKey,
		segmentationUnavailable: input.segmentationUnavailable,
		backgroundCacheKey: input.backgroundCacheKey,
	});

	return {
		...plan,
		baseMotionState: baseMotion.state,
		layoutMotionState: targetLayoutMotion.state,
		renderSpec: plan.spec,
	};
}

export function createDefaultWebcamFrameEvaluationState(): WebcamFrameEvaluationState {
	return {
		baseMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
		layoutMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
	};
}
