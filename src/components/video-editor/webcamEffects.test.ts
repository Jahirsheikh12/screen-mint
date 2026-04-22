import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_EFFECTS } from "./types";
import { resolveWebcamCompositionModel, resolveWebcamEffectCapability } from "./webcamEffects";

describe("webcamEffects", () => {
	it("uses segmentation only when a real mask is available and effects are active", () => {
		const model = resolveWebcamCompositionModel({
			displayRect: { x: 0, y: 0, width: 320, height: 320 },
			sourceCrop: { x: 280, y: 0, width: 720, height: 720 },
			sourceSize: { width: 1280, height: 720 },
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			segmentationFrame: {
				width: 1280,
				height: 720,
				workingWidth: 320,
				workingHeight: 180,
				timestampMs: 100,
				rawMask: { width: 320, height: 180 } as HTMLCanvasElement,
				refinedMask: { width: 320, height: 180 } as HTMLCanvasElement,
				mask: { width: 320, height: 180 } as HTMLCanvasElement,
				quality: {
					foregroundCoverage: 0.42,
					edgeCoverage: 0.08,
					temporalWeight: 0.78,
				},
				provider: "mediapipe",
			},
		});

		expect(model.usesSegmentation).toBe(true);
		expect(model.backgroundMode).toBe("blur");
		expect(model.subjectRect.width).toBe(model.displayRect.width);
		expect(model.matteMask).not.toBeNull();
		expect(model.matteCrop?.width).toBeLessThan(720);
	});

	it("falls back to raw webcam when segmentation is unavailable", () => {
		const model = resolveWebcamCompositionModel({
			displayRect: { x: 0, y: 0, width: 320, height: 180 },
			sourceCrop: null,
			sourceSize: { width: 1280, height: 720 },
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
			},
			previewFallbackState: "segmentation-unavailable",
			segmentationFrame: null,
		});

		expect(model.usesSegmentation).toBe(false);
		expect(model.fallbackState).toBe("segmentation-unavailable");
	});

	it("applies portrait crop scaling for subject framing", () => {
		const model = resolveWebcamCompositionModel({
			displayRect: { x: 0, y: 0, width: 360, height: 360 },
			sourceCrop: { x: 280, y: 0, width: 720, height: 720 },
			sourceSize: { width: 1280, height: 720 },
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "solid",
				portraitScale: 1.2,
				portraitOffset: { x: 0.2, y: -0.1 },
			},
		});

		expect(model.subjectCrop).not.toBeNull();
		expect(model.subjectCrop?.width).toBeLessThan(720);
		expect(model.subjectCrop?.height).toBeLessThan(720);
	});

	it("reports when preview falls back away from background treatment", () => {
		const capability = resolveWebcamEffectCapability({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			healthMetrics: {
				targetFps: 30,
				observedFps: 8,
				segmentationFps: 0,
				droppedFrameRatio: 0.7,
				effectFallbackState: "raw-webcam-only",
			},
		});

		expect(capability.canApplyBackgroundTreatment).toBe(false);
		expect(capability.canApplyEdgeFeather).toBe(false);
		expect(capability.appliedBackgroundMode).toBe("none");
		expect(capability.isFallbackActive).toBe(true);
	});

	it("keeps treatment active while preview reduces background sampling", () => {
		const capability = resolveWebcamEffectCapability({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			healthMetrics: {
				targetFps: 60,
				observedFps: 34,
				segmentationFps: 8,
				droppedFrameRatio: 0.32,
				effectFallbackState: "reduced-background-sampling",
			},
		});

		expect(capability.canApplyBackgroundTreatment).toBe(true);
		expect(capability.appliedBackgroundMode).toBe("blur");
		expect(capability.statusTone).toBe("info");
	});

	it("uses a cheaper shadow profile in preview mode than export mode", () => {
		const previewModel = resolveWebcamCompositionModel({
			displayRect: { x: 0, y: 0, width: 360, height: 360 },
			sourceCrop: null,
			sourceSize: { width: 1280, height: 720 },
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			renderMode: "preview",
		});
		const exportModel = resolveWebcamCompositionModel({
			displayRect: { x: 0, y: 0, width: 360, height: 360 },
			sourceCrop: null,
			sourceSize: { width: 1280, height: 720 },
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			renderMode: "export",
		});

		expect(previewModel.contactShadowBlurPx).toBeLessThan(exportModel.contactShadowBlurPx);
	});

	it("downgrades image replacement while preserving treatment status messaging", () => {
		const capability = resolveWebcamEffectCapability({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
			},
			healthMetrics: {
				targetFps: 30,
				observedFps: 24,
				segmentationFps: 6,
				droppedFrameRatio: 0.2,
				effectFallbackState: "replacement-disabled",
			},
		});

		expect(capability.canApplyBackgroundTreatment).toBe(true);
		expect(capability.appliedBackgroundMode).toBe("solid");
		expect(capability.statusTone).toBe("info");
	});
});
