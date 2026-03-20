import { useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { cn } from "@/lib/utils";
import type { CameraLayoutMode } from "./types";
import { toFileUrl } from "./projectPersistence";
import type { WebcamRegion } from "./types";

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

	const x = (webcamRegion.position.x / 100) * containerWidth;
	const y = (webcamRegion.position.y / 100) * containerHeight;
	const width = (webcamRegion.size.width / 100) * containerWidth;
	const height = (webcamRegion.size.height / 100) * containerHeight;

	const isCircle = webcamRegion.shape === "circle";

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
				className={cn(
					"absolute inset-0 overflow-hidden",
					isSelected && "ring-2 ring-[#10B981] ring-inset",
				)}
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
				onPositionChange({ x: xPercent, y: yPercent });
				onSizeChange({ width: widthPercent, height: heightPercent });
			}}
			onClick={() => {
				if (isDraggingRef.current) return;
				onClick();
			}}
			bounds="parent"
			lockAspectRatio
			className={cn(
				"cursor-move transition-all",
				isSelected && "ring-2 ring-[#10B981] ring-offset-2 ring-offset-transparent",
			)}
			style={{
				zIndex: 900,
				pointerEvents: "auto",
				border: isSelected ? "2px solid rgba(16, 185, 129, 0.8)" : "none",
			}}
			enableResizing={isSelected}
			disableDragging={!isSelected}
		>
				<div
					className="w-full h-full overflow-hidden"
					style={{
						borderRadius: isCircle ? "50%" : `${webcamRegion.borderRadius}px`,
						opacity: webcamRegion.opacity,
						border: `${webcamRegion.borderWidth}px solid ${webcamRegion.borderColor}`,
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
