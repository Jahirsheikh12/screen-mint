import type { GifExportConfig, GifResolutionMode, VideoExportSettings } from "./types";

/** Settings shown in the editor's Export menu. The Advanced dialog keeps the full model. */
export type QuickVideoQuality = "low" | "medium" | "high" | "original";
export type QuickEncodingMode = "fast" | "balanced" | "quality";
export type QuickVideoFrameRate = 24 | 30 | 60;
export type QuickGifFrameRate = 15 | 20 | 25 | 30;
export type QuickGifSize = "medium" | "large" | "original";

export interface QuickVideoSettings {
	quality: QuickVideoQuality;
	encoding: QuickEncodingMode;
	frameRate: QuickVideoFrameRate;
}

export interface QuickGifSettings {
	frameRate: QuickGifFrameRate;
	size: QuickGifSize;
	loop: boolean;
}

export const QUICK_VIDEO_QUALITIES: readonly QuickVideoQuality[] = [
	"low",
	"medium",
	"high",
	"original",
];
export const QUICK_ENCODING_MODES: readonly QuickEncodingMode[] = ["fast", "balanced", "quality"];
export const QUICK_VIDEO_FRAME_RATES: readonly QuickVideoFrameRate[] = [24, 30, 60];
export const QUICK_GIF_FRAME_RATES: readonly QuickGifFrameRate[] = [15, 20, 25, 30];
export const QUICK_GIF_SIZES: readonly QuickGifSize[] = ["medium", "large", "original"];

export const DEFAULT_QUICK_VIDEO_SETTINGS: QuickVideoSettings = {
	quality: "original",
	encoding: "balanced",
	frameRate: 30,
};
export const DEFAULT_QUICK_GIF_SETTINGS: QuickGifSettings = {
	frameRate: 15,
	size: "medium",
	loop: true,
};

const QUALITY_SCALE: Record<QuickVideoQuality, number> = {
	low: 0.6,
	medium: 0.75,
	high: 0.9,
	original: 1,
};
const ENCODING_BITRATE_FACTOR: Record<QuickEncodingMode, number> = {
	fast: 0.5,
	balanced: 0.8,
	quality: 1,
};
const KEYFRAME_INTERVAL_SECONDS: Record<QuickEncodingMode, number> = {
	fast: 4,
	balanced: 3,
	quality: 2.5,
};
const GIF_MAX_HEIGHT: Record<QuickGifSize, number> = {
	medium: 720,
	large: 1080,
	original: Number.POSITIVE_INFINITY,
};

const PIXELS_720P = 1280 * 720;
const PIXELS_1080P = 1920 * 1080;
const PIXELS_2160P = 3840 * 2160;
const MIN_BITRATE = 2_000_000;

function even(value: number): number {
	return Math.max(2, Math.floor(value / 2) * 2);
}

/** Largest frame of the target aspect ratio that fits the source's long and short sides. */
export function resolveQuickBaseDimensions(
	sourceWidth: number,
	sourceHeight: number,
	aspectRatioValue: number,
): { width: number; height: number } {
	const width = even(sourceWidth);
	const height = even(sourceHeight);
	const aspect =
		Number.isFinite(aspectRatioValue) && aspectRatioValue > 0 ? aspectRatioValue : 16 / 9;
	const longSide = Math.max(width, height);
	const shortSide = Math.min(width, height);
	const maxWidth = aspect >= 1 ? longSide : shortSide;
	const maxHeight = aspect >= 1 ? shortSide : longSide;
	if (maxWidth / maxHeight > aspect) {
		return { width: Math.min(even(maxHeight * aspect), maxWidth), height: maxHeight };
	}
	return { width: maxWidth, height: Math.min(even(maxWidth / aspect), maxHeight) };
}

export function resolveQuickVideoDimensions(
	base: { width: number; height: number },
	quality: QuickVideoQuality,
): { width: number; height: number } {
	const scale = QUALITY_SCALE[quality];
	return { width: even(base.width * scale), height: even(base.height * scale) };
}

function lerp(pixels: number, from: number, to: number, start: number, end: number): number {
	const t = Math.max(0, Math.min(1, (pixels - from) / (to - from)));
	return Math.round(start + (end - start) * t);
}

export function resolveQuickVideoBitrate(
	width: number,
	height: number,
	settings: QuickVideoSettings,
): number {
	const pixels = width * height;
	const original = settings.quality === "original";
	const base =
		pixels <= PIXELS_720P
			? original
				? 8_000_000
				: 5_000_000
			: pixels <= PIXELS_1080P
				? original
					? 12_000_000
					: 8_000_000
				: original
					? lerp(pixels, PIXELS_1080P, PIXELS_2160P, 12_000_000, 45_000_000)
					: lerp(pixels, PIXELS_1080P, PIXELS_2160P, 8_000_000, 35_000_000);
	// Only frame rates above 30 raise the bitrate.
	const fpsFactor = Math.sqrt(Math.max(1, settings.frameRate / 30));
	return Math.max(
		MIN_BITRATE,
		Math.round(base * fpsFactor * ENCODING_BITRATE_FACTOR[settings.encoding]),
	);
}

export function getQuickKeyframeIntervalSeconds(encoding: QuickEncodingMode): number {
	return KEYFRAME_INTERVAL_SECONDS[encoding];
}

/** Advanced-model settings that carry the quick choice; the planner honours `quick`. */
export function toVideoExportSettings(
	quick: QuickVideoSettings,
	previous?: Pick<VideoExportSettings, "forceFFmpegDecoder">,
): VideoExportSettings {
	return {
		mode: "custom",
		preset: "balanced",
		resolutionMode: "source",
		frameRateMode: quick.frameRate === 60 ? "60" : "30",
		bitrateMode: "auto",
		optimizeForWeb: true,
		forceFFmpegDecoder: previous?.forceFFmpegDecoder,
		quick,
	};
}

function resolveGifResolutionMode(size: QuickGifSize, baseHeight: number): GifResolutionMode {
	const cap = GIF_MAX_HEIGHT[size];
	if (baseHeight <= cap) return "source";
	return cap === 720 ? "720p" : "1080p";
}

export function resolveQuickGifHeight(size: QuickGifSize, baseHeight: number): number {
	return even(Math.min(baseHeight, GIF_MAX_HEIGHT[size]));
}

export function toGifExportSettings(
	quick: QuickGifSettings,
	baseHeight: number,
	balanced: GifExportConfig,
): GifExportConfig {
	return {
		...balanced,
		mode: "custom",
		resolutionMode: resolveGifResolutionMode(quick.size, baseHeight),
		frameRate: quick.frameRate,
		loop: quick.loop,
	};
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeQuickVideoSettings(raw: unknown): QuickVideoSettings {
	const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	return {
		quality: pick(value.quality, QUICK_VIDEO_QUALITIES, DEFAULT_QUICK_VIDEO_SETTINGS.quality),
		encoding: pick(value.encoding, QUICK_ENCODING_MODES, DEFAULT_QUICK_VIDEO_SETTINGS.encoding),
		frameRate: pick(
			value.frameRate,
			QUICK_VIDEO_FRAME_RATES,
			DEFAULT_QUICK_VIDEO_SETTINGS.frameRate,
		),
	};
}

export function normalizeQuickGifSettings(raw: unknown): QuickGifSettings {
	const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	return {
		frameRate: pick(value.frameRate, QUICK_GIF_FRAME_RATES, DEFAULT_QUICK_GIF_SETTINGS.frameRate),
		size: pick(value.size, QUICK_GIF_SIZES, DEFAULT_QUICK_GIF_SETTINGS.size),
		loop: typeof value.loop === "boolean" ? value.loop : DEFAULT_QUICK_GIF_SETTINGS.loop,
	};
}
