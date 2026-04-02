export interface FrameShadowSettings {
	size: number;
	opacity: number;
	blur: number;
}

export interface FrameBorderSettings {
	enabled: boolean;
	width: number;
	color: string;
	opacity: number;
}

export const DEFAULT_FRAME_SHADOW_SIZE = 8;
export const DEFAULT_FRAME_SHADOW_OPACITY = 0.47;
export const DEFAULT_FRAME_SHADOW_BLUR = 32;

export const DEFAULT_FRAME_BORDER_ENABLED = false;
export const DEFAULT_FRAME_BORDER_WIDTH = 12;
export const DEFAULT_FRAME_BORDER_COLOR = "#000000";
export const DEFAULT_FRAME_BORDER_OPACITY = 0.5;

export function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function getLegacyShadowIntensityFromFrameShadow(settings: FrameShadowSettings): number {
	const sizeRatio = settings.size / 12;
	const blurRatio = settings.blur / 48;
	const opacityRatio = settings.opacity / 0.7;
	return clampNumber((sizeRatio + blurRatio + opacityRatio) / 3, 0, 1);
}

export function getFrameShadowFromLegacyIntensity(intensity: number): FrameShadowSettings {
	const clamped = clampNumber(intensity, 0, 1);
	return {
		size: Number((12 * clamped).toFixed(2)),
		opacity: Number((0.7 * clamped).toFixed(2)),
		blur: Number((48 * clamped).toFixed(2)),
	};
}

export function hasVisibleFrameShadow(settings: FrameShadowSettings): boolean {
	return settings.opacity > 0 && (settings.size > 0 || settings.blur > 0);
}

export function buildFrameShadowFilter(settings: FrameShadowSettings, scale = 1): string {
	if (!hasVisibleFrameShadow(settings)) {
		return "none";
	}

	const size = settings.size * scale;
	const blur = settings.blur * scale;
	const opacity = settings.opacity;
	const secondaryOpacity = opacity * (5 / 7);
	const tertiaryOpacity = opacity * (3 / 7);

	return [
		`drop-shadow(0 ${size}px ${blur}px rgba(0,0,0,${opacity}))`,
		`drop-shadow(0 ${size / 3}px ${blur / 3}px rgba(0,0,0,${secondaryOpacity}))`,
		`drop-shadow(0 ${size / 6}px ${blur / 6}px rgba(0,0,0,${tertiaryOpacity}))`,
	].join(" ");
}

export function applyOpacityToHex(hexColor: string, opacity: number): string {
	const normalized = normalizeHexColor(hexColor);
	const alpha = clampNumber(opacity, 0, 1);
	if (!normalized) {
		return `rgba(0, 0, 0, ${alpha})`;
	}

	const value = normalized.slice(1);
	const r = Number.parseInt(value.slice(0, 2), 16);
	const g = Number.parseInt(value.slice(2, 4), 16);
	const b = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeHexColor(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
	if (/^#[0-9a-f]{6}$/i.test(normalized)) {
		return normalized.toUpperCase();
	}

	if (/^#[0-9a-f]{3}$/i.test(normalized)) {
		const [, r, g, b] = normalized;
		return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
	}

	return null;
}
