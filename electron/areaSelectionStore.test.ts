import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeSelectedArea } from "../src/lib/recording/session";
import { createAreaSelectionStore, pickRememberedArea } from "./areaSelectionStore";

const display = { x: 0, y: 0, width: 1512, height: 982 };
const area = normalizeSelectedArea({ x: 100, y: 80, width: 640, height: 360 }, display, 1);

describe("pickRememberedArea", () => {
	it("returns the area only while the display keeps its bounds", () => {
		expect(pickRememberedArea({ "1": area }, 1, display)).toEqual(area);
		expect(pickRememberedArea({ "1": area }, 1, { ...display, width: 1920 })).toBeNull();
		expect(pickRememberedArea({ "1": area }, 2, display)).toBeNull();
	});
});

describe("createAreaSelectionStore", () => {
	let dir: string | null = null;
	afterEach(async () => {
		if (dir) await fs.rm(dir, { recursive: true, force: true });
		dir = null;
	});

	it("persists across instances and ignores malformed entries", async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "area-store-"));
		const file = path.join(dir, "area-selection.json");
		await createAreaSelectionStore(file).remember(area);
		expect(await createAreaSelectionStore(file).get(1, display)).toEqual(area);

		await fs.writeFile(file, JSON.stringify({ "1": { displayId: "x" }, "2": area }));
		const reloaded = createAreaSelectionStore(file);
		expect(await reloaded.get(1, display)).toBeNull();
	});
});
