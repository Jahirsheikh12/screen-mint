import { createCaptionRenderBlock, getCaptionTextShadow, hexToRgba } from "./captionLayout";
import type { CaptionRegion, CaptionSettings } from "./types";

interface CaptionOverlayProps {
	captionRegions: CaptionRegion[];
	captionSettings: CaptionSettings;
	currentTimeMs: number;
	containerWidth: number;
	containerHeight: number;
}

export function CaptionOverlay({
	captionRegions,
	captionSettings,
	currentTimeMs,
	containerWidth,
	containerHeight,
}: CaptionOverlayProps) {
	const renderBlock = createCaptionRenderBlock(captionRegions, captionSettings, currentTimeMs);
	if (!renderBlock) return null;

	const { style, position } = captionSettings;
	const scaleFactor = containerWidth / 1920;
	const fontSize = Math.max(12, Math.round(style.fontSize * scaleFactor));
	const padding = Math.max(4, Math.round(8 * scaleFactor));
	const outlineWidth = style.outlineWidth * scaleFactor;
	const gap = Math.max(4, Math.round(fontSize * 0.18));

	const positionStyle: React.CSSProperties = {
		left: "50%",
		transform: "translateX(-50%)",
		...(position === "top" && {
			top: `${Math.round(containerHeight * (captionSettings.safeAreaInset / 100))}px`,
		}),
		...(position === "center" && {
			top: "50%",
			transform: "translate(-50%, -50%)",
		}),
		...(position === "bottom" && {
			bottom: `${Math.round(containerHeight * (captionSettings.safeAreaInset / 100))}px`,
		}),
	};

	const bgColor =
		style.backgroundOpacity > 0 && style.backgroundColor !== "transparent"
			? hexToRgba(style.backgroundColor, style.backgroundOpacity)
			: "transparent";

	const textShadow = getCaptionTextShadow(style.outlineColor, outlineWidth);
	const inactiveColor = hexToRgba(style.color, 0.58);

	return (
		<div
			className="absolute pointer-events-none select-none"
			style={{
				...positionStyle,
				zIndex: 800,
				maxWidth: `${containerWidth * 0.85}px`,
			}}
		>
			<div
				style={{
					fontSize: `${fontSize}px`,
					fontFamily: style.fontFamily,
					fontWeight: style.fontWeight,
					color: style.color,
					backgroundColor: bgColor,
					padding: `${padding}px ${padding * 2}px`,
					borderRadius: `${Math.round(6 * scaleFactor)}px`,
					textAlign: "center",
					lineHeight: 1.3,
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
							<span
								key={word.id}
								style={{
									color:
										captionSettings.animationMode === "active-word"
											? word.isActive
												? style.color
												: inactiveColor
											: style.color,
									transform:
										captionSettings.animationMode === "active-word" && word.isActive
											? "scale(1.06)"
											: "scale(1)",
									transformOrigin: "center bottom",
									transition: "transform 120ms ease, color 120ms ease, opacity 120ms ease",
									opacity:
										captionSettings.animationMode === "active-word"
											? word.isActive || word.isPast
												? 1
												: 0.75
											: 1,
								}}
							>
								{word.text}
							</span>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
