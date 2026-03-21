import { describe, expect, it } from "vitest";
import { formatCaptionTrack } from "./captionTranscript";
import type { CaptionTrack } from "./types";

const track: CaptionTrack = {
	backend: "whisper.cpp",
	model: "base",
	language: "en",
	prompt: "",
	sourceAudio: "mixed",
	status: "ready",
	segments: [
		{
			id: "caption-1",
			startMs: 0,
			endMs: 1250,
			text: "Hello there",
			words: [
				{ id: "caption-1-word-1", text: "Hello", startMs: 0, endMs: 500 },
				{ id: "caption-1-word-2", text: "there", startMs: 500, endMs: 1250 },
			],
			source: "generated",
		},
	],
};

describe("captionTranscript", () => {
	it("formats SRT output", () => {
		expect(formatCaptionTrack(track, "srt")).toContain("00:00:00,000 --> 00:00:01,250");
	});

	it("formats VTT output", () => {
		expect(formatCaptionTrack(track, "vtt")).toMatch(/^WEBVTT/);
	});

	it("formats TXT output", () => {
		expect(formatCaptionTrack(track, "txt")).toBe("Hello there");
	});
});
