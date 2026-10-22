import { describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS, findConflict, matchesShortcut } from "./shortcuts";

const key = (init: Partial<KeyboardEvent> & { key: string }) =>
	({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init }) as KeyboardEvent;

describe("shortcuts", () => {
	it("does not fire a plain-key binding when Ctrl is held on macOS", () => {
		expect(matchesShortcut(key({ key: "z" }), { key: "z" }, true)).toBe(true);
		expect(matchesShortcut(key({ key: "z", ctrlKey: true }), { key: "z" }, true)).toBe(false);
		expect(matchesShortcut(key({ key: "z", metaKey: true }), { key: "z", ctrl: true }, true)).toBe(
			true,
		);
	});

	it("refuses bindings that take over undo, redo or export", () => {
		expect(findConflict({ key: "z", ctrl: true }, "addZoom", DEFAULT_SHORTCUTS)).toEqual({
			type: "fixed",
			label: "Undo",
		});
		expect(findConflict({ key: "e", ctrl: true }, "addZoom", DEFAULT_SHORTCUTS)?.type).toBe(
			"fixed",
		);
		expect(findConflict({ key: "q" }, "addZoom", DEFAULT_SHORTCUTS)).toBeNull();
	});
});
