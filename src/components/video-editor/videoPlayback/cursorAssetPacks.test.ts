import { describe, expect, it } from "vitest";
import { CURSOR_PACK_OPTIONS } from "../types";
import { cursorAssetPacks, cursorPackPreviewUrls, SUPPORTED_CURSOR_KEYS } from "./cursorAssetPacks";

describe("cursorAssetPacks", () => {
	it("gives every colour pack the full macOS-style set with matching anchors", () => {
		for (const pack of ["amber", "mint", "rose", "mono"] as const) {
			for (const key of SUPPORTED_CURSOR_KEYS) {
				const definition = cursorAssetPacks[pack][key];
				expect(definition?.url, `${pack}/${key}`).toBeTruthy();
				expect(definition?.fallbackAnchor).toEqual(cursorAssetPacks.macos[key]?.fallbackAnchor);
			}
		}
	});

	it("has a preview for every selectable pack", () => {
		for (const option of CURSOR_PACK_OPTIONS) {
			expect(cursorPackPreviewUrls[option.value], option.value).toBeTruthy();
		}
	});
});
