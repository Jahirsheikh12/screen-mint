import { type Dispatch, type SetStateAction, useEffect } from "react";
import { StreamingVideoDecoder } from "@/lib/exporter";
import { resolveSourceFrameRate } from "./exportUtils";

type UseSourceVideoMetadataOptions = {
	videoPath: string | null;
	setSourceFrameRate: Dispatch<SetStateAction<number>>;
	setVideoHasAudio: Dispatch<SetStateAction<boolean>>;
};

export function useSourceVideoMetadata({
	videoPath,
	setSourceFrameRate,
	setVideoHasAudio,
}: UseSourceVideoMetadataOptions) {
	useEffect(() => {
		let cancelled = false;
		const decoder = videoPath ? new StreamingVideoDecoder() : null;

		if (!videoPath) {
			setSourceFrameRate(60);
			return;
		}

		void decoder
			?.loadMetadata(videoPath)
			.then((metadata) => {
				if (cancelled) {
					return;
				}
				setSourceFrameRate(resolveSourceFrameRate(metadata.frameRate));
				setVideoHasAudio(metadata.hasAudio);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				console.warn("[VideoEditor] Failed to load source FPS for export planning:", error);
				setSourceFrameRate(60);
			})
			.finally(() => {
				decoder?.destroy();
			});

		return () => {
			cancelled = true;
			decoder?.destroy();
		};
	}, [setSourceFrameRate, setVideoHasAudio, videoPath]);
}
