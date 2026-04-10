import {
	getKeyboardShortcutPositionStyle,
	getKeyboardShortcutRenderStates,
	getKeyboardShortcutThemeColors,
} from "./keyboardShortcuts";
import type {
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
} from "./types";

interface KeyboardShortcutOverlayProps {
	callouts: KeyboardShortcutCallout[];
	position: KeyboardShortcutPosition;
	theme: KeyboardShortcutTheme;
	scale: number;
	opacity: number;
	maxVisible: number;
	currentTimeMs: number;
	containerWidth: number;
}

export function KeyboardShortcutOverlay({
	callouts,
	position,
	theme,
	scale,
	opacity,
	maxVisible,
	currentTimeMs,
	containerWidth,
}: KeyboardShortcutOverlayProps) {
	const renderStates = getKeyboardShortcutRenderStates(callouts, currentTimeMs, maxVisible);
	if (renderStates.length === 0) {
		return null;
	}

	const colors = getKeyboardShortcutThemeColors(theme, opacity);
	const containerScale = Math.max(0.75, containerWidth / 1920) * Math.max(0.5, Math.min(2, scale));
	const anchorStyle = getKeyboardShortcutPositionStyle(position);
	const isBottomAligned = position.startsWith("bottom");
	const bubblePaddingX = 14 * containerScale;
	const bubblePaddingY = 14 * containerScale;
	const keyPaddingX = 14 * containerScale;
	const keyPaddingY = 10 * containerScale;
	const keyGap = 8 * containerScale;
	const stackGap = 14 * containerScale;
	const fontSize = Math.max(12, 18 * containerScale);

	return (
		<div
			className="absolute"
			style={{
				...anchorStyle,
				display: "flex",
				flexDirection: "column",
				gap: `${stackGap}px`,
				padding: `${36 * containerScale}px`,
				pointerEvents: "none",
				zIndex: 760,
			}}
		>
			{renderStates.map(({ callout, opacity: calloutOpacity, scale: calloutScale, translateY }) => (
				<div
					key={callout.id}
					style={{
						display: "inline-flex",
						alignSelf: position.endsWith("right")
							? "flex-end"
							: position.endsWith("center")
								? "center"
								: "flex-start",
						alignItems: "center",
						gap: `${keyGap}px`,
						padding: `${bubblePaddingY}px ${bubblePaddingX}px`,
						borderRadius: `${18 * containerScale}px`,
						background: colors.panelFill,
						border: `1px solid ${colors.panelBorder}`,
						boxShadow: `0 ${10 * containerScale}px ${18 * containerScale}px ${colors.panelShadow}`,
						backdropFilter: colors.panelBackdropBlur
							? `blur(${colors.panelBackdropBlur}px)`
							: undefined,
						WebkitBackdropFilter: colors.panelBackdropBlur
							? `blur(${colors.panelBackdropBlur}px)`
							: undefined,
						opacity: calloutOpacity,
						transform: `translateY(${isBottomAligned ? translateY : -translateY}px) scale(${calloutScale})`,
						transformOrigin: isBottomAligned ? "center bottom" : "center top",
					}}
				>
					{callout.labels.map((label, index) => (
						<div
							key={`${callout.id}-${label}-${index + 1}`}
							style={{ display: "flex", alignItems: "center", gap: `${keyGap}px` }}
						>
							<div
								style={{
									padding: `${keyPaddingY}px ${keyPaddingX}px`,
									borderRadius: `${12 * containerScale}px`,
									background: colors.keyFill,
									border: `1px solid ${colors.keyBorder}`,
									color: colors.keyText,
									fontSize: `${fontSize}px`,
									fontWeight: 600,
									lineHeight: 1,
									fontFamily:
										'"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
									minWidth: `${Math.max(fontSize * 1.8, 30 * containerScale)}px`,
									textAlign: "center",
								}}
							>
								{label}
							</div>
							{index < callout.labels.length - 1 && (
								<span
									style={{
										color: colors.joinerText,
										fontSize: `${fontSize}px`,
										fontWeight: 600,
										lineHeight: 1,
									}}
								>
									+
								</span>
							)}
						</div>
					))}
				</div>
			))}
		</div>
	);
}
