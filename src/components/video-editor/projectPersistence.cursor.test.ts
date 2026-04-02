import { describe, expect, it } from "vitest";
import { createProjectData, normalizeProjectEditor } from "./projectPersistence";

describe("cursor project persistence", () => {
	it("defaults missing cursor packs to classic", () => {
		const result = normalizeProjectEditor({});
		expect(result.cursorPack).toBe("classic");
	});

	it("round-trips cursor pack through project serialization", () => {
		const editor = normalizeProjectEditor({
			cursorPack: "custom",
			cursorTypeMode: "circle",
			cursorTilt: 0.65,
			hideWhenIdle: true,
			idleHideDelayMs: 2400,
			smoothMovementEnabled: true,
			cursorMovementStyle: "custom",
			cursorSpring: {
				tension: 540,
				friction: 46,
				mass: 0.74,
			},
			highQualitySvgCursors: false,
			zoomRegions: [
				{
					id: "zoom-1",
					startMs: 0,
					endMs: 1000,
					depth: 3,
					focus: { cx: 0.5, cy: 0.5 },
					mode: "cursor-follow",
				},
			],
		});

		const project = createProjectData("/tmp/video.mp4", editor);
		expect(project.editor.cursorPack).toBe("custom");
		expect(project.editor.cursorTypeMode).toBe("circle");
		expect(project.editor.cursorTilt).toBe(0.65);
		expect(project.editor.hideWhenIdle).toBe(true);
		expect(project.editor.idleHideDelayMs).toBe(2400);
		expect(project.editor.smoothMovementEnabled).toBe(true);
		expect(project.editor.cursorMovementStyle).toBe("custom");
		expect(project.editor.cursorSpring).toEqual({
			tension: 540,
			friction: 46,
			mass: 0.74,
		});
		expect(project.editor.highQualitySvgCursors).toBe(false);
		expect(project.editor.zoomRegions[0]?.mode).toBe("cursor-follow");
	});

	it("migrates legacy cursor smoothing and sway into cursor v2 defaults", () => {
		const editor = normalizeProjectEditor({
			cursorSmoothing: 1.2,
			cursorSway: 1.4,
		});

		expect(editor.smoothMovementEnabled).toBe(true);
		expect(editor.cursorTilt).toBeCloseTo(0.7, 5);
		expect(editor.cursorSpring.tension).toBeGreaterThan(0);
		expect(editor.cursorSpring.friction).toBeGreaterThan(0);
		expect(editor.cursorSpring.mass).toBeGreaterThan(0);
	});

	it("defaults missing zoom region modes to static", () => {
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

		expect(editor.zoomRegions[0]?.mode).toBe("static");
		expect(editor.zoomRegions[0]?.tracking).toBeTruthy();
	});

	it("falls back removed built-in wallpapers to the new default", () => {
		const samples = [
			"/wallpapers/wallpaper1.jpg",
			"wallpapers/cityscape.jpg",
			"/Applications/ScreenMint.app/Contents/Resources/app.asar/public/wallpapers/levels.jpg",
		];

		for (const wallpaper of samples) {
			const editor = normalizeProjectEditor({ wallpaper });
			expect(editor.wallpaper).toBe("/wallpapers/green-blue-waves.jpg");
		}
	});

	it("defaults native aspect ratio projects to default padding when padding is missing", () => {
		const editor = normalizeProjectEditor({
			aspectRatio: "native",
		});

		expect(editor.padding).toBe(20);
	});
});
