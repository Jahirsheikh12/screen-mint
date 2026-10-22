import { describe, expect, it } from "vitest";
import { normalizeProjectEditor, type ProjectEditorState } from "./projectPersistence";

function withLayers(editor: Partial<ProjectEditorState>, layers: unknown) {
	return { ...editor, layers } as Partial<ProjectEditorState>;
}

describe("legacy layer projects", () => {
	it("folds a primary video layer crop into the main crop", () => {
		const editor = normalizeProjectEditor(
			withLayers({ cropRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 } }, [
				{
					type: "video",
					isPrimary: true,
					transform: { crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } },
				},
			]),
		);

		expect(editor.cropRegion.x).toBeCloseTo(0.5);
		expect(editor.cropRegion.y).toBeCloseTo(0.5);
		expect(editor.cropRegion.width).toBeCloseTo(0.4);
		expect(editor.cropRegion.height).toBeCloseTo(0.3);
		expect("layers" in editor).toBe(false);
	});

	it("ignores non-primary layers and malformed crops", () => {
		const cropRegion = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
		const editor = normalizeProjectEditor(
			withLayers({ cropRegion }, [
				{ type: "window", transform: { crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } } },
				{ type: "video", isPrimary: true, transform: { crop: { x: "bad" } } },
			]),
		);

		expect(editor.cropRegion).toEqual(cropRegion);
	});
});
