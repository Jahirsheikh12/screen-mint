import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { composeCropRegions, invertCropRegionWithinBase } from "./videoPlayback/layoutUtils";

interface CropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface CropControlProps {
	videoElement: HTMLVideoElement | null;
	cropRegion: CropRegion;
	baseCropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
}

type DragHandle = "top" | "right" | "bottom" | "left" | null;

const FULL_CROP_REGION: CropRegion = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_HEIGHT = 0.1;
const MIN_CROP_WIDTH = 0.1;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalizeCropRegion(cropRegion: CropRegion): CropRegion {
	const x = clamp(cropRegion.x, 0, 1);
	const y = clamp(cropRegion.y, 0, 1);
	const width = clamp(cropRegion.width, 0.0001, 1 - x);
	const height = clamp(cropRegion.height, 0.0001, 1 - y);
	return { x, y, width, height };
}

function clampCropRegionToBounds(cropRegion: CropRegion, bounds: CropRegion): CropRegion {
	const normalizedBounds = normalizeCropRegion(bounds);
	const width = clamp(cropRegion.width, 0.0001, normalizedBounds.width);
	const height = clamp(cropRegion.height, 0.0001, normalizedBounds.height);
	const x = clamp(
		cropRegion.x,
		normalizedBounds.x,
		normalizedBounds.x + normalizedBounds.width - width,
	);
	const y = clamp(
		cropRegion.y,
		normalizedBounds.y,
		normalizedBounds.y + normalizedBounds.height - height,
	);
	return { x, y, width, height };
}

export function CropControl({
	videoElement,
	cropRegion,
	baseCropRegion = FULL_CROP_REGION,
	onCropChange,
	aspectRatio,
}: CropControlProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState<DragHandle>(null);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialCrop, setInitialCrop] = useState<CropRegion>(
		composeCropRegions(baseCropRegion, cropRegion),
	);

	useEffect(() => {
		if (!videoElement || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return;

		canvas.width = videoElement.videoWidth || 1920;
		canvas.height = videoElement.videoHeight || 1080;

		let rafId = 0;
		const draw = () => {
			if (videoElement.readyState >= 2) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			}
			rafId = requestAnimationFrame(draw);
		};

		rafId = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafId);
	}, [videoElement]);

	const normalizedBaseCropRegion = useMemo(
		() => normalizeCropRegion(baseCropRegion),
		[baseCropRegion],
	);
	const displayCropRegion = useMemo(
		() => composeCropRegions(normalizedBaseCropRegion, cropRegion),
		[cropRegion, normalizedBaseCropRegion],
	);

	const getContainerRect = () =>
		containerRef.current?.getBoundingClientRect() || { width: 0, height: 0, left: 0, top: 0 };

	const emitCropChange = (absoluteCropRegion: CropRegion) => {
		if (!onCropChange) {
			return;
		}

		const boundedCropRegion = clampCropRegionToBounds(absoluteCropRegion, normalizedBaseCropRegion);
		onCropChange(invertCropRegionWithinBase(normalizedBaseCropRegion, boundedCropRegion));
	};

	const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
		e.stopPropagation();
		e.preventDefault();
		setIsDragging(handle);
		const rect = getContainerRect();
		setDragStart({
			x: (e.clientX - rect.left) / rect.width,
			y: (e.clientY - rect.top) / rect.height,
		});
		setInitialCrop(displayCropRegion);
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const videoAspectRatio = videoElement
		? videoElement.videoWidth / Math.max(videoElement.videoHeight, 1)
		: 16 / 9;
	const lockedAspectRatio =
		aspectRatio === "native" ? null : getAspectRatioValue(aspectRatio, videoAspectRatio);
	const normalizedAspectRatio =
		lockedAspectRatio && videoAspectRatio > 0 ? lockedAspectRatio / videoAspectRatio : null;

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging) return;

		const rect = getContainerRect();
		const currentX = (e.clientX - rect.left) / rect.width;
		const currentY = (e.clientY - rect.top) / rect.height;
		const deltaX = currentX - dragStart.x;
		const deltaY = currentY - dragStart.y;
		const bounds = normalizedBaseCropRegion;
		const boundsRight = bounds.x + bounds.width;
		const boundsBottom = bounds.y + bounds.height;
		let nextCrop = { ...initialCrop };

		if (!normalizedAspectRatio) {
			switch (isDragging) {
				case "top": {
					const newY = clamp(
						initialCrop.y + deltaY,
						bounds.y,
						initialCrop.y + initialCrop.height - MIN_CROP_HEIGHT,
					);
					nextCrop.y = newY;
					nextCrop.height = initialCrop.y + initialCrop.height - newY;
					break;
				}
				case "bottom":
					nextCrop.height = clamp(
						initialCrop.height + deltaY,
						MIN_CROP_HEIGHT,
						boundsBottom - initialCrop.y,
					);
					break;
				case "left": {
					const newX = clamp(
						initialCrop.x + deltaX,
						bounds.x,
						initialCrop.x + initialCrop.width - MIN_CROP_WIDTH,
					);
					nextCrop.x = newX;
					nextCrop.width = initialCrop.x + initialCrop.width - newX;
					break;
				}
				case "right":
					nextCrop.width = clamp(
						initialCrop.width + deltaX,
						MIN_CROP_WIDTH,
						boundsRight - initialCrop.x,
					);
					break;
			}

			emitCropChange(nextCrop);
			return;
		}

		const minWidth = Math.max(MIN_CROP_WIDTH, MIN_CROP_HEIGHT * normalizedAspectRatio);
		const minHeight = Math.max(MIN_CROP_HEIGHT, MIN_CROP_WIDTH / normalizedAspectRatio);
		const centerX = initialCrop.x + initialCrop.width / 2;
		const centerY = initialCrop.y + initialCrop.height / 2;

		switch (isDragging) {
			case "top": {
				const bottom = initialCrop.y + initialCrop.height;
				let height = clamp(bottom - currentY, minHeight, boundsBottom - bounds.y);
				let width = height * normalizedAspectRatio;
				if (width > bounds.width) {
					width = bounds.width;
					height = width / normalizedAspectRatio;
				}

				const x = clamp(centerX - width / 2, bounds.x, boundsRight - width);
				const y = clamp(bottom - height, bounds.y, boundsBottom - height);
				nextCrop = { x, y, width, height };
				break;
			}
			case "bottom": {
				const top = initialCrop.y;
				let height = clamp(currentY - top, minHeight, boundsBottom - bounds.y);
				let width = height * normalizedAspectRatio;
				if (width > bounds.width) {
					width = bounds.width;
					height = width / normalizedAspectRatio;
				}

				const x = clamp(centerX - width / 2, bounds.x, boundsRight - width);
				const y = clamp(top, bounds.y, boundsBottom - height);
				nextCrop = { x, y, width, height };
				break;
			}
			case "left": {
				const right = initialCrop.x + initialCrop.width;
				let width = clamp(right - currentX, minWidth, boundsRight - bounds.x);
				let height = width / normalizedAspectRatio;
				if (height > bounds.height) {
					height = bounds.height;
					width = height * normalizedAspectRatio;
				}

				const x = clamp(right - width, bounds.x, boundsRight - width);
				const y = clamp(centerY - height / 2, bounds.y, boundsBottom - height);
				nextCrop = { x, y, width, height };
				break;
			}
			case "right": {
				const left = initialCrop.x;
				let width = clamp(currentX - left, minWidth, boundsRight - bounds.x);
				let height = width / normalizedAspectRatio;
				if (height > bounds.height) {
					height = bounds.height;
					width = height * normalizedAspectRatio;
				}

				const x = clamp(left, bounds.x, boundsRight - width);
				const y = clamp(centerY - height / 2, bounds.y, boundsBottom - height);
				nextCrop = { x, y, width, height };
				break;
			}
		}

		emitCropChange(nextCrop);
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		if (isDragging) {
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				// Ignore stale pointer capture release errors.
			}
		}
		setIsDragging(null);
	};

	const cropPixelX = displayCropRegion.x * 100;
	const cropPixelY = displayCropRegion.y * 100;
	const cropPixelWidth = displayCropRegion.width * 100;
	const cropPixelHeight = displayCropRegion.height * 100;
	const isVideoPortrait = videoAspectRatio < 1;
	const maxContainerWidth = isVideoPortrait ? "40vw" : "75vw";
	const maxContainerHeight = "75vh";

	return (
		<div className="w-full p-8">
			<div
				ref={containerRef}
				className="relative w-full bg-black rounded-lg overflow-visible cursor-default select-none shadow-2xl"
				style={{
					aspectRatio: videoAspectRatio,
					maxWidth: maxContainerWidth,
					maxHeight: maxContainerHeight,
					margin: "0 auto",
				}}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			>
				<canvas
					ref={canvasRef}
					className="w-full h-full rounded-lg"
					style={{ imageRendering: "auto" }}
				/>

				<div className="absolute inset-0 pointer-events-none" style={{ transition: "none" }}>
					<svg
						width="100%"
						height="100%"
						className="absolute inset-0"
						style={{ transition: "none" }}
					>
						<defs>
							<mask id="cropMask">
								<rect width="100%" height="100%" fill="white" />
								<rect
									x={`${cropPixelX}%`}
									y={`${cropPixelY}%`}
									width={`${cropPixelWidth}%`}
									height={`${cropPixelHeight}%`}
									fill="black"
									style={{ transition: "none" }}
								/>
							</mask>
						</defs>
						<rect
							width="100%"
							height="100%"
							fill="black"
							fillOpacity="0.6"
							mask="url(#cropMask)"
							style={{ transition: "none" }}
						/>
					</svg>
				</div>

				<div
					className={cn("absolute h-[3px] cursor-ns-resize z-20 pointer-events-auto bg-[#F59E0B]")}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
						willChange: "transform",
						transition: "none",
					}}
					onPointerDown={(e) => handlePointerDown(e, "top")}
				/>

				<div
					className={cn("absolute h-[3px] cursor-ns-resize z-20 pointer-events-auto bg-[#F59E0B]")}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY + cropPixelHeight}%`,
						width: `${cropPixelWidth}%`,
						transform: "translateY(-50%)",
						willChange: "transform",
						transition: "none",
					}}
					onPointerDown={(e) => handlePointerDown(e, "bottom")}
				/>

				<div
					className={cn("absolute w-[3px] cursor-ew-resize z-20 pointer-events-auto bg-[#F59E0B]")}
					style={{
						left: `${cropPixelX}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
						willChange: "transform",
						transition: "none",
					}}
					onPointerDown={(e) => handlePointerDown(e, "left")}
				/>

				<div
					className={cn("absolute w-[3px] cursor-ew-resize z-20 pointer-events-auto bg-[#F59E0B]")}
					style={{
						left: `${cropPixelX + cropPixelWidth}%`,
						top: `${cropPixelY}%`,
						height: `${cropPixelHeight}%`,
						transform: "translateX(-50%)",
						willChange: "transform",
						transition: "none",
					}}
					onPointerDown={(e) => handlePointerDown(e, "right")}
				/>
			</div>
		</div>
	);
}
