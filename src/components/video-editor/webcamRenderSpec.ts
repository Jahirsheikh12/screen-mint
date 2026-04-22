import {
	type PixelRect,
	type ResolvedWebcamRenderModel,
	resolveWebcamRenderModel,
	resolveWebcamSourceCrop,
} from "./cameraLayouts";
import {
	type CameraLayoutRegion,
	type CursorTelemetryPoint,
	DEFAULT_WEBCAM_EFFECTS,
	type WebcamBackgroundMode,
	type WebcamDegradationStep,
	type WebcamEffectFallbackState,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamPreviewMode,
	type WebcamRegion,
	type WebcamRenderQualityTier,
	type WebcamSegmentationProviderStatus,
} from "./types";
import {
	type ResolvedWebcamCompositionModel,
	resolveAppliedBackgroundMode,
	resolveWebcamCompositionModel,
	type WebcamRect,
} from "./webcamEffects";
import type { WebcamSegmentationFrame } from "./webcamSegmentation";

export interface WebcamPreviewBudget {
	qualityTier: WebcamRenderQualityTier;
	fallbackState: WebcamEffectFallbackState;
	segmentationMaxEdge: number;
	renderScale: number;
	segmentationCadenceMs: number;
	fallbackReason?: string;
}

export interface WebcamRenderSpec {
	renderMode: "preview" | "export";
	renderModel: ResolvedWebcamRenderModel;
	requestedEffects: WebcamEffects;
	effectiveEffects: WebcamEffects;
	compositionModel: ResolvedWebcamCompositionModel;
	displayRect: WebcamRect;
	configuredBackgroundMode: WebcamBackgroundMode;
	appliedBackgroundMode: WebcamBackgroundMode;
	fallbackState: WebcamEffectFallbackState;
	degradationStep: WebcamDegradationStep;
	segmentationRequired: boolean;
	segmentationProviderStatus: WebcamSegmentationProviderStatus;
	segmentationMaxEdge: number;
	renderResolutionScale: number;
	segmentationCadenceMs: number;
	fallbackReason?: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function resolvePreviewWebcamBudget(params: {
	effects: WebcamEffects;
	targetFps: number;
	observedFps: number;
	segmentationFps: number;
	workerLatencyMs: number;
	renderCostMs: number;
	segmentationUnavailable: boolean;
}): WebcamPreviewBudget {
	const {
		effects,
		targetFps,
		observedFps,
		segmentationFps,
		workerLatencyMs,
		renderCostMs,
		segmentationUnavailable,
	} = params;

	if (effects.backgroundMode === "none" || targetFps <= 0) {
		return {
			qualityTier: "full-preview",
			fallbackState: "none",
			segmentationMaxEdge: 320,
			renderScale: 1.25,
			segmentationCadenceMs: targetFps >= 50 ? 66 : 80,
		};
	}

	if (segmentationUnavailable) {
		return {
			qualityTier: "raw-webcam-only",
			fallbackState: "segmentation-unavailable",
			segmentationMaxEdge: 0,
			renderScale: 1,
			segmentationCadenceMs: Number.POSITIVE_INFINITY,
			fallbackReason: "Segmentation provider unavailable",
		};
	}

	const playbackRatio = observedFps / Math.max(targetFps, 1);
	const effectiveSegmentationFps = segmentationFps || targetFps;

	if (playbackRatio < 0.42 || workerLatencyMs > 64 || renderCostMs > 30) {
		return {
			qualityTier: "raw-webcam-only",
			fallbackState: "raw-webcam-only",
			segmentationMaxEdge: 0,
			renderScale: 1,
			segmentationCadenceMs: Number.POSITIVE_INFINITY,
			fallbackReason: "Preview budget exceeded",
		};
	}

	if (
		playbackRatio < 0.58 ||
		workerLatencyMs > 44 ||
		renderCostMs > 22 ||
		(effectiveSegmentationFps > 0 && effectiveSegmentationFps < targetFps * 0.38)
	) {
		return {
			qualityTier: "simplified-preview-effects",
			fallbackState:
				effects.backgroundMode === "image" ? "replacement-disabled" : "reduced-background-sampling",
			segmentationMaxEdge: 256,
			renderScale: 1,
			segmentationCadenceMs: 120,
			fallbackReason: "Preview rendering simplified",
		};
	}

	if (playbackRatio < 0.76 || workerLatencyMs > 34 || renderCostMs > 16) {
		return {
			qualityTier: "reduced-preview-resolution",
			fallbackState: "reduced-background-sampling",
			segmentationMaxEdge: 256,
			renderScale: 1,
			segmentationCadenceMs: 96,
			fallbackReason: "Preview resolution reduced",
		};
	}

	if (
		playbackRatio < 0.9 ||
		renderCostMs > 11 ||
		effectiveSegmentationFps < Math.min(targetFps, 15) * 0.8
	) {
		return {
			qualityTier: "reduced-cadence",
			fallbackState: "reduced-segmentation-rate",
			segmentationMaxEdge: 320,
			renderScale: 1.1,
			segmentationCadenceMs: 110,
			fallbackReason: "Segmentation cadence reduced",
		};
	}

	return {
		qualityTier: "full-preview",
		fallbackState: "none",
		segmentationMaxEdge: 320,
		renderScale: 1.25,
		segmentationCadenceMs: targetFps >= 50 ? 66 : 80,
	};
}

export function applyPreviewWebcamBudget(
	effects: WebcamEffects,
	budget: WebcamPreviewBudget,
): WebcamEffects {
	switch (budget.qualityTier) {
		case "raw-webcam-only":
			return { ...effects, backgroundMode: "none", backgroundBlurStrength: 0 };
		case "simplified-preview-effects":
			return {
				...effects,
				backgroundMode: effects.backgroundMode === "image" ? "solid" : effects.backgroundMode,
				backgroundBlurStrength: Math.min(effects.backgroundBlurStrength, 12),
				shadowStrength: Math.min(effects.shadowStrength, 0.35),
			};
		case "reduced-preview-resolution":
			return {
				...effects,
				backgroundBlurStrength: Math.min(effects.backgroundBlurStrength, 14),
				shadowStrength: Math.min(effects.shadowStrength, 0.42),
			};
		case "reduced-cadence":
			return {
				...effects,
				backgroundBlurStrength: Math.min(effects.backgroundBlurStrength, 16),
				shadowStrength: Math.min(effects.shadowStrength, 0.48),
			};
		default:
			return effects;
	}
}

function buildExportBudget(): WebcamPreviewBudget {
	return {
		qualityTier: "full-preview",
		fallbackState: "none",
		segmentationMaxEdge: 512,
		renderScale: 1,
		segmentationCadenceMs: 1000 / 15,
	};
}

export function resolveWebcamRenderSpec(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	resolvedRenderModel?: ResolvedWebcamRenderModel | null;
	compositionRenderMode?: "preview" | "export";
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: import("./types").ZoomRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	connectZooms?: boolean;
	cameraSizeDuringZoom?: number;
	enableCursorAvoidance?: boolean;
	containerWidth: number;
	containerHeight: number;
	sourceSize?: { width: number; height: number } | null;
	compositionRect?: PixelRect;
	contentRect?: PixelRect;
	effects?: WebcamEffects | null;
	renderMode: "preview" | "export";
	segmentationFrame?: WebcamSegmentationFrame | null;
	previewBudget?: WebcamPreviewBudget | null;
	forcedFallbackState?: WebcamEffectFallbackState;
	backgroundCacheKey?: string | null;
}): WebcamRenderSpec {
	const requestedEffects = params.effects ?? DEFAULT_WEBCAM_EFFECTS;
	const previewBudget =
		params.renderMode === "preview"
			? (params.previewBudget ?? buildExportBudget())
			: buildExportBudget();
	const fallbackState =
		params.renderMode === "preview"
			? (params.forcedFallbackState ?? previewBudget.fallbackState)
			: (params.forcedFallbackState ?? "none");
	const effectiveEffects =
		params.renderMode === "preview"
			? applyPreviewWebcamBudget(requestedEffects, previewBudget)
			: requestedEffects;
	const renderModel =
		params.resolvedRenderModel ??
		resolveWebcamRenderModel({
			timeMs: params.timeMs,
			webcamRegion: params.webcamRegion,
			showWebcam: params.showWebcam,
			mirrorWebcam: params.mirrorWebcam,
			cameraLayouts: params.cameraLayouts,
			zoomRegions: params.zoomRegions,
			cursorTelemetry: params.cursorTelemetry,
			connectZooms: params.connectZooms,
			cameraSizeDuringZoom: params.cameraSizeDuringZoom,
			enableCursorAvoidance: params.enableCursorAvoidance,
			containerWidth: params.containerWidth,
			containerHeight: params.containerHeight,
			sourceSize: params.sourceSize,
			compositionRect: params.compositionRect,
			contentRect: params.contentRect,
		});
	const hydratedRenderModel =
		params.sourceSize &&
		params.sourceSize.width > 0 &&
		params.sourceSize.height > 0 &&
		(renderModel.sourceCrop == null ||
			renderModel.sourceCrop.width <= 0 ||
			renderModel.sourceCrop.height <= 0)
			? {
					...renderModel,
					sourceCrop: resolveWebcamSourceCrop(params.sourceSize, renderModel.displayRect),
				}
			: renderModel;

	const compositionModel = resolveWebcamCompositionModel({
		displayRect: hydratedRenderModel.displayRect,
		sourceCrop: hydratedRenderModel.sourceCrop,
		sourceSize: params.sourceSize,
		effects: effectiveEffects,
		renderMode: params.compositionRenderMode ?? params.renderMode,
		backgroundCacheKey: params.backgroundCacheKey ?? null,
		previewFallbackState: fallbackState,
		segmentationFrame: params.segmentationFrame,
	});

	const configuredBackgroundMode = requestedEffects.backgroundMode;
	const appliedBackgroundMode = compositionModel.backgroundMode;
	const segmentationRequired =
		hydratedRenderModel.opacity > 0 &&
		hydratedRenderModel.mode !== "hidden" &&
		configuredBackgroundMode !== "none" &&
		resolveAppliedBackgroundMode(configuredBackgroundMode, fallbackState) !== "none";
	const segmentationProviderStatus: WebcamSegmentationProviderStatus = !segmentationRequired
		? "not-required"
		: compositionModel.usesSegmentation || Boolean(params.segmentationFrame?.mask)
			? "ready"
			: fallbackState === "segmentation-unavailable"
				? "unavailable"
				: "ready";

	return {
		renderMode: params.renderMode,
		renderModel: hydratedRenderModel,
		requestedEffects,
		effectiveEffects,
		compositionModel,
		displayRect: hydratedRenderModel.displayRect,
		configuredBackgroundMode,
		appliedBackgroundMode,
		fallbackState,
		degradationStep:
			params.renderMode === "export" ? "export-reference" : previewBudget.qualityTier,
		segmentationRequired,
		segmentationProviderStatus,
		segmentationMaxEdge: previewBudget.segmentationMaxEdge,
		renderResolutionScale: previewBudget.renderScale,
		segmentationCadenceMs: previewBudget.segmentationCadenceMs,
		fallbackReason: previewBudget.fallbackReason,
	};
}

export function buildWebcamHealthMetrics(params: {
	spec: WebcamRenderSpec;
	targetFps: number;
	observedFps: number;
	segmentationFps: number;
	segmentationWorkingSize?: { width: number; height: number } | null;
	previewMode?: WebcamPreviewMode;
	driftMs?: number;
	renderLatencyMs?: number;
	frameQueueDepth?: number;
	segmentCompatibilityWarnings?: string[];
}): WebcamHealthMetrics {
	const {
		spec,
		targetFps,
		observedFps,
		segmentationFps,
		segmentationWorkingSize,
		previewMode,
		driftMs,
		renderLatencyMs,
		frameQueueDepth,
		segmentCompatibilityWarnings,
	} = params;
	return {
		targetFps,
		observedFps,
		segmentationFps,
		droppedFrameRatio: targetFps > 0 ? clamp(1 - observedFps / Math.max(targetFps, 1), 0, 1) : 0,
		effectFallbackState: spec.fallbackState,
		previewMode,
		configuredBackgroundMode: spec.configuredBackgroundMode,
		appliedBackgroundMode: spec.appliedBackgroundMode,
		degradationStep: spec.degradationStep,
		previewQualityTier:
			spec.renderMode === "preview" && spec.degradationStep !== "export-reference"
				? spec.degradationStep
				: undefined,
		segmentationWorkingWidth: segmentationWorkingSize?.width,
		segmentationWorkingHeight: segmentationWorkingSize?.height,
		segmentationProviderStatus: spec.segmentationProviderStatus,
		renderResolutionScale: spec.renderResolutionScale,
		driftMs,
		renderLatencyMs,
		frameQueueDepth,
		segmentCompatibilityWarnings,
		fallbackReason: spec.fallbackReason,
	};
}
