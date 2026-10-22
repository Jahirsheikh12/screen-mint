import { describe, expect, it } from "vitest";
import type { ExportV2StartRequest } from "./exportV2";
import { buildTrimFilters, compileNativeComposedExport } from "./nativeComposed";

const encoder = {
	name: "libx264",
	label: "x264 H.264",
	hardwareAcceleration: "software" as const,
	available: true,
};

function makeRequest(overrides: Partial<ExportV2StartRequest> = {}): ExportV2StartRequest {
	return {
		sourcePath: "/tmp/input.mp4",
		fileName: "out.mp4",
		destination: "file",
		format: "mp4",
		width: 1920,
		height: 1080,
		frameRate: 30,
		bitrate: 12_000_000,
		durationMs: 5_000,
		selection: {
			engine: "native-composed",
			reason: "test",
		},
		compositionPayload: {
			videoUrl: "/tmp/input.mp4",
			wallpaper: "#111827",
			zoomRegions: [],
			showShadow: false,
			shadowIntensity: 0,
			backgroundBlur: 0,
			cropRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
			aspectRatio: "16:9",
			padding: 8,
			sourceWidth: 1920,
			sourceHeight: 1080,
		},
		...overrides,
	};
}

describe("native composed compiler", () => {
	it("builds a native FFmpeg filtergraph for supported common composition", () => {
		const result = compileNativeComposedExport(makeRequest(), "/tmp/out.mp4", encoder);

		expect(result.supported).toBe(true);
		expect(result.ffmpegArgs?.join(" ")).toContain("-filter_complex");
		expect(result.ffmpegArgs?.join(" ")).toContain("crop=");
		expect(result.ffmpegArgs?.join(" ")).toContain("overlay=");
		expect(result.featureReport).toEqual(expect.arrayContaining(["crop", "native-filtergraph"]));
	});

	it("keeps a frame that touches the top-left edge at offset 0", () => {
		const result = compileNativeComposedExport(
			makeRequest({
				compositionPayload: {
					...makeRequest().compositionPayload!,
					cropRegion: { x: 0, y: 0, width: 1, height: 1 },
					padding: 0,
				},
			}),
			"/tmp/out.mp4",
			encoder,
		);
		const args = result.ffmpegArgs?.join(" ") ?? "";

		expect(args).toContain("crop=1920:1080:0:0");
		expect(args).toContain("overlay=x='0-");
	});

	it("falls back to the renderer for zoom regions so transitions match preview", () => {
		const result = compileNativeComposedExport(
			makeRequest({
				compositionPayload: {
					...makeRequest().compositionPayload!,
					zoomRegions: [
						{
							id: "zoom-1",
							startMs: 500,
							endMs: 1500,
							depth: 2,
							focus: { cx: 0.25, cy: 0.75 },
							mode: "static",
						},
					],
				},
			}),
			"/tmp/out.mp4",
			encoder,
		);

		expect(result.supported).toBe(false);
	});

	it("falls back for effects that cannot be represented without fidelity loss", () => {
		const result = compileNativeComposedExport(
			makeRequest({
				compositionPayload: {
					...makeRequest().compositionPayload!,
					showCursor: true,
					cursorTelemetry: [{ timeMs: 0, cx: 0.5, cy: 0.5 }],
				},
			}),
			"/tmp/out.mp4",
			encoder,
		);

		expect(result.supported).toBe(false);
		expect(result.fallbackReason).toContain("Cursor");
	});

	it("falls back for captions instead of approximating them", () => {
		const result = compileNativeComposedExport(
			makeRequest({
				compositionPayload: {
					...makeRequest().compositionPayload!,
					captionSettings: {
						enabled: true,
						animationMode: "static",
						position: "bottom",
						positionOverride: null,
						maxLines: 2,
						maxWordsPerLine: 6,
						safeAreaInset: 10,
						showTranscriptPanel: false,
						style: {
							preset: "classic",
							fontSize: 48,
							fontFamily: "Inter",
							fontWeight: "bold",
							fontStyle: "normal",
							color: "#ffffff",
							highlightColor: "#facc15",
							backgroundColor: "#000000",
							backgroundOpacity: 0.4,
							borderRadius: 0,
							outlineColor: "#000000",
							outlineWidth: 0,
							shadowColor: "#000000",
							shadowBlur: 0,
							shadowOffsetY: 0,
							letterSpacing: 0,
							lineHeight: 1.1,
							textTransform: "none",
						},
					},
					captionRegions: [{ id: "caption-1", startMs: 0, endMs: 1000, text: "Hello", words: [] }],
				},
			}),
			"/tmp/out.mp4",
			encoder,
		);

		expect(result.supported).toBe(false);
		expect(result.fallbackReason).toContain("Captions and annotations");
	});

	it("shifts kept frames by the trimmed time instead of renumbering them", () => {
		const filters = buildTrimFilters([
			{ startMs: 1000, endMs: 2500 },
			{ startMs: 4000, endMs: 5000 },
		]);
		const keep = "not(between(t\\,1.000\\,2.500)+between(t\\,4.000\\,5.000))";
		const pts = "PTS-(gte(T\\,2.500)*1.500+gte(T\\,5.000)*1.000)/TB";

		expect(filters).toEqual({
			video: `select='${keep}',setpts='${pts}'`,
			audio: `aselect='${keep}',asetpts='${pts}'`,
		});
		expect(buildTrimFilters([])).toBeNull();
	});
});
