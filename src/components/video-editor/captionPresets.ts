import {
	CAPTION_STYLE_PRESETS,
	type CaptionAnimationMode,
	type CaptionSettings,
	type CaptionStyle,
	type CaptionStylePreset,
	type CaptionUserPreset,
	DEFAULT_CAPTION_SETTINGS,
} from "./types";

const STORAGE_KEY = "screenmint.captionPresets.v1";
const MAX_USER_PRESETS = 30;

export function loadUserCaptionPresets(): CaptionUserPreset[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((item): item is CaptionUserPreset => isValidUserPreset(item))
			.slice(0, MAX_USER_PRESETS);
	} catch {
		return [];
	}
}

export function saveUserCaptionPreset(preset: CaptionUserPreset): CaptionUserPreset[] {
	if (typeof window === "undefined") return [preset];
	const existing = loadUserCaptionPresets().filter((p) => p.id !== preset.id);
	const next = [preset, ...existing].slice(0, MAX_USER_PRESETS);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Non-fatal — quota exceeded / disabled storage.
	}
	return next;
}

export function deleteUserCaptionPreset(id: string): CaptionUserPreset[] {
	if (typeof window === "undefined") return [];
	const next = loadUserCaptionPresets().filter((p) => p.id !== id);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Non-fatal.
	}
	return next;
}

export function createUserCaptionPreset(
	name: string,
	style: CaptionStyle,
	animationMode: CaptionAnimationMode,
): CaptionUserPreset {
	return {
		id: `caption-preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		name: name.trim().length > 0 ? name.trim() : "Custom preset",
		createdAt: new Date().toISOString(),
		style: { ...style },
		animationMode,
	};
}

export function getBuiltInCaptionPresets(): CaptionUserPreset[] {
	return (Object.keys(CAPTION_STYLE_PRESETS) as CaptionStylePreset[]).map((presetKey) => ({
		id: `built-in-${presetKey}`,
		name: capitalize(presetKey),
		createdAt: "",
		style: { ...CAPTION_STYLE_PRESETS[presetKey] },
		animationMode:
			presetKey === "karaoke"
				? "karaoke-fill"
				: presetKey === "neon"
					? "active-word"
					: DEFAULT_CAPTION_SETTINGS.animationMode,
	}));
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function isValidUserPreset(item: unknown): item is CaptionUserPreset {
	if (!item || typeof item !== "object") return false;
	const preset = item as Partial<CaptionUserPreset>;
	return (
		typeof preset.id === "string" &&
		typeof preset.name === "string" &&
		typeof preset.createdAt === "string" &&
		typeof preset.style === "object" &&
		preset.style !== null &&
		typeof preset.animationMode === "string"
	);
}

export function samePresetStyle(a: CaptionStyle, b: CaptionStyle): boolean {
	const keys: (keyof CaptionStyle)[] = [
		"preset",
		"fontSize",
		"fontFamily",
		"fontWeight",
		"fontStyle",
		"color",
		"highlightColor",
		"backgroundColor",
		"backgroundOpacity",
		"borderRadius",
		"outlineColor",
		"outlineWidth",
		"shadowColor",
		"shadowBlur",
		"shadowOffsetY",
		"letterSpacing",
		"lineHeight",
		"textTransform",
	];
	return keys.every((k) => a[k] === b[k]);
}

export function applyPresetToSettings(
	settings: CaptionSettings,
	preset: CaptionUserPreset,
): CaptionSettings {
	return {
		...settings,
		style: { ...preset.style },
		animationMode: preset.animationMode,
	};
}
