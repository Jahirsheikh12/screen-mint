import { describe, expect, it } from "vitest";
import { createCaptionRenderBlock } from "./captionLayout";
import { DEFAULT_CAPTION_SETTINGS } from "./types";

describe("captionLayout", () => {
	it("highlights the active word and clamps visible lines", () => {
		const renderBlock = createCaptionRenderBlock(
			[
				{
					id: "caption-1",
					startMs: 0,
					endMs: 3000,
					text: "One two three four five six seven eight",
					words: [
						{ id: "w1", text: "One", startMs: 0, endMs: 300 },
						{ id: "w2", text: "two", startMs: 300, endMs: 600 },
						{ id: "w3", text: "three", startMs: 600, endMs: 900 },
						{ id: "w4", text: "four", startMs: 900, endMs: 1200 },
						{ id: "w5", text: "five", startMs: 1200, endMs: 1500 },
						{ id: "w6", text: "six", startMs: 1500, endMs: 1800 },
						{ id: "w7", text: "seven", startMs: 1800, endMs: 2100 },
						{ id: "w8", text: "eight", startMs: 2100, endMs: 2400 },
					],
					source: "generated",
				},
			],
			{
				...DEFAULT_CAPTION_SETTINGS,
				enabled: true,
				maxLines: 1,
				maxWordsPerLine: 4,
			},
			2000,
		);

		expect(renderBlock).not.toBeNull();
		expect(renderBlock?.lines).toHaveLength(1);
		expect(renderBlock?.lines[0]?.words.some((word) => word.isActive)).toBe(true);
		expect(renderBlock?.lines[0]?.words[0]?.text).toBe("five");
	});
});
