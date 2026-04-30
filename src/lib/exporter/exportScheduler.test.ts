import { describe, expect, it } from "vitest";
import {
	EXPORT_WORKER_YIELD_EVERY_FRAMES,
	EXPORT_YIELD_EVERY_FRAMES,
	ExportQueueDrainNotifier,
	resolveVideoExportEncodeQueueCeiling,
	resolveVideoExportEncodeQueueLimit,
	shouldYieldExportFrame,
	VIDEO_EXPORT_MAX_ENCODE_QUEUE,
	VIDEO_EXPORT_MIN_ENCODE_QUEUE,
	VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE,
	VIDEO_EXPORT_WORKER_MIN_ENCODE_QUEUE,
} from "./exportScheduler";
import {
	resolveStreamingDecodeBacklogLimit,
	resolveStreamingDecodeQueueLimit,
	STREAMING_DECODE_MAX_BACKLOG,
	STREAMING_DECODE_MAX_QUEUE,
	STREAMING_DECODE_MIN_BACKLOG,
	STREAMING_DECODE_MIN_QUEUE,
} from "./streamingDecoder";

describe("export scheduler", () => {
	it("keeps WebCodecs encode queues bounded for thermal headroom", () => {
		expect(resolveVideoExportEncodeQueueLimit(1)).toBe(VIDEO_EXPORT_MIN_ENCODE_QUEUE);
		expect(resolveVideoExportEncodeQueueLimit(64)).toBe(VIDEO_EXPORT_MAX_ENCODE_QUEUE);
		expect(resolveVideoExportEncodeQueueLimit(Number.NaN)).toBe(16);
	});

	it("allows export workers to keep hardware encoders busier than the visible UI path", () => {
		expect(resolveVideoExportEncodeQueueLimit(1, "worker")).toBe(
			VIDEO_EXPORT_WORKER_MIN_ENCODE_QUEUE,
		);
		expect(resolveVideoExportEncodeQueueLimit(64, "worker")).toBe(
			VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE,
		);
		expect(resolveVideoExportEncodeQueueLimit(8, "worker")).toBeGreaterThan(
			resolveVideoExportEncodeQueueLimit(8),
		);
		expect(resolveVideoExportEncodeQueueCeiling("worker")).toBe(
			VIDEO_EXPORT_WORKER_MAX_ENCODE_QUEUE,
		);
		expect(resolveVideoExportEncodeQueueCeiling()).toBe(VIDEO_EXPORT_MAX_ENCODE_QUEUE);
	});

	it("keeps streaming decode queues smaller than the previous core-scaled backlog", () => {
		expect(resolveStreamingDecodeQueueLimit(1)).toBe(STREAMING_DECODE_MIN_QUEUE);
		expect(resolveStreamingDecodeQueueLimit(64)).toBe(STREAMING_DECODE_MAX_QUEUE);
		expect(resolveStreamingDecodeBacklogLimit(1)).toBe(STREAMING_DECODE_MIN_BACKLOG);
		expect(resolveStreamingDecodeBacklogLimit(64)).toBe(STREAMING_DECODE_MAX_BACKLOG);
	});

	it("yields on a fixed cadence during long exports", () => {
		expect(shouldYieldExportFrame(0)).toBe(false);
		expect(shouldYieldExportFrame(EXPORT_YIELD_EVERY_FRAMES - 1)).toBe(false);
		expect(shouldYieldExportFrame(EXPORT_YIELD_EVERY_FRAMES)).toBe(true);
		expect(shouldYieldExportFrame(EXPORT_WORKER_YIELD_EVERY_FRAMES - 1, "worker")).toBe(false);
		expect(shouldYieldExportFrame(EXPORT_WORKER_YIELD_EVERY_FRAMES, "worker")).toBe(true);
	});

	it("wakes encoder backpressure waiters without timer polling", async () => {
		const notifier = new ExportQueueDrainNotifier();
		let resolved = false;
		const waiter = notifier.wait().then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(false);
		notifier.notify();
		await waiter;
		expect(resolved).toBe(true);
	});
});
