import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { buildCursorSimulationPath, evaluateCursorPath } from "./cursorSimulation";

describe("cursorSimulation", () => {
	it("suppresses small jitter during dwell", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.5, cy: 0.5 },
			{ timeMs: 16, cx: 0.505, cy: 0.497 },
			{ timeMs: 32, cx: 0.496, cy: 0.503 },
			{ timeMs: 48, cx: 0.504, cy: 0.499 },
			{ timeMs: 64, cx: 0.5, cy: 0.501 },
		];

		const path = buildCursorSimulationPath(samples, 64);
		const evaluation = evaluateCursorPath(path, 64);

		expect(evaluation).not.toBeNull();
		expect(evaluation!.cx).toBeGreaterThan(0.495);
		expect(evaluation!.cx).toBeLessThan(0.505);
		expect(evaluation!.cy).toBeGreaterThan(0.495);
		expect(evaluation!.cy).toBeLessThan(0.505);
		expect(evaluation!.isDwell).toBe(true);
	});

	it("keeps predicted position ahead of filtered position during fast moves", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.1, cy: 0.1 },
			{ timeMs: 32, cx: 0.2, cy: 0.18 },
			{ timeMs: 64, cx: 0.45, cy: 0.38 },
			{ timeMs: 96, cx: 0.72, cy: 0.66 },
		];

		const path = buildCursorSimulationPath(samples, 96);
		const evaluation = evaluateCursorPath(path, 96);

		expect(evaluation).not.toBeNull();
		expect(evaluation!.predictedCx).toBeGreaterThanOrEqual(evaluation!.cx);
		expect(evaluation!.predictedCy).toBeGreaterThanOrEqual(evaluation!.cy);
		expect(evaluation!.velocityX).toBeGreaterThan(0);
		expect(evaluation!.velocityY).toBeGreaterThan(0);
	});

	it("tracks click timing and drag lifecycle", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.2, cy: 0.2, interactionType: "mousedown" },
			{ timeMs: 30, cx: 0.25, cy: 0.22, interactionType: "drag-start" },
			{ timeMs: 60, cx: 0.32, cy: 0.24, interactionType: "drag" },
			{ timeMs: 90, cx: 0.36, cy: 0.25, interactionType: "drag-end" },
			{ timeMs: 140, cx: 0.36, cy: 0.25, interactionType: "click" },
		];

		const path = buildCursorSimulationPath(samples, 140);
		expect(evaluateCursorPath(path, 50)?.isDragging).toBe(true);
		expect(evaluateCursorPath(path, 110)?.isDragging).toBe(false);
		expect(evaluateCursorPath(path, 150)?.latestInteractionType).toBe("click");
	});

	it("preserves unknown cursor types and marks teleports as low confidence", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.1, cy: 0.1, cursorType: "unknown", confidence: "low" },
			{ timeMs: 10, cx: 0.95, cy: 0.95, cursorType: "unknown", confidence: "low" },
		];

		const path = buildCursorSimulationPath(samples, 10);
		const evaluation = evaluateCursorPath(path, 5);

		expect(evaluation).not.toBeNull();
		expect(evaluation!.cursorType).toBe("unknown");
		expect(evaluation!.confidence).toBe("low");
		expect(evaluation!.cx).toBeLessThan(0.4);
		expect(evaluation!.cy).toBeLessThan(0.4);
	});

	it("classifies recent text clicks as typing intent", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.42, cy: 0.38, cursorType: "text" },
			{ timeMs: 80, cx: 0.425, cy: 0.382, cursorType: "text", interactionType: "click" },
			{ timeMs: 140, cx: 0.426, cy: 0.383, cursorType: "text" },
		];

		const path = buildCursorSimulationPath(samples, 140);
		const evaluation = evaluateCursorPath(path, 160);

		expect(evaluation).not.toBeNull();
		expect(evaluation!.intent).toBe("typing");
		expect(evaluation!.isTextInput).toBe(true);
	});

	it("classifies vertical post-click browsing as dropdown intent", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.52, cy: 0.22, interactionType: "click" },
			{ timeMs: 120, cx: 0.53, cy: 0.32, velocityY: 0.24 },
			{ timeMs: 240, cx: 0.535, cy: 0.45, velocityY: 0.28 },
			{ timeMs: 360, cx: 0.54, cy: 0.58, velocityY: 0.31 },
		];

		const path = buildCursorSimulationPath(samples, 360);
		const evaluation = evaluateCursorPath(path, 360);

		expect(evaluation).not.toBeNull();
		expect(evaluation!.intent).toBe("dropdown");
	});

	it("reprojects raw cursor coordinates against source bounds snapshots", () => {
		const samples: CursorTelemetryPoint[] = [
			{
				timeMs: 0,
				cx: 0.9,
				cy: 0.9,
				rawX: 520,
				rawY: 220,
				sourceBounds: { x: 400, y: 100, width: 400, height: 300 },
				captureMode: "window",
			},
			{
				timeMs: 200,
				cx: 0.9,
				cy: 0.9,
				rawX: 520,
				rawY: 220,
				sourceBounds: { x: 500, y: 100, width: 400, height: 300 },
				captureMode: "window",
			},
		];

		const path = buildCursorSimulationPath(samples, 200);
		const startEvaluation = evaluateCursorPath(path, 0);
		const endEvaluation = evaluateCursorPath(path, 200);

		expect(startEvaluation).not.toBeNull();
		expect(endEvaluation).not.toBeNull();
		expect(path.samples[0]?.cx).toBeCloseTo(0.3, 4);
		expect(path.samples[1]?.cx).toBeCloseTo(0.05, 4);
		expect(startEvaluation!.cx).toBeLessThan(0.35);
		expect(endEvaluation!.cx).toBeLessThan(0.31);
	});
});
