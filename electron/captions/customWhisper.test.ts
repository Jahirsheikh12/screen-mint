import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let userData = "";
vi.mock("electron", () => ({ app: { getPath: () => userData } }));

const { setCustomWhisperPath, resolveCustomWhisperFiles, validateExecutable, validateGgmlModel } =
	await import("./customWhisper");

describe("custom Whisper files", () => {
	beforeEach(async () => {
		userData = await fs.mkdtemp(path.join(os.tmpdir(), "custom-whisper-"));
	});
	afterEach(async () => {
		await fs.rm(userData, { recursive: true, force: true });
	});

	async function writeFile(name: string, bytes: Buffer, mode = 0o644) {
		const filePath = path.join(userData, name);
		await fs.writeFile(filePath, bytes, { mode });
		return filePath;
	}

	it("accepts only files with the ggml header as models", async () => {
		const header = Buffer.alloc(8);
		header.writeUInt32LE(0x67676d6c, 0);
		expect(await validateGgmlModel(await writeFile("ok.bin", header))).toBeNull();
		expect(await validateGgmlModel(await writeFile("bad.bin", Buffer.from("not a model")))).toBe(
			"not-ggml-model",
		);
		expect(await validateGgmlModel(path.join(userData, "missing.bin"))).toBe("not-found");
	});

	it.skipIf(process.platform === "win32")("accepts only runnable files as programs", async () => {
		expect(
			await validateExecutable(await writeFile("cli", Buffer.from("#!/bin/sh"), 0o755)),
		).toBeNull();
		expect(await validateExecutable(await writeFile("plain", Buffer.from("x")))).toBe(
			"not-executable",
		);
	});

	it("stores valid files, rejects invalid ones and clears them", async () => {
		const header = Buffer.alloc(8);
		header.writeUInt32LE(0x67676d6c, 0);
		const model = await writeFile("model.bin", header);

		expect((await setCustomWhisperPath("model", path.join(userData, "nope.bin"))).error).toBe(
			"not-found",
		);
		expect((await setCustomWhisperPath("model", model)).error).toBeNull();
		expect(await resolveCustomWhisperFiles()).toEqual({ modelPath: model, executablePath: null });

		// A stored file that disappears is ignored rather than breaking transcription.
		await fs.rm(model);
		expect((await resolveCustomWhisperFiles()).modelPath).toBeNull();

		await setCustomWhisperPath("model", null);
		expect(await resolveCustomWhisperFiles()).toEqual({ modelPath: null, executablePath: null });
	});
});
