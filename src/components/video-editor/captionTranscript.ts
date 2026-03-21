import type { CaptionTrack } from "./types";

export type CaptionTranscriptFormat = "srt" | "vtt" | "txt";

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
