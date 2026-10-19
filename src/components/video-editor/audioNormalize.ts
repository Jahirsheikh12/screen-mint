/** Peak level normalized audio is scaled to (≈ -1 dBFS). */
const NORMALIZE_TARGET_PEAK = 0.89;
/** Cap so near-silent clips are not blown up into noise. */
const NORMALIZE_MAX_GAIN = 4;

export function getNormalizeGainForPeak(peak: number): number {
	if (!Number.isFinite(peak) || peak <= 0) return 1;
	return Math.min(NORMALIZE_MAX_GAIN, NORMALIZE_TARGET_PEAK / peak);
}

const gainCache = new Map<string, Promise<number>>();

/** Gain that brings the file's peak to the normalize target. Cached per URL. */
export function getNormalizeGain(url: string): Promise<number> {
	let pending = gainCache.get(url);
	if (!pending) {
		pending = (async () => {
			try {
				const response = await fetch(url);
				const bytes = await response.arrayBuffer();
				const context = new OfflineAudioContext(1, 1, 44_100);
				const buffer = await context.decodeAudioData(bytes);
				let peak = 0;
				for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
					const data = buffer.getChannelData(channel);
					for (let index = 0; index < data.length; index += 1) {
						const sample = Math.abs(data[index]);
						if (sample > peak) peak = sample;
					}
				}
				return getNormalizeGainForPeak(peak);
			} catch {
				return 1;
			}
		})();
		gainCache.set(url, pending);
	}
	return pending;
}
