import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => "/tmp" } }));

import { pickRecoveredRecordings } from "./recordingRecovery";

describe("recording recovery", () => {
	it("returns non-empty videos written since the recording started, largest first", () => {
		const startedAt = 10_000;
		expect(
			pickRecoveredRecordings(
				[
					{ path: "/r/old.mp4", size: 900, mtimeMs: 1_000 },
					{ path: "/r/screen.webm", size: 500, mtimeMs: 12_000 },
					{ path: "/r/mic.webm", size: 50, mtimeMs: 12_000 },
					{ path: "/r/empty.mp4", size: 0, mtimeMs: 12_000 },
					{ path: "/r/notes.json", size: 80, mtimeMs: 12_000 },
				],
				startedAt,
			),
		).toEqual(["/r/screen.webm", "/r/mic.webm"]);
	});
});
