import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	frameRendererConstructor: vi.fn(),
	frameRendererInitialize: vi.fn(),
	streamingDecoderLoadMetadata: vi.fn(),
}));

vi.mock("./frameRenderer", () => ({
	FrameRenderer: mocks.frameRendererConstructor.mockImplementation(
		function MockFrameRenderer(this: {
			initialize: typeof mocks.frameRendererInitialize;
			cleanup: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
		}) {
			this.initialize = mocks.frameRendererInitialize;
			this.cleanup = vi.fn();
			this.destroy = vi.fn();
		},
	),
}));

vi.mock("./streamingDecoder", () => ({
	StreamingVideoDecoder: vi.fn().mockImplementation(function MockStreamingVideoDecoder(this: {
		loadMetadata: typeof mocks.streamingDecoderLoadMetadata;
		destroy: ReturnType<typeof vi.fn>;
	}) {
		this.loadMetadata = mocks.streamingDecoderLoadMetadata;
		this.destroy = vi.fn();
	}),
}));

import { GifExporter } from "./gifExporter";
import { VideoExporter } from "./videoExporter";

describe("VideoExporter cursor config", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {
			// Silence expected exporter setup errors in this unit test.
		});
		vi.stubGlobal("VideoEncoder", {
			isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
		});
		mocks.streamingDecoderLoadMetadata.mockResolvedValue({
			width: 1920,
			height: 1080,
			duration: 2,
			hasAudio: false,
		});
		mocks.frameRendererInitialize.mockRejectedValue(new Error("stop after frame renderer setup"));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("passes cursor v2 settings through to FrameRenderer", async () => {
		const exporter = new VideoExporter({
			videoUrl: "file:///tmp/demo.mp4",
			width: 1280,
			height: 720,
			frameRate: 30,
			bitrate: 8_000_000,
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			showCursor: true,
			cursorStyle: "ring",
			cursorColor: "#22c55e",
			cursorOpacity: 0.72,
			clickEffectsEnabled: true,
			clickHighlightColor: "#ef4444",
			clickHighlightSize: 1.8,
			clickHighlightOpacity: 0.66,
			cursorTrailLength: 8,
			cursorTrailOpacity: 0.41,
			cursorTypeMode: "circle",
			cursorTilt: 0.66,
			hideWhenIdle: true,
			idleHideDelayMs: 2100,
			smoothMovementEnabled: true,
			cursorMovementStyle: "custom",
			cursorSpring: {
				tension: 590,
				friction: 41,
				mass: 0.71,
			},
			highQualitySvgCursors: false,
		});

		const result = await exporter.export();

		expect(result.success).toBe(false);
		expect(mocks.frameRendererConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				showCursor: true,
				cursorStyle: "ring",
				cursorColor: "#22c55e",
				cursorOpacity: 0.72,
				clickEffectsEnabled: true,
				clickHighlightColor: "#ef4444",
				clickHighlightSize: 1.8,
				clickHighlightOpacity: 0.66,
				cursorTrailLength: 8,
				cursorTrailOpacity: 0.41,
				cursorTypeMode: "circle",
				cursorTilt: 0.66,
				hideWhenIdle: true,
				idleHideDelayMs: 2100,
				smoothMovementEnabled: true,
				cursorMovementStyle: "custom",
				cursorSpring: {
					tension: 590,
					friction: 41,
					mass: 0.71,
				},
				highQualitySvgCursors: false,
			}),
		);
	});

	it("passes cursor v2 settings through to FrameRenderer for GIF exports", async () => {
		const exporter = new GifExporter({
			videoUrl: "file:///tmp/demo.mp4",
			width: 640,
			height: 360,
			frameRate: 12,
			loop: true,
			preset: "balanced",
			dedupeFrames: true,
			colorCount: 128,
			ditherMode: "bayer",
			motionSensitivity: "balanced",
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			showCursor: true,
			cursorStyle: "ring",
			cursorColor: "#22c55e",
			cursorOpacity: 0.72,
			clickEffectsEnabled: true,
			clickHighlightColor: "#ef4444",
			clickHighlightSize: 1.8,
			clickHighlightOpacity: 0.66,
			cursorTrailLength: 8,
			cursorTrailOpacity: 0.41,
			cursorTypeMode: "circle",
			cursorTilt: 0.66,
			hideWhenIdle: true,
			idleHideDelayMs: 2100,
			smoothMovementEnabled: true,
			cursorMovementStyle: "custom",
			cursorSpring: {
				tension: 590,
				friction: 41,
				mass: 0.71,
			},
			highQualitySvgCursors: false,
		});

		const result = await exporter.export();

		expect(result.success).toBe(false);
		expect(mocks.frameRendererConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				showCursor: true,
				cursorStyle: "ring",
				cursorColor: "#22c55e",
				cursorOpacity: 0.72,
				clickEffectsEnabled: true,
				clickHighlightColor: "#ef4444",
				clickHighlightSize: 1.8,
				clickHighlightOpacity: 0.66,
				cursorTrailLength: 8,
				cursorTrailOpacity: 0.41,
				cursorTypeMode: "circle",
				cursorTilt: 0.66,
				hideWhenIdle: true,
				idleHideDelayMs: 2100,
				smoothMovementEnabled: true,
				cursorMovementStyle: "custom",
				cursorSpring: {
					tension: 590,
					friction: 41,
					mass: 0.71,
				},
				highQualitySvgCursors: false,
			}),
		);
	});

	it("caches duplicate encoder support probes within one export attempt", async () => {
		const isConfigSupported = vi.fn().mockResolvedValue({ supported: false });
		vi.stubGlobal("VideoEncoder", {
			isConfigSupported,
		});

		const exporter = new VideoExporter({
			videoUrl: "file:///tmp/demo.mp4",
			width: 1280,
			height: 720,
			frameRate: 30,
			bitrate: 8_000_000,
			codecCandidates: ["avc1.4d401f"],
			encoderCandidates: [
				{
					width: 1280,
					height: 720,
					frameRate: 30,
					bitrate: 8_000_000,
					codecCandidates: ["avc1.4d401f"],
					fallbackSteps: [],
				},
				{
					width: 1280,
					height: 720,
					frameRate: 30,
					bitrate: 8_000_000,
					codecCandidates: ["avc1.4d401f"],
					fallbackSteps: ["duplicate"],
				},
			],
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		});

		const result = await exporter.export();

		expect(result.success).toBe(false);
		expect(isConfigSupported).toHaveBeenCalledTimes(2);
	});

	it("records when export falls back to software encoding", async () => {
		const isConfigSupported = vi.fn().mockImplementation((config: VideoEncoderConfig) =>
			Promise.resolve({
				supported: config.hardwareAcceleration === "prefer-software",
			}),
		);
		vi.stubGlobal("VideoEncoder", {
			isConfigSupported,
		});

		const exporter = new VideoExporter({
			videoUrl: "file:///tmp/demo.mp4",
			width: 1280,
			height: 720,
			frameRate: 30,
			bitrate: 8_000_000,
			codecCandidates: ["avc1.4d401f"],
			wallpaper: "#000000",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		});
		const resolveEncoderCandidate = (
			exporter as unknown as {
				resolveEncoderCandidate: () => Promise<{
					hardwareAcceleration: VideoEncoderConfig["hardwareAcceleration"];
					fallbackSteps: string[];
				}>;
			}
		).resolveEncoderCandidate.bind(exporter);

		const activeConfig = await resolveEncoderCandidate();

		expect(activeConfig.hardwareAcceleration).toBe("prefer-software");
		expect(activeConfig.fallbackSteps).toContain(
			"Used software encoding because hardware encoding was unavailable for the selected export settings.",
		);
		expect(isConfigSupported).toHaveBeenCalledTimes(2);
	});
});
