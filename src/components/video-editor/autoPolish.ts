import type { AspectRatio } from "@/utils/aspectRatioUtils";
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
	return {
		zoomRegions: buildAutoZooms(input),
		showCursor: input.cursorTelemetry.length > 0,
		showCaptions: Boolean(input.captionTrack?.segments.length),
		exportPreset: contentType === "pitch-deck" ? "master" : "quality",
	};
}
