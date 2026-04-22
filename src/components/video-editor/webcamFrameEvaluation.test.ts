import { describe, expect, it } from "vitest";
import { createWebcamZoomMotionState, type PixelRect } from "./cameraLayouts";
import {
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_REGION,
	getRecommendedWebcamDefaults,
} from "./types";
import { evaluateWebcamFrame } from "./webcamFrameEvaluation";
import { normalizeWebcamRegion } from "./webcamRegionUtils";

const PREVIEW_STAGE_RECT: PixelRect = {
	x: 0,
	y: 0,
	width: 1400,
	height: 900,
};

const PREVIEW_COMPOSITION_RECT: PixelRect = {
	x: 100,
	y: 60,
	width: 1200,
	height: 675,
};

const EXPORT_STAGE_RECT: PixelRect = {
	x: 0,
	y: 0,
	width: 1920,
	height: 1080,
};

function normalizeRect(rect: PixelRect, compositionRect: PixelRect) {
	return {
		x: (rect.x - compositionRect.x) / compositionRect.width,
		y: (rect.y - compositionRect.y) / compositionRect.height,
		width: rect.width / compositionRect.width,
		height: rect.height / compositionRect.height,
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

function toNextState(result: ReturnType<typeof evaluateWebcamFrame>) {
	return {
		baseMotionState: result.baseMotionState,
		layoutMotionState: result.layoutMotionState,
	};
}

function normalizeRegion(region: typeof DEFAULT_WEBCAM_REGION) {
	return normalizeWebcamRegion({
		...region,
		position: { ...region.position },
		size: { ...region.size },
	});
}

function evaluatePreviewRestoreSequence(params: {
	webcamRegion: typeof DEFAULT_WEBCAM_REGION;
	zoomRegions: Array<{
		id: string;
		startMs: number;
		endMs: number;
		depth: 1 | 2 | 3 | 4 | 5 | 6;
		focus: { cx: number; cy: number };
	}>;
	timesMs: number[];
	cameraSizeDuringZoom?: number;
}) {
	let state = {
		baseMotionState: createWebcamZoomMotionState(params.webcamRegion),
		layoutMotionState: createWebcamZoomMotionState(params.webcamRegion),
	};
	let result = null as ReturnType<typeof evaluateWebcamFrame> | null;

	for (const playbackTimeMs of params.timesMs) {
		result = evaluateWebcamFrame({
			state,
			playbackTimeMs,
			webcamRegion: params.webcamRegion,
			showWebcam: true,
			zoomRegions: params.zoomRegions,
			cameraSizeDuringZoom: params.cameraSizeDuringZoom ?? 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-restore-preview",
			shouldSmooth: true,
		});
		state = toNextState(result);
	}

	if (!result) {
		throw new Error("evaluatePreviewRestoreSequence requires at least one timestamp");
	}

	return result;
}

describe("webcamFrameEvaluation", () => {
	it("keeps preview and export aligned in default mode", () => {
		const preview = evaluateWebcamFrame({
			state: {
				baseMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
				layoutMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
			},
			playbackTimeMs: 500,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-default",
			shouldSmooth: true,
		});
		const exportResult = evaluateWebcamFrame({
			state: {
				baseMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
				layoutMotionState: createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION),
			},
			playbackTimeMs: 500,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "camera-default",
			shouldSmooth: true,
		});

		expect(
			normalizeRect(preview.renderSpec.renderModel.displayRect, PREVIEW_COMPOSITION_RECT),
		).toEqual(normalizeRect(exportResult.renderSpec.renderModel.displayRect, EXPORT_STAGE_RECT));
		expect(preview.renderSpec.renderModel.scale).toBe(exportResult.renderSpec.renderModel.scale);
	});

	it("keeps preview and export aligned with an active camera layout", () => {
		const cameraLayouts = [
			{
				id: "camera-layout-1",
				startMs: 0,
				endMs: 2000,
				mode: "fullscreen" as const,
				transitionInMs: 300,
				transitionOutMs: 300,
			},
		];
		const preview = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraLayouts,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-layout",
			shouldSmooth: true,
		});
		const exportResult = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraLayouts,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "camera-layout",
			shouldSmooth: true,
		});

		expect(preview.renderSpec.renderModel.mode).toBe("fullscreen");
		expect(exportResult.renderSpec.renderModel.mode).toBe("fullscreen");
		expect(
			normalizeRect(preview.renderSpec.renderModel.displayRect, PREVIEW_COMPOSITION_RECT),
		).toEqual(normalizeRect(exportResult.renderSpec.renderModel.displayRect, EXPORT_STAGE_RECT));
	});

	it("keeps preview and export aligned during zoom shrink animation", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-1",
				startMs: 1000,
				endMs: 1800,
				depth: 6 as const,
				focus: { cx: 0.84, cy: 0.18 },
			},
		];
		const previewStart = evaluateWebcamFrame({
			playbackTimeMs: 1000,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-zoom",
			shouldSmooth: true,
		});
		const exportStart = evaluateWebcamFrame({
			playbackTimeMs: 1000,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "camera-zoom",
			shouldSmooth: true,
		});
		const preview = evaluateWebcamFrame({
			state: toNextState(previewStart),
			playbackTimeMs: 1016,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-zoom",
			shouldSmooth: true,
		});
		const exportResult = evaluateWebcamFrame({
			state: toNextState(exportStart),
			playbackTimeMs: 1016,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "camera-zoom",
			shouldSmooth: true,
		});
		const previewNormalized = normalizeRect(
			preview.renderSpec.renderModel.displayRect,
			PREVIEW_COMPOSITION_RECT,
		);
		const exportNormalized = normalizeRect(
			exportResult.renderSpec.renderModel.displayRect,
			EXPORT_STAGE_RECT,
		);

		expect(previewNormalized.x).toBeCloseTo(exportNormalized.x, 12);
		expect(previewNormalized.y).toBeCloseTo(exportNormalized.y, 12);
		expect(previewNormalized.width).toBeCloseTo(exportNormalized.width, 12);
		expect(previewNormalized.height).toBeCloseTo(exportNormalized.height, 12);
		expect(preview.renderSpec.renderModel.scale).toBeCloseTo(
			exportResult.renderSpec.renderModel.scale,
			6,
		);
	});

	it("fully hides preview and export when webcam visibility is disabled", () => {
		const cameraLayouts = [
			{
				id: "camera-layout-1",
				startMs: 0,
				endMs: 2000,
				mode: "fullscreen" as const,
			},
		];
		const preview = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: false,
			cameraLayouts,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-hidden",
			shouldSmooth: true,
		});
		const exportResult = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: false,
			cameraLayouts,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "camera-hidden",
			shouldSmooth: true,
		});

		expect(preview.renderSpec.renderModel.mode).toBe("hidden");
		expect(exportResult.renderSpec.renderModel.mode).toBe("hidden");
		expect(preview.renderSpec.renderModel.opacity).toBe(0);
		expect(exportResult.renderSpec.renderModel.opacity).toBe(0);
		expect(preview.renderSpec.segmentationRequired).toBe(false);
		expect(exportResult.renderSpec.segmentationRequired).toBe(false);
	});

	it("keeps preview playback-start evaluation stable at the same timestamp", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-enter",
				startMs: 1000,
				endMs: 1800,
				depth: 6 as const,
				focus: { cx: 0.82, cy: 0.24 },
			},
		];
		const paused = evaluateWebcamFrame({
			playbackTimeMs: 950,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-preview-stability",
			shouldSmooth: false,
		});
		const resumed = evaluateWebcamFrame({
			state: toNextState(paused),
			playbackTimeMs: 950,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-preview-stability",
			shouldSmooth: true,
		});
		const rerendered = evaluateWebcamFrame({
			state: toNextState(resumed),
			playbackTimeMs: 950,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-preview-stability",
			shouldSmooth: true,
		});
		const nextFrame = evaluateWebcamFrame({
			state: toNextState(rerendered),
			playbackTimeMs: 966,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-preview-stability",
			shouldSmooth: true,
		});

		expect(rerendered.renderSpec.renderModel.displayRect).toEqual(
			resumed.renderSpec.renderModel.displayRect,
		);
		expect(rerendered.renderSpec.renderModel.scale).toBe(resumed.renderSpec.renderModel.scale);
		expect(nextFrame.renderSpec.renderModel.scale).toBeLessThan(
			rerendered.renderSpec.renderModel.scale,
		);
		expect(nextFrame.renderSpec.renderModel.scale).toBeGreaterThan(0.68);
	});

	it("keeps preview and export aligned during webcam restore", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-restore",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		let previewState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let exportState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let preview = null as ReturnType<typeof evaluateWebcamFrame> | null;
		let exportResult = null as ReturnType<typeof evaluateWebcamFrame> | null;

		for (const playbackTimeMs of [0, 120, 220, 300, 560, 660, 760, 860, 960]) {
			preview = evaluateWebcamFrame({
				state: previewState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: PREVIEW_COMPOSITION_RECT,
				contentRect: PREVIEW_COMPOSITION_RECT,
				containerWidth: PREVIEW_STAGE_RECT.width,
				containerHeight: PREVIEW_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "preview",
				previewMode: "exact",
				sourceKey: "camera-restore-preview",
				shouldSmooth: true,
			});
			previewState = toNextState(preview);
			exportResult = evaluateWebcamFrame({
				state: exportState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: EXPORT_STAGE_RECT,
				contentRect: EXPORT_STAGE_RECT,
				containerWidth: EXPORT_STAGE_RECT.width,
				containerHeight: EXPORT_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "export",
				sourceKey: "camera-restore-export",
				shouldSmooth: true,
			});
			exportState = toNextState(exportResult);
		}

		if (!preview || !exportResult) {
			throw new Error("Expected restore evaluations");
		}

		const previewNormalized = normalizeRect(
			preview.renderSpec.renderModel.displayRect,
			PREVIEW_COMPOSITION_RECT,
		);
		const exportNormalized = normalizeRect(
			exportResult.renderSpec.renderModel.displayRect,
			EXPORT_STAGE_RECT,
		);

		expect(previewNormalized.x).toBeCloseTo(exportNormalized.x, 12);
		expect(previewNormalized.y).toBeCloseTo(exportNormalized.y, 12);
		expect(previewNormalized.width).toBeCloseTo(exportNormalized.width, 12);
		expect(previewNormalized.height).toBeCloseTo(exportNormalized.height, 12);
	});

	it("keeps circular bottom-right webcams pinned to the same edges during restore", () => {
		const baseRegion = DEFAULT_WEBCAM_REGION;
		const zoomRegions = [
			{
				id: "zoom-circle-bottom-right-restore",
				startMs: 1000,
				endMs: 1800,
				depth: 6 as const,
				focus: { cx: 0.88, cy: 0.82 },
			},
		];
		let previewState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let exportState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		const previewBase = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: baseRegion,
			showWebcam: true,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "circle-bottom-right-preview-base",
			shouldSmooth: false,
		});
		const exportBase = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: baseRegion,
			showWebcam: true,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "circle-bottom-right-export-base",
			shouldSmooth: false,
		});
		const previewBaseEdges = getRectEdges(previewBase.renderSpec.renderModel.displayRect);
		const exportBaseEdges = getRectEdges(exportBase.renderSpec.renderModel.displayRect);

		for (const playbackTimeMs of [1800, 1900, 2000, 2100]) {
			const preview = evaluateWebcamFrame({
				state: previewState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: PREVIEW_COMPOSITION_RECT,
				contentRect: PREVIEW_COMPOSITION_RECT,
				containerWidth: PREVIEW_STAGE_RECT.width,
				containerHeight: PREVIEW_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "preview",
				previewMode: "exact",
				sourceKey: "circle-bottom-right-preview",
				shouldSmooth: true,
			});
			previewState = toNextState(preview);
			const exportResult = evaluateWebcamFrame({
				state: exportState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: EXPORT_STAGE_RECT,
				contentRect: EXPORT_STAGE_RECT,
				containerWidth: EXPORT_STAGE_RECT.width,
				containerHeight: EXPORT_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "export",
				sourceKey: "circle-bottom-right-export",
				shouldSmooth: true,
			});
			exportState = toNextState(exportResult);
			const previewEdges = getRectEdges(preview.renderSpec.renderModel.displayRect);
			const exportEdges = getRectEdges(exportResult.renderSpec.renderModel.displayRect);

			expect(previewEdges.right).toBeCloseTo(previewBaseEdges.right, 6);
			expect(previewEdges.bottom).toBeCloseTo(previewBaseEdges.bottom, 6);
			expect(exportEdges.right).toBeCloseTo(exportBaseEdges.right, 6);
			expect(exportEdges.bottom).toBeCloseTo(exportBaseEdges.bottom, 6);
		}
	});

	it("keeps circular top-right webcams pinned to the same right/top edges during restore", () => {
		const baseRegion = {
			...DEFAULT_WEBCAM_REGION,
			anchor: "top-right" as const,
		};
		const zoomRegions = [
			{
				id: "zoom-circle-top-right-restore",
				startMs: 1000,
				endMs: 1800,
				depth: 6 as const,
				focus: { cx: 0.88, cy: 0.18 },
			},
		];
		let previewState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let exportState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		const previewBase = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: baseRegion,
			showWebcam: true,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "circle-top-right-preview-base",
			shouldSmooth: false,
		});
		const exportBase = evaluateWebcamFrame({
			playbackTimeMs: 900,
			webcamRegion: baseRegion,
			showWebcam: true,
			compositionRect: EXPORT_STAGE_RECT,
			contentRect: EXPORT_STAGE_RECT,
			containerWidth: EXPORT_STAGE_RECT.width,
			containerHeight: EXPORT_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "export",
			sourceKey: "circle-top-right-export-base",
			shouldSmooth: false,
		});
		const previewBaseEdges = getRectEdges(previewBase.renderSpec.renderModel.displayRect);
		const exportBaseEdges = getRectEdges(exportBase.renderSpec.renderModel.displayRect);

		for (const playbackTimeMs of [1800, 1900, 2000, 2100]) {
			const preview = evaluateWebcamFrame({
				state: previewState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: PREVIEW_COMPOSITION_RECT,
				contentRect: PREVIEW_COMPOSITION_RECT,
				containerWidth: PREVIEW_STAGE_RECT.width,
				containerHeight: PREVIEW_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "preview",
				previewMode: "exact",
				sourceKey: "circle-top-right-preview",
				shouldSmooth: true,
			});
			previewState = toNextState(preview);
			const exportResult = evaluateWebcamFrame({
				state: exportState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: EXPORT_STAGE_RECT,
				contentRect: EXPORT_STAGE_RECT,
				containerWidth: EXPORT_STAGE_RECT.width,
				containerHeight: EXPORT_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "export",
				sourceKey: "circle-top-right-export",
				shouldSmooth: true,
			});
			exportState = toNextState(exportResult);
			const previewEdges = getRectEdges(preview.renderSpec.renderModel.displayRect);
			const exportEdges = getRectEdges(exportResult.renderSpec.renderModel.displayRect);

			expect(previewEdges.right).toBeCloseTo(previewBaseEdges.right, 6);
			expect(previewEdges.top).toBeCloseTo(previewBaseEdges.top, 6);
			expect(exportEdges.right).toBeCloseTo(exportBaseEdges.right, 6);
			expect(exportEdges.top).toBeCloseTo(exportBaseEdges.top, 6);
		}
	});

	it("restores final preview/export placement to the exact original home region", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-restore-final",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		let previewState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let exportState = {
			baseMotionState: createWebcamZoomMotionState(baseRegion),
			layoutMotionState: createWebcamZoomMotionState(baseRegion),
		};
		let preview = null as ReturnType<typeof evaluateWebcamFrame> | null;
		let exportResult = null as ReturnType<typeof evaluateWebcamFrame> | null;

		for (const playbackTimeMs of [0, 120, 220, 300, 560, 660, 760, 860, 960, 1060, 1080]) {
			preview = evaluateWebcamFrame({
				state: previewState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: PREVIEW_COMPOSITION_RECT,
				contentRect: PREVIEW_COMPOSITION_RECT,
				containerWidth: PREVIEW_STAGE_RECT.width,
				containerHeight: PREVIEW_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "preview",
				previewMode: "exact",
				sourceKey: "camera-restore-final-preview",
				shouldSmooth: true,
			});
			previewState = toNextState(preview);
			exportResult = evaluateWebcamFrame({
				state: exportState,
				playbackTimeMs,
				webcamRegion: baseRegion,
				showWebcam: true,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: EXPORT_STAGE_RECT,
				contentRect: EXPORT_STAGE_RECT,
				containerWidth: EXPORT_STAGE_RECT.width,
				containerHeight: EXPORT_STAGE_RECT.height,
				effects: DEFAULT_WEBCAM_EFFECTS,
				renderMode: "export",
				sourceKey: "camera-restore-final-export",
				shouldSmooth: true,
			});
			exportState = toNextState(exportResult);
		}

		if (!preview || !exportResult) {
			throw new Error("Expected final restore evaluations");
		}

		expect(preview.baseMotionState.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(preview.renderSpec.renderModel.region).toEqual(normalizeRegion(baseRegion));
		expect(exportResult.baseMotionState.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(exportResult.renderSpec.renderModel.region).toEqual(normalizeRegion(baseRegion));
	});

	it("does not rebase the preview home position during restore re-renders", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-restore-rerender",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		const restored = evaluatePreviewRestoreSequence({
			webcamRegion: baseRegion,
			zoomRegions,
			timesMs: [0, 120, 220, 300, 560, 660],
		});
		const rerendered = evaluateWebcamFrame({
			state: toNextState(restored),
			playbackTimeMs: 660,
			webcamRegion: baseRegion,
			showWebcam: true,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: PREVIEW_COMPOSITION_RECT,
			contentRect: PREVIEW_COMPOSITION_RECT,
			containerWidth: PREVIEW_STAGE_RECT.width,
			containerHeight: PREVIEW_STAGE_RECT.height,
			effects: DEFAULT_WEBCAM_EFFECTS,
			renderMode: "preview",
			previewMode: "exact",
			sourceKey: "camera-restore-rerender",
			shouldSmooth: true,
		});

		expect(rerendered.baseMotionState.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(rerendered.baseMotionState.homeRegion.anchor).toBe("top-right");
	});
});
