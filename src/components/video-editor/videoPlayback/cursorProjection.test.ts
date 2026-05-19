import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { projectCursorSample } from "./cursorProjection";

function sample(overrides: Partial<CursorTelemetryPoint> = {}): CursorTelemetryPoint {
	return {
		timeMs: 1200,
		cx: 0.1,
		cy: 0.2,
		...overrides,
	};
}

describe("projectCursorSample", () => {
	it("prefers raw screen coordinates with source bounds", () => {
		const projected = projectCursorSample(
			sample({
				rawX: 500,
				rawY: 350,
				sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
			}),
		);

		expect(projected.cx).toBeCloseTo(0.5);
		expect(projected.cy).toBeCloseTo(0.5);
		expect(projected.confidence).toBe("high");
		expect(projected.projection?.reprojectedFromRaw).toBe(true);
	});

	it("projects through a crop region after raw coordinate reprojection", () => {
		const projected = projectCursorSample(
			sample({
				rawX: 500,
				rawY: 350,
				sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
			}),
			{ cropRegion: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
		);

		expect(projected.cx).toBeCloseTo(0.5);
		expect(projected.cy).toBeCloseTo(0.5);
	});

	it("marks out-of-source raw coordinates as medium confidence with diagnostics", () => {
		const projected = projectCursorSample(
			sample({
				rawX: 50,
				rawY: 350,
				sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
			}),
		);

		expect(projected.cx).toBe(0);
		expect(projected.confidence).toBe("medium");
		expect(projected.projection?.reason).toBe("outside-source");
	});

	it("keeps normalized coordinates and diagnoses missing bounds when raw is present", () => {
		const projected = projectCursorSample(sample({ rawX: 500, rawY: 350 }));

		expect(projected.cx).toBe(0.1);
		expect(projected.cy).toBe(0.2);
		expect(projected.confidence).toBe("high");
		expect(projected.projection?.reason).toBe("missing-bounds");
	});

	it("keeps platform fallback telemetry conservative", () => {
		const projected = projectCursorSample(
			sample({
				rawX: 500,
				rawY: 350,
				sourceBounds: { x: 100, y: 50, width: 800, height: 600 },
				capturePlatform: "linux",
				geometrySource: "fallback-display",
				projectionConfidence: "medium",
			}),
		);

		expect(projected.cx).toBeCloseTo(0.5);
		expect(projected.cy).toBeCloseTo(0.5);
		expect(projected.confidence).toBe("medium");
		expect(projected.geometrySource).toBe("fallback-display");
	});
});
