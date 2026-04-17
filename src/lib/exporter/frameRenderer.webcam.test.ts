import { describe, expect, it, vi } from "vitest";
import { FrameRenderer } from "./frameRenderer";

describe("FrameRenderer webcam compositing", () => {
	it("draws webcam frames with a centered source crop instead of stretching", () => {
		const renderer = new FrameRenderer({
			videoWidth: 1920,
			videoHeight: 1080,
			width: 1280,
			height: 720,
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		});
		const drawWebcamFrame = (
			renderer as unknown as {
				drawWebcamFrame: (
					ctx: CanvasRenderingContext2D,
					frame: CanvasImageSource,
					sourceCrop: { x: number; y: number; width: number; height: number } | null,
					x: number,
					y: number,
					width: number,
					height: number,
					mirror: boolean,
				) => void;
			}
		).drawWebcamFrame.bind(renderer);
		const frame = {} as CanvasImageSource;
		const ctx = {
			save: vi.fn(),
			restore: vi.fn(),
			translate: vi.fn(),
			scale: vi.fn(),
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D;

		drawWebcamFrame(ctx, frame, { x: 280, y: 0, width: 720, height: 720 }, 48, 64, 320, 320, false);

		expect(ctx.translate).toHaveBeenCalledWith(48, 64);
		expect(ctx.drawImage).toHaveBeenCalledWith(frame, 280, 0, 720, 720, 0, 0, 320, 320);
		expect(ctx.scale).not.toHaveBeenCalled();
	});
});
