import { describe, expect, it } from "vitest";
import {
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
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

	it("records preset-driven fallback notes", () => {
		const plan = resolveVideoExportPlan(
			source,
			{
				...getDefaultVideoExportSettings(),
				preset: "fast-share",
				frameRateMode: "60",
			},
			16 / 9,
		);

		expect(plan.fallbackApplied).toBe(true);
		expect(plan.fallbackSteps[0]).toContain("30 FPS");
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
});
