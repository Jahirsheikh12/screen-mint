import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";
import {
	applyAutoBeautify,
	applyScenePreset,
	type BeautifyContext,
	buildAutoZoomRegionsFromTelemetry,
	chooseAutoBeautifyPreset,
	SCENE_PRESETS,
} from "./scenePresets";
import type { CursorTelemetryPoint } from "./types";

function telemetry(): CursorTelemetryPoint[] {
	return [
		{ timeMs: 0, cx: 0.1, cy: 0.1, interactionType: "move" },
		{ timeMs: 500, cx: 0.45, cy: 0.45, interactionType: "click" },
		{ timeMs: 800, cx: 0.45, cy: 0.45, interactionType: "mouseup" },
		{ timeMs: 1800, cx: 0.7, cy: 0.55, interactionType: "click" },
		{ timeMs: 2100, cx: 0.7, cy: 0.55, interactionType: "mouseup" },
		{ timeMs: 3400, cx: 0.28, cy: 0.34, interactionType: "click" },
		{ timeMs: 3700, cx: 0.28, cy: 0.34, interactionType: "mouseup" },
		{ timeMs: 5200, cx: 0.6, cy: 0.3, interactionType: "move" },
	];
}

function context(overrides: Partial<BeautifyContext> = {}): BeautifyContext {
	const cursorTelemetry = overrides.cursorTelemetry ?? telemetry();
	return {
		sourceWidth: 1920,
		sourceHeight: 1080,
		durationMs: 8000,
		aspectRatio: "16:9",
		hasCursorTelemetry: cursorTelemetry.length >= 2,
		cursorTelemetry,
		hasWebcam: false,
		hasCaptions: false,
		existingZoomCount: 0,
		...overrides,
	};
}

describe("scene presets", () => {
	it("defines valid built-in preset updates", () => {
		const editor = normalizeProjectEditor({});
		for (const preset of SCENE_PRESETS) {
			const updates = applyScenePreset(editor, context(), preset.id);
			const normalized = normalizeProjectEditor({ ...editor, ...updates });
			expect(normalized.scenePresetId).toBe(preset.id);
			expect(normalized.exportFormat).toBe("mp4");
			expect(normalized.showCursor).toBe(true);
		}
	});

	it("uses creator-grade preset labels", () => {
		expect(SCENE_PRESETS.map((preset) => preset.label)).toEqual([
			"Launch Film",
			"Guided Demo",
			"Lesson Mode",
			"Vertical Hook",
			"Clean Handoff",
		]);
	});

	it("uses built-in wallpapers instead of gradients or flat colors", () => {
		const editor = normalizeProjectEditor({});
		for (const preset of SCENE_PRESETS) {
			const updates = applyScenePreset(editor, context(), preset.id);
			expect(updates.wallpaper).toMatch(/^\/wallpapers\//);
			expect(updates.wallpaper).not.toContain("gradient");
			expect(updates.wallpaper).not.toMatch(/^#/);
		}
	});

	it("does not reference removed cursor packs", () => {
		const editor = normalizeProjectEditor({});
		for (const preset of SCENE_PRESETS) {
			const updates = applyScenePreset(editor, context(), preset.id);
			expect(updates.cursorPack === undefined || updates.cursorPack === "classic").toBe(true);
		}
	});

	it("chooses useful Auto Beautify presets from context", () => {
		expect(chooseAutoBeautifyPreset(context({ aspectRatio: "9:16" }))).toBe("social-vertical");
		expect(
			chooseAutoBeautifyPreset(context({ cursorTelemetry: [], hasCursorTelemetry: false })),
		).toBe("bug-report-clean");
		expect(chooseAutoBeautifyPreset(context({ durationMs: 12_000 }))).toBe("saas-launch");
		expect(chooseAutoBeautifyPreset(context({ durationMs: 40_000 }))).toBe("product-demo");
	});

	it("generates cursor-follow zoom regions from telemetry", () => {
		const regions = buildAutoZoomRegionsFromTelemetry(context(), 4);
		expect(regions.length).toBeGreaterThan(0);
		expect(regions[0]).toMatchObject({
			id: "zoom-4",
			mode: "cursor-follow",
			depth: 3,
		});
	});

	it("preserves existing zoom regions by default during Auto Beautify", () => {
		const editor = normalizeProjectEditor({
			zoomRegions: [
				{
					id: "zoom-1",
					startMs: 0,
					endMs: 1000,
					depth: 3,
					focus: { cx: 0.5, cy: 0.5 },
				},
			],
		});
		const result = applyAutoBeautify(editor, context({ existingZoomCount: 1 }));
		expect(result.zoomStatus).toBe("preserved");
		expect(result.updates.zoomRegions).toBeUndefined();
	});

	it("creates zoom regions during Auto Beautify when none exist", () => {
		const editor = normalizeProjectEditor({});
		const result = applyAutoBeautify(editor, context(), { nextZoomIndex: 2 });
		expect(result.zoomStatus).toBe("created");
		expect(result.updates.zoomRegions?.[0]?.id).toBe("zoom-2");
	});
});
