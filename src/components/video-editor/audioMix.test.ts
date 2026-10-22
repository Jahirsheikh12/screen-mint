import { describe, expect, it } from "vitest";
import { normalizeAudioMixSettings } from "./audioMix";

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
});
