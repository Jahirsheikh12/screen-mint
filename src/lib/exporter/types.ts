export interface ExportConfig {
	width: number;
	height: number;
	frameRate: number;
	bitrate: number;
	codec?: string;
}

export type ExportPhase =
	| "probing"
	| "preparing"
	| "decoding"
	| "rendering"
	| "audio"
	| "encoding"
	| "muxing"
	| "writing"
	| "finalizing";

export interface ExportProgress {
	currentFrame: number;
	totalFrames: number;
	percentage: number;
	estimatedTimeRemaining: number; // in seconds
	phase?: ExportPhase;
	etaSeconds?: number;
	throughputFps?: number;
	warnings?: string[];
	renderProgress?: number; // 0-100, progress of GIF rendering phase
}

export interface ExportDetails {
	format: ExportFormat;
	width: number;
	height: number;
	frameRate: number;
	bitrate?: number;
	codec?: string;
	codecLabel?: string;
	estimatedSizeBytes?: number;
	colorCount?: GifColorCount;
	ditherMode?: GifDitherMode;
	motionSensitivity?: GifMotionSensitivity;
	loop?: boolean;
	dedupeFrames?: boolean;
	fallbackSteps?: string[];
	elapsedMs?: number;
	fileSizeBytes?: number;
	fallbackApplied?: boolean;
	fallbackReason?: string;
	warnings?: string[];
	engine?: ExportEngine;
	encoder?: string;
	hardwareAcceleration?: ExportHardwareAcceleration;
	throughputFps?: number;
	audioCodec?: "aac" | "none" | "fallback";
	validation?: { video: boolean; audio: boolean; warnings: string[] };
	dedupedFrames?: number;
	paletteMode?: "ffmpeg" | "worker-two-pass";
}

export interface ExportResult {
	success: boolean;
	blob?: Blob;
	path?: string;
	error?: string;
	details?: ExportDetails;
}

export interface VideoFrameData {
	frame: VideoFrame;
	timestamp: number; // in microseconds
	duration: number; // in microseconds
}

export type ExportQuality = "medium" | "good" | "high" | "source";

// GIF Export Types
export type ExportFormat = "mp4" | "gif";
export type ExportDestination = "file" | "clipboard" | "link";
export type ExportEngine = "direct-native" | "composited-hardware" | "legacy-renderer";
export type ExportHardwareAcceleration = "hardware" | "software" | "unknown";

export type VideoExportMode = "preset" | "custom";
export type VideoExportPreset = "fast-share" | "balanced" | "quality" | "master";
export type VideoResolutionMode = "720p" | "1080p" | "1440p" | "2160p" | "source";
export type VideoExportFrameRateMode = "30" | "60";
export type VideoBitrateMode = "auto" | "high" | "very-high" | "archive" | "custom" | "bpp";

export interface VideoExportSettings {
	mode: VideoExportMode;
	preset: VideoExportPreset;
	resolutionMode: VideoResolutionMode;
	frameRateMode: VideoExportFrameRateMode;
	bitrateMode: VideoBitrateMode;
	customBitrateMbps?: number;
	bitsPerPixel?: number;
	forceFFmpegDecoder?: boolean;
	optimizeForWeb: boolean;
}

export type GifExportMode = "preset" | "custom";
export type GifResolutionMode = "480p" | "720p" | "1080p" | "source";
export type GifFrameRate = 10 | 12 | 15 | 20 | 24 | 25 | 30;
export type GifColorCount = 64 | 128 | 256;
export type GifDitherMode = "off" | "bayer" | "floyd-steinberg";
export type GifMotionSensitivity = "low" | "balanced" | "high";

export type GifSizePreset = "medium" | "large" | "original";
export type GifExportPreset = "small-share" | "balanced" | "quality";

export interface GifExportConfig {
	mode: GifExportMode;
	preset: GifExportPreset;
	resolutionMode: GifResolutionMode;
	frameRate: GifFrameRate;
	loop: boolean;
	dedupeFrames: boolean;
	colorCount: GifColorCount;
	ditherMode: GifDitherMode;
	motionSensitivity: GifMotionSensitivity;
	width: number;
	height: number;
}

export interface ExportSettings {
	format: ExportFormat;
	destination: ExportDestination;
	video: VideoExportSettings;
	gif: GifExportConfig;
}

export type VideoQualityLabel = "potato" | "web" | "social" | "maximum";

export const VIDEO_QUALITY_TO_PRESET: Record<VideoQualityLabel, VideoExportPreset> = {
	potato: "fast-share",
	web: "balanced",
	social: "quality",
	maximum: "master",
};

export const VIDEO_PRESET_TO_QUALITY: Record<VideoExportPreset, VideoQualityLabel> = {
	"fast-share": "potato",
	balanced: "web",
	quality: "social",
	master: "maximum",
};

export type GifQualityLabel = "potato" | "web" | "social" | "maximum";

export const GIF_QUALITY_TO_PRESET: Record<GifQualityLabel, GifExportPreset> = {
	potato: "small-share",
	web: "balanced",
	social: "quality",
	maximum: "quality",
};

export const GIF_SIZE_PRESETS: Record<GifSizePreset, { maxHeight: number; label: string }> = {
	medium: { maxHeight: 720, label: "Medium (720p)" },
	large: { maxHeight: 1080, label: "Large (1080p)" },
	original: { maxHeight: Infinity, label: "Original" },
};

export const VIDEO_EXPORT_PRESETS: Record<
	VideoExportPreset,
	{ label: string; description: string }
> = {
	"fast-share": {
		label: "Fast Share",
		description: "720p-focused exports for quick delivery and smaller files",
	},
	balanced: {
		label: "Balanced",
		description: "1080p web-safe H.264 with strong quality and good export speed",
	},
	quality: {
		label: "Quality",
		description: "1440p at 60 FPS for crisp social sharing",
	},
	master: {
		label: "Master",
		description: "4K at 60 FPS with the highest preset bitrate",
	},
};

export const VIDEO_RESOLUTION_MODE_OPTIONS: {
	value: VideoResolutionMode;
	label: string;
}[] = [
	{ value: "720p", label: "720p" },
	{ value: "1080p", label: "1080p" },
	{ value: "1440p", label: "1440p" },
	{ value: "2160p", label: "4K" },
	{ value: "source", label: "Source" },
];

export const VIDEO_FRAME_RATE_MODE_OPTIONS: {
	value: VideoExportFrameRateMode;
	label: string;
}[] = [
	{ value: "30", label: "30 FPS" },
	{ value: "60", label: "60 FPS" },
];

export const VIDEO_BITRATE_MODE_OPTIONS: {
	value: VideoBitrateMode;
	label: string;
	description: string;
}[] = [
	{ value: "auto", label: "Auto", description: "Balanced bitrate based on size and frame rate" },
	{ value: "high", label: "High", description: "Higher quality with moderately larger files" },
	{
		value: "very-high",
		label: "Very High",
		description: "Sharper output for detail-heavy recordings",
	},
	{
		value: "archive",
		label: "Archive",
		description: "Maximum practical quality for H.264 exports",
	},
	{ value: "custom", label: "Custom", description: "Choose an explicit target bitrate" },
];

export const GIF_EXPORT_PRESETS: Record<GifExportPreset, { maxHeight: number; label: string }> = {
	"small-share": { maxHeight: 480, label: "Small Share (480p)" },
	balanced: { maxHeight: 720, label: "Balanced (720p)" },
	quality: { maxHeight: 1080, label: "Quality (1080p)" },
};

export const GIF_RESOLUTION_MODE_OPTIONS: {
	value: GifResolutionMode;
	label: string;
}[] = [
	{ value: "480p", label: "480p" },
	{ value: "720p", label: "720p" },
	{ value: "1080p", label: "1080p" },
	{ value: "source", label: "Source" },
];

export const GIF_FRAME_RATES: { value: GifFrameRate; label: string }[] = [
	{ value: 10, label: "10 FPS - Smaller file" },
	{ value: 12, label: "12 FPS - Efficient motion" },
	{ value: 15, label: "15 FPS - Balanced" },
	{ value: 20, label: "20 FPS - Smooth" },
	{ value: 24, label: "24 FPS - Cinematic" },
	{ value: 25, label: "25 FPS - Very smooth" },
	{ value: 30, label: "30 FPS - Maximum" },
];

export const GIF_COLOR_COUNT_OPTIONS: {
	value: GifColorCount;
	label: string;
	description: string;
}[] = [
	{ value: 64, label: "64", description: "Smallest files with reduced color detail" },
	{ value: 128, label: "128", description: "Balanced quality and file size" },
	{ value: 256, label: "256", description: "Best color fidelity for detailed captures" },
];

export const GIF_DITHER_MODE_OPTIONS: {
	value: GifDitherMode;
	label: string;
	description: string;
}[] = [
	{ value: "off", label: "Off", description: "Cleaner edges with less texture" },
	{ value: "bayer", label: "Bayer", description: "Subtle ordered dithering for balanced quality" },
	{
		value: "floyd-steinberg",
		label: "Floyd-Steinberg",
		description: "Stronger dithering for gradients and photographic content",
	},
];

export const GIF_MOTION_SENSITIVITY_OPTIONS: {
	value: GifMotionSensitivity;
	label: string;
	description: string;
}[] = [
	{ value: "low", label: "Low", description: "Dedupes aggressively for smaller files" },
	{
		value: "balanced",
		label: "Balanced",
		description: "Keeps motion while still reducing repeated frames",
	},
	{ value: "high", label: "High", description: "Preserves subtle motion and timing changes" },
];

// Valid frame rates for validation
export const VALID_GIF_FRAME_RATES: readonly GifFrameRate[] = [10, 12, 15, 20, 24, 25, 30] as const;

export function isValidGifFrameRate(rate: number): rate is GifFrameRate {
	return VALID_GIF_FRAME_RATES.includes(rate as GifFrameRate);
}
