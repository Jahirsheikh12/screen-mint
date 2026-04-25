import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MediaRecorderChunkStore } from "./mediaRecorderChunkStore";

describe("MediaRecorderChunkStore", () => {
	let tempDir: string;
	let store: MediaRecorderChunkStore;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "screenmint-chunks-"));
		store = new MediaRecorderChunkStore(async () => tempDir);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("appends chunks in order and finalizes the session file", async () => {
		const session = await store.start("nested/recording.webm");

		await store.append(session.id, new TextEncoder().encode("hello "));
		await store.append(session.id, new TextEncoder().encode("world"));
		const result = await store.finish(session.id);

		expect(result.path).toBe(path.join(tempDir, "recording.webm"));
		expect(result.bytesWritten).toBe(11);
		await expect(fs.readFile(result.path, "utf-8")).resolves.toBe("hello world");
	});

	it("discards an open session and removes the partial file", async () => {
		const session = await store.start("partial.webm");

		await store.append(session.id, new TextEncoder().encode("partial"));
		await store.discard(session.id);

		await expect(fs.access(session.path)).rejects.toThrow();
	});
});
