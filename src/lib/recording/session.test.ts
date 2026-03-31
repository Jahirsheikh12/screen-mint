import { describe, expect, it } from "vitest";
import {
	INITIAL_RECORDING_SESSION_STATE,
	normalizeSelectedArea,
	offsetCursorTelemetry,
	recordingSessionReducer,
} from "./session";

describe("normalizeSelectedArea", () => {
	it("normalizes area bounds against the display", () => {
		const area = normalizeSelectedArea(
			{ x: 250, y: 200, width: 500, height: 300 },
			{ x: 100, y: 50, width: 1000, height: 800 },
			2,
		);

		expect(area.displayId).toBe(2);
		expect(area.normalizedBounds).toEqual({
			x: 0.15,
			y: 0.1875,
			width: 0.5,
			height: 0.375,
		});
	});

	it("clamps areas that exceed the display bounds", () => {
		const area = normalizeSelectedArea(
			{ x: -50, y: -25, width: 2500, height: 1600 },
			{ x: 0, y: 0, width: 1920, height: 1080 },
			1,
		);

		expect(area.bounds).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1080,
		});
		expect(area.normalizedBounds).toEqual({
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		});
	});
});

describe("recordingSessionReducer", () => {
	it("supports pause -> resume -> stop", () => {
		const started = recordingSessionReducer(INITIAL_RECORDING_SESSION_STATE, {
			type: "start",
			captureMode: "area",
			selectedSourceId: "screen:1",
			selectedArea: null,
		});
		const paused = recordingSessionReducer(started, { type: "pause" });
		const resumed = recordingSessionReducer(paused, { type: "resume" });
		const stopping = recordingSessionReducer(resumed, { type: "queue-stop" });

		expect(paused.phase).toBe("paused");
		expect(resumed.phase).toBe("recording");
		expect(stopping.pendingAction).toBe("stop");
	});

	it("supports pause -> retake", () => {
		const started = recordingSessionReducer(INITIAL_RECORDING_SESSION_STATE, {
			type: "start",
			captureMode: "display",
			selectedSourceId: "screen:1",
			selectedArea: null,
		});
		const paused = recordingSessionReducer(started, { type: "pause" });
		const retake = recordingSessionReducer(paused, { type: "queue-retake" });

		expect(retake.phase).toBe("paused");
		expect(retake.pendingAction).toBe("retake");
	});

	it("supports pause -> delete", () => {
		const started = recordingSessionReducer(INITIAL_RECORDING_SESSION_STATE, {
			type: "start",
			captureMode: "display",
			selectedSourceId: "screen:1",
			selectedArea: null,
		});
		const paused = recordingSessionReducer(started, { type: "pause" });
		const deleted = recordingSessionReducer(paused, { type: "queue-delete" });

		expect(deleted.phase).toBe("paused");
		expect(deleted.pendingAction).toBe("delete");
	});

	it("counts stored segments and preserves current selection after reset", () => {
		const started = recordingSessionReducer(INITIAL_RECORDING_SESSION_STATE, {
			type: "start",
			captureMode: "area",
			selectedSourceId: "screen:7",
			selectedArea: normalizeSelectedArea(
				{ x: 100, y: 100, width: 640, height: 360 },
				{ x: 0, y: 0, width: 1920, height: 1080 },
				7,
			),
		});
		const stored = recordingSessionReducer(started, { type: "segment-stored" });
		const reset = recordingSessionReducer(stored, { type: "reset" });

		expect(stored.segmentCount).toBe(1);
		expect(reset.phase).toBe("idle");
		expect(reset.selectedSourceId).toBe("screen:7");
		expect(reset.selectedArea?.displayId).toBe(7);
	});
});

describe("offsetCursorTelemetry", () => {
	it("offsets later segment samples by cumulative segment duration", () => {
		const samples = offsetCursorTelemetry([
			{
				durationMs: 1000,
				samples: [
					{
						timeMs: 200,
						cx: 0.1,
						cy: 0.2,
						rawX: 240,
						rawY: 180,
						sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
						captureMode: "display",
					},
				],
			},
			{
				durationMs: 750,
				samples: [
					{
						timeMs: 50,
						cx: 0.3,
						cy: 0.4,
						rawX: 480,
						rawY: 220,
						sourceBounds: { x: 300, y: 100, width: 640, height: 360 },
						captureMode: "window",
					},
				],
			},
		]);

		expect(samples[0]).toMatchObject({
			timeMs: 200,
			cx: 0.1,
			cy: 0.2,
			rawX: 240,
			rawY: 180,
			sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
			captureMode: "display",
		});
		expect(samples[1]).toMatchObject({
			timeMs: 1050,
			cx: 0.3,
			cy: 0.4,
			rawX: 480,
			rawY: 220,
			sourceBounds: { x: 300, y: 100, width: 640, height: 360 },
			captureMode: "window",
		});
	});
});
