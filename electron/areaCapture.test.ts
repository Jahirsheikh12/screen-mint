import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeSelectedArea } from "../src/lib/recording/session";
import { buildAreaCropFilter, toDisplaySourceRect } from "./areaCapture";

const display = { x: 1440, y: 0, width: 1920, height: 1080 };

describe("toDisplaySourceRect", () => {
	it("converts to display-relative points on the matching display only", () => {
		const area = normalizeSelectedArea({ x: 1540, y: 50, width: 801, height: 451 }, display, 7);
		expect(toDisplaySourceRect(area, 7)).toEqual({ x: 100, y: 50, width: 801, height: 451 });
		expect(toDisplaySourceRect(area, 8)).toBeNull();
	});
});

describe("buildAreaCropFilter", () => {
	it("produces an even-sized crop that ffmpeg accepts", () => {
		const area = normalizeSelectedArea({ x: 1541, y: 51, width: 801, height: 451 }, display, 7);
		const filter = buildAreaCropFilter(area.normalizedBounds);
		const ffmpeg = (() => {
			try {
				return (
					(process.getBuiltinModule("module").createRequire(import.meta.url)(
						"ffmpeg-static",
					) as string) || null
				);
			} catch {
				return null;
			}
		})();
		if (!ffmpeg || !fs.existsSync(ffmpeg)) return;
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "area-crop-"));
		const out = path.join(dir, "out.mp4");
		try {
			execFileSync(ffmpeg, [
				"-v",
				"error",
				"-f",
				"lavfi",
				"-i",
				"testsrc=size=1920x1080:rate=5",
				"-t",
				"0.4",
				"-vf",
				filter,
				"-c:v",
				"libx264",
				"-pix_fmt",
				"yuv420p",
				"-y",
				out,
			]);
			const info = execFileSync(ffmpeg, ["-i", out], {
				stdio: ["ignore", "pipe", "pipe"],
			}).toString();
			expect(info).toBeDefined();
		} catch (error) {
			// ffmpeg -i without output exits non-zero; the stream line is in stderr.
			const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
			if (!stderr.includes("Stream")) throw error;
			expect(stderr).toMatch(/800x450/);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
