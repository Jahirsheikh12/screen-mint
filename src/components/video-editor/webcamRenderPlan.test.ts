import { describe, expect, it } from "vitest";
import {
	DEFAULT_CAMERA_PREVIEW_CORNER,
	DEFAULT_CAMERA_PREVIEW_SHAPE,
	DEFAULT_CAMERA_PREVIEW_SIZE,
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_REGION,
} from "./types";
import {
	buildWebcamRenderPlanCacheKey,
	resolveHudWebcamPreviewLayout,
	resolvePreviewWebcamBudgetByMode,
	resolveWebcamRenderPlan,
} from "./webcamRenderPlan";
import { resolvePreviewWebcamBudget } from "./webcamRenderSpec";

describe("webcamRenderPlan", () => {
	it("keeps exact preview mode aligned with export-reference rendering", () => {
		const previewPlan = resolveWebcamRenderPlan({
			timeMs: 750,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewMode: "exact",
			sourceKey: "camera-a",
		});
		const exportPlan = resolveWebcamRenderPlan({
			timeMs: 750,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "export",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			sourceKey: "camera-a",
		});

		expect(previewPlan.previewMode).toBe("exact");
		expect(previewPlan.previewBudget.qualityTier).toBe("full-preview");
		expect(previewPlan.spec.renderModel.displayRect).toEqual(
			exportPlan.spec.renderModel.displayRect,
		);
		expect(previewPlan.spec.renderModel.sourceCrop).toEqual(exportPlan.spec.renderModel.sourceCrop);
		expect(previewPlan.spec.renderModel.clipShape).toBe(exportPlan.spec.renderModel.clipShape);
		expect(previewPlan.spec.compositionModel.renderMode).toBe("export");
		expect(previewPlan.spec.compositionModel.backgroundBlurPx).toBe(
			exportPlan.spec.compositionModel.backgroundBlurPx,
		);
		expect(previewPlan.spec.compositionModel.contactShadowOpacity).toBe(
			exportPlan.spec.compositionModel.contactShadowOpacity,
		);
		expect(previewPlan.spec.compositionModel.contactShadowBlurPx).toBe(
			exportPlan.spec.compositionModel.contactShadowBlurPx,
		);
	});

	it("returns deterministic lower-cost preview budgets for performance modes", () => {
		const performanceBudget = resolvePreviewWebcamBudgetByMode({
			previewMode: "performance",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
				backgroundImagePath: "/tmp/background.jpg",
			},
		});
		const powerSavingBudget = resolvePreviewWebcamBudgetByMode({
			previewMode: "power-saving",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "image",
				backgroundImagePath: "/tmp/background.jpg",
			},
		});

		expect(performanceBudget.qualityTier).toBe("reduced-preview-resolution");
		expect(performanceBudget.segmentationMaxEdge).toBe(320);
		expect(powerSavingBudget.qualityTier).toBe("simplified-preview-effects");
		expect(powerSavingBudget.renderScale).toBe(0.9);
		expect(powerSavingBudget.fallbackState).toBe("replacement-disabled");
	});

	it("keeps lower-cost preview modes on preview composition semantics", () => {
		const performancePlan = resolveWebcamRenderPlan({
			timeMs: 750,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewMode: "performance",
			sourceKey: "camera-a",
		});

		expect(performancePlan.spec.compositionModel.renderMode).toBe("preview");
	});

	it("honors an explicit preview budget override when preview falls behind", () => {
		const previewBudget = resolvePreviewWebcamBudget({
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			targetFps: 60,
			observedFps: 18,
			segmentationFps: 0,
			workerLatencyMs: 72,
			renderCostMs: 33,
			segmentationUnavailable: false,
		});
		const plan = resolveWebcamRenderPlan({
			timeMs: 750,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			renderMode: "preview",
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				backgroundMode: "blur",
			},
			previewMode: "exact",
			previewBudget,
			sourceKey: "camera-a",
		});

		expect(plan.previewBudget.qualityTier).toBe("raw-webcam-only");
		expect(plan.spec.appliedBackgroundMode).toBe("none");
		expect(plan.spec.compositionModel.renderMode).toBe("preview");
	});

	it("builds cache keys that include preview mode and segmentation bucket", () => {
		const exactKey = buildWebcamRenderPlanCacheKey({
			sourceKey: "camera-a",
			timeMs: 900,
			previewMode: "exact",
			backgroundMode: "blur",
			segmentationMaxEdge: 512,
		});
		const performanceKey = buildWebcamRenderPlanCacheKey({
			sourceKey: "camera-a",
			timeMs: 900,
			previewMode: "performance",
			backgroundMode: "blur",
			segmentationMaxEdge: 320,
		});

		expect(exactKey).not.toBe(performanceKey);
		expect(exactKey).toContain("exact");
		expect(performanceKey).toContain("performance");
	});

	it("resolves HUD preview layout from the shared camera-session contract", () => {
		expect(
			resolveHudWebcamPreviewLayout({
				previewSize: DEFAULT_CAMERA_PREVIEW_SIZE,
				previewShape: DEFAULT_CAMERA_PREVIEW_SHAPE,
				previewCorner: DEFAULT_CAMERA_PREVIEW_CORNER,
			}),
		).toEqual({
			width: 140,
			height: 84,
			borderRadius: "14px",
			selfAlign: "flex-end",
			order: 0,
		});

		expect(
			resolveHudWebcamPreviewLayout({
				previewSize: "large",
				previewShape: "circle",
				previewCorner: "bottom-left",
			}),
		).toEqual({
			width: 106,
			height: 106,
			borderRadius: "999px",
			selfAlign: "flex-start",
			order: 2,
		});
	});
});
