import type {
	CameraPreviewCorner,
	CameraPreviewShape,
	CameraPreviewSize,
	CameraSessionState,
	WebcamEffects,
	WebcamPreviewMode,
} from "./types";
import { DEFAULT_WEBCAM_EFFECTS, DEFAULT_WEBCAM_PREVIEW_MODE } from "./types";
import {
	resolveWebcamRenderSpec,
	type WebcamPreviewBudget,
	type WebcamRenderSpec,
} from "./webcamRenderSpec";

export interface WebcamRenderPlan {
	spec: WebcamRenderSpec;
	previewMode: WebcamPreviewMode;
	previewBudget: WebcamPreviewBudget;
	cacheKey: string;
}

export interface ResolvedWebcamFramePlan extends WebcamRenderPlan {}

function resolveExactPreviewBudget(
	effects: WebcamEffects,
	segmentationUnavailable: boolean,
): WebcamPreviewBudget {
	return {
		qualityTier: "full-preview",
		fallbackState: segmentationUnavailable ? "segmentation-unavailable" : "none",
		segmentationMaxEdge: effects.backgroundMode === "none" ? 0 : 512,
		renderScale: 1,
		segmentationCadenceMs: effects.backgroundMode === "none" ? Number.POSITIVE_INFINITY : 1000 / 15,
		fallbackReason: segmentationUnavailable ? "Segmentation provider unavailable" : undefined,
	};
}

function resolvePerformancePreviewBudget(
	effects: WebcamEffects,
	segmentationUnavailable: boolean,
): WebcamPreviewBudget {
	if (segmentationUnavailable) {
		return {
			qualityTier: "reduced-preview-resolution",
			fallbackState: "segmentation-unavailable",
			segmentationMaxEdge: 0,
			renderScale: 1,
			segmentationCadenceMs: Number.POSITIVE_INFINITY,
			fallbackReason: "Segmentation provider unavailable",
		};
	}

	return {
		qualityTier: "reduced-preview-resolution",
		fallbackState: "none",
		segmentationMaxEdge: effects.backgroundMode === "none" ? 0 : 320,
		renderScale: 1,
		segmentationCadenceMs: effects.backgroundMode === "none" ? Number.POSITIVE_INFINITY : 96,
		fallbackReason: "Performance preview mode",
	};
}

function resolvePowerSavingPreviewBudget(
	effects: WebcamEffects,
	segmentationUnavailable: boolean,
): WebcamPreviewBudget {
	if (segmentationUnavailable) {
		return {
			qualityTier: "simplified-preview-effects",
			fallbackState: "segmentation-unavailable",
			segmentationMaxEdge: 0,
			renderScale: 0.9,
			segmentationCadenceMs: Number.POSITIVE_INFINITY,
			fallbackReason: "Segmentation provider unavailable",
		};
	}

	return {
		qualityTier: "simplified-preview-effects",
		fallbackState:
			effects.backgroundMode === "image" ? "replacement-disabled" : "reduced-background-sampling",
		segmentationMaxEdge: effects.backgroundMode === "none" ? 0 : 224,
		renderScale: 0.9,
		segmentationCadenceMs: effects.backgroundMode === "none" ? Number.POSITIVE_INFINITY : 144,
		fallbackReason: "Power saving preview mode",
	};
}

export function resolvePreviewWebcamBudgetByMode(params: {
	previewMode?: WebcamPreviewMode;
	effects: WebcamEffects;
	segmentationUnavailable?: boolean;
}): WebcamPreviewBudget {
	const previewMode = params.previewMode ?? DEFAULT_WEBCAM_PREVIEW_MODE;
	const segmentationUnavailable = Boolean(params.segmentationUnavailable);

	switch (previewMode) {
		case "performance":
			return resolvePerformancePreviewBudget(params.effects, segmentationUnavailable);
		case "power-saving":
			return resolvePowerSavingPreviewBudget(params.effects, segmentationUnavailable);
		case "exact":
		default:
			return resolveExactPreviewBudget(params.effects, segmentationUnavailable);
	}
}

export function buildWebcamRenderPlanCacheKey(params: {
	sourceKey: string;
	timeMs: number;
	previewMode: WebcamPreviewMode;
	backgroundMode: WebcamEffects["backgroundMode"];
	segmentationMaxEdge: number;
}): string {
	const bucketMs =
		params.segmentationMaxEdge > 0
			? Math.round(params.timeMs / (1000 / 15))
			: Math.round(params.timeMs / 250);
	return [
		params.sourceKey,
		params.previewMode,
		params.backgroundMode,
		params.segmentationMaxEdge,
		bucketMs,
	].join(":");
}

export function resolveWebcamRenderPlan(
	params: Parameters<typeof resolveWebcamRenderSpec>[0] & {
		previewMode?: WebcamPreviewMode;
		sourceKey?: string;
		segmentationUnavailable?: boolean;
	},
): WebcamRenderPlan {
	const previewMode = params.previewMode ?? DEFAULT_WEBCAM_PREVIEW_MODE;
	const exportReferenceBudget: WebcamPreviewBudget = {
		qualityTier: "full-preview",
		fallbackState: "none",
		segmentationMaxEdge: 512,
		renderScale: 1,
		segmentationCadenceMs: 1000 / 15,
	};
	const previewBudget: WebcamPreviewBudget =
		params.renderMode === "preview"
			? (params.previewBudget ??
				resolvePreviewWebcamBudgetByMode({
					previewMode,
					effects: params.effects ?? DEFAULT_WEBCAM_EFFECTS,
					segmentationUnavailable: params.segmentationUnavailable,
				}))
			: exportReferenceBudget;
	const useExportReferenceComposition =
		params.renderMode === "preview" &&
		previewMode === "exact" &&
		previewBudget.qualityTier === "full-preview" &&
		!params.segmentationUnavailable;
	const spec = resolveWebcamRenderSpec({
		...params,
		compositionRenderMode: useExportReferenceComposition ? "export" : params.renderMode,
		previewBudget,
	});
	const cacheKey = buildWebcamRenderPlanCacheKey({
		sourceKey: params.sourceKey ?? "webcam",
		timeMs: params.timeMs,
		previewMode,
		backgroundMode: spec.configuredBackgroundMode,
		segmentationMaxEdge: spec.segmentationMaxEdge,
	});

	return {
		spec,
		previewMode,
		previewBudget,
		cacheKey,
	};
}

function getHudPreviewDimensions(size: CameraPreviewSize) {
	switch (size) {
		case "small":
			return { width: 120, height: 72 };
		case "large":
			return { width: 176, height: 106 };
		case "medium":
		default:
			return { width: 140, height: 84 };
	}
}

function resolveHudPreviewFrame(
	size: CameraPreviewSize,
	shape: CameraPreviewShape,
): { width: number; height: number } {
	const dimensions = getHudPreviewDimensions(size);
	if (shape !== "circle") {
		return dimensions;
	}

	const diameter = Math.min(dimensions.width, dimensions.height);
	return {
		width: diameter,
		height: diameter,
	};
}

function getHudPreviewRadius(shape: CameraPreviewShape, size: CameraPreviewSize) {
	if (shape === "circle") {
		return "999px";
	}

	switch (size) {
		case "small":
			return "12px";
		case "large":
			return "18px";
		case "medium":
		default:
			return "14px";
	}
}

function getHudPreviewSelfAlign(corner: CameraPreviewCorner): "flex-start" | "flex-end" {
	return corner === "top-left" || corner === "bottom-left" ? "flex-start" : "flex-end";
}

export function resolveHudWebcamPreviewLayout(
	cameraSession: Pick<CameraSessionState, "previewSize" | "previewShape" | "previewCorner">,
) {
	const size = cameraSession.previewSize;
	const corner = cameraSession.previewCorner;

	return {
		...resolveHudPreviewFrame(size, cameraSession.previewShape),
		borderRadius: getHudPreviewRadius(cameraSession.previewShape, size),
		selfAlign: getHudPreviewSelfAlign(corner),
		order: corner.startsWith("bottom") ? 2 : 0,
	};
}
