import { describe, expect, it } from "vitest";
import {
	computeHudCompactBounds,
	HUD_COMPACT_BOTTOM_MARGIN,
	reserveHudCompactWindowHeight,
} from "../../electron/hudCompactBounds";

describe("computeHudCompactBounds", () => {
	it("centers the compact HUD horizontally", () => {
		const bounds = computeHudCompactBounds(
			{ x: 100, y: 50, width: 1600, height: 900 },
			{ width: 640, height: 120 },
		);

		expect(bounds).toEqual({
			x: 580,
			y: 825,
			width: 640,
			height: 120,
		});
	});

	it("pins the compact HUD to the configured bottom margin", () => {
		const bounds = computeHudCompactBounds(
			{ x: 0, y: 0, width: 1920, height: 1080 },
			{ width: 720, height: 144 },
		);

		expect(bounds.y + bounds.height).toBe(1080 - HUD_COMPACT_BOTTOM_MARGIN);
	});

	it("clamps oversized layouts to the available work area", () => {
		const bounds = computeHudCompactBounds(
			{ x: 10, y: 20, width: 500, height: 300 },
			{ width: 900, height: 600 },
		);

		expect(bounds).toEqual({
			x: 10,
			y: 20,
			width: 500,
			height: 295,
		});
	});
});

describe("reserveHudCompactWindowHeight", () => {
	it("keeps a stable dropdown-safe window height without changing the measured width", () => {
		expect(reserveHudCompactWindowHeight({ width: 720, height: 96 }, 640)).toEqual({
			width: 720,
			height: 640,
		});
	});

	it("preserves taller compact layouts", () => {
		expect(reserveHudCompactWindowHeight({ width: 720, height: 700 }, 640)).toEqual({
			width: 720,
			height: 700,
		});
	});
});
