import { describe, expect, it } from "vitest";
import {
	calculateAxisScale,
	calculateTimelineScale,
	createInitialRange,
	formatPlayheadTime,
	formatTimeLabel,
	normalizeWheelDeltaToPixels,
} from "./timelineScale";

describe("timelineScale", () => {
	it("creates a fallback range for zero-duration media", () => {
		expect(createInitialRange(0)).toEqual({ start: 0, end: 1000 });
		expect(createInitialRange(2500)).toEqual({ start: 0, end: 2500 });
	});

	it("normalizes wheel deltas from line and page units", () => {
		expect(normalizeWheelDeltaToPixels(2, 0)).toBe(2);
		expect(normalizeWheelDeltaToPixels(2, 1)).toBe(32);
		expect(normalizeWheelDeltaToPixels(2, 2)).toBe(480);
	});

	it("formats axis and playhead labels consistently", () => {
		expect(formatTimeLabel(65_000, 1000)).toBe("1:05");
		expect(formatTimeLabel(1250, 100)).toBe("0:01.25");
		expect(formatPlayheadTime(61_200)).toBe("1:01.2");
		expect(formatPlayheadTime(900)).toBe("0.9s");
	});

	it("keeps timeline scale bounded for short and long media", () => {
		expect(calculateTimelineScale(0)).toEqual({
			minItemDurationMs: 100,
			defaultItemDurationMs: 1000,
			minVisibleRangeMs: 300,
		});
		expect(calculateTimelineScale(120).defaultItemDurationMs).toBe(6000);
		expect(calculateAxisScale(10_000).intervalMs).toBeGreaterThan(0);
	});
});
