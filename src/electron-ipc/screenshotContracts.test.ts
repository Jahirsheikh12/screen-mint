import { describe, expect, it } from "vitest";
import { IPC_CHANNELS, type ScreenshotCaptureRequest } from "./contracts";

describe("screenshot IPC contracts", () => {
	it("declares stable screenshot channels", () => {
		expect(IPC_CHANNELS.screenshot).toEqual({
			capture: "screenshot:capture",
		});
	});

	it("allows source/area capture requests with recordings and clipboard destinations", () => {
		const request: ScreenshotCaptureRequest = {
			source: {
				id: "screen:1",
				name: "Display 1",
				display_id: "1",
			},
			selectedArea: {
				displayId: 1,
				displayBounds: { x: 0, y: 0, width: 1920, height: 1080 },
				bounds: { x: 100, y: 100, width: 500, height: 300 },
				normalizedBounds: {
					x: 100 / 1920,
					y: 100 / 1080,
					width: 500 / 1920,
					height: 300 / 1080,
				},
			},
			saveToRecordings: true,
			copyToClipboard: true,
			fileName: "demo-shot.png",
		};

		expect(request.saveToRecordings).toBe(true);
		expect(request.copyToClipboard).toBe(true);
		expect(request.source?.id).toBe("screen:1");
	});
});
