import { describe, expect, it } from "vitest";
import { EDITOR_SETTINGS_COVERAGE, HUD_SETTINGS_COVERAGE } from "./settingsCoverage";

function flattenSettings(groups: readonly { settings: readonly string[] }[]) {
	return groups.flatMap((group) => group.settings);
}

describe("settings coverage map", () => {
	it("tracks every editor settings surface in a named group", () => {
		const settings = flattenSettings(EDITOR_SETTINGS_COVERAGE);

		expect(EDITOR_SETTINGS_COVERAGE.map((group) => group.id)).toEqual([
			"preview-effects",
			"cursor",
			"keyboard",
			"background-canvas",
			"timeline",
			"webcam",
			"export",
		]);
		expect(new Set(settings).size).toBe(settings.length);
		expect(settings).toEqual(
			expect.arrayContaining([
				"previewQuality",
				"wallpaper",
				"zoomRegions",
				"audioRegions",
				"captionSettings",
				"webcamPreviewMode",
				"videoExportSettings",
				"gifExportSettings",
			]),
		);
	});

	it("tracks HUD settings that feed native recording and capture behavior", () => {
		const settings = flattenSettings(HUD_SETTINGS_COVERAGE);

		expect(new Set(settings).size).toBe(settings.length);
		expect(settings).toEqual(
			expect.arrayContaining([
				"recordingQuality",
				"recordingFps",
				"hardwareAcceleration",
				"countdownDelay",
				"hiddenFromCapture",
				"afterRecordingAction",
			]),
		);
	});
});
