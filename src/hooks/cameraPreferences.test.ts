import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CAMERA_PREFERENCES_STORAGE_KEY,
	DEFAULT_CAMERA_PREFERENCES,
	loadCameraPreferences,
	normalizeCameraPreferences,
	saveCameraPreferences,
} from "./cameraPreferences";

function createStorageMock(initialValues: Record<string, string> = {}): Storage {
	const store = new Map(Object.entries(initialValues));

	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key) {
			return store.get(key) ?? null;
		},
		key(index) {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem(key) {
			store.delete(key);
		},
		setItem(key, value) {
			store.set(key, value);
		},
	};
}

describe("cameraPreferences", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("normalizes invalid values to defaults", () => {
		expect(normalizeCameraPreferences({ enabled: "yes", previewVisible: 0 })).toEqual(
			DEFAULT_CAMERA_PREFERENCES,
		);
	});

	it("loads stored preferences", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[CAMERA_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					enabled: true,
					deviceId: "camera-1",
					previewVisible: false,
					previewMirrored: false,
				}),
			}),
		);

		expect(loadCameraPreferences()).toEqual({
			enabled: true,
			deviceId: "camera-1",
			previewVisible: false,
			previewMirrored: false,
		});
	});

	it("saves merged normalized preferences", () => {
		vi.stubGlobal("localStorage", createStorageMock());

		saveCameraPreferences({
			enabled: true,
			deviceId: "camera-2",
			previewVisible: false,
		});

		expect(loadCameraPreferences()).toEqual({
			enabled: true,
			deviceId: "camera-2",
			previewVisible: false,
			previewMirrored: true,
		});
	});
});
