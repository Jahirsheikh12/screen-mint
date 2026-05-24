import type { AudioRegion } from "./types";

export type AudioMixTrackKind = "primary" | "microphone" | "system" | "music" | "voiceover";

export interface AudioMixTrack {
	id: string;
	kind: AudioMixTrackKind;
	label: string;
	volume: number;
	muted: boolean;
	solo: boolean;
	fadeInMs: number;
	fadeOutMs: number;
	duckUnderSpeech: boolean;
	duckingAmount: number;
}

export interface AudioMixSettings {
	tracks: AudioMixTrack[];
	masterVolume: number;
	duckingEnabled: boolean;
	speechThreshold: number;
	waveformCacheVersion: number;
}

export const AUDIO_MIX_WAVEFORM_CACHE_VERSION = 1;

export const DEFAULT_AUDIO_MIX_TRACKS: AudioMixTrack[] = [
	{
		id: "track-primary",
		kind: "primary",
		label: "Recording audio",
		volume: 1,
		muted: false,
		solo: false,
		fadeInMs: 0,
		fadeOutMs: 0,
		duckUnderSpeech: false,
		duckingAmount: 0,
	},
];

export const DEFAULT_AUDIO_MIX_SETTINGS: AudioMixSettings = {
	tracks: DEFAULT_AUDIO_MIX_TRACKS,
	masterVolume: 1,
	duckingEnabled: true,
	speechThreshold: 0.08,
	waveformCacheVersion: AUDIO_MIX_WAVEFORM_CACHE_VERSION,
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

function normalizeTrack(candidate: unknown, index: number): AudioMixTrack | null {
	if (!candidate || typeof candidate !== "object") return null;
	const raw = candidate as Partial<AudioMixTrack>;
	const kind: AudioMixTrackKind =
		raw.kind === "microphone" ||
		raw.kind === "system" ||
		raw.kind === "music" ||
		raw.kind === "voiceover" ||
		raw.kind === "primary"
			? raw.kind
			: "music";
	const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `track-${index + 1}`;
	return {
		id,
		kind,
		label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : id,
		volume: clamp(raw.volume, 0, 2, 1),
		muted: Boolean(raw.muted),
		solo: Boolean(raw.solo),
		fadeInMs: Math.round(clamp(raw.fadeInMs, 0, 60_000, 0)),
		fadeOutMs: Math.round(clamp(raw.fadeOutMs, 0, 60_000, 0)),
		duckUnderSpeech: Boolean(raw.duckUnderSpeech),
		duckingAmount: clamp(raw.duckingAmount, 0, 1, 0.55),
	};
}

export function normalizeAudioMixSettings(candidate: unknown): AudioMixSettings {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<AudioMixSettings>) : {};
	const tracks = Array.isArray(raw.tracks)
		? raw.tracks.flatMap((track, index) => {
				const normalized = normalizeTrack(track, index);
				return normalized ? [normalized] : [];
			})
		: [];

	const hasPrimary = tracks.some((track) => track.kind === "primary");
	const normalizedTracks = hasPrimary ? tracks : [...DEFAULT_AUDIO_MIX_TRACKS, ...tracks];

	return {
		tracks: normalizedTracks,
		masterVolume: clamp(raw.masterVolume, 0, 2, DEFAULT_AUDIO_MIX_SETTINGS.masterVolume),
		duckingEnabled:
			typeof raw.duckingEnabled === "boolean"
				? raw.duckingEnabled
				: DEFAULT_AUDIO_MIX_SETTINGS.duckingEnabled,
		speechThreshold: clamp(raw.speechThreshold, 0, 1, DEFAULT_AUDIO_MIX_SETTINGS.speechThreshold),
		waveformCacheVersion: AUDIO_MIX_WAVEFORM_CACHE_VERSION,
	};
}

export function buildAudioMixTracksFromRegions(audioRegions: AudioRegion[]): AudioMixTrack[] {
	return [
		...DEFAULT_AUDIO_MIX_TRACKS,
		...audioRegions.map((region) => ({
			id: `track-${region.id}`,
			kind: "music" as const,
			label: region.assetId ?? region.audioPath?.split(/[\\/]/).pop() ?? "Audio",
			volume: region.volume,
			muted: false,
			solo: false,
			fadeInMs: region.fadeInMs,
			fadeOutMs: region.fadeOutMs,
			duckUnderSpeech: true,
			duckingAmount: 0.45,
		})),
	];
}

export function resolveAudioTrackGain(track: AudioMixTrack, options: { speechActive: boolean }) {
	if (track.muted) return 0;
	const duckingMultiplier =
		track.duckUnderSpeech && options.speechActive ? 1 - track.duckingAmount : 1;
	return clamp(track.volume * duckingMultiplier, 0, 2, 1);
}

export function filterAudibleTracks(tracks: AudioMixTrack[]) {
	const soloed = tracks.filter((track) => track.solo && !track.muted);
	return soloed.length > 0 ? soloed : tracks.filter((track) => !track.muted);
}
