import { DEFAULT_AUDIO_REGION_VOLUME } from "@/components/video-editor/types";

export type BackgroundMusicMood =
	| "upbeat-tech"
	| "calm-ambient"
	| "crisp-minimal"
	| "warm-corporate"
	| "punchy-motion"
	| "studio-focus";

export interface BackgroundMusicAsset {
	id: string;
	label: string;
	mood: BackgroundMusicMood;
	relativePath: string;
	durationMs?: number;
	defaultVolume: number;
}

const BACKGROUND_MUSIC_DIRECTORY = "background-music";

function createTrack(
	id: string,
	label: string,
	mood: BackgroundMusicMood,
	fileName: string,
): BackgroundMusicAsset {
	return {
		id,
		label,
		mood,
		relativePath: `${BACKGROUND_MUSIC_DIRECTORY}/${fileName}`,
		defaultVolume: DEFAULT_AUDIO_REGION_VOLUME,
	};
}

export const BUILT_IN_BACKGROUND_MUSIC: BackgroundMusicAsset[] = [
	createTrack(
		"sprint-circuit",
		"Driving Ambition",
		"upbeat-tech",
		"mixkit-driving-ambition-32.mp3",
	),
	createTrack("soft-horizon", "Serene View", "calm-ambient", "mixkit-serene-view-443.mp3"),
	createTrack("crisp-steps", "Beautiful Dream", "crisp-minimal", "mixkit-beautiful-dream-493.mp3"),
	createTrack("warm-lift", "CBPD", "warm-corporate", "mixkit-cbpd-400.mp3"),
	createTrack(
		"motion-pulse",
		"Tech House Vibes",
		"punchy-motion",
		"mixkit-tech-house-vibes-130.mp3",
	),
	createTrack("studio-glow", "Hazy After Hours", "studio-focus", "mixkit-hazy-after-hours-132.mp3"),
	createTrack(
		"cant-get-you-off-my-mind",
		"Can't Get You Off My Mind",
		"warm-corporate",
		"mixkit-cant-get-you-off-my-mind-1210.mp3",
	),
	createTrack("hip-hop-02", "Hip Hop 02", "punchy-motion", "mixkit-hip-hop-02-738.mp3"),
];

export const BUILT_IN_BACKGROUND_MUSIC_BY_ID = new Map(
	BUILT_IN_BACKGROUND_MUSIC.map((asset) => [asset.id, asset] as const),
);

export function getBackgroundMusicAssetById(assetId?: string | null): BackgroundMusicAsset | null {
	if (!assetId) {
		return null;
	}

	return BUILT_IN_BACKGROUND_MUSIC_BY_ID.get(assetId) ?? null;
}
