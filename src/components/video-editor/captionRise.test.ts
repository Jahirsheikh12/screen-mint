import { describe, expect, it } from "vitest";
import { createCaptionRenderBlock } from "./captionLayout";
import { DEFAULT_CAPTION_SETTINGS } from "./types";

const segment = { id: "s1", startMs: 1000, endMs: 3000, text: "hello world", words: [] };

describe("rise caption animation", () => {
	it("starts below and transparent, then settles", () => {
		const settings = { ...DEFAULT_CAPTION_SETTINGS, enabled: true, animationMode: "rise" as const };
		const start = createCaptionRenderBlock([segment], settings, 1000);
		const settled = createCaptionRenderBlock([segment], settings, 1500);
		expect(start?.blockOffsetY).toBeGreaterThan(0);
		expect(start?.blockOpacity).toBe(0);
		expect(settled?.blockOffsetY).toBe(0);
		expect(settled?.blockOpacity).toBe(1);
	});
});
