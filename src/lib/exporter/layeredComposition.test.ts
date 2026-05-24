import { describe, expect, it } from "vitest";
import { DEFAULT_AUDIO_MIX_SETTINGS } from "@/components/video-editor/audioMix";
import { DEFAULT_SCENE_3D_SETTINGS } from "@/components/video-editor/scene3d";
import {
	buildLayeredExportComposition,
	getCompositionLayersAtTime,
	type LayeredExportComposition,
	normalizeLayeredExportComposition,
} from "./layeredComposition";

describe("layered export composition", () => {
	it("normalizes dimensions and preserves preview/export layer ordering", () => {
		const composition: LayeredExportComposition = {
			width: 1920.8,
			height: 1080.2,
			durationMs: 3000.4,
			scene3D: DEFAULT_SCENE_3D_SETTINGS,
			audioMix: DEFAULT_AUDIO_MIX_SETTINGS,
			layers: [
				{
					id: "top",
					type: "caption",
					name: "Captions",
					visible: true,
					locked: false,
					zIndex: 10,
					startMs: 0,
					endMs: null,
					opacity: 1,
					transform: { x: 0, y: 0, scale: 1, rotation: 0 },
				},
				{
					id: "base",
					type: "video",
					name: "Video",
					visible: true,
					locked: false,
					zIndex: 0,
					startMs: 0,
					endMs: null,
					opacity: 1,
					transform: { x: 0, y: 0, scale: 1, rotation: 0 },
					sourcePath: "/tmp/demo.mp4",
					isPrimary: true,
				},
			],
		};

		const normalized = normalizeLayeredExportComposition(composition);
		expect(normalized.width).toBe(1921);
		expect(normalized.height).toBe(1080);
		expect(normalized.durationMs).toBe(3000);
		expect(getCompositionLayersAtTime(normalized, 100).map((layer) => layer.id)).toEqual([
			"base",
			"top",
		]);
	});

	it("builds the shared preview/export composition with a primary video layer", () => {
		const composition = buildLayeredExportComposition({
			width: 1280,
			height: 720,
			durationMs: 1500,
			scene3D: { enabled: true, presetId: "product-hunt-launch" },
			audioMix: { tracks: [], masterVolume: 3 },
			layers: [],
			primaryVideoPath: "/tmp/recording.mp4",
		} as never);

		expect(composition.layers[0]).toMatchObject({
			type: "video",
			sourcePath: "/tmp/recording.mp4",
			isPrimary: true,
		});
		expect(composition.scene3D.presetId).toBe("product-hunt-launch");
		expect(composition.audioMix.masterVolume).toBe(2);
	});
});
