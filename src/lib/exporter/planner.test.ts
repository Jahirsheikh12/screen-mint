import { describe, expect, it } from "vitest";
import {
	getGifExportSettingsForPreset,
	getCodecLabel,
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
	getVideoExportSettingsForPreset,
	mapLegacyExportQualityToVideoSettings,
	resolveGifExportPlan,
	resolveVideoExportPlan,
} from "./planner";

describe("export planner", () => {
	const source = {
		width: 3840,
		height: 2160,
		frameRate: 59.94,
		durationMs: 20_000,
	};

	it("maps legacy video quality to preset-first advanced settings", () => {
		expect(mapLegacyExportQualityToVideoSettings("medium")).toMatchObject({
			mode: "preset",
			preset: "fast-share",
			resolutionMode: "720p",
			frameRateMode: "30",
			bitrateMode: "auto",
		});
		expect(mapLegacyExportQualityToVideoSettings("source")).toMatchObject({
			mode: "preset",
			preset: "master",
			resolutionMode: "source",
			frameRateMode: "source",
			bitrateMode: "archive",
			optimizeForWeb: false,
		});
	});

	it("builds preset video plans with resolved dimensions and fps", () => {
		const plan = resolveVideoExportPlan(source, getDefaultVideoExportSettings(), 16 / 9);

		expect(plan.mode).toBe("preset");
		expect(plan.resolutionMode).toBe("1080p");
		expect(plan.width).toBe(1920);
		expect(plan.height).toBe(1080);
		expect(plan.frameRate).toBe(60);
		expect(plan.encoderCandidates[0]).toMatchObject({
			width: 1920,
			height: 1080,
			frameRate: 60,
		});
	});

	it("builds custom video plans with explicit resolution, fps, and bitrate", () => {
		const plan = resolveVideoExportPlan(
			source,
			{
				...getDefaultVideoExportSettings(),
				mode: "custom",
				resolutionMode: "2160p",
				frameRateMode: "48",
				bitrateMode: "custom",
				customBitrateMbps: 32,
			},
			16 / 9,
		);

		expect(plan.width).toBe(3840);
		expect(plan.height).toBe(2160);
		expect(plan.frameRate).toBe(48);
		expect(plan.bitrate).toBe(32_000_000);
		expect(plan.encoderCandidates.some((candidate) => candidate.frameRate === 30)).toBe(true);
		expect(plan.encoderCandidates.some((candidate) => candidate.height === 1440)).toBe(true);
	});

	it("preserves source-driven frame rates across common input FPS values", () => {
		for (const frameRate of [24, 25, 30, 50, 60]) {
			const plan = resolveVideoExportPlan(
				{
					...source,
					frameRate,
				},
				{
					...getDefaultVideoExportSettings(),
					mode: "custom",
					frameRateMode: "source",
				},
				16 / 9,
			);

			expect(plan.frameRate).toBe(frameRate);
		}
	});

	it("uses the higher-quality codec ladder for custom exports when web optimization is off", () => {
		const plan = resolveVideoExportPlan(
			source,
			{
				...getDefaultVideoExportSettings(),
				mode: "custom",
				optimizeForWeb: false,
			},
			16 / 9,
		);

		expect(plan.codecCandidates[0]).toBe("avc1.640033");
		expect(plan.codecLabel).toBe("H.264 High");
	});

	it("uses preset defaults instead of stale video overrides", () => {
		const plan = resolveVideoExportPlan(
			source,
			{
				...getDefaultVideoExportSettings(),
				preset: "fast-share",
				frameRateMode: "60",
			},
			16 / 9,
		);

		expect(plan.frameRateMode).toBe("30");
		expect(plan.frameRate).toBe(30);
		expect(plan.fallbackApplied).toBe(false);
	});

	it("ignores stale custom video controls after switching back to a preset", () => {
		const plan = resolveVideoExportPlan(
			source,
			{
				...getVideoExportSettingsForPreset("balanced"),
				frameRateMode: "24",
				bitrateMode: "custom",
				customBitrateMbps: 48,
			},
			16 / 9,
		);

		expect(plan.mode).toBe("preset");
		expect(plan.frameRateMode).toBe("auto");
		expect(plan.frameRate).toBe(60);
		expect(plan.bitrateMode).toBe("auto");
	});

	it("builds preset gif plans with warnings for long heavy exports", () => {
		const plan = resolveGifExportPlan(
			source,
			getDefaultGifExportSettings(),
			16 / 9,
			source.durationMs,
		);

		expect(plan.mode).toBe("preset");
		expect(plan.resolutionMode).toBe("720p");
		expect(plan.width).toBe(1280);
		expect(plan.height).toBe(720);
		expect(plan.colorCount).toBe(128);
		expect(plan.ditherMode).toBe("bayer");
		expect(plan.warnings.length).toBeGreaterThan(0);
	});

	it("ignores stale custom GIF controls after switching back to a preset", () => {
		const plan = resolveGifExportPlan(
			source,
			{
				...getGifExportSettingsForPreset("balanced"),
				frameRate: 30,
				dedupeFrames: false,
				colorCount: 256,
				ditherMode: "floyd-steinberg",
				motionSensitivity: "high",
			},
			16 / 9,
			source.durationMs,
		);

		expect(plan.mode).toBe("preset");
		expect(plan.frameRate).toBe(15);
		expect(plan.dedupeFrames).toBe(true);
		expect(plan.colorCount).toBe(128);
		expect(plan.ditherMode).toBe("bayer");
		expect(plan.motionSensitivity).toBe("balanced");
	});

	it("builds custom gif plans with explicit quality controls", () => {
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
			source.durationMs,
		);

		expect(plan.width).toBe(3840);
		expect(plan.height).toBe(2160);
		expect(plan.frameRate).toBe(24);
		expect(plan.colorCount).toBe(256);
		expect(plan.ditherMode).toBe("floyd-steinberg");
		expect(plan.motionSensitivity).toBe("high");
		expect(plan.warnings.some((warning) => warning.includes("1080p"))).toBe(true);
	});

	it("maps codec identifiers to human-readable labels", () => {
		expect(getCodecLabel("avc1.640033")).toBe("H.264 High");
		expect(getCodecLabel("avc1.4d401f")).toBe("H.264 Main");
		expect(getCodecLabel("avc1.42001f")).toBe("H.264 Baseline");
	});
});
