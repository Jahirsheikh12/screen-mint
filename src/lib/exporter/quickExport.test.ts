import { describe, expect, it } from "vitest";
import {
	getDefaultGifExportSettings,
	resolveGifExportPlan,
	resolveVideoExportPlan,
} from "./planner";
import {
	normalizeQuickGifSettings,
	normalizeQuickVideoSettings,
	resolveQuickBaseDimensions,
	resolveQuickVideoBitrate,
	resolveQuickVideoDimensions,
	toGifExportSettings,
	toVideoExportSettings,
} from "./quickExport";

const source = { width: 2880, height: 1800, frameRate: 60 };

describe("quick export dimensions", () => {
	it("keeps the source frame for its own aspect ratio and scales per quality", () => {
		const base = resolveQuickBaseDimensions(2880, 1800, 2880 / 1800);
		expect(base).toEqual({ width: 2880, height: 1800 });
		expect(resolveQuickVideoDimensions(base, "low")).toEqual({ width: 1728, height: 1080 });
		expect(resolveQuickVideoDimensions(base, "medium")).toEqual({ width: 2160, height: 1350 });
		expect(resolveQuickVideoDimensions(base, "high")).toEqual({ width: 2592, height: 1620 });
		expect(resolveQuickVideoDimensions(base, "original")).toEqual(base);
	});

	it("fits other aspect ratios inside the source's long and short sides", () => {
		expect(resolveQuickBaseDimensions(1920, 1080, 9 / 16)).toEqual({ width: 1080, height: 1920 });
		expect(resolveQuickBaseDimensions(1920, 1080, 1)).toEqual({ width: 1080, height: 1080 });
		expect(resolveQuickBaseDimensions(1920, 1200, 16 / 9)).toEqual({ width: 1920, height: 1080 });
	});

	it("always produces even dimensions", () => {
		const { width, height } = resolveQuickVideoDimensions({ width: 1366, height: 768 }, "high");
		expect(width % 2).toBe(0);
		expect(height % 2).toBe(0);
	});
});

describe("quick export bitrate", () => {
	const at = (
		w: number,
		h: number,
		quality: "low" | "original",
		encoding = "quality" as const,
		frameRate = 30 as const,
	) => resolveQuickVideoBitrate(w, h, { quality, encoding, frameRate });

	it("uses the pixel-count table", () => {
		expect(at(1280, 720, "low")).toBe(5_000_000);
		expect(at(1920, 1080, "low")).toBe(8_000_000);
		expect(at(3840, 2160, "low")).toBe(35_000_000);
		expect(at(1280, 720, "original")).toBe(8_000_000);
		expect(at(1920, 1080, "original")).toBe(12_000_000);
		expect(at(3840, 2160, "original")).toBe(45_000_000);
	});

	it("scales for encoding mode and only for frame rates above 30", () => {
		const q = (encoding: "fast" | "balanced" | "quality", frameRate: 24 | 30 | 60) =>
			resolveQuickVideoBitrate(1920, 1080, { quality: "low", encoding, frameRate });
		expect(q("fast", 30)).toBe(4_000_000);
		expect(q("balanced", 30)).toBe(6_400_000);
		expect(q("quality", 24)).toBe(8_000_000);
		expect(q("quality", 60)).toBe(Math.round(8_000_000 * Math.SQRT2));
	});

	it("puts frames below 720p in the 720p tier", () => {
		expect(
			resolveQuickVideoBitrate(320, 240, { quality: "low", encoding: "fast", frameRate: 24 }),
		).toBe(2_500_000);
	});
});

describe("planner integration", () => {
	it("resolves the quick settings into the plan the exporters use", () => {
		const plan = resolveVideoExportPlan(
			source,
			toVideoExportSettings({ quality: "low", encoding: "balanced", frameRate: 24 }),
			16 / 10,
		);
		expect(plan).toMatchObject({ width: 1728, height: 1080, frameRate: 24 });
		expect(plan.bitrate).toBe(6_400_000);
		expect(plan.encoderCandidates).toHaveLength(1);
	});

	it("caps GIF height without upscaling small sources", () => {
		const balanced = getDefaultGifExportSettings();
		const medium = toGifExportSettings(
			{ frameRate: 15, size: "medium", loop: true },
			1800,
			balanced,
		);
		expect(resolveGifExportPlan(source, medium, 16 / 10).height).toBe(720);
		const small = toGifExportSettings({ frameRate: 20, size: "large", loop: false }, 600, balanced);
		const smallPlan = resolveGifExportPlan(
			{ width: 960, height: 600, frameRate: 30 },
			small,
			16 / 10,
		);
		expect(smallPlan).toMatchObject({ height: 600, frameRate: 20, loop: false });
	});
});

describe("normalize", () => {
	it("falls back to defaults for unknown values", () => {
		expect(
			normalizeQuickVideoSettings({ quality: "ultra", encoding: "fast", frameRate: 25 }),
		).toEqual({
			quality: "original",
			encoding: "fast",
			frameRate: 30,
		});
		expect(normalizeQuickGifSettings(null)).toEqual({ frameRate: 15, size: "medium", loop: true });
	});
});
