import { describe, expect, it } from "vitest";
import { createPlaybackCameraState, evaluatePlaybackCameraFrame } from "./cameraEvaluator";
import { buildCursorSimulationPath } from "./cursorSimulation";
import { recordedSessionFixtures } from "./recordedSessionFixtures";

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

function collectFrames(fixture: (typeof recordedSessionFixtures)[number], shouldSmooth = true) {
	const path = buildCursorSimulationPath(fixture.cursorTelemetry, fixture.durationMs);
	let state = createPlaybackCameraState();

	return fixture.sampleTimes.map((timeMs) => {
		const evaluation = evaluatePlaybackCameraFrame({
			state,
			frameTimeMs: timeMs,
			playbackTimeMs: timeMs,
			cursorSimulationPath: path,
			zoomRegions: fixture.zoomRegions,
			connectZooms: true,
			geometry: fixture.geometry,
			shouldSmooth,
		});
		state = evaluation.state;

		return {
			timeMs,
			regionId: evaluation.region?.id ?? null,
			intent: evaluation.simulatedCursor?.intent ?? null,
			cursorCx: evaluation.simulatedCursor ? round(evaluation.simulatedCursor.cx) : null,
			cursorCy: evaluation.simulatedCursor ? round(evaluation.simulatedCursor.cy) : null,
			focusCx: round(evaluation.state.focusX),
			focusCy: round(evaluation.state.focusY),
			progress: round(evaluation.state.progress),
			scale: round(evaluation.state.scale),
			transformScale: round(evaluation.transform.scale),
			transformX: round(evaluation.transform.x),
			transformY: round(evaluation.transform.y),
		};
	});
}

describe("cameraEvaluator parity", () => {
	it.each(
		recordedSessionFixtures,
	)("keeps preview and export camera evaluation in lockstep for $id", (fixture) => {
		const previewFrames = collectFrames(fixture);
		const exportFrames = collectFrames(fixture);

		expect(exportFrames).toEqual(previewFrames);
	});

	it.each(recordedSessionFixtures)("matches the golden fixture for $id", (fixture) => {
		expect(collectFrames(fixture)).toMatchSnapshot(fixture.id);
	});

	it("reprojects moving-window fixtures from source bounds instead of stale normalized coordinates", () => {
		const movingWindowFixture = recordedSessionFixtures.find(
			(fixture) => fixture.id === "moving-window-follow",
		);
		expect(movingWindowFixture).toBeTruthy();

		const path = buildCursorSimulationPath(
			movingWindowFixture?.cursorTelemetry ?? [],
			movingWindowFixture?.durationMs ?? 0,
		);

		expect(path.samples[0]?.cx).toBeCloseTo(0.25, 4);
		expect(path.samples[1]?.cx).toBeCloseTo(0.3375, 4);
		expect(path.samples[5]?.cx).toBeCloseTo(0.61875, 4);
	});
});
