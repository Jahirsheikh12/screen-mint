import { describe, expect, it } from "vitest";
import {
	getActiveCameraLayout,
	mergeWebcamRegion,
	resolveCameraLayoutState,
	resolveWebcamRenderModel,
} from "./cameraLayouts";
import {
	type CameraLayoutRegion,
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_WEBCAM_REGION,
} from "./types";

describe("cameraLayouts", () => {
	function normalizeRect(
		rect: { x: number; y: number; width: number; height: number },
		width: number,
		height: number,
	) {
		return {
			x: rect.x / width,
			y: rect.y / height,
			width: rect.width / width,
			height: rect.height / height,
		};
	}

	it("returns hidden mode when webcam is disabled and no layout is active", () => {
		const result = resolveCameraLayoutState({
			timeMs: 1200,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: false,
		});

		expect(result.mode).toBe("hidden");
		expect(result.activeLayoutId).toBeNull();
		expect(result.region).toEqual(DEFAULT_WEBCAM_REGION);
	});

	it("prefers the latest overlapping camera layout", () => {
		const layouts: CameraLayoutRegion[] = [
			{ id: "camera-layout-1", startMs: 0, endMs: 2000, mode: "default" },
			{ id: "camera-layout-2", startMs: 1000, endMs: 2500, mode: "fullscreen" },
		];

		expect(getActiveCameraLayout(layouts, 1500)?.id).toBe("camera-layout-2");
	});

	it("resolves fullscreen mode and preserves mirror state", () => {
		const result = resolveCameraLayoutState({
			timeMs: 800,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			mirrorWebcam: true,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1500,
					mode: "fullscreen",
				},
			],
		});

		expect(result.mode).toBe("fullscreen");
		expect(result.mirror).toBe(true);
		expect(result.activeLayoutId).toBe("camera-layout-1");
	});

	it("keeps the webcam at full size when the active zoom does not threaten its safe area", () => {
		const result = resolveCameraLayoutState({
			timeMs: 1000,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraSizeDuringZoom: 0.5,
			zoomRegions: [
				{
					id: "zoom-1",
					startMs: 0,
					endMs: 1500,
					depth: 3,
					focus: { cx: 0.5, cy: 0.5 },
				},
			],
		});

		expect(result.mode).toBe("default");
		expect(result.isZoomScaled).toBe(false);
		expect(result.scale).toBe(1);
		expect(result.region).toEqual(DEFAULT_WEBCAM_REGION);
	});

	it("applies layout region overrides before evaluating zoom-safe placement", () => {
		const baseRegion = mergeWebcamRegion(DEFAULT_WEBCAM_REGION, {
			position: { x: 20, y: 10 },
			size: { width: 30, height: 24 },
		});

		const result = resolveCameraLayoutState({
			timeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraSizeDuringZoom: DEFAULT_CAMERA_SIZE_DURING_ZOOM,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1500,
					mode: "default",
					regionOverride: {
						position: { x: 20, y: 10 },
						size: { width: 30, height: 24 },
					},
				},
			],
			zoomRegions: [
				{
					id: "zoom-1",
					startMs: 0,
					endMs: 1500,
					depth: 2,
					focus: { cx: 0.12, cy: 0.12 },
				},
			],
		});

		expect(result.region).toEqual(baseRegion);
	});

	it("moves the webcam away from the zoom safe zone before shrinking it", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraSizeDuringZoom: 0.72,
			containerWidth: 1920,
			containerHeight: 1080,
			zoomRegions: [
				{
					id: "zoom-bottom-right",
					startMs: 0,
					endMs: 1600,
					depth: 6,
					focus: { cx: 0.97, cy: 0.95 },
				},
			],
		});

		expect(result.mode).toBe("default");
		expect(result.displayRect.x).toBeGreaterThan(1500);
		expect(result.displayRect.y).toBeLessThan(500);
		expect(result.scale).toBeLessThanOrEqual(1);
	});

	it("computes centered cover-crop source rects for aspect-mismatched webcam video", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 0,
			webcamRegion: {
				...DEFAULT_WEBCAM_REGION,
				shape: "square",
				size: { width: 24, height: 24 },
			},
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			sourceSize: { width: 1280, height: 720 },
		});

		expect(result.sourceCrop).toMatchObject({
			x: 280,
			y: 0,
			width: 720,
			height: 720,
		});
	});

	it("keeps fullscreen render geometry aligned for preview and export", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 800,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1500,
					mode: "fullscreen",
				},
			],
			containerWidth: 1080,
			containerHeight: 1920,
			sourceSize: { width: 1920, height: 1080 },
		});

		expect(result.mode).toBe("fullscreen");
		expect(result.displayRect).toEqual({
			x: 0,
			y: 0,
			width: 1080,
			height: 1920,
		});
		expect(result.sourceCrop).toEqual({
			x: 656.25,
			y: 0,
			width: 607.5,
			height: 1080,
		});
	});

	it("uses the projected composition rect for fullscreen preview placement", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 800,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1500,
					mode: "fullscreen",
				},
			],
			containerWidth: 2400,
			containerHeight: 1400,
			compositionRect: {
				x: 120,
				y: 95,
				width: 2160,
				height: 1215,
			},
		});

		expect(result.displayRect).toEqual({
			x: 120,
			y: 95,
			width: 2160,
			height: 1215,
		});
	});

	it("keeps normalized webcam placement aligned between export and large preview layouts", () => {
		const exportModel = resolveWebcamRenderModel({
			timeMs: 0,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
		});
		const previewCompositionRect = {
			x: 180,
			y: 140,
			width: 1440,
			height: 810,
		};
		const previewModel = resolveWebcamRenderModel({
			timeMs: 0,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 2200,
			containerHeight: 1400,
			compositionRect: previewCompositionRect,
			contentRect: previewCompositionRect,
		});
		const exportNormalized = normalizeRect(exportModel.displayRect, 1920, 1080);
		const previewNormalized = normalizeRect(
			{
				x: previewModel.displayRect.x - previewCompositionRect.x,
				y: previewModel.displayRect.y - previewCompositionRect.y,
				width: previewModel.displayRect.width,
				height: previewModel.displayRect.height,
			},
			previewCompositionRect.width,
			previewCompositionRect.height,
		);

		expect(previewNormalized.x).toBeCloseTo(exportNormalized.x, 6);
		expect(previewNormalized.y).toBeCloseTo(exportNormalized.y, 6);
		expect(previewNormalized.width).toBeCloseTo(exportNormalized.width, 6);
		expect(previewNormalized.height).toBeCloseTo(exportNormalized.height, 6);
	});

	it("uses the content rect for zoom-safe overlap evaluation", () => {
		const zoomRegion = [
			{
				id: "zoom-bottom-right",
				startMs: 0,
				endMs: 1600,
				depth: 6,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		const fullContentModel = resolveWebcamRenderModel({
			timeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraSizeDuringZoom: 0.72,
			containerWidth: 1920,
			containerHeight: 1080,
			zoomRegions: zoomRegion,
		});
		const insetContentModel = resolveWebcamRenderModel({
			timeMs: 900,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			cameraSizeDuringZoom: 0.72,
			containerWidth: 1920,
			containerHeight: 1080,
			compositionRect: {
				x: 0,
				y: 0,
				width: 1920,
				height: 1080,
			},
			contentRect: {
				x: 360,
				y: 202.5,
				width: 1200,
				height: 675,
			},
			zoomRegions: zoomRegion,
		});

		expect(fullContentModel.displayRect.y).toBeLessThan(500);
		expect(insetContentModel.displayRect.y).toBeGreaterThan(fullContentModel.displayRect.y);
		expect(insetContentModel.scale).toBe(1);
	});
});
