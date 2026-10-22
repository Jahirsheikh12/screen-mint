import { type RefObject, useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import {
	type ExportDestination,
	type ExportFormat,
	type ExportSettings,
	type GifExportConfig,
	resolveGifExportPlan,
	type VideoExportSettings,
} from "@/lib/exporter";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { buildSourceVideoMetadata } from "./exportUtils";
import type { VideoPlaybackRef } from "./videoPlayback/playbackTypes";

type UseDefaultExportSettingsOptions = {
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
	aspectRatio: AspectRatio;
	duration: number;
	sourceFrameRate: number;
	exportFormat: ExportFormat;
	exportDestination: ExportDestination;
	videoExportSettings: VideoExportSettings;
	gifExportSettings: GifExportConfig;
};

export function useDefaultExportSettings({
	videoPlaybackRef,
	aspectRatio,
	duration,
	sourceFrameRate,
	exportFormat,
	exportDestination,
	videoExportSettings,
	gifExportSettings,
}: UseDefaultExportSettingsOptions) {
	const { t } = useI18n();
	return useCallback((): ExportSettings | null => {
		const video = videoPlaybackRef.current?.video;
		if (!video) {
			toast.error(t("dialogs.export.videoNotReady", "The video isn't ready yet"));
			return null;
		}

		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const sourceAspectRatio = sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
		const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);
		const sourceMetadata = buildSourceVideoMetadata({
			width: sourceWidth,
			height: sourceHeight,
			frameRate: sourceFrameRate,
			durationMs: Math.round(duration * 1000),
		});
		const gifPlan = resolveGifExportPlan(
			sourceMetadata,
			gifExportSettings,
			aspectRatioValue,
			Math.round(duration * 1000),
		);

		return {
			format: exportFormat,
			destination: exportDestination,
			video: videoExportSettings,
			gif: {
				...gifExportSettings,
				width: gifPlan.width,
				height: gifPlan.height,
			},
		};
	}, [
		aspectRatio,
		duration,
		exportDestination,
		exportFormat,
		gifExportSettings,
		sourceFrameRate,
		videoExportSettings,
		videoPlaybackRef,
		t,
	]);
}
