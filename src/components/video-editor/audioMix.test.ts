import { describe, expect, it } from "vitest";
import { filterAudibleTracks, normalizeAudioMixSettings, resolveAudioTrackGain } from "./audioMix";

describe("audio mix settings", () => {
	it("normalizes track gain, fades, ducking, and master volume", () => {
		const mix = normalizeAudioMixSettings({
			masterVolume: 3,
			tracks: [
				{
					id: "music",
					kind: "music",
					label: "Music",
					volume: 1.5,
					fadeInMs: 700,
					fadeOutMs: -10,
					duckUnderSpeech: true,
					duckingAmount: 0.5,
				},
			],
		});

		expect(mix.masterVolume).toBe(2);
		expect(mix.tracks.some((track) => track.kind === "primary")).toBe(true);
		expect(mix.tracks.find((track) => track.id === "music")).toMatchObject({
			volume: 1.5,
			fadeInMs: 700,
			fadeOutMs: 0,
			duckingAmount: 0.5,
		});
	});

	it("applies mute, solo, and ducking calculations", () => {
		const tracks = normalizeAudioMixSettings({
			tracks: [
				{ id: "voice", kind: "primary", label: "Voice", volume: 1, solo: true },
				{
					id: "music",
					kind: "music",
					label: "Music",
					volume: 1,
					duckUnderSpeech: true,
					duckingAmount: 0.6,
				},
			],
		}).tracks;

		expect(filterAudibleTracks(tracks).map((track) => track.id)).toEqual(["voice"]);
		expect(resolveAudioTrackGain(tracks[1], { speechActive: true })).toBeCloseTo(0.4);
	});
});
