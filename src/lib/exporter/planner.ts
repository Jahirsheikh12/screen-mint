import type {
	ExportQuality,
	GifColorCount,
	GifDitherMode,
	GifExportConfig,
	GifExportPreset,
	GifFrameRate,
	GifMotionSensitivity,
	GifResolutionMode,
	GifSizePreset,
	VideoBitrateMode,
	VideoExportFrameRateMode,
	VideoExportPreset,
	VideoExportSettings,
	VideoResolutionMode,
} from "./types";

const SUPPORTED_VIDEO_FRAME_RATES = [30, 60] as const;
const HIGH_QUALITY_CODEC_CANDIDATES = [
	"avc1.640033",
	"avc1.4d4033",
	"avc1.420033",
	"avc1.4d401f",
	"avc1.42001f",
] as const;
const WEB_SAFE_CODEC_CANDIDATES = [
	"avc1.4d401f",
	"avc1.42001f",
	"avc1.4d4033",
	"avc1.420033",
] as const;
const VIDEO_RESOLUTION_HEIGHTS: Record<Exclude<VideoResolutionMode, "source">, number> = {
	"720p": 720,
	"1080p": 1080,
	"1440p": 1440,
	"2160p": 2160,
};
const GIF_RESOLUTION_HEIGHTS: Record<Exclude<GifResolutionMode, "source">, number> = {
	"480p": 480,
	"720p": 720,
	"1080p": 1080,
};
const PRESET_BITRATE_FLOORS: Record<VideoExportPreset, number> = {
	"fast-share": 8_000_000,
	balanced: 12_000_000,
	quality: 60_000_000,
	master: 120_000_000,
};
const PRESET_BITS_PER_PIXEL: Record<VideoExportPreset, number> = {
	"fast-share": 0.22,
	balanced: 0.2,
	quality: 0.24,
	master: 0.24,
};

export interface SourceVideoMetadata {
	width: number;
	height: number;
	frameRate: number;
	durationMs?: number;
}

export interface ResolvedVideoEncoderCandidate {
	width: number;
	height: number;
	frameRate: number;
	bitrate: number;
	codecCandidates: readonly string[];
	fallbackSteps: string[];
}

export interface ResolvedVideoExportPlan {
	width: number;
	height: number;
	frameRate: number;
	bitrate: number;
	codec: string;
	codecCandidates: readonly string[];
	codecLabel: string;
	preset: VideoExportPreset;
	mode: VideoExportSettings["mode"];
	resolutionMode: VideoResolutionMode;
	frameRateMode: VideoExportFrameRateMode;
	bitrateMode: VideoBitrateMode;
	optimizeForWeb: boolean;
	forceFFmpegDecoder: boolean;
	warnings: string[];
	fallbackApplied: boolean;
	fallbackReason?: string;
	fallbackSteps: string[];
	encoderCandidates: ResolvedVideoEncoderCandidate[];
}

export interface ResolvedGifExportPlan {
	width: number;
	height: number;
	frameRate: GifFrameRate;
	preset: GifExportPreset;
	mode: GifExportConfig["mode"];
	resolutionMode: GifResolutionMode;
	loop: boolean;
	dedupeFrames: boolean;
	colorCount: GifColorCount;
	ditherMode: GifDitherMode;
	motionSensitivity: GifMotionSensitivity;
	warnings: string[];
	estimatedSizeBytes: number;
}

export function getVideoExportSettingsForPreset(preset: VideoExportPreset): VideoExportSettings {
	switch (preset) {
		case "fast-share":
			return {
				mode: "preset",
				preset,
				resolutionMode: "720p",
				frameRateMode: "30",
				bitrateMode: "auto",
				optimizeForWeb: true,
			};
		case "quality":
			return {
				mode: "preset",
				preset,
				resolutionMode: "1440p",
				frameRateMode: "60",
				bitrateMode: "very-high",
				optimizeForWeb: true,
			};
		case "master":
			return {
				mode: "preset",
				preset,
				resolutionMode: "2160p",
				frameRateMode: "60",
				bitrateMode: "archive",
				optimizeForWeb: false,
			};
		case "balanced":
		default:
			return {
				mode: "preset",
				preset: "balanced",
				resolutionMode: "1080p",
				frameRateMode: "30",
				bitrateMode: "auto",
				optimizeForWeb: true,
			};
	}
}

export function getGifExportSettingsForPreset(preset: GifExportPreset): GifExportConfig {
	switch (preset) {
		case "small-share":
			return {
				mode: "preset",
				preset,
				resolutionMode: "480p",
				frameRate: 12,
				loop: true,
				dedupeFrames: true,
				colorCount: 64,
				ditherMode: "bayer",
				motionSensitivity: "low",
				width: 854,
				height: 480,
			};
		case "quality":
			return {
				mode: "preset",
				preset,
				resolutionMode: "1080p",
				frameRate: 20,
				loop: true,
				dedupeFrames: false,
				colorCount: 256,
				ditherMode: "floyd-steinberg",
				motionSensitivity: "high",
				width: 1920,
				height: 1080,
			};
		case "balanced":
		default:
			return {
				mode: "preset",
				preset: "balanced",
				resolutionMode: "720p",
				frameRate: 15,
				loop: true,
				dedupeFrames: true,
				colorCount: 128,
				ditherMode: "bayer",
				motionSensitivity: "balanced",
				width: 1280,
				height: 720,
			};
	}
}

export function getDefaultVideoExportSettings(): VideoExportSettings {
	return getVideoExportSettingsForPreset("balanced");
}

export function getDefaultGifExportSettings(): GifExportConfig {
	return getGifExportSettingsForPreset("balanced");
}

export function mapLegacyExportQualityToVideoSettings(
	quality?: ExportQuality | null,
): VideoExportSettings {
	switch (quality) {
		case "medium":
			return getVideoExportSettingsForPreset("fast-share");
		case "high":
			return getVideoExportSettingsForPreset("quality");
		case "source":
			return getVideoExportSettingsForPreset("master");
		case "good":
		default:
			return getDefaultVideoExportSettings();
	}
}

export function mapLegacyGifSizePreset(preset?: GifSizePreset | null): GifExportPreset {
	switch (preset) {
		case "medium":
			return "balanced";
		case "large":
		case "original":
			return "quality";
		default:
			return "balanced";
	}
}

function roundToSupportedFrameRate(
	frameRate: number,
): (typeof SUPPORTED_VIDEO_FRAME_RATES)[number] {
	const bounded = Math.min(Math.max(frameRate, SUPPORTED_VIDEO_FRAME_RATES[0]), 60);
	return [...SUPPORTED_VIDEO_FRAME_RATES].reduce((best, current) =>
		Math.abs(current - bounded) < Math.abs(best - bounded) ? current : best,
	);
}

function makeEven(value: number): number {
	const rounded = Math.max(2, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}

function clampBitrate(value: number): number {
	return Math.round(Math.min(220_000_000, Math.max(4_000_000, value)));
}

function resolveDimensions(
	source: SourceVideoMetadata,
	aspectRatioValue: number,
	maxHeight: number,
	preserveSourceHeight = false,
) {
	const sourceAspectRatio = source.height > 0 ? source.width / source.height : aspectRatioValue;
	const outputAspectRatio =
		Number.isFinite(aspectRatioValue) && aspectRatioValue > 0
			? aspectRatioValue
			: sourceAspectRatio;
	const baseHeight = preserveSourceHeight ? source.height : maxHeight;
	const height = makeEven(baseHeight);
	const width = makeEven(height * outputAspectRatio);
	return { width, height };
}

function resolveVideoDimensions(
	source: SourceVideoMetadata,
	aspectRatioValue: number,
	resolutionMode: VideoResolutionMode,
) {
	if (resolutionMode === "source") {
		return resolveDimensions(source, aspectRatioValue, source.height, true);
	}

	return resolveDimensions(source, aspectRatioValue, VIDEO_RESOLUTION_HEIGHTS[resolutionMode]);
}

function resolveGifDimensions(
	source: SourceVideoMetadata,
	aspectRatioValue: number,
	resolutionMode: GifResolutionMode,
) {
	if (resolutionMode === "source") {
		return resolveDimensions(source, aspectRatioValue, source.height, true);
	}

	return resolveDimensions(source, aspectRatioValue, GIF_RESOLUTION_HEIGHTS[resolutionMode]);
}

function estimateVideoBitrate(
	width: number,
	height: number,
	frameRate: number,
	preset: VideoExportPreset,
): number {
	return Math.round(
		Math.max(
			PRESET_BITRATE_FLOORS[preset],
			width * height * frameRate * PRESET_BITS_PER_PIXEL[preset],
		),
	);
}

function getBitrateMultiplier(mode: VideoBitrateMode): number {
	switch (mode) {
		case "high":
			return 1.25;
		case "very-high":
			return 1.6;
		case "archive":
			return 2.1;
		case "bpp":
			return 1;
		default:
			return 1;
	}
}

function resolveVideoResolutionMode(settings: VideoExportSettings): VideoResolutionMode {
	if (settings.mode === "custom") {
		return settings.resolutionMode;
	}

	return getVideoExportSettingsForPreset(settings.preset).resolutionMode;
}

function resolveVideoFrameRateMode(settings: VideoExportSettings): VideoExportFrameRateMode {
	if (settings.mode === "custom") {
		return settings.frameRateMode;
	}

	return getVideoExportSettingsForPreset(settings.preset).frameRateMode;
}

function resolveVideoBitrateMode(settings: VideoExportSettings): VideoBitrateMode {
	if (settings.mode === "custom") {
		return settings.bitrateMode;
	}

	return getVideoExportSettingsForPreset(settings.preset).bitrateMode;
}

function resolveFrameRateFromMode(
	frameRateMode: VideoExportFrameRateMode,
): (typeof SUPPORTED_VIDEO_FRAME_RATES)[number] {
	switch (frameRateMode) {
		case "30":
			return 30;
		case "60":
			return 60;
		default:
			return roundToSupportedFrameRate(Number(frameRateMode));
	}
}

function getCodecCandidates(optimizeForWeb: boolean) {
	if (optimizeForWeb) {
		return WEB_SAFE_CODEC_CANDIDATES;
	}
	return HIGH_QUALITY_CODEC_CANDIDATES;
}

export function getCodecLabel(codec: string): string {
	switch (codec) {
		case "avc1.640033":
			return "H.264 High";
		case "avc1.4d4033":
		case "avc1.4d401f":
			return "H.264 Main";
		default:
			return "H.264 Baseline";
	}
}

function estimateGifSizeBytes(
	width: number,
	height: number,
	frameRate: number,
	durationMs = 0,
	dedupeFrames = true,
	colorCount: GifColorCount = 128,
): number {
	const seconds = Math.max(durationMs / 1000, 1);
	const colorFactor = colorCount / 128;
	const dedupeFactor = dedupeFrames ? 0.82 : 1;
	const raw = width * height * frameRate * seconds * 0.16 * colorFactor;
	return Math.round(raw * dedupeFactor);
}

export function resolveVideoExportPlan(
	source: SourceVideoMetadata,
	settings: VideoExportSettings,
	aspectRatioValue: number,
): ResolvedVideoExportPlan {
	const warnings: string[] = [];
	const fallbackSteps: string[] = [];

	const resolutionMode = resolveVideoResolutionMode(settings);
	const frameRateMode = resolveVideoFrameRateMode(settings);
	const bitrateMode = resolveVideoBitrateMode(settings);

	const { width, height } = resolveVideoDimensions(source, aspectRatioValue, resolutionMode);
	const frameRate = resolveFrameRateFromMode(frameRateMode);

	if (height >= 2160) {
		warnings.push("4K exports may be slower on some systems.");
	}

	const baseBitrate = estimateVideoBitrate(width, height, frameRate, settings.preset);
	const bitrate =
		bitrateMode === "bpp" && typeof settings.bitsPerPixel === "number"
			? clampBitrate(settings.bitsPerPixel * width * height * frameRate)
			: bitrateMode === "custom" && typeof settings.customBitrateMbps === "number"
				? clampBitrate(settings.customBitrateMbps * 1_000_000)
				: clampBitrate(baseBitrate * getBitrateMultiplier(bitrateMode));

	const codecCandidates = getCodecCandidates(settings.optimizeForWeb);

	const encoderCandidates: ResolvedVideoEncoderCandidate[] = [];
	const pushCandidate = (
		candidateWidth: number,
		candidateHeight: number,
		candidateFrameRate: (typeof SUPPORTED_VIDEO_FRAME_RATES)[number],
	) => {
		const candidateBitrate =
			bitrateMode === "bpp" && typeof settings.bitsPerPixel === "number"
				? clampBitrate(
						settings.bitsPerPixel * candidateWidth * candidateHeight * candidateFrameRate,
					)
				: bitrateMode === "custom" && typeof settings.customBitrateMbps === "number"
					? clampBitrate(settings.customBitrateMbps * 1_000_000)
					: clampBitrate(
							estimateVideoBitrate(
								candidateWidth,
								candidateHeight,
								candidateFrameRate,
								settings.preset,
							) * getBitrateMultiplier(bitrateMode),
						);

		const duplicate = encoderCandidates.some(
			(candidate) =>
				candidate.width === candidateWidth &&
				candidate.height === candidateHeight &&
				candidate.frameRate === candidateFrameRate,
		);
		if (!duplicate) {
			encoderCandidates.push({
				width: candidateWidth,
				height: candidateHeight,
				frameRate: candidateFrameRate,
				bitrate: candidateBitrate,
				codecCandidates,
				fallbackSteps: [],
			});
		}
	};

	pushCandidate(width, height, frameRate);

	if (settings.mode === "custom" && settings.optimizeForWeb) {
		warnings.push(
			"Web optimization prefers safer H.264 profiles while preserving your chosen size and frame rate.",
		);
	}

	return {
		width,
		height,
		frameRate,
		bitrate,
		codec: codecCandidates[0],
		codecCandidates,
		codecLabel: getCodecLabel(codecCandidates[0]),
		preset: settings.preset,
		mode: settings.mode,
		resolutionMode,
		frameRateMode,
		bitrateMode,
		optimizeForWeb: settings.optimizeForWeb,
		forceFFmpegDecoder: settings.forceFFmpegDecoder ?? false,
		warnings,
		fallbackApplied: fallbackSteps.length > 0,
		fallbackReason: fallbackSteps[0],
		fallbackSteps,
		encoderCandidates,
	};
}

export function resolveGifExportPlan(
	source: SourceVideoMetadata,
	settings: Pick<
		GifExportConfig,
		| "mode"
		| "preset"
		| "resolutionMode"
		| "frameRate"
		| "loop"
		| "dedupeFrames"
		| "colorCount"
		| "ditherMode"
		| "motionSensitivity"
	>,
	aspectRatioValue: number,
	durationMs = 0,
): ResolvedGifExportPlan {
	const warnings: string[] = [];
	const effectiveSettings =
		settings.mode === "custom" ? settings : getGifExportSettingsForPreset(settings.preset);
	const resolutionMode =
		effectiveSettings.mode === "custom"
			? effectiveSettings.resolutionMode
			: getGifExportSettingsForPreset(effectiveSettings.preset).resolutionMode;
	const { width, height } = resolveGifDimensions(source, aspectRatioValue, resolutionMode);
	const estimatedSizeBytes = estimateGifSizeBytes(
		width,
		height,
		effectiveSettings.frameRate,
		durationMs,
		effectiveSettings.dedupeFrames,
		effectiveSettings.colorCount,
	);

	if (durationMs > 15_000) {
		warnings.push("Long GIF exports can be large and slow. MP4 may share better.");
	}
	if (estimatedSizeBytes > 15_000_000) {
		warnings.push("This GIF is likely to exceed 15 MB. Lower the resolution, FPS, or color count.");
	}
	if (resolutionMode === "source" && source.height > 1080) {
		warnings.push("Source-resolution GIF exports above 1080p can be very slow and heavy.");
	}

	return {
		width,
		height,
		frameRate: effectiveSettings.frameRate,
		preset: effectiveSettings.preset,
		mode: effectiveSettings.mode,
		resolutionMode,
		loop: effectiveSettings.loop,
		dedupeFrames: effectiveSettings.dedupeFrames,
		colorCount: effectiveSettings.colorCount,
		ditherMode: effectiveSettings.ditherMode,
		motionSensitivity: effectiveSettings.motionSensitivity,
		warnings,
		estimatedSizeBytes,
	};
}
