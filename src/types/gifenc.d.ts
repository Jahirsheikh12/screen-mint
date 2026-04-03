declare module "gifenc" {
	export interface GIFEncoderInstance {
		writeFrame(
			index: Uint8Array,
			width: number,
			height: number,
			opts?: {
				palette?: number[][];
				delay?: number;
				repeat?: number;
			},
		): void;
		finish(): void;
		bytes(): Uint8Array;
	}

	export function GIFEncoder(opts?: {
		auto?: boolean;
		initialCapacity?: number;
	}): GIFEncoderInstance;
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: { format?: "rgb565" | "rgb444" | "rgba4444" },
	): number[][];
	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: number[][],
		format?: "rgb565" | "rgb444" | "rgba4444",
	): Uint8Array;
}
