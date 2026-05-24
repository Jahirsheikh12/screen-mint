export interface WaveformPeak {
	min: number;
	max: number;
	rms: number;
}

export interface CachedWaveform {
	cacheKey: string;
	sampleRate: number;
	durationMs: number;
	peaks: WaveformPeak[];
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function buildWaveformCacheKey(parts: {
	sourceId: string;
	durationMs: number;
	sampleRate: number;
	version: number;
}) {
	return `${parts.version}:${parts.sourceId}:${Math.round(parts.durationMs)}:${parts.sampleRate}`;
}

export function generateWaveformPeaks(
	samples: Float32Array,
	options: { bucketCount: number; sampleRate: number; sourceId: string; version: number },
): CachedWaveform {
	const bucketCount = Math.max(1, Math.round(options.bucketCount));
	const samplesPerBucket = Math.max(1, Math.ceil(samples.length / bucketCount));
	const peaks: WaveformPeak[] = [];

	for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
		const start = bucketIndex * samplesPerBucket;
		const end = Math.min(samples.length, start + samplesPerBucket);
		let min = 0;
		let max = 0;
		let sumSquares = 0;
		let count = 0;

		for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
			const sample = clamp(samples[sampleIndex] ?? 0, -1, 1);
			min = Math.min(min, sample);
			max = Math.max(max, sample);
			sumSquares += sample * sample;
			count += 1;
		}

		peaks.push({
			min,
			max,
			rms: count > 0 ? Math.sqrt(sumSquares / count) : 0,
		});
	}

	const durationMs =
		options.sampleRate > 0 ? Math.round((samples.length / options.sampleRate) * 1000) : 0;
	return {
		cacheKey: buildWaveformCacheKey({
			sourceId: options.sourceId,
			durationMs,
			sampleRate: options.sampleRate,
			version: options.version,
		}),
		sampleRate: options.sampleRate,
		durationMs,
		peaks,
	};
}
