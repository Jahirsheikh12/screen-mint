import { describe, expect, it, vi } from "vitest";
import {
	calculateVideoLayoutGeometry,
	composeCropRegions,
	deriveLegacyCaptureCorrectionCrop,
	invertCropRegionWithinBase,
	layoutVideoContent,
} from "./layoutUtils";

describe("layoutVideoContent", () => {
	it("upscales the preview to fill the available viewport when padding is zero", () => {
		const resize = vi.fn();
		const app = {
			renderer: { resize },
			canvas: { style: {} as CSSStyleDeclaration },
		};
		const videoSprite = {
			scale: { set: vi.fn() },
			position: { set: vi.fn() },
		};
		const maskGraphics = {
			clear: vi.fn(),
			roundRect: vi.fn(),
			fill: vi.fn(),
		};
		const container = {
			clientWidth: 1600,
			clientHeight: 900,
		};
		const videoElement = {
			videoWidth: 1280,
			videoHeight: 720,
		};

		const result = layoutVideoContent({
			container: container as HTMLDivElement,
			app: app as never,
			videoSprite: videoSprite as never,
			maskGraphics: maskGraphics as never,
			videoElement: videoElement as HTMLVideoElement,
			padding: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		});

		expect(result).not.toBeNull();
		expect(result?.maskRect.width).toBe(1600);
		expect(result?.maskRect.height).toBe(900);
		expect(result?.baseScale).toBeCloseTo(1.25, 5);
		expect(videoSprite.scale.set).toHaveBeenCalledWith(1.25);
		expect(resize).toHaveBeenCalledWith(1600, 900);
	});

	it("fits the preview into the selected aspect ratio frame", () => {
		const result = calculateVideoLayoutGeometry({
			containerWidth: 1600,
			containerHeight: 900,
			videoWidth: 1280,
			videoHeight: 720,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			padding: 0,
			aspectRatio: "1:1",
		});

		expect(result).not.toBeNull();
		expect(result?.frameRect.width).toBe(900);
		expect(result?.frameRect.height).toBe(900);
		expect(result?.maskRect.width).toBe(900);
		expect(result?.maskRect.height).toBeCloseTo(506.25, 5);
		expect(result?.maskRect.x).toBe(350);
	});

	it("derives a centered crop for legacy padded window or display captures", () => {
		expect(
			deriveLegacyCaptureCorrectionCrop({
				videoWidth: 1920,
				videoHeight: 1080,
				cursorTelemetry: [
					{
						timeMs: 0,
						cx: 0.5,
						cy: 0.5,
						captureMode: "window",
						sourceBounds: { x: 0, y: 0, width: 1440, height: 1080 },
					},
				],
			}),
		).toEqual({
			x: 0.125,
			y: 0,
			width: 0.75,
			height: 1,
		});
	});

	it("composes and inverts crop regions within a base crop", () => {
		const baseCrop = { x: 0.125, y: 0, width: 0.75, height: 1 };
		const userCrop = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
		const composedCrop = composeCropRegions(baseCrop, userCrop);

		expect(composedCrop).toEqual({
			x: 0.2,
			y: 0.2,
			width: 0.375,
			height: 0.4,
		});
		const invertedCrop = invertCropRegionWithinBase(baseCrop, composedCrop);
		expect(invertedCrop.x).toBeCloseTo(userCrop.x, 10);
		expect(invertedCrop.y).toBeCloseTo(userCrop.y, 10);
		expect(invertedCrop.width).toBeCloseTo(userCrop.width, 10);
		expect(invertedCrop.height).toBeCloseTo(userCrop.height, 10);
	});
});
