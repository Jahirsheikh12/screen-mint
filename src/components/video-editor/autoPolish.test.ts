import { describe, expect, it } from "vitest";
import { buildAutoPolishResult } from "./autoPolish";

describe("Auto Polish", () => {
	it("chooses deterministic zoom, caption, and export settings", () => {
		const result = buildAutoPolishResult({
			aspectRatio: "16:9",
			durationMs: 30_000,
			cursorTelemetry: [
				{ timeMs: 1500, cx: 0.25, cy: 0.75, interactionType: "click" },
				{ timeMs: 8000, cx: 0.6, cy: 0.4, interactionType: "move" },
			],
			captionTrack: {
				backend: "whisper.cpp",
				model: "base",
				language: "auto",
				prompt: "",
				sourceAudio: "mixed",
				status: "ready",
				segments: [{ id: "caption-1", startMs: 0, endMs: 1000, text: "Demo", words: [] }],
			},
		});

		expect(result.zoomRegions).toHaveLength(1);
		expect(result.showCursor).toBe(true);
		expect(result.showCaptions).toBe(true);
		expect(result.exportPreset).toBe("quality");
	});
});
