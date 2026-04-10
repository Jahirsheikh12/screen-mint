import { describe, expect, it, vi } from "vitest";
import { createExportProgressThrottler } from "./exportProgressThrottler";

describe("createExportProgressThrottler", () => {
	it("throttles rapid progress updates and flushes the latest value", () => {
		vi.useFakeTimers();
		const appliedPercentages: number[] = [];
		const throttler = createExportProgressThrottler(
			(progress) => {
				appliedPercentages.push(progress.percentage);
			},
			{ intervalMs: 50 },
		);

		throttler.push({ percentage: 10, currentFrame: 1, totalFrames: 10 });
		throttler.push({ percentage: 20, currentFrame: 2, totalFrames: 10 });
		throttler.push({ percentage: 30, currentFrame: 3, totalFrames: 10 });

		expect(appliedPercentages).toEqual([10]);

		vi.advanceTimersByTime(50);

		expect(appliedPercentages).toEqual([10, 30]);

		vi.useRealTimers();
	});
});
