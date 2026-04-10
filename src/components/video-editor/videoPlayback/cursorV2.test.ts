import { describe, expect, it } from "vitest";

import type { CursorMotionSnapshot } from "./cursorSimulation";
import {
	CURSOR_MOVEMENT_PRESETS,
	getCursorVisibilityOpacity,
	resolveCursorMovementSpringConfig,
	resolveCursorV2Fields,
	resolveCursorVisualMode,
} from "./cursorV2";

function createMotionSnapshot(overrides: Partial<CursorMotionSnapshot> = {}): CursorMotionSnapshot {
	return {
		timeMs: 0,
		cx: 0.5,
		cy: 0.5,
		predictedCx: 0.5,
		predictedCy: 0.5,
		velocityX: 0,
		velocityY: 0,
		heading: 0,
		cursorType: "arrow",
		latestInteractionType: undefined,
		latestInteractionAgeMs: Number.POSITIVE_INFINITY,
		isDragging: false,
		isDwell: true,
		isTextInput: false,
		intent: "idle",
		confidence: "high",
		isActive: false,
		lastActiveTimeMs: 0,
		lastBecameActiveTimeMs: 0,
		lastBecameInactiveTimeMs: 0,
		rawCx: 0.5,
		rawCy: 0.5,
		speed: 0,
		isDiscontinuous: false,
		...overrides,
	};
}

describe("cursorV2", () => {
	it("derives v2 movement and tilt from legacy cursor settings", () => {
		const fields = resolveCursorV2Fields({
			legacyCursorSmoothing: 1.1,
			legacyCursorSway: 1.4,
		});

		expect(fields.smoothMovementEnabled).toBe(true);
		expect(fields.cursorTilt).toBeCloseTo(0.7, 5);
		expect(fields.cursorSpring.tension).toBeGreaterThan(0);
		expect(fields.cursorSpring.friction).toBeGreaterThan(0);
		expect(fields.cursorSpring.mass).toBeGreaterThan(0);
	});

	it("resolves preset movement styles to the shared spring table", () => {
		for (const [style, preset] of Object.entries(CURSOR_MOVEMENT_PRESETS)) {
			const spring = resolveCursorMovementSpringConfig(
				true,
				style as keyof typeof CURSOR_MOVEMENT_PRESETS,
				{ tension: 500, friction: 25, mass: 0.5 },
			);

			expect(spring).toMatchObject({
				stiffness: preset.tension,
				damping: preset.friction,
				mass: preset.mass,
			});
		}
	});

	it("keeps custom spring settings untouched", () => {
		const spring = resolveCursorMovementSpringConfig(true, "custom", {
			tension: 610,
			friction: 37,
			mass: 0.81,
		});

		expect(spring).toMatchObject({
			stiffness: 610,
			damping: 37,
			mass: 0.81,
		});
	});

	it("forces circle mode to ignore detected cursor-specific assets", () => {
		expect(
			resolveCursorVisualMode({
				cursorTypeMode: "circle",
				detectedCursorType: "text",
				availableCursorTypes: ["arrow", "text"],
			}),
		).toEqual({
			renderCircleCursor: true,
			assetCursorType: "arrow",
		});
	});

	it("computes deterministic idle fade-out and fade-in opacity from timeline timestamps", () => {
		const hiddenOpacity = getCursorVisibilityOpacity(
			createMotionSnapshot({
				timeMs: 1800,
				isActive: false,
				lastBecameInactiveTimeMs: 0,
			}),
			{ hideWhenIdle: true, idleHideDelayMs: 1500 },
		);
		const fadeInOpacity = getCursorVisibilityOpacity(
			createMotionSnapshot({
				timeMs: 45,
				isActive: true,
				lastBecameActiveTimeMs: 0,
			}),
			{ hideWhenIdle: true, idleHideDelayMs: 1500 },
		);

		expect(hiddenOpacity).toBe(0);
		expect(fadeInOpacity).toBeCloseTo(0.5, 5);
	});
});
