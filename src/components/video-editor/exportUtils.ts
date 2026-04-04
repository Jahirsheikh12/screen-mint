import type {
	ExportDetails,
	ExportFormat,
	ExportProgress,
	ResolvedGifExportPlan,
	ResolvedVideoExportPlan,
	SourceVideoMetadata,
} from "@/lib/exporter";

const DEFAULT_SOURCE_WIDTH = 1920;
const DEFAULT_SOURCE_HEIGHT = 1080;
const DEFAULT_SOURCE_FRAME_RATE = 60;

function uniqueStrings(values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
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
		warnings: uniqueStrings([...(plan.warnings ?? []), ...(runtimeDetails?.warnings ?? [])]),
	};
}

export function getExportDialogPhaseState({
	isExporting,
	exportFormat,
	progress,
}: {
	isExporting: boolean;
	exportFormat: ExportFormat;
	progress: ExportProgress | null;
}) {
	const isGifCompiling = isExporting && progress?.phase === "finalizing" && exportFormat === "gif";
	const isVideoFinalizing =
		isExporting && progress?.phase === "finalizing" && exportFormat !== "gif";

	return {
		isGifCompiling,
		isVideoFinalizing,
	};
}
