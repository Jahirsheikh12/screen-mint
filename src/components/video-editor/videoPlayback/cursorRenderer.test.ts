import { describe, expect, it } from "vitest";
import { cursorAssetPacks, SUPPORTED_CURSOR_KEYS } from "./cursorAssetPacks";
import {
	getClickBounceScale,
	getClickRingStyle,
	getCursorVisualState,
	SmoothedCursorState,
} from "./cursorRenderer";

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

describe("cursor click effects", () => {
	it("derives click progress from recorded and preview click samples", () => {
		const samples = [
			{ timeMs: 0, cx: 0.2, cy: 0.3, cursorType: "arrow" as const },
			{ timeMs: 1_000, cx: 0.4, cy: 0.5, interactionType: "click" as const },
		];

		expect(getCursorVisualState(samples, 1_060).clickProgress).toBeCloseTo(0.9, 5);

		const previewState = getCursorVisualState(samples, 2_040, {
			timeMs: 2_000,
			interactionType: "click",
		});
		expect(previewState.clickProgress).toBeCloseTo(1 - 40 / 600, 5);
		expect(previewState.clickBounceProgress).toBeCloseTo(1 - 40 / 140, 5);
	});

	it("lets click highlight settings control the rendered ring style", () => {
		const style = getClickRingStyle(50, 0.5, {
			clickHighlightColor: "#ef4444",
			clickHighlightSize: 2,
			clickHighlightOpacity: 0.8,
		});

		expect(style).toEqual({
			color: 0xef4444,
			alpha: 0.4,
			radius: 59,
			lineWidth: 7.5,
		});
		expect(
			getClickRingStyle(50, 0.5, {
				clickHighlightColor: "#ef4444",
				clickHighlightSize: 0,
				clickHighlightOpacity: 0.8,
			}),
		).toBeNull();
		expect(
			getClickRingStyle(50, 0.5, {
				clickHighlightColor: "#ef4444",
				clickHighlightSize: 2,
				clickHighlightOpacity: 0,
			}),
		).toBeNull();
	});

	it("applies click bounce strength to cursor scale", () => {
		expect(getClickBounceScale(0.5, 0)).toBe(1);
		expect(getClickBounceScale(0.5, 1)).toBeCloseTo(0.92, 5);
		expect(getClickBounceScale(0.5, 5)).toBe(0.72);
	});
});

describe("custom cursor assets", () => {
	it("provides SVG assets for every supported cursor state", () => {
		for (const cursorKey of SUPPORTED_CURSOR_KEYS) {
			expect(cursorAssetPacks.custom[cursorKey]?.url).toBeTruthy();
		}
	});
});
