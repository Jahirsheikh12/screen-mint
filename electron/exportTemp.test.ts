import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	approveExportPath,
	createExportTempPath,
	getExportTempDir,
	isApprovedExportPath,
	isExportTempPath,
	moveFile,
	sweepStaleExportTempFiles,
	writeCaptionSidecars,
} from "./exportTemp";

describe("isExportTempPath", () => {
	const root = path.join(os.tmpdir(), "root-for-test");

	it("accepts paths created by createExportTempPath", () => {
		expect(isExportTempPath(root, createExportTempPath(root, "mp4"))).toBe(true);
		expect(isExportTempPath(root, createExportTempPath(root, "gif"))).toBe(true);
	});

	it("rejects anything outside the export temp folder or with another name", () => {
		const dir = getExportTempDir(root);
		expect(isExportTempPath(root, path.join(dir, "..", "export-1.mp4"))).toBe(false);
		expect(isExportTempPath(root, path.join(dir, "nested", "export-1.mp4"))).toBe(false);
		expect(isExportTempPath(root, path.join(dir, "notes.txt"))).toBe(false);
		expect(isExportTempPath(root, path.join(dir, "export-1.mp4.sh"))).toBe(false);
		expect(isExportTempPath(root, "/etc/passwd")).toBe(false);
		expect(isExportTempPath(root, 42)).toBe(false);
	});
});

describe("moveFile and sidecars", () => {
	let dir: string | null = null;
	afterEach(async () => {
		if (dir) await fs.rm(dir, { recursive: true, force: true });
		dir = null;
	});

	it("moves the rendered file and writes captions next to it", async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "export-temp-"));
		const source = path.join(dir, "export-1.mp4");
		const target = path.join(dir, "My Video.mp4");
		await fs.writeFile(source, "video");
		await moveFile(source, target);
		expect(await fs.readFile(target, "utf-8")).toBe("video");
		await expect(fs.access(source)).rejects.toThrow();

		const written = await writeCaptionSidecars(target, { srt: "1\n", vtt: "WEBVTT\n" });
		expect(written).toEqual([path.join(dir, "My Video.srt"), path.join(dir, "My Video.vtt")]);
		expect(await writeCaptionSidecars(target, undefined)).toEqual([]);
	});
});

describe("approved export paths", () => {
	it("accepts only paths main approved, however they are spelled", () => {
		const chosen = path.join(os.tmpdir(), "approved", "My Video.mp4");
		approveExportPath(chosen);

		expect(isApprovedExportPath(chosen)).toBe(true);
		expect(
			isApprovedExportPath(path.join(os.tmpdir(), "approved", "x", "..", "My Video.mp4")),
		).toBe(true);
		expect(isApprovedExportPath(path.join(os.tmpdir(), "approved", "..", "evil.mp4"))).toBe(false);
		expect(isApprovedExportPath("/etc/passwd")).toBe(false);
		expect(isApprovedExportPath(undefined)).toBe(false);
	});
});

describe("startup temp sweep", () => {
	it("clears pending renders and day-old clipboard copies, keeps recent ones", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "screenmint-sweep-"));
		try {
			const pending = createExportTempPath(root, "mp4");
			await fs.mkdir(path.dirname(pending), { recursive: true });
			await fs.writeFile(pending, "x");
			const oldCopy = path.join(root, "screenmint-clipboard-1.mp4");
			const recentCopy = path.join(root, "screenmint-clipboard-2.mp4");
			const unrelated = path.join(root, "someone-else.mp4");
			for (const file of [oldCopy, recentCopy, unrelated]) await fs.writeFile(file, "x");
			const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
			await fs.utimes(oldCopy, twoDaysAgo, twoDaysAgo);
			await fs.utimes(unrelated, twoDaysAgo, twoDaysAgo);

			await sweepStaleExportTempFiles(root);

			await expect(fs.access(pending)).rejects.toThrow();
			await expect(fs.access(oldCopy)).rejects.toThrow();
			await expect(fs.access(recentCopy)).resolves.toBeUndefined();
			await expect(fs.access(unrelated)).resolves.toBeUndefined();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
