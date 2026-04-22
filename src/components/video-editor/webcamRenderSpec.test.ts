import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_EFFECTS, DEFAULT_WEBCAM_REGION } from "./types";
import {
	buildWebcamHealthMetrics,
	resolvePreviewWebcamBudget,
	resolveWebcamRenderSpec,
} from "./webcamRenderSpec";

describe("webcamRenderSpec", () => {
	it("keeps preview and export geometry aligned for the same timestamp and layout inputs", () => {
		const previewBudget = resolvePreviewWebcamBudget({
			effects: DEFAULT_WEBCAM_EFFECTS,
			targetFps: 30,
			observedFps: 30,
			segmentationFps: 0,
			workerLatencyMs: 0,
			renderCostMs: 4,
			segmentationUnavailable: false,
		});

		const previewSpec = resolveWebcamRenderSpec({
			timeMs: 500,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: DEFAULT_WEBCAM_EFFECTS,
			previewBudget,
		});
		const exportSpec = resolveWebcamRenderSpec({
			timeMs: 500,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "export",
			effects: DEFAULT_WEBCAM_EFFECTS,
		});

		expect(previewSpec.renderModel.displayRect).toEqual(exportSpec.renderModel.displayRect);
		expect(previewSpec.renderModel.sourceCrop).toEqual(exportSpec.renderModel.sourceCrop);
		expect(previewSpec.renderModel.clipShape).toBe(exportSpec.renderModel.clipShape);
	});

	it("downgrades preview effects without changing webcam placement semantics", () => {
		const previewBudget = resolvePreviewWebcamBudget({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
				backgroundImagePath: "/tmp/bg.jpg",
				shadowStrength: 1.2,
			},
			targetFps: 60,
			observedFps: 42,
			segmentationFps: 26,
			workerLatencyMs: 24,
			renderCostMs: 13,
			segmentationUnavailable: false,
		});

		const spec = resolveWebcamRenderSpec({
			timeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
				backgroundImagePath: "/tmp/bg.jpg",
				shadowStrength: 1.2,
			},
			previewBudget,
		});

		expect(spec.degradationStep).toBe("reduced-preview-resolution");
		expect(spec.configuredBackgroundMode).toBe("image");
		expect(spec.appliedBackgroundMode).toBe("image");
		expect(spec.effectiveEffects.shadowStrength).toBeLessThan(1.2);
		expect(spec.renderModel.displayRect).toEqual(spec.compositionModel.displayRect);
	});

	it("reports unavailable segmentation when fallback disables background treatment", () => {
		const previewBudget = resolvePreviewWebcamBudget({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			targetFps: 30,
			observedFps: 12,
			segmentationFps: 0,
			workerLatencyMs: 72,
			renderCostMs: 32,
			segmentationUnavailable: true,
		});

		const spec = resolveWebcamRenderSpec({
			timeMs: 0,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1280,
			containerHeight: 720,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewBudget,
		});

		expect(spec.segmentationRequired).toBe(false);
		expect(spec.segmentationProviderStatus).toBe("not-required");
		expect(spec.appliedBackgroundMode).toBe("none");
		expect(spec.fallbackState).toBe("segmentation-unavailable");
	});

	it("builds richer webcam health metrics from the shared spec", () => {
		const spec = resolveWebcamRenderSpec({
			timeMs: 0,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "solid",
			},
			previewBudget: resolvePreviewWebcamBudget({
				effects: {
					...DEFAULT_WEBCAM_EFFECTS,
					backgroundMode: "solid",
				},
				targetFps: 30,
				observedFps: 29,
				segmentationFps: 12,
				workerLatencyMs: 6,
				renderCostMs: 5,
				segmentationUnavailable: false,
			}),
		});
		const metrics = buildWebcamHealthMetrics({
			spec,
			targetFps: 30,
			observedFps: 29,
			segmentationFps: 10,
			segmentationWorkingSize: { width: 320, height: 180 },
			previewMode: "exact",
			driftMs: 3.5,
			renderLatencyMs: 5.8,
			frameQueueDepth: 2,
			segmentCompatibilityWarnings: ["normalized webcam segment"],
		});

		expect(metrics.configuredBackgroundMode).toBe("solid");
		expect(metrics.appliedBackgroundMode).toBe("solid");
		expect(metrics.degradationStep).toBe("full-preview");
		expect(metrics.segmentationProviderStatus).toBe("ready");
		expect(metrics.segmentationWorkingWidth).toBe(320);
		expect(metrics.previewMode).toBe("exact");
		expect(metrics.driftMs).toBe(3.5);
		expect(metrics.renderLatencyMs).toBe(5.8);
		expect(metrics.frameQueueDepth).toBe(2);
		expect(metrics.segmentCompatibilityWarnings).toEqual(["normalized webcam segment"]);
	});

	it("hydrates source cropping when preview receives real webcam dimensions after layout resolution", () => {
		const previewBudget = resolvePreviewWebcamBudget({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			targetFps: 30,
			observedFps: 30,
			segmentationFps: 12,
			workerLatencyMs: 4,
			renderCostMs: 5,
			segmentationUnavailable: false,
		});

		const layoutOnlySpec = resolveWebcamRenderSpec({
			timeMs: 0,
			webcamRegion: {
				...DEFAULT_WEBCAM_REGION,
				shape: "square",
				size: { width: 24, height: 24 },
			},
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewBudget,
		});

		expect(layoutOnlySpec.renderModel.sourceCrop).toBeNull();

		const hydratedSpec = resolveWebcamRenderSpec({
			timeMs: 0,
			webcamRegion: layoutOnlySpec.renderModel.region,
			showWebcam: true,
			resolvedRenderModel: layoutOnlySpec.renderModel,
			containerWidth: 1920,
			containerHeight: 1080,
			sourceSize: { width: 1280, height: 720 },
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewBudget,
		});

		expect(hydratedSpec.renderModel.sourceCrop).toEqual({
			x: 280,
			y: 0,
			width: 720,
			height: 720,
		});
		expect(hydratedSpec.compositionModel.subjectCrop).toEqual({
			x: 280,
			y: 0,
			width: 720,
			height: 720,
		});
	});
});
