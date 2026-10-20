import { formatCaptionTrack } from "./captionTranscript";
import type { CaptionTrack, SpeedRegion, TrimRegion } from "./types";

type Span = { startMs: number; endMs: number };

/** Maps a time on the source timeline to the exported video's timeline (trims removed, speed applied). */
export function mapSourceTimeToOutput(
	timeMs: number,
	trimRegions: readonly Span[],
	speedRegions: readonly (Span & { speed: number })[],
): number {
	const points = new Set<number>([0, timeMs]);
	for (const region of [...trimRegions, ...speedRegions]) {
		if (region.startMs < timeMs) points.add(Math.max(0, region.startMs));
		if (region.endMs < timeMs) points.add(Math.max(0, region.endMs));
	}
	const sorted = [...points].filter((p) => p <= timeMs).sort((a, b) => a - b);
	let output = 0;
	for (let i = 0; i < sorted.length - 1; i++) {
		const start = sorted[i];
		const end = sorted[i + 1];
		const mid = (start + end) / 2;
		if (trimRegions.some((trim) => mid >= trim.startMs && mid < trim.endMs)) continue;
		const speed = speedRegions.find((region) => mid >= region.startMs && mid < region.endMs)?.speed;
		output += (end - start) / (speed && speed > 0 ? speed : 1);
	}
	return output;
}

/** SRT and VTT text for the exported video, or undefined when there are no captions. */
export function buildCaptionSidecar(
	track: CaptionTrack | null | undefined,
	trimRegions: readonly TrimRegion[],
	speedRegions: readonly SpeedRegion[],
): { srt: string; vtt: string } | undefined {
	if (!track) return undefined;
	const segments = track.segments
		.filter((segment) => segment.text.trim() && segment.endMs > segment.startMs)
		.map((segment) => ({
			...segment,
			startMs: Math.round(mapSourceTimeToOutput(segment.startMs, trimRegions, speedRegions)),
			endMs: Math.round(mapSourceTimeToOutput(segment.endMs, trimRegions, speedRegions)),
		}))
		// Captions that fall entirely inside a trim collapse to zero length.
		.filter((segment) => segment.endMs > segment.startMs);
	if (segments.length === 0) return undefined;
	const mapped = { ...track, segments };
	return { srt: formatCaptionTrack(mapped, "srt"), vtt: formatCaptionTrack(mapped, "vtt") };
}
