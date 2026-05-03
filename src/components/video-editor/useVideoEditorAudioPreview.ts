import { type Dispatch, type RefObject, type SetStateAction, useEffect, useRef } from "react";
import {
	getAudioPlaybackOffsetSeconds,
	getAudioRegionFadeMultiplier,
	resolveAudioSourceUrl,
} from "./audioRegionUtils";
import type { AudioRegion } from "./types";
import type { VideoPlaybackRef } from "./videoPlayback/playbackTypes";

type UseVideoEditorAudioPreviewOptions = {
	audioRegions: AudioRegion[];
	currentTime: number;
	isPlaying: boolean;
	clipVolume: number;
	missingAudioPathsById: Record<string, string>;
	resolvedAudioSourceUrls: Record<string, string>;
	setResolvedAudioSourceUrls: Dispatch<SetStateAction<Record<string, string>>>;
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
};

export function useVideoEditorAudioPreview({
	audioRegions,
	currentTime,
	isPlaying,
	clipVolume,
	missingAudioPathsById,
	resolvedAudioSourceUrls,
	setResolvedAudioSourceUrls,
	videoPlaybackRef,
}: UseVideoEditorAudioPreviewOptions) {
	const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const entries = await Promise.all(
				audioRegions.map(
					async (region) => [region.id, await resolveAudioSourceUrl(region)] as const,
				),
			);
			if (cancelled) {
				return;
			}

			setResolvedAudioSourceUrls(
				Object.fromEntries(
					entries.filter(
						(entry): entry is readonly [string, string] => typeof entry[1] === "string",
					),
				),
			);
		})();

		return () => {
			cancelled = true;
		};
	}, [audioRegions, setResolvedAudioSourceUrls]);

	useEffect(() => {
		const existing = audioElementsRef.current;
		const currentIds = new Set(audioRegions.map((region) => region.id));

		for (const [id, audio] of existing) {
			if (!currentIds.has(id)) {
				audio.pause();
				audio.src = "";
				existing.delete(id);
			}
		}

		for (const region of audioRegions) {
			let audio = existing.get(region.id);
			if (!audio) {
				audio = new Audio();
				audio.preload = "auto";
				existing.set(region.id, audio);
			}

			const expectedSrc = missingAudioPathsById[region.id]
				? ""
				: (resolvedAudioSourceUrls[region.id] ?? "");
			if (audio.src !== expectedSrc) {
				audio.pause();
				audio.src = expectedSrc;
			}
			audio.volume = Math.max(0, Math.min(1, region.volume));
		}

		return () => {
			for (const audio of existing.values()) {
				audio.pause();
				audio.src = "";
			}
			existing.clear();
		};
	}, [audioRegions, missingAudioPathsById, resolvedAudioSourceUrls]);

	useEffect(() => {
		for (const region of audioRegions) {
			const audio = audioElementsRef.current.get(region.id);
			if (!audio) continue;

			const currentTimeMs = currentTime * 1000;
			const isInRegion = currentTimeMs >= region.startMs && currentTimeMs < region.endMs;
			audio.volume = Math.max(
				0,
				Math.min(1, region.volume * getAudioRegionFadeMultiplier(region, currentTimeMs)),
			);

			if (isPlaying && isInRegion && !missingAudioPathsById[region.id] && audio.src) {
				const audioOffset = getAudioPlaybackOffsetSeconds(region, currentTimeMs, audio.duration);
				if (Math.abs(audio.currentTime - audioOffset) > 0.2) {
					audio.currentTime = audioOffset;
				}
				const hasPlayableContent = region.loop || audioOffset < Math.max(0, audio.duration - 0.05);
				if (audio.paused && hasPlayableContent) {
					audio.play().catch(() => undefined);
				}
			} else if (!audio.paused) {
				audio.pause();
			}
		}
	}, [currentTime, audioRegions, isPlaying, missingAudioPathsById]);

	useEffect(() => {
		const video = videoPlaybackRef.current?.video;
		if (video) {
			video.volume = Math.max(0, Math.min(1, clipVolume));
		}
	}, [clipVolume, videoPlaybackRef]);
}
