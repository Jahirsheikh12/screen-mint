import { describe, expect, it } from "vitest";

import { createProjectData, normalizeProjectEditor } from "./projectPersistence";

describe("keyboard shortcut project persistence", () => {
	it("defaults keyboard shortcut settings", () => {
		const result = normalizeProjectEditor({});

		expect(result.showKeyboardShortcuts).toBe(false);
		expect(result.keyboardShortcutPosition).toBe("bottom-center");
		expect(result.keyboardShortcutTheme).toBe("dark");
		expect(result.keyboardShortcutScale).toBe(1);
		expect(result.keyboardShortcutOpacity).toBe(1);
		expect(result.keyboardShortcutDisplayMs).toBe(1350);
		expect(result.keyboardShortcutMaxVisible).toBe(1);
	});

	it("round-trips keyboard shortcut settings through project serialization", () => {
		const editor = normalizeProjectEditor({
			showKeyboardShortcuts: true,
			keyboardShortcutPosition: "top-right",
			keyboardShortcutTheme: "glass",
			keyboardShortcutScale: 1.4,
			keyboardShortcutOpacity: 0.8,
			keyboardShortcutDisplayMs: 1800,
			keyboardShortcutMaxVisible: 3,
		});

		const project = createProjectData("/tmp/video.mp4", editor);
		expect(project.editor.showKeyboardShortcuts).toBe(true);
		expect(project.editor.keyboardShortcutPosition).toBe("top-right");
		expect(project.editor.keyboardShortcutTheme).toBe("glass");
		expect(project.editor.keyboardShortcutScale).toBe(1.4);
		expect(project.editor.keyboardShortcutOpacity).toBe(0.8);
		expect(project.editor.keyboardShortcutDisplayMs).toBe(1800);
		expect(project.editor.keyboardShortcutMaxVisible).toBe(3);
	});
});
