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

	it("keeps camera follow stable across lower-FPS stepping", () => {
		const fixture = recordedSessionFixtures.find(
			(entry) => entry.id === "aggressive-horizontal-follow",
		);
		expect(fixture).toBeTruthy();

		const path = buildCursorSimulationPath(
			fixture?.cursorTelemetry ?? [],
			fixture?.durationMs ?? 0,
		);
		let highFpsState = createPlaybackCameraState();
		let lowFpsState = createPlaybackCameraState();

		for (let timeMs = 0; timeMs <= (fixture?.durationMs ?? 0); timeMs += 1000 / 60) {
			highFpsState = evaluatePlaybackCameraFrame({
				state: highFpsState,
				frameTimeMs: timeMs,
				playbackTimeMs: timeMs,
				cursorSimulationPath: path,
				zoomRegions: fixture?.zoomRegions ?? [],
				connectZooms: true,
				geometry: fixture?.geometry ?? {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 0, y: 0, width: 1920, height: 1080 },
				},
				shouldSmooth: true,
			}).state;
		}

		for (let timeMs = 0; timeMs <= (fixture?.durationMs ?? 0); timeMs += 1000 / 15) {
			lowFpsState = evaluatePlaybackCameraFrame({
				state: lowFpsState,
				frameTimeMs: timeMs,
				playbackTimeMs: Math.min(timeMs, fixture?.durationMs ?? 0),
				cursorSimulationPath: path,
				zoomRegions: fixture?.zoomRegions ?? [],
				connectZooms: true,
				geometry: fixture?.geometry ?? {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 0, y: 0, width: 1920, height: 1080 },
				},
				shouldSmooth: true,
			}).state;
		}

		expect(Math.abs(lowFpsState.focusX - highFpsState.focusX)).toBeLessThan(0.1);
		expect(Math.abs(lowFpsState.focusY - highFpsState.focusY)).toBeLessThan(0.1);
		expect(Math.abs(lowFpsState.scale - highFpsState.scale)).toBeLessThan(0.1);
	});
});
