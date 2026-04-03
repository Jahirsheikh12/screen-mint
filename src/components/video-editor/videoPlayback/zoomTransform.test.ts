import { describe, expect, it } from "vitest";
import { projectFrameRect } from "./zoomTransform";

describe("projectFrameRect", () => {
	it("returns the original rect and scalar values for the identity transform", () => {
		const result = projectFrameRect({
			rect: { x: 120, y: 80, width: 640, height: 360 },
			transform: { scale: 1, x: 0, y: 0 },
			borderRadius: 24,
			borderWidth: 6,
		});

		expect(result).toEqual({
			rect: { x: 120, y: 80, width: 640, height: 360 },
			scale: 1,
			borderRadius: 24,
			borderWidth: 6,
		});
	});

	it("projects a rect through camera scale and translation", () => {
		const result = projectFrameRect({
			rect: { x: 100, y: 50, width: 400, height: 300 },
			transform: { scale: 1.5, x: -40, y: 25 },
		});

		expect(result.rect).toEqual({
			x: 110,
			y: 100,
			width: 600,
			height: 450,
		});
		expect(result.scale).toBe(1.5);
	});

	it("scales border width and radius with the camera transform", () => {
		const result = projectFrameRect({
			rect: { x: 10, y: 20, width: 300, height: 180 },
			transform: { scale: 1.75, x: 12, y: -8 },
			borderRadius: 16,
			borderWidth: 5,
		});

		expect(result.borderRadius).toBe(28);
		expect(result.borderWidth).toBe(8.75);
	});
});
