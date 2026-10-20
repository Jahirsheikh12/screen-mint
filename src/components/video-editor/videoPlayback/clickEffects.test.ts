import { describe, expect, it } from "vitest";
import { withLegacyZoomTiming } from "../projectPersistence";
import { LEGACY_CURSOR_CLICK_STYLE } from "../types";
import { getClickEffectShapes, getCursorVisualState } from "./cursorRenderer";

const config = {
	clickHighlightColor: "#2563eb",
	clickHighlightOpacity: 1,
	clickHighlightSize: 1,
};

describe("click effects", () => {
	it("draws nothing once the effect has finished", () => {
		for (const effect of ["ripple", "spotlight", "echo"] as const) {
			expect(getClickEffectShapes(effect, 50, 0, config)).toEqual([]);
		}
	});

	it("spotlight is filled, ripple and echo are rings", () => {
		expect(getClickEffectShapes("spotlight", 50, 0.5, config).every((s) => !s.lineWidth)).toBe(
			true,
		);
		expect(getClickEffectShapes("ripple", 50, 0.5, config)[0].lineWidth).toBeGreaterThan(0);
		expect(getClickEffectShapes("echo", 50, 0.5, config)).toHaveLength(2);
	});

	it("handles recordings with no cursor samples", () => {
		expect(getCursorVisualState([], 500)).toMatchObject({
			cursorType: "arrow",
			clickBounceProgress: 0,
			clickProgress: 0,
		});
	});

	it("uses configured bounce and effect durations", () => {
		const click = { timeMs: 1000, cx: 0.5, cy: 0.5, interactionType: "click" as const };
		const timing = { effectDurationMs: 400, bounceDurationMs: 200 };
		const mid = getCursorVisualState([click], 1100, null, timing);
		expect(mid.clickBounceProgress).toBeCloseTo(0.5);
		expect(mid.clickProgress).toBeCloseTo(0.75);
		expect(getCursorVisualState([click], 1250, null, timing).clickBounceProgress).toBe(0);
	});

	it("cursor motion blur is frame-rate independent and off when still", async () => {
		const { getCursorMotionBlur } = await import("./cursorRenderer");
		const at60 = getCursorMotionBlur(10, 0, 1000 / 60, 0.6);
		const at30 = getCursorMotionBlur(20, 0, 1000 / 30, 0.6);
		expect(at60.velocity.x).toBeCloseTo(12, 5);
		expect(at30.velocity.x).toBeCloseTo(at60.velocity.x, 5);
		expect(getCursorMotionBlur(0, 0, 16, 0.6).velocity).toEqual({ x: 0, y: 0 });
	});

	it("legacy projects keep their cursor blur look", () => {
		const upgraded = withLegacyZoomTiming(11, { cursorMotionBlur: 0.35 });
		expect(upgraded.cursorMotionBlur).toBeCloseTo(0.84, 5);
	});

	it("legacy projects keep fixed click timing and no bounce when effects were off", () => {
		const upgraded = withLegacyZoomTiming(11, { clickEffectsEnabled: false, cursorClickBounce: 2 });
		expect(upgraded.cursorClickStyle).toEqual(LEGACY_CURSOR_CLICK_STYLE);
		expect(upgraded.cursorClickBounce).toBe(0);
		expect(
			withLegacyZoomTiming(11, { clickEffectsEnabled: true, cursorClickBounce: 2 })
				.cursorClickBounce,
		).toBe(2);
	});
});
