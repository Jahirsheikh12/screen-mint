import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EDITOR_PREFERENCES_STORAGE_KEY } from "./editorPreferences";
import { createEditorPreferencesService } from "./editorPreferencesService";

function createStorage() {
	const store = new Map<string, string>();
	return {
		getItem(key: string) {
			return store.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			store.set(key, value);
		},
		removeItem(key: string) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
	};
}

describe("editorPreferencesService", () => {
	const localStorage = createStorage();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("localStorage", localStorage);
		localStorage.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("debounces and merges scheduled preference writes", () => {
		const service = createEditorPreferencesService({ debounceMs: 100 });

		service.scheduleSave({ wallpaper: "#111111" });
		service.scheduleSave({ previewQuality: "medium" });

		expect(localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY)).toBeNull();

		vi.advanceTimersByTime(100);

		const stored = localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
		expect(stored).not.toBeNull();
		expect(stored).toContain('"wallpaper":"#111111"');
		expect(stored).toContain('"previewQuality":"medium"');
	});

	it("flushes pending writes immediately", () => {
		const service = createEditorPreferencesService({ debounceMs: 1000 });

		service.scheduleSave({ customWallpapers: ["data:image/png;base64,abc"] });
		service.flush();

		const stored = localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
		expect(stored).toContain("data:image/png;base64,abc");
	});
});
