import type {
	AnnotationRegion,
	AudioRegion,
	CameraLayoutRegion,
	CaptionRegion,
	CaptionSettings,
	CropRegion,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorStyle,
	CursorTelemetryPoint,
	CursorTypeMode,
	DeviceMockup,
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	SpeedRegion,
	TrimRegion,
	WebcamRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { AudioProcessor } from "./audioEncoder";
import { FrameRenderer } from "./frameRenderer";
import { VideoMuxer } from "./muxer";
import type { ResolvedVideoEncoderCandidate } from "./planner";
import { getCodecLabel } from "./planner";
import { StreamingVideoDecoder } from "./streamingDecoder";
import type { ExportConfig, ExportProgress, ExportResult } from "./types";

interface VideoExporterConfig extends ExportConfig {
	videoUrl: string;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions?: TrimRegion[];
	speedRegions?: SpeedRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	frameShadowSize?: number;
	frameShadowOpacity?: number;
	frameShadowBlur?: number;
	backgroundBlur: number;
	hideBackground?: boolean;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	deviceMockup?: DeviceMockup;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	borderRadius?: number;
	padding?: number;
	videoPadding?: number;
	cropRegion: CropRegion;
	aspectRatio?: AspectRatio;
	annotationRegions?: AnnotationRegion[];
	cursorTelemetry?: CursorTelemetryPoint[];
	keyboardShortcutCallouts?: KeyboardShortcutCallout[];
	showKeyboardShortcuts?: boolean;
	keyboardShortcutPosition?: KeyboardShortcutPosition;
	keyboardShortcutTheme?: KeyboardShortcutTheme;
	keyboardShortcutScale?: number;
	keyboardShortcutOpacity?: number;
	keyboardShortcutMaxVisible?: number;
	showCursor?: boolean;
	cursorSize?: number;
	cursorSmoothing?: number;
	cursorMotionBlur?: number;
	cursorClickBounce?: number;
	cursorSway?: number;
	cursorStyle?: CursorStyle;
	cursorPack?: CursorPack;
	cursorColor?: string;
	cursorOpacity?: number;
	clickHighlightColor?: string;
	clickHighlightSize?: number;
	clickHighlightOpacity?: number;
	cursorTrailLength?: number;
	cursorTrailOpacity?: number;
	cursorTypeMode?: CursorTypeMode;
	cursorTilt?: number;
	hideWhenIdle?: boolean;
	idleHideDelayMs?: number;
	smoothMovementEnabled?: boolean;
	cursorMovementStyle?: CursorMovementStyle;
	cursorSpring?: CursorSpringSettings;
	highQualitySvgCursors?: boolean;
	cameraSpring?: import("@/components/video-editor/types").CameraSpringSettings;
	audioRegions?: AudioRegion[];
	previewWidth?: number;
	previewHeight?: number;
	webcamPath?: string | null;
	webcamRegion?: WebcamRegion;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	captionRegions?: CaptionRegion[];
	captionSettings?: CaptionSettings;
	codecCandidates?: readonly string[];
	encoderCandidates?: readonly ResolvedVideoEncoderCandidate[];
	fallbackSteps?: string[];
	onProgress?: (progress: ExportProgress) => void;
}

interface ActiveVideoExportConfig {
	width: number;
	height: number;
	frameRate: number;
	bitrate: number;
	codecCandidates: readonly string[];
	hardwareAcceleration: VideoEncoderConfig["hardwareAcceleration"];
	fallbackSteps: string[];
}

export class VideoExporter {
	private config: VideoExporterConfig;
	private streamingDecoder: StreamingVideoDecoder | null = null;
	private renderer: FrameRenderer | null = null;
	private encoder: VideoEncoder | null = null;
	private muxer: VideoMuxer | null = null;
	private audioProcessor: AudioProcessor | null = null;
	private cancelled = false;
	private encodeQueue = 0;
	private readonly maxEncodeQueue =
		typeof navigator !== "undefined"
			? Math.max(60, Math.min(180, (navigator.hardwareConcurrency || 4) * 24))
			: 120;
	private videoDescription: Uint8Array | undefined;
	private videoColorSpace: VideoColorSpaceInit | undefined;
	private pendingMuxing: Promise<void> = Promise.resolve();
	private chunkCount = 0;
	private readonly WINDOWS_FINALIZATION_TIMEOUT_MS = 60_000;
	private exportStartedAtMs = 0;
	private lastReportedPhase: ExportProgress["phase"] | undefined;
	private warnings: string[] = [];
	private resolvedCodec: string | undefined;
	private activeConfig: ActiveVideoExportConfig | null = null;
	private resolvedFallbackSteps: string[] = [];
	private readonly encoderSupportCache = new Map<string, boolean>();

	constructor(config: VideoExporterConfig) {
		this.config = config;
	}

	async export(): Promise<ExportResult> {
		try {
			this.cleanup();
			this.cancelled = false;
			this.exportStartedAtMs = performance.now();
			this.warnings = [];
			this.reportPhase("preparing");

			// Initialize streaming decoder and load video metadata
			this.streamingDecoder = new StreamingVideoDecoder();
			const videoInfo = await this.streamingDecoder.loadMetadata(this.config.videoUrl);
			this.activeConfig = await this.resolveEncoderCandidate();

			// Initialize frame renderer
			this.renderer = new FrameRenderer({
				width: this.activeConfig.width,
				height: this.activeConfig.height,
				wallpaper: this.config.wallpaper,
				zoomRegions: this.config.zoomRegions,
				showShadow: this.config.showShadow,
				shadowIntensity: this.config.shadowIntensity,
				frameShadowSize: this.config.frameShadowSize,
				frameShadowOpacity: this.config.frameShadowOpacity,
				frameShadowBlur: this.config.frameShadowBlur,
				backgroundBlur: this.config.backgroundBlur,
				hideBackground: this.config.hideBackground,
				zoomMotionBlur: this.config.zoomMotionBlur,
				connectZooms: this.config.connectZooms,
				deviceMockup: this.config.deviceMockup,
				frameBorderEnabled: this.config.frameBorderEnabled,
				frameBorderWidth: this.config.frameBorderWidth,
				frameBorderColor: this.config.frameBorderColor,
				frameBorderOpacity: this.config.frameBorderOpacity,
				borderRadius: this.config.borderRadius,
				padding: this.config.padding,
				cropRegion: this.config.cropRegion,
				aspectRatio: this.config.aspectRatio,
				videoWidth: videoInfo.width,
				videoHeight: videoInfo.height,
				annotationRegions: this.config.annotationRegions,
				speedRegions: this.config.speedRegions,
				previewWidth: this.config.previewWidth,
				previewHeight: this.config.previewHeight,
				cursorTelemetry: this.config.cursorTelemetry,
				keyboardShortcutCallouts: this.config.keyboardShortcutCallouts,
				showKeyboardShortcuts: this.config.showKeyboardShortcuts,
				keyboardShortcutPosition: this.config.keyboardShortcutPosition,
				keyboardShortcutTheme: this.config.keyboardShortcutTheme,
				keyboardShortcutScale: this.config.keyboardShortcutScale,
				keyboardShortcutOpacity: this.config.keyboardShortcutOpacity,
				keyboardShortcutMaxVisible: this.config.keyboardShortcutMaxVisible,
				showCursor: this.config.showCursor,
				cursorSize: this.config.cursorSize,
				cursorSmoothing: this.config.cursorSmoothing,
				cursorMotionBlur: this.config.cursorMotionBlur,
				cursorClickBounce: this.config.cursorClickBounce,
				cursorSway: this.config.cursorSway,
				cursorStyle: this.config.cursorStyle,
				cursorPack: this.config.cursorPack,
				cursorColor: this.config.cursorColor,
				cursorOpacity: this.config.cursorOpacity,
				clickHighlightColor: this.config.clickHighlightColor,
				clickHighlightSize: this.config.clickHighlightSize,
				clickHighlightOpacity: this.config.clickHighlightOpacity,
				cursorTrailLength: this.config.cursorTrailLength,
				cursorTrailOpacity: this.config.cursorTrailOpacity,
				cursorTypeMode: this.config.cursorTypeMode,
				cursorTilt: this.config.cursorTilt,
				hideWhenIdle: this.config.hideWhenIdle,
				idleHideDelayMs: this.config.idleHideDelayMs,
				smoothMovementEnabled: this.config.smoothMovementEnabled,
				cursorMovementStyle: this.config.cursorMovementStyle,
				cursorSpring: this.config.cursorSpring,
				highQualitySvgCursors: this.config.highQualitySvgCursors,
				cameraSpring: this.config.cameraSpring,
				webcamPath: this.config.webcamPath,
				webcamRegion: this.config.webcamRegion,
				showWebcam: this.config.showWebcam,
				mirrorWebcam: this.config.mirrorWebcam,
				cameraSizeDuringZoom: this.config.cameraSizeDuringZoom,
				cameraLayouts: this.config.cameraLayouts,
				captionRegions: this.config.captionRegions,
				captionSettings: this.config.captionSettings,
			});
			await this.renderer.initialize();

			// Initialize video encoder
			await this.initializeEncoder(this.activeConfig);

			const hasAudioRegions = (this.config.audioRegions ?? []).length > 0;
			const hasAudio = videoInfo.hasAudio || hasAudioRegions;

			// Initialize muxer
			this.muxer = new VideoMuxer(
				{
					width: this.activeConfig.width,
					height: this.activeConfig.height,
					frameRate: this.activeConfig.frameRate,
					bitrate: this.activeConfig.bitrate,
					codec: this.resolvedCodec ?? this.activeConfig.codecCandidates[0],
				},
				hasAudio,
			);
			await this.muxer.initialize();

			// Calculate effective duration and frame count (excluding trim regions)
			const effectiveDuration = this.streamingDecoder.getEffectiveDuration(
				this.config.trimRegions,
				this.config.speedRegions,
			);
			const totalFrames = Math.ceil(effectiveDuration * this.activeConfig.frameRate);

			console.log("[VideoExporter] Original duration:", videoInfo.duration, "s");
			console.log("[VideoExporter] Effective duration:", effectiveDuration, "s");
			console.log("[VideoExporter] Total frames to export:", totalFrames);
			console.log("[VideoExporter] Using streaming decode (web-demuxer + VideoDecoder)");

			const frameDuration = 1_000_000 / this.activeConfig.frameRate; // in microseconds
			let frameIndex = 0;
			this.reportPhase("decoding", 0, totalFrames);

			// Stream decode and process frames — no seeking!
			await this.streamingDecoder.decodeAll(
				this.activeConfig.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const timestamp = frameIndex * frameDuration;
					const sourceTimestampUs = sourceTimestampMs * 1000;
					this.reportPhase("rendering", frameIndex, totalFrames);
					await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					videoFrame.close();

					this.reportPhase("encoding", frameIndex, totalFrames);
					await this.encodeRenderedFrame(timestamp, frameDuration, frameIndex);
					frameIndex++;
					this.reportProgress(frameIndex, totalFrames);
				},
			);

			if (this.cancelled) {
				return { success: false, error: "Export cancelled" };
			}

			// Finalize encoding
			if (this.encoder && this.encoder.state === "configured") {
				this.reportPhase("encoding", totalFrames, totalFrames);
				await this.awaitWithWindowsTimeout(this.encoder.flush(), "encoder flush");
			}

			// Wait for queued muxing operations to complete
			this.reportPhase("muxing", totalFrames, totalFrames);
			await this.awaitWithWindowsTimeout(this.pendingMuxing, "muxing queued video chunks");

			if (hasAudio && !this.cancelled) {
				const demuxer = this.streamingDecoder.getDemuxer();
				if (demuxer || hasAudioRegions) {
					this.audioProcessor = new AudioProcessor();
					await this.awaitWithWindowsTimeout(
						this.audioProcessor.process(
							demuxer!,
							this.muxer!,
							this.config.videoUrl,
							this.config.trimRegions,
							this.config.speedRegions,
							undefined,
							this.config.audioRegions,
						),
						"audio processing",
					);
				}
			}

			// Finalize muxer and get output blob
			this.reportPhase("finalizing", totalFrames, totalFrames);
			const blob = await this.awaitWithWindowsTimeout(this.muxer!.finalize(), "muxer finalization");

			return {
				success: true,
				blob,
				details: {
					format: "mp4",
					width: this.activeConfig.width,
					height: this.activeConfig.height,
					frameRate: this.activeConfig.frameRate,
					bitrate: this.activeConfig.bitrate,
					codec: this.resolvedCodec ?? this.config.codec,
					codecLabel: getCodecLabel(this.resolvedCodec ?? this.config.codec ?? "avc1.4d401f"),
					elapsedMs: Math.round(performance.now() - this.exportStartedAtMs),
					fileSizeBytes: blob.size,
					fallbackSteps: this.resolvedFallbackSteps,
					fallbackApplied: this.resolvedFallbackSteps.length > 0,
					fallbackReason: this.resolvedFallbackSteps[0],
					warnings: this.warnings,
				},
			};
		} catch (error) {
			console.error("Export error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.cleanup();
		}
	}

	private isWindowsPlatform(): boolean {
		if (typeof navigator === "undefined") {
			return false;
		}
		return /Win/i.test(navigator.platform);
	}

	private async awaitWithWindowsTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
		if (!this.isWindowsPlatform()) {
			return promise;
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		try {
			return await Promise.race([
				promise,
				new Promise<T>((_, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error(`Export timed out during ${stage} on Windows`));
					}, this.WINDOWS_FINALIZATION_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		}
	}

	private async encodeRenderedFrame(timestamp: number, frameDuration: number, frameIndex: number) {
		const canvas = this.renderer!.getCanvas();

		// @ts-expect-error - colorSpace not in TypeScript definitions but works at runtime
		const exportFrame = new VideoFrame(canvas, {
			timestamp,
			duration: frameDuration,
			colorSpace: {
				primaries: "bt709",
				transfer: "iec61966-2-1",
				matrix: "rgb",
				fullRange: true,
			},
		});

		while (this.encoder && this.encoder.encodeQueueSize >= this.maxEncodeQueue && !this.cancelled) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		if (this.encoder && this.encoder.state === "configured") {
			this.encodeQueue++;
			this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
		} else {
			console.warn(`[Frame ${frameIndex}] Encoder not ready! State: ${this.encoder?.state}`);
		}

		exportFrame.close();
	}

	private reportProgress(currentFrame: number, totalFrames: number) {
		if (this.config.onProgress) {
			const elapsedMs = Math.max(performance.now() - this.exportStartedAtMs, 1);
			const throughputFps = (currentFrame / elapsedMs) * 1000;
			const remainingFrames = Math.max(totalFrames - currentFrame, 0);
			const etaSeconds = throughputFps > 0 ? remainingFrames / throughputFps : 0;
			this.config.onProgress({
				currentFrame,
				totalFrames,
				percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 100,
				estimatedTimeRemaining: etaSeconds,
				etaSeconds,
				throughputFps,
				phase: this.lastReportedPhase ?? "rendering",
				warnings: this.warnings,
			});
		}
	}

	private reportPhase(
		phase: ExportProgress["phase"],
		currentFrame = 0,
		totalFrames = Math.max(currentFrame, 1),
	) {
		this.lastReportedPhase = phase;
		if (!this.config.onProgress || !phase) {
			return;
		}

		const elapsedMs = Math.max(performance.now() - this.exportStartedAtMs, 1);
		const throughputFps = currentFrame > 0 ? (currentFrame / elapsedMs) * 1000 : 0;
		this.config.onProgress({
			currentFrame,
			totalFrames,
			percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0,
			estimatedTimeRemaining: 0,
			etaSeconds: 0,
			throughputFps,
			phase,
			warnings: this.warnings,
		});
	}

	private getEncoderSupportCacheKey(config: VideoEncoderConfig): string {
		return JSON.stringify({
			width: config.width,
			height: config.height,
			bitrate: config.bitrate,
			framerate: config.framerate,
			codec: config.codec,
			hardwareAcceleration: config.hardwareAcceleration,
			bitrateMode: config.bitrateMode,
			latencyMode: config.latencyMode,
		});
	}

	private async isEncoderConfigSupported(config: VideoEncoderConfig): Promise<boolean> {
		const cacheKey = this.getEncoderSupportCacheKey(config);
		const cached = this.encoderSupportCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		const support = await VideoEncoder.isConfigSupported(config);
		const isSupported = support.supported === true;
		this.encoderSupportCache.set(cacheKey, isSupported);
		return isSupported;
	}

	private async resolveEncoderCandidate(): Promise<ActiveVideoExportConfig> {
		const candidateList =
			this.config.encoderCandidates && this.config.encoderCandidates.length > 0
				? this.config.encoderCandidates
				: [
						{
							width: this.config.width,
							height: this.config.height,
							frameRate: this.config.frameRate,
							bitrate: this.config.bitrate,
							codecCandidates:
								this.config.codecCandidates?.length && this.config.codecCandidates.length > 0
									? this.config.codecCandidates
									: this.config.codec
										? [this.config.codec]
										: ["avc1.640033", "avc1.4d4033", "avc1.420033", "avc1.4d401f", "avc1.42001f"],
							fallbackSteps: [],
						},
					];

		const baseFallbackSteps = this.config.fallbackSteps ?? [];
		for (const candidate of candidateList) {
			for (const codec of candidate.codecCandidates) {
				for (const hardwareAcceleration of ["prefer-hardware", "prefer-software"] as const) {
					const encoderConfig: VideoEncoderConfig = {
						width: candidate.width,
						height: candidate.height,
						bitrate: candidate.bitrate,
						framerate: candidate.frameRate,
						latencyMode: "quality",
						bitrateMode: "variable",
						codec,
						hardwareAcceleration,
					};
					const isSupported = await this.isEncoderConfigSupported(encoderConfig);
					if (isSupported) {
						this.resolvedCodec = codec;
						this.resolvedFallbackSteps = [...baseFallbackSteps, ...candidate.fallbackSteps];
						if (codec !== candidate.codecCandidates[0]) {
							this.resolvedFallbackSteps.push(
								`Used ${getCodecLabel(codec)} profile for compatibility.`,
							);
						}
						return {
							width: candidate.width,
							height: candidate.height,
							frameRate: candidate.frameRate,
							bitrate: candidate.bitrate,
							codecCandidates: [codec],
							hardwareAcceleration,
							fallbackSteps: this.resolvedFallbackSteps,
						};
					}
				}
			}

			console.warn(
				`[VideoExporter] No supported codec found for ${candidate.width}x${candidate.height} at ${candidate.frameRate} FPS.`,
			);
		}

		throw new Error(
			"Video encoding is not supported with the requested settings on this system. Try a lower resolution or frame rate.",
		);
	}

	private async initializeEncoder(activeConfig: ActiveVideoExportConfig): Promise<void> {
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		let videoDescription: Uint8Array | undefined;
		const resolvedCodec = activeConfig.codecCandidates[0] ?? this.config.codec ?? "avc1.640033";

		this.encoder = new VideoEncoder({
			output: (chunk, meta) => {
				// Capture decoder config metadata from encoder output
				if (meta?.decoderConfig?.description && !videoDescription) {
					const desc = meta.decoderConfig.description;
					videoDescription = ArrayBuffer.isView(desc)
						? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
						: new Uint8Array(desc);
					this.videoDescription = videoDescription;
				}
				// Capture colorSpace from encoder metadata if provided
				if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
					this.videoColorSpace = meta.decoderConfig.colorSpace;
				}

				// Stream chunks to muxer in order without retaining an ever-growing promise array
				const isFirstChunk = this.chunkCount === 0;
				this.chunkCount++;

				this.pendingMuxing = this.pendingMuxing.then(async () => {
					try {
						if (isFirstChunk && this.videoDescription) {
							// Add decoder config for the first chunk
							const colorSpace = this.videoColorSpace || {
								primaries: "bt709",
								transfer: "iec61966-2-1",
								matrix: "rgb",
								fullRange: true,
							};

							const metadata: EncodedVideoChunkMetadata = {
								decoderConfig: {
									codec: resolvedCodec,
									codedWidth: activeConfig.width,
									codedHeight: activeConfig.height,
									description: this.videoDescription,
									colorSpace,
								},
							};

							await this.muxer!.addVideoChunk(chunk, metadata);
						} else {
							await this.muxer!.addVideoChunk(chunk, meta);
						}
					} catch (error) {
						console.error("Muxing error:", error);
					}
				});
				this.encodeQueue--;
			},
			error: (error) => {
				console.error(
					`[VideoExporter] Encoder error (codec: ${resolvedCodec}, ${activeConfig.width}x${activeConfig.height}):`,
					error,
				);
				// Stop export — encoding failed
				this.cancelled = true;
			},
		});

		const baseConfig: VideoEncoderConfig = {
			width: activeConfig.width,
			height: activeConfig.height,
			bitrate: activeConfig.bitrate,
			framerate: activeConfig.frameRate,
			latencyMode: "quality",
			bitrateMode: "variable",
			codec: resolvedCodec,
			hardwareAcceleration: activeConfig.hardwareAcceleration,
		};

		this.encoder.configure(baseConfig);
	}

	cancel(): void {
		this.cancelled = true;
		if (this.streamingDecoder) {
			this.streamingDecoder.cancel();
		}
		if (this.audioProcessor) {
			this.audioProcessor.cancel();
		}
		this.cleanup();
	}

	private cleanup(): void {
		if (this.encoder) {
			try {
				if (this.encoder.state === "configured") {
					this.encoder.close();
				}
			} catch (e) {
				console.warn("Error closing encoder:", e);
			}
			this.encoder = null;
		}

		if (this.streamingDecoder) {
			try {
				this.streamingDecoder.destroy();
			} catch (e) {
				console.warn("Error destroying streaming decoder:", e);
			}
			this.streamingDecoder = null;
		}

		if (this.renderer) {
			try {
				this.renderer.destroy();
			} catch (e) {
				console.warn("Error destroying renderer:", e);
			}
			this.renderer = null;
		}

		this.muxer = null;
		this.audioProcessor = null;
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		this.videoDescription = undefined;
		this.videoColorSpace = undefined;
		this.activeConfig = null;
		this.resolvedFallbackSteps = [];
		this.resolvedCodec = undefined;
		this.encoderSupportCache.clear();
	}
}
