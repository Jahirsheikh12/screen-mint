import { describe, expect, it } from "vitest";
import {
	getActiveCameraLayout,
	mergeWebcamRegion,
	resolveCameraLayoutState,
	scaleWebcamRegion,
} from "./cameraLayouts";
import {
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_WEBCAM_REGION,
	type CameraLayoutRegion,
} from "./types";

describe("cameraLayouts", () => {
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

	it("scales the webcam region during active zooms in default mode", () => {
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
		expect(result.isZoomScaled).toBe(true);
		expect(result.scale).toBe(0.5);
		expect(result.region.size.width).toBeCloseTo(9);
		expect(result.region.size.height).toBeCloseTo(9);
		expect(result.region.position.x).toBeCloseTo(87);
		expect(result.region.position.y).toBeCloseTo(87);
	});

	it("applies layout region overrides before zoom scaling", () => {
		const baseRegion = mergeWebcamRegion(DEFAULT_WEBCAM_REGION, {
			position: { x: 20, y: 10 },
			size: { width: 30, height: 24 },
		});
		const scaledRegion = scaleWebcamRegion(baseRegion, DEFAULT_CAMERA_SIZE_DURING_ZOOM);

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
					focus: { cx: 0.5, cy: 0.5 },
				},
			],
		});

		expect(result.region).toEqual(scaledRegion);
	});
});
