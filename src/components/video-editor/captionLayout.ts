import type { CaptionSegment, CaptionSettings, CaptionWord } from "./types";

export interface CaptionRenderWord extends CaptionWord {
	isActive: boolean;
	isPast: boolean;
}

export interface CaptionRenderLine {
	words: CaptionRenderWord[];
}

export interface CaptionRenderBlock {
	segment: CaptionSegment;
	lines: CaptionRenderLine[];
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

	const words = normalizeSegmentWords(segment);
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
						},
					],
				},
			],
		};
	}

	const renderWords: CaptionRenderWord[] = words.map((word, index) => ({
		...word,
		isActive:
			currentTimeMs >= word.startMs && (currentTimeMs <= word.endMs || index === words.length - 1),
		isPast: currentTimeMs > word.endMs,
	}));

	const lines = groupWordsIntoLines(renderWords, settings.maxWordsPerLine);
	const clampedMaxLines = Math.max(1, settings.maxLines);
	if (lines.length <= clampedMaxLines) {
		return { segment, lines };
	}

	const activeLineIndex = Math.max(
		0,
		lines.findIndex((line) => line.words.some((word) => word.isActive)),
	);
	const startIndex = clamp(
		activeLineIndex - clampedMaxLines + 1,
		0,
		Math.max(0, lines.length - clampedMaxLines),
	);

	return {
		segment,
		lines: lines.slice(startIndex, startIndex + clampedMaxLines),
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

export function hexToRgba(hex: string, alpha: number): string {
	const clean = hex.replace("#", "");
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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
