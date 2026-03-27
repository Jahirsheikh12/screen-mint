import beautifulDreamUrl from "@/assets/audio/mixkit-beautiful-dream-493.mp3";
import cantGetYouOffMyMindUrl from "@/assets/audio/mixkit-cant-get-you-off-my-mind-1210.mp3";
import cbpdUrl from "@/assets/audio/mixkit-cbpd-400.mp3";
import drivingAmbitionUrl from "@/assets/audio/mixkit-driving-ambition-32.mp3";
import hazyAfterHoursUrl from "@/assets/audio/mixkit-hazy-after-hours-132.mp3";
import hipHop02Url from "@/assets/audio/mixkit-hip-hop-02-738.mp3";
import sereneViewUrl from "@/assets/audio/mixkit-serene-view-443.mp3";
import techHouseVibesUrl from "@/assets/audio/mixkit-tech-house-vibes-130.mp3";
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
	sourceUrl: string;
	durationMs?: number;
	defaultVolume: number;
}

function createTrack(
	id: string,
	label: string,
	mood: BackgroundMusicMood,
	sourceUrl: string,
): BackgroundMusicAsset {
	return {
		id,
		label,
		mood,
		sourceUrl,
		defaultVolume: DEFAULT_AUDIO_REGION_VOLUME,
	};
}

export const BUILT_IN_BACKGROUND_MUSIC: BackgroundMusicAsset[] = [
	createTrack("sprint-circuit", "Driving Ambition", "upbeat-tech", drivingAmbitionUrl),
	createTrack("soft-horizon", "Serene View", "calm-ambient", sereneViewUrl),
	createTrack("crisp-steps", "Beautiful Dream", "crisp-minimal", beautifulDreamUrl),
	createTrack("warm-lift", "CBPD", "warm-corporate", cbpdUrl),
	createTrack("motion-pulse", "Tech House Vibes", "punchy-motion", techHouseVibesUrl),
	createTrack("studio-glow", "Hazy After Hours", "studio-focus", hazyAfterHoursUrl),
	createTrack(
		"cant-get-you-off-my-mind",
		"Can't Get You Off My Mind",
		"warm-corporate",
		cantGetYouOffMyMindUrl,
	),
	createTrack("hip-hop-02", "Hip Hop 02", "punchy-motion", hipHop02Url),
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
