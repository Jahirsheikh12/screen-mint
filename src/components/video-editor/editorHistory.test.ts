import { describe, expect, it } from "vitest";
import { type EditorHistorySnapshot, serializeEdits } from "./editorHistory";
import { normalizeProjectEditor } from "./projectPersistence";

function snapshot(overrides: Partial<EditorHistorySnapshot> = {}): EditorHistorySnapshot {
	return {
		...normalizeProjectEditor({}),
		selectedCameraLayoutId: null,
		webcamSelected: false,
		selectedZoomId: null,
		selectedSpeedId: null,
		selectedAnnotationId: null,
		selectedAudioId: null,
		selectedCaptionId: null,
		...overrides,
	};
}

describe("editor history", () => {
	it("treats a selection change as no edit, but a real change as one", () => {
		const base = snapshot();

		expect(serializeEdits(snapshot({ selectedZoomId: "zoom-1", webcamSelected: true }))).toBe(
			serializeEdits(base),
		);
		expect(serializeEdits(snapshot({ borderRadius: base.borderRadius + 4 }))).not.toBe(
			serializeEdits(base),
		);
	});
});
