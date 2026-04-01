import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_EDITOR_PREFERENCES,
	EDITOR_PREFERENCES_STORAGE_KEY,
	loadEditorPreferences,
	normalizeEditorPreferences,
	saveEditorPreferences,
} from "./editorPreferences";

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

describe("editorPreferences", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("normalizes invalid values back to safe defaults", () => {
		expect(
			normalizeEditorPreferences({
				wallpaper: 123,
				showCursor: "yes",
				cropRegion: { x: 2, width: -1 },
				aspectRatio: "bad-value",
				customAspectWidth: "0",
				customAspectHeight: "",
				customWallpapers: "not-an-array",
				workspaceLayout: "side-by-side",
				presets: "not-an-array",
			}),
		).toEqual(DEFAULT_EDITOR_PREFERENCES);
	});

	it("loads stored editor control preferences", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					wallpaper: "#123456",
					backgroundBlur: 3.5,
					showCursor: false,
					cropRegion: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
					aspectRatio: "native",
					exportFormat: "gif",
					gifFrameRate: 30,
					gifLoop: false,
					customAspectWidth: "21",
					customAspectHeight: "9",
					customWallpapers: ["data:image/jpeg;base64,abc"],
				}),
			}),
		);

		expect(loadEditorPreferences()).toMatchObject({
			wallpaper: "#123456",
			shadowIntensity: DEFAULT_EDITOR_PREFERENCES.shadowIntensity,
			backgroundBlur: 3.5,
			zoomMotionBlur: DEFAULT_EDITOR_PREFERENCES.zoomMotionBlur,
			connectZooms: DEFAULT_EDITOR_PREFERENCES.connectZooms,
			showCursor: false,
			loopCursor: DEFAULT_EDITOR_PREFERENCES.loopCursor,
			cursorSize: DEFAULT_EDITOR_PREFERENCES.cursorSize,
			cursorSmoothing: DEFAULT_EDITOR_PREFERENCES.cursorSmoothing,
			cursorMotionBlur: DEFAULT_EDITOR_PREFERENCES.cursorMotionBlur,
			cursorClickBounce: DEFAULT_EDITOR_PREFERENCES.cursorClickBounce,
			cursorSway: DEFAULT_EDITOR_PREFERENCES.cursorSway,
			cursorPack: DEFAULT_EDITOR_PREFERENCES.cursorPack,
			borderRadius: DEFAULT_EDITOR_PREFERENCES.borderRadius,
			padding: 20,
			cropRegion: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
			aspectRatio: "native",
			webcamRegion: DEFAULT_EDITOR_PREFERENCES.webcamRegion,
			showWebcam: DEFAULT_EDITOR_PREFERENCES.showWebcam,
			mirrorWebcam: DEFAULT_EDITOR_PREFERENCES.mirrorWebcam,
			cameraSizeDuringZoom: DEFAULT_EDITOR_PREFERENCES.cameraSizeDuringZoom,
			exportQuality: DEFAULT_EDITOR_PREFERENCES.exportQuality,
			exportFormat: "gif",
			gifFrameRate: 30,
			gifLoop: false,
			gifSizePreset: DEFAULT_EDITOR_PREFERENCES.gifSizePreset,
			customAspectWidth: "21",
			customAspectHeight: "9",
			customWallpapers: ["data:image/jpeg;base64,abc"],
			workspaceLayout: DEFAULT_EDITOR_PREFERENCES.workspaceLayout,
			presets: DEFAULT_EDITOR_PREFERENCES.presets,
		});
	});

	it("loads keyboard shortcut overlay preferences", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					showKeyboardShortcuts: true,
					keyboardShortcutPosition: "top-right",
					keyboardShortcutTheme: "glass",
					keyboardShortcutScale: 1.25,
					keyboardShortcutOpacity: 0.75,
					keyboardShortcutDisplayMs: 1700,
					keyboardShortcutMaxVisible: 3,
				}),
			}),
		);

		expect(loadEditorPreferences()).toMatchObject({
			showKeyboardShortcuts: true,
			keyboardShortcutPosition: "top-right",
			keyboardShortcutTheme: "glass",
			keyboardShortcutScale: 1.25,
			keyboardShortcutOpacity: 0.75,
			keyboardShortcutDisplayMs: 1700,
			keyboardShortcutMaxVisible: 3,
		});
	});

	it("falls back removed built-in wallpaper paths in stored preferences", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					wallpaper:
						"/Applications/ScreenMint.app/Contents/Resources/app.asar/public/wallpapers/wallpaper1.jpg",
				}),
			}),
		);

		expect(loadEditorPreferences().wallpaper).toBe("/wallpapers/green-blue-waves.jpg");
	});

	it("defaults native aspect ratio preferences to default padding when padding is missing", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					aspectRatio: "native",
				}),
			}),
		);

		expect(loadEditorPreferences().padding).toBe(20);
	});

	it("preserves the last valid custom aspect inputs while typing", () => {
		const localStorage = createStorageMock({
			[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
				aspectRatio: "16:9",
				customAspectWidth: "21",
				customAspectHeight: "9",
			}),
		});
		vi.stubGlobal("localStorage", localStorage);

		saveEditorPreferences({ customAspectWidth: "", customAspectHeight: "abc" });

		expect(loadEditorPreferences()).toMatchObject({
			aspectRatio: "16:9",
			wallpaper: DEFAULT_EDITOR_PREFERENCES.wallpaper,
			shadowIntensity: DEFAULT_EDITOR_PREFERENCES.shadowIntensity,
			backgroundBlur: DEFAULT_EDITOR_PREFERENCES.backgroundBlur,
			zoomMotionBlur: DEFAULT_EDITOR_PREFERENCES.zoomMotionBlur,
			connectZooms: DEFAULT_EDITOR_PREFERENCES.connectZooms,
			showCursor: DEFAULT_EDITOR_PREFERENCES.showCursor,
			loopCursor: DEFAULT_EDITOR_PREFERENCES.loopCursor,
			cursorSize: DEFAULT_EDITOR_PREFERENCES.cursorSize,
			cursorSmoothing: DEFAULT_EDITOR_PREFERENCES.cursorSmoothing,
			cursorMotionBlur: DEFAULT_EDITOR_PREFERENCES.cursorMotionBlur,
			cursorClickBounce: DEFAULT_EDITOR_PREFERENCES.cursorClickBounce,
			cursorSway: DEFAULT_EDITOR_PREFERENCES.cursorSway,
			cursorPack: DEFAULT_EDITOR_PREFERENCES.cursorPack,
			borderRadius: DEFAULT_EDITOR_PREFERENCES.borderRadius,
			padding: DEFAULT_EDITOR_PREFERENCES.padding,
			cropRegion: DEFAULT_EDITOR_PREFERENCES.cropRegion,
			webcamRegion: DEFAULT_EDITOR_PREFERENCES.webcamRegion,
			showWebcam: DEFAULT_EDITOR_PREFERENCES.showWebcam,
			mirrorWebcam: DEFAULT_EDITOR_PREFERENCES.mirrorWebcam,
			cameraSizeDuringZoom: DEFAULT_EDITOR_PREFERENCES.cameraSizeDuringZoom,
			exportQuality: DEFAULT_EDITOR_PREFERENCES.exportQuality,
			exportFormat: DEFAULT_EDITOR_PREFERENCES.exportFormat,
			gifFrameRate: DEFAULT_EDITOR_PREFERENCES.gifFrameRate,
			gifLoop: DEFAULT_EDITOR_PREFERENCES.gifLoop,
			gifSizePreset: DEFAULT_EDITOR_PREFERENCES.gifSizePreset,
			customAspectWidth: "21",
			customAspectHeight: "9",
			customWallpapers: DEFAULT_EDITOR_PREFERENCES.customWallpapers,
			workspaceLayout: DEFAULT_EDITOR_PREFERENCES.workspaceLayout,
			presets: DEFAULT_EDITOR_PREFERENCES.presets,
		});
	});

	it("saves all editor controls with normalization", () => {
		const localStorage = createStorageMock();
		vi.stubGlobal("localStorage", localStorage);

		saveEditorPreferences({
			wallpaper: "linear-gradient(to right, #000000, #ffffff)",
			shadowIntensity: 0.4,
			backgroundBlur: 1.5,
			zoomMotionBlur: 0.75,
			connectZooms: false,
			showCursor: false,
			loopCursor: true,
			cursorSize: 3,
			cursorSmoothing: 1.25,
			cursorMotionBlur: 0.5,
			cursorClickBounce: 2.25,
			cursorSway: 1.5,
			cursorPack: "custom",
			borderRadius: 18,
			padding: 30,
			cropRegion: { x: 0.12, y: 0.08, width: 0.7, height: 0.65 },
			aspectRatio: "4:5",
			webcamRegion: DEFAULT_EDITOR_PREFERENCES.webcamRegion,
			showWebcam: DEFAULT_EDITOR_PREFERENCES.showWebcam,
			mirrorWebcam: DEFAULT_EDITOR_PREFERENCES.mirrorWebcam,
			cameraSizeDuringZoom: DEFAULT_EDITOR_PREFERENCES.cameraSizeDuringZoom,
			exportQuality: "source",
			exportFormat: "gif",
			gifFrameRate: 20,
			gifLoop: false,
			gifSizePreset: "large",
			customAspectWidth: "4",
			customAspectHeight: "5",
			customWallpapers: ["data:image/jpeg;base64,abc", "data:image/jpeg;base64,abc"],
		});

		expect(loadEditorPreferences()).toMatchObject({
			wallpaper: "linear-gradient(to right, #000000, #ffffff)",
			shadowIntensity: 0.4,
			backgroundBlur: 1.5,
			zoomMotionBlur: 0.75,
			connectZooms: false,
			showCursor: false,
			loopCursor: true,
			cursorSize: 3,
			cursorSmoothing: 1.25,
			cursorMotionBlur: 0.5,
			cursorClickBounce: 2.25,
			cursorSway: 1.5,
			cursorPack: "custom",
			borderRadius: 18,
			padding: 30,
			cropRegion: { x: 0.12, y: 0.08, width: 0.7, height: 0.65 },
			aspectRatio: "4:5",
			webcamRegion: DEFAULT_EDITOR_PREFERENCES.webcamRegion,
			showWebcam: DEFAULT_EDITOR_PREFERENCES.showWebcam,
			mirrorWebcam: DEFAULT_EDITOR_PREFERENCES.mirrorWebcam,
			cameraSizeDuringZoom: DEFAULT_EDITOR_PREFERENCES.cameraSizeDuringZoom,
			exportQuality: "source",
			exportFormat: "gif",
			gifFrameRate: 20,
			gifLoop: false,
			gifSizePreset: "large",
			customAspectWidth: "4",
			customAspectHeight: "5",
			customWallpapers: ["data:image/jpeg;base64,abc"],
			workspaceLayout: DEFAULT_EDITOR_PREFERENCES.workspaceLayout,
			presets: DEFAULT_EDITOR_PREFERENCES.presets,
		});
	});

	it("normalizes workspace layouts and custom presets", () => {
		const preferences = normalizeEditorPreferences({
			workspaceLayout: "timeline-focus",
			presets: [
				{
					id: "demo",
					name: "Demo",
					controls: {
						aspectRatio: "9:16",
						padding: 18,
						showCursor: false,
					},
				},
				{
					name: "",
					controls: {
						wallpaper: "#112233",
					},
				},
			],
		});

		expect(preferences.workspaceLayout).toBe("timeline-focus");
		expect(preferences.presets).toHaveLength(2);
		expect(preferences.presets[0]).toMatchObject({
			id: "demo",
			name: "Demo",
			controls: {
				aspectRatio: "9:16",
				padding: 18,
				showCursor: false,
			},
		});
		expect(preferences.presets[1]?.id).toBe("preset-2");
		expect(preferences.presets[1]?.name).toBe("Preset 2");
		expect(preferences.presets[1]?.controls.wallpaper).toBe("#112233");
	});
});
