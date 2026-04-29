import { applyPalette, GIFEncoder, quantize } from "gifenc";

const workerScope = self as typeof self & {
	postMessage: (message: unknown, transfer?: Transferable[]) => void;
	onmessage: ((event: MessageEvent) => void) | null;
};

const MAX_PALETTE_SAMPLE_BYTES = 512 * 1024;
const MAX_FRAME_SAMPLE_PIXELS = 4096;

let width = 0;
let height = 0;
let loop = true;
let dedupeFrames = true;
let colorCount = 128;
let ditherMode: "off" | "bayer" | "floyd-steinberg" = "bayer";
let dedupeThreshold = 8;
let paletteSamples: number[] = [];
let samplePreviousFrame: Uint8Array | null = null;
let sampleDedupedFrames = 0;
let globalPalette: number[][] | null = null;
let gif: ReturnType<typeof GIFEncoder> | null = null;
let pendingFrame: Uint8Array | null = null;
let pendingDelay = 0;
let encodedFrames = 0;
let acceptedEncodeFrames = 0;

function sampleDifference(previous: Uint8Array, next: Uint8Array): number {
	const samplePixels = 2048;
	const pixelCount = Math.max(Math.min(previous.length / 4, samplePixels), 1);
	const stride = Math.max(Math.floor(previous.length / 4 / pixelCount), 1);
	let total = 0;
	let compared = 0;

	for (let pixelIndex = 0; pixelIndex < previous.length / 4; pixelIndex += stride) {
		const offset = pixelIndex * 4;
		total += Math.abs(previous[offset] - next[offset]);
		total += Math.abs(previous[offset + 1] - next[offset + 1]);
		total += Math.abs(previous[offset + 2] - next[offset + 2]);
		compared++;
	}

	return compared > 0 ? total / compared : 0;
}

function appendPaletteSample(rgba: Uint8Array) {
	if (paletteSamples.length >= MAX_PALETTE_SAMPLE_BYTES) {
		return;
	}

	const stride = Math.max(Math.floor(rgba.length / (4 * MAX_FRAME_SAMPLE_PIXELS)), 1);
	for (
		let index = 0;
		index < rgba.length && paletteSamples.length < MAX_PALETTE_SAMPLE_BYTES;
		index += stride * 4
	) {
		paletteSamples.push(rgba[index], rgba[index + 1], rgba[index + 2], rgba[index + 3]);
	}
}

function sampleFrame(rgbaBuffer: ArrayBuffer) {
	const rgba = new Uint8Array(rgbaBuffer);
	if (dedupeFrames && samplePreviousFrame) {
		const diffScore = sampleDifference(samplePreviousFrame, rgba);
		if (diffScore < dedupeThreshold) {
			return;
		}
	}

	appendPaletteSample(rgba);
	samplePreviousFrame = rgba;
	sampleDedupedFrames++;
}

function nearestPaletteIndex(palette: number[][], r: number, g: number, b: number): number {
	let bestIndex = 0;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < palette.length; index++) {
		const [pr, pg, pb] = palette[index];
		const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = index;
		}
	}

	return bestIndex;
}

function clampColor(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function applyBayerDither(rgba: Uint8Array, palette: number[][]): Uint8Array {
	const matrix = [
		[0, 8, 2, 10],
		[12, 4, 14, 6],
		[3, 11, 1, 9],
		[15, 7, 13, 5],
	];
	const indexed = new Uint8Array((rgba.length / 4) | 0);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixelIndex = y * width + x;
			const offset = pixelIndex * 4;
			const threshold = (matrix[y % 4][x % 4] - 7.5) * 4;
			indexed[pixelIndex] = nearestPaletteIndex(
				palette,
				clampColor(rgba[offset] + threshold),
				clampColor(rgba[offset + 1] + threshold),
				clampColor(rgba[offset + 2] + threshold),
			);
		}
	}

	return indexed;
}

function applyFloydSteinbergDither(rgba: Uint8Array, palette: number[][]): Uint8Array {
	const indexed = new Uint8Array((rgba.length / 4) | 0);
	const working = new Float32Array(rgba.length);
	for (let index = 0; index < rgba.length; index++) {
		working[index] = rgba[index];
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixelIndex = y * width + x;
			const offset = pixelIndex * 4;
			const nearestIndex = nearestPaletteIndex(
				palette,
				clampColor(working[offset]),
				clampColor(working[offset + 1]),
				clampColor(working[offset + 2]),
			);
			const [nr, ng, nb] = palette[nearestIndex];
			indexed[pixelIndex] = nearestIndex;

			const errorR = working[offset] - nr;
			const errorG = working[offset + 1] - ng;
			const errorB = working[offset + 2] - nb;
			const diffuse = (targetOffset: number, factor: number) => {
				working[targetOffset] += errorR * factor;
				working[targetOffset + 1] += errorG * factor;
				working[targetOffset + 2] += errorB * factor;
			};

			if (x + 1 < width) {
				diffuse(offset + 4, 7 / 16);
			}
			if (y + 1 < height) {
				const nextRowOffset = offset + width * 4;
				if (x > 0) {
					diffuse(nextRowOffset - 4, 3 / 16);
				}
				diffuse(nextRowOffset, 5 / 16);
				if (x + 1 < width) {
					diffuse(nextRowOffset + 4, 1 / 16);
				}
			}
		}
	}

	return indexed;
}

function palettizeFrame(rgba: Uint8Array, palette: number[][]): Uint8Array {
	if (ditherMode === "off") {
		return applyPalette(rgba, palette, "rgb565");
	}
	if (ditherMode === "floyd-steinberg") {
		return applyFloydSteinbergDither(rgba, palette);
	}
	return applyBayerDither(rgba, palette);
}

function prepareEncode() {
	const globalSample =
		paletteSamples.length > 0
			? Uint8Array.from(paletteSamples)
			: samplePreviousFrame || new Uint8Array([0, 0, 0, 255]);
	globalPalette = quantize(globalSample, colorCount, {
		format: "rgb565",
	});
	gif = GIFEncoder();
	pendingFrame = null;
	pendingDelay = 0;
	encodedFrames = 0;
	acceptedEncodeFrames = 0;
}

function flushPendingFrame() {
	if (!gif || !globalPalette || !pendingFrame) {
		return;
	}

	const indexedFrame = palettizeFrame(pendingFrame, globalPalette);
	gif.writeFrame(indexedFrame, width, height, {
		palette: globalPalette,
		delay: pendingDelay,
		repeat: encodedFrames === 0 ? (loop ? 0 : -1) : undefined,
	});
	encodedFrames++;
	pendingFrame = null;
	pendingDelay = 0;

	workerScope.postMessage({
		type: "progress",
		progress: sampleDedupedFrames > 0 ? encodedFrames / sampleDedupedFrames : 1,
		dedupedFrames: acceptedEncodeFrames,
	});
}

function appendFrame(rgbaBuffer: ArrayBuffer, delay: number) {
	const rgba = new Uint8Array(rgbaBuffer);
	if (!gif || !globalPalette) {
		throw new Error("GIF encoder was not prepared");
	}

	if (dedupeFrames && pendingFrame) {
		const diffScore = sampleDifference(pendingFrame, rgba);
		if (diffScore < dedupeThreshold) {
			pendingDelay += delay;
			return;
		}
	}

	flushPendingFrame();
	pendingFrame = rgba;
	pendingDelay = delay;
	acceptedEncodeFrames++;
}

function encodeGif() {
	if (!gif) {
		throw new Error("GIF encoder was not prepared");
	}
	flushPendingFrame();
	gif.finish();
	return gif.bytes();
}

workerScope.onmessage = (event: MessageEvent) => {
	const message = event.data;
	if (message.type === "init") {
		width = message.width;
		height = message.height;
		loop = message.loop;
		dedupeFrames = message.dedupeFrames;
		colorCount = message.colorCount ?? 128;
		ditherMode = message.ditherMode ?? "bayer";
		dedupeThreshold = message.dedupeThreshold ?? 8;
		paletteSamples = [];
		samplePreviousFrame = null;
		sampleDedupedFrames = 0;
		globalPalette = null;
		gif = null;
		pendingFrame = null;
		pendingDelay = 0;
		encodedFrames = 0;
		acceptedEncodeFrames = 0;
		return;
	}

	if (message.type === "sample-frame") {
		sampleFrame(message.rgba);
		workerScope.postMessage({
			type: "frame-accepted",
			dedupedFrames: sampleDedupedFrames,
		});
		return;
	}

	if (message.type === "prepare-encode") {
		try {
			prepareEncode();
			workerScope.postMessage({
				type: "encode-ready",
				dedupedFrames: sampleDedupedFrames,
			});
		} catch (error) {
			workerScope.postMessage({
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		}
		return;
	}

	if (message.type === "frame") {
		appendFrame(message.rgba, message.delay);
		workerScope.postMessage({
			type: "frame-accepted",
			dedupedFrames: acceptedEncodeFrames,
		});
		return;
	}

	if (message.type === "cancel") {
		paletteSamples = [];
		samplePreviousFrame = null;
		globalPalette = null;
		gif = null;
		pendingFrame = null;
		return;
	}

	if (message.type === "finalize") {
		try {
			const bytes = encodeGif();
			workerScope.postMessage(
				{
					type: "done",
					buffer: bytes.buffer,
					dedupedFrames: encodedFrames,
				},
				[bytes.buffer],
			);
			paletteSamples = [];
			samplePreviousFrame = null;
			globalPalette = null;
			gif = null;
			pendingFrame = null;
		} catch (error) {
			workerScope.postMessage({
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
};
