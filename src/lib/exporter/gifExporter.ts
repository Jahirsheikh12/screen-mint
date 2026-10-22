import type {
	AnnotationRegion,
	CameraLayoutRegion,
	CaptionRegion,
	CaptionSettings,
	CropRegion,
	CursorClickStyleSettings,
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
	PaddingValue,
	SpeedRegion,
	TrimRegion,
	WebcamEffects,
	WebcamRegion,
	ZoomRegion,
	ZoomTemporalBlurSettings,
	ZoomTimingSettings,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { shouldYieldExportFrame, yieldToExportScheduler } from "./exportScheduler";
import { FrameRenderer } from "./frameRenderer";
import { StreamingVideoDecoder } from "./streamingDecoder";
import type {
	ExportDetails,
	ExportProgress,
	ExportResult,
	GifColorCount,
	GifDitherMode,
	GifExportPreset,
	GifFrameRate,
	GifMotionSensitivity,
	GifSizePreset,
} from "./types";
import { GIF_EXPORT_PRESETS, GIF_SIZE_PRESETS } from "./types";

const GIF_ENCODER_WORKER_URL = new URL("./gifEncoder.worker.ts", import.meta.url);

interface GifExporterConfig {
	videoUrl: string;
	width: number;
	height: number;
	frameRate: GifFrameRate;
	loop: boolean;
	preset: GifExportPreset;
	dedupeFrames: boolean;
	colorCount: GifColorCount;
	ditherMode: GifDitherMode;
	motionSensitivity: GifMotionSensitivity;
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
	zoomTemporalBlur?: ZoomTemporalBlurSettings;
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	deviceMockup?: DeviceMockup;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	borderRadius?: number;
	padding?: PaddingValue;
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
	clickEffectsEnabled?: boolean;
	clickHighlightColor?: string;
	clickHighlightSize?: number;
	clickHighlightOpacity?: number;
	cursorClickStyle?: CursorClickStyleSettings;
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
	previewWidth?: number;
	previewHeight?: number;
	webcamPath?: string | null;
	webcamRegion?: WebcamRegion;
	webcamEffects?: WebcamEffects;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	captionRegions?: CaptionRegion[];
	captionSettings?: CaptionSettings;
	outputPath?: string;
	jobId?: string;
	onProgress?: (progress: ExportProgress) => void;
}

type LegacyOrModernGifPreset = GifSizePreset | GifExportPreset;

const PRESET_MAX_HEIGHTS: Record<LegacyOrModernGifPreset, { maxHeight: number }> = {
	medium: { maxHeight: 720 },
	large: { maxHeight: 1080 },
	original: { maxHeight: Number.POSITIVE_INFINITY },
	"small-share": { maxHeight: 480 },
	balanced: { maxHeight: 720 },
	quality: { maxHeight: 1080 },
};

export function calculateOutputDimensions(
	sourceWidth: number,
	sourceHeight: number,
	sizePreset: LegacyOrModernGifPreset,
	sizePresets:
		| typeof GIF_SIZE_PRESETS
		| typeof GIF_EXPORT_PRESETS
		| Record<LegacyOrModernGifPreset, { maxHeight: number }>,
): { width: number; height: number } {
	const presetMap = sizePresets as Record<string, { maxHeight: number }>;
	const preset = presetMap[sizePreset] ?? PRESET_MAX_HEIGHTS[sizePreset];
	const maxHeight = preset.maxHeight;

	if (sourceHeight <= maxHeight || sizePreset === "original") {
		return { width: sourceWidth, height: sourceHeight };
	}

	const aspectRatio = sourceWidth / sourceHeight;
	const newHeight = maxHeight;
	const newWidth = Math.round(newHeight * aspectRatio);

	return {
		width: newWidth % 2 === 0 ? newWidth : newWidth + 1,
		height: newHeight % 2 === 0 ? newHeight : newHeight + 1,
	};
}

interface GifWorkerProgressMessage {
	type: "progress";
	progress: number;
	dedupedFrames: number;
}

interface GifWorkerDoneMessage {
	type: "done";
	buffer: ArrayBuffer;
	dedupedFrames: number;
}

interface GifWorkerErrorMessage {
	type: "error";
	error: string;
}

interface GifWorkerFrameAcceptedMessage {
	type: "frame-accepted";
	dedupedFrames: number;
}

interface GifWorkerEncodeReadyMessage {
	type: "encode-ready";
	dedupedFrames: number;
}

type GifWorkerMessage =
	| GifWorkerProgressMessage
	| GifWorkerDoneMessage
	| GifWorkerErrorMessage
	| GifWorkerFrameAcceptedMessage
	| GifWorkerEncodeReadyMessage;

function getMotionDedupeThreshold(motionSensitivity: GifMotionSensitivity): number {
	switch (motionSensitivity) {
		case "low":
			return 12;
		case "high":
			return 4;
		case "balanced":
		default:
			return 8;
	}
}

export class GifExporter {
	private config: GifExporterConfig;
	private streamingDecoder: StreamingVideoDecoder | null = null;
	private renderer: FrameRenderer | null = null;
	private worker: Worker | null = null;
	private cancelled = false;
	private exportStartedAtMs = 0;

	constructor(config: GifExporterConfig) {
		this.config = config;
	}

	private async createRenderer(videoInfo: { width: number; height: number }) {
		const renderer = new FrameRenderer({
			width: this.config.width,
			height: this.config.height,
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
			zoomTemporalBlur: this.config.zoomTemporalBlur,
			connectZooms: this.config.connectZooms,
			zoomTiming: this.config.zoomTiming,
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
			clickEffectsEnabled: this.config.clickEffectsEnabled,
			clickHighlightColor: this.config.clickHighlightColor,
			clickHighlightSize: this.config.clickHighlightSize,
			clickHighlightOpacity: this.config.clickHighlightOpacity,
			cursorClickStyle: this.config.cursorClickStyle,
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
			webcamEffects: this.config.webcamEffects,
			showWebcam: this.config.showWebcam,
			mirrorWebcam: this.config.mirrorWebcam,
			cameraSizeDuringZoom: this.config.cameraSizeDuringZoom,
			cameraLayouts: this.config.cameraLayouts,
			captionRegions: this.config.captionRegions,
			captionSettings: this.config.captionSettings,
		});
		await renderer.initialize();
		return renderer;
	}

	private getCanvasContext(renderer: FrameRenderer) {
		const canvasCtx = renderer.getCanvas().getContext("2d", { willReadFrequently: true });
		if (!canvasCtx) {
			throw new Error("Failed to read rendered GIF frames");
		}
		return canvasCtx;
	}

	async export(): Promise<ExportResult> {
		try {
			this.cleanup();
			this.cancelled = false;
			this.exportStartedAtMs = performance.now();
			this.reportProgress(0, 1, "preparing");

			this.streamingDecoder = new StreamingVideoDecoder();
			const videoInfo = await this.streamingDecoder.loadMetadata(this.config.videoUrl);

			this.renderer = await this.createRenderer(videoInfo);

			const effectiveDuration = this.streamingDecoder.getEffectiveDuration(
				this.config.trimRegions,
				this.config.speedRegions,
			);
			const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);
			const frameDelay = Math.round(1000 / this.config.frameRate);
			const warnings = [
				effectiveDuration > 15
					? "Long GIF exports can be large and slow. MP4 may share better."
					: null,
			].filter((warning): warning is string => Boolean(warning));

			this.reportProgress(0, totalFrames, "decoding", undefined, warnings);
			let canvasCtx = this.getCanvasContext(this.renderer);

			if (this.config.outputPath) {
				try {
					return await this.exportWithFfmpegPipe({
						canvasCtx,
						effectiveDuration,
						totalFrames,
						warnings,
					});
				} catch (error) {
					if (this.cancelled) {
						return { success: false, error: "Export cancelled" };
					}
					console.warn(
						"[GifExporter] FFmpeg GIF pipe failed; falling back to worker encoder:",
						error,
					);
					this.streamingDecoder?.destroy();
					this.streamingDecoder = new StreamingVideoDecoder();
					await this.streamingDecoder.loadMetadata(this.config.videoUrl);
					// The failed pass advanced the renderer's camera, spring and motion-blur state;
					// start the fallback from a fresh one so it renders like a first pass.
					this.renderer.destroy();
					this.renderer = await this.createRenderer(videoInfo);
					canvasCtx = this.getCanvasContext(this.renderer);
					this.reportProgress(0, totalFrames, "rendering", undefined, [
						...warnings,
						"FFmpeg GIF encoder failed; using slower fallback encoder.",
					]);
				}
			}

			this.worker = new Worker(GIF_ENCODER_WORKER_URL, { type: "module" });
			this.worker.postMessage({
				type: "init",
				width: this.config.width,
				height: this.config.height,
				loop: this.config.loop,
				dedupeFrames: this.config.dedupeFrames,
				colorCount: this.config.colorCount,
				ditherMode: this.config.ditherMode,
				dedupeThreshold: getMotionDedupeThreshold(this.config.motionSensitivity),
			});

			let frameIndex = 0;
			await this.streamingDecoder.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const sourceTimestampUs = sourceTimestampMs * 1000;
					this.reportProgress(frameIndex, totalFrames, "rendering", undefined, warnings);
					try {
						await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					} finally {
						videoFrame.close();
					}

					const imageData = canvasCtx.getImageData(0, 0, this.config.width, this.config.height);
					await this.postFrameToWorker(imageData.data.buffer, frameDelay, "sample-frame");
					frameIndex++;
					if (shouldYieldExportFrame(frameIndex)) {
						await yieldToExportScheduler();
					}
					this.reportProgress(frameIndex, totalFrames, "rendering", undefined, warnings);
				},
			);

			if (this.cancelled) {
				return { success: false, error: "Export cancelled" };
			}

			const sampledFrames = await this.prepareWorkerEncoding();
			if (sampledFrames === 0) {
				throw new Error("No frames were available for GIF export");
			}

			frameIndex = 0;
			await this.streamingDecoder.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const sourceTimestampUs = sourceTimestampMs * 1000;
					try {
						await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					} finally {
						videoFrame.close();
					}

					const imageData = canvasCtx.getImageData(0, 0, this.config.width, this.config.height);
					await this.postFrameToWorker(imageData.data.buffer, frameDelay, "frame");
					frameIndex++;
					if (shouldYieldExportFrame(frameIndex)) {
						await yieldToExportScheduler();
					}
					this.reportProgress(frameIndex, totalFrames, "encoding", undefined, warnings);
				},
			);

			if (this.cancelled) {
				return { success: false, error: "Export cancelled" };
			}

			this.reportProgress(totalFrames, totalFrames, "finalizing", 0, warnings);
			const { blob, dedupedFrames } = await this.finalizeWorker(totalFrames, warnings);
			let outputPath = this.config.outputPath;
			let fileSizeBytes = blob.size;
			if (outputPath) {
				const streamResult = await window.electronAPI.exportV2StreamStart(outputPath);
				if (!streamResult.success || !streamResult.id) {
					throw new Error(streamResult.error || "Failed to start GIF export stream");
				}
				try {
					const arrayBuffer = await blob.arrayBuffer();
					const appendResult = await window.electronAPI.exportV2StreamAppend(
						streamResult.id,
						arrayBuffer,
						0,
					);
					if (!appendResult.success) {
						throw new Error(appendResult.error || "Failed to write GIF export stream");
					}
					const finishResult = await window.electronAPI.exportV2StreamFinish(streamResult.id);
					if (!finishResult.success || !finishResult.path) {
						throw new Error(finishResult.error || "Failed to finish GIF export stream");
					}
					outputPath = finishResult.path;
					fileSizeBytes = finishResult.bytesWritten ?? fileSizeBytes;
				} catch (error) {
					await window.electronAPI.exportV2StreamDiscard(streamResult.id).catch(() => undefined);
					throw error;
				}
			}

			const details: ExportDetails = {
				format: "gif",
				width: this.config.width,
				height: this.config.height,
				frameRate: this.config.frameRate,
				colorCount: this.config.colorCount,
				ditherMode: this.config.ditherMode,
				motionSensitivity: this.config.motionSensitivity,
				loop: this.config.loop,
				dedupeFrames: this.config.dedupeFrames,
				elapsedMs: Math.round(performance.now() - this.exportStartedAtMs),
				fileSizeBytes,
				engine: outputPath ? "composited-hardware" : undefined,
				dedupedFrames,
				paletteMode: "worker-two-pass",
				warnings,
			};

			return {
				success: true,
				blob: outputPath ? undefined : blob,
				path: outputPath,
				details,
			};
		} catch (error) {
			console.error("GIF Export error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.cleanup();
		}
	}

	private async exportWithFfmpegPipe({
		canvasCtx,
		effectiveDuration,
		totalFrames,
		warnings,
	}: {
		canvasCtx: CanvasRenderingContext2D;
		effectiveDuration: number;
		totalFrames: number;
		warnings: string[];
	}): Promise<ExportResult> {
		const outputPath = this.config.outputPath;
		if (!outputPath) {
			throw new Error("FFmpeg GIF pipe requires an output path");
		}

		const startResult = await window.electronAPI.exportV2GifPipeStart({
			jobId: this.config.jobId,
			outputPath,
			width: this.config.width,
			height: this.config.height,
			frameRate: this.config.frameRate,
			durationMs: Math.round(effectiveDuration * 1000),
			gif: {
				colorCount: this.config.colorCount,
				ditherMode: this.config.ditherMode,
				motionSensitivity: this.config.motionSensitivity,
				loop: this.config.loop,
				dedupeFrames: this.config.dedupeFrames,
			},
		});
		if (!startResult.success || !startResult.id) {
			throw new Error(startResult.error || "Failed to start FFmpeg GIF encoder");
		}

		const sessionId = startResult.id;
		let frameIndex = 0;
		try {
			await this.streamingDecoder!.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const sourceTimestampUs = sourceTimestampMs * 1000;
					this.reportProgress(frameIndex, totalFrames, "rendering", undefined, warnings);
					try {
						await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					} finally {
						videoFrame.close();
					}

					const imageData = canvasCtx.getImageData(0, 0, this.config.width, this.config.height);
					const frameBuffer = imageData.data.buffer.slice(
						imageData.data.byteOffset,
						imageData.data.byteOffset + imageData.data.byteLength,
					);
					const appendResult = await window.electronAPI.exportV2GifPipeAppend(
						sessionId,
						frameBuffer,
					);
					if (!appendResult.success) {
						throw new Error(appendResult.error || "Failed to stream GIF frame to FFmpeg");
					}

					frameIndex++;
					if (shouldYieldExportFrame(frameIndex)) {
						await yieldToExportScheduler();
					}
					this.reportProgress(frameIndex, totalFrames, "rendering", undefined, warnings);
				},
			);

			if (this.cancelled) {
				await window.electronAPI.exportV2GifPipeDiscard(sessionId).catch(() => undefined);
				return { success: false, error: "Export cancelled" };
			}

			this.reportProgress(totalFrames, totalFrames, "finalizing", 0, warnings);
			const finishResult = await window.electronAPI.exportV2GifPipeFinish(sessionId);
			if (!finishResult.success || !finishResult.path) {
				throw new Error(finishResult.error || "Failed to finish FFmpeg GIF encoder");
			}

			const elapsedMs = Math.round(performance.now() - this.exportStartedAtMs);
			const details: ExportDetails = {
				format: "gif",
				width: this.config.width,
				height: this.config.height,
				frameRate: this.config.frameRate,
				colorCount: this.config.colorCount,
				ditherMode: this.config.ditherMode,
				motionSensitivity: this.config.motionSensitivity,
				loop: this.config.loop,
				dedupeFrames: this.config.dedupeFrames,
				elapsedMs,
				fileSizeBytes: finishResult.bytesWritten,
				engine: "composited-hardware",
				encoder: "ffmpeg-palette",
				hardwareAcceleration: "software",
				throughputFps: totalFrames > 0 ? (totalFrames / Math.max(elapsedMs, 1)) * 1000 : undefined,
				paletteMode: "ffmpeg",
				warnings,
			};

			return {
				success: true,
				path: finishResult.path,
				details,
			};
		} catch (error) {
			await window.electronAPI.exportV2GifPipeDiscard(sessionId).catch(() => undefined);
			throw error;
		}
	}

	private finalizeWorker(totalFrames: number, warnings: string[]) {
		return new Promise<{ blob: Blob; dedupedFrames: number }>((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("GIF worker not initialized"));
				return;
			}

			const worker = this.worker;
			const handleMessage = (event: MessageEvent<GifWorkerMessage>) => {
				const message = event.data;
				if (message.type === "progress") {
					this.reportProgress(
						totalFrames,
						totalFrames,
						"finalizing",
						Math.round(message.progress * 100),
						warnings,
					);
					return;
				}
				if (message.type === "frame-accepted") {
					return;
				}
				if (message.type === "encode-ready") {
					return;
				}

				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);

				if (message.type === "error") {
					reject(new Error(message.error));
					return;
				}

				if (message.type !== "done") {
					reject(new Error("Unexpected GIF worker response"));
					return;
				}

				resolve({
					blob: new Blob([message.buffer], { type: "image/gif" }),
					dedupedFrames: message.dedupedFrames,
				});
			};

			const handleError = (event: ErrorEvent) => {
				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);
				reject(new Error(event.message || "Failed to encode GIF"));
			};

			worker.addEventListener("message", handleMessage);
			worker.addEventListener("error", handleError);
			worker.postMessage({ type: "finalize" });
		});
	}

	private prepareWorkerEncoding() {
		return new Promise<number>((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("GIF worker not initialized"));
				return;
			}

			const worker = this.worker;
			const handleMessage = (event: MessageEvent<GifWorkerMessage>) => {
				const message = event.data;
				if (message.type !== "encode-ready" && message.type !== "error") {
					return;
				}
				cleanup();
				if (message.type === "error") {
					reject(new Error(message.error));
					return;
				}
				resolve(message.dedupedFrames);
			};
			const handleError = (event: ErrorEvent) => {
				cleanup();
				reject(new Error(event.message || "Failed to prepare GIF encoder"));
			};
			const cleanup = () => {
				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);
			};

			worker.addEventListener("message", handleMessage);
			worker.addEventListener("error", handleError);
			worker.postMessage({ type: "prepare-encode" });
		});
	}

	private postFrameToWorker(
		rgba: ArrayBuffer,
		delay: number,
		messageType: "sample-frame" | "frame",
	) {
		return new Promise<void>((resolve, reject) => {
			if (!this.worker) {
				reject(new Error("GIF worker not initialized"));
				return;
			}

			const worker = this.worker;
			const handleMessage = (event: MessageEvent<GifWorkerMessage>) => {
				const message = event.data;
				if (message.type !== "frame-accepted" && message.type !== "error") {
					return;
				}
				cleanup();
				if (message.type === "error") {
					reject(new Error(message.error));
					return;
				}
				resolve();
			};
			const handleError = (event: ErrorEvent) => {
				cleanup();
				reject(new Error(event.message || "Failed to encode GIF frame"));
			};
			const cleanup = () => {
				worker.removeEventListener("message", handleMessage);
				worker.removeEventListener("error", handleError);
			};

			worker.addEventListener("message", handleMessage);
			worker.addEventListener("error", handleError);
			worker.postMessage(
				{
					type: messageType,
					rgba,
					delay,
				},
				[rgba],
			);
		});
	}

	private reportProgress(
		currentFrame: number,
		totalFrames: number,
		phase: ExportProgress["phase"],
		renderProgress?: number,
		warnings?: string[],
	) {
		if (!this.config.onProgress) {
			return;
		}

		const elapsedMs = Math.max(performance.now() - this.exportStartedAtMs, 1);
		const throughputFps = currentFrame > 0 ? (currentFrame / elapsedMs) * 1000 : 0;
		const remainingFrames = Math.max(totalFrames - currentFrame, 0);
		const etaSeconds = throughputFps > 0 ? remainingFrames / throughputFps : 0;

		this.config.onProgress({
			currentFrame,
			totalFrames,
			percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 100,
			estimatedTimeRemaining: etaSeconds,
			etaSeconds,
			throughputFps,
			phase,
			renderProgress,
			warnings,
		});
	}

	cancel(): void {
		this.cancelled = true;
		if (this.streamingDecoder) {
			this.streamingDecoder.cancel();
		}
		this.worker?.postMessage({ type: "cancel" });
		this.cleanup();
	}

	private cleanup(): void {
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

		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}
}
