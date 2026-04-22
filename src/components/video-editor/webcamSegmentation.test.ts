import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	refineSegmentationConfidenceMask,
	remapConfidenceMask,
	scaleDimensionsToMaxEdge,
	shouldResetSegmentationSession,
} from "./webcamSegmentation";

describe("webcamSegmentation", () => {
	it("remaps confidence into alpha using soft thresholds", () => {
		const alpha = remapConfidenceMask(new Float32Array([0, 0.08, 0.5, 0.92, 1]), 0.08, 0.92);

		expect(alpha[0]).toBe(0);
		expect(alpha[1]).toBe(0);
		expect(alpha[2]).toBeGreaterThan(100);
		expect(alpha[3]).toBe(255);
		expect(alpha[4]).toBe(255);
	});

	it("fills small holes and removes isolated speckle noise", () => {
		const width = 7;
		const height = 7;
		const confidence = new Float32Array(width * height).fill(0.01);

		for (let y = 2; y <= 4; y += 1) {
			for (let x = 2; x <= 4; x += 1) {
				confidence[y * width + x] = 0.98;
			}
		}
		confidence[3 * width + 3] = 0.02;
		confidence[0] = 0.98;

		const refined = refineSegmentationConfidenceMask({
			confidence,
			width,
			height,
		});

		expect(refined.rawAlpha[0]).toBe(255);
		expect(refined.refinedAlpha[0]).toBeLessThan(64);
		expect(refined.refinedAlpha[3 * width + 3]).toBeGreaterThan(180);
	});

	it("applies temporal smoothing against the previous matte", () => {
		const confidence = new Float32Array([1, 1, 1, 1]);
		const previousAlpha = new Uint8ClampedArray([0, 64, 128, 255]);

		const refined = refineSegmentationConfidenceMask({
			confidence,
			width: 2,
			height: 2,
			previousAlpha,
			options: {
				temporalSmoothing: 0.5,
			},
		});

		expect(refined.quality.temporalWeight).toBeLessThanOrEqual(1);
		expect(refined.refinedAlpha[0]).toBeGreaterThan(previousAlpha[0]);
		expect(refined.refinedAlpha[3]).toBeLessThanOrEqual(255);
		expect(refined.refinedAlpha[3]).toBeGreaterThan(200);
	});

	it("downscales segmentation input to a bounded working resolution", () => {
		expect(scaleDimensionsToMaxEdge(1920, 1080, 320)).toEqual({
			width: 320,
			height: 180,
		});
		expect(scaleDimensionsToMaxEdge(1080, 1920, 256)).toEqual({
			width: 144,
			height: 256,
		});
	});

	it("resets the segmentation session when the editor timeline moves backwards", () => {
		expect(shouldResetSegmentationSession(null, 100)).toBe(false);
		expect(shouldResetSegmentationSession(100, 120)).toBe(false);
		expect(shouldResetSegmentationSession(120, 120)).toBe(true);
		expect(shouldResetSegmentationSession(120, 80)).toBe(true);
	});

	it("resets the segmentation session across large seek jumps", () => {
		expect(shouldResetSegmentationSession(100, 580)).toBe(false);
		expect(shouldResetSegmentationSession(100, 601)).toBe(true);
		expect(shouldResetSegmentationSession(100, Number.NaN)).toBe(true);
	});
});

describe("webcamSegmentation provider lifecycle", () => {
	const originalGlobals = {
		HTMLCanvasElement: globalThis.HTMLCanvasElement,
		HTMLImageElement: globalThis.HTMLImageElement,
		HTMLVideoElement: globalThis.HTMLVideoElement,
		ImageBitmap: globalThis.ImageBitmap,
		VideoFrame: globalThis.VideoFrame,
	};
	const noop = () => {
		// Intentionally empty for the mock 2D context.
	};

	class MockCanvasElement {
		width: number;
		height: number;

		constructor(width = 0, height = 0) {
			this.width = width;
			this.height = height;
		}

		getContext() {
			return {
				clearRect: noop,
				createImageData: (width: number, height: number) => ({
					width,
					height,
					data: new Uint8ClampedArray(width * height * 4),
				}),
				putImageData: noop,
				drawImage: noop,
				imageSmoothingEnabled: true,
				setTransform: noop,
			};
		}
	}

	beforeEach(() => {
		vi.resetModules();
		globalThis.HTMLCanvasElement = MockCanvasElement as typeof HTMLCanvasElement;
		globalThis.HTMLImageElement = class {} as typeof HTMLImageElement;
		globalThis.HTMLVideoElement = class {} as typeof HTMLVideoElement;
		globalThis.ImageBitmap = class {} as typeof ImageBitmap;
		globalThis.VideoFrame = class {} as typeof VideoFrame;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.HTMLCanvasElement = originalGlobals.HTMLCanvasElement;
		globalThis.HTMLImageElement = originalGlobals.HTMLImageElement;
		globalThis.HTMLVideoElement = originalGlobals.HTMLVideoElement;
		globalThis.ImageBitmap = originalGlobals.ImageBitmap;
		globalThis.VideoFrame = originalGlobals.VideoFrame;
	});

	it("recreates the MediaPipe segmenter after a backwards seek", async () => {
		const segmenterInstances: Array<{
			close: ReturnType<typeof vi.fn>;
			segmentForVideo: ReturnType<typeof vi.fn>;
		}> = [];
		const createFromOptions = vi.fn(async () => {
			const instance = {
				close: vi.fn(),
				segmentForVideo: vi.fn(() => ({
					confidenceMasks: [
						{
							hasFloat32Array: () => true,
							getAsFloat32Array: () => new Float32Array(16).fill(0.9),
							hasUint8Array: () => false,
							getAsUint8Array: () => new Uint8Array(),
						},
					],
					close: vi.fn(),
				})),
			};
			segmenterInstances.push(instance);
			return instance;
		});

		vi.doMock("@/lib/assetPath", () => ({
			getAssetPath: vi.fn(async (assetPath: string) => `file:///mock-assets/${assetPath}`),
		}));
		vi.doMock("@mediapipe/tasks-vision", () => ({
			FilesetResolver: {
				forVisionTasks: vi.fn(async () => ({ kind: "wasm-fileset" })),
			},
			ImageSegmenter: {
				createFromOptions,
			},
		}));

		const { createWebcamSegmentationProvider } = await import("./webcamSegmentation");
		const provider = await createWebcamSegmentationProvider();
		const source = new MockCanvasElement(1280, 720) as unknown as TexImageSource;

		await provider?.segment(source, 100, { refinementMode: "none" });
		await provider?.segment(source, 40, { refinementMode: "none" });

		expect(createFromOptions).toHaveBeenCalledTimes(2);
		expect(segmenterInstances).toHaveLength(2);
		expect(segmenterInstances[0]?.close).toHaveBeenCalledTimes(1);
		expect(segmenterInstances[0]?.segmentForVideo).toHaveBeenCalledWith(expect.anything(), 100);
		expect(segmenterInstances[1]?.segmentForVideo).toHaveBeenCalledWith(expect.anything(), 40);

		provider?.close();
		expect(segmenterInstances[1]?.close).toHaveBeenCalledTimes(1);
	});
});
