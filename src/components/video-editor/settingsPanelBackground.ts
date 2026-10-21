import { getDisplayAssetUrl, getDisplayAssetUrlSync } from "@/lib/assetPath";
import { type BackgroundMusicMood, BUILT_IN_BACKGROUND_MUSIC } from "@/lib/backgroundMusic";
import {
	isVideoWallpaper,
	WALLPAPER_PATHS,
	WALLPAPER_THUMB_RELATIVE_PATHS,
} from "@/lib/wallpapers";

export interface GradientPreset {
	from: string;
	to: string;
	angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
	{ from: "#0f4c35", to: "#2dd4a0", angle: 135 },
	{ from: "#f7971e", to: "#ffd200", angle: 140 },
	{ from: "#c850c0", to: "#4158d0", angle: 135 },
	{ from: "#2c3ec9", to: "#8b5cf6", angle: 145 },
	{ from: "#7c3aed", to: "#ec4899", angle: 135 },
	{ from: "#e84393", to: "#fd79a8", angle: 130 },
	{ from: "#f56545", to: "#ff9a76", angle: 140 },
	{ from: "#ff6b35", to: "#f7c948", angle: 135 },
	{ from: "#ef4444", to: "#f97316", angle: 145 },
	{ from: "#2563eb", to: "#f97316", angle: 135 },
	{ from: "#059669", to: "#14b8a6", angle: 140 },
	{ from: "#e84393", to: "#fad0c4", angle: 135 },
	{ from: "#1e3a5f", to: "#4a90d9", angle: 145 },
	{ from: "#fbc2eb", to: "#f5e6cc", angle: 130 },
	{ from: "#4f46e5", to: "#7c3aed", angle: 135 },
	{ from: "#f97316", to: "#fb923c", angle: 140 },
	{ from: "#06b6d4", to: "#ec4899", angle: 135 },
	{ from: "#f59e0b", to: "#fbbf24", angle: 145 },
	{ from: "#a3e635", to: "#d946ef", angle: 150 },
];

export function presetToGradientCss(preset: GradientPreset): string {
	return `linear-gradient(${preset.angle}deg, ${preset.from} 0%, ${preset.to} 100%)`;
}

export function parseGradientString(
	css: string,
): { from: string; to: string; angle: number } | null {
	const match = css.match(
		/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8})\s*\d*%?,\s*(#[0-9a-fA-F]{3,8})\s*\d*%?\)/,
	);
	if (match) {
		return { angle: Number.parseInt(match[1]), from: match[2], to: match[3] };
	}

	const multiMatch = css.match(
		/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8})\s*\d*%?(?:,\s*#[0-9a-fA-F]{3,8}\s*\d*%?)*,\s*(#[0-9a-fA-F]{3,8})\s*\d*%?\)/,
	);
	if (multiMatch) {
		return {
			angle: Number.parseInt(multiMatch[1]),
			from: multiMatch[2],
			to: multiMatch[3],
		};
	}
	return null;
}

export const GRADIENTS = GRADIENT_PRESETS.map(presetToGradientCss);

export type BackgroundTab = "image" | "video" | "color" | "gradient";

export function isHexWallpaper(value: string): boolean {
	return /^#(?:[0-9a-f]{3}){1,2}$/i.test(value);
}

export function formatAudioDuration(durationMs?: number) {
	if (!durationMs || durationMs <= 0) {
		return "--:--";
	}

	const seconds = Math.max(1, Math.round(durationMs / 1000));
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getBackgroundTabForWallpaper(value: string): BackgroundTab {
	if (isVideoWallpaper(value)) {
		return "video";
	}

	if (
		GRADIENTS.includes(value) ||
		value.startsWith("linear-gradient") ||
		value.startsWith("radial-gradient")
	) {
		return "gradient";
	}

	if (isHexWallpaper(value)) {
		return "color";
	}

	return "image";
}

let cachedBuiltInWallpaperPreviewPaths: string[] | null = null;
let builtInWallpaperPreviewPathsPromise: Promise<string[]> | null = null;

function canUseCurrentWallpaperPreviewPaths(paths: string[]): boolean {
	if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
		return true;
	}

	return paths.every((path) => path.startsWith("file://"));
}

export function loadBuiltInWallpaperPreviewPaths(): Promise<string[]> {
	if (
		cachedBuiltInWallpaperPreviewPaths &&
		canUseCurrentWallpaperPreviewPaths(cachedBuiltInWallpaperPreviewPaths)
	) {
		return Promise.resolve(cachedBuiltInWallpaperPreviewPaths);
	}

	if (!builtInWallpaperPreviewPathsPromise) {
		builtInWallpaperPreviewPathsPromise = Promise.all(
			WALLPAPER_THUMB_RELATIVE_PATHS.map((path) => getDisplayAssetUrl(path)),
		)
			.then((resolved) => {
				cachedBuiltInWallpaperPreviewPaths = resolved;
				return resolved;
			})
			.catch(() => WALLPAPER_PATHS);
	}

	return builtInWallpaperPreviewPathsPromise;
}

export function getInitialBuiltInWallpaperPreviewPaths(): string[] {
	if (cachedBuiltInWallpaperPreviewPaths) {
		return cachedBuiltInWallpaperPreviewPaths;
	}

	const initialPreviewPaths = WALLPAPER_THUMB_RELATIVE_PATHS.map((path) =>
		getDisplayAssetUrlSync(path),
	);
	if (canUseCurrentWallpaperPreviewPaths(initialPreviewPaths)) {
		cachedBuiltInWallpaperPreviewPaths = initialPreviewPaths;
	}
	return initialPreviewPaths;
}

export function groupBuiltInTracksByMood() {
	return BUILT_IN_BACKGROUND_MUSIC.reduce<
		Record<BackgroundMusicMood, typeof BUILT_IN_BACKGROUND_MUSIC>
	>(
		(acc, track) => {
			if (!acc[track.mood]) {
				acc[track.mood] = [];
			}

			acc[track.mood].push(track);
			return acc;
		},
		{
			"upbeat-tech": [],
			"calm-ambient": [],
			"crisp-minimal": [],
			"warm-corporate": [],
			"punchy-motion": [],
			"studio-focus": [],
		},
	);
}
