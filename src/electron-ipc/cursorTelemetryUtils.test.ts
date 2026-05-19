import { describe, expect, it } from "vitest";
import {
	type CursorMoveSampleCandidate,
	hasCursorGeometryChange,
	physicalBoundsToDip,
	physicalPointToDip,
	shouldRecordCursorMoveSample,
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

	it("treats platform geometry source changes as record-worthy", () => {
		const nextSample = {
			...baseSample,
			timeMs: 24,
			geometrySource: "fallback-display" as const,
			projectionConfidence: "medium" as const,
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

	it("converts Windows physical cursor points into Electron DIP coordinates", () => {
		const point = physicalPointToDip({ x: 300, y: 150 }, [
			{
				id: 1,
				bounds: { x: 0, y: 0, width: 1280, height: 720 },
				scaleFactor: 1.5,
			},
			{
				id: 2,
				bounds: { x: 1280, y: 0, width: 1920, height: 1080 },
				scaleFactor: 1,
			},
		]);

		expect(point).toEqual({ x: 200, y: 100 });
	});

	it("converts mixed-DPI physical window bounds into Electron DIP coordinates", () => {
		const bounds = physicalBoundsToDip({ x: 300, y: 150, width: 900, height: 600 }, [
			{
				id: 1,
				bounds: { x: 0, y: 0, width: 1280, height: 720 },
				scaleFactor: 1.5,
			},
			{
				id: 2,
				bounds: { x: 1280, y: 0, width: 1920, height: 1080 },
				scaleFactor: 1,
			},
		]);

		expect(bounds).toEqual({ x: 200, y: 100, width: 600, height: 400 });
	});
});
