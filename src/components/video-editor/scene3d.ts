import { DEVICE_MOCKUP_OPTIONS, type DeviceMockup } from "./types";

export type Scene3DPresetId =
	| "apple-keynote-macbook"
	| "browser-hero-demo"
	| "product-hunt-launch"
	| "app-store-preview"
	| "pitch-deck-wide";

export type Scene3DEnvironment =
	| "studio"
	| "keynote"
	| "soft-gradient"
	| "dark-stage"
	| "transparent";

export interface Scene3DLensControls {
	focalLengthMm: number;
	perspectiveStrength: number;
	depthOfField: number;
	vignette: number;
	bloom: number;
	motionBlur: number;
}

export interface Scene3DCameraKeyframe {
	timeMs: number;
	position: { x: number; y: number; z: number };
	target: { x: number; y: number; z: number };
	fov: number;
}

export interface Scene3DLighting {
	keyIntensity: number;
	fillIntensity: number;
	rimIntensity: number;
	shadowSoftness: number;
	reflectionIntensity: number;
}

export interface Scene3DSettings {
	enabled: boolean;
	presetId: Scene3DPresetId;
	deviceModel: DeviceMockup;
	environment: Scene3DEnvironment;
	lens: Scene3DLensControls;
	lighting: Scene3DLighting;
	cameraKeyframes: Scene3DCameraKeyframe[];
	fallback2DMockup: DeviceMockup;
}

export const SCENE_3D_PRESET_IDS: Scene3DPresetId[] = [
	"apple-keynote-macbook",
	"browser-hero-demo",
	"product-hunt-launch",
	"app-store-preview",
	"pitch-deck-wide",
];

export const DEFAULT_SCENE_3D_LENS: Scene3DLensControls = {
	focalLengthMm: 42,
	perspectiveStrength: 0.55,
	depthOfField: 0.18,
	vignette: 0.16,
	bloom: 0.08,
	motionBlur: 0.24,
};

export const DEFAULT_SCENE_3D_LIGHTING: Scene3DLighting = {
	keyIntensity: 1,
	fillIntensity: 0.36,
	rimIntensity: 0.42,
	shadowSoftness: 0.62,
	reflectionIntensity: 0.28,
};

export const DEFAULT_SCENE_3D_SETTINGS: Scene3DSettings = {
	enabled: false,
	presetId: "apple-keynote-macbook",
	deviceModel: "macbook-pro",
	environment: "keynote",
	lens: DEFAULT_SCENE_3D_LENS,
	lighting: DEFAULT_SCENE_3D_LIGHTING,
	cameraKeyframes: [
		{
			timeMs: 0,
			position: { x: 0, y: 0.24, z: 4.2 },
			target: { x: 0, y: 0, z: 0 },
			fov: 38,
		},
	],
	fallback2DMockup: "macbook-pro",
};

const SCENE_3D_ENVIRONMENTS: Scene3DEnvironment[] = [
	"studio",
	"keynote",
	"soft-gradient",
	"dark-stage",
	"transparent",
];
const DEVICE_MOCKUP_VALUES = DEVICE_MOCKUP_OPTIONS.map((option) => option.value);

function clamp(value: unknown, min: number, max: number, fallback: number) {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

function normalizeVector(candidate: unknown, fallback: { x: number; y: number; z: number }) {
	if (!candidate || typeof candidate !== "object") {
		return { ...fallback };
	}
	const vector = candidate as Partial<typeof fallback>;
	return {
		x: clamp(vector.x, -20, 20, fallback.x),
		y: clamp(vector.y, -20, 20, fallback.y),
		z: clamp(vector.z, -20, 20, fallback.z),
	};
}

export function normalizeScene3DSettings(candidate: unknown): Scene3DSettings {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<Scene3DSettings>) : {};
	const fallback = DEFAULT_SCENE_3D_SETTINGS;
	const fallbackKeyframe = fallback.cameraKeyframes[0];
	const cameraKeyframes = Array.isArray(raw.cameraKeyframes)
		? raw.cameraKeyframes
				.slice(0, 12)
				.map((keyframe) => {
					const partial =
						keyframe && typeof keyframe === "object"
							? (keyframe as Partial<Scene3DCameraKeyframe>)
							: {};
					return {
						timeMs: Math.round(clamp(partial.timeMs, 0, 60 * 60 * 1000, 0)),
						position: normalizeVector(partial.position, fallbackKeyframe.position),
						target: normalizeVector(partial.target, fallbackKeyframe.target),
						fov: clamp(partial.fov, 18, 75, fallbackKeyframe.fov),
					};
				})
				.sort((a, b) => a.timeMs - b.timeMs)
		: fallback.cameraKeyframes.map((keyframe) => ({
				...keyframe,
				position: { ...keyframe.position },
				target: { ...keyframe.target },
			}));

	return {
		enabled: Boolean(raw.enabled),
		presetId: SCENE_3D_PRESET_IDS.includes(raw.presetId as Scene3DPresetId)
			? (raw.presetId as Scene3DPresetId)
			: fallback.presetId,
		deviceModel: DEVICE_MOCKUP_VALUES.includes(raw.deviceModel as DeviceMockup)
			? (raw.deviceModel as DeviceMockup)
			: fallback.deviceModel,
		environment: SCENE_3D_ENVIRONMENTS.includes(raw.environment as Scene3DEnvironment)
			? (raw.environment as Scene3DEnvironment)
			: fallback.environment,
		lens: {
			focalLengthMm: clamp(raw.lens?.focalLengthMm, 18, 120, fallback.lens.focalLengthMm),
			perspectiveStrength: clamp(
				raw.lens?.perspectiveStrength,
				0,
				1,
				fallback.lens.perspectiveStrength,
			),
			depthOfField: clamp(raw.lens?.depthOfField, 0, 1, fallback.lens.depthOfField),
			vignette: clamp(raw.lens?.vignette, 0, 1, fallback.lens.vignette),
			bloom: clamp(raw.lens?.bloom, 0, 1, fallback.lens.bloom),
			motionBlur: clamp(raw.lens?.motionBlur, 0, 1, fallback.lens.motionBlur),
		},
		lighting: {
			keyIntensity: clamp(raw.lighting?.keyIntensity, 0, 4, fallback.lighting.keyIntensity),
			fillIntensity: clamp(raw.lighting?.fillIntensity, 0, 4, fallback.lighting.fillIntensity),
			rimIntensity: clamp(raw.lighting?.rimIntensity, 0, 4, fallback.lighting.rimIntensity),
			shadowSoftness: clamp(raw.lighting?.shadowSoftness, 0, 1, fallback.lighting.shadowSoftness),
			reflectionIntensity: clamp(
				raw.lighting?.reflectionIntensity,
				0,
				1,
				fallback.lighting.reflectionIntensity,
			),
		},
		cameraKeyframes: cameraKeyframes.length > 0 ? cameraKeyframes : fallback.cameraKeyframes,
		fallback2DMockup: DEVICE_MOCKUP_VALUES.includes(raw.fallback2DMockup as DeviceMockup)
			? (raw.fallback2DMockup as DeviceMockup)
			: fallback.fallback2DMockup,
	};
}
