import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() }, dialog: {}, ipcMain: {} }));

import { writeProjectFileAtomic } from "./projectFileHandlers";

describe("writeProjectFileAtomic", () => {
	it("replaces the project and leaves no temp file behind", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "project-save-"));
		const file = path.join(dir, "demo.screenmint");
		await fs.writeFile(file, "old");
		await writeProjectFileAtomic(file, { version: 12 });
		expect(JSON.parse(await fs.readFile(file, "utf-8"))).toEqual({ version: 12 });
		expect(await fs.readdir(dir)).toEqual(["demo.screenmint"]);
		await fs.rm(dir, { recursive: true, force: true });
	});
});
