import { describe, expect, it } from "vitest";
import {
	createWebcamZoomMotionState,
	evaluateWebcamZoomMotionFrame,
	getActiveCameraLayout,
	mergeWebcamRegion,
	resolveCameraLayoutState,
	resolveWebcamRenderModel,
	scaleWebcamRegion,
} from "./cameraLayouts";
import {
	type CameraLayoutRegion,
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_WEBCAM_REGION,
	getRecommendedWebcamDefaults,
} from "./types";
import { normalizeWebcamRegion } from "./webcamRegionUtils";

describe("cameraLayouts", () => {
	const DEFAULT_COMPOSITION_RECT = {
		x: 0,
		y: 0,
		width: 1920,
		height: 1080,
	};

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

	function normalizeRegion(region: typeof DEFAULT_WEBCAM_REGION) {
		return normalizeWebcamRegion({
			...region,
			position: { ...region.position },
			size: { ...region.size },
		});
	}

	function advanceMotion(
		state: ReturnType<typeof createWebcamZoomMotionState>,
		options: {
			baseRegion:
				| typeof DEFAULT_WEBCAM_REGION
				| ReturnType<typeof getRecommendedWebcamDefaults>["region"];
			zoomRegions: Array<{
				id: string;
				startMs: number;
				endMs: number;
				depth: 1 | 2 | 3 | 4 | 5 | 6;
				focus: { cx: number; cy: number };
			}>;
			timesMs: number[];
			cameraSizeDuringZoom?: number;
			connectZooms?: boolean;
			shouldSmooth?: boolean;
		},
	) {
		let nextState = state;
		let lastResult = null as ReturnType<typeof evaluateWebcamZoomMotionFrame> | null;

		for (const playbackTimeMs of options.timesMs) {
			lastResult = evaluateWebcamZoomMotionFrame({
				state: nextState,
				playbackTimeMs,
				baseRegion: options.baseRegion,
				zoomRegions: options.zoomRegions,
				cameraSizeDuringZoom: options.cameraSizeDuringZoom ?? 0.68,
				connectZooms: options.connectZooms,
				compositionRect: DEFAULT_COMPOSITION_RECT,
				contentRect: DEFAULT_COMPOSITION_RECT,
				shouldSmooth: options.shouldSmooth ?? true,
			});
			nextState = lastResult.state;
		}

		if (!lastResult) {
			throw new Error("advanceMotion requires at least one timestamp");
		}

		return lastResult;
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

	it("forces zero opacity when webcam visibility is disabled", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 1200,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: false,
			containerWidth: DEFAULT_COMPOSITION_RECT.width,
			containerHeight: DEFAULT_COMPOSITION_RECT.height,
		});

		expect(result.mode).toBe("hidden");
		expect(result.opacity).toBe(0);
	});

	it("ignores active camera layouts when webcam visibility is disabled", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 800,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: false,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1500,
					mode: "fullscreen",
				},
			],
			containerWidth: DEFAULT_COMPOSITION_RECT.width,
			containerHeight: DEFAULT_COMPOSITION_RECT.height,
		});

		expect(result.mode).toBe("hidden");
		expect(result.activeLayoutId).toBeNull();
		expect(result.opacity).toBe(0);
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

	it("keeps the webcam on the configured zoom scale even when it can stay in place", () => {
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
		expect(result.region).toEqual(scaleWebcamRegion(DEFAULT_WEBCAM_REGION, 0.5));
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

		expect(result.region).toEqual(scaleWebcamRegion(baseRegion, DEFAULT_CAMERA_SIZE_DURING_ZOOM));
	});

	it("keeps the webcam fixed to its configured anchored position while shrinking", () => {
		const baseModel = resolveWebcamRenderModel({
			timeMs: 0,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
		});
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
		expect(result.displayRect.x + result.displayRect.width).toBeCloseTo(
			baseModel.displayRect.x + baseModel.displayRect.width,
			6,
		);
		expect(result.displayRect.y + result.displayRect.height).toBeCloseTo(
			baseModel.displayRect.y + baseModel.displayRect.height,
			6,
		);
		expect(result.displayRect.width).toBeLessThan(baseModel.displayRect.width);
		expect(result.displayRect.height).toBeLessThan(baseModel.displayRect.height);
	});

	it("keeps free-position webcams pinned to their configured top-left while shrinking", () => {
		const baseRegion = normalizeRegion({
			...getRecommendedWebcamDefaults("16:9").region,
			anchor: "free",
			position: { x: 61.5, y: 14.25 },
			size: { width: 22, height: 16 },
		});
		const baseModel = resolveWebcamRenderModel({
			timeMs: 0,
			webcamRegion: baseRegion,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
		});
		const zoomedModel = resolveWebcamRenderModel({
			timeMs: 900,
			webcamRegion: baseRegion,
			showWebcam: true,
			cameraSizeDuringZoom: 0.72,
			containerWidth: 1920,
			containerHeight: 1080,
			zoomRegions: [
				{
					id: "zoom-free-pin",
					startMs: 0,
					endMs: 1600,
					depth: 6,
					focus: { cx: 0.9, cy: 0.1 },
				},
			],
		});

		expect(zoomedModel.displayRect.x).toBeCloseTo(baseModel.displayRect.x, 6);
		expect(zoomedModel.displayRect.y).toBeCloseTo(baseModel.displayRect.y, 6);
		expect(zoomedModel.displayRect.width).toBeLessThan(baseModel.displayRect.width);
		expect(zoomedModel.displayRect.height).toBeLessThan(baseModel.displayRect.height);
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

	it("keeps zoom shrink placement unchanged even when the content rect is inset", () => {
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

		expect(insetContentModel.displayRect.x).toBeCloseTo(fullContentModel.displayRect.x, 6);
		expect(insetContentModel.displayRect.y).toBeCloseTo(fullContentModel.displayRect.y, 6);
		expect(insetContentModel.displayRect.width).toBeCloseTo(fullContentModel.displayRect.width, 6);
		expect(insetContentModel.displayRect.height).toBeCloseTo(
			fullContentModel.displayRect.height,
			6,
		);
		expect(insetContentModel.scale).toBeCloseTo(0.72, 6);
	});

	it("blends fullscreen transitions from the default webcam region", () => {
		const result = resolveWebcamRenderModel({
			timeMs: 100,
			webcamRegion: DEFAULT_WEBCAM_REGION,
			showWebcam: true,
			containerWidth: 1920,
			containerHeight: 1080,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1200,
					mode: "fullscreen",
					transitionInMs: 400,
				},
			],
		});

		expect(result.mode).toBe("fullscreen");
		expect(result.displayRect.width).toBeGreaterThan(320);
		expect(result.displayRect.width).toBeLessThan(1920);
		expect(result.displayRect.height).toBeGreaterThan(180);
		expect(result.displayRect.height).toBeLessThan(1080);
		expect(result.borderRadiusPx).toBeGreaterThan(0);
	});

	it("smoothly shrinks the webcam over multiple frames when zoom activates", () => {
		const zoomRegions = [
			{
				id: "zoom-bottom-right",
				startMs: 40,
				endMs: 1200,
				depth: 6,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		let state = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		state = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 0,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		}).state;

		const enteringZoom = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 100,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});
		const midZoom = evaluateWebcamZoomMotionFrame({
			state: enteringZoom.state,
			playbackTimeMs: 200,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(midZoom.motion.scale).toBeLessThan(enteringZoom.motion.scale);
		expect(midZoom.motion.scale).toBeGreaterThanOrEqual(0.68);
		expect(midZoom.motion.region.position.x).toBeGreaterThan(enteringZoom.motion.region.position.x);
	});

	it("smoothly restores the webcam after zoom ends", () => {
		const zoomRegions = [
			{
				id: "zoom-bottom-right",
				startMs: 0,
				endMs: 320,
				depth: 6,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		let state = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		for (const playbackTimeMs of [0, 120, 220, 300]) {
			state = evaluateWebcamZoomMotionFrame({
				state,
				playbackTimeMs,
				baseRegion: DEFAULT_WEBCAM_REGION,
				zoomRegions,
				cameraSizeDuringZoom: 0.68,
				compositionRect: DEFAULT_COMPOSITION_RECT,
				contentRect: DEFAULT_COMPOSITION_RECT,
				shouldSmooth: true,
			}).state;
		}

		const releaseFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 560,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});
		const restoreFrame = evaluateWebcamZoomMotionFrame({
			state: releaseFrame.state,
			playbackTimeMs: 660,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(releaseFrame.motion.scale).toBeLessThan(1);
		expect(restoreFrame.motion.scale).toBeGreaterThan(releaseFrame.motion.scale);
		expect(restoreFrame.motion.scale).toBeLessThanOrEqual(1);
	});

	it("restores anchored webcams to the exact original home region", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-bottom-right",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		const restored = advanceMotion(createWebcamZoomMotionState(baseRegion), {
			baseRegion,
			zoomRegions,
			timesMs: [0, 120, 220, 300, 560, 660, 760, 860, 960, 1060, 1080],
		});

		expect(restored.state.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.region).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.scale).toBe(1);
	});

	it("restores free-position webcams to the exact original free region", () => {
		const baseRegion = {
			...getRecommendedWebcamDefaults("16:9").region,
			anchor: "free" as const,
			position: { x: 61.5, y: 14.25 },
			size: { width: 22, height: 16 },
		};
		const zoomRegions = [
			{
				id: "zoom-free-restore",
				startMs: 0,
				endMs: 280,
				depth: 6 as const,
				focus: { cx: 0.1, cy: 0.14 },
			},
		];
		const restored = advanceMotion(createWebcamZoomMotionState(baseRegion), {
			baseRegion,
			zoomRegions,
			timesMs: [0, 100, 200, 280, 420, 520, 620, 720, 820, 920, 1120, 1160],
		});

		expect(restored.state.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.region).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.scale).toBe(1);
	});

	it("restores exactly after connected zooms with a short gap", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-a",
				startMs: 0,
				endMs: 260,
				depth: 6 as const,
				focus: { cx: 0.9, cy: 0.2 },
			},
			{
				id: "zoom-b",
				startMs: 360,
				endMs: 620,
				depth: 5 as const,
				focus: { cx: 0.18, cy: 0.88 },
			},
		];
		const restored = advanceMotion(createWebcamZoomMotionState(baseRegion), {
			baseRegion,
			zoomRegions,
			connectZooms: false,
			timesMs: [0, 120, 240, 360, 480, 620, 760, 860, 960, 1080, 1240],
		});

		expect(restored.state.homeRegion).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.region).toEqual(normalizeRegion(baseRegion));
		expect(restored.motion.scale).toBe(1);
	});

	it("keeps webcam motion continuous across connected zoom regions", () => {
		const zoomRegions = [
			{
				id: "zoom-a",
				startMs: 0,
				endMs: 500,
				depth: 5,
				focus: { cx: 0.96, cy: 0.92 },
			},
			{
				id: "zoom-b",
				startMs: 500,
				endMs: 1000,
				depth: 5,
				focus: { cx: 0.12, cy: 0.12 },
			},
		];
		let state = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		for (const playbackTimeMs of [0, 120, 240, 360, 480]) {
			state = evaluateWebcamZoomMotionFrame({
				state,
				playbackTimeMs,
				baseRegion: DEFAULT_WEBCAM_REGION,
				zoomRegions,
				connectZooms: true,
				cameraSizeDuringZoom: 0.68,
				compositionRect: DEFAULT_COMPOSITION_RECT,
				contentRect: DEFAULT_COMPOSITION_RECT,
				shouldSmooth: true,
			}).state;
		}

		const boundaryFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 520,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions,
			connectZooms: true,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(boundaryFrame.motion.scale).toBeLessThan(1);
		expect(Math.abs(boundaryFrame.motion.scale - state.scale)).toBeLessThan(0.18);
	});

	it("preserves webcam size when camera during zoom is disabled", () => {
		let state = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		state = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 0,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions: [],
			cameraSizeDuringZoom: 1,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		}).state;
		const activeZoom = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 100,
			baseRegion: DEFAULT_WEBCAM_REGION,
			zoomRegions: [
				{
					id: "zoom-bottom-right",
					startMs: 0,
					endMs: 1000,
					depth: 6,
					focus: { cx: 0.97, cy: 0.95 },
				},
			],
			cameraSizeDuringZoom: 1,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(activeZoom.motion.scale).toBe(1);
		expect(activeZoom.motion.region.position.x).toBeGreaterThanOrEqual(
			DEFAULT_WEBCAM_REGION.position.x,
		);
	});

	it("does not shift the webcam layout when playback starts without active motion", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		let state = createWebcamZoomMotionState(baseRegion);
		const pausedFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 0,
			baseRegion,
			zoomRegions: [],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: false,
		});
		state = pausedFrame.state;
		const playStartFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 16,
			baseRegion,
			zoomRegions: [],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(pausedFrame.motion.region.anchor).toBe("top-right");
		expect(playStartFrame.motion.region.anchor).toBe("top-right");
		expect(playStartFrame.motion.region.position).toEqual(pausedFrame.motion.region.position);
		expect(playStartFrame.motion.scale).toBe(pausedFrame.motion.scale);
	});

	it("does not snap the webcam shrink when preview re-renders at the same zoom timestamp", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		let state = createWebcamZoomMotionState(baseRegion);
		const pausedFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 950,
			baseRegion,
			zoomRegions: [
				{
					id: "zoom-enter",
					startMs: 1000,
					endMs: 1800,
					depth: 6,
					focus: { cx: 0.82, cy: 0.24 },
				},
			],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: false,
		});
		state = pausedFrame.state;
		const sameTimestampPlayFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 950,
			baseRegion,
			zoomRegions: [
				{
					id: "zoom-enter",
					startMs: 1000,
					endMs: 1800,
					depth: 6,
					focus: { cx: 0.82, cy: 0.24 },
				},
			],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});
		const nextFrame = evaluateWebcamZoomMotionFrame({
			state: sameTimestampPlayFrame.state,
			playbackTimeMs: 966,
			baseRegion,
			zoomRegions: [
				{
					id: "zoom-enter",
					startMs: 1000,
					endMs: 1800,
					depth: 6,
					focus: { cx: 0.82, cy: 0.24 },
				},
			],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(sameTimestampPlayFrame.motion.scale).toBe(pausedFrame.motion.scale);
		expect(nextFrame.motion.scale).toBeLessThan(sameTimestampPlayFrame.motion.scale);
		expect(nextFrame.motion.scale).toBeGreaterThan(0.68);
	});

	it("snaps a restored top-right webcam exactly home on a same-timestamp rerender", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		const zoomRegions = [
			{
				id: "zoom-restore-rerender-top-right",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		const partiallyRestored = advanceMotion(createWebcamZoomMotionState(baseRegion), {
			baseRegion,
			zoomRegions,
			timesMs: [0, 120, 220, 300, 560, 660],
		});
		const rerendered = evaluateWebcamZoomMotionFrame({
			state: partiallyRestored.state,
			playbackTimeMs: 660,
			baseRegion,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(rerendered.motion.region).toEqual(normalizeRegion(baseRegion));
		expect(rerendered.motion.scale).toBe(1);
	});

	it("snaps a restored bottom-right webcam exactly home on a same-timestamp rerender", () => {
		const baseRegion = DEFAULT_WEBCAM_REGION;
		const zoomRegions = [
			{
				id: "zoom-restore-rerender-bottom-right",
				startMs: 0,
				endMs: 320,
				depth: 6 as const,
				focus: { cx: 0.97, cy: 0.95 },
			},
		];
		const partiallyRestored = advanceMotion(createWebcamZoomMotionState(baseRegion), {
			baseRegion,
			zoomRegions,
			timesMs: [0, 120, 220, 300, 560, 660],
		});
		const rerendered = evaluateWebcamZoomMotionFrame({
			state: partiallyRestored.state,
			playbackTimeMs: 660,
			baseRegion,
			zoomRegions,
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(rerendered.motion.region).toEqual(normalizeRegion(baseRegion));
		expect(rerendered.motion.scale).toBe(1);
	});

	it("smoothly enters the first zoom even after a larger frame gap", () => {
		const baseRegion = getRecommendedWebcamDefaults("16:9").region;
		let state = createWebcamZoomMotionState(baseRegion);
		const preZoomFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 500,
			baseRegion,
			zoomRegions: [
				{
					id: "zoom-enter-gap",
					startMs: 2000,
					endMs: 2600,
					depth: 6,
					focus: { cx: 0.82, cy: 0.24 },
				},
			],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});
		state = preZoomFrame.state;
		const delayedFirstZoomFrame = evaluateWebcamZoomMotionFrame({
			state,
			playbackTimeMs: 1000,
			baseRegion,
			zoomRegions: [
				{
					id: "zoom-enter-gap",
					startMs: 2000,
					endMs: 2600,
					depth: 6,
					focus: { cx: 0.82, cy: 0.24 },
				},
			],
			cameraSizeDuringZoom: 0.68,
			compositionRect: DEFAULT_COMPOSITION_RECT,
			contentRect: DEFAULT_COMPOSITION_RECT,
			shouldSmooth: true,
		});

		expect(delayedFirstZoomFrame.motion.scale).toBeLessThan(1);
		expect(delayedFirstZoomFrame.motion.scale).toBeGreaterThan(0.68);
		expect(delayedFirstZoomFrame.motion.smoothedZoomProgress).toBeLessThan(
			delayedFirstZoomFrame.motion.targetZoomProgress,
		);
	});
});
