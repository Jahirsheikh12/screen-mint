import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";

describe("caption project persistence", () => {
	it("migrates legacy caption regions into a caption track", () => {
		const result = normalizeProjectEditor({
			captionRegions: [
				{
					id: "caption-1",
					startMs: 0,
					endMs: 1000,
					text: "Legacy caption",
				},
			],
		});

		expect(result.captionTrack).not.toBeNull();
		expect(result.captionTrack?.segments).toHaveLength(1);
		expect(result.captionTrack?.segments[0]?.words).toHaveLength(2);
		expect(result.captionTrack?.status).toBe("ready");
	});

	it("normalizes caption settings defaults", () => {
		const result = normalizeProjectEditor({});
		expect(result.captionSettings.animationMode).toBe("active-word");
		expect(result.captionSettings.maxLines).toBe(2);
		expect(result.captionGenerationOptions.preferredBackend).toBe("auto");
		expect(result.captionGenerationOptions.model).toBe("medium");
	});
});
