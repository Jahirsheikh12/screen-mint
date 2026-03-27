import clickErrorUrl from "@/assets/audio/mixkit-click-error-1110.wav";
import negativeToneUrl from "@/assets/audio/mixkit-negative-tone-interface-tap-2569.wav";
import selectClickUrl from "@/assets/audio/mixkit-select-click-1109.wav";

export type AppAudioCueId = "recording-start" | "recording-stop" | "recording-error";

type AppAudioCue = {
	src: string;
	volume: number;
};

const APP_AUDIO_CUES: Record<AppAudioCueId, AppAudioCue> = {
	"recording-start": {
		src: selectClickUrl,
		volume: 0.72,
	},
	"recording-stop": {
		src: negativeToneUrl,
		volume: 0.78,
	},
	"recording-error": {
		src: clickErrorUrl,
		volume: 0.74,
	},
};

const audioElements = new Map<AppAudioCueId, HTMLAudioElement>();
const lastPlaybackAt = new Map<AppAudioCueId, number>();
const PLAYBACK_THROTTLE_MS = 120;

function canUseAudio() {
	return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function getOrCreateAudioElement(cueId: AppAudioCueId): HTMLAudioElement | null {
	if (!canUseAudio()) {
		return null;
	}

	const existing = audioElements.get(cueId);
	if (existing) {
		return existing;
	}

	const cue = APP_AUDIO_CUES[cueId];
	const audio = new Audio(cue.src);
	audio.preload = "auto";
	audio.volume = cue.volume;
	audioElements.set(cueId, audio);
	return audio;
}

export function preloadAppAudioCues() {
	if (!canUseAudio()) {
		return;
	}

	for (const cueId of Object.keys(APP_AUDIO_CUES) as AppAudioCueId[]) {
		const audio = getOrCreateAudioElement(cueId);
		audio?.load();
	}
}

export async function playAppAudioCue(cueId: AppAudioCueId): Promise<boolean> {
	const audio = getOrCreateAudioElement(cueId);
	if (!audio) {
		return false;
	}

	const now = Date.now();
	const lastPlayedAt = lastPlaybackAt.get(cueId) ?? 0;
	if (now - lastPlayedAt < PLAYBACK_THROTTLE_MS) {
		return false;
	}

	lastPlaybackAt.set(cueId, now);
	audio.currentTime = 0;
	audio.volume = APP_AUDIO_CUES[cueId].volume;
	try {
		await audio.play();
		return true;
	} catch {
		return false;
	}
}
