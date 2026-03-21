import type { CaptionRegion, CaptionWord } from "../../src/components/video-editor/types";

export function buildCaptionSegmentsFromWords(words: CaptionWord[]): CaptionRegion[] {
	if (words.length === 0) {
		return [];
	}

	const sortedWords = [...words]
		.filter((word) => word.text.trim().length > 0)
		.sort((left, right) => left.startMs - right.startMs);

	const segments: CaptionRegion[] = [];
	let currentWords: CaptionWord[] = [];

	for (const word of sortedWords) {
		const previous = currentWords[currentWords.length - 1];
		const shouldBreak =
			currentWords.length >= 6 ||
			(previous ? word.startMs - previous.endMs > 420 : false) ||
			/[.!?]$/.test(previous?.text ?? "");

		if (shouldBreak && currentWords.length > 0) {
			segments.push(buildSegmentFromWords(currentWords, segments.length));
			currentWords = [];
		}

		currentWords.push(word);
	}

	if (currentWords.length > 0) {
		segments.push(buildSegmentFromWords(currentWords, segments.length));
	}

	return segments;
}

function buildSegmentFromWords(words: CaptionWord[], index: number): CaptionRegion {
	const id = `caption-${index + 1}`;
	return {
		id,
		startMs: words[0]?.startMs ?? 0,
		endMs: words[words.length - 1]?.endMs ?? 1,
		text: words.map((word) => word.text).join(" "),
		words: words.map((word, wordIndex) => ({ ...word, id: `${id}-word-${wordIndex + 1}` })),
		source: "generated",
	};
}
