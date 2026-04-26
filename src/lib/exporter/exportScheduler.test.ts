import { describe, expect, it } from "vitest";
import {
	EXPORT_YIELD_EVERY_FRAMES,
	resolveVideoExportEncodeQueueLimit,
	shouldYieldExportFrame,
	VIDEO_EXPORT_MAX_ENCODE_QUEUE,
	VIDEO_EXPORT_MIN_ENCODE_QUEUE,
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
	});
});
