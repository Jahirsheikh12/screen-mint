import { describe, expect, it } from "vitest";

import {
	deriveKeyboardShortcutCallouts,
	getKeyboardShortcutPositionStyle,
	getKeyboardShortcutRenderStates,
} from "./keyboardShortcuts";
import type { KeyboardTelemetrySample } from "./types";

function key(
	timeMs: number,
	type: KeyboardTelemetrySample["type"],
	keyName: string,
	overrides: Partial<KeyboardTelemetrySample> = {},
): KeyboardTelemetrySample {
	return {
		timeMs,
		type,
		key: keyName,
		keycode: overrides.keycode ?? timeMs + 1,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...overrides,
	};
}

describe("keyboardShortcuts", () => {
	it("derives a ctrl shortcut callout", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[
				key(0, "keydown", "ctrl", { ctrlKey: true, keycode: 29 }),
				key(24, "keydown", "p", { ctrlKey: true, keycode: 25 }),
				key(80, "keyup", "p", { ctrlKey: true, keycode: 25 }),
				key(110, "keyup", "ctrl", { keycode: 29 }),
			],
			"win32",
			1350,
		);

		expect(callouts).toHaveLength(1);
		expect(callouts[0]?.keys).toEqual(["ctrl", "p"]);
		expect(callouts[0]?.labels).toEqual(["Ctrl", "P"]);
	});

	it("ignores modifier-only presses", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[
				key(0, "keydown", "shift", { shiftKey: true, keycode: 42 }),
				key(40, "keyup", "shift", { keycode: 42 }),
			],
			"win32",
			1000,
		);

		expect(callouts).toEqual([]);
	});

	it("ignores plain typing without modifiers", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[key(0, "keydown", "a", { keycode: 30 }), key(50, "keyup", "a", { keycode: 30 })],
			"win32",
			1000,
		);

		expect(callouts).toEqual([]);
	});

	it("suppresses held-key repeats", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[
				key(0, "keydown", "ctrl", { ctrlKey: true, keycode: 29 }),
				key(20, "keydown", "p", { ctrlKey: true, keycode: 25 }),
				key(40, "keydown", "p", { ctrlKey: true, keycode: 25 }),
				key(80, "keyup", "p", { ctrlKey: true, keycode: 25 }),
				key(120, "keyup", "ctrl", { keycode: 29 }),
			],
			"win32",
			1000,
		);

		expect(callouts).toHaveLength(1);
	});

	it("merges rapid identical shortcuts", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[
				key(0, "keydown", "ctrl", { ctrlKey: true, keycode: 29 }),
				key(10, "keydown", "p", { ctrlKey: true, keycode: 25 }),
				key(40, "keyup", "p", { ctrlKey: true, keycode: 25 }),
				key(120, "keydown", "p", { ctrlKey: true, keycode: 25 }),
				key(150, "keyup", "p", { ctrlKey: true, keycode: 25 }),
				key(200, "keyup", "ctrl", { keycode: 29 }),
			],
			"win32",
			1000,
		);

		expect(callouts).toHaveLength(1);
		expect(callouts[0]?.endMs).toBe(1120);
	});

	it("uses recorded-platform labels for mac shortcuts", () => {
		const callouts = deriveKeyboardShortcutCallouts(
			[
				key(0, "keydown", "meta", { metaKey: true, keycode: 3675 }),
				key(12, "keydown", "shift", { metaKey: true, shiftKey: true, keycode: 42 }),
				key(24, "keydown", "p", { metaKey: true, shiftKey: true, keycode: 25 }),
			],
			"darwin",
			1000,
		);

		expect(callouts[0]?.labels).toEqual(["⌘", "⇧", "P"]);
	});

	it("returns only the latest visible stack entries", () => {
		const callouts = [
			{
				id: "one",
				startMs: 0,
				endMs: 1000,
				keys: ["ctrl", "1"],
				labels: ["Ctrl", "1"],
				platform: "win32" as const,
			},
			{
				id: "two",
				startMs: 100,
				endMs: 1100,
				keys: ["ctrl", "2"],
				labels: ["Ctrl", "2"],
				platform: "win32" as const,
			},
		];

		const states = getKeyboardShortcutRenderStates(callouts, 500, 1);
		expect(states).toHaveLength(1);
		expect(states[0]?.callout.id).toBe("two");
	});

	it("exposes a centered bottom anchor style", () => {
		expect(getKeyboardShortcutPositionStyle("bottom-center")).toMatchObject({
			bottom: 0,
			left: "50%",
			transform: "translateX(-50%)",
		});
	});
});
