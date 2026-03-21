import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_REGION, type WebcamRegion } from "./types";
import { getWebcamPixelRect, normalizeWebcamRegion } from "./webcamRegionUtils";

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
});
