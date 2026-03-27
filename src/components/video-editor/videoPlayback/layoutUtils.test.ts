import { describe, expect, it, vi } from "vitest";
import { layoutVideoContent } from "./layoutUtils";

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
});
