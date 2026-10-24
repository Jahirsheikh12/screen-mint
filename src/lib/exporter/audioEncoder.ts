import { WebDemuxer } from "web-demuxer";
import { getNormalizeGain } from "@/components/video-editor/audioNormalize";
import {
	getAudioPlaybackOffsetSeconds,
	getAudioRegionFadeMultiplier,
	resolveAudioSourceUrl,
} from "@/components/video-editor/audioRegionUtils";
import type { AudioRegion, SpeedRegion, TrimRegion } from "@/components/video-editor/types";
import type { VideoMuxer } from "./muxer";

const AUDIO_BITRATE = 192_000;
const MIX_TICK_MS = 10;
const DECODE_BACKPRESSURE_LIMIT = 20;
const MIN_SPEED_REGION_DELTA_MS = 0.0001;

export interface PreparedAudioTrack {
	chunkCount: number;
	mux: (muxer: VideoMuxer) => Promise<void>;
}

export class AudioProcessor {
	private cancelled = false;

	/**
	 * Audio export has two modes:
	 * 1) no speed regions -> fast WebCodecs trim-only pipeline
	 * 2) speed regions present -> pitch-preserving rendered timeline pipeline
	 */
	async process(
		demuxer: WebDemuxer,
		muxer: VideoMuxer,
		videoUrl: string,
		trimRegions?: TrimRegion[],
		speedRegions?: SpeedRegion[],
		readEndSec?: number,
		audioRegions?: AudioRegion[],
	): Promise<void> {
		const preparedAudio = await this.prepare(
			videoUrl,
			demuxer,
			trimRegions,
			speedRegions,
			readEndSec,
			audioRegions,
		);
		if (!this.cancelled && preparedAudio) {
			await preparedAudio.mux(muxer);
		}
	}

	async prepare(
		videoUrl: string,
		demuxer: WebDemuxer | null,
		trimRegions?: TrimRegion[],
		speedRegions?: SpeedRegion[],
		readEndSec?: number,
		audioRegions?: AudioRegion[],
		options?: { independentDemuxer?: boolean; sourceVolume?: number },
	): Promise<PreparedAudioTrack | null> {
		const sourceVolume = Math.max(0, Math.min(1, options?.sourceVolume ?? 1));
		const sortedTrims = trimRegions ? [...trimRegions].sort((a, b) => a.startMs - b.startMs) : [];
		const sortedSpeedRegions = speedRegions
			? [...speedRegions]
					.filter((region) => region.endMs - region.startMs > MIN_SPEED_REGION_DELTA_MS)
					.sort((a, b) => a.startMs - b.startMs)
			: [];
		const sortedAudioRegions = audioRegions
			? [...audioRegions].sort((a, b) => a.startMs - b.startMs)
			: [];

		// When audio regions or speed edits are present, use AudioContext mixing path.
		// A source volume change also needs the mixing path (it applies the gain).
		if (sortedSpeedRegions.length > 0 || sortedAudioRegions.length > 0 || sourceVolume !== 1) {
			const renderedAudioBlob = await this.renderMixedTimelineAudio(
				videoUrl,
				sortedTrims,
				sortedSpeedRegions,
				sortedAudioRegions,
				sourceVolume,
			);
			if (!this.cancelled) {
				return await this.prepareRenderedAudioBlob(renderedAudioBlob);
			}
			return null;
		}

		// No speed edits or audio regions: keep the original demux/decode/encode path with trim timestamp remap.
		if (!options?.independentDemuxer) {
			if (!demuxer) {
				return null;
			}
			return await this.prepareTrimOnlyAudio(demuxer, sortedTrims, readEndSec);
		}

		const audioDemuxer = await this.createIndependentDemuxer(videoUrl);
		try {
			return await this.prepareTrimOnlyAudio(audioDemuxer, sortedTrims, readEndSec);
		} finally {
			try {
				audioDemuxer.destroy();
			} catch {
				// ignore
			}
		}
	}

	// Legacy trim-only path used when no speed regions are configured.
	private async prepareTrimOnlyAudio(
		demuxer: WebDemuxer,
		sortedTrims: TrimRegion[],
		readEndSec?: number,
	): Promise<PreparedAudioTrack | null> {
		let audioConfig: AudioDecoderConfig;
		try {
			audioConfig = (await demuxer.getDecoderConfig("audio")) as AudioDecoderConfig;
		} catch {
			console.warn("[AudioProcessor] No audio track found, skipping");
			return null;
		}

		const codecCheck = await AudioDecoder.isConfigSupported(audioConfig);
		if (!codecCheck.supported) {
			console.warn("[AudioProcessor] Audio codec not supported:", audioConfig.codec);
			return null;
		}

		const sampleRate = audioConfig.sampleRate || 48_000;
		const channels = audioConfig.numberOfChannels || 2;
		const encodeConfig: AudioEncoderConfig = {
			codec: "mp4a.40.2",
			sampleRate,
			numberOfChannels: channels,
			bitrate: AUDIO_BITRATE,
		};
		const encodeSupport = await AudioEncoder.isConfigSupported(encodeConfig);
		if (!encodeSupport.supported) {
			console.warn("[AudioProcessor] AAC encoding not supported, skipping audio");
			return null;
		}

		const encodedChunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[] = [];
		const encoder = new AudioEncoder({
			output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
				encodedChunks.push({ chunk, meta });
			},
			error: (error: DOMException) => console.error("[AudioProcessor] Encode error:", error),
		});
		encoder.configure(encodeConfig);

		// Each decoded block is re-timed and encoded straight away, so raw PCM never piles up in
		// memory (a full clip of it is about 11 MB per minute).
		let decodedCount = 0;
		const decoder = new AudioDecoder({
			output: (audioData: AudioData) => {
				if (this.cancelled || encoder.state !== "configured") {
					audioData.close();
					return;
				}
				const trimOffsetMs = this.computeTrimOffset(audioData.timestamp / 1000, sortedTrims);
				const adjusted = this.cloneWithTimestamp(
					audioData,
					Math.max(0, audioData.timestamp - trimOffsetMs * 1000),
				);
				audioData.close();
				encoder.encode(adjusted);
				adjusted.close();
				decodedCount++;
			},
			error: (error: DOMException) => console.error("[AudioProcessor] Decode error:", error),
		});
		decoder.configure(audioConfig);

		const audioStream =
			typeof readEndSec === "number" ? demuxer.read("audio", 0, readEndSec) : demuxer.read("audio");
		const reader = (audioStream as ReadableStream<EncodedAudioChunk>).getReader();

		while (!this.cancelled) {
			const { done, value: chunk } = await reader.read();
			if (done || !chunk) break;

			const timestampMs = chunk.timestamp / 1000;
			if (this.isInTrimRegion(timestampMs, sortedTrims)) continue;

			decoder.decode(chunk);

			while (
				(decoder.decodeQueueSize > DECODE_BACKPRESSURE_LIMIT ||
					encoder.encodeQueueSize > DECODE_BACKPRESSURE_LIMIT) &&
				!this.cancelled
			) {
				await new Promise((resolve) => setTimeout(resolve, 1));
			}
		}

		if (decoder.state === "configured") {
			await decoder.flush();
			decoder.close();
		}
		if (encoder.state === "configured") {
			if (this.cancelled || decodedCount === 0) {
				encoder.close();
				return null;
			}
			await encoder.flush();
			encoder.close();
		}
		if (this.cancelled || decodedCount === 0) {
			return null;
		}

		return {
			chunkCount: encodedChunks.length,
			mux: async (muxer) => {
				for (const { chunk, meta } of encodedChunks) {
					if (this.cancelled) break;
					await muxer.addAudioChunk(chunk, meta);
				}
			},
		};
	}

	// Renders mixed audio: original video audio (with speed/trim) + external audio regions.
	// Uses AudioContext to mix all sources into a single recorded stream.
	private async renderMixedTimelineAudio(
		videoUrl: string,
		trimRegions: TrimRegion[],
		speedRegions: SpeedRegion[],
		audioRegions: AudioRegion[],
		sourceVolume = 1,
	): Promise<Blob> {
		const media = document.createElement("audio");
		media.src = videoUrl;
		media.preload = "auto";

		const pitchMedia = media as HTMLMediaElement & {
			preservesPitch?: boolean;
			mozPreservesPitch?: boolean;
			webkitPreservesPitch?: boolean;
		};
		pitchMedia.preservesPitch = true;
		pitchMedia.mozPreservesPitch = true;
		pitchMedia.webkitPreservesPitch = true;

		await this.waitForLoadedMetadata(media);
		if (this.cancelled) {
			throw new Error("Export cancelled");
		}

		const audioContext = new AudioContext();
		const destinationNode = audioContext.createMediaStreamDestination();

		// Connect original video audio
		const sourceNode = audioContext.createMediaElementSource(media);
		const sourceGain = audioContext.createGain();
		sourceGain.gain.value = sourceVolume;
		sourceNode.connect(sourceGain);
		sourceGain.connect(destinationNode);

		// Prepare external audio region elements
		const audioRegionElements: {
			media: HTMLAudioElement;
			sourceNode: MediaElementAudioSourceNode;
			gainNode: GainNode;
			region: AudioRegion;
			normalizeGain: number;
		}[] = [];

		for (const region of audioRegions) {
			const audioEl = document.createElement("audio");
			const sourceUrl = await resolveAudioSourceUrl(region);
			if (!sourceUrl) {
				console.warn("[AudioProcessor] Failed to resolve audio region:", region);
				continue;
			}
			audioEl.src = sourceUrl;
			audioEl.preload = "auto";
			try {
				await this.waitForLoadedMetadata(audioEl);
			} catch {
				console.warn("[AudioProcessor] Failed to load audio region:", region);
				continue;
			}
			if (this.cancelled) throw new Error("Export cancelled");

			const regionSource = audioContext.createMediaElementSource(audioEl);
			const gainNode = audioContext.createGain();
			const normalizeGain = region.normalize ? await getNormalizeGain(sourceUrl) : 1;
			gainNode.gain.value = Math.max(0, Math.min(1, region.volume)) * normalizeGain;
			regionSource.connect(gainNode);
			gainNode.connect(destinationNode);

			audioRegionElements.push({
				media: audioEl,
				sourceNode: regionSource,
				gainNode,
				region,
				normalizeGain,
			});
		}

		const { recorder, recordedBlobPromise } = this.startAudioRecording(destinationNode.stream);
		// ponytail: real-time mix on a timer; trims/speed land within one tick (10ms) and the mix
		// takes as long as the clip. An OfflineAudioContext render would make it exact and fast.
		// A timer, not requestAnimationFrame, because this runs in the hidden export window.
		let tickTimer: ReturnType<typeof setTimeout> | null = null;

		try {
			if (audioContext.state === "suspended") {
				await audioContext.resume();
			}

			await this.seekTo(media, 0);
			await media.play();

			await new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					if (tickTimer !== null) {
						clearTimeout(tickTimer);
						tickTimer = null;
					}
					media.removeEventListener("error", onError);
					media.removeEventListener("ended", onEnded);
				};

				const onError = () => {
					cleanup();
					reject(new Error("Failed while rendering mixed audio timeline"));
				};

				const onEnded = () => {
					cleanup();
					resolve();
				};

				const tick = () => {
					if (this.cancelled) {
						cleanup();
						resolve();
						return;
					}

					const currentTimeMs = media.currentTime * 1000;
					const activeTrimRegion = this.findActiveTrimRegion(currentTimeMs, trimRegions);

					if (activeTrimRegion && !media.paused && !media.ended) {
						const skipToTime = activeTrimRegion.endMs / 1000;
						if (skipToTime >= media.duration) {
							media.pause();
							cleanup();
							resolve();
							return;
						}
						media.currentTime = skipToTime;
					} else {
						const activeSpeedRegion = this.findActiveSpeedRegion(currentTimeMs, speedRegions);
						const playbackRate = activeSpeedRegion ? activeSpeedRegion.speed : 1;
						if (Math.abs(media.playbackRate - playbackRate) > 0.0001) {
							media.playbackRate = playbackRate;
						}
					}

					// Sync external audio regions with the video timeline position
					for (const entry of audioRegionElements) {
						const { media: audioEl, region } = entry;
						const isInRegion = currentTimeMs >= region.startMs && currentTimeMs < region.endMs;
						entry.gainNode.gain.value =
							Math.max(
								0,
								Math.min(1, region.volume * getAudioRegionFadeMultiplier(region, currentTimeMs)),
							) * entry.normalizeGain;

						if (isInRegion) {
							const audioOffset = getAudioPlaybackOffsetSeconds(
								region,
								currentTimeMs,
								audioEl.duration,
							);
							const hasPlayableContent =
								region.loop || audioOffset < Math.max(0, audioEl.duration - 0.05);
							if (audioEl.paused && hasPlayableContent) {
								audioEl.currentTime = audioOffset;
								audioEl.play().catch(() => {
									// Preview playback may be blocked; export continues with the current mix state.
								});
							} else if (Math.abs(audioEl.currentTime - audioOffset) > 0.3) {
								audioEl.currentTime = audioOffset;
							}
						} else {
							if (!audioEl.paused) {
								audioEl.pause();
							}
						}
					}

					if (!media.paused && !media.ended) {
						tickTimer = setTimeout(tick, MIX_TICK_MS);
					} else {
						cleanup();
						resolve();
					}
				};

				media.addEventListener("error", onError, { once: true });
				media.addEventListener("ended", onEnded, { once: true });
				tickTimer = setTimeout(tick, MIX_TICK_MS);
			});
		} finally {
			if (tickTimer !== null) {
				clearTimeout(tickTimer);
			}
			media.pause();
			for (const entry of audioRegionElements) {
				entry.media.pause();
				entry.sourceNode.disconnect();
				entry.gainNode.disconnect();
				entry.media.src = "";
				entry.media.load();
			}
			if (recorder.state !== "inactive") {
				recorder.stop();
			}
			destinationNode.stream.getTracks().forEach((track) => track.stop());
			sourceNode.disconnect();
			destinationNode.disconnect();
			await audioContext.close();
			media.src = "";
			media.load();
		}

		const recordedBlob = await recordedBlobPromise;
		if (this.cancelled) {
			throw new Error("Export cancelled");
		}
		return recordedBlob;
	}

	// Demuxes the rendered speed-adjusted blob and prepares encoded AAC chunks for the MP4 muxer.
	private async prepareRenderedAudioBlob(blob: Blob): Promise<PreparedAudioTrack | null> {
		if (this.cancelled) return null;

		const file = new File([blob], "speed-audio.webm", { type: blob.type || "audio/webm" });
		const wasmUrl = new URL("./wasm/web-demuxer.wasm", window.location.href).href;
		const demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });

		try {
			await demuxer.load(file);
			return await this.prepareTrimOnlyAudio(demuxer, [], undefined);
		} finally {
			try {
				demuxer.destroy();
			} catch {
				// ignore
			}
		}
	}

	private async createIndependentDemuxer(videoUrl: string): Promise<WebDemuxer> {
		const wasmUrl = new URL("./wasm/web-demuxer.wasm", window.location.href).href;
		const demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
		try {
			await demuxer.load(await this.loadVideoFile(this.resolveVideoResourceUrl(videoUrl)));
			return demuxer;
		} catch (error) {
			try {
				demuxer.destroy();
			} catch {
				// ignore
			}
			throw error;
		}
	}

	private resolveVideoResourceUrl(videoUrl: string): string {
		if (/^(blob:|data:|https?:|file:)/i.test(videoUrl)) {
			return videoUrl;
		}

		if (videoUrl.startsWith("/")) {
			return `file://${encodeURI(videoUrl)}`;
		}

		return videoUrl;
	}

	private toLocalFilePath(resourceUrl: string): string | null {
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

	private inferMimeType(fileName: string): string {
		const extension = fileName.split(".").pop()?.toLowerCase();
		switch (extension) {
			case "mov":
				return "video/quicktime";
			case "webm":
				return "video/webm";
			case "mkv":
				return "video/x-matroska";
			case "avi":
				return "video/x-msvideo";
			case "mp4":
			default:
				return "video/mp4";
		}
	}

	private async loadVideoFile(resourceUrl: string): Promise<File> {
		const filename = resourceUrl.split("/").pop() || "video";
		const localFilePath = this.toLocalFilePath(resourceUrl);

		if (localFilePath) {
			const result = await window.electronAPI.readLocalFile(localFilePath);
			if (!result.success || !result.data) {
				throw new Error(result.error || "Failed to read local video file for audio export");
			}

			const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
			const arrayBuffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			return new File([arrayBuffer], filename, { type: this.inferMimeType(filename) });
		}

		const response = await fetch(resourceUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to load audio export resource: ${response.status} ${response.statusText}`,
			);
		}

		const blob = await response.blob();
		return new File([blob], filename, { type: blob.type || this.inferMimeType(filename) });
	}

	private startAudioRecording(stream: MediaStream): {
		recorder: MediaRecorder;
		recordedBlobPromise: Promise<Blob>;
	} {
		const mimeType = this.getSupportedAudioMimeType();
		const options: MediaRecorderOptions = {
			audioBitsPerSecond: AUDIO_BITRATE,
			...(mimeType ? { mimeType } : {}),
		};

		const recorder = new MediaRecorder(stream, options);
		const chunks: Blob[] = [];

		const recordedBlobPromise = new Promise<Blob>((resolve, reject) => {
			recorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) {
					chunks.push(event.data);
				}
			};
			recorder.onerror = () => {
				reject(new Error("MediaRecorder failed while capturing speed-adjusted audio"));
			};
			recorder.onstop = () => {
				const type = mimeType || chunks[0]?.type || "audio/webm";
				resolve(new Blob(chunks, { type }));
			};
		});

		recorder.start();
		return { recorder, recordedBlobPromise };
	}

	private getSupportedAudioMimeType(): string | undefined {
		const candidates = ["audio/webm;codecs=opus", "audio/webm"];
		for (const candidate of candidates) {
			if (MediaRecorder.isTypeSupported(candidate)) {
				return candidate;
			}
		}
		return undefined;
	}

	private waitForLoadedMetadata(media: HTMLMediaElement): Promise<void> {
		if (Number.isFinite(media.duration) && media.readyState >= HTMLMediaElement.HAVE_METADATA) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const onLoaded = () => {
				cleanup();
				resolve();
			};
			const onError = () => {
				cleanup();
				reject(new Error("Failed to load media metadata for speed-adjusted audio"));
			};
			const cleanup = () => {
				media.removeEventListener("loadedmetadata", onLoaded);
				media.removeEventListener("error", onError);
			};

			media.addEventListener("loadedmetadata", onLoaded);
			media.addEventListener("error", onError, { once: true });
		});
	}

	private seekTo(media: HTMLMediaElement, targetSec: number): Promise<void> {
		if (Math.abs(media.currentTime - targetSec) < 0.0001) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const onSeeked = () => {
				cleanup();
				resolve();
			};
			const onError = () => {
				cleanup();
				reject(new Error("Failed to seek media for speed-adjusted audio"));
			};
			const cleanup = () => {
				media.removeEventListener("seeked", onSeeked);
				media.removeEventListener("error", onError);
			};

			media.addEventListener("seeked", onSeeked, { once: true });
			media.addEventListener("error", onError, { once: true });
			media.currentTime = targetSec;
		});
	}

	private findActiveTrimRegion(
		currentTimeMs: number,
		trimRegions: TrimRegion[],
	): TrimRegion | null {
		return (
			trimRegions.find(
				(region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs,
			) || null
		);
	}

	private findActiveSpeedRegion(
		currentTimeMs: number,
		speedRegions: SpeedRegion[],
	): SpeedRegion | null {
		return (
			speedRegions.find(
				(region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs,
			) || null
		);
	}

	private cloneWithTimestamp(src: AudioData, newTimestamp: number): AudioData {
		const isPlanar = src.format?.includes("planar") ?? false;
		const numPlanes = isPlanar ? src.numberOfChannels : 1;

		let totalSize = 0;
		for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
			totalSize += src.allocationSize({ planeIndex });
		}

		const buffer = new ArrayBuffer(totalSize);
		let offset = 0;

		for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
			const planeSize = src.allocationSize({ planeIndex });
			src.copyTo(new Uint8Array(buffer, offset, planeSize), { planeIndex });
			offset += planeSize;
		}

		return new AudioData({
			format: src.format!,
			sampleRate: src.sampleRate,
			numberOfFrames: src.numberOfFrames,
			numberOfChannels: src.numberOfChannels,
			timestamp: newTimestamp,
			data: buffer,
		});
	}

	private isInTrimRegion(timestampMs: number, trims: TrimRegion[]) {
		return trims.some((trim) => timestampMs >= trim.startMs && timestampMs < trim.endMs);
	}

	private computeTrimOffset(timestampMs: number, trims: TrimRegion[]) {
		let offset = 0;
		for (const trim of trims) {
			if (trim.endMs <= timestampMs) {
				offset += trim.endMs - trim.startMs;
			}
		}
		return offset;
	}

	cancel() {
		this.cancelled = true;
	}
}
