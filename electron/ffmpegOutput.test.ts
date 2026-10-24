import { describe, expect, it } from "vitest";
import { parseFfmpegProgressSeconds, summarizeFfmpegError } from "./ffmpegOutput";

describe("FFmpeg output", () => {
	it("reads the latest position from a progress chunk", () => {
		expect(parseFfmpegProgressSeconds("out_time_ms=1000000\nout_time_ms=2500000\n")).toBe(2.5);
		expect(parseFfmpegProgressSeconds("no progress here")).toBe(0);
	});

	it("reports the real error, not the progress records around it", () => {
		const tail = [
			"[libx264 @ 0x1] broken frame",
			"Conversion failed!",
			"frame=120",
			"out_time_ms=4000000",
			"speed=1.2x",
			"progress=end",
		].join("\n");

		expect(summarizeFfmpegError(tail, 1)).toBe("[libx264 @ 0x1] broken frame\nConversion failed!");
		expect(summarizeFfmpegError("progress=end\n", 1)).toBe("FFmpeg export failed with code 1");
	});
});
