import {
	createWebcamZoomMotionState,
	type PixelRect,
	type WebcamZoomMotionState,
} from "./cameraLayouts";
import type {
	CameraLayoutRegion,
	CursorTelemetryPoint,
	WebcamEffects,
	WebcamPreviewMode,
	WebcamRegion,
	ZoomRegion,
} from "./types";
import { evaluateWebcamFrame, type WebcamFrameEvaluationResult } from "./webcamFrameEvaluation";
import { resolveWebcamRenderPlan, type WebcamRenderPlan } from "./webcamRenderPlan";
import { resolveWebcamRenderSpec, type WebcamRenderSpec } from "./webcamRenderSpec";

export interface WebcamRegressionCaptureFixture {
	name: string;
	sourceSize: { width: number; height: number };
	previewStageRect: PixelRect;
	previewCompositionRect: PixelRect;
	previewContentRect: PixelRect;
	exportRect: PixelRect;
	exportCompositionRect?: PixelRect;
	exportContentRect?: PixelRect;
	webcamRegion: WebcamRegion;
	effects: WebcamEffects;
	showWebcam: boolean;
	mirrorWebcam: boolean;
	connectZooms: boolean;
	cameraSizeDuringZoom: number;
	cameraLayouts: CameraLayoutRegion[];
	zoomRegions: ZoomRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	samplesMs: number[];
}

export interface WebcamRegressionPipelineFrame {
	timeMs: number;
	previewEvaluation: WebcamFrameEvaluationResult;
	exportEvaluation: WebcamFrameEvaluationResult;
	previewDrawPlan: WebcamRenderPlan;
	exportDrawSpec: WebcamRenderSpec;
}

interface WebcamRegressionState {
	baseMotionState: WebcamZoomMotionState;
	layoutMotionState: WebcamZoomMotionState;
}

export function normalizeRegressionRect(rect: PixelRect, referenceRect: PixelRect) {
	return {
		x: (rect.x - referenceRect.x) / referenceRect.width,
		y: (rect.y - referenceRect.y) / referenceRect.height,
		width: rect.width / referenceRect.width,
		height: rect.height / referenceRect.height,
	};
}

export function evaluateWebcamRegressionFixture(
	fixture: WebcamRegressionCaptureFixture,
	options: {
		previewMode?: WebcamPreviewMode;
		samplesMs?: number[];
		shouldSmooth?: boolean;
	} = {},
): WebcamRegressionPipelineFrame[] {
	const previewMode = options.previewMode ?? "exact";
	const shouldSmooth = options.shouldSmooth ?? true;
	const samplesMs = options.samplesMs ?? fixture.samplesMs;
	let previewState: WebcamRegressionState = {
		baseMotionState: createWebcamZoomMotionState(fixture.webcamRegion),
		layoutMotionState: createWebcamZoomMotionState(fixture.webcamRegion),
	};
	let exportState: WebcamRegressionState = {
		baseMotionState: createWebcamZoomMotionState(fixture.webcamRegion),
		layoutMotionState: createWebcamZoomMotionState(fixture.webcamRegion),
	};

	return samplesMs.map((timeMs) => {
		const exportCompositionRect = fixture.exportCompositionRect ?? fixture.exportRect;
		const exportContentRect = fixture.exportContentRect ?? exportCompositionRect;
		const previewEvaluation = evaluateWebcamFrame({
			state: previewState,
			playbackTimeMs: timeMs,
			webcamRegion: fixture.webcamRegion,
			showWebcam: fixture.showWebcam,
			mirrorWebcam: fixture.mirrorWebcam,
			cameraLayouts: fixture.cameraLayouts,
			zoomRegions: fixture.zoomRegions,
			cursorTelemetry: fixture.cursorTelemetry,
			connectZooms: fixture.connectZooms,
			cameraSizeDuringZoom: fixture.cameraSizeDuringZoom,
			enableCursorAvoidance: fixture.effects.subtleAvoidance,
			compositionRect: fixture.previewCompositionRect,
			contentRect: fixture.previewContentRect,
			containerWidth: fixture.previewStageRect.width,
			containerHeight: fixture.previewStageRect.height,
			sourceSize: fixture.sourceSize,
			effects: fixture.effects,
			renderMode: "preview",
			previewMode,
			sourceKey: `${fixture.name}:preview`,
			shouldSmooth,
		});
		const exportEvaluation = evaluateWebcamFrame({
			state: exportState,
			playbackTimeMs: timeMs,
			webcamRegion: fixture.webcamRegion,
			showWebcam: fixture.showWebcam,
			mirrorWebcam: fixture.mirrorWebcam,
			cameraLayouts: fixture.cameraLayouts,
			zoomRegions: fixture.zoomRegions,
			cursorTelemetry: fixture.cursorTelemetry,
			connectZooms: fixture.connectZooms,
			cameraSizeDuringZoom: fixture.cameraSizeDuringZoom,
			enableCursorAvoidance: fixture.effects.subtleAvoidance,
			compositionRect: exportCompositionRect,
			contentRect: exportContentRect,
			containerWidth: fixture.exportRect.width,
			containerHeight: fixture.exportRect.height,
			sourceSize: fixture.sourceSize,
			effects: fixture.effects,
			renderMode: "export",
			sourceKey: `${fixture.name}:export`,
			shouldSmooth,
		});
		const previewDrawPlan = resolveWebcamRenderPlan({
			timeMs,
			webcamRegion: previewEvaluation.renderSpec.renderModel.region,
			showWebcam: previewEvaluation.renderSpec.renderModel.opacity > 0,
			resolvedRenderModel: previewEvaluation.renderSpec.renderModel,
			containerWidth: previewEvaluation.renderSpec.renderModel.displayRect.width,
			containerHeight: previewEvaluation.renderSpec.renderModel.displayRect.height,
			sourceSize: fixture.sourceSize,
			effects: fixture.effects,
			renderMode: "preview",
			previewMode,
			previewBudget: previewEvaluation.previewBudget,
			sourceKey: `${fixture.name}:preview`,
		});
		const exportDrawSpec = resolveWebcamRenderSpec({
			timeMs,
			webcamRegion: fixture.webcamRegion,
			showWebcam: fixture.showWebcam,
			resolvedRenderModel: exportEvaluation.renderSpec.renderModel,
			containerWidth: fixture.exportRect.width,
			containerHeight: fixture.exportRect.height,
			sourceSize: fixture.sourceSize,
			effects: fixture.effects,
			renderMode: "export",
		});

		previewState = {
			baseMotionState: previewEvaluation.baseMotionState,
			layoutMotionState: previewEvaluation.layoutMotionState,
		};
		exportState = {
			baseMotionState: exportEvaluation.baseMotionState,
			layoutMotionState: exportEvaluation.layoutMotionState,
		};

		return {
			timeMs,
			previewEvaluation,
			exportEvaluation,
			previewDrawPlan,
			exportDrawSpec,
		};
	});
}
