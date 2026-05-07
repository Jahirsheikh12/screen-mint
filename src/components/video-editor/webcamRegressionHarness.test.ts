import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_EFFECTS, DEFAULT_WEBCAM_REGION } from "./types";
import fixedCaptureFixture from "./videoPlayback/__fixtures__/captured-sessions/fixed-webcam-regression.capture.json";
import {
	evaluateWebcamRegressionFixture,
	normalizeRegressionRect,
	type WebcamRegressionCaptureFixture,
	type WebcamRegressionPipelineFrame,
} from "./webcamRegressionHarness";

const fixture = fixedCaptureFixture as WebcamRegressionCaptureFixture;

function expectCloseRect(
	actual: ReturnType<typeof normalizeRegressionRect>,
	expected: ReturnType<typeof normalizeRegressionRect>,
	epsilon = 0.001,
) {
	expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(epsilon);
	expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(epsilon);
	expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(epsilon);
	expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(epsilon);
}

function expectOptionalCloseRect(
	actual: ReturnType<typeof normalizeRegressionRect> | null,
	expected: ReturnType<typeof normalizeRegressionRect> | null,
) {
	expect(actual === null).toBe(expected === null);
	if (!actual || !expected) {
		return;
	}

	expectCloseRect(actual, expected);
}

function getFrameAt(frames: WebcamRegressionPipelineFrame[], timeMs: number) {
	const frame = frames.find((candidate) => candidate.timeMs === timeMs);

	if (!frame) {
		throw new Error(`Missing fixed webcam regression frame at ${timeMs}ms`);
	}

	return frame;
}

const insetPreviewStage = { x: 0, y: 0, width: 1000, height: 700 };
const insetPreviewComposition = { x: 100, y: 80, width: 800, height: 450 };
const insetExportCanvas = { x: 0, y: 0, width: 2000, height: 1400 };
const insetExportComposition = { x: 200, y: 160, width: 1600, height: 900 };

function makeInsetFixture(
	name: string,
	overrides: Partial<WebcamRegressionCaptureFixture> = {},
): WebcamRegressionCaptureFixture {
	return {
		name,
		sourceSize: { width: 1280, height: 720 },
		previewStageRect: insetPreviewStage,
		previewCompositionRect: insetPreviewComposition,
		previewContentRect: insetPreviewComposition,
		exportRect: insetExportCanvas,
		exportCompositionRect: insetExportComposition,
		exportContentRect: insetExportComposition,
		webcamRegion: {
			...DEFAULT_WEBCAM_REGION,
			anchor: "free",
			position: { x: 86, y: 75 },
			size: { width: 18, height: 18 },
			shape: "circle",
		},
		effects: DEFAULT_WEBCAM_EFFECTS,
		showWebcam: true,
		mirrorWebcam: false,
		connectZooms: true,
		cameraSizeDuringZoom: 1,
		cameraLayouts: [],
		zoomRegions: [],
		samplesMs: [500],
		...overrides,
	};
}

describe("webcamRegressionHarness", () => {
	it("keeps preview and export draw geometry aligned for the fixed capture fixture", () => {
		const frames = evaluateWebcamRegressionFixture(fixture);

		expect(frames.map((frame) => frame.timeMs)).toEqual(fixture.samplesMs);

		for (const frame of frames) {
			const previewSpec = frame.previewDrawPlan.spec;
			const exportSpec = frame.exportDrawSpec;
			const previewRect = normalizeRegressionRect(
				previewSpec.renderModel.displayRect,
				fixture.previewCompositionRect,
			);
			const exportRect = normalizeRegressionRect(
				exportSpec.renderModel.displayRect,
				fixture.exportRect,
			);

			expectCloseRect(previewRect, exportRect);
			expect(previewSpec.renderModel.mode).toBe(exportSpec.renderModel.mode);
			expect(previewSpec.renderModel.scale).toBeCloseTo(exportSpec.renderModel.scale, 10);
			expect(previewSpec.renderModel.layoutProgress).toBeCloseTo(
				exportSpec.renderModel.layoutProgress,
				10,
			);
			expectOptionalCloseRect(
				previewSpec.renderModel.sourceCrop,
				exportSpec.renderModel.sourceCrop,
			);
			expectOptionalCloseRect(
				previewSpec.compositionModel.subjectCrop,
				exportSpec.compositionModel.subjectCrop,
			);
			expect(previewSpec.renderModel.clipShape).toBe(exportSpec.renderModel.clipShape);
			expect(previewSpec.renderModel.opacity).toBeCloseTo(exportSpec.renderModel.opacity, 10);
		}
	});

	it("preserves mirrored webcam rendering through preview and export draw specs", () => {
		const frames = evaluateWebcamRegressionFixture(fixture);

		for (const frame of frames) {
			expect(frame.previewEvaluation.renderSpec.renderModel.mirror).toBe(true);
			expect(frame.exportEvaluation.renderSpec.renderModel.mirror).toBe(true);
			expect(frame.previewDrawPlan.spec.renderModel.mirror).toBe(true);
			expect(frame.exportDrawSpec.renderModel.mirror).toBe(true);
		}
	});

	it("samples zoom and layout transitions at identical preview/export times", () => {
		const frames = evaluateWebcamRegressionFixture(fixture);
		const beforeZoom = getFrameAt(frames, 996);
		const enteringZoom = getFrameAt(frames, 1016);
		const activeZoom = getFrameAt(frames, 1160);
		const postZoomRestore = getFrameAt(frames, 2200);

		expect(enteringZoom.previewEvaluation.renderSpec.renderModel.scale).toBeLessThan(
			beforeZoom.previewEvaluation.renderSpec.renderModel.scale,
		);
		expect(activeZoom.previewEvaluation.renderSpec.renderModel.scale).toBeLessThan(
			enteringZoom.previewEvaluation.renderSpec.renderModel.scale,
		);
		expect(activeZoom.previewEvaluation.renderSpec.renderModel.scale).toBeCloseTo(
			activeZoom.exportEvaluation.renderSpec.renderModel.scale,
			10,
		);
		expect(activeZoom.previewEvaluation.renderSpec.renderModel.layoutProgress).toBeCloseTo(
			activeZoom.exportEvaluation.renderSpec.renderModel.layoutProgress,
			10,
		);
		expect(postZoomRestore.previewEvaluation.renderSpec.renderModel.scale).toBeCloseTo(1, 3);
		expect(postZoomRestore.exportEvaluation.renderSpec.renderModel.scale).toBeCloseTo(1, 3);
	});

	it("does not advance webcam motion when preview rerenders the same timestamp", () => {
		const [firstRender, rerender] = evaluateWebcamRegressionFixture(fixture, {
			samplesMs: [1160, 1160],
		});

		expect(rerender.previewEvaluation.renderSpec.renderModel.displayRect).toEqual(
			firstRender.previewEvaluation.renderSpec.renderModel.displayRect,
		);
		expect(rerender.previewEvaluation.renderSpec.renderModel.scale).toBe(
			firstRender.previewEvaluation.renderSpec.renderModel.scale,
		);
		expect(rerender.previewEvaluation.baseMotionState.lastPlaybackTimeMs).toBe(1160);
		expect(rerender.previewEvaluation.layoutMotionState.lastPlaybackTimeMs).toBe(1160);
	});

	it("lets lower-cost preview mode change effects without changing placement parity", () => {
		const [performanceFrame] = evaluateWebcamRegressionFixture(fixture, {
			previewMode: "performance",
			samplesMs: [1160],
			shouldSmooth: false,
		});
		const previewSpec = performanceFrame.previewDrawPlan.spec;
		const exportSpec = performanceFrame.exportDrawSpec;

		expect(previewSpec.compositionModel.renderMode).toBe("preview");
		expect(exportSpec.compositionModel.renderMode).toBe("export");
		expect(previewSpec.renderResolutionScale).toBeLessThanOrEqual(exportSpec.renderResolutionScale);
		expectCloseRect(
			normalizeRegressionRect(previewSpec.renderModel.displayRect, fixture.previewCompositionRect),
			normalizeRegressionRect(exportSpec.renderModel.displayRect, fixture.exportRect),
		);
		expect(previewSpec.renderModel.scale).toBeCloseTo(exportSpec.renderModel.scale, 10);
	});

	it("keeps manual right-edge webcam placement aligned across output aspect ratios", () => {
		const cases = [
			{ name: "16:9", preview: { width: 960, height: 540 }, export: { width: 1920, height: 1080 } },
			{ name: "9:16", preview: { width: 360, height: 640 }, export: { width: 1080, height: 1920 } },
			{ name: "1:1", preview: { width: 640, height: 640 }, export: { width: 1200, height: 1200 } },
			{ name: "4:3", preview: { width: 800, height: 600 }, export: { width: 1600, height: 1200 } },
		];

		for (const testCase of cases) {
			const testFixture: WebcamRegressionCaptureFixture = {
				name: `manual-right-edge-${testCase.name}`,
				sourceSize: { width: 1280, height: 720 },
				previewStageRect: {
					x: 0,
					y: 0,
					width: testCase.preview.width,
					height: testCase.preview.height,
				},
				previewCompositionRect: {
					x: 0,
					y: 0,
					width: testCase.preview.width,
					height: testCase.preview.height,
				},
				previewContentRect: {
					x: 0,
					y: 0,
					width: testCase.preview.width,
					height: testCase.preview.height,
				},
				exportRect: {
					x: 0,
					y: 0,
					width: testCase.export.width,
					height: testCase.export.height,
				},
				webcamRegion: {
					...DEFAULT_WEBCAM_REGION,
					anchor: "free",
					position: { x: 100, y: 52 },
					size: { width: 20, height: 20 },
					shape: "circle",
				},
				effects: DEFAULT_WEBCAM_EFFECTS,
				showWebcam: true,
				mirrorWebcam: false,
				connectZooms: true,
				cameraSizeDuringZoom: 1,
				cameraLayouts: [],
				zoomRegions: [],
				samplesMs: [0],
			};
			const [frame] = evaluateWebcamRegressionFixture(testFixture, { shouldSmooth: false });
			const previewRect = normalizeRegressionRect(
				frame.previewDrawPlan.spec.renderModel.displayRect,
				testFixture.previewCompositionRect,
			);
			const exportRect = normalizeRegressionRect(
				frame.exportDrawSpec.renderModel.displayRect,
				testFixture.exportRect,
			);

			expectCloseRect(previewRect, exportRect);
			expect(previewRect.x + previewRect.width).toBeCloseTo(1, 3);
			expect(exportRect.x + exportRect.width).toBeCloseTo(1, 3);
		}
	});

	it("keeps free webcam placement aligned when the video frame is inset in the canvas", () => {
		const [frame] = evaluateWebcamRegressionFixture(makeInsetFixture("inset-free-placement"), {
			shouldSmooth: false,
		});
		const previewRect = normalizeRegressionRect(
			frame.previewDrawPlan.spec.renderModel.displayRect,
			insetPreviewComposition,
		);
		const exportRect = normalizeRegressionRect(
			frame.exportDrawSpec.renderModel.displayRect,
			insetExportComposition,
		);

		expectCloseRect(previewRect, exportRect);
	});

	it("keeps anchored webcam placement aligned when the video frame is inset", () => {
		for (const anchor of ["top-right", "bottom-right"] as const) {
			const [frame] = evaluateWebcamRegressionFixture(
				makeInsetFixture(`inset-anchor-${anchor}`, {
					webcamRegion: {
						...DEFAULT_WEBCAM_REGION,
						anchor,
						position: { x: 0, y: 0 },
						size: { width: 18, height: 18 },
						shape: "circle",
					},
				}),
				{ shouldSmooth: false },
			);
			const previewRect = normalizeRegressionRect(
				frame.previewDrawPlan.spec.renderModel.displayRect,
				insetPreviewComposition,
			);
			const exportRect = normalizeRegressionRect(
				frame.exportDrawSpec.renderModel.displayRect,
				insetExportComposition,
			);

			expectCloseRect(previewRect, exportRect);
		}
	});

	it("targets the inset composition frame for fullscreen webcam layouts", () => {
		const [frame] = evaluateWebcamRegressionFixture(
			makeInsetFixture("inset-fullscreen-layout", {
				cameraLayouts: [
					{
						id: "fullscreen-webcam",
						startMs: 0,
						endMs: 1000,
						mode: "fullscreen",
						transitionInMs: 0,
						transitionOutMs: 0,
						motionPreset: "instant",
					},
				],
			}),
			{ shouldSmooth: false },
		);
		const previewRect = normalizeRegressionRect(
			frame.previewDrawPlan.spec.renderModel.displayRect,
			insetPreviewComposition,
		);
		const exportRect = normalizeRegressionRect(
			frame.exportDrawSpec.renderModel.displayRect,
			insetExportComposition,
		);

		expectCloseRect(previewRect, { x: 0, y: 0, width: 1, height: 1 });
		expectCloseRect(exportRect, { x: 0, y: 0, width: 1, height: 1 });
	});
});
