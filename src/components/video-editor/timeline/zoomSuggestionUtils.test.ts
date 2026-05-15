import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { buildAutoZoomSuggestions, normalizeCursorTelemetry } from "./zoomSuggestionUtils";

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
			[
				sample(500, 0.2, 0.2, "click"),
				sample(620, 0.2, 0.2, "mouseup"),
				sample(3000, 0.8, 0.7, "double-click"),
				sample(3120, 0.8, 0.7, "mouseup"),
			],
			5000,
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(2);
		expect(result.suggestions[0]).toMatchObject({
			startMs: 2136,
			endMs: 4056,
			focus: { cx: 0.8, cy: 0.7 },
			mode: "static",
			kind: "double-click-like",
		});
		expect(result.suggestions[1]).toMatchObject({
			startMs: 0,
			endMs: 1920,
			focus: { cx: 0.2, cy: 0.2 },
			mode: "static",
		});
	});

	it("rejects interactions that are too close to a stronger accepted suggestion", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.25, 0.25, "click"), sample(1700, 0.75, 0.75, "click")],
			5000,
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0]).toMatchObject({
			startMs: 0,
			endMs: 1920,
			mode: "static",
		});
	});

	it("returns no slots when every candidate overlaps reserved spans", () => {
		const result = buildAutoZoomSuggestions(
			[sample(500, 0.4, 0.6, "click"), sample(1100, 0.4, 0.6)],
			4000,
			[{ start: 0, end: 1800 }],
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
			[{ start: 0, end: 1800 }],
		);

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0]).toMatchObject({
			startMs: 2336,
			endMs: 4256,
			focus: { cx: 0.7, cy: 0.3 },
		});
	});

	it("uses cursor-follow for active motion clusters and static focus for still interactions", () => {
		const active = normalizeCursorTelemetry(
			[
				sample(500, 0.2, 0.2, "click"),
				sample(650, 0.22, 0.28),
				sample(900, 0.24, 0.4),
				sample(1200, 0.26, 0.52),
			],
			3000,
		);
		const still = normalizeCursorTelemetry(
			[
				sample(500, 0.2, 0.2, "click"),
				sample(650, 0.2, 0.2),
				sample(900, 0.2, 0.2),
				sample(1200, 0.2, 0.2),
			],
			3000,
		);

		expect(buildAutoZoomSuggestions(active, 3000).suggestions[0]?.mode).toBe("cursor-follow");
		expect(buildAutoZoomSuggestions(still, 3000).suggestions[0]?.mode).toBe("static");
	});

	it("keeps text dwell zooms active through long typing pauses", () => {
		const samples = normalizeCursorTelemetry(
			[
				sample(300, 0.24, 0.3, "click"),
				sample(420, 0.24, 0.3, "mouseup"),
				sample(900, 0.24, 0.3),
				sample(1800, 0.241, 0.301),
				sample(3200, 0.239, 0.3),
				sample(5200, 0.24, 0.302),
				sample(6500, 0.24, 0.3),
			],
			8000,
		);

		const result = buildAutoZoomSuggestions(samples, 8000);

		expect(result.status).toBe("ok");
		expect(result.suggestions[0]).toMatchObject({
			startMs: 0,
			mode: "static",
			kind: "text-focus-like",
		});
		expect(result.suggestions[0]?.endMs).toBeGreaterThanOrEqual(6500);
	});
});
