import {
	BufferTarget,
	EncodedAudioPacketSource,
	EncodedPacket,
	EncodedVideoPacketSource,
	Mp4OutputFormat,
	Output,
	StreamTarget,
	type StreamTargetChunk,
} from "mediabunny";
import type { ExportConfig } from "./types";

export interface VideoMuxerStreamTarget {
	write: (chunk: StreamTargetChunk) => Promise<void>;
	close?: () => Promise<void>;
}

export class VideoMuxer {
	private output: Output | null = null;
	private videoSource: EncodedVideoPacketSource | null = null;
	private audioSource: EncodedAudioPacketSource | null = null;
	private hasAudio: boolean;
	private target: BufferTarget | null = null;
	private streamTarget: StreamTarget | null = null;
	private config: ExportConfig;
	private readonly stream?: VideoMuxerStreamTarget;

	constructor(config: ExportConfig, hasAudio = false, stream?: VideoMuxerStreamTarget) {
		this.config = config;
		this.hasAudio = hasAudio;
		this.stream = stream;
	}

	async initialize(): Promise<void> {
		if (this.stream) {
			const writable = new WritableStream<StreamTargetChunk>({
				write: (chunk) => this.stream!.write(chunk),
				close: () => this.stream?.close?.(),
			});
			this.streamTarget = new StreamTarget(writable, {
				chunked: true,
				chunkSize: 4 * 1024 * 1024,
			});
		} else {
			this.target = new BufferTarget();
		}

		this.output = new Output({
			format: new Mp4OutputFormat({
				fastStart: this.stream ? false : "in-memory",
			}),
			target: this.streamTarget ?? this.target!,
		});

		// Create video source - codec will be deduced from metadata
		this.videoSource = new EncodedVideoPacketSource("avc");
		this.output.addVideoTrack(this.videoSource, {
			frameRate: this.config.frameRate,
		});

		// Create audio source if needed
		if (this.hasAudio) {
			this.audioSource = new EncodedAudioPacketSource("aac");
			this.output.addAudioTrack(this.audioSource);
		}

		// Start the output to begin accepting media data
		await this.output.start();
	}

	async addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): Promise<void> {
		if (!this.videoSource) {
			throw new Error("Muxer not initialized");
		}

		// Convert WebCodecs chunk to Mediabunny packet
		const packet = EncodedPacket.fromEncodedChunk(chunk);

		// Add metadata with the first chunk
		await this.videoSource.add(packet, meta);
	}

	async addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): Promise<void> {
		if (!this.audioSource) {
			throw new Error("Audio not configured for this muxer");
		}

		// Convert WebCodecs chunk to Mediabunny packet
		const packet = EncodedPacket.fromEncodedChunk(chunk);

		// Add metadata with the first chunk
		await this.audioSource.add(packet, meta);
	}

	async finalize(): Promise<Blob | null> {
		if (!this.output) {
			throw new Error("Muxer not initialized");
		}

		await this.output.finalize();
		if (this.stream) {
			return null;
		}

		if (!this.target) {
			throw new Error("Muxer target not initialized");
		}

		const buffer = this.target.buffer;

		if (!buffer) {
			throw new Error("Failed to finalize output");
		}

		return new Blob([buffer], { type: "video/mp4" });
	}
}
