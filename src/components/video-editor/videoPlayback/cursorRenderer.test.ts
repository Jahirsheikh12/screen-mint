import { describe, expect, it } from "vitest";
import { SmoothedCursorState } from "./cursorRenderer";

describe("SmoothedCursorState", () => {
	it("eases toward the target on sequential frames instead of snapping", () => {
		const state = new SmoothedCursorState({
			smoothingFactor: 0.67,
			trailLength: 0,
		});

		state.snapTo(0.1, 0.1, 0);
		state.update(0.9, 0.9, 16);
		const firstStep = state.x;

		expect(firstStep).toBeGreaterThan(0.1);
		expect(firstStep).toBeLessThan(0.9);

		state.update(0.9, 0.9, 32);
		expect(state.x).toBeGreaterThan(firstStep);
		expect(state.x).toBeLessThan(0.9);
	});

	it("snaps cleanly after a discontinuity reset", () => {
		const state = new SmoothedCursorState({
			smoothingFactor: 0.67,
			trailLength: 0,
		});

		state.snapTo(0.2, 0.25, 0);
		state.update(0.8, 0.75, 16);
		expect(state.x).not.toBeCloseTo(0.8, 5);

		state.snapTo(0.8, 0.75, 120);
		expect(state.x).toBeCloseTo(0.8, 5);
		expect(state.y).toBeCloseTo(0.75, 5);
	});
});
