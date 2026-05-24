import { describe, expect, it } from "vitest";
import { AUDIO_MIX_WAVEFORM_CACHE_VERSION } from "./audioMix";
import { buildWaveformCacheKey, generateWaveformPeaks } from "./audioWaveform";

describe("audio waveform cache", () => {
	it("generates deterministic peak buckets and cache keys", () => {
		const waveform = generateWaveformPeaks(new Float32Array([-1, -0.5, 0.25, 1]), {
			bucketCount: 2,
			sampleRate: 4,
			sourceId: "primary",
			version: AUDIO_MIX_WAVEFORM_CACHE_VERSION,
		});

		expect(waveform.cacheKey).toBe("1:primary:1000:4");
		expect(waveform.peaks[0]).toMatchObject({ min: -1, max: 0 });
		expect(waveform.peaks[0]?.rms).toBeCloseTo(0.79057, 5);
		expect(waveform.peaks[1]).toMatchObject({ min: 0, max: 1 });
		expect(waveform.peaks[1]?.rms).toBeCloseTo(0.72887, 5);
	});

	it("builds stable cache keys from source metadata", () => {
		expect(
			buildWaveformCacheKey({
				sourceId: "music",
				durationMs: 1234.49,
				sampleRate: 48_000,
				version: 2,
			}),
		).toBe("2:music:1234:48000");
	});
});
