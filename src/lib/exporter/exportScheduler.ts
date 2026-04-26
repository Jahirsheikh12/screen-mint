export const VIDEO_EXPORT_MIN_ENCODE_QUEUE = 8;
export const VIDEO_EXPORT_MAX_ENCODE_QUEUE = 36;
export const VIDEO_EXPORT_QUEUE_PER_CORE = 4;
export const EXPORT_YIELD_EVERY_FRAMES = 4;

export function resolveVideoExportEncodeQueueLimit(hardwareConcurrency?: number): number {
	const concurrency =
		typeof hardwareConcurrency === "number" &&
		Number.isFinite(hardwareConcurrency) &&
		hardwareConcurrency > 0
			? hardwareConcurrency
			: 4;
	return Math.max(
		VIDEO_EXPORT_MIN_ENCODE_QUEUE,
		Math.min(VIDEO_EXPORT_MAX_ENCODE_QUEUE, Math.round(concurrency * VIDEO_EXPORT_QUEUE_PER_CORE)),
	);
}

export function shouldYieldExportFrame(frameIndex: number): boolean {
	return frameIndex > 0 && frameIndex % EXPORT_YIELD_EVERY_FRAMES === 0;
}

export function yieldToExportScheduler(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
