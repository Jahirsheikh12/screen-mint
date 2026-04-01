import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { AUTO_ZOOM_REGION_DURATION_MS, buildAutoZoomSuggestions } from "./zoomSuggestionUtils";

function sample(
	timeMs: number,
	cx: number,
	cy: number,
	interactionType?: CursorTelemetryPoint["interactionType"],
): CursorTelemetryPoint {
	return {
		timeMs,
		cx,
		cy,
		interactionType,
	};
}

describe("buildAutoZoomSuggestions", () => {
	it("returns insufficient telemetry when there are no samples", () => {
		expect(buildAutoZoomSuggestions([], 4000)).toEqual({
			suggestions: [],
			status: "insufficient-telemetry",
		});
	});

	it("returns insufficient telemetry when there is only one sample", () => {
		expect(buildAutoZoomSuggestions([sample(0, 0.5, 0.5)], 4000)).toEqual({
			suggestions: [],
			status: "insufficient-telemetry",
		});
	});

	it("returns no candidates when movement never settles into an interaction", () => {
		const result = buildAutoZoomSuggestions(
			[sample(0, 0.1, 0.1), sample(100, 0.4, 0.4), sample(200, 0.8, 0.8)],
			4000,
		);

		expect(result).toEqual({
			suggestions: [],
			status: "no-candidates",
		});
	});

	it("sorts accepted suggestions by interaction strength", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.2, 0.2, "click"), sample(3000, 0.8, 0.7, "double-click")],
			5000,
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(2);
		expect(result.suggestions[0]).toEqual({
			startMs: 2500,
			endMs: 2500 + AUTO_ZOOM_REGION_DURATION_MS,
			focus: { cx: 0.8, cy: 0.7 },
		});
		expect(result.suggestions[1]).toEqual({
			startMs: 0,
			endMs: AUTO_ZOOM_REGION_DURATION_MS,
			focus: { cx: 0.2, cy: 0.2 },
		});
	});

	it("rejects interactions that are too close to a stronger accepted suggestion", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.25, 0.25, "click"), sample(1700, 0.75, 0.75, "click")],
			5000,
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toEqual([
			{
				startMs: 0,
				endMs: AUTO_ZOOM_REGION_DURATION_MS,
				focus: { cx: 0.25, cy: 0.25 },
			},
		]);
	});

	it("returns no slots when every candidate overlaps reserved spans", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.4, 0.6, "click"), sample(1100, 0.4, 0.6)],
			4000,
			[{ start: 0, end: AUTO_ZOOM_REGION_DURATION_MS }],
		);

		expect(result).toEqual({
			suggestions: [],
			status: "no-slots",
		});
	});

	it("skips reserved overlaps and still returns later accepted suggestions", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.4, 0.6, "click"), sample(3200, 0.7, 0.3, "click")],
			5000,
			[{ start: 0, end: AUTO_ZOOM_REGION_DURATION_MS }],
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toEqual([
			{
				startMs: 2700,
				endMs: 2700 + AUTO_ZOOM_REGION_DURATION_MS,
				focus: { cx: 0.7, cy: 0.3 },
			},
		]);
	});
});
