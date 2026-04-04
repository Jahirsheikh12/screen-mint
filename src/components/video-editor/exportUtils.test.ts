import { describe, expect, it } from "vitest";
import {
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
	resolveGifExportPlan,
	resolveVideoExportPlan,
} from "@/lib/exporter";
import {
	buildSourceVideoMetadata,
	getExportDialogPhaseState,
	mergeGifExportDetails,
	mergeVideoExportDetails,
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
			},
			4_000_000,
		);

		expect(details.codecLabel).toBe("H.264 Main");
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
});
