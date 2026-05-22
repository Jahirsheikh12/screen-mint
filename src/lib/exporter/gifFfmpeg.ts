import type { GifColorCount, GifDitherMode, GifMotionSensitivity } from "./types";

export interface GifFfmpegSettings {
	colorCount: GifColorCount;
	ditherMode: GifDitherMode;
	motionSensitivity: GifMotionSensitivity;
	loop: boolean;
	dedupeFrames: boolean;
}

export interface GifPaletteFilterOptions {
	width?: number;
	height?: number;
	frameRate?: number;
	trimSelectExpression?: string | null;
	settings: GifFfmpegSettings;
	rawInput?: boolean;
}

export interface GifRawPipeFfmpegArgsOptions {
	width: number;
	height: number;
	frameRate: number;
	outputPath: string;
	settings: GifFfmpegSettings;
}

export function resolveGifFfmpegLoop(loop: boolean): string {
	return loop ? "0" : "-1";
}

export function resolveGifFfmpegDither(ditherMode: GifDitherMode): string {
	switch (ditherMode) {
		case "floyd-steinberg":
			return "floyd_steinberg";
		case "off":
			return "none";
		case "bayer":
		default:
			return "bayer:bayer_scale=3";
	}
}

export function resolveGifMpdecimateFilter(
	dedupeFrames: boolean,
	motionSensitivity: GifMotionSensitivity,
): string | null {
	if (!dedupeFrames) {
		return null;
	}

	switch (motionSensitivity) {
		case "low":
			return "mpdecimate=hi=64*24:lo=64*12:frac=0.5";
		case "high":
			return "mpdecimate=hi=64*8:lo=64*3:frac=0.2";
		case "balanced":
		default:
			return "mpdecimate";
	}
}

export function buildGifPaletteFilter({
	width,
	height,
	frameRate,
	trimSelectExpression,
	settings,
	rawInput = false,
}: GifPaletteFilterOptions): string {
	const baseFilters: string[] = [];
	if (trimSelectExpression) {
		baseFilters.push(`select='${trimSelectExpression}',setpts=N/FRAME_RATE/TB`);
	}
	if (!rawInput && frameRate) {
		baseFilters.push(`fps=${frameRate}`);
	}
	if (!rawInput && width && height) {
		baseFilters.push(`scale=${width}:${height}:flags=lanczos`);
	}
	if (rawInput) {
		baseFilters.push("format=rgba");
	}

	const dedupeFilter = resolveGifMpdecimateFilter(
		settings.dedupeFrames,
		settings.motionSensitivity,
	);
	if (dedupeFilter) {
		baseFilters.push(dedupeFilter);
	}

	const sourceFilter = baseFilters.length > 0 ? `${baseFilters.join(",")},` : "";
	const dither = resolveGifFfmpegDither(settings.ditherMode);

	return `${sourceFilter}split[s0][s1];[s0]palettegen=max_colors=${settings.colorCount}:stats_mode=full[p];[s1][p]paletteuse=dither=${dither}[gif]`;
}

export function buildGifRawPipeFfmpegArgs({
	width,
	height,
	frameRate,
	outputPath,
	settings,
}: GifRawPipeFfmpegArgsOptions): string[] {
	return [
		"-y",
		"-hide_banner",
		"-nostats",
		"-progress",
		"pipe:2",
		"-f",
		"rawvideo",
		"-pix_fmt",
		"rgba",
		"-s",
		`${width}x${height}`,
		"-framerate",
		String(frameRate),
		"-i",
		"pipe:0",
		"-filter_complex",
		buildGifPaletteFilter({ rawInput: true, settings }),
		"-map",
		"[gif]",
		"-an",
		"-loop",
		resolveGifFfmpegLoop(settings.loop),
		"-f",
		"gif",
		outputPath,
	];
}
