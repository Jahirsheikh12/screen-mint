import type {
	ExportDetails,
	GifExportConfig,
	GifQualityLabel,
	ResolvedGifExportPlan,
	ResolvedVideoExportPlan,
	SourceVideoMetadata,
	VideoExportSettings,
	VideoQualityLabel,
} from "@/lib/exporter";
import {
	GIF_QUALITY_TO_PRESET,
	getGifExportSettingsForPreset,
	getVideoExportSettingsForPreset,
	VIDEO_PRESET_TO_QUALITY,
	VIDEO_QUALITY_TO_PRESET,
} from "@/lib/exporter";

const DEFAULT_SOURCE_WIDTH = 1920;
const DEFAULT_SOURCE_HEIGHT = 1080;
const DEFAULT_SOURCE_FRAME_RATE = 60;

export const VIDEO_EXPORT_QUALITY_OPTIONS = [
	"potato",
	"web",
	"social",
	"maximum",
] as const satisfies readonly VideoQualityLabel[];

export const GIF_EXPORT_QUALITY_OPTIONS = [
	"potato",
	"web",
	"social",
] as const satisfies readonly GifQualityLabel[];

function uniqueStrings(values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function getSelectedVideoQuality(settings: VideoExportSettings): VideoQualityLabel | null {
	if (settings.mode !== "preset") {
		return null;
	}

	return VIDEO_PRESET_TO_QUALITY[settings.preset] ?? null;
}

export function getSelectedGifQuality(settings: GifExportConfig): GifQualityLabel | null {
	if (settings.mode !== "preset") {
		return null;
	}

	const preset =
		GIF_QUALITY_TO_PRESET.potato === settings.preset
			? "potato"
			: GIF_QUALITY_TO_PRESET.web === settings.preset
				? "web"
				: GIF_QUALITY_TO_PRESET.social === settings.preset
					? "social"
					: null;
	return preset;
}

export function selectVideoQualitySettings(
	settings: VideoExportSettings,
	quality: VideoQualityLabel,
): VideoExportSettings {
	const presetSettings = getVideoExportSettingsForPreset(VIDEO_QUALITY_TO_PRESET[quality]);
	return {
		...presetSettings,
		forceFFmpegDecoder: settings.forceFFmpegDecoder,
	};
}

export function selectGifQualitySettings(quality: GifQualityLabel): GifExportConfig {
	return getGifExportSettingsForPreset(GIF_QUALITY_TO_PRESET[quality]);
}

export function resolveSourceFrameRate(frameRate?: number): number {
	return Number.isFinite(frameRate) && typeof frameRate === "number" && frameRate > 0
		? frameRate
		: DEFAULT_SOURCE_FRAME_RATE;
}

export function buildSourceVideoMetadata({
	width,
	height,
	frameRate,
	durationMs,
}: Partial<SourceVideoMetadata>): SourceVideoMetadata {
	return {
		width: width && width > 0 ? width : DEFAULT_SOURCE_WIDTH,
		height: height && height > 0 ? height : DEFAULT_SOURCE_HEIGHT,
		frameRate: resolveSourceFrameRate(frameRate),
		durationMs,
	};
}

export function mergeGifExportDetails(
	plan: ResolvedGifExportPlan,
	runtimeDetails?: ExportDetails,
	fallbackFileSizeBytes?: number,
): ExportDetails {
	return {
		format: "gif",
		width: runtimeDetails?.width ?? plan.width,
		height: runtimeDetails?.height ?? plan.height,
		frameRate: runtimeDetails?.frameRate ?? plan.frameRate,
		estimatedSizeBytes: runtimeDetails?.estimatedSizeBytes ?? plan.estimatedSizeBytes,
		colorCount: runtimeDetails?.colorCount ?? plan.colorCount,
		ditherMode: runtimeDetails?.ditherMode ?? plan.ditherMode,
		motionSensitivity: runtimeDetails?.motionSensitivity ?? plan.motionSensitivity,
		loop: runtimeDetails?.loop ?? plan.loop,
		dedupeFrames: runtimeDetails?.dedupeFrames ?? plan.dedupeFrames,
		elapsedMs: runtimeDetails?.elapsedMs,
		fileSizeBytes: runtimeDetails?.fileSizeBytes ?? fallbackFileSizeBytes,
		engine: runtimeDetails?.engine,
		encoder: runtimeDetails?.encoder,
		hardwareAcceleration: runtimeDetails?.hardwareAcceleration,
		throughputFps: runtimeDetails?.throughputFps,
		stageTimingsMs: runtimeDetails?.stageTimingsMs,
		nativeComposedFallbackReason: runtimeDetails?.nativeComposedFallbackReason,
		nativeComposedFeatures: runtimeDetails?.nativeComposedFeatures,
		benchmarkThroughputFps: runtimeDetails?.benchmarkThroughputFps,
		warnings: uniqueStrings([...(plan.warnings ?? []), ...(runtimeDetails?.warnings ?? [])]),
	};
}

export function mergeVideoExportDetails(
	plan: ResolvedVideoExportPlan,
	runtimeDetails?: ExportDetails,
	fallbackFileSizeBytes?: number,
): ExportDetails {
	return {
		format: "mp4",
		width: runtimeDetails?.width ?? plan.width,
		height: runtimeDetails?.height ?? plan.height,
		frameRate: runtimeDetails?.frameRate ?? plan.frameRate,
		bitrate: runtimeDetails?.bitrate ?? plan.bitrate,
		codec: runtimeDetails?.codec ?? plan.codec,
		codecLabel: runtimeDetails?.codecLabel ?? plan.codecLabel,
		fallbackApplied: runtimeDetails?.fallbackApplied ?? plan.fallbackApplied,
		fallbackReason: runtimeDetails?.fallbackReason ?? plan.fallbackReason,
		fallbackSteps: uniqueStrings([
			...(plan.fallbackSteps ?? []),
			...(runtimeDetails?.fallbackSteps ?? []),
		]),
		elapsedMs: runtimeDetails?.elapsedMs,
		fileSizeBytes: runtimeDetails?.fileSizeBytes ?? fallbackFileSizeBytes,
		engine: runtimeDetails?.engine,
		encoder: runtimeDetails?.encoder,
		hardwareAcceleration: runtimeDetails?.hardwareAcceleration,
		throughputFps: runtimeDetails?.throughputFps,
		stageTimingsMs: runtimeDetails?.stageTimingsMs,
		nativeComposedFallbackReason: runtimeDetails?.nativeComposedFallbackReason,
		nativeComposedFeatures: runtimeDetails?.nativeComposedFeatures,
		benchmarkThroughputFps: runtimeDetails?.benchmarkThroughputFps,
		warnings: uniqueStrings([...(plan.warnings ?? []), ...(runtimeDetails?.warnings ?? [])]),
	};
}
