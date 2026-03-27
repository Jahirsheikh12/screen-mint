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
		});

		const project = createProjectData("/tmp/video.mp4", editor);
		expect(project.editor.cursorPack).toBe("custom");
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

		expect(editor.padding).toBe(8);
	});
});
