import { describe, expect, it } from "vitest";
import type { ExportV2EngineSignals } from "./exportV2";
import { selectExportV2Engine, shouldUseDirectNativeExport } from "./exportV2";

const baseSignals: ExportV2EngineSignals = {
	format: "mp4",
	hasVisualComposition: false,
	hasExternalAudio: false,
	hasWebcam: false,
	hasCaptions: false,
	hasAnnotations: false,
	hasCursorOverlay: false,
	hasKeyboardCallouts: false,
	hasSpeedRegions: false,
	hasTrimRegions: false,
};

describe("export v2 engine selection", () => {
	it("uses direct native export for simple MP4 timelines", () => {
		const selection = selectExportV2Engine(baseSignals);

		expect(selection.engine).toBe("direct-native");
		expect(shouldUseDirectNativeExport(selection)).toBe(true);
	});

	it("uses direct native export for simple GIF timelines", () => {
		const selection = selectExportV2Engine({ ...baseSignals, format: "gif" });

		expect(selection.engine).toBe("direct-native");
		expect(selection.reason).toContain("palette");
	});

	it("keeps composed timelines on the composited hardware path", () => {
		const selection = selectExportV2Engine({
			...baseSignals,
			hasVisualComposition: true,
			hasCursorOverlay: true,
		});

		expect(selection.engine).toBe("composited-hardware");
		expect(shouldUseDirectNativeExport(selection)).toBe(false);
	});

	it("keeps speed-edited timelines on the composited path until native speed audio is available", () => {
		const selection = selectExportV2Engine({
			...baseSignals,
			hasSpeedRegions: true,
		});

		expect(selection.engine).toBe("composited-hardware");
	});
});
