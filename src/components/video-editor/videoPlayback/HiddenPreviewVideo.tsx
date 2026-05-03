import type React from "react";
import type { MutableRefObject } from "react";

interface HiddenPreviewVideoProps {
	videoRef: React.RefObject<HTMLVideoElement>;
	videoPath: string;
	onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
	onDurationChange: (duration: number) => void;
	onError: (error: string) => void;
	isPreviewRecoveryInProgressRef: MutableRefObject<boolean>;
}

export function HiddenPreviewVideo({
	videoRef,
	videoPath,
	onLoadedMetadata,
	onDurationChange,
	onError,
	isPreviewRecoveryInProgressRef,
}: HiddenPreviewVideoProps) {
	return (
		<video
			ref={videoRef}
			src={videoPath}
			preload="metadata"
			playsInline
			style={{
				position: "absolute",
				width: 1,
				height: 1,
				opacity: 0,
				pointerEvents: "none",
				left: -10_000,
				top: 0,
			}}
			onLoadedMetadata={onLoadedMetadata}
			onDurationChange={(event) => {
				onDurationChange(event.currentTarget.duration);
			}}
			onError={(event) => {
				const videoEl = event.currentTarget;
				const mediaError = videoEl.error;
				const code = mediaError?.code ?? "unknown";
				const msg = mediaError?.message ?? "";

				if (isPreviewRecoveryInProgressRef.current) {
					console.warn("Ignoring transient video error during preview recovery:", {
						code,
						message: msg,
						src: videoEl.src,
					});
					return;
				}

				console.error("Video load error:", {
					code,
					message: msg,
					src: videoEl.src,
				});
				onError(
					`Failed to load video (error ${code}${msg ? `: ${msg}` : ""}). Source: ${videoEl.src}`,
				);
			}}
		/>
	);
}
