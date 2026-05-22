import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildGifPaletteFilter,
	buildGifRawPipeFfmpegArgs,
	resolveGifFfmpegLoop,
	resolveGifMpdecimateFilter,
} from "./gifFfmpeg";

const nodeRequire = createRequire(import.meta.url);

function loadFfmpegStatic(): string | null {
	const candidate = nodeRequire("ffmpeg-static");
	return typeof candidate === "string" ? candidate : null;
}

function runFfmpeg(args: string[], frames: Buffer) {
	const ffmpegPath = loadFfmpegStatic();
	if (!ffmpegPath) {
		throw new Error("ffmpeg-static is unavailable");
	}

	return new Promise<{ stderr: string }>((resolve, reject) => {
		const child = spawn(ffmpegPath, args, { windowsHide: true });
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(stderr || `ffmpeg exited with ${code ?? "unknown"}`));
				return;
			}
			resolve({ stderr });
		});
		child.stdin.end(frames);
	});
}

function makeTinyRgbaFrames(width: number, height: number, frameCount: number) {
	const frameBytes = width * height * 4;
	const buffer = Buffer.alloc(frameBytes * frameCount);
	for (let frame = 0; frame < frameCount; frame++) {
		for (let pixel = 0; pixel < width * height; pixel++) {
			const offset = frame * frameBytes + pixel * 4;
			buffer[offset] = frame === 0 ? 255 : 0;
			buffer[offset + 1] = frame === 1 ? 255 : 0;
			buffer[offset + 2] = frame === 2 ? 255 : 0;
			buffer[offset + 3] = 255;
		}
	}
	return buffer;
}

describe("GIF FFmpeg helpers", () => {
	it("maps settings into palette, dither, loop, dedupe, and silent GIF args", () => {
		const args = buildGifRawPipeFfmpegArgs({
			width: 320,
			height: 180,
			frameRate: 15,
			outputPath: "/tmp/out.gif",
			settings: {
				colorCount: 64,
				ditherMode: "floyd-steinberg",
				motionSensitivity: "low",
				loop: false,
				dedupeFrames: true,
			},
		});

		expect(args).toEqual(
			expect.arrayContaining([
				"-f",
				"rawvideo",
				"-pix_fmt",
				"rgba",
				"-s",
				"320x180",
				"-framerate",
				"15",
				"-an",
				"-loop",
				"-1",
				"-f",
				"gif",
			]),
		);
		expect(args.join(" ")).toContain("palettegen=max_colors=64:stats_mode=full");
		expect(args.join(" ")).toContain("paletteuse=dither=floyd_steinberg");
		expect(args.join(" ")).toContain("mpdecimate=hi=64*24:lo=64*12:frac=0.5");
	});

	it("uses motion sensitivity only for duplicate-frame filtering", () => {
		expect(resolveGifMpdecimateFilter(true, "low")).toContain("frac=0.5");
		expect(resolveGifMpdecimateFilter(true, "balanced")).toBe("mpdecimate");
		expect(resolveGifMpdecimateFilter(true, "high")).toContain("frac=0.2");
		expect(resolveGifMpdecimateFilter(false, "high")).toBeNull();
		expect(resolveGifFfmpegLoop(true)).toBe("0");
		expect(resolveGifFfmpegLoop(false)).toBe("-1");

		const lowFilter = buildGifPaletteFilter({
			rawInput: true,
			settings: {
				colorCount: 128,
				ditherMode: "bayer",
				motionSensitivity: "low",
				loop: true,
				dedupeFrames: true,
			},
		});
		const highFilter = buildGifPaletteFilter({
			rawInput: true,
			settings: {
				colorCount: 128,
				ditherMode: "bayer",
				motionSensitivity: "high",
				loop: true,
				dedupeFrames: true,
			},
		});

		expect(lowFilter).toContain("stats_mode=full");
		expect(highFilter).toContain("stats_mode=full");
		expect(lowFilter).not.toBe(highFilter);
	});

	it("encodes a valid GIF from raw RGBA frames", async () => {
		const ffmpegPath = loadFfmpegStatic();
		if (!ffmpegPath) {
			return;
		}

		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "screenmint-gif-"));
		const outputPath = path.join(tmpDir, "tiny.gif");
		try {
			await runFfmpeg(
				buildGifRawPipeFfmpegArgs({
					width: 4,
					height: 4,
					frameRate: 12,
					outputPath,
					settings: {
						colorCount: 64,
						ditherMode: "bayer",
						motionSensitivity: "high",
						loop: true,
						dedupeFrames: false,
					},
				}),
				makeTinyRgbaFrames(4, 4, 3),
			);

			const bytes = await fs.readFile(outputPath);
			const header = bytes.subarray(0, 6).toString("ascii");
			expect(["GIF87a", "GIF89a"]).toContain(header);
			expect(bytes.toString("ascii")).toContain("NETSCAPE2.0");

			const probe = await runFfmpeg(
				["-hide_banner", "-i", outputPath, "-f", "null", "-"],
				Buffer.alloc(0),
			);
			expect(probe.stderr).toContain("gif");
			expect(probe.stderr).toContain("4x4");
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});
