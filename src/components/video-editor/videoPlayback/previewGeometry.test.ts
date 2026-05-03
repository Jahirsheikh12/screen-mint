import { describe, expect, it } from "vitest";
import { rectsEqual } from "./previewGeometry";

describe("previewGeometry", () => {
	it("compares pixel rect values", () => {
		const rect = { x: 1, y: 2, width: 3, height: 4 };

		expect(rectsEqual(rect, { ...rect })).toBe(true);
		expect(rectsEqual(rect, { ...rect, width: 5 })).toBe(false);
	});
});
