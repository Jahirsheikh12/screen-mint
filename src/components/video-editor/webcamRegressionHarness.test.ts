import { describe, expect, it } from "vitest";
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
});
