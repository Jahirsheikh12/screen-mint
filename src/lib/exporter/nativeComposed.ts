import type { PaddingValue } from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { ExportV2EncoderCandidate, ExportV2StartRequest } from "./exportV2";
import { resolvePaddedArea } from "./paddedArea";

export interface NativeComposedCompileResult {
	supported: boolean;
	ffmpegArgs?: string[];
	fallbackReason?: string;
	featureReport: string[];
}

const DEFAULT_CROP = { x: 0, y: 0, width: 1, height: 1 };

export function compileNativeComposedExport(
	request: ExportV2StartRequest,
	outputPath: string,
	encoder: ExportV2EncoderCandidate,
): NativeComposedCompileResult {
	const composition = request.compositionPayload;
	const featureReport: string[] = [];
	if (!composition) {
		return unsupported("No composition payload was provided.", featureReport);
	}
	if (request.format !== "mp4") {
		return unsupported("Native composition is currently MP4-only.", featureReport);
	}
	if (request.speedRegions?.length || composition.speedRegions?.length) {
		return unsupported("Speed-edited timelines require the renderer path.", featureReport);
	}
	if (composition.webcamPath && composition.showWebcam !== false) {
		return unsupported("Webcam overlays require the renderer path.", featureReport);
	}
	if (composition.showKeyboardShortcuts && composition.keyboardShortcutCallouts?.length) {
		return unsupported("Keyboard shortcut callouts require the renderer path.", featureReport);
	}
	if (composition.showCursor && composition.cursorTelemetry?.length) {
		return unsupported("Cursor overlays require the renderer path.", featureReport);
	}
	if (
		composition.showShadow ||
		(composition.frameShadowOpacity ?? 0) > 0 ||
		(composition.frameShadowBlur ?? 0) > 0 ||
		(composition.frameShadowSize ?? 0) > 0
	) {
		return unsupported("Frame shadows require the renderer path.", featureReport);
	}
	if ((composition.backgroundBlur ?? 0) > 0) {
		return unsupported("Blurred backgrounds require the renderer path.", featureReport);
	}
	if ((composition.borderRadius ?? 0) > 0) {
		return unsupported("Rounded frame masks require the renderer path.", featureReport);
	}
	if (composition.frameBorderEnabled) {
		return unsupported("Frame borders require the renderer path.", featureReport);
	}
	if (composition.hideBackground) {
		return unsupported("Transparent/hidden backgrounds require the renderer path.", featureReport);
	}
	if (composition.deviceMockup && composition.deviceMockup !== "none") {
		return unsupported("Device mockups require the renderer path.", featureReport);
	}

	const sourceWidth = composition.sourceWidth;
	const sourceHeight = composition.sourceHeight;
	if (!sourceWidth || !sourceHeight) {
		return unsupported("Source dimensions are required for native composition.", featureReport);
	}

	const layout = resolveNativeLayout({
		outputWidth: request.width,
		outputHeight: request.height,
		sourceWidth,
		sourceHeight,
		cropRegion: composition.cropRegion,
		padding: composition.padding,
		aspectRatio: composition.aspectRatio,
	});
	if (!layout) {
		return unsupported("Unable to resolve native composition layout.", featureReport);
	}

	const background = resolveBackground(composition.wallpaper);
	if (!background.supported) {
		return unsupported(background.reason, featureReport);
	}

	const zoom = resolveZoomExpression(composition.zoomRegions ?? []);
	if (!zoom.supported) {
		return unsupported(zoom.reason, featureReport);
	}

	// drawtext can't match the renderer's caption/annotation timing, scaling and layout.
	const hasCaptions = Boolean(
		composition.captionSettings?.enabled && composition.captionRegions?.length,
	);
	if (hasCaptions || composition.annotationRegions?.length) {
		return unsupported("Captions and annotations require the renderer path.", featureReport);
	}

	const trimFilters = buildTrimFilters(request.trimRegions);
	const sourceFilters: string[] = [];
	if (trimFilters) {
		sourceFilters.push(trimFilters.video);
		featureReport.push("trim");
	}
	const crop = layout.cropPixels;
	sourceFilters.push(
		`crop=${even(crop.width)}:${even(crop.height)}:${evenOffset(crop.x)}:${evenOffset(crop.y)}`,
	);
	featureReport.push("crop");
	sourceFilters.push("setsar=1");

	const zoomExpr = zoom.expression;
	sourceFilters.push(
		`scale='${layout.maskRect.width}*${zoomExpr}':'${layout.maskRect.height}*${zoomExpr}':eval=frame:flags=lanczos`,
	);
	sourceFilters.push(`fps=${request.frameRate}`);

	const bg = `color=c=${background.color}:s=${request.width}x${request.height}:r=${request.frameRate}:d=${Math.max((request.durationMs ?? 1000) / 1000, 0.001)}[bg]`;
	const overlayX = `${layout.maskRect.x}-(${layout.maskRect.width}*(${zoomExpr}-1)*${zoom.focusX})`;
	const overlayY = `${layout.maskRect.y}-(${layout.maskRect.height}*(${zoomExpr}-1)*${zoom.focusY})`;
	const videoFilter = `[0:v]${sourceFilters.join(",")}[nativev];[bg][nativev]overlay=x='${overlayX}':y='${overlayY}':eval=frame:shortest=1`;
	const filterComplex = `${bg};${videoFilter},format=yuv420p[outv]`;

	const audioFilters: string[] = [];
	if (trimFilters) {
		audioFilters.push(trimFilters.audio);
	}

	const args = [
		"-y",
		"-hide_banner",
		"-nostats",
		"-progress",
		"pipe:2",
		"-i",
		normalizeExportV2SourcePath(request.sourcePath),
		"-filter_complex",
		filterComplex,
		"-map",
		"[outv]",
		"-map",
		"0:a?",
	];
	if (audioFilters.length > 0) {
		args.push("-af", audioFilters.join(","));
	}
	args.push(...buildEncoderArgs(request, encoder), outputPath);

	featureReport.push("native-filtergraph");
	return {
		supported: true,
		ffmpegArgs: args,
		featureReport: Array.from(new Set(featureReport)),
	};
}

function unsupported(reason: string, featureReport: string[]): NativeComposedCompileResult {
	return { supported: false, fallbackReason: reason, featureReport };
}

function normalizeExportV2SourcePath(sourcePath: string) {
	if (sourcePath.startsWith("file://")) {
		try {
			return decodeURIComponent(new URL(sourcePath).pathname);
		} catch {
			return sourcePath.replace(/^file:\/\//, "");
		}
	}
	return sourcePath;
}

function buildEncoderArgs(request: ExportV2StartRequest, encoder: ExportV2EncoderCandidate) {
	const args = ["-c:v", encoder.name];
	if (encoder.name === "libx264") {
		args.push(
			"-preset",
			"veryfast",
			"-profile:v",
			"high",
			"-crf",
			resolveNativeComposedCrf(request),
		);
	} else if (encoder.name === "h264_videotoolbox") {
		args.push("-allow_sw", "1");
		if (request.bitrate) args.push("-b:v", String(request.bitrate));
	} else if (request.bitrate) {
		args.push("-b:v", String(request.bitrate));
	}

	args.push(
		"-g",
		String(Math.max(1, Math.round(request.frameRate * (request.keyframeIntervalSeconds ?? 2)))),
		"-pix_fmt",
		"yuv420p",
		"-colorspace",
		"bt709",
		"-color_primaries",
		"bt709",
		"-color_trc",
		"bt709",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-movflags",
		"+faststart",
	);
	return args;
}

function resolveNativeComposedCrf(request: ExportV2StartRequest) {
	switch (request.bitrateMode) {
		case "archive":
			return "14";
		case "very-high":
			return "16";
		case "high":
			return "18";
		default:
			return "20";
	}
}

function resolveBackground(
	wallpaper: string,
): { supported: true; color: string } | { supported: false; reason: string } {
	if (!wallpaper || wallpaper === "transparent") {
		return { supported: true, color: "black" };
	}
	if (wallpaper.startsWith("#")) {
		return { supported: true, color: `0x${wallpaper.slice(1)}` };
	}
	if (/^[a-z]+$/i.test(wallpaper)) {
		return { supported: true, color: wallpaper };
	}
	return {
		supported: false,
		reason: "Image and gradient backgrounds require the renderer path.",
	};
}

function resolveZoomExpression(
	zoomRegions: ExportV2StartRequest["compositionPayload"] extends infer _T
		? NonNullable<NonNullable<ExportV2StartRequest["compositionPayload"]>["zoomRegions"]>
		: never,
) {
	if (zoomRegions.length > 0) {
		// The filtergraph can only step between scales; eased zoom-in/out needs the renderer.
		return {
			supported: false as const,
			reason: "Animated zoom transitions require the renderer path.",
		};
	}
	return { supported: true as const, expression: "1", focusX: 0.5, focusY: 0.5 };
}

/**
 * FFmpeg filters that drop trimmed ranges. Kept frames are shifted back by the trimmed time
 * before them, which keeps real timestamps: retiming by frame count (N/FRAME_RATE) drifts on
 * variable-frame-rate screen recordings and pulls video out of sync with audio.
 */
export function buildTrimFilters(trimRegions: ExportV2StartRequest["trimRegions"] = []) {
	const trims = trimRegions
		.filter((region) => region.endMs > region.startMs)
		.map((region) => ({
			start: Math.max(0, region.startMs / 1000).toFixed(3),
			end: Math.max(0, region.endMs / 1000).toFixed(3),
			length: (Math.max(0, region.endMs - region.startMs) / 1000).toFixed(3),
		}));
	if (trims.length === 0) return null;
	const keep = `not(${trims.map((t) => `between(t\\,${t.start}\\,${t.end})`).join("+")})`;
	const removedBefore = trims.map((t) => `gte(T\\,${t.end})*${t.length}`).join("+");
	const pts = `PTS-(${removedBefore})/TB`;
	return {
		video: `select='${keep}',setpts='${pts}'`,
		audio: `aselect='${keep}',asetpts='${pts}'`,
	};
}

function resolveNativeLayout(params: {
	outputWidth: number;
	outputHeight: number;
	sourceWidth: number;
	sourceHeight: number;
	cropRegion?: { x: number; y: number; width: number; height: number };
	padding?: PaddingValue;
	aspectRatio?: AspectRatio;
}) {
	const crop = normalizeCrop(params.cropRegion);
	const cropWidth = params.sourceWidth * crop.width;
	const cropHeight = params.sourceHeight * crop.height;
	if (cropWidth <= 0 || cropHeight <= 0) return null;
	const croppedAspect = cropWidth / cropHeight;
	const area = resolvePaddedArea(params.outputWidth, params.outputHeight, params.padding);
	const targetAspect = getAspectRatioValue(params.aspectRatio, croppedAspect);
	const frameSize = fitRectWithin(area.width, area.height, targetAspect);
	const frameRect = centerRect(area.width, area.height, frameSize.width, frameSize.height);
	frameRect.x += area.x;
	frameRect.y += area.y;
	const contentSize = fitRectWithin(frameRect.width, frameRect.height, croppedAspect);
	const maskRect = centerRect(
		frameRect.width,
		frameRect.height,
		contentSize.width,
		contentSize.height,
	);
	maskRect.x += frameRect.x;
	maskRect.y += frameRect.y;
	return {
		maskRect: {
			x: evenOffset(maskRect.x),
			y: evenOffset(maskRect.y),
			width: even(maskRect.width),
			height: even(maskRect.height),
		},
		cropPixels: {
			x: crop.x * params.sourceWidth,
			y: crop.y * params.sourceHeight,
			width: cropWidth,
			height: cropHeight,
		},
	};
}

function normalizeCrop(region = DEFAULT_CROP) {
	const x = clamp01(region.x);
	const y = clamp01(region.y);
	return {
		x,
		y,
		width: clamp(region.width, 0.0001, 1 - x),
		height: clamp(region.height, 0.0001, 1 - y),
	};
}

function getAspectRatioValue(aspectRatio: AspectRatio = "native", nativeAspectRatio: number) {
	if (aspectRatio === "native") return nativeAspectRatio > 0 ? nativeAspectRatio : 16 / 9;
	const [rawWidth, rawHeight] = aspectRatio.split(":");
	const width = Number(rawWidth);
	const height = Number(rawHeight);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
		? width / height
		: nativeAspectRatio;
}

function fitRectWithin(width: number, height: number, aspectRatio: number) {
	return width / height > aspectRatio
		? { width: height * aspectRatio, height }
		: { width, height: width / aspectRatio };
}

function centerRect(
	containerWidth: number,
	containerHeight: number,
	width: number,
	height: number,
) {
	return { x: (containerWidth - width) / 2, y: (containerHeight - height) / 2, width, height };
}

// Even values keep yuv420 chroma aligned. Sizes need at least 2px; offsets may be 0.
function even(value: number) {
	const rounded = Math.max(2, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}

function evenOffset(value: number) {
	const rounded = Math.max(0, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}

function clamp01(value: number) {
	return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
