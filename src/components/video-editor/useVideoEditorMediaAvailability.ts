import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";
import { toast } from "sonner";
import { isFileAudioSource } from "./audioRegionUtils";
import type { EditorPreferences } from "./editorPreferences";
import {
	type AudioRegion,
	type CameraLayoutRegion,
	DEFAULT_WEBCAM_PREVIEW_MODE,
	getRecommendedWebcamDefaults,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamPreviewMode,
	type WebcamRegion,
	type WebcamSessionMetadata,
} from "./types";

type UseVideoEditorMediaAvailabilityOptions = {
	aspectRatio: EditorPreferences["aspectRatio"];
	setWebcamPath: Dispatch<SetStateAction<string | null>>;
	setMissingWebcamPath: Dispatch<SetStateAction<string | null>>;
	setWebcamSessionMetadata: Dispatch<SetStateAction<WebcamSessionMetadata | null>>;
	setWebcamRegion: Dispatch<SetStateAction<WebcamRegion>>;
	setWebcamEffects: Dispatch<SetStateAction<WebcamEffects>>;
	setWebcamHealthMetrics: Dispatch<SetStateAction<WebcamHealthMetrics | null>>;
	setWebcamPreviewMode: Dispatch<SetStateAction<WebcamPreviewMode>>;
	setShowWebcam: Dispatch<SetStateAction<boolean>>;
	setMirrorWebcam: Dispatch<SetStateAction<boolean>>;
	setCameraSizeDuringZoom: Dispatch<SetStateAction<number>>;
	setCameraLayouts: Dispatch<SetStateAction<CameraLayoutRegion[]>>;
	setSelectedCameraLayoutId: Dispatch<SetStateAction<string | null>>;
	setWebcamSelected: Dispatch<SetStateAction<boolean>>;
	setMissingAudioPathsById: Dispatch<SetStateAction<Record<string, string>>>;
};

export function useVideoEditorMediaAvailability({
	aspectRatio,
	setWebcamPath,
	setMissingWebcamPath,
	setWebcamSessionMetadata,
	setWebcamRegion,
	setWebcamEffects,
	setWebcamHealthMetrics,
	setWebcamPreviewMode,
	setShowWebcam,
	setMirrorWebcam,
	setCameraSizeDuringZoom,
	setCameraLayouts,
	setSelectedCameraLayoutId,
	setWebcamSelected,
	setMissingAudioPathsById,
}: UseVideoEditorMediaAvailabilityOptions) {
	const webcamAvailabilityRequestRef = useRef(0);
	const notifiedMissingWebcamPathRef = useRef<string | null>(null);
	const audioAvailabilityRequestRef = useRef(0);

	const clearWebcamState = useCallback(() => {
		const recommendedWebcamDefaults = getRecommendedWebcamDefaults(aspectRatio);
		setWebcamPath(null);
		setMissingWebcamPath(null);
		setWebcamSessionMetadata(null);
		setWebcamRegion(recommendedWebcamDefaults.region);
		setWebcamEffects(recommendedWebcamDefaults.effects);
		setWebcamHealthMetrics(null);
		setWebcamPreviewMode(DEFAULT_WEBCAM_PREVIEW_MODE);
		setShowWebcam(recommendedWebcamDefaults.showWebcam);
		setMirrorWebcam(recommendedWebcamDefaults.mirrorWebcam);
		setCameraSizeDuringZoom(recommendedWebcamDefaults.cameraSizeDuringZoom);
		setCameraLayouts([]);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
	}, [
		aspectRatio,
		setCameraLayouts,
		setCameraSizeDuringZoom,
		setMirrorWebcam,
		setMissingWebcamPath,
		setSelectedCameraLayoutId,
		setShowWebcam,
		setWebcamEffects,
		setWebcamHealthMetrics,
		setWebcamPath,
		setWebcamPreviewMode,
		setWebcamRegion,
		setWebcamSelected,
		setWebcamSessionMetadata,
	]);

	const syncWebcamAvailability = useCallback(
		async (candidatePath: string | null, options: { quiet?: boolean } = {}) => {
			const requestId = ++webcamAvailabilityRequestRef.current;

			if (!candidatePath) {
				setMissingWebcamPath(null);
				notifiedMissingWebcamPathRef.current = null;
				return true;
			}

			const result = await window.electronAPI.checkFileAvailable(candidatePath);
			if (requestId !== webcamAvailabilityRequestRef.current) {
				return false;
			}

			if (result.success && result.exists) {
				setMissingWebcamPath(null);
				notifiedMissingWebcamPathRef.current = null;
				return true;
			}

			setMissingWebcamPath(candidatePath);
			if (!options.quiet && notifiedMissingWebcamPathRef.current !== candidatePath) {
				notifiedMissingWebcamPathRef.current = candidatePath;
				toast.warning("Webcam source is missing. Relink it or remove it from the project.");
			}

			return false;
		},
		[setMissingWebcamPath],
	);

	const syncAudioAvailability = useCallback(
		async (regions: AudioRegion[]) => {
			const requestId = ++audioAvailabilityRequestRef.current;
			const nextMissingEntries = await Promise.all(
				regions
					.filter((region) => isFileAudioSource(region) && region.audioPath)
					.map(async (region) => {
						const result = await window.electronAPI.checkFileAvailable(region.audioPath ?? "");
						return result.success && result.exists
							? null
							: ([region.id, region.audioPath ?? ""] as const);
					}),
			);

			if (requestId !== audioAvailabilityRequestRef.current) {
				return;
			}

			setMissingAudioPathsById(
				Object.fromEntries(nextMissingEntries.filter(Boolean) as Array<[string, string]>),
			);
		},
		[setMissingAudioPathsById],
	);

	return {
		clearWebcamState,
		syncWebcamAvailability,
		syncAudioAvailability,
	};
}
