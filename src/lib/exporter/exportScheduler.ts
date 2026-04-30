export const VIDEO_EXPORT_MIN_ENCODE_QUEUE = 8;
export const VIDEO_EXPORT_MAX_ENCODE_QUEUE = 36;
export const VIDEO_EXPORT_QUEUE_PER_CORE = 4;
export const EXPORT_YIELD_EVERY_FRAMES = 4;
export const VIDEO_EXPORT_WORKER_MIN_ENCODE_QUEUE = 16;
export const VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE = 72;
export const VIDEO_EXPORT_WORKER_QUEUE_PER_CORE = 6;
export const EXPORT_WORKER_YIELD_EVERY_FRAMES = 16;

export type ExportSchedulerMode = "interactive" | "worker";

function normalizeHardwareConcurrency(hardwareConcurrency?: number): number {
	const concurrency =
		typeof hardwareConcurrency === "number" &&
		Number.isFinite(hardwareConcurrency) &&
		hardwareConcurrency > 0
			? hardwareConcurrency
			: 4;
	return concurrency;
}

export function resolveVideoExportEncodeQueueLimit(
	hardwareConcurrency?: number,
	mode: ExportSchedulerMode = "interactive",
): number {
	const concurrency = normalizeHardwareConcurrency(hardwareConcurrency);
	if (mode === "worker") {
		return Math.max(
			VIDEO_EXPORT_WORKER_MIN_ENCODE_QUEUE,
			Math.min(
				VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE,
				Math.round(concurrency * VIDEO_EXPORT_WORKER_QUEUE_PER_CORE),
			),
		);
	}

	return Math.max(
		VIDEO_EXPORT_MIN_ENCODE_QUEUE,
		Math.min(VIDEO_EXPORT_MAX_ENCODE_QUEUE, Math.round(concurrency * VIDEO_EXPORT_QUEUE_PER_CORE)),
	);
}

export function resolveVideoExportEncodeQueueCeiling(
	mode: ExportSchedulerMode = "interactive",
): number {
	return mode === "worker" ? VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE : VIDEO_EXPORT_MAX_ENCODE_QUEUE;
}

export function shouldYieldExportFrame(
	frameIndex: number,
	mode: ExportSchedulerMode = "interactive",
): boolean {
	const cadence = mode === "worker" ? EXPORT_WORKER_YIELD_EVERY_FRAMES : EXPORT_YIELD_EVERY_FRAMES;
	return frameIndex > 0 && frameIndex % cadence === 0;
}

export function yieldToExportScheduler(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export class ExportQueueDrainNotifier {
	private resolvers: Array<() => void> = [];

	wait(): Promise<void> {
		return new Promise((resolve) => {
			this.resolvers.push(resolve);
		});
	}

	notify(): void {
		const resolvers = this.resolvers;
		this.resolvers = [];
		for (const resolve of resolvers) {
			resolve();
		}
	}

	clear(): void {
		this.notify();
	}
}
