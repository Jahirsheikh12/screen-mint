import { describe, expect, it } from "vitest";
import { buildCaptionSidecar, mapSourceTimeToOutput } from "./captionSidecar";
import type { CaptionTrack } from "./types";

describe("mapSourceTimeToOutput", () => {
	it("is the identity without edits", () => {
		expect(mapSourceTimeToOutput(1234, [], [])).toBe(1234);
	});

	it("removes trimmed time and applies speed", () => {
		const trims = [{ startMs: 1000, endMs: 3000 }];
		const speeds = [{ startMs: 4000, endMs: 6000, speed: 2 }];
		expect(mapSourceTimeToOutput(500, trims, speeds)).toBe(500);
		expect(mapSourceTimeToOutput(2000, trims, speeds)).toBe(1000);
		expect(mapSourceTimeToOutput(3500, trims, speeds)).toBe(1500);
		expect(mapSourceTimeToOutput(6000, trims, speeds)).toBe(3000);
		expect(mapSourceTimeToOutput(7000, trims, speeds)).toBe(4000);
	});
});

describe("buildCaptionSidecar", () => {
	const track = {
		segments: [
			{ id: "a", startMs: 0, endMs: 900, text: "Hello", words: [] },
			{ id: "b", startMs: 1200, endMs: 2500, text: "Trimmed away", words: [] },
			{ id: "c", startMs: 3000, endMs: 4000, text: "World", words: [] },
		],
	} as unknown as CaptionTrack;

	it("drops captions inside trims and shifts the rest", () => {
		const sidecar = buildCaptionSidecar(track, [{ id: "t", startMs: 1000, endMs: 3000 }], []);
		expect(sidecar?.srt).toContain("Hello");
		expect(sidecar?.srt).not.toContain("Trimmed away");
		expect(sidecar?.srt).toContain("00:00:01,000 --> 00:00:02,000");
		expect(sidecar?.vtt.startsWith("WEBVTT")).toBe(true);
	});

	it("returns undefined when nothing is left", () => {
		expect(buildCaptionSidecar(null, [], [])).toBeUndefined();
		expect(buildCaptionSidecar({ ...track, segments: [] }, [], [])).toBeUndefined();
	});
});
