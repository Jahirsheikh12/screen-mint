import { useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { toFileUrl } from "./projectPersistence";
import type { CameraLayoutMode, WebcamRegion } from "./types";
import { getWebcamPixelRect, normalizeWebcamRegion } from "./webcamRegionUtils";

interface WebcamOverlayProps {
	webcamPath: string;
	webcamRegion: WebcamRegion;
	mode?: CameraLayoutMode;
	currentTime: number;
	containerWidth: number;
	containerHeight: number;
	isSelected: boolean;
	mirror?: boolean;
	onPositionChange: (position: { x: number; y: number }) => void;
	onSizeChange: (size: { width: number; height: number }) => void;
	onClick: () => void;
}

export function WebcamOverlay({
	webcamPath,
	webcamRegion,
	mode = "default",
	currentTime,
	containerWidth,
	containerHeight,
	isSelected,
	mirror = false,
	onPositionChange,
	onSizeChange,
	onClick,
}: WebcamOverlayProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const isDraggingRef = useRef(false);
	const normalizedRegion = normalizeWebcamRegion(webcamRegion);
	const { x, y, width, height } = getWebcamPixelRect(
		normalizedRegion,
		containerWidth,
		containerHeight,
	);

	const isCircle = normalizedRegion.shape === "circle";

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (Math.abs(video.currentTime - currentTime) > 0.1) {
			video.currentTime = currentTime;
		}
	}, [currentTime]);

	if (mode === "fullscreen") {
		return (
			<div
				className="absolute inset-0 overflow-hidden"
				style={{ pointerEvents: "auto", zIndex: 850 }}
				onClick={onClick}
			>
				<video
					ref={videoRef}
					src={toFileUrl(webcamPath)}
					className="w-full h-full object-cover"
					style={{ transform: mirror ? "scaleX(-1)" : "none" }}
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
				const xPercent = (d.x / containerWidth) * 100;
				const yPercent = (d.y / containerHeight) * 100;
				onPositionChange({ x: xPercent, y: yPercent });
				setTimeout(() => {
					isDraggingRef.current = false;
				}, 100);
			}}
			onResizeStop={(_e, _direction, ref, _delta, position) => {
				const xPercent = (position.x / containerWidth) * 100;
				const yPercent = (position.y / containerHeight) * 100;
				const widthPercent = (ref.offsetWidth / containerWidth) * 100;
				const heightPercent = (ref.offsetHeight / containerHeight) * 100;
				const sidePercent =
					(Math.max(ref.offsetWidth, ref.offsetHeight) /
						Math.min(containerWidth, containerHeight)) *
					100;
				onPositionChange({ x: xPercent, y: yPercent });
				onSizeChange({
					width:
						normalizedRegion.shape === "circle" || normalizedRegion.shape === "square"
							? sidePercent
							: widthPercent,
					height:
						normalizedRegion.shape === "circle" || normalizedRegion.shape === "square"
							? sidePercent
							: heightPercent,
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
					borderRadius: isCircle ? "50%" : `${normalizedRegion.borderRadius}px`,
					opacity: normalizedRegion.opacity,
					border: `${normalizedRegion.borderWidth}px solid ${normalizedRegion.borderColor}`,
					boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
				}}
			>
				<video
					ref={videoRef}
					src={toFileUrl(webcamPath)}
					className="w-full h-full object-cover"
					style={{ transform: mirror ? "scaleX(-1)" : "none" }}
					muted
					playsInline
				/>
			</div>
		</Rnd>
	);
}
