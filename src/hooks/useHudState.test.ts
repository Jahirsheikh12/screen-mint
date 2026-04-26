import { describe, expect, it } from "vitest";
import { DEFAULT_HUD_SETTINGS, resolveHudSettings } from "./useHudState";

describe("resolveHudSettings", () => {
	it("defaults autoCreateZooms to true when the stored setting is missing", () => {
		expect(resolveHudSettings({ afterRecordingAction: "create-project" }).autoCreateZooms).toBe(
			true,
		);
	});

	it("preserves an explicit opt-out for autoCreateZooms", () => {
		expect(resolveHudSettings({ autoCreateZooms: false }).autoCreateZooms).toBe(false);
	});

	it("preserves an explicit opt-in for autoCreateZooms", () => {
		expect(resolveHudSettings({ autoCreateZooms: true }).autoCreateZooms).toBe(true);
		expect(DEFAULT_HUD_SETTINGS.autoCreateZooms).toBe(true);
	});

	it("normalizes invalid persisted values back to safe HUD defaults", () => {
		expect(
			resolveHudSettings({
				hiddenFromCapture: "yes",
				hideDesktopIcons: 1,
				hideDockIcon: null,
				highlightArea: "true",
				openQuickShare: "false",
				speakerNotesEnabled: "no",
				speakerNotesText: 123,
				afterRecordingAction: "delete-everything",
				countdownDelay: 7,
				autoCreateZooms: "yes",
				recordingQuality: "ultra",
				recordingFps: 120,
				hardwareAcceleration: "yes",
			}),
		).toEqual(DEFAULT_HUD_SETTINGS);
	});

	it("accepts valid persisted recording performance settings", () => {
		expect(
			resolveHudSettings({
				recordingQuality: "medium",
				recordingFps: "60",
				hardwareAcceleration: false,
				countdownDelay: "10",
				afterRecordingAction: "export-save-file",
			}),
		).toMatchObject({
			recordingQuality: "medium",
			recordingFps: 60,
			hardwareAcceleration: false,
			countdownDelay: 10,
			afterRecordingAction: "export-save-file",
		});
	});
});
