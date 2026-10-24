import { describe, expect, it } from "vitest";
import { computeSegmentFrameCounts } from "./streamingDecoder";

describe("segment frame counts", () => {
	it("add up to the exact output length however the timeline is cut", () => {
		// Seven 0.51s pieces at 30fps: rounding each one up would give 7 * 16 = 112 frames.
		const segments = Array.from({ length: 7 }, (_, index) => ({
			startSec: index,
			endSec: index + 0.51,
			speed: 1,
		}));
		const counts = computeSegmentFrameCounts(segments, 30);

		expect(counts.reduce((sum, count) => sum + count, 0)).toBe(Math.round(7 * 0.51 * 30));
	});

	it("accounts for speed", () => {
		expect(computeSegmentFrameCounts([{ startSec: 0, endSec: 2, speed: 2 }], 30)).toEqual([30]);
	});
});
