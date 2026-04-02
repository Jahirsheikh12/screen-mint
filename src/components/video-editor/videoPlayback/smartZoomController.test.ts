import { describe, expect, it } from "vitest";
import { DEFAULT_CURSOR_FOLLOW_TRACKING, type ZoomRegion } from "../types";
import type { CursorMotionSnapshot } from "./cursorSimulation";
import { resolveZoomRegionFocus } from "./smartZoomController";

const baseRegion: ZoomRegion = {
	id: "zoom-1",
	startMs: 0,
	endMs: 1200,
	depth: 3,
	focus: { cx: 0.5, cy: 0.5 },
	mode: "cursor-follow",
	tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
};

function makeCursor(overrides: Partial<CursorMotionSnapshot> = {}): CursorMotionSnapshot {
	return {
		timeMs: 500,
		cx: 0.8,
		cy: 0.75,
		rawCx: 0.8,
		rawCy: 0.75,
		predictedCx: 0.82,
		predictedCy: 0.77,
		velocityX: 0.25,
		velocityY: 0.2,
		speed: Math.hypot(0.25, 0.2),
		heading: 0,
		cursorType: "arrow",
		latestInteractionAgeMs: Number.POSITIVE_INFINITY,
		isDragging: false,
		isDwell: false,
		isTextInput: false,
		intent: "idle",
		confidence: "high",
		isDiscontinuous: false,
		...overrides,
	};
}

describe("resolveZoomRegionFocus", () => {
	it("returns static focus for static zoom regions", () => {
		const result = resolveZoomRegionFocus(
			{ ...baseRegion, mode: "static", focus: { cx: 0.42, cy: 0.61 } },
			makeCursor(),
			{ cx: 0.5, cy: 0.5 },
			1 / 60,
		);
		expect(result.focus).toEqual({ cx: 0.42, cy: 0.61 });
		expect(result.smoothTimeFactor).toBe(1.0);
	});

	it("holds focus during text interactions", () => {
		const result = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				cursorType: "text",
				isTextInput: true,
				latestInteractionType: "click",
				latestInteractionAgeMs: 120,
			}),
			{ cx: 0.52, cy: 0.49 },
			1 / 60,
		);
		expect(result.focus.cx).toBeCloseTo(0.52, 1);
		expect(result.focus.cy).toBeCloseTo(0.49, 1);
	});

	it("respects the deadzone for tiny cursor movement", () => {
		const result = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ cx: 0.53, cy: 0.515, velocityX: 0, velocityY: 0 }),
			{ cx: 0.52, cy: 0.5 },
			1 / 60,
		);

		expect(result.focus.cx).toBeCloseTo(0.52, 1);
		expect(result.focus.cy).toBeCloseTo(0.5, 1);
	});

	it("returns raw target for large cursor movements (no speed capping)", () => {
		const result = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ cx: 0.9, cy: 0.82, velocityX: 0, velocityY: 0 }),
			{ cx: 0.5, cy: 0.5 },
			1 / 60,
		);

		// With speed capping removed, target should be near the cursor position
		// (soft-clamped to viewport bounds for depth 3 / scale 1.8)
		expect(result.focus.cx).toBeGreaterThan(0.7);
		expect(result.focus.cy).toBeGreaterThan(0.7);
		expect(result.smoothTimeFactor).toBe(1.0);
	});

	it("locks focus during typing intent even without a fresh click", () => {
		const result = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				cursorType: "text",
				isTextInput: true,
				intent: "typing",
				latestInteractionAgeMs: 800,
			}),
			{ cx: 0.48, cy: 0.51 },
			1 / 60,
		);
		expect(result.focus.cx).toBeCloseTo(0.48, 1);
		expect(result.focus.cy).toBeCloseTo(0.51, 1);
	});

	it("returns lower smoothTimeFactor for targeting intent (faster tracking)", () => {
		const idleResult = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				intent: "idle",
				velocityX: 0.7,
				velocityY: 0.45,
			}),
			{ cx: 0.5, cy: 0.5 },
			1 / 15,
		);
		const targetingResult = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				intent: "targeting",
				velocityX: 0.7,
				velocityY: 0.45,
				latestInteractionType: "click",
				latestInteractionAgeMs: 260,
			}),
			{ cx: 0.5, cy: 0.5 },
			1 / 15,
		);

		expect(targetingResult.smoothTimeFactor).toBeLessThan(idleResult.smoothTimeFactor);
		expect(targetingResult.smoothTimeFactor).toBe(0.6);
	});

	it("returns higher smoothTimeFactor for dropdown intent (slower tracking)", () => {
		const idleResult = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ intent: "idle", velocityX: 0.35, velocityY: 0.8 }),
			{ cx: 0.5, cy: 0.5 },
			1 / 30,
		);
		const dropdownResult = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				intent: "dropdown",
				velocityX: 0.35,
				velocityY: 0.8,
				latestInteractionType: "click",
				latestInteractionAgeMs: 350,
			}),
			{ cx: 0.5, cy: 0.5 },
			1 / 30,
		);

		expect(dropdownResult.smoothTimeFactor).toBeGreaterThan(idleResult.smoothTimeFactor);
		expect(dropdownResult.smoothTimeFactor).toBe(2.0);
	});

	it("resets focus to the cursor when motion is discontinuous", () => {
		const result = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				cx: 0.72,
				cy: 0.68,
				isDiscontinuous: true,
			}),
			{ cx: 0.5, cy: 0.5 },
			1 / 30,
		);

		expect(result.focus.cx).toBeCloseTo(0.72, 1);
		expect(result.focus.cy).toBeCloseTo(0.68, 1);
	});
});
