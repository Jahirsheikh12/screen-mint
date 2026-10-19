import { describe, expect, it } from "vitest";
import { getNormalizeGainForPeak } from "./audioNormalize";

describe("audio normalize", () => {
	it("brings quiet audio up to the target peak and caps the boost", () => {
		expect(getNormalizeGainForPeak(0.445)).toBeCloseTo(2, 3);
		expect(getNormalizeGainForPeak(0.01)).toBe(4);
	});

	it("turns loud audio down and leaves silence alone", () => {
		expect(getNormalizeGainForPeak(1)).toBeCloseTo(0.89, 3);
		expect(getNormalizeGainForPeak(0)).toBe(1);
	});
});
