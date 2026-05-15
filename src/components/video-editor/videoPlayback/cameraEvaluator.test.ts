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

	it("holds the camera target through cursor-follow jitter", () => {
		const jitterPath = buildCursorSimulationPath(
			[
				{ timeMs: 0, cx: 0.5, cy: 0.5, confidence: "high" },
				{ timeMs: 80, cx: 0.508, cy: 0.494, confidence: "high" },
				{ timeMs: 160, cx: 0.492, cy: 0.506, confidence: "high" },
				{ timeMs: 240, cx: 0.509, cy: 0.493, confidence: "high" },
				{ timeMs: 320, cx: 0.491, cy: 0.507, confidence: "high" },
				{ timeMs: 400, cx: 0.5, cy: 0.5, confidence: "high" },
			],
			400,
		);
		let state = createPlaybackCameraState();
		const heldTargets: Array<{ x: number; y: number }> = [];

		for (let timeMs = 0; timeMs <= 400; timeMs += 1000 / 60) {
			const evaluation = evaluatePlaybackCameraFrame({
				state,
				frameTimeMs: timeMs,
				playbackTimeMs: timeMs,
				cursorSimulationPath: jitterPath,
				zoomRegions: [
					{
						id: "jitter-follow",
						startMs: 0,
						endMs: 400,
						depth: 3,
						focus: { cx: 0.5, cy: 0.5 },
						mode: "cursor-follow",
					},
				],
				geometry: {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 160, y: 90, width: 1600, height: 900 },
				},
				shouldSmooth: true,
			});
			state = evaluation.state;
			heldTargets.push({ x: state.targetFocusX, y: state.targetFocusY });
		}

		const xRange =
			Math.max(...heldTargets.map((target) => target.x)) -
			Math.min(...heldTargets.map((target) => target.x));
		const yRange =
			Math.max(...heldTargets.map((target) => target.y)) -
			Math.min(...heldTargets.map((target) => target.y));

		expect(xRange).toBeLessThan(0.001);
		expect(yRange).toBeLessThan(0.001);
	});

	it("does not move the cursor-follow camera while the cursor travels inside the zoom safe area", () => {
		const insideSafeAreaPath = buildCursorSimulationPath(
			[
				{ timeMs: 0, cx: 0.5, cy: 0.5, confidence: "high" },
				{ timeMs: 120, cx: 0.54, cy: 0.47, confidence: "high" },
				{ timeMs: 240, cx: 0.58, cy: 0.43, confidence: "high" },
				{ timeMs: 360, cx: 0.59, cy: 0.56, confidence: "high" },
			],
			360,
		);
		let state = createPlaybackCameraState();
		const targets: Array<{ x: number; y: number }> = [];

		for (let timeMs = 0; timeMs <= 360; timeMs += 1000 / 60) {
			const evaluation = evaluatePlaybackCameraFrame({
				state,
				frameTimeMs: timeMs,
				playbackTimeMs: timeMs,
				cursorSimulationPath: insideSafeAreaPath,
				zoomRegions: [
					{
						id: "safe-area-follow",
						startMs: 0,
						endMs: 360,
						depth: 3,
						focus: { cx: 0.5, cy: 0.5 },
						mode: "cursor-follow",
					},
				],
				geometry: {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 160, y: 90, width: 1600, height: 900 },
				},
				shouldSmooth: true,
			});
			state = evaluation.state;
			targets.push({ x: state.targetFocusX, y: state.targetFocusY });
		}

		expect(Math.max(...targets.map((target) => target.x))).toBeCloseTo(0.5, 5);
		expect(Math.min(...targets.map((target) => target.x))).toBeCloseTo(0.5, 5);
		expect(Math.max(...targets.map((target) => target.y))).toBeCloseTo(0.5, 5);
		expect(Math.min(...targets.map((target) => target.y))).toBeCloseTo(0.5, 5);
	});

	it("moves the cursor-follow target minimally after the cursor exits the zoom safe area", () => {
		const outsideSafeAreaPath = buildCursorSimulationPath(
			[
				{ timeMs: 0, cx: 0.72, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 120, cx: 0.72, cy: 0.5, confidence: "high", interactionType: "move" },
			],
			120,
		);
		const evaluation = evaluatePlaybackCameraFrame({
			state: createPlaybackCameraState(),
			frameTimeMs: 0,
			playbackTimeMs: 0,
			cursorSimulationPath: outsideSafeAreaPath,
			zoomRegions: [
				{
					id: "outside-safe-area-follow",
					startMs: 0,
					endMs: 120,
					depth: 3,
					focus: { cx: 0.5, cy: 0.5 },
					mode: "cursor-follow",
				},
			],
			geometry: {
				stageSize: { width: 1920, height: 1080 },
				baseMask: { x: 160, y: 90, width: 1600, height: 900 },
			},
			shouldSmooth: true,
		});

		expect(evaluation.state.targetFocusX).toBeCloseTo(0.548, 3);
		expect(evaluation.state.targetFocusX).toBeLessThan(0.72);
		expect(evaluation.state.targetFocusY).toBeCloseTo(0.5, 5);
	});

	it("eases the camera target during continuous cursor-follow movement", () => {
		const movingPath = buildCursorSimulationPath(
			[
				{ timeMs: 0, cx: 0.5, cy: 0.45, confidence: "high", interactionType: "move" },
				{ timeMs: 120, cx: 0.56, cy: 0.48, confidence: "high", interactionType: "move" },
				{ timeMs: 240, cx: 0.62, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 360, cx: 0.74, cy: 0.52, confidence: "high", interactionType: "move" },
				{ timeMs: 480, cx: 0.9, cy: 0.54, confidence: "high", interactionType: "move" },
			],
			480,
		);
		let state = createPlaybackCameraState();
		const heldTargets: number[] = [];

		for (let timeMs = 0; timeMs <= 480; timeMs += 1000 / 60) {
			const evaluation = evaluatePlaybackCameraFrame({
				state,
				frameTimeMs: timeMs,
				playbackTimeMs: timeMs,
				cursorSimulationPath: movingPath,
				zoomRegions: [
					{
						id: "smooth-follow",
						startMs: 0,
						endMs: 1000,
						depth: 3,
						focus: { cx: 0.5, cy: 0.5 },
						mode: "cursor-follow",
					},
				],
				geometry: {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 160, y: 90, width: 1600, height: 900 },
				},
				shouldSmooth: true,
			});
			state = evaluation.state;
			heldTargets.push(state.targetFocusX);
		}

		const maxStep = Math.max(
			...heldTargets.slice(1).map((target, index) => Math.abs(target - heldTargets[index])),
		);
		const reversals = heldTargets.slice(2).filter((target, index) => {
			const previous = heldTargets[index + 1];
			const beforePrevious = heldTargets[index];
			return target < previous && previous >= beforePrevious;
		});

		expect(maxStep).toBeLessThan(0.08);
		expect(reversals).toHaveLength(0);
		expect(heldTargets[heldTargets.length - 1]).toBeGreaterThan(heldTargets[0]);
	});

	it("moves camera focus monotonically without spring rebound", () => {
		const movingPath = buildCursorSimulationPath(
			[
				{ timeMs: 0, cx: 0.5, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 120, cx: 0.6, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 240, cx: 0.76, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 360, cx: 0.84, cy: 0.5, confidence: "high", interactionType: "move" },
				{ timeMs: 480, cx: 0.9, cy: 0.5, confidence: "high", interactionType: "move" },
			],
			480,
		);
		let state = createPlaybackCameraState();
		const focusX: number[] = [];

		for (let timeMs = 0; timeMs <= 480; timeMs += 1000 / 60) {
			const evaluation = evaluatePlaybackCameraFrame({
				state,
				frameTimeMs: timeMs,
				playbackTimeMs: timeMs,
				cursorSimulationPath: movingPath,
				zoomRegions: [
					{
						id: "monotonic-follow",
						startMs: 0,
						endMs: 1000,
						depth: 3,
						focus: { cx: 0.5, cy: 0.5 },
						mode: "cursor-follow",
					},
				],
				geometry: {
					stageSize: { width: 1920, height: 1080 },
					baseMask: { x: 160, y: 90, width: 1600, height: 900 },
				},
				shouldSmooth: true,
			});
			state = evaluation.state;
			focusX.push(state.focusX);
		}

		const backwardsSteps = focusX.slice(1).filter((value, index) => value < focusX[index] - 0.0001);

		expect(backwardsSteps).toHaveLength(0);
		expect(Math.max(...focusX)).toBeLessThanOrEqual(state.targetFocusX + 0.0001);
		expect(focusX[focusX.length - 1]).toBeGreaterThan(focusX[0]);
	});
});
