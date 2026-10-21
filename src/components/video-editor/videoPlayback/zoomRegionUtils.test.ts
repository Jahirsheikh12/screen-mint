import { describe, expect, it } from "vitest";
import { normalizeZoomTiming, withLegacyZoomTiming } from "../projectPersistence";
import {
	DEFAULT_ZOOM_TIMING,
	LEGACY_ZOOM_TIMING,
	MOTION_PRESETS,
	ZOOM_TRANSITION_EASING_OPTIONS,
	type ZoomRegion,
} from "../types";
import { detectMotionPreset, motionPresetToCursorSpring } from "./cursorV2";
import { applyZoomEasing } from "./mathUtils";
import { computeRegionStrength, findDominantRegion } from "./zoomRegionUtils";

const region = (id: string, startMs: number, endMs: number): ZoomRegion => ({
	id,
	startMs,
	endMs,
	depth: 3,
	focus: { cx: 0.5, cy: 0.5 },
});

describe("zoom timing", () => {
	it("every curve maps 0→0 and 1→1 and stays within range", () => {
		for (const { value } of ZOOM_TRANSITION_EASING_OPTIONS) {
			expect(applyZoomEasing(value, 0)).toBeCloseTo(0, 5);
			expect(applyZoomEasing(value, 1)).toBeCloseTo(1, 5);
			for (let t = 0; t <= 1; t += 0.05) {
				const y = applyZoomEasing(value, t);
				expect(y).toBeGreaterThanOrEqual(-1e-6);
				expect(y).toBeLessThanOrEqual(1 + 1e-6);
			}
		}
	});

	it("zoom-in completes at start + overlap and zoom-out ends after out duration", () => {
		const r = region("a", 5000, 8000);
		const t = DEFAULT_ZOOM_TIMING;
		const leadIn = r.startMs + t.zoomInOverlapMs - t.zoomInDurationMs;
		expect(computeRegionStrength(r, leadIn - 1, t)).toBe(0);
		expect(computeRegionStrength(r, r.startMs + t.zoomInOverlapMs, t)).toBe(1);
		expect(computeRegionStrength(r, r.endMs, t)).toBe(1);
		expect(computeRegionStrength(r, r.endMs + t.zoomOutDurationMs + 1, t)).toBe(0);
	});

	it("connected zoom gap comes from timing", () => {
		const regions = [region("a", 1000, 2000), region("b", 3000, 4000)];
		const mid = 2500;
		const tight = findDominantRegion(regions, mid, {
			connectZooms: true,
			zoomTiming: { connectedZoomGapMs: 500 },
		});
		const loose = findDominantRegion(regions, 2200, {
			connectZooms: true,
			zoomTiming: { connectedZoomGapMs: 1500 },
		});
		expect(tight.transition).toBeNull();
		expect(loose.transition).not.toBeNull();
	});

	it("normalizes bad timing input to defaults and clamps ranges", () => {
		expect(normalizeZoomTiming(undefined)).toEqual(DEFAULT_ZOOM_TIMING);
		const out = normalizeZoomTiming({ zoomInDurationMs: -5, zoomInEasing: "bogus" });
		expect(out.zoomInDurationMs).toBe(0);
		expect(out.zoomInEasing).toBe(DEFAULT_ZOOM_TIMING.zoomInEasing);
	});

	it("keeps legacy timing for pre-v12 projects only", () => {
		expect(withLegacyZoomTiming(11, {}).zoomTiming).toEqual(LEGACY_ZOOM_TIMING);
		expect(withLegacyZoomTiming(12, {}).zoomTiming).toBeUndefined();
	});

	it("detects motion presets from applied values and reports custom otherwise", () => {
		for (const id of ["focused", "smooth"] as const) {
			const preset = MOTION_PRESETS[id];
			const applied = { ...preset, cursorSpring: motionPresetToCursorSpring(preset) };
			expect(detectMotionPreset(applied)).toBe(id);
			expect(detectMotionPreset({ ...applied, cursorSize: 4 })).toBeNull();
		}
	});
});

describe("temporal zoom blur sampling", () => {
	it("skips sampling when the camera is still", async () => {
		const { getTemporalSampleFractions } = await import("@/lib/exporter/frameRenderer");
		const still = { scale: 1.8, x: 10, y: 10 };
		expect(getTemporalSampleFractions(still, still, 8, 0.5)).toEqual([]);
	});

	it("spreads samples across the shutter window ending at the current frame", async () => {
		const { getTemporalSampleFractions } = await import("@/lib/exporter/frameRenderer");
		const fractions = getTemporalSampleFractions(
			{ scale: 1, x: 0, y: 0 },
			{ scale: 1.5, x: 40, y: 20 },
			5,
			0.5,
		);
		expect(fractions).toEqual([0.5, 0.625, 0.75, 0.875, 1]);
	});
});
