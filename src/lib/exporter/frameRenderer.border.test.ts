import { describe, expect, it, vi } from "vitest";
import { FrameRenderer } from "./frameRenderer";

interface RendererHarness {
	layoutCache: {
		stageSize: { width: number; height: number };
		frameRect: { x: number; y: number; width: number; height: number };
		videoSize: { width: number; height: number };
		baseScale: number;
		baseOffset: { x: number; y: number };
		maskRect: { x: number; y: number; width: number; height: number };
	};
	animationState: {
		scale: number;
		appliedScale: number;
		focusX: number;
		focusY: number;
		focusVelocityX: number;
		focusVelocityY: number;
		smoothTimeFactor: number;
		progress: number;
		x: number;
		y: number;
		lastUpdateMs: number | null;
		lastPlaybackTimeMs: number | null;
	};
	drawFrameBorder: (ctx: CanvasRenderingContext2D, scaleFactor: number) => void;
	compositeCanvas: { width: number; height: number } | null;
	compositeCtx: CanvasRenderingContext2D | null;
	app: { canvas: HTMLCanvasElement } | null;
	backgroundCanvas: HTMLCanvasElement | null;
	config: {
		showShadow: boolean;
		backgroundBlur: number;
		deviceMockup?: string;
		frameBorderEnabled?: boolean;
		frameBorderWidth?: number;
		frameBorderColor?: string;
		frameBorderOpacity?: number;
		borderRadius?: number;
		frameShadowSize?: number;
		frameShadowOpacity?: number;
		frameShadowBlur?: number;
		shadowIntensity: number;
		previewWidth?: number;
		previewHeight?: number;
		width: number;
		height: number;
	};
	compositeWithShadows: () => void;
}

describe("FrameRenderer frame border", () => {
	it("projects the border geometry through the active camera transform", () => {
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
			frameBorderEnabled: true,
			frameBorderWidth: 8,
			frameBorderColor: "#112233",
			frameBorderOpacity: 0.6,
			borderRadius: 12,
		});
		const rendererHarness = renderer as unknown as RendererHarness;

		rendererHarness.layoutCache = {
			stageSize: { width: 1280, height: 720 },
			frameRect: { x: 0, y: 0, width: 1280, height: 720 },
			videoSize: { width: 1920, height: 1080 },
			baseScale: 1,
			baseOffset: { x: 0, y: 0 },
			maskRect: { x: 10, y: 20, width: 300, height: 200 },
		};
		rendererHarness.animationState = {
			scale: 1.5,
			appliedScale: 1.5,
			focusX: 0.5,
			focusY: 0.5,
			focusVelocityX: 0,
			focusVelocityY: 0,
			smoothTimeFactor: 1,
			progress: 1,
			x: 100,
			y: 40,
			lastUpdateMs: 0,
			lastPlaybackTimeMs: 0,
		};

		const ctx = {
			save: vi.fn(),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			fill: vi.fn(),
			restore: vi.fn(),
		} as unknown as CanvasRenderingContext2D;

		rendererHarness.drawFrameBorder(ctx, 1);

		expect(ctx.roundRect).toHaveBeenNthCalledWith(1, 103, 58, 474, 324, 30);
		expect(ctx.roundRect).toHaveBeenNthCalledWith(2, 115, 70, 450, 300, 18);
		expect(ctx.fill).toHaveBeenCalledWith("evenodd");
	});

	it("draws the border before the video canvas so the cursor stays above it", () => {
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
			frameBorderEnabled: true,
			frameBorderWidth: 8,
			frameBorderColor: "#112233",
			frameBorderOpacity: 0.6,
			borderRadius: 12,
		});
		const rendererHarness = renderer as unknown as RendererHarness;
		const drawOrder: string[] = [];
		const videoCanvas = {} as HTMLCanvasElement;
		const backgroundCanvas = {} as HTMLCanvasElement;
		const compositeCtx = {
			clearRect: vi.fn(() => drawOrder.push("clear")),
			drawImage: vi.fn((image: CanvasImageSource) => {
				if (image === backgroundCanvas) {
					drawOrder.push("background");
					return;
				}
				if (image === videoCanvas) {
					drawOrder.push("video");
				}
			}),
		} as unknown as CanvasRenderingContext2D;

		rendererHarness.layoutCache = {
			stageSize: { width: 1280, height: 720 },
			frameRect: { x: 0, y: 0, width: 1280, height: 720 },
			videoSize: { width: 1920, height: 1080 },
			baseScale: 1,
			baseOffset: { x: 0, y: 0 },
			maskRect: { x: 10, y: 20, width: 300, height: 200 },
		};
		rendererHarness.animationState = {
			scale: 1.5,
			appliedScale: 1.5,
			focusX: 0.5,
			focusY: 0.5,
			focusVelocityX: 0,
			focusVelocityY: 0,
			smoothTimeFactor: 1,
			progress: 1,
			x: 100,
			y: 40,
			lastUpdateMs: 0,
			lastPlaybackTimeMs: 0,
		};
		rendererHarness.compositeCanvas = { width: 1280, height: 720 };
		rendererHarness.compositeCtx = compositeCtx;
		rendererHarness.app = { canvas: videoCanvas };
		rendererHarness.backgroundCanvas = backgroundCanvas;

		const drawFrameBorderSpy = vi
			.spyOn(rendererHarness, "drawFrameBorder")
			.mockImplementation(() => drawOrder.push("border"));

		rendererHarness.compositeWithShadows();

		expect(drawOrder).toEqual(["clear", "background", "border", "video"]);
		drawFrameBorderSpy.mockRestore();
	});

	it("keeps the border beneath the shadowed video composite during export", () => {
		const renderer = new FrameRenderer({
			videoWidth: 1920,
			videoHeight: 1080,
			width: 1280,
			height: 720,
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: true,
			shadowIntensity: 0.8,
			frameShadowSize: 12,
			frameShadowOpacity: 0.5,
			frameShadowBlur: 32,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			frameBorderEnabled: true,
			frameBorderWidth: 8,
			frameBorderColor: "#112233",
			frameBorderOpacity: 0.6,
			borderRadius: 12,
		});
		const rendererHarness = renderer as unknown as RendererHarness & {
			shadowCanvas: HTMLCanvasElement | null;
			shadowCtx: CanvasRenderingContext2D | null;
		};
		const drawOrder: string[] = [];
		const videoCanvas = {} as HTMLCanvasElement;
		const backgroundCanvas = {} as HTMLCanvasElement;
		const shadowCanvas = {} as HTMLCanvasElement;
		const shadowCtx = {
			clearRect: vi.fn(() => drawOrder.push("shadow-clear")),
			save: vi.fn(() => drawOrder.push("shadow-save")),
			restore: vi.fn(() => drawOrder.push("shadow-restore")),
			drawImage: vi.fn((image: CanvasImageSource) => {
				if (image === videoCanvas) {
					drawOrder.push("shadow-video");
				}
			}),
			set filter(_value: string) {
				drawOrder.push("shadow-filter");
			},
		} as unknown as CanvasRenderingContext2D;
		const compositeCtx = {
			clearRect: vi.fn(() => drawOrder.push("clear")),
			drawImage: vi.fn((image: CanvasImageSource) => {
				if (image === backgroundCanvas) {
					drawOrder.push("background");
					return;
				}
				if (image === shadowCanvas) {
					drawOrder.push("shadow-composite");
				}
			}),
		} as unknown as CanvasRenderingContext2D;

		rendererHarness.layoutCache = {
			stageSize: { width: 1280, height: 720 },
			frameRect: { x: 0, y: 0, width: 1280, height: 720 },
			videoSize: { width: 1920, height: 1080 },
			baseScale: 1,
			baseOffset: { x: 0, y: 0 },
			maskRect: { x: 10, y: 20, width: 300, height: 200 },
		};
		rendererHarness.animationState = {
			scale: 1.25,
			appliedScale: 1.25,
			focusX: 0.5,
			focusY: 0.5,
			focusVelocityX: 0,
			focusVelocityY: 0,
			smoothTimeFactor: 1,
			progress: 1,
			x: 32,
			y: 18,
			lastUpdateMs: 0,
			lastPlaybackTimeMs: 0,
		};
		rendererHarness.compositeCanvas = { width: 1280, height: 720 };
		rendererHarness.compositeCtx = compositeCtx;
		rendererHarness.app = { canvas: videoCanvas };
		rendererHarness.backgroundCanvas = backgroundCanvas;
		rendererHarness.shadowCanvas = shadowCanvas;
		rendererHarness.shadowCtx = shadowCtx;

		const drawFrameBorderSpy = vi
			.spyOn(rendererHarness, "drawFrameBorder")
			.mockImplementation(() => drawOrder.push("border"));

		rendererHarness.compositeWithShadows();

		expect(drawOrder).toEqual([
			"clear",
			"background",
			"border",
			"shadow-clear",
			"shadow-save",
			"shadow-filter",
			"shadow-video",
			"shadow-restore",
			"shadow-composite",
		]);
		drawFrameBorderSpy.mockRestore();
	});
});
