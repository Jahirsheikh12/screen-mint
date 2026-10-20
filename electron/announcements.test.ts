import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnouncementService, parseAnnouncementFeed } from "./announcements";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("parseAnnouncementFeed", () => {
	it("keeps valid entries and drops malformed, expired, dismissed and duplicate ones", () => {
		const feed = {
			announcements: [
				{ id: "a", title: " Hello ", body: "World", url: "https://example.com" },
				{ id: "b", title: "Expired", expiresAt: "2026-01-01T00:00:00Z" },
				{ id: "c", title: "Dismissed" },
				{ id: "a", title: "Duplicate" },
				{ id: "d", title: "Bad url", url: "javascript:alert(1)" },
				{ id: "e", title: "Bad expiry", expiresAt: "soon" },
				{ id: "f", title: "Future", expiresAt: "2027-01-01T00:00:00Z" },
				{ title: "No id" },
				{ id: "g", title: "" },
				null,
			],
		};
		expect(parseAnnouncementFeed(feed, new Set(["c"]), NOW)).toEqual([
			{ id: "a", title: "Hello", body: "World", url: "https://example.com" },
			{ id: "d", title: "Bad url", body: "" },
			{ id: "f", title: "Future", body: "" },
		]);
	});

	it("returns nothing for non-feed input", () => {
		expect(parseAnnouncementFeed(null, new Set(), NOW)).toEqual([]);
		expect(parseAnnouncementFeed({ announcements: "x" }, new Set(), NOW)).toEqual([]);
	});
});

describe("createAnnouncementService", () => {
	let dir: string | null = null;
	afterEach(async () => {
		vi.unstubAllGlobals();
		if (dir) await fs.rm(dir, { recursive: true, force: true });
		dir = null;
	});

	it("hides dismissed announcements on the next fetch and survives a failed fetch", async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "announcements-"));
		const feed = JSON.stringify({
			announcements: [
				{ id: "x", title: "X" },
				{ id: "y", title: "Y" },
			],
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(feed)),
		);
		const service = createAnnouncementService(dir, "https://example.invalid/feed.json");

		expect((await service.getAnnouncements()).map((a) => a.id)).toEqual(["x", "y"]);
		await Promise.all([service.dismiss("x"), service.dismiss("y")]);
		expect(await service.getAnnouncements()).toEqual([]);

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Promise.reject(new Error("offline"))),
		);
		expect(await service.getAnnouncements()).toEqual([]);
	});
});
