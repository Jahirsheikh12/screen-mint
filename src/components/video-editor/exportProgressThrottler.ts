import type { ExportProgress } from "@/lib/exporter";

export interface ExportProgressThrottler {
	push(progress: ExportProgress): void;
	flush(): void;
	cancel(): void;
}

export function createExportProgressThrottler(
	apply: (progress: ExportProgress) => void,
	options: { intervalMs?: number } = {},
): ExportProgressThrottler {
	const intervalMs = options.intervalMs ?? 48;
	let lastAppliedAt = 0;
	let queuedProgress: ExportProgress | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const flush = () => {
		if (!queuedProgress) {
			return;
		}

		const progress = queuedProgress;
		queuedProgress = null;
		lastAppliedAt = Date.now();
		apply(progress);
	};

	return {
		push(progress) {
			queuedProgress = progress;
			const now = Date.now();
			const elapsedMs = now - lastAppliedAt;
			if (elapsedMs >= intervalMs && !timer) {
				flush();
				return;
			}

			if (timer) {
				return;
			}

			timer = setTimeout(
				() => {
					timer = null;
					flush();
				},
				Math.max(0, intervalMs - elapsedMs),
			);
		},
		flush() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			flush();
		},
		cancel() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			queuedProgress = null;
		},
	};
}
