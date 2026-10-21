import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CaptionRenderWord,
	createCaptionRenderBlock,
	getCaptionCombinedTextShadow,
	getCaptionPlacement,
	hexToRgba,
} from "./captionLayout";
import type {
	CaptionPositionOverride,
	CaptionRegion,
	CaptionSettings,
	CaptionStyle,
} from "./types";

interface CaptionOverlayProps {
	captionRegions: CaptionRegion[];
	captionSettings: CaptionSettings;
	currentTimeMs: number;
	containerWidth: number;
	containerHeight: number;
	/** When true, the caption block is draggable to set a custom position. */
	isEditing?: boolean;
	onPositionOverrideChange?: (override: CaptionPositionOverride | null) => void;
}

export function CaptionOverlay({
	captionRegions,
	captionSettings,
	currentTimeMs,
	containerWidth,
	containerHeight,
	isEditing = false,
	onPositionOverrideChange,
}: CaptionOverlayProps) {
	const renderBlock = createCaptionRenderBlock(captionRegions, captionSettings, currentTimeMs);
	const dragStateRef = useRef<{
		pointerId: number;
		offsetX: number;
		offsetY: number;
	} | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!isEditing) return;
			event.preventDefault();
			const rect = event.currentTarget.getBoundingClientRect();
			dragStateRef.current = {
				pointerId: event.pointerId,
				offsetX: event.clientX - (rect.left + rect.width / 2),
				offsetY: event.clientY - (rect.top + rect.height / 2),
			};
			event.currentTarget.setPointerCapture(event.pointerId);
			setIsDragging(true);
		},
		[isEditing],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const drag = dragStateRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			const parent = event.currentTarget.parentElement;
			if (!parent) return;
			const parentRect = parent.getBoundingClientRect();
			const px = event.clientX - parentRect.left - drag.offsetX;
			const py = event.clientY - parentRect.top - drag.offsetY;
			const xPercent = clamp((px / parentRect.width) * 100, 0, 100);
			const yPercent = clamp((py / parentRect.height) * 100, 0, 100);
			onPositionOverrideChange?.({ xPercent, yPercent });
		},
		[onPositionOverrideChange],
	);

	const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragStateRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		dragStateRef.current = null;
		setIsDragging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}, []);

	const handleDoubleClick = useCallback(() => {
		if (!isEditing) return;
		onPositionOverrideChange?.(null);
	}, [isEditing, onPositionOverrideChange]);

	useEffect(() => {
		if (!isEditing) setIsDragging(false);
	}, [isEditing]);

	if (!renderBlock) return null;

	const { style } = captionSettings;
	const scaleFactor = containerWidth / 1920;
	const fontSize = Math.max(12, Math.round(style.fontSize * scaleFactor));
	const padding = Math.max(4, Math.round(8 * scaleFactor));
	const gap = Math.max(4, Math.round(fontSize * 0.18));

	// Estimated block height for placement (actual element will match via layout).
	const estimatedLineCount = Math.max(1, renderBlock.lines.length);
	const lineHeightPx = fontSize * style.lineHeight;
	const blockHeightEstimate = estimatedLineCount * lineHeightPx + padding * 2;

	const placement = getCaptionPlacement(
		captionSettings,
		containerWidth,
		containerHeight,
		blockHeightEstimate,
	);

	const bgColor =
		style.backgroundOpacity > 0 && style.backgroundColor !== "transparent"
			? hexToRgba(style.backgroundColor, style.backgroundOpacity)
			: "transparent";

	const textShadow = getCaptionCombinedTextShadow(style, scaleFactor);
	const inactiveColor = hexToRgba(style.color, 0.58);

	const editingOutline = isEditing
		? {
				boxShadow: `0 0 0 1px rgba(245, 158, 11, 0.6), 0 0 0 4px rgba(245, 158, 11, 0.12)`,
				cursor: isDragging ? "grabbing" : "grab",
			}
		: {};

	return (
		<div
			className="absolute select-none"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onDoubleClick={handleDoubleClick}
			style={{
				left: `${placement.cx}px`,
				top: `${placement.cy}px`,
				transform: `translate(-50%, calc(-50% + ${renderBlock.blockOffsetY * 100}%)) scale(${renderBlock.blockScale})`,
				transformOrigin: "center center",
				zIndex: 800,
				maxWidth: `${placement.maxWidth}px`,
				opacity: renderBlock.blockOpacity,
				pointerEvents: isEditing ? "auto" : "none",
				transition: isDragging ? "none" : "opacity 120ms ease, transform 120ms ease",
				...editingOutline,
			}}
		>
			<div
				style={{
					fontSize: `${fontSize}px`,
					fontFamily: style.fontFamily,
					fontWeight: style.fontWeight,
					fontStyle: style.fontStyle,
					letterSpacing: `${style.letterSpacing * scaleFactor}px`,
					color: style.color,
					backgroundColor: bgColor,
					padding: `${padding}px ${padding * 2}px`,
					borderRadius: `${Math.round(style.borderRadius * scaleFactor)}px`,
					textAlign: "center",
					lineHeight: style.lineHeight,
					textShadow,
					textTransform: style.textTransform,
					display: "flex",
					flexDirection: "column",
					gap: `${Math.max(2, Math.round(fontSize * 0.12))}px`,
				}}
			>
				{renderBlock.lines.map((line, lineIndex) => (
					<div
						key={`${renderBlock.segment.id}-line-${lineIndex + 1}`}
						style={{
							display: "flex",
							justifyContent: "center",
							flexWrap: "wrap",
							columnGap: `${gap}px`,
							rowGap: `${Math.max(2, Math.round(gap * 0.4))}px`,
						}}
					>
						{line.words.map((word) => (
							<WordSpan
								key={word.id}
								word={word}
								animationMode={renderBlock.animationMode}
								style={style}
								inactiveColor={inactiveColor}
							/>
						))}
					</div>
				))}
			</div>
			{isEditing && (
				<div
					className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-amber-200"
					style={{ whiteSpace: "nowrap" }}
				>
					Drag to position · double-click to reset
				</div>
			)}
		</div>
	);
}

interface WordSpanProps {
	word: CaptionRenderWord;
	animationMode: CaptionSettings["animationMode"];
	style: CaptionStyle;
	inactiveColor: string;
}

function WordSpan({ word, animationMode, style, inactiveColor }: WordSpanProps) {
	if (!word.isVisible) return null;

	switch (animationMode) {
		case "active-word": {
			const color = word.isActive
				? style.highlightColor
				: word.isPast
					? style.color
					: inactiveColor;
			return (
				<span
					style={{
						color,
						transform: word.isActive ? "scale(1.06)" : "scale(1)",
						transformOrigin: "center bottom",
						transition: "transform 120ms ease, color 120ms ease, opacity 120ms ease",
						opacity: word.isActive || word.isPast ? 1 : 0.75,
					}}
				>
					{word.text}
				</span>
			);
		}
		case "karaoke-fill": {
			const progress = Math.round(word.wordProgress * 100);
			const gradient = `linear-gradient(90deg, ${style.highlightColor} 0%, ${style.highlightColor} ${progress}%, ${style.color} ${progress}%, ${style.color} 100%)`;
			return (
				<span
					style={{
						backgroundImage: gradient,
						WebkitBackgroundClip: "text",
						backgroundClip: "text",
						color: "transparent",
						transition: "background-image 60ms linear",
					}}
				>
					{word.text}
				</span>
			);
		}
		case "typewriter": {
			return (
				<span
					style={{
						color: word.isActive ? style.highlightColor : style.color,
						transition: "color 120ms ease",
					}}
				>
					{word.text}
				</span>
			);
		}
		case "fade":
		case "pop":
		case "static":
		default:
			return <span style={{ color: style.color }}>{word.text}</span>;
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
