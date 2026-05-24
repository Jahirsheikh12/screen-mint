import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { AudioMixSettings } from "./audioMix";
import { normalizeAudioMixSettings } from "./audioMix";
import type { Scene3DSettings } from "./scene3d";
import { normalizeScene3DSettings } from "./scene3d";
import type { CaptionTrack, CursorTelemetryPoint, ZoomRegion } from "./types";

export type AutoPolishContentType = "landing-page" | "product-hunt" | "app-store" | "pitch-deck";

export interface AutoPolishInput {
	aspectRatio: AspectRatio;
	durationMs: number;
	cursorTelemetry: CursorTelemetryPoint[];
	captionTrack: CaptionTrack | null;
	contentType?: AutoPolishContentType;
}

export interface AutoPolishResult {
	scene3D: Scene3DSettings;
	audioMix: AudioMixSettings;
	zoomRegions: ZoomRegion[];
	showCursor: boolean;
	showCaptions: boolean;
	exportPreset: "fast-share" | "balanced" | "quality" | "master";
}

function pickContentType(input: AutoPolishInput): AutoPolishContentType {
	if (input.contentType) return input.contentType;
	if (input.aspectRatio === "9:16") return "app-store";
	if (input.durationMs <= 45_000) return "product-hunt";
	if (input.durationMs >= 180_000) return "pitch-deck";
	return "landing-page";
}

function buildAutoZooms(input: AutoPolishInput): ZoomRegion[] {
	const activeSamples = input.cursorTelemetry.filter((sample) =>
		["click", "double-click", "mousedown", "mouseup"].includes(sample.interactionType ?? ""),
	);
	return activeSamples.slice(0, 6).map((sample, index) => {
		const startMs = Math.max(0, Math.round(sample.timeMs) - 650);
		const endMs = Math.min(Math.max(startMs + 1200, startMs), input.durationMs || startMs + 1600);
		return {
			id: `auto-polish-zoom-${index + 1}`,
			startMs,
			endMs,
			depth: 3,
			focus: {
				cx: Math.min(1, Math.max(0, sample.cx)),
				cy: Math.min(1, Math.max(0, sample.cy)),
			},
			mode: "cursor-follow",
		};
	});
}

export function buildAutoPolishResult(input: AutoPolishInput): AutoPolishResult {
	const contentType = pickContentType(input);
	const presetId =
		contentType === "product-hunt"
			? "product-hunt-launch"
			: contentType === "app-store"
				? "app-store-preview"
				: contentType === "pitch-deck"
					? "pitch-deck-wide"
					: "browser-hero-demo";

	return {
		scene3D: normalizeScene3DSettings({
			enabled: true,
			presetId,
			environment: contentType === "pitch-deck" ? "keynote" : "studio",
			lens: {
				focalLengthMm: contentType === "app-store" ? 35 : 42,
				perspectiveStrength: contentType === "pitch-deck" ? 0.35 : 0.55,
				depthOfField: contentType === "landing-page" ? 0.16 : 0.1,
				vignette: 0.14,
				bloom: 0.07,
				motionBlur: input.cursorTelemetry.length > 20 ? 0.2 : 0.08,
			},
		}),
		audioMix: normalizeAudioMixSettings({
			duckingEnabled: true,
			tracks: [
				{
					id: "track-primary",
					kind: "primary",
					label: "Recording audio",
					volume: input.captionTrack ? 1 : 0.9,
					muted: false,
					solo: false,
					fadeInMs: 0,
					fadeOutMs: 0,
					duckUnderSpeech: false,
					duckingAmount: 0,
				},
			],
		}),
		zoomRegions: buildAutoZooms(input),
		showCursor: input.cursorTelemetry.length > 0,
		showCaptions: Boolean(input.captionTrack?.segments.length),
		exportPreset: contentType === "pitch-deck" ? "master" : "quality",
	};
}
