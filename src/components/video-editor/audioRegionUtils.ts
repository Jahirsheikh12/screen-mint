import { getBackgroundMusicAssetById } from "@/lib/backgroundMusic";
import { toFileUrl } from "./projectPersistence";
import type { AudioRegion, AudioRegionSource, AudioTrackSelection } from "./types";

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function isBuiltInAudioSource(source: AudioRegionSource): boolean {
	return source.sourceType === "built-in";
}

export function isFileAudioSource(source: AudioRegionSource): boolean {
	return source.sourceType === "file";
}

export async function resolveAudioSourceUrl(source: AudioRegionSource): Promise<string | null> {
	if (isBuiltInAudioSource(source)) {
		const asset = getBackgroundMusicAssetById(source.assetId);
		if (!asset) {
			return null;
		}

		return asset.sourceUrl;
	}

	if (source.audioPath?.trim()) {
		return toFileUrl(source.audioPath);
	}

	return null;
}

export async function loadAudioSelectionDurationMs(
	selection: AudioTrackSelection | AudioRegionSource,
): Promise<number> {
	if (isBuiltInAudioSource(selection)) {
		const builtInDuration = getBackgroundMusicAssetById(selection.assetId)?.durationMs;
		if (typeof builtInDuration === "number" && builtInDuration > 0) {
			return builtInDuration;
		}
	}

	const sourceUrl = await resolveAudioSourceUrl(selection);
	if (!sourceUrl) {
		return 0;
	}

	return new Promise<number>((resolve) => {
		const audio = new Audio(sourceUrl);
		audio.preload = "metadata";
		audio.addEventListener(
			"loadedmetadata",
			() => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0),
			{ once: true },
		);
		audio.addEventListener("error", () => resolve(0), { once: true });
	});
}

export function getAudioRegionDisplayName(region: AudioRegionSource): string {
	if (isBuiltInAudioSource(region)) {
		return getBackgroundMusicAssetById(region.assetId)?.label ?? "Built-in track";
	}

	return (
		region.audioPath
			?.split(/[\\/]/)
			.pop()
			?.replace(/\.[^.]+$/, "") || "Audio"
	);
}

export function getAudioRegionFadeMultiplier(region: AudioRegion, currentTimeMs: number): number {
	if (currentTimeMs < region.startMs || currentTimeMs >= region.endMs) {
		return 0;
	}

	const elapsedMs = currentTimeMs - region.startMs;
	const remainingMs = region.endMs - currentTimeMs;

	const fadeInFactor =
		region.fadeInMs > 0 ? clamp(elapsedMs / Math.max(1, region.fadeInMs), 0, 1) : 1;
	const fadeOutFactor =
		region.fadeOutMs > 0 ? clamp(remainingMs / Math.max(1, region.fadeOutMs), 0, 1) : 1;

	return clamp(Math.min(fadeInFactor, fadeOutFactor), 0, 1);
}

export function getAudioPlaybackOffsetSeconds(
	region: AudioRegion,
	currentTimeMs: number,
	sourceDurationSeconds: number,
): number {
	const rawOffsetSeconds = Math.max(0, (currentTimeMs - region.startMs) / 1000);
	if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
		return rawOffsetSeconds;
	}

	if (region.loop) {
		return rawOffsetSeconds % sourceDurationSeconds;
	}

	return Math.min(rawOffsetSeconds, sourceDurationSeconds);
}
