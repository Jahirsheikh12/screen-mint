import { describe, expect, it } from "vitest";
import { DEFAULT_SCENE_3D_SETTINGS } from "@/components/video-editor/scene3d";
import { isWebGLAvailable, renderThreeSceneFrame } from "./threeSceneRenderer";

describe("three scene renderer", () => {
	it("reports WebGL unavailable in non-DOM test environments", () => {
		expect(isWebGLAvailable()).toBe(false);
	});

	it("falls back to the source canvas when WebGL is unavailable", async () => {
		const sourceCanvas = { width: 100, height: 50 } as HTMLCanvasElement;
		const result = await renderThreeSceneFrame({
			sourceCanvas,
			settings: { ...DEFAULT_SCENE_3D_SETTINGS, enabled: true },
			width: 100,
			height: 50,
		});

		expect(result.fallbackUsed).toBe(true);
		expect(result.canvas).toBe(sourceCanvas);
		expect(result.warnings[0]).toContain("2D composition");
	});
});
