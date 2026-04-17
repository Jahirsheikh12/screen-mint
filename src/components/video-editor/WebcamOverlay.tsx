import { useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import type { PixelRect, ResolvedWebcamRenderModel } from "./cameraLayouts";
import { toFileUrl } from "./projectPersistence";
import { resolveWebcamPreviewSyncDecision } from "./webcamPreviewSync";

interface WebcamOverlayProps {
	webcamPath: string;
	renderModel: ResolvedWebcamRenderModel;
	compositionRect: PixelRect;
	currentTime: number;
	isPlaying: boolean;
	isHeld: boolean;
	playbackRate?: number;
	isSelected: boolean;
	onPositionChange: (position: { x: number; y: number }) => void;
	onSizeChange: (size: { width: number; height: number }) => void;
	onClick: () => void;
}

export function WebcamOverlay({
	webcamPath,
	renderModel,
	compositionRect,
	currentTime,
	isPlaying,
	isHeld,
	playbackRate = 1,
	isSelected,
	onPositionChange,
	onSizeChange,
	onClick,
}: WebcamOverlayProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const isDraggingRef = useRef(false);
	const pendingSeekRef = useRef<Promise<void> | null>(null);
	const queuedSeekRef = useRef<{ time: number; resumePlayback: boolean } | null>(null);
	const lastWebcamPathRef = useRef(webcamPath);
	const { region, mode, displayRect } = renderModel;
	const { x, y, width, height } = displayRect;
	const isCircle = renderModel.clipShape === "circle";
	const borderRadius = isCircle ? "50%" : `${renderModel.borderRadiusPx}px`;
	const boxShadow =
		renderModel.shadowOpacity > 0
			? `0 ${renderModel.shadowOffsetYPx}px ${renderModel.shadowBlurPx}px rgba(0,0,0,${renderModel.shadowOpacity})`
			: "none";

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}

		if (lastWebcamPathRef.current !== webcamPath) {
			pendingSeekRef.current = null;
			queuedSeekRef.current = null;
			lastWebcamPathRef.current = webcamPath;
		}

		const playVideo = async () => {
			if (!video.paused) {
				return;
			}

			try {
				await video.play();
			} catch (error) {
				console.warn("Failed to resume preview webcam playback:", error);
			}
		};

		const queueSeek = async (time: number, resumePlayback: boolean) => {
			if (!Number.isFinite(time) || video.readyState < HTMLMediaElement.HAVE_METADATA) {
				return;
			}

			if (pendingSeekRef.current) {
				queuedSeekRef.current = { time, resumePlayback };
				return;
			}

			const performSeek = async (targetTime: number, shouldResumePlayback: boolean) => {
				pendingSeekRef.current = new Promise<void>((resolve) => {
					const handleSeeked = () => {
						video.removeEventListener("seeked", handleSeeked);
						resolve();
					};

					video.addEventListener("seeked", handleSeeked, { once: true });
					video.currentTime = targetTime;
				});

				try {
					await pendingSeekRef.current;
				} finally {
					pendingSeekRef.current = null;
				}

				if (shouldResumePlayback) {
					await playVideo();
				}

				const queuedSeek = queuedSeekRef.current;
				queuedSeekRef.current = null;
				if (
					queuedSeek &&
					(Math.abs(video.currentTime - queuedSeek.time) > 0.001 ||
						(queuedSeek.resumePlayback && video.paused))
				) {
					await performSeek(queuedSeek.time, queuedSeek.resumePlayback);
				}
			};

			await performSeek(time, resumePlayback);
		};

		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: video.currentTime,
			targetTime: currentTime,
			isPlaying,
			isHeld,
			isReady: video.readyState >= HTMLMediaElement.HAVE_METADATA,
			isPaused: video.paused,
			hasPendingSeek: pendingSeekRef.current !== null,
			playbackRate,
			currentPlaybackRate: video.playbackRate,
		});

		if (decision.playbackRate !== null) {
			video.playbackRate = decision.playbackRate;
		}

		if (decision.shouldPause) {
			video.pause();
		}

		if (decision.seekTarget !== null) {
			void queueSeek(decision.seekTarget, isPlaying && !isHeld);
			return;
		}

		if (decision.shouldPlay) {
			void playVideo();
		}
	}, [currentTime, isHeld, isPlaying, playbackRate, webcamPath]);

	const compositionWidth = Math.max(compositionRect.width, 1);
	const compositionHeight = Math.max(compositionRect.height, 1);

	if (mode === "fullscreen") {
		return (
			<div
				className="absolute overflow-hidden"
				style={{
					pointerEvents: "auto",
					zIndex: 850,
					left: x,
					top: y,
					width,
					height,
				}}
				onClick={onClick}
			>
				<video
					ref={videoRef}
					src={toFileUrl(webcamPath)}
					className="w-full h-full object-cover"
					style={{
						transform: renderModel.mirror ? "scaleX(-1)" : "none",
						opacity: renderModel.opacity,
					}}
					muted
					playsInline
				/>
			</div>
		);
	}

	return (
		<Rnd
			position={{ x, y }}
			size={{ width, height }}
			onDragStart={() => {
				isDraggingRef.current = true;
			}}
			onDragStop={(_e, d) => {
				const xPercent = ((d.x - compositionRect.x) / compositionWidth) * 100;
				const yPercent = ((d.y - compositionRect.y) / compositionHeight) * 100;
				onPositionChange({ x: xPercent, y: yPercent });
				setTimeout(() => {
					isDraggingRef.current = false;
				}, 100);
			}}
			onResizeStop={(_e, _direction, ref, _delta, position) => {
				const xPercent = ((position.x - compositionRect.x) / compositionWidth) * 100;
				const yPercent = ((position.y - compositionRect.y) / compositionHeight) * 100;
				const widthPercent = (ref.offsetWidth / compositionWidth) * 100;
				const heightPercent = (ref.offsetHeight / compositionHeight) * 100;
				const sidePercent =
					(Math.max(ref.offsetWidth, ref.offsetHeight) /
						Math.min(compositionWidth, compositionHeight)) *
					100;
				onPositionChange({ x: xPercent, y: yPercent });
				onSizeChange({
					width:
						region.shape === "circle" || region.shape === "square" ? sidePercent : widthPercent,
					height:
						region.shape === "circle" || region.shape === "square" ? sidePercent : heightPercent,
				});
			}}
			onClick={() => {
				if (isDraggingRef.current) return;
				onClick();
			}}
			bounds="parent"
			lockAspectRatio
			className="cursor-move transition-all"
			style={{
				zIndex: 900,
				pointerEvents: "auto",
			}}
			enableResizing={isSelected}
			disableDragging={!isSelected}
		>
			<div
				className="w-full h-full overflow-hidden"
				style={{
					borderRadius,
					opacity: renderModel.opacity,
					border: `${renderModel.borderWidthPx}px solid ${region.borderColor}`,
					boxShadow,
				}}
			>
				<video
					ref={videoRef}
					src={toFileUrl(webcamPath)}
					className="w-full h-full object-cover"
					style={{ transform: renderModel.mirror ? "scaleX(-1)" : "none" }}
					muted
					playsInline
				/>
			</div>
		</Rnd>
	);
}
