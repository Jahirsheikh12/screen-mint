import { describe, expect, it } from "vitest";
import {
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
	resolveGifExportPlan,
	resolveVideoExportPlan,
} from "@/lib/exporter";
import {
	buildSourceVideoMetadata,
	GIF_EXPORT_QUALITY_OPTIONS,
	getExportDialogPhaseState,
	getSelectedGifQuality,
	getSelectedVideoQuality,
	mergeGifExportDetails,
	mergeVideoExportDetails,
	selectGifQualitySettings,
	selectVideoQualitySettings,
	VIDEO_EXPORT_QUALITY_OPTIONS,
} from "./exportUtils";

describe("exportUtils", () => {
	it("builds source metadata using the real source frame rate", () => {
		expect(
			buildSourceVideoMetadata({
				width: 1920,
				height: 1080,
				frameRate: 25,
				durationMs: 8_000,
			}),
		).toEqual({
			width: 1920,
			height: 1080,
			frameRate: 25,
			durationMs: 8_000,
		});
	});

	it("merges GIF completion details with planner warnings and advanced settings", () => {
		const source = buildSourceVideoMetadata({
			width: 2560,
			height: 1440,
			frameRate: 30,
			durationMs: 20_000,
		});
		const plan = resolveGifExportPlan(
			source,
			{
				...getDefaultGifExportSettings(),
				mode: "custom",
				resolutionMode: "source",
				frameRate: 24,
				colorCount: 256,
				ditherMode: "floyd-steinberg",
				motionSensitivity: "high",
			},
			16 / 9,
			20_000,
		);

		const details = mergeGifExportDetails(
			plan,
			{
				format: "gif",
				width: plan.width,
				height: plan.height,
				frameRate: plan.frameRate,
				fileSizeBytes: 9_000_000,
				warnings: ["Runtime warning"],
			},
			9_000_000,
		);

		expect(details.colorCount).toBe(256);
		expect(details.ditherMode).toBe("floyd-steinberg");
		expect(details.motionSensitivity).toBe("high");
		expect(details.estimatedSizeBytes).toBe(plan.estimatedSizeBytes);
		expect(details.warnings).toEqual(expect.arrayContaining(plan.warnings));
		expect(details.warnings).toEqual(expect.arrayContaining(["Runtime warning"]));
	});

	it("merges video completion details with planner fallback context", () => {
		const plan = resolveVideoExportPlan(
			buildSourceVideoMetadata({
				width: 3840,
				height: 2160,
				frameRate: 50,
				durationMs: 12_000,
			}),
			{
				...getDefaultVideoExportSettings(),
				preset: "fast-share",
				frameRateMode: "60",
			},
			16 / 9,
		);

		const details = mergeVideoExportDetails(
			plan,
			{
				format: "mp4",
				width: plan.width,
				height: plan.height,
				frameRate: plan.frameRate,
				bitrate: plan.bitrate,
				codec: plan.codec,
				codecLabel: "H.264 Main",
				fileSizeBytes: 4_000_000,
				engine: "direct-native",
				encoder: "h264_videotoolbox",
				hardwareAcceleration: "hardware",
				nativeComposedFallbackReason: "Cursor overlays require the renderer path.",
				nativeComposedFeatures: ["crop", "native-filtergraph"],
				benchmarkThroughputFps: 128,
			},
			4_000_000,
		);

		expect(details.codecLabel).toBe("H.264 Main");
		expect(details.engine).toBe("direct-native");
		expect(details.encoder).toBe("h264_videotoolbox");
		expect(details.hardwareAcceleration).toBe("hardware");
		expect(details.nativeComposedFallbackReason).toBe("Cursor overlays require the renderer path.");
		expect(details.nativeComposedFeatures).toEqual(["crop", "native-filtergraph"]);
		expect(details.benchmarkThroughputFps).toBe(128);
		expect(details.fallbackSteps).toEqual(plan.fallbackSteps);
		expect(details.warnings).toEqual(plan.warnings);
	});

	it("distinguishes MP4 finalizing from GIF compiling", () => {
		expect(
			getExportDialogPhaseState({
				isExporting: true,
				exportFormat: "mp4",
				progress: {
					currentFrame: 10,
					totalFrames: 10,
					percentage: 100,
					estimatedTimeRemaining: 0,
					phase: "finalizing",
				},
			}),
		).toEqual({
			isGifCompiling: false,
			isVideoFinalizing: true,
		});

		expect(
			getExportDialogPhaseState({
				isExporting: true,
				exportFormat: "gif",
				progress: {
					currentFrame: 10,
					totalFrames: 10,
					percentage: 100,
					estimatedTimeRemaining: 0,
					phase: "finalizing",
				},
			}),
		).toEqual({
			isGifCompiling: true,
			isVideoFinalizing: false,
		});
	});

	it("resets video preset controls when selecting a quality pill", () => {
		const customSettings = {
			...getDefaultVideoExportSettings(),
			mode: "custom" as const,
			resolutionMode: "2160p" as const,
			frameRateMode: "60" as const,
			bitrateMode: "bpp" as const,
			bitsPerPixel: 0.45,
			forceFFmpegDecoder: true,
		};

		expect(getSelectedVideoQuality(customSettings)).toBeNull();

		const selected = selectVideoQualitySettings(customSettings, "web");
		expect(selected).toMatchObject({
			mode: "preset",
			preset: "balanced",
			resolutionMode: "1080p",
			frameRateMode: "30",
			bitrateMode: "auto",
			forceFFmpegDecoder: true,
		});
		expect(getSelectedVideoQuality(selected)).toBe("web");
	});

	it("keeps GIF quality pills unique and hides unsupported duplicate maximum", () => {
		expect(GIF_EXPORT_QUALITY_OPTIONS).toEqual(["potato", "web", "social"]);
		expect(VIDEO_EXPORT_QUALITY_OPTIONS).toEqual(["potato", "web", "social", "maximum"]);

		const customSettings = {
			...getDefaultGifExportSettings(),
			mode: "custom" as const,
			resolutionMode: "1080p" as const,
			frameRate: 30 as const,
		};
		expect(getSelectedGifQuality(customSettings)).toBeNull();

		const selected = selectGifQualitySettings("social");
		expect(selected).toMatchObject({
			mode: "preset",
			preset: "quality",
			resolutionMode: "1080p",
			frameRate: 20,
		});
		expect(getSelectedGifQuality(selected)).toBe("social");
	});
});
