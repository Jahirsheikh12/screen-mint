import type {
	CaptionAnimationMode,
	CaptionSegment,
	CaptionSettings,
	CaptionStyle,
	CaptionWord,
} from "./types";

const FADE_IN_MS = 160;
const FADE_OUT_MS = 160;
const POP_DURATION_MS = 200;
const POP_SCALE_FROM = 0.88;

export interface CaptionRenderWord extends CaptionWord {
	isActive: boolean;
	isPast: boolean;
	isVisible: boolean;
	/** 0..1 — progress of current word playback. 0 = not started, 1 = done. */
	wordProgress: number;
}

export interface CaptionRenderLine {
	words: CaptionRenderWord[];
}

export interface CaptionRenderBlock {
	segment: CaptionSegment;
	lines: CaptionRenderLine[];
	blockOpacity: number;
	blockScale: number;
	/** 0..1 progress across entire segment, used for karaoke-fill. */
	segmentProgress: number;
	animationMode: CaptionAnimationMode;
}

export interface CaptionPlacement {
	/** Anchor X in px (center of block). */
	cx: number;
	/** Anchor Y in px (center of block). */
	cy: number;
	/** Max block width in px. */
	maxWidth: number;
	/** True when user is using a free position override. */
	isFreePosition: boolean;
}

export function getActiveCaptionSegment(
	segments: CaptionSegment[],
	currentTimeMs: number,
): CaptionSegment | null {
	return (
		segments.find(
			(segment) => currentTimeMs >= segment.startMs && currentTimeMs <= segment.endMs,
		) ?? null
	);
}

/**
 * Compute a full caption render frame shared between the React preview overlay
 * and the canvas export renderer. Keeps animation timing identical everywhere.
 */
export function createCaptionRenderBlock(
	segments: CaptionSegment[],
	settings: CaptionSettings,
	currentTimeMs: number,
): CaptionRenderBlock | null {
	if (!settings.enabled || segments.length === 0) {
		return null;
	}

	const segment = getActiveCaptionSegment(segments, currentTimeMs);
	if (!segment) {
		return null;
	}

	const mode = settings.animationMode;
	const words = normalizeSegmentWords(segment);
	const duration = Math.max(1, segment.endMs - segment.startMs);
	const elapsed = clamp(currentTimeMs - segment.startMs, 0, duration);
	const segmentProgress = elapsed / duration;

	const blockOpacity = computeBlockOpacity(mode, currentTimeMs, segment.startMs, segment.endMs);
	const blockScale = computeBlockScale(mode, elapsed);

	if (words.length === 0) {
		return {
			segment,
			lines: [
				{
					words: [
						{
							id: `${segment.id}-fallback`,
							text: segment.text,
							startMs: segment.startMs,
							endMs: segment.endMs,
							isActive: true,
							isPast: false,
							isVisible: true,
							wordProgress: segmentProgress,
						},
					],
				},
			],
			blockOpacity,
			blockScale,
			segmentProgress,
			animationMode: mode,
		};
	}

	const renderWords: CaptionRenderWord[] = words.map((word, index) => {
		const isLast = index === words.length - 1;
		const startMs = word.startMs;
		const endMs = word.endMs;
		const wordDuration = Math.max(1, endMs - startMs);
		const isActive = currentTimeMs >= startMs && (currentTimeMs <= endMs || isLast);
		const isPast = currentTimeMs > endMs;
		const isVisible = mode === "typewriter" ? currentTimeMs >= startMs : true;
		const wordProgress = isActive
			? clamp((currentTimeMs - startMs) / wordDuration, 0, 1)
			: isPast
				? 1
				: 0;
		return {
			...word,
			isActive,
			isPast,
			isVisible,
			wordProgress,
		};
	});

	const lines = groupWordsIntoLines(renderWords, settings.maxWordsPerLine);
	const clampedMaxLines = Math.max(1, settings.maxLines);
	const finalLines =
		lines.length <= clampedMaxLines ? lines : clampLines(lines, clampedMaxLines, currentTimeMs);

	return {
		segment,
		lines: finalLines,
		blockOpacity,
		blockScale,
		segmentProgress,
		animationMode: mode,
	};
}

export function normalizeSegmentWords(segment: CaptionSegment): CaptionWord[] {
	if (segment.words.length > 0) {
		return segment.words;
	}

	const parts = segment.text
		.split(/\s+/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length === 0) {
		return [];
	}

	const duration = Math.max(1, segment.endMs - segment.startMs);
	const wordDuration = Math.max(1, Math.round(duration / parts.length));
	return parts.map((text, index) => {
		const startMs = segment.startMs + wordDuration * index;
		return {
			id: `${segment.id}-word-${index + 1}`,
			text,
			startMs,
			endMs: index === parts.length - 1 ? segment.endMs : startMs + wordDuration,
		};
	});
}

export function getCaptionPlacement(
	settings: CaptionSettings,
	containerWidth: number,
	containerHeight: number,
	blockHeightEstimate: number,
): CaptionPlacement {
	const maxWidth = containerWidth * 0.85;
	if (settings.positionOverride) {
		return {
			cx: (settings.positionOverride.xPercent / 100) * containerWidth,
			cy: (settings.positionOverride.yPercent / 100) * containerHeight,
			maxWidth,
			isFreePosition: true,
		};
	}

	const cx = containerWidth / 2;
	const insetPx = containerHeight * (settings.safeAreaInset / 100);
	let cy: number;
	if (settings.position === "top") {
		cy = insetPx + blockHeightEstimate / 2;
	} else if (settings.position === "center") {
		cy = containerHeight / 2;
	} else {
		cy = containerHeight - insetPx - blockHeightEstimate / 2;
	}
	return { cx, cy, maxWidth, isFreePosition: false };
}

export function hexToRgba(hex: string, alpha: number): string {
	const clean = hex.replace("#", "");
	if (clean.length === 3) {
		const [r, g, b] = clean.split("").map((c) => Number.parseInt(c + c, 16));
		if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	if (clean.length !== 6) {
		return hex;
	}

	const r = Number.parseInt(clean.slice(0, 2), 16);
	const g = Number.parseInt(clean.slice(2, 4), 16);
	const b = Number.parseInt(clean.slice(4, 6), 16);
	if ([r, g, b].some((value) => Number.isNaN(value))) {
		return hex;
	}

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getCaptionTextShadow(outlineColor: string, outlineWidth: number): string {
	if (outlineWidth <= 0) {
		return "none";
	}

	return `${outlineWidth}px ${outlineWidth}px 0 ${outlineColor},
		-${outlineWidth}px ${outlineWidth}px 0 ${outlineColor},
		${outlineWidth}px -${outlineWidth}px 0 ${outlineColor},
		-${outlineWidth}px -${outlineWidth}px 0 ${outlineColor},
		0 ${outlineWidth}px 0 ${outlineColor},
		0 -${outlineWidth}px 0 ${outlineColor},
		${outlineWidth}px 0 0 ${outlineColor},
		-${outlineWidth}px 0 0 ${outlineColor}`;
}

/**
 * Combine outline (multi-direction stroke) with an optional drop shadow for
 * use in a CSS `text-shadow` declaration.
 */
export function getCaptionCombinedTextShadow(style: CaptionStyle, scale: number): string {
	const parts: string[] = [];
	const outlineWidth = style.outlineWidth * scale;
	if (outlineWidth > 0) {
		const outline = getCaptionTextShadow(style.outlineColor, outlineWidth);
		if (outline !== "none") parts.push(outline);
	}
	if (style.shadowBlur > 0 || style.shadowOffsetY !== 0) {
		const blur = Math.max(0, style.shadowBlur * scale);
		const offset = style.shadowOffsetY * scale;
		parts.push(`0 ${offset}px ${blur}px ${style.shadowColor}`);
	}
	return parts.length === 0 ? "none" : parts.join(", ");
}

function computeBlockOpacity(
	mode: CaptionAnimationMode,
	currentTimeMs: number,
	startMs: number,
	endMs: number,
): number {
	if (mode !== "fade") return 1;
	const fadeIn = clamp((currentTimeMs - startMs) / FADE_IN_MS, 0, 1);
	const fadeOut = clamp((endMs - currentTimeMs) / FADE_OUT_MS, 0, 1);
	return Math.min(fadeIn, fadeOut);
}

function computeBlockScale(mode: CaptionAnimationMode, elapsed: number): number {
	if (mode !== "pop") return 1;
	const progress = clamp(elapsed / POP_DURATION_MS, 0, 1);
	const eased = easeOutBack(progress);
	return POP_SCALE_FROM + (1 - POP_SCALE_FROM) * eased;
}

function easeOutBack(x: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function groupWordsIntoLines(
	words: CaptionRenderWord[],
	maxWordsPerLine: number,
): CaptionRenderLine[] {
	const clampedMaxWords = Math.max(1, maxWordsPerLine);
	const lines: CaptionRenderLine[] = [];

	for (let index = 0; index < words.length; index += clampedMaxWords) {
		lines.push({
			words: words.slice(index, index + clampedMaxWords),
		});
	}

	return lines;
}

function clampLines(
	lines: CaptionRenderLine[],
	clampedMaxLines: number,
	_currentTimeMs: number,
): CaptionRenderLine[] {
	const activeLineIndex = Math.max(
		0,
		lines.findIndex((line) => line.words.some((word) => word.isActive)),
	);
	const startIndex = clamp(
		activeLineIndex - clampedMaxLines + 1,
		0,
		Math.max(0, lines.length - clampedMaxLines),
	);
	return lines.slice(startIndex, startIndex + clampedMaxLines);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
