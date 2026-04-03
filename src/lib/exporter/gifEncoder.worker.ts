import { applyPalette, GIFEncoder, quantize } from "gifenc";

const workerScope = self as typeof self & {
	postMessage: (message: unknown, transfer?: Transferable[]) => void;
	onmessage: ((event: MessageEvent) => void) | null;
};

interface StoredFrame {
	rgba: Uint8Array;
	delay: number;
	diffScore: number;
}

let width = 0;
let height = 0;
let loop = true;
let dedupeFrames = true;
let colorCount = 128;
let ditherMode: "off" | "bayer" | "floyd-steinberg" = "bayer";
let dedupeThreshold = 8;
let frames: StoredFrame[] = [];
let cancelled = false;

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

function buildGlobalPaletteSample(): Uint8Array {
	if (frames.length === 0) {
		return new Uint8Array();
	}

	const samples: number[] = [];
	for (const frame of frames) {
		const stride = Math.max(Math.floor(frame.rgba.length / (4 * 4096)), 1);
		for (let index = 0; index < frame.rgba.length; index += stride * 4) {
			samples.push(
				frame.rgba[index],
				frame.rgba[index + 1],
				frame.rgba[index + 2],
				frame.rgba[index + 3],
			);
		}
	}

	return Uint8Array.from(samples);
}

function appendFrame(rgbaBuffer: ArrayBuffer, delay: number) {
	const rgba = new Uint8Array(rgbaBuffer);
	if (dedupeFrames && frames.length > 0) {
		const previous = frames[frames.length - 1];
		const diffScore = sampleDifference(previous.rgba, rgba);
		if (diffScore < dedupeThreshold) {
			previous.delay += delay;
			return;
		}
		frames.push({ rgba, delay, diffScore });
		return;
	}

	const diffScore = frames.length > 0 ? sampleDifference(frames[frames.length - 1].rgba, rgba) : 0;
	frames.push({ rgba, delay, diffScore });
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

function encodeGif() {
	const gif = GIFEncoder();
	const globalSample = buildGlobalPaletteSample();
	const globalPalette = quantize(
		globalSample.length > 0 ? globalSample : frames[0].rgba,
		colorCount,
		{
			format: "rgb565",
		},
	);

	frames.forEach((frame, index) => {
		if (cancelled) {
			return;
		}

		const useLocalPalette = index > 0 && frame.diffScore > 42;
		const palette = useLocalPalette
			? quantize(frame.rgba, colorCount, { format: "rgb565" })
			: globalPalette;
		const indexedFrame = palettizeFrame(frame.rgba, palette);

		gif.writeFrame(indexedFrame, width, height, {
			palette,
			delay: frame.delay,
			repeat: index === 0 ? (loop ? 0 : -1) : undefined,
		});

		if (index % 5 === 0 || index === frames.length - 1) {
			workerScope.postMessage({
				type: "progress",
				progress: (index + 1) / frames.length,
				dedupedFrames: frames.length,
			});
		}
	});

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
		frames = [];
		cancelled = false;
		return;
	}

	if (message.type === "frame") {
		appendFrame(message.rgba, message.delay);
		return;
	}

	if (message.type === "cancel") {
		cancelled = true;
		frames = [];
		return;
	}

	if (message.type === "finalize") {
		try {
			const bytes = encodeGif();
			workerScope.postMessage(
				{
					type: "done",
					buffer: bytes.buffer,
					dedupedFrames: frames.length,
				},
				[bytes.buffer],
			);
			frames = [];
		} catch (error) {
			workerScope.postMessage({
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
};
