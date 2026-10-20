import type {
	AnnotationRegion,
	CaptionRegion,
	CaptionSettings,
	PaddingValue,
} from "@/components/video-editor/types";
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

	const overlayFilters = [
		...compileCaptionFilters(
			composition.captionRegions ?? [],
			composition.captionSettings,
			request.width,
			request.height,
			featureReport,
		),
		...compileAnnotationFilters(
			composition.annotationRegions ?? [],
			request.width,
			request.height,
			featureReport,
		),
	];
	if (overlayFilters.some((filter) => filter.startsWith("unsupported:"))) {
		return unsupported(
			overlayFilters.find((filter) => filter.startsWith("unsupported:"))!.slice(12),
			featureReport,
		);
	}

	const trimExpression = buildTrimSelectExpression(request.trimRegions);
	const sourceFilters: string[] = [];
	if (trimExpression) {
		sourceFilters.push(`select='${trimExpression}'`, "setpts=N/FRAME_RATE/TB");
		featureReport.push("trim");
	}
	const crop = layout.cropPixels;
	sourceFilters.push(
		`crop=${even(crop.width)}:${even(crop.height)}:${even(crop.x)}:${even(crop.y)}`,
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
	const filterComplex = `${bg};${videoFilter}${overlayFilters.length > 0 ? `,${overlayFilters.join(",")}` : ""},format=yuv420p[outv]`;

	const audioFilters: string[] = [];
	if (trimExpression) {
		audioFilters.push(`aselect='${trimExpression}'`, "asetpts=N/SR/TB");
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
		String(Math.max(1, Math.round(request.frameRate * 2))),
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

function compileCaptionFilters(
	captions: CaptionRegion[],
	settings: CaptionSettings | undefined,
	width: number,
	height: number,
	featureReport: string[],
) {
	if (!settings?.enabled || captions.length === 0) return [];
	if (settings.animationMode !== "static") {
		return ["unsupported:Animated captions require the renderer path."];
	}
	const style = settings.style;
	if (
		style.fontWeight !== "normal" ||
		style.fontStyle !== "normal" ||
		style.borderRadius > 0 ||
		style.shadowBlur > 0 ||
		style.shadowOffsetY !== 0 ||
		style.letterSpacing !== 0 ||
		style.textTransform !== "none"
	) {
		return ["unsupported:Styled captions require the renderer path."];
	}
	const y =
		settings.position === "top"
			? Math.round(height * (settings.safeAreaInset / 100))
			: settings.position === "center"
				? "(h-text_h)/2"
				: `h-text_h-${Math.round(height * (settings.safeAreaInset / 100))}`;
	const x = settings.positionOverride
		? Math.round((settings.positionOverride.xPercent / 100) * width)
		: "(w-text_w)/2";
	const yExpr = settings.positionOverride
		? Math.round((settings.positionOverride.yPercent / 100) * height)
		: y;
	featureReport.push("captions");
	return captions.map((caption) =>
		[
			"drawtext",
			`text='${escapeDrawtext(caption.text)}'`,
			`enable='between(t\\,${(caption.startMs / 1000).toFixed(3)}\\,${(caption.endMs / 1000).toFixed(3)})'`,
			`x=${x}`,
			`y=${yExpr}`,
			`fontsize=${Math.max(8, Math.round(style.fontSize))}`,
			`fontcolor=${escapeColor(style.color)}`,
			`box=${style.backgroundOpacity > 0 ? 1 : 0}`,
			`boxcolor=${escapeColor(style.backgroundColor)}@${clamp01(style.backgroundOpacity).toFixed(3)}`,
			`borderw=${Math.max(0, Math.round(style.outlineWidth))}`,
			`bordercolor=${escapeColor(style.outlineColor)}`,
		].join(":"),
	);
}

function compileAnnotationFilters(
	annotations: AnnotationRegion[],
	width: number,
	height: number,
	featureReport: string[],
) {
	if (annotations.length === 0) return [];
	const filters: string[] = [];
	for (const annotation of annotations) {
		if (annotation.type !== "text") {
			return ["unsupported:Image, figure, and blur annotations require the renderer path."];
		}
		if (annotation.style.textDecoration !== "none") {
			return ["unsupported:Underlined text annotations require the renderer path."];
		}
		if (
			annotation.style.fontWeight !== "normal" ||
			annotation.style.fontStyle !== "normal" ||
			annotation.style.textAlign !== "left"
		) {
			return ["unsupported:Styled text annotations require the renderer path."];
		}
		const x = Math.round((annotation.position.x / 100) * width);
		const y = Math.round((annotation.position.y / 100) * height);
		filters.push(
			[
				"drawtext",
				`text='${escapeDrawtext(annotation.textContent || annotation.content)}'`,
				`enable='between(t\\,${(annotation.startMs / 1000).toFixed(3)}\\,${(annotation.endMs / 1000).toFixed(3)})'`,
				`x=${x}`,
				`y=${y}`,
				`fontsize=${Math.max(8, Math.round(annotation.style.fontSize))}`,
				`fontcolor=${escapeColor(annotation.style.color)}`,
				`box=${annotation.style.backgroundColor !== "transparent" ? 1 : 0}`,
				`boxcolor=${escapeColor(annotation.style.backgroundColor)}@1`,
			].join(":"),
		);
	}
	featureReport.push("text-annotations");
	return filters;
}

function buildTrimSelectExpression(trimRegions: ExportV2StartRequest["trimRegions"] = []) {
	const validTrims = trimRegions
		.filter((region) => region.endMs > region.startMs)
		.map((region) => ({
			startSec: Math.max(0, region.startMs / 1000),
			endSec: Math.max(0, region.endMs / 1000),
		}));
	if (validTrims.length === 0) return null;
	const removedRanges = validTrims
		.map((region) => `between(t\\,${region.startSec.toFixed(3)}\\,${region.endSec.toFixed(3)})`)
		.join("+");
	return `not(${removedRanges})`;
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
			x: even(maskRect.x),
			y: even(maskRect.y),
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

function even(value: number) {
	const rounded = Math.max(2, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}

function clamp01(value: number) {
	return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function escapeDrawtext(value: string) {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/:/g, "\\:")
		.replace(/'/g, "\\'")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]")
		.replace(/\n/g, "\\n");
}

function escapeColor(color: string) {
	if (!color || color === "transparent") return "black";
	return color.replace("#", "0x");
}
