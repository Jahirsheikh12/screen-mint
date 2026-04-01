import { describe, expect, it } from "vitest";
import {
	isPostRecordingAutoZoomPending,
	resolvePostRecordingAutoZoomDecision,
} from "./postRecordingAutoZoomUtils";

describe("postRecordingAutoZoomUtils", () => {
	it("waits for telemetry, then applies once the sticky bootstrap can proceed", () => {
		const bootstrap = {
			videoPath: "file:///recording.mp4",
			enabled: true,
			settled: false,
		};

		expect(
			resolvePostRecordingAutoZoomDecision({
				bootstrap,
				videoPath: "file:///recording.mp4",
				durationSeconds: 12,
				cursorTelemetryLoadSettled: false,
				normalizedCursorTelemetryLength: 4,
				zoomRegionCount: 0,
			}),
		).toBe("wait");

		expect(
			resolvePostRecordingAutoZoomDecision({
				bootstrap,
				videoPath: "file:///recording.mp4",
				durationSeconds: 12,
				cursorTelemetryLoadSettled: true,
				normalizedCursorTelemetryLength: 4,
				zoomRegionCount: 0,
			}),
		).toBe("apply");

		expect(
			resolvePostRecordingAutoZoomDecision({
				bootstrap: { ...bootstrap, settled: true },
				videoPath: "file:///recording.mp4",
				durationSeconds: 12,
				cursorTelemetryLoadSettled: true,
				normalizedCursorTelemetryLength: 4,
				zoomRegionCount: 0,
			}),
		).toBe("idle");
	});

	it("settles immediately when auto-zoom is disabled or already satisfied", () => {
		expect(
			resolvePostRecordingAutoZoomDecision({
				bootstrap: {
					videoPath: "file:///recording.mp4",
					enabled: false,
					settled: false,
				},
				videoPath: "file:///recording.mp4",
				durationSeconds: 10,
				cursorTelemetryLoadSettled: true,
				normalizedCursorTelemetryLength: 5,
				zoomRegionCount: 0,
			}),
		).toBe("settle");

		expect(
			resolvePostRecordingAutoZoomDecision({
				bootstrap: {
					videoPath: "file:///recording.mp4",
					enabled: true,
					settled: false,
				},
				videoPath: "file:///recording.mp4",
				durationSeconds: 10,
				cursorTelemetryLoadSettled: true,
				normalizedCursorTelemetryLength: 5,
				zoomRegionCount: 2,
			}),
		).toBe("settle");
	});

	it("reports pending only while an enabled bootstrap is unfinished for the same video", () => {
		const bootstrap = {
			videoPath: "file:///recording.mp4",
			enabled: true,
			settled: false,
		};

		expect(isPostRecordingAutoZoomPending(bootstrap, "file:///recording.mp4")).toBe(true);
		expect(
			isPostRecordingAutoZoomPending({ ...bootstrap, settled: true }, "file:///recording.mp4"),
		).toBe(false);
		expect(
			isPostRecordingAutoZoomPending({ ...bootstrap, enabled: false }, "file:///recording.mp4"),
		).toBe(false);
		expect(isPostRecordingAutoZoomPending(bootstrap, "file:///other.mp4")).toBe(false);
	});
});
