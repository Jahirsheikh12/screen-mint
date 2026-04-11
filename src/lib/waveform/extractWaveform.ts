import { useEffect, useState } from "react";

const SAMPLES_PER_SECOND = 100;

const waveformCache = new Map<string, Float32Array>();
const pendingExtractions = new Map<string, Promise<Float32Array>>();

function toLocalFilePath(resourceUrl: string): string | null {
	if (!resourceUrl.startsWith("file:")) {
		return null;
	}
	try {
		const url = new URL(resourceUrl);
		let filePath = decodeURIComponent(url.pathname);
		if (/^\/[A-Za-z]:/.test(filePath)) {
			filePath = filePath.slice(1);
		}
		return filePath;
	} catch {
		return resourceUrl.replace(/^file:\/\//, "");
	}
}

async function loadAudioBuffer(videoPath: string): Promise<ArrayBuffer> {
	const localPath = toLocalFilePath(videoPath);

	if (localPath && window.electronAPI?.readLocalFile) {
		const result = await window.electronAPI.readLocalFile(localPath);
		if (!result.success || !result.data) {
			throw new Error(result.error || "Failed to read video file for waveform extraction");
		}
		const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	}

	const response = await fetch(videoPath);
	if (!response.ok) {
		throw new Error(`Failed to fetch video for waveform: ${response.status}`);
	}
	return response.arrayBuffer();
}

/**
 * Extracts a downsampled waveform from a video file's audio track.
 * Returns a Float32Array of normalized RMS amplitudes (0–1), with
 * `samplesPerSecond` entries per second of audio.
 */
export async function extractWaveform(
	videoPath: string,
	samplesPerSecond: number = SAMPLES_PER_SECOND,
): Promise<Float32Array> {
	const cached = waveformCache.get(videoPath);
	if (cached) return cached;

	// Deduplicate concurrent calls for the same path
	const pending = pendingExtractions.get(videoPath);
	if (pending) return pending;

	const promise = doExtract(videoPath, samplesPerSecond);
	pendingExtractions.set(videoPath, promise);

	try {
		const result = await promise;
		return result;
	} finally {
		pendingExtractions.delete(videoPath);
	}
}

async function doExtract(videoPath: string, samplesPerSecond: number): Promise<Float32Array> {
	const arrayBuffer = await loadAudioBuffer(videoPath);

	// Decode audio — use a standard sample rate for efficiency
	const sampleRate = 22050;
	const audioCtx = new OfflineAudioContext(1, sampleRate, sampleRate);
	const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

	// Mix channels to mono
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;
	const mono = new Float32Array(length);

	for (let ch = 0; ch < numChannels; ch++) {
		const channelData = audioBuffer.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			mono[i] += channelData[i];
		}
	}
	if (numChannels > 1) {
		for (let i = 0; i < length; i++) {
			mono[i] /= numChannels;
		}
	}

	// Downsample to RMS buckets
	const duration = audioBuffer.duration;
	const bucketCount = Math.max(1, Math.ceil(duration * samplesPerSecond));
	const samplesPerBucket = length / bucketCount;
	const rms = new Float32Array(bucketCount);

	let maxVal = 0;
	for (let b = 0; b < bucketCount; b++) {
		const start = Math.floor(b * samplesPerBucket);
		const end = Math.min(length, Math.floor((b + 1) * samplesPerBucket));
		let sum = 0;
		for (let i = start; i < end; i++) {
			sum += mono[i] * mono[i];
		}
		const count = end - start;
		rms[b] = count > 0 ? Math.sqrt(sum / count) : 0;
		if (rms[b] > maxVal) maxVal = rms[b];
	}

	// Normalize to [0, 1]
	if (maxVal > 0) {
		for (let i = 0; i < bucketCount; i++) {
			rms[i] /= maxVal;
		}
	}

	waveformCache.set(videoPath, rms);
	return rms;
}

/**
 * React hook that extracts waveform data from a video file.
 * Returns null while loading or if the video has no audio.
 */
export function useWaveformData(videoPath: string | null, hasAudio: boolean): Float32Array | null {
	const [waveform, setWaveform] = useState<Float32Array | null>(null);

	useEffect(() => {
		if (!videoPath || !hasAudio) {
			setWaveform(null);
			return;
		}

		let cancelled = false;

		extractWaveform(videoPath, SAMPLES_PER_SECOND)
			.then((data) => {
				if (!cancelled) {
					setWaveform(data);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.warn("[useWaveformData] Failed to extract waveform:", error);
					setWaveform(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [videoPath, hasAudio]);

	return waveform;
}
