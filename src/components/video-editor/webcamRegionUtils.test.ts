import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_REGION, type WebcamRegion } from "./types";
import {
	createFreeWebcamRegionFromPixelRect,
	getWebcamPixelRect,
	normalizeWebcamRegion,
	normalizeWebcamRegionForRect,
} from "./webcamRegionUtils";

describe("webcamRegionUtils", () => {
	it("keeps square webcam shapes square in pixel space", () => {
		const region: WebcamRegion = normalizeWebcamRegion({
			...DEFAULT_WEBCAM_REGION,
			shape: "square",
			size: { width: 40, height: 20 },
			position: { x: 70, y: 70 },
			borderRadius: 18,
		});

		const rect = getWebcamPixelRect(region, 1600, 900);

		expect(rect.width).toBe(rect.height);
		expect(rect.x + rect.width).toBeLessThanOrEqual(1600);
		expect(rect.y + rect.height).toBeLessThanOrEqual(900);
	});

	it("keeps circle webcam shapes circular in pixel space", () => {
		const region: WebcamRegion = normalizeWebcamRegion({
			...DEFAULT_WEBCAM_REGION,
			shape: "circle",
			size: { width: 32, height: 18 },
			position: { x: 80, y: 75 },
		});

		const rect = getWebcamPixelRect(region, 1920, 1080);

		expect(rect.width).toBe(rect.height);
		expect(rect.x + rect.width).toBeLessThanOrEqual(1920);
		expect(rect.y + rect.height).toBeLessThanOrEqual(1080);
	});

	it("lets free circular webcam regions reach the right edge in wide compositions", () => {
		const region: WebcamRegion = {
			...DEFAULT_WEBCAM_REGION,
			anchor: "free",
			shape: "circle",
			size: { width: 18, height: 18 },
			position: { x: 100, y: 50 },
		};

		const rect = getWebcamPixelRect(region, 1920, 1080);
		const expectedSide = 1080 * 0.18;

		expect(rect.width).toBeCloseTo(expectedSide);
		expect(rect.x).toBeCloseTo(1920 - expectedSide);
		expect(rect.x + rect.width).toBeCloseTo(1920);
	});

	it("clamps free square webcam positions from pixel rects without jumping left", () => {
		const compositionRect = { x: 80, y: 40, width: 1280, height: 720 };
		const region: WebcamRegion = {
			...DEFAULT_WEBCAM_REGION,
			anchor: "free",
			shape: "square",
			size: { width: 20, height: 20 },
			position: { x: 70, y: 50 },
		};
		const draggedRegion = createFreeWebcamRegionFromPixelRect(
			region,
			{ x: compositionRect.x + compositionRect.width, y: 260, width: 144, height: 144 },
			compositionRect,
		);
		const rect = getWebcamPixelRect(draggedRegion, compositionRect.width, compositionRect.height);

		expect(draggedRegion.anchor).toBe("free");
		expect(rect.x + rect.width).toBeCloseTo(compositionRect.width);
	});

	it("uses composition dimensions when clamping fixed-shape free positions", () => {
		const region: WebcamRegion = {
			...DEFAULT_WEBCAM_REGION,
			anchor: "free",
			shape: "circle",
			size: { width: 25, height: 25 },
			position: { x: 100, y: 100 },
		};
		const wide = normalizeWebcamRegionForRect(region, 1600, 900);
		const square = normalizeWebcamRegionForRect(region, 900, 900);
		const vertical = normalizeWebcamRegionForRect(region, 900, 1600);

		expect(wide.position.x).toBeCloseTo(((1600 - 900 * 0.25) / 1600) * 100);
		expect(wide.position.y).toBeCloseTo(75);
		expect(square.position.x).toBeCloseTo(75);
		expect(square.position.y).toBeCloseTo(75);
		expect(vertical.position.x).toBeCloseTo(75);
		expect(vertical.position.y).toBeCloseTo(((1600 - 900 * 0.25) / 1600) * 100);
	});
});
