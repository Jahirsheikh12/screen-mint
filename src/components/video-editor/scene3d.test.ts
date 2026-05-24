import { describe, expect, it } from "vitest";
import {
	DEFAULT_SCENE_3D_SETTINGS,
	normalizeScene3DSettings,
	SCENE_3D_PRESET_IDS,
} from "./scene3d";

describe("3D scene settings", () => {
	it("normalizes invalid settings to deterministic defaults", () => {
		const normalized = normalizeScene3DSettings({
			enabled: true,
			presetId: "not-real",
			deviceModel: "space-projector",
			environment: "fog-machine",
			lens: {
				focalLengthMm: 999,
				perspectiveStrength: -1,
				depthOfField: 4,
				vignette: Number.NaN,
			},
			lighting: {
				keyIntensity: -2,
				fillIntensity: 99,
				reflectionIntensity: 2,
			},
			cameraKeyframes: [
				{
					timeMs: -500,
					position: { x: 999, y: -999, z: 4 },
					target: { x: 0, y: 0, z: 0 },
					fov: 120,
				},
			],
		});

		expect(normalized.enabled).toBe(true);
		expect(normalized.presetId).toBe(DEFAULT_SCENE_3D_SETTINGS.presetId);
		expect(normalized.deviceModel).toBe(DEFAULT_SCENE_3D_SETTINGS.deviceModel);
		expect(normalized.environment).toBe(DEFAULT_SCENE_3D_SETTINGS.environment);
		expect(normalized.lens.focalLengthMm).toBe(120);
		expect(normalized.lens.perspectiveStrength).toBe(0);
		expect(normalized.lens.depthOfField).toBe(1);
		expect(normalized.lens.vignette).toBe(DEFAULT_SCENE_3D_SETTINGS.lens.vignette);
		expect(normalized.lighting.keyIntensity).toBe(0);
		expect(normalized.lighting.fillIntensity).toBe(4);
		expect(normalized.lighting.reflectionIntensity).toBe(1);
		expect(normalized.cameraKeyframes[0]).toMatchObject({
			timeMs: 0,
			position: { x: 20, y: -20, z: 4 },
			fov: 75,
		});
	});

	it("ships all planned first-wave scene presets", () => {
		expect(SCENE_3D_PRESET_IDS).toEqual([
			"apple-keynote-macbook",
			"browser-hero-demo",
			"product-hunt-launch",
			"app-store-preview",
			"pitch-deck-wide",
		]);
	});
});
