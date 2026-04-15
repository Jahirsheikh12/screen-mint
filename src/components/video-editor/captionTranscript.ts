import type { CaptionSegment, CaptionTrack } from "./types";

export type CaptionTranscriptFormat = "srt" | "vtt" | "txt";
export type CaptionImportFormat = "srt" | "vtt" | "auto";

export function formatCaptionTrack(track: CaptionTrack, format: CaptionTranscriptFormat): string {
	if (format === "txt") {
		return track.segments.map((segment) => segment.text).join("\n");
	}

	const body = track.segments
		.map((segment, index) => {
			const start = formatTimestamp(segment.startMs, format);
			const end = formatTimestamp(segment.endMs, format);
			if (format === "srt") {
				return `${index + 1}\n${start} --> ${end}\n${segment.text}`;
			}

			return `${start} --> ${end}\n${segment.text}`;
		})
		.join("\n\n");

	return format === "vtt" ? `WEBVTT\n\n${body}\n` : `${body}\n`;
}

function formatTimestamp(milliseconds: number, format: "srt" | "vtt"): string {
	const safeMs = Math.max(0, Math.round(milliseconds));
	const totalSeconds = Math.floor(safeMs / 1000);
	const ms = safeMs % 1000;
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);
	const separator = format === "srt" ? "," : ".";

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(ms, 3)}`;
}

function pad(value: number, length = 2) {
	return value.toString().padStart(length, "0");
}

/**
 * Parse an SRT or WebVTT transcript into caption segments. Does not produce
 * word-level timings — downstream rendering falls back to even word splitting.
 * Returns an empty array when the content is unparseable.
 */
export function parseCaptionTranscript(
	content: string,
	format: CaptionImportFormat = "auto",
): CaptionSegment[] {
	if (typeof content !== "string" || content.trim().length === 0) return [];

	const cleaned = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	const detected: "srt" | "vtt" =
		format === "auto" ? (/^WEBVTT/i.test(cleaned.trim()) ? "vtt" : "srt") : format;

	const body =
		detected === "vtt"
			? cleaned.replace(/^WEBVTT[^\n]*\n(?:NOTE[^\n]*\n)*/i, "").trim()
			: cleaned.trim();

	const blocks = body
		.split(/\n\s*\n/)
		.map((block) => block.trim())
		.filter(Boolean);

	const segments: CaptionSegment[] = [];
	for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
		const block = blocks[blockIndex];
		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length === 0) continue;

		// Skip the optional numeric index in SRT cues, or a cue identifier line in VTT.
		let timingLineIndex = 0;
		if (!lines[0].includes("-->")) {
			timingLineIndex = 1;
		}
		const timingLine = lines[timingLineIndex];
		if (!timingLine || !timingLine.includes("-->")) continue;

		const [rawStart, rawEnd] = timingLine.split("-->").map((value) => value.trim());
		if (!rawStart || !rawEnd) continue;

		const startMs = parseTimestamp(rawStart);
		// VTT cues may include settings after the end time (e.g. `align:start`).
		const endToken = rawEnd.split(/\s+/)[0] ?? "";
		const endMs = parseTimestamp(endToken);
		if (startMs === null || endMs === null || endMs <= startMs) continue;

		const textLines = lines.slice(timingLineIndex + 1);
		if (textLines.length === 0) continue;
		const text = textLines
			.join(" ")
			.replace(/<\/?[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (!text) continue;

		segments.push({
			id: `caption-import-${blockIndex + 1}-${Date.now()}`,
			startMs,
			endMs,
			text,
			words: [],
			source: "manual",
		});
	}

	return segments;
}

function parseTimestamp(value: string): number | null {
	const match = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
	if (!match) return null;
	const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
	const minutes = Number.parseInt(match[2], 10);
	const seconds = Number.parseInt(match[3], 10);
	const millisRaw = match[4];
	const millis = Number.parseInt(millisRaw.padEnd(3, "0").slice(0, 3), 10);
	if ([hours, minutes, seconds, millis].some((n) => Number.isNaN(n))) return null;
	return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + millis;
}
