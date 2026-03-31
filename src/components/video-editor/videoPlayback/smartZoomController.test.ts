import { describe, expect, it } from "vitest";
import { DEFAULT_CURSOR_FOLLOW_TRACKING, type ZoomRegion } from "../types";
import type { CursorEvaluation } from "./cursorSimulation";
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

function makeCursor(overrides: Partial<CursorEvaluation> = {}): CursorEvaluation {
	return {
		timeMs: 500,
		cx: 0.8,
		cy: 0.75,
		predictedCx: 0.82,
		predictedCy: 0.77,
		velocityX: 0.25,
		velocityY: 0.2,
		heading: 0,
		cursorType: "arrow",
		latestInteractionAgeMs: Number.POSITIVE_INFINITY,
		isDragging: false,
		isDwell: false,
		isTextInput: false,
		intent: "idle",
		confidence: "high",
		...overrides,
	};
}

describe("resolveZoomRegionFocus", () => {
	it("returns static focus for static zoom regions", () => {
		expect(
			resolveZoomRegionFocus(
				{ ...baseRegion, mode: "static", focus: { cx: 0.42, cy: 0.61 } },
				makeCursor(),
				{ cx: 0.5, cy: 0.5 },
				1 / 60,
			),
		).toEqual({ cx: 0.42, cy: 0.61 });
	});

	it("holds focus during text interactions", () => {
		expect(
			resolveZoomRegionFocus(
				baseRegion,
				makeCursor({
					cursorType: "text",
					isTextInput: true,
					latestInteractionType: "click",
					latestInteractionAgeMs: 120,
				}),
				{ cx: 0.52, cy: 0.49 },
				1 / 60,
			),
		).toEqual({ cx: 0.52, cy: 0.49 });
	});

	it("respects the deadzone for tiny cursor movement", () => {
		const focus = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ cx: 0.53, cy: 0.515, velocityX: 0, velocityY: 0 }),
			{ cx: 0.52, cy: 0.5 },
			1 / 60,
		);

		expect(focus).toEqual({ cx: 0.52, cy: 0.5 });
	});

	it("limits pan speed for large cursor jumps", () => {
		const focus = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ cx: 0.9, cy: 0.82, velocityX: 0, velocityY: 0 }),
			{ cx: 0.5, cy: 0.5 },
			1 / 60,
		);

		expect(focus.cx).toBeGreaterThan(0.5);
		expect(focus.cx).toBeLessThan(0.6);
		expect(focus.cy).toBeGreaterThan(0.5);
		expect(focus.cy).toBeLessThan(0.6);
	});

	it("locks focus during typing intent even without a fresh click", () => {
		expect(
			resolveZoomRegionFocus(
				baseRegion,
				makeCursor({
					cursorType: "text",
					isTextInput: true,
					intent: "typing",
					latestInteractionAgeMs: 800,
				}),
				{ cx: 0.48, cy: 0.51 },
				1 / 60,
			),
		).toEqual({ cx: 0.48, cy: 0.51 });
	});

	it("moves more aggressively for targeting intent", () => {
		const idleFocus = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({
				intent: "idle",
				velocityX: 0.7,
				velocityY: 0.45,
			}),
			{ cx: 0.5, cy: 0.5 },
			1 / 15,
		);
		const focus = resolveZoomRegionFocus(
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

		expect(focus.cx).toBeGreaterThan(idleFocus.cx);
		expect(focus.cy).toBeGreaterThan(idleFocus.cy);
		expect(focus.cx).toBeGreaterThan(0.55);
	});

	it("damps dropdown browsing so the camera does not lurch", () => {
		const idleFocus = resolveZoomRegionFocus(
			baseRegion,
			makeCursor({ intent: "idle", velocityX: 0.35, velocityY: 0.8 }),
			{ cx: 0.5, cy: 0.5 },
			1 / 30,
		);
		const dropdownFocus = resolveZoomRegionFocus(
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

		expect(dropdownFocus.cx).toBeLessThan(idleFocus.cx);
		expect(dropdownFocus.cy).toBeLessThan(idleFocus.cy);
	});
});
