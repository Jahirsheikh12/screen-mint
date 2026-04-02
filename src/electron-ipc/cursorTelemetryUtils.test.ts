import { describe, expect, it } from "vitest";
import {
	hasCursorGeometryChange,
	shouldRecordCursorMoveSample,
	type CursorMoveSampleCandidate,
} from "../../electron/ipc/cursorTelemetryUtils";

const baseSample: CursorMoveSampleCandidate = {
	timeMs: 0,
	cx: 0.25,
	cy: 0.4,
	sourceBounds: { x: 100, y: 200, width: 1280, height: 720 },
	displayBounds: { x: 0, y: 0, width: 1440, height: 900 },
	sourceDisplayId: 1,
	displayScaleFactor: 2,
	captureMode: "window",
};

describe("cursorTelemetryUtils", () => {
	it("keeps dense hook movement when cursor distance is meaningful", () => {
		expect(
			shouldRecordCursorMoveSample(
				baseSample,
				{
					...baseSample,
					timeMs: 4,
					cx: baseSample.cx + 0.003,
				},
				{
					minIntervalMs: 8,
					minDistance: 0.0015,
				},
			),
		).toBe(true);
	});

	it("suppresses fallback heartbeat samples when neither motion nor geometry changed", () => {
		expect(
			shouldRecordCursorMoveSample(
				baseSample,
				{
					...baseSample,
					timeMs: 40,
				},
				{
					minIntervalMs: 8,
					minDistance: 0.0015,
					heartbeatIntervalMs: 120,
				},
			),
		).toBe(false);
	});

	it("keeps fallback heartbeat samples once the heartbeat window elapses", () => {
		expect(
			shouldRecordCursorMoveSample(
				baseSample,
				{
					...baseSample,
					timeMs: 130,
				},
				{
					minIntervalMs: 8,
					minDistance: 0.0015,
					heartbeatIntervalMs: 120,
				},
			),
		).toBe(true);
	});

	it("treats moving-window geometry changes as record-worthy even when normalized position is flat", () => {
		const nextSample = {
			...baseSample,
			timeMs: 24,
			sourceBounds: { x: 140, y: 200, width: 1280, height: 720 },
		};

		expect(hasCursorGeometryChange(baseSample, nextSample)).toBe(true);
		expect(
			shouldRecordCursorMoveSample(baseSample, nextSample, {
				minIntervalMs: 8,
				minDistance: 0.0015,
				heartbeatIntervalMs: 120,
			}),
		).toBe(true);
	});
});
