import type { ImageSegmenter as MediaPipeImageSegmenter, MPMask } from "@mediapipe/tasks-vision";
import { getAssetPath } from "@/lib/assetPath";

export type WebcamSegmentationProviderKind = "mediapipe" | "none";
export type WebcamSegmentationMode = "preview" | "export";
export type WebcamSegmentationRefinementMode = "sync" | "none";

export interface WebcamSegmentationQualityStats {
	foregroundCoverage: number;
	edgeCoverage: number;
	temporalWeight: number;
}

export interface WebcamSegmentationFrame {
	width: number;
	height: number;
	workingWidth: number;
	workingHeight: number;
	timestampMs: number;
	rawMask: HTMLCanvasElement | OffscreenCanvas | null;
	refinedMask: HTMLCanvasElement | OffscreenCanvas | null;
	mask: HTMLCanvasElement | OffscreenCanvas | null;
	confidenceBuffer?: ArrayBuffer | null;
	provider: WebcamSegmentationProviderKind;
	quality: WebcamSegmentationQualityStats;
}

export interface WebcamSegmentationRequestOptions {
	mode?: WebcamSegmentationMode;
	workingMaxEdge?: number;
	refinementMode?: WebcamSegmentationRefinementMode;
	previousAlpha?: Uint8ClampedArray | null;
}

export interface WebcamSegmentationProvider {
	provider: WebcamSegmentationProviderKind;
	segment(
		source: TexImageSource,
		timestampMs: number,
		options?: WebcamSegmentationRequestOptions,
	): Promise<WebcamSegmentationFrame | null>;
	close(): void;
}

export interface WebcamMaskRefinementOptions {
	lowThreshold: number;
	highThreshold: number;
	speckleRadius: number;
	holeRadius: number;
	blurRadius: number;
	temporalSmoothing: number;
}

export interface WebcamMaskRefinementResult {
	rawAlpha: Uint8ClampedArray;
	refinedAlpha: Uint8ClampedArray;
	quality: WebcamSegmentationQualityStats;
}

interface MediaPipeTasksModule {
	FilesetResolver: {
		forVisionTasks(basePath?: string, useModule?: boolean): Promise<unknown>;
	};
	ImageSegmenter: {
		createFromOptions(
			wasmFileset: unknown,
			options: {
				baseOptions: {
					modelAssetPath: string;
				};
				runningMode: "VIDEO";
				outputConfidenceMasks: boolean;
				outputCategoryMask: boolean;
			},
		): Promise<MediaPipeImageSegmenter>;
	};
}

const DEFAULT_MASK_REFINEMENT_OPTIONS: WebcamMaskRefinementOptions = {
	lowThreshold: 0.08,
	highThreshold: 0.92,
	speckleRadius: 1,
	holeRadius: 1,
	blurRadius: 1,
	temporalSmoothing: 0.78,
};

const DEFAULT_SEGMENTATION_QUALITY: WebcamSegmentationQualityStats = {
	foregroundCoverage: 0,
	edgeCoverage: 0,
	temporalWeight: 1,
};

const SEGMENTATION_SESSION_RESET_GAP_MS = 500;

let mediaPipeTasksPromise: Promise<MediaPipeTasksModule> | null = null;
let mediaPipeFilesetPromise: Promise<unknown> | null = null;
let mediaPipeModelPathPromise: Promise<string> | null = null;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function createCanvas(width: number, height: number) {
	if (typeof OffscreenCanvas !== "undefined") {
		return new OffscreenCanvas(width, height);
	}

	if (typeof document === "undefined") {
		const noop = () => {
			// Headless tests only need a shape-compatible canvas/context.
		};
		const fallbackContext = {
			clearRect: noop,
			createImageData: (w: number, h: number) => ({
				width: w,
				height: h,
				data: new Uint8ClampedArray(w * h * 4),
			}),
			putImageData: noop,
			drawImage: noop,
			imageSmoothingEnabled: true,
			setTransform: noop,
		} as unknown as CanvasRenderingContext2D;
		return {
			width,
			height,
			getContext: () => fallbackContext,
		} as unknown as HTMLCanvasElement;
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
	return canvas.getContext("2d", {
		alpha: true,
		willReadFrequently: false,
	}) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

function getSourceSize(source: TexImageSource) {
	if (source instanceof HTMLVideoElement) {
		return {
			width: source.videoWidth,
			height: source.videoHeight,
		};
	}

	if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
		return {
			width: source.displayWidth || source.codedWidth,
			height: source.displayHeight || source.codedHeight,
		};
	}

	if (source instanceof ImageBitmap) {
		return {
			width: source.width,
			height: source.height,
		};
	}

	if (source instanceof HTMLCanvasElement) {
		return {
			width: source.width,
			height: source.height,
		};
	}

	if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
		return {
			width: source.width,
			height: source.height,
		};
	}

	if (source instanceof HTMLImageElement) {
		return {
			width: source.naturalWidth || source.width,
			height: source.naturalHeight || source.height,
		};
	}

	return {
		width: 0,
		height: 0,
	};
}

export function scaleDimensionsToMaxEdge(width: number, height: number, maxLongEdge: number) {
	if (width <= 0 || height <= 0 || maxLongEdge <= 0) {
		return { width: 0, height: 0 };
	}

	const longEdge = Math.max(width, height);
	if (longEdge <= maxLongEdge) {
		return { width, height };
	}

	const scale = maxLongEdge / longEdge;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

function normalizeConfidenceValues(mask: MPMask) {
	if (mask.hasFloat32Array()) {
		const values = mask.getAsFloat32Array();
		return new Float32Array(values);
	}

	if (mask.hasUint8Array()) {
		const values = mask.getAsUint8Array();
		const normalized = new Float32Array(values.length);
		for (let index = 0; index < values.length; index += 1) {
			normalized[index] = values[index] / 255;
		}
		return normalized;
	}

	return null;
}

function softThresholdConfidence(value: number, low: number, high: number) {
	const normalized = (value - low) / Math.max(high - low, 0.0001);
	return clamp(normalized, 0, 1);
}

function createAlphaBuffer(length: number) {
	return new Uint8ClampedArray(length);
}

export function shouldResetSegmentationSession(
	previousTimestampMs: number | null,
	nextTimestampMs: number,
	maxGapMs = SEGMENTATION_SESSION_RESET_GAP_MS,
) {
	if (!Number.isFinite(nextTimestampMs)) {
		return true;
	}

	if (previousTimestampMs == null || !Number.isFinite(previousTimestampMs)) {
		return false;
	}

	return nextTimestampMs <= previousTimestampMs || nextTimestampMs - previousTimestampMs > maxGapMs;
}

export function remapConfidenceMask(
	confidence: ArrayLike<number>,
	lowThreshold = DEFAULT_MASK_REFINEMENT_OPTIONS.lowThreshold,
	highThreshold = DEFAULT_MASK_REFINEMENT_OPTIONS.highThreshold,
) {
	const alpha = createAlphaBuffer(confidence.length);
	for (let index = 0; index < confidence.length; index += 1) {
		alpha[index] = Math.round(
			softThresholdConfidence(confidence[index] ?? 0, lowThreshold, highThreshold) * 255,
		);
	}
	return alpha;
}

function maxFilterAlphaMask(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
) {
	if (radius <= 0) {
		return alpha.slice();
	}

	const result = createAlphaBuffer(alpha.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let maxValue = 0;
			for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
				const sampleY = clamp(y + offsetY, 0, height - 1);
				for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
					const sampleX = clamp(x + offsetX, 0, width - 1);
					maxValue = Math.max(maxValue, alpha[sampleY * width + sampleX]);
				}
			}
			result[y * width + x] = maxValue;
		}
	}
	return result;
}

function minFilterAlphaMask(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
) {
	if (radius <= 0) {
		return alpha.slice();
	}

	const result = createAlphaBuffer(alpha.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let minValue = 255;
			for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
				const sampleY = clamp(y + offsetY, 0, height - 1);
				for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
					const sampleX = clamp(x + offsetX, 0, width - 1);
					minValue = Math.min(minValue, alpha[sampleY * width + sampleX]);
				}
			}
			result[y * width + x] = minValue;
		}
	}
	return result;
}

function blurAlphaHorizontal(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
) {
	if (radius <= 0) {
		return alpha.slice();
	}

	const result = createAlphaBuffer(alpha.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let total = 0;
			let samples = 0;
			for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
				const sampleX = clamp(x + offsetX, 0, width - 1);
				total += alpha[y * width + sampleX];
				samples += 1;
			}
			result[y * width + x] = Math.round(total / samples);
		}
	}
	return result;
}

function blurAlphaVertical(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
) {
	if (radius <= 0) {
		return alpha.slice();
	}

	const result = createAlphaBuffer(alpha.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			let total = 0;
			let samples = 0;
			for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
				const sampleY = clamp(y + offsetY, 0, height - 1);
				total += alpha[sampleY * width + x];
				samples += 1;
			}
			result[y * width + x] = Math.round(total / samples);
		}
	}
	return result;
}

function separableBlurAlphaMask(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
) {
	if (radius <= 0) {
		return alpha.slice();
	}

	return blurAlphaVertical(
		blurAlphaHorizontal(alpha, width, height, radius),
		width,
		height,
		radius,
	);
}

function blendAlphaMasks(
	current: Uint8ClampedArray,
	previous: Uint8ClampedArray | null,
	currentWeight: number,
) {
	if (!previous || previous.length !== current.length) {
		return current.slice();
	}

	const safeCurrentWeight = clamp(currentWeight, 0, 1);
	const previousWeight = 1 - safeCurrentWeight;
	const result = createAlphaBuffer(current.length);
	for (let index = 0; index < current.length; index += 1) {
		result[index] = Math.round(
			current[index] * safeCurrentWeight + previous[index] * previousWeight,
		);
	}
	return result;
}

function applyAlphaSoftThreshold(
	alpha: Uint8ClampedArray,
	lowThreshold: number,
	highThreshold: number,
) {
	const result = createAlphaBuffer(alpha.length);
	for (let index = 0; index < alpha.length; index += 1) {
		const normalized = softThresholdConfidence(alpha[index] / 255, lowThreshold, highThreshold);
		result[index] = Math.round(normalized * 255);
	}
	return result;
}

function calculateForegroundCoverage(alpha: Uint8ClampedArray) {
	if (alpha.length === 0) {
		return 0;
	}

	let total = 0;
	for (const value of alpha) {
		total += value;
	}
	return total / (alpha.length * 255);
}

function calculateEdgeCoverage(alpha: Uint8ClampedArray) {
	if (alpha.length === 0) {
		return 0;
	}

	let edgePixels = 0;
	for (const value of alpha) {
		if (value > 18 && value < 238) {
			edgePixels += 1;
		}
	}
	return edgePixels / alpha.length;
}

export function refineSegmentationConfidenceMask(params: {
	confidence: ArrayLike<number>;
	width: number;
	height: number;
	previousAlpha?: Uint8ClampedArray | null;
	options?: Partial<WebcamMaskRefinementOptions>;
}): WebcamMaskRefinementResult {
	const { confidence, width, height, previousAlpha = null, options } = params;
	const resolvedOptions: WebcamMaskRefinementOptions = {
		...DEFAULT_MASK_REFINEMENT_OPTIONS,
		...options,
	};

	const rawAlpha = remapConfidenceMask(
		confidence,
		resolvedOptions.lowThreshold * 0.68,
		Math.max(resolvedOptions.highThreshold - 0.08, resolvedOptions.lowThreshold + 0.14),
	);
	const closedMask = minFilterAlphaMask(
		maxFilterAlphaMask(rawAlpha, width, height, resolvedOptions.holeRadius),
		width,
		height,
		resolvedOptions.holeRadius,
	);
	const openedMask = maxFilterAlphaMask(
		minFilterAlphaMask(closedMask, width, height, resolvedOptions.speckleRadius),
		width,
		height,
		resolvedOptions.speckleRadius,
	);
	const softenedMask = separableBlurAlphaMask(
		openedMask,
		width,
		height,
		resolvedOptions.blurRadius,
	);
	const sharpenedMask = applyAlphaSoftThreshold(softenedMask, 0.06, 0.94);

	const currentCoverage = calculateForegroundCoverage(sharpenedMask);
	const previousCoverage = previousAlpha
		? calculateForegroundCoverage(previousAlpha)
		: currentCoverage;
	const coverageDelta = Math.abs(currentCoverage - previousCoverage);
	const temporalWeight =
		previousAlpha && previousAlpha.length === sharpenedMask.length
			? coverageDelta > 0.18
				? 0.9
				: resolvedOptions.temporalSmoothing
			: 1;
	const refinedAlpha = blendAlphaMasks(sharpenedMask, previousAlpha, temporalWeight);

	return {
		rawAlpha,
		refinedAlpha,
		quality: {
			foregroundCoverage: calculateForegroundCoverage(refinedAlpha),
			edgeCoverage: calculateEdgeCoverage(refinedAlpha),
			temporalWeight,
		},
	};
}

export function alphaMaskToCanvas(alpha: Uint8ClampedArray, width: number, height: number) {
	if (width <= 0 || height <= 0) {
		return null;
	}

	const canvas = createCanvas(width, height);
	const context = get2dContext(canvas);
	if (!context) {
		return null;
	}

	const imageData = context.createImageData(width, height);
	for (let index = 0; index < alpha.length; index += 1) {
		const offset = index * 4;
		imageData.data[offset] = 255;
		imageData.data[offset + 1] = 255;
		imageData.data[offset + 2] = 255;
		imageData.data[offset + 3] = alpha[index];
	}
	context.putImageData(imageData, 0, 0);
	return canvas;
}

function drawSourceToWorkingCanvas(
	source: TexImageSource,
	targetCanvas: HTMLCanvasElement | OffscreenCanvas,
	targetWidth: number,
	targetHeight: number,
) {
	if (targetCanvas.width !== targetWidth) {
		targetCanvas.width = targetWidth;
	}
	if (targetCanvas.height !== targetHeight) {
		targetCanvas.height = targetHeight;
	}

	const context = get2dContext(targetCanvas);
	if (!context) {
		return false;
	}

	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, targetWidth, targetHeight);
	context.imageSmoothingEnabled = true;
	context.drawImage(source as unknown as CanvasImageSource, 0, 0, targetWidth, targetHeight);
	return true;
}

async function loadMediaPipeTasksModule() {
	if (!mediaPipeTasksPromise) {
		mediaPipeTasksPromise = import("@mediapipe/tasks-vision") as Promise<MediaPipeTasksModule>;
	}

	return mediaPipeTasksPromise;
}

async function loadMediaPipeFileset() {
	if (!mediaPipeFilesetPromise) {
		mediaPipeFilesetPromise = (async () => {
			const module = await loadMediaPipeTasksModule();
			const wasmBasePath = await getAssetPath("mediapipe");
			return module.FilesetResolver.forVisionTasks(wasmBasePath);
		})();
	}

	return mediaPipeFilesetPromise;
}

async function getModelAssetPath() {
	if (!mediaPipeModelPathPromise) {
		mediaPipeModelPathPromise = getAssetPath("models/selfie_segmenter_landscape.tflite");
	}

	return mediaPipeModelPathPromise;
}

class MediaPipeWebcamSegmentationProvider implements WebcamSegmentationProvider {
	provider: WebcamSegmentationProviderKind = "mediapipe";
	private segmenterPromise: Promise<MediaPipeImageSegmenter> | null = null;
	private segmenter: MediaPipeImageSegmenter | null = null;
	private isClosed = false;
	private previousRefinedAlphaByKey = new Map<string, Uint8ClampedArray>();
	private workingCanvas = createCanvas(1, 1);
	private lastTimestampMs: number | null = null;

	private resetSegmentationSession() {
		this.segmenter?.close();
		this.segmenter = null;
		this.segmenterPromise = null;
		this.previousRefinedAlphaByKey.clear();
		this.lastTimestampMs = null;
	}

	private async getSegmenter() {
		if (this.segmenter) {
			return this.segmenter;
		}

		if (!this.segmenterPromise) {
			this.segmenterPromise = (async () => {
				const module = await loadMediaPipeTasksModule();
				const wasmFileset = await loadMediaPipeFileset();
				const modelAssetPath = await getModelAssetPath();
				const segmenter = await module.ImageSegmenter.createFromOptions(wasmFileset, {
					baseOptions: {
						modelAssetPath,
					},
					runningMode: "VIDEO",
					outputConfidenceMasks: true,
					outputCategoryMask: false,
				});
				this.segmenter = segmenter;
				return segmenter;
			})();
		}

		return this.segmenterPromise;
	}

	async segment(
		source: TexImageSource,
		timestampMs: number,
		options?: WebcamSegmentationRequestOptions,
	): Promise<WebcamSegmentationFrame | null> {
		if (this.isClosed) {
			return null;
		}

		const sourceSize = getSourceSize(source);
		if (sourceSize.width <= 0 || sourceSize.height <= 0) {
			return null;
		}

		const mode = options?.mode ?? "preview";
		const workingMaxEdge = options?.workingMaxEdge ?? (mode === "preview" ? 320 : 512);
		const refinementMode = options?.refinementMode ?? "sync";
		const safeTimestampMs = Number.isFinite(timestampMs) ? Math.max(0, timestampMs) : 0;

		// MediaPipe video tasks expect monotonically increasing timestamps. The editor scrubs,
		// loops, and jumps, so we recycle the task session when the timeline discontinuously moves.
		if (shouldResetSegmentationSession(this.lastTimestampMs, safeTimestampMs)) {
			this.resetSegmentationSession();
		}
		const workingSize = scaleDimensionsToMaxEdge(
			sourceSize.width,
			sourceSize.height,
			workingMaxEdge,
		);
		if (workingSize.width <= 0 || workingSize.height <= 0) {
			return null;
		}

		if (
			!drawSourceToWorkingCanvas(source, this.workingCanvas, workingSize.width, workingSize.height)
		) {
			return null;
		}

		const segmenter = await this.getSegmenter();
		if (this.isClosed) {
			return null;
		}

		const result = segmenter.segmentForVideo(this.workingCanvas, safeTimestampMs);
		try {
			const mask =
				result.confidenceMasks?.[0] ??
				result.categoryMask ??
				(result.confidenceMasks && result.confidenceMasks.length > 0
					? result.confidenceMasks[result.confidenceMasks.length - 1]
					: null) ??
				null;
			if (!mask) {
				return null;
			}

			const confidence = normalizeConfidenceValues(mask);
			if (!confidence) {
				return null;
			}

			const rawAlpha = remapConfidenceMask(confidence);
			const rawMask = alphaMaskToCanvas(rawAlpha, workingSize.width, workingSize.height);

			if (refinementMode === "none") {
				const copiedConfidence = new Float32Array(confidence);
				this.lastTimestampMs = safeTimestampMs;
				return {
					width: sourceSize.width,
					height: sourceSize.height,
					workingWidth: workingSize.width,
					workingHeight: workingSize.height,
					timestampMs: safeTimestampMs,
					rawMask,
					refinedMask: null,
					mask: rawMask,
					confidenceBuffer: copiedConfidence.buffer,
					provider: "mediapipe",
					quality: DEFAULT_SEGMENTATION_QUALITY,
				};
			}

			const previousKey = `${mode}:${workingSize.width}x${workingSize.height}`;
			const refined = refineSegmentationConfidenceMask({
				confidence,
				width: workingSize.width,
				height: workingSize.height,
				previousAlpha:
					options?.previousAlpha ?? this.previousRefinedAlphaByKey.get(previousKey) ?? null,
			});
			this.previousRefinedAlphaByKey.set(previousKey, refined.refinedAlpha.slice());

			const refinedMask = alphaMaskToCanvas(
				refined.refinedAlpha,
				workingSize.width,
				workingSize.height,
			);
			this.lastTimestampMs = safeTimestampMs;

			return {
				width: sourceSize.width,
				height: sourceSize.height,
				workingWidth: workingSize.width,
				workingHeight: workingSize.height,
				timestampMs: safeTimestampMs,
				rawMask,
				refinedMask,
				mask: refinedMask,
				provider: "mediapipe",
				quality: refined.quality,
			};
		} finally {
			result.close();
		}
	}

	close() {
		this.isClosed = true;
		this.resetSegmentationSession();
		this.workingCanvas = createCanvas(1, 1);
	}
}

export async function createWebcamSegmentationProvider() {
	try {
		return new MediaPipeWebcamSegmentationProvider();
	} catch (error) {
		console.warn("[webcamSegmentation] Failed to create MediaPipe provider:", error);
		return null;
	}
}
