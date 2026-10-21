import { useEffect, useRef } from "react";
import { getVideoWallpaperTime } from "@/lib/wallpapers";

/** Seconds the looping background may drift from the timeline before it is re-seeked. */
const MAX_PLAYING_DRIFT_SECONDS = 0.25;

interface BackgroundVideoLayerProps {
	src: string;
	/** Source-video time in seconds, as reported by the preview. */
	currentTime: number;
	isPlaying: boolean;
}

/** Muted, looping video background that follows the editor's playhead. */
export function BackgroundVideoLayer({ src, currentTime, isPlaying }: BackgroundVideoLayerProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	const sync = () => {
		const video = videoRef.current;
		if (!video || !Number.isFinite(video.duration)) return;
		const target = getVideoWallpaperTime(currentTime, video.duration);
		if (!isPlaying || Math.abs(video.currentTime - target) > MAX_PLAYING_DRIFT_SECONDS) {
			video.currentTime = target;
		}
		if (isPlaying) {
			void video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: sync reads the latest props each render.
	useEffect(sync, [currentTime, isPlaying, src]);

	return (
		<video
			ref={videoRef}
			src={src}
			muted
			loop
			playsInline
			preload="auto"
			onLoadedMetadata={sync}
			className="absolute inset-0 h-full w-full object-cover"
		/>
	);
}
