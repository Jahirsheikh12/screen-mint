import {
	DEFAULT_CAMERA_LAYOUT_MOTION_PRESET,
	DEFAULT_WEBCAM_EFFECTS,
	MAX_WEBCAM_SOURCE_CROP,
	type WebcamEffectFallbackState,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamRegion,
	type WebcamSourceCrop,
} from "./types";
import type { WebcamSegmentationFrame } from "./webcamSegmentation";

export interface WebcamRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ResolvedWebcamCompositionModel {
	displayRect: WebcamRect;
	backgroundRect: WebcamRect;
	subjectRect: WebcamRect;
	matteCrop: WebcamRect | null;
	backgroundMode: WebcamEffects["backgroundMode"];
	backgroundColor: string;
	backgroundImagePath?: string;
	backgroundBlurPx: number;
	edgeFeatherPx: number;
	backgroundCrop: WebcamRect | null;
	subjectCrop: WebcamRect | null;
	sourceSize: { width: number; height: number } | null;
	cssFilter: string;
	canvasFilter: string;
	backgroundFilter: string;
	subjectFilter: string;
	shadowBlurPx: number;
	shadowOffsetYPx: number;
	shadowOpacity: number;
	shadowColor: string;
	matteMask: HTMLCanvasElement | OffscreenCanvas | null;
	matteInsetPx: number;
	backgroundOverlayOpacity: number;
	contactShadowOpacity: number;
	contactShadowBlurPx: number;
	contactShadowOffsetYPx: number;
	renderMode: "preview" | "export";
	backgroundCacheKey: string | null;
	fallbackState: WebcamEffectFallbackState;
	segmentationFrame: WebcamSegmentationFrame | null;
	usesSegmentation: boolean;
}

export type ResolvedWebcamEffectModel = ResolvedWebcamCompositionModel;

export interface WebcamStylePresetDefinition {
	id: WebcamEffects["presetId"];
	label: string;
	region: Partial<WebcamRegion>;
	effects: Partial<WebcamEffects>;
}

export interface WebcamCompositionScratch {
	layerCanvas: HTMLCanvasElement | OffscreenCanvas;
	layerCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	maskCanvas: HTMLCanvasElement | OffscreenCanvas;
	maskCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	shadowCanvas: HTMLCanvasElement | OffscreenCanvas;
	shadowCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	backgroundCanvas: HTMLCanvasElement | OffscreenCanvas;
	backgroundCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	backgroundCacheKey: string | null;
}

export interface ResolvedWebcamEffectCapability {
	configuredBackgroundMode: WebcamEffects["backgroundMode"];
	appliedBackgroundMode: WebcamEffects["backgroundMode"];
	fallbackState: WebcamEffectFallbackState;
	canApplyBackgroundTreatment: boolean;
	canApplyEdgeFeather: boolean;
	isFallbackActive: boolean;
	statusTone: "neutral" | "warning" | "info";
	statusTitle: string;
	statusDescription: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function createCanvas(width: number, height: number) {
	if (typeof OffscreenCanvas !== "undefined") {
		return new OffscreenCanvas(width, height);
	}

	if (typeof document === "undefined") {
		const noop = () => {
			// Headless unit tests only need a shape-compatible context.
		};
		const fallbackContext = {
			clearRect: noop,
			setTransform: noop,
			drawImage: noop,
			save: noop,
			restore: noop,
			translate: noop,
			scale: noop,
			filter: "none",
			globalCompositeOperation: "source-over",
		} as unknown as CanvasRenderingContext2D;
		return {
			width,
			height,
			getContext: () => fallbackContext,
		} as unknown as HTMLCanvasElement;
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function createCanvasContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
	return canvas.getContext("2d", {
		alpha: true,
		willReadFrequently: false,
	}) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

function resizeScratchCanvas(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	width: number,
	height: number,
) {
	if (canvas.width !== width) {
		canvas.width = width;
	}
	if (canvas.height !== height) {
		canvas.height = height;
	}

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, width, height);
}

function normalizeOptionalPath(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function mixColorWithWarmth(color: string, warmth: number) {
	if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) {
		return color;
	}

	const hex =
		color.length === 4
			? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
			: color;
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	const intensity = clamp(warmth, -1, 1);
	const nextRed = clamp(Math.round(red + 36 * intensity), 0, 255);
	const nextBlue = clamp(Math.round(blue - 36 * intensity), 0, 255);
	const nextGreen = clamp(Math.round(green + 10 * intensity), 0, 255);
	return `#${nextRed.toString(16).padStart(2, "0")}${nextGreen
		.toString(16)
		.padStart(2, "0")}${nextBlue.toString(16).padStart(2, "0")}`;
}

export function normalizeWebcamSourceCrop(candidate: unknown): WebcamSourceCrop {
	const crop = (candidate && typeof candidate === "object" ? candidate : {}) as Record<
		string,
		unknown
	>;
	const side = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value)
			? clamp(value, 0, MAX_WEBCAM_SOURCE_CROP)
			: 0;
	return {
		top: side(crop.top),
		right: side(crop.right),
		bottom: side(crop.bottom),
		left: side(crop.left),
	};
}

export function normalizeWebcamEffects(
	candidate: Partial<WebcamEffects> | null | undefined,
): WebcamEffects {
	const effects = candidate ?? {};

	return {
		presetId:
			effects.presetId === "classic-circle" ||
			effects.presetId === "presenter-soft" ||
			effects.presetId === "floating-card" ||
			effects.presetId === "spotlight" ||
			effects.presetId === "fullscreen-commentary" ||
			effects.presetId === "custom"
				? effects.presetId
				: DEFAULT_WEBCAM_EFFECTS.presetId,
		backgroundMode:
			effects.backgroundMode === "blur" ||
			effects.backgroundMode === "solid" ||
			effects.backgroundMode === "image" ||
			effects.backgroundMode === "none"
				? effects.backgroundMode
				: DEFAULT_WEBCAM_EFFECTS.backgroundMode,
		backgroundBlurStrength: clamp(
			typeof effects.backgroundBlurStrength === "number"
				? effects.backgroundBlurStrength
				: DEFAULT_WEBCAM_EFFECTS.backgroundBlurStrength,
			0,
			32,
		),
		backgroundColor:
			typeof effects.backgroundColor === "string" && effects.backgroundColor.trim().length > 0
				? effects.backgroundColor
				: DEFAULT_WEBCAM_EFFECTS.backgroundColor,
		backgroundImagePath: normalizeOptionalPath(effects.backgroundImagePath),
		edgeFeather: clamp(
			typeof effects.edgeFeather === "number"
				? effects.edgeFeather
				: DEFAULT_WEBCAM_EFFECTS.edgeFeather,
			0,
			32,
		),
		portraitScale: clamp(
			typeof effects.portraitScale === "number"
				? effects.portraitScale
				: DEFAULT_WEBCAM_EFFECTS.portraitScale,
			0.85,
			1.35,
		),
		portraitOffset: {
			x: clamp(effects.portraitOffset?.x ?? DEFAULT_WEBCAM_EFFECTS.portraitOffset.x, -0.3, 0.3),
			y: clamp(effects.portraitOffset?.y ?? DEFAULT_WEBCAM_EFFECTS.portraitOffset.y, -0.3, 0.3),
		},
		shadowStyle:
			effects.shadowStyle === "none" ||
			effects.shadowStyle === "soft" ||
			effects.shadowStyle === "lifted" ||
			effects.shadowStyle === "spotlight"
				? effects.shadowStyle
				: DEFAULT_WEBCAM_EFFECTS.shadowStyle,
		shadowStrength: clamp(
			typeof effects.shadowStrength === "number"
				? effects.shadowStrength
				: DEFAULT_WEBCAM_EFFECTS.shadowStrength,
			0,
			1.5,
		),
		shadowColor:
			typeof effects.shadowColor === "string" && effects.shadowColor.trim().length > 0
				? effects.shadowColor
				: DEFAULT_WEBCAM_EFFECTS.shadowColor,
		exposure: clamp(
			typeof effects.exposure === "number" ? effects.exposure : DEFAULT_WEBCAM_EFFECTS.exposure,
			-0.6,
			0.6,
		),
		contrast: clamp(
			typeof effects.contrast === "number" ? effects.contrast : DEFAULT_WEBCAM_EFFECTS.contrast,
			0.7,
			1.6,
		),
		saturation: clamp(
			typeof effects.saturation === "number"
				? effects.saturation
				: DEFAULT_WEBCAM_EFFECTS.saturation,
			0.2,
			1.8,
		),
		warmth: clamp(
			typeof effects.warmth === "number" ? effects.warmth : DEFAULT_WEBCAM_EFFECTS.warmth,
			-1,
			1,
		),
		noiseReduction: clamp(
			typeof effects.noiseReduction === "number"
				? effects.noiseReduction
				: DEFAULT_WEBCAM_EFFECTS.noiseReduction,
			0,
			1,
		),
		faceAwareFraming:
			typeof effects.faceAwareFraming === "boolean"
				? effects.faceAwareFraming
				: DEFAULT_WEBCAM_EFFECTS.faceAwareFraming,
		subtleAvoidance:
			typeof effects.subtleAvoidance === "boolean"
				? effects.subtleAvoidance
				: DEFAULT_WEBCAM_EFFECTS.subtleAvoidance,
		sourceCrop: normalizeWebcamSourceCrop(effects.sourceCrop),
	};
}

export function buildWebcamStylePresets(): WebcamStylePresetDefinition[] {
	return [
		{
			id: "classic-circle",
			label: "Classic Circle",
			region: {
				shape: "circle",
				borderWidth: 2,
				borderRadius: 50,
				borderColor: "#ffffff",
			},
			effects: {
				presetId: "classic-circle",
				backgroundMode: "none",
				shadowStyle: "soft",
				shadowStrength: 0.55,
			},
		},
		{
			id: "presenter-soft",
			label: "Presenter Soft",
			region: {
				shape: "rectangle",
				borderWidth: 0,
				borderRadius: 24,
			},
			effects: {
				presetId: "presenter-soft",
				backgroundMode: "blur",
				backgroundBlurStrength: 18,
				edgeFeather: 14,
				portraitScale: 1.06,
				shadowStyle: "lifted",
				shadowStrength: 0.75,
			},
		},
		{
			id: "floating-card",
			label: "Floating Card",
			region: {
				shape: "rectangle",
				borderWidth: 1,
				borderRadius: 20,
				borderColor: "#e2e8f0",
			},
			effects: {
				presetId: "floating-card",
				backgroundMode: "solid",
				backgroundColor: "#0f172a",
				edgeFeather: 16,
				portraitScale: 1.08,
				shadowStyle: "lifted",
				shadowStrength: 0.85,
			},
		},
		{
			id: "spotlight",
			label: "Spotlight",
			region: {
				shape: "square",
				borderWidth: 0,
				borderRadius: 28,
			},
			effects: {
				presetId: "spotlight",
				backgroundMode: "blur",
				backgroundBlurStrength: 24,
				edgeFeather: 18,
				portraitScale: 1.14,
				shadowStyle: "spotlight",
				shadowStrength: 1,
				warmth: 0.12,
				saturation: 1.12,
			},
		},
		{
			id: "fullscreen-commentary",
			label: "Fullscreen Commentary",
			region: {
				shape: "rectangle",
				borderWidth: 0,
				borderRadius: 0,
			},
			effects: {
				presetId: "fullscreen-commentary",
				backgroundMode: "blur",
				backgroundBlurStrength: 28,
				edgeFeather: 0,
				portraitScale: 1.12,
				shadowStyle: "none",
			},
		},
	];
}

export function getWebcamStylePresetDefinition(id: WebcamEffects["presetId"]) {
	return buildWebcamStylePresets().find((preset) => preset.id === id) ?? null;
}

export function applyWebcamStylePreset(params: {
	presetId: WebcamEffects["presetId"];
	baseRegion: WebcamRegion;
	baseEffects: WebcamEffects;
}) {
	const preset = getWebcamStylePresetDefinition(params.presetId);
	if (!preset) {
		return {
			region: params.baseRegion,
			effects: params.baseEffects,
		};
	}

	return {
		region: {
			...params.baseRegion,
			...preset.region,
		},
		effects: normalizeWebcamEffects({
			...params.baseEffects,
			...preset.effects,
			presetId: params.presetId,
		}),
	};
}

export function buildWebcamCssFilter(effects: WebcamEffects) {
	const brightness = 1 + effects.exposure * 0.45;
	const contrast = effects.contrast;
	const saturation = effects.saturation;
	const blur = effects.noiseReduction * 0.7;
	const warmth = clamp(Math.abs(effects.warmth) * 0.22, 0, 0.22);
	const hueRotation = effects.warmth >= 0 ? -6 * effects.warmth : -10 * effects.warmth;

	return [
		`brightness(${brightness.toFixed(3)})`,
		`contrast(${contrast.toFixed(3)})`,
		`saturate(${saturation.toFixed(3)})`,
		`sepia(${warmth.toFixed(3)})`,
		`hue-rotate(${hueRotation.toFixed(3)}deg)`,
		blur > 0 ? `blur(${blur.toFixed(3)}px)` : null,
	]
		.filter(Boolean)
		.join(" ");
}

function resolveShadowMetrics(effects: WebcamEffects, baseDimension: number) {
	const strength = effects.shadowStrength;
	switch (effects.shadowStyle) {
		case "none":
			return { blur: 0, offsetY: 0, opacity: 0 };
		case "spotlight":
			return {
				blur: baseDimension * 0.18 * strength,
				offsetY: baseDimension * 0.04 * strength,
				opacity: 0.42 * strength,
			};
		case "lifted":
			return {
				blur: baseDimension * 0.12 * strength,
				offsetY: baseDimension * 0.05 * strength,
				opacity: 0.3 * strength,
			};
		case "soft":
		default:
			return {
				blur: baseDimension * 0.08 * strength,
				offsetY: baseDimension * 0.03 * strength,
				opacity: 0.26 * strength,
			};
	}
}

function insetRect(rect: WebcamRect, inset: number): WebcamRect {
	const maxInset = Math.min(rect.width, rect.height) / 2;
	const clampedInset = clamp(inset, 0, maxInset);
	return {
		x: rect.x + clampedInset,
		y: rect.y + clampedInset,
		width: Math.max(1, rect.width - clampedInset * 2),
		height: Math.max(1, rect.height - clampedInset * 2),
	};
}

export function resolveAppliedBackgroundMode(
	configuredBackgroundMode: WebcamEffects["backgroundMode"],
	fallbackState: WebcamEffectFallbackState,
): WebcamEffects["backgroundMode"] {
	if (
		configuredBackgroundMode === "none" ||
		fallbackState === "none" ||
		fallbackState === "reduced-segmentation-rate" ||
		fallbackState === "reduced-background-sampling"
	) {
		return configuredBackgroundMode;
	}

	if (fallbackState === "replacement-disabled") {
		return configuredBackgroundMode === "image" ? "solid" : configuredBackgroundMode;
	}

	return "none";
}

export function resolveWebcamEffectCapability(params: {
	effects: WebcamEffects;
	healthMetrics?: WebcamHealthMetrics | null;
}): ResolvedWebcamEffectCapability {
	const { effects, healthMetrics } = params;
	const fallbackState = healthMetrics?.effectFallbackState ?? "none";
	const appliedBackgroundMode = resolveAppliedBackgroundMode(effects.backgroundMode, fallbackState);
	const canApplyBackgroundTreatment =
		effects.backgroundMode !== "none" && appliedBackgroundMode !== "none";
	const canApplyEdgeFeather = canApplyBackgroundTreatment;

	switch (fallbackState) {
		case "segmentation-unavailable":
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState,
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: true,
				statusTone: "warning",
				statusTitle: "Background treatment unavailable",
				statusDescription:
					"Segmentation is unavailable right now, so preview is showing the raw webcam feed.",
			};
		case "raw-webcam-only":
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState,
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: true,
				statusTone: "warning",
				statusTitle: "Preview is using raw webcam",
				statusDescription:
					"Preview performance is too low for premium treatment, so the editor is temporarily showing the raw camera feed.",
			};
		case "replacement-disabled":
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState,
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: true,
				statusTone: "info",
				statusTitle: "Image replacement downgraded",
				statusDescription:
					"Custom background replacement is paused in preview. Blur and solid treatments can still stay active.",
			};
		case "reduced-background-sampling":
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState,
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: true,
				statusTone: "info",
				statusTitle: "Background treatment simplified",
				statusDescription:
					"Preview is still applying webcam treatment, but background sampling is reduced to keep playback smooth.",
			};
		case "reduced-segmentation-rate":
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState,
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: true,
				statusTone: "info",
				statusTitle: "Treatment is active",
				statusDescription:
					"Segmentation is updating at a reduced cadence, so preview treatment can feel slightly less responsive.",
			};
		case "none":
		default:
			return {
				configuredBackgroundMode: effects.backgroundMode,
				appliedBackgroundMode,
				fallbackState: "none",
				canApplyBackgroundTreatment,
				canApplyEdgeFeather,
				isFallbackActive: false,
				statusTone: "neutral",
				statusTitle:
					effects.backgroundMode === "none" ? "Raw webcam" : "Background treatment active",
				statusDescription:
					effects.backgroundMode === "none"
						? "The webcam is rendering without subject separation."
						: "Preview and export are using the active webcam treatment.",
			};
	}
}

function adjustCropForPortrait(
	crop: WebcamRect | null,
	effects: WebcamEffects,
	fallbackWidth: number,
	fallbackHeight: number,
): WebcamRect | null {
	const baseCrop = crop ?? {
		x: 0,
		y: 0,
		width: fallbackWidth,
		height: fallbackHeight,
	};
	const zoom = effects.portraitScale;
	if (
		Math.abs(zoom - 1) < 0.0001 &&
		Math.abs(effects.portraitOffset.x) < 0.0001 &&
		Math.abs(effects.portraitOffset.y) < 0.0001
	) {
		return baseCrop;
	}

	const nextWidth = clamp(baseCrop.width / zoom, baseCrop.width * 0.55, baseCrop.width);
	const nextHeight = clamp(baseCrop.height / zoom, baseCrop.height * 0.55, baseCrop.height);
	const maxOffsetX = (baseCrop.width - nextWidth) / 2;
	const maxOffsetY = (baseCrop.height - nextHeight) / 2;

	return {
		x: baseCrop.x + (baseCrop.width - nextWidth) / 2 + maxOffsetX * effects.portraitOffset.x,
		y: baseCrop.y + (baseCrop.height - nextHeight) / 2 + maxOffsetY * effects.portraitOffset.y,
		width: nextWidth,
		height: nextHeight,
	};
}

function scaleCropToWorkingSpace(
	crop: WebcamRect | null,
	sourceSize: { width: number; height: number } | null,
	workingWidth: number | null | undefined,
	workingHeight: number | null | undefined,
) {
	if (
		!crop ||
		!sourceSize ||
		!workingWidth ||
		!workingHeight ||
		sourceSize.width <= 0 ||
		sourceSize.height <= 0
	) {
		return crop;
	}

	return {
		x: crop.x * (workingWidth / sourceSize.width),
		y: crop.y * (workingHeight / sourceSize.height),
		width: crop.width * (workingWidth / sourceSize.width),
		height: crop.height * (workingHeight / sourceSize.height),
	};
}

function drawVideoSource(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	source: CanvasImageSource,
	crop: WebcamRect | null,
	destRect: WebcamRect,
	mirror: boolean,
) {
	const drawFrame = () => {
		if (crop) {
			ctx.drawImage(
				source,
				crop.x,
				crop.y,
				crop.width,
				crop.height,
				destRect.x,
				destRect.y,
				destRect.width,
				destRect.height,
			);
			return;
		}

		ctx.drawImage(source, destRect.x, destRect.y, destRect.width, destRect.height);
	};

	if (!mirror) {
		drawFrame();
		return;
	}

	ctx.save();
	ctx.translate(destRect.x * 2 + destRect.width, 0);
	ctx.scale(-1, 1);
	drawFrame();
	ctx.restore();
}

function getCanvasSourceSize(source: CanvasImageSource | null | undefined) {
	if (!source) {
		return null;
	}

	if (source instanceof HTMLVideoElement) {
		return { width: source.videoWidth, height: source.videoHeight };
	}

	if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
		return {
			width: source.displayWidth || source.codedWidth,
			height: source.displayHeight || source.codedHeight,
		};
	}

	if (source instanceof HTMLCanvasElement) {
		return { width: source.width, height: source.height };
	}

	if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
		return { width: source.width, height: source.height };
	}

	if (source instanceof ImageBitmap) {
		return { width: source.width, height: source.height };
	}

	if (source instanceof HTMLImageElement) {
		return {
			width: source.naturalWidth || source.width,
			height: source.naturalHeight || source.height,
		};
	}

	return null;
}

function calculateCoverCrop(sourceWidth: number, sourceHeight: number, destRect: WebcamRect) {
	if (sourceWidth <= 0 || sourceHeight <= 0 || destRect.width <= 0 || destRect.height <= 0) {
		return null;
	}

	const sourceAspect = sourceWidth / sourceHeight;
	const destAspect = destRect.width / destRect.height;

	if (Math.abs(sourceAspect - destAspect) < 0.0001) {
		return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
	}

	if (sourceAspect > destAspect) {
		const cropWidth = sourceHeight * destAspect;
		return {
			x: (sourceWidth - cropWidth) / 2,
			y: 0,
			width: cropWidth,
			height: sourceHeight,
		};
	}

	const cropHeight = sourceWidth / destAspect;
	return {
		x: 0,
		y: (sourceHeight - cropHeight) / 2,
		width: sourceWidth,
		height: cropHeight,
	};
}

function drawCoveredImage(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	source: CanvasImageSource,
	destRect: WebcamRect,
	filter = "none",
) {
	const sourceSize = getCanvasSourceSize(source);
	if (!sourceSize) {
		ctx.drawImage(source, destRect.x, destRect.y, destRect.width, destRect.height);
		return;
	}

	const crop = calculateCoverCrop(sourceSize.width, sourceSize.height, destRect);
	ctx.save();
	ctx.filter = filter;
	if (crop) {
		ctx.drawImage(
			source,
			crop.x,
			crop.y,
			crop.width,
			crop.height,
			destRect.x,
			destRect.y,
			destRect.width,
			destRect.height,
		);
	} else {
		ctx.drawImage(source, destRect.x, destRect.y, destRect.width, destRect.height);
	}
	ctx.restore();
}

function drawBackgroundAtmosphere(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	rect: WebcamRect,
	opacity: number,
) {
	if (opacity <= 0 || rect.width <= 0 || rect.height <= 0 || !("createRadialGradient" in ctx)) {
		return;
	}

	const gradient = ctx.createRadialGradient(
		rect.x + rect.width * 0.5,
		rect.y + rect.height * 0.35,
		rect.width * 0.12,
		rect.x + rect.width * 0.5,
		rect.y + rect.height * 0.45,
		Math.max(rect.width, rect.height) * 0.82,
	);
	gradient.addColorStop(0, `rgba(15, 23, 42, ${opacity * 0.18})`);
	gradient.addColorStop(0.62, `rgba(15, 23, 42, ${opacity * 0.08})`);
	gradient.addColorStop(1, `rgba(2, 6, 23, ${opacity * 0.28})`);

	ctx.save();
	ctx.fillStyle = gradient;
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}

function drawMaskLayer(
	maskCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: HTMLCanvasElement | OffscreenCanvas,
	destRect: WebcamRect,
	crop: WebcamRect | null,
	edgeFeatherPx: number,
	matteInsetPx: number,
	mirror: boolean,
) {
	const matteRect = matteInsetPx > 0 ? insetRect(destRect, matteInsetPx) : destRect;
	maskCtx.save();
	maskCtx.filter = edgeFeatherPx > 0 ? `blur(${Math.max(edgeFeatherPx, 0.35)}px)` : "none";
	drawVideoSource(maskCtx, mask, crop, matteRect, mirror);
	maskCtx.restore();
}

function drawMaskedLayer(params: {
	targetCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	source: CanvasImageSource;
	mask: HTMLCanvasElement | OffscreenCanvas;
	crop: WebcamRect | null;
	destRect: WebcamRect;
	mirror: boolean;
	filter: string;
	edgeFeatherPx: number;
	matteInsetPx: number;
	scratch: WebcamCompositionScratch;
}) {
	const {
		targetCtx,
		source,
		mask,
		crop,
		destRect,
		mirror,
		filter,
		edgeFeatherPx,
		matteInsetPx,
		scratch,
	} = params;
	const width = Math.max(1, Math.round(destRect.width));
	const height = Math.max(1, Math.round(destRect.height));
	resizeScratchCanvas(scratch.layerCanvas, scratch.layerCtx, width, height);
	resizeScratchCanvas(scratch.maskCanvas, scratch.maskCtx, width, height);

	scratch.layerCtx.filter = filter || "none";
	drawVideoSource(scratch.layerCtx, source, crop, { x: 0, y: 0, width, height }, mirror);

	drawMaskLayer(
		scratch.maskCtx,
		mask,
		{ x: 0, y: 0, width, height },
		crop,
		edgeFeatherPx,
		matteInsetPx,
		mirror,
	);

	scratch.layerCtx.globalCompositeOperation = "destination-in";
	scratch.layerCtx.drawImage(scratch.maskCanvas, 0, 0, width, height);
	scratch.layerCtx.globalCompositeOperation = "source-over";

	targetCtx.drawImage(scratch.layerCanvas, destRect.x, destRect.y, destRect.width, destRect.height);
}

export function createWebcamCompositionScratch(): WebcamCompositionScratch {
	const layerCanvas = createCanvas(1, 1);
	const layerCtx = createCanvasContext(layerCanvas);
	if (!layerCtx) {
		throw new Error("Failed to create webcam layer context");
	}

	const maskCanvas = createCanvas(1, 1);
	const maskCtx = createCanvasContext(maskCanvas);
	if (!maskCtx) {
		throw new Error("Failed to create webcam mask context");
	}

	const shadowCanvas = createCanvas(1, 1);
	const shadowCtx = createCanvasContext(shadowCanvas);
	if (!shadowCtx) {
		throw new Error("Failed to create webcam shadow context");
	}

	const backgroundCanvas = createCanvas(1, 1);
	const backgroundCtx = createCanvasContext(backgroundCanvas);
	if (!backgroundCtx) {
		throw new Error("Failed to create webcam background context");
	}

	return {
		layerCanvas,
		layerCtx,
		maskCanvas,
		maskCtx,
		shadowCanvas,
		shadowCtx,
		backgroundCanvas,
		backgroundCtx,
		backgroundCacheKey: null,
	};
}

export function resolveWebcamCompositionModel(params: {
	displayRect: WebcamRect;
	sourceCrop: WebcamRect | null;
	sourceSize?: { width: number; height: number } | null;
	effects: WebcamEffects;
	renderMode?: "preview" | "export";
	backgroundCacheKey?: string | null;
	previewFallbackState?: WebcamEffectFallbackState;
	segmentationFrame?: WebcamSegmentationFrame | null;
}): ResolvedWebcamCompositionModel {
	const {
		displayRect,
		sourceCrop,
		sourceSize,
		effects,
		renderMode = "preview",
		backgroundCacheKey = null,
		previewFallbackState = "none",
		segmentationFrame = null,
	} = params;
	const normalizedEffects = normalizeWebcamEffects(effects);
	const baseDimension = Math.min(displayRect.width, displayRect.height);
	const renderScale = clamp(baseDimension / 360, 0.85, 1.8);
	const appliedBackgroundMode = resolveAppliedBackgroundMode(
		normalizedEffects.backgroundMode,
		previewFallbackState,
	);
	const backgroundBlurPx =
		appliedBackgroundMode === "blur"
			? clamp(
					normalizedEffects.backgroundBlurStrength * (0.82 + renderScale * 0.16) +
						(renderMode === "preview" ? 3.5 : 6) * renderScale,
					(renderMode === "preview" ? 5.5 : 8) * renderScale,
					(renderMode === "preview" ? 22 : 34) * renderScale,
				)
			: 0;
	const edgeFeatherPx =
		appliedBackgroundMode === "none"
			? 0
			: clamp(
					0.45 * renderScale + normalizedEffects.edgeFeather * 0.17 * renderScale,
					0.35 * renderScale,
					6.8 * renderScale,
				);
	const matteInsetPx =
		appliedBackgroundMode === "none"
			? 0
			: clamp(
					(appliedBackgroundMode === "blur" ? 0.45 : 0.9) * renderScale +
						normalizedEffects.edgeFeather * 0.024 * renderScale,
					0.2 * renderScale,
					2.6 * renderScale,
				);
	const shadowMetrics = resolveShadowMetrics(normalizedEffects, baseDimension);
	const backgroundCrop = sourceCrop ?? null;
	const subjectCrop = adjustCropForPortrait(
		sourceCrop,
		normalizedEffects,
		sourceSize?.width ?? displayRect.width,
		sourceSize?.height ?? displayRect.height,
	);
	const matteMask =
		segmentationFrame?.refinedMask ?? segmentationFrame?.mask ?? segmentationFrame?.rawMask ?? null;
	const matteCrop = scaleCropToWorkingSpace(
		subjectCrop,
		sourceSize ?? null,
		segmentationFrame?.workingWidth,
		segmentationFrame?.workingHeight,
	);
	const usesSegmentation =
		appliedBackgroundMode !== "none" &&
		previewFallbackState !== "segmentation-unavailable" &&
		previewFallbackState !== "raw-webcam-only" &&
		Boolean(matteMask);
	const backgroundOverlayOpacity =
		appliedBackgroundMode === "image"
			? 0.18
			: appliedBackgroundMode === "solid"
				? 0.12
				: appliedBackgroundMode === "blur"
					? 0.06
					: 0;
	const subjectFilter = buildWebcamCssFilter(normalizedEffects);
	const backgroundFilter =
		appliedBackgroundMode === "image"
			? `${subjectFilter} saturate(0.920) brightness(0.960) blur(1.4px)`.trim()
			: subjectFilter;

	return {
		displayRect,
		backgroundRect: displayRect,
		subjectRect: displayRect,
		matteCrop,
		backgroundMode: appliedBackgroundMode,
		backgroundColor: mixColorWithWarmth(
			normalizedEffects.backgroundColor,
			normalizedEffects.warmth,
		),
		backgroundImagePath: normalizedEffects.backgroundImagePath,
		backgroundBlurPx,
		edgeFeatherPx,
		backgroundCrop,
		subjectCrop,
		sourceSize: sourceSize ?? null,
		cssFilter: subjectFilter,
		canvasFilter: subjectFilter,
		backgroundFilter,
		subjectFilter,
		shadowBlurPx: shadowMetrics.blur,
		shadowOffsetYPx: shadowMetrics.offsetY,
		shadowOpacity: shadowMetrics.opacity,
		shadowColor: normalizedEffects.shadowColor,
		matteMask,
		matteInsetPx,
		backgroundOverlayOpacity,
		contactShadowOpacity:
			renderMode === "preview"
				? appliedBackgroundMode === "none"
					? 0
					: Math.min(displayRect.width, displayRect.height) >= 220
						? appliedBackgroundMode === "blur"
							? 0.06
							: 0.1
						: 0
				: appliedBackgroundMode === "none"
					? 0
					: appliedBackgroundMode === "blur"
						? 0.14
						: 0.22,
		contactShadowBlurPx: clamp(baseDimension * (renderMode === "preview" ? 0.02 : 0.035), 4, 22),
		contactShadowOffsetYPx: clamp(
			baseDimension * (renderMode === "preview" ? 0.012 : 0.018),
			1,
			10,
		),
		renderMode,
		backgroundCacheKey,
		fallbackState: previewFallbackState,
		segmentationFrame,
		usesSegmentation,
	};
}

export const resolveWebcamEffectModel = resolveWebcamCompositionModel;

export function drawResolvedWebcamComposition(params: {
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	source: CanvasImageSource;
	model: ResolvedWebcamCompositionModel;
	mirror: boolean;
	backgroundImage?: CanvasImageSource | null;
	scratch: WebcamCompositionScratch;
}) {
	const { ctx, source, model, mirror, backgroundImage, scratch } = params;

	if (model.displayRect.width <= 0 || model.displayRect.height <= 0) {
		return;
	}

	if (model.backgroundMode === "none" || !model.usesSegmentation || !model.matteMask) {
		ctx.save();
		ctx.filter = model.subjectFilter || "none";
		drawVideoSource(ctx, source, model.subjectCrop, model.displayRect, mirror);
		ctx.restore();
		return;
	}

	const drawCachedBackground = (
		cacheKey: string,
		render: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void,
	) => {
		const width = Math.max(1, Math.round(model.backgroundRect.width));
		const height = Math.max(1, Math.round(model.backgroundRect.height));
		if (scratch.backgroundCacheKey !== cacheKey) {
			resizeScratchCanvas(scratch.backgroundCanvas, scratch.backgroundCtx, width, height);
			render(scratch.backgroundCtx);
			scratch.backgroundCacheKey = cacheKey;
		}
		ctx.drawImage(
			scratch.backgroundCanvas,
			model.backgroundRect.x,
			model.backgroundRect.y,
			model.backgroundRect.width,
			model.backgroundRect.height,
		);
	};

	if (model.backgroundMode === "solid") {
		ctx.fillStyle = model.backgroundColor;
		ctx.fillRect(
			model.backgroundRect.x,
			model.backgroundRect.y,
			model.backgroundRect.width,
			model.backgroundRect.height,
		);
		drawBackgroundAtmosphere(ctx, model.backgroundRect, model.backgroundOverlayOpacity);
	}

	if (model.backgroundMode === "image") {
		const cacheKey =
			model.renderMode === "preview"
				? (model.backgroundCacheKey ??
					`preview-image:${model.backgroundImagePath ?? "none"}:${model.backgroundRect.width}x${model.backgroundRect.height}`)
				: null;
		const renderImageBackground = (
			target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
		) => {
			if (backgroundImage) {
				drawCoveredImage(
					target,
					backgroundImage,
					{
						x: 0,
						y: 0,
						width: model.backgroundRect.width,
						height: model.backgroundRect.height,
					},
					model.backgroundFilter || "none",
				);
			} else {
				target.fillStyle = model.backgroundColor;
				target.fillRect(0, 0, model.backgroundRect.width, model.backgroundRect.height);
			}
			drawBackgroundAtmosphere(
				target,
				{ x: 0, y: 0, width: model.backgroundRect.width, height: model.backgroundRect.height },
				model.backgroundOverlayOpacity,
			);
		};
		if (cacheKey) {
			drawCachedBackground(cacheKey, renderImageBackground);
		} else {
			renderImageBackground(ctx);
		}
	}

	if (model.backgroundMode === "blur") {
		const cacheKey =
			model.renderMode === "preview"
				? (model.backgroundCacheKey ??
					`preview-blur:${model.backgroundBlurPx.toFixed(1)}:${model.backgroundRect.width}x${model.backgroundRect.height}`)
				: null;
		const renderBlurBackground = (
			target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
		) => {
			target.save();
			target.filter = `${model.backgroundFilter} blur(${model.backgroundBlurPx}px)`;
			drawVideoSource(
				target,
				source,
				model.backgroundCrop,
				{ x: 0, y: 0, width: model.backgroundRect.width, height: model.backgroundRect.height },
				mirror,
			);
			target.restore();
			drawBackgroundAtmosphere(
				target,
				{ x: 0, y: 0, width: model.backgroundRect.width, height: model.backgroundRect.height },
				model.backgroundOverlayOpacity,
			);
		};
		if (cacheKey) {
			drawCachedBackground(cacheKey, renderBlurBackground);
		} else {
			renderBlurBackground(ctx);
		}
	}

	if (model.contactShadowOpacity > 0) {
		const shadowWidth = Math.max(1, Math.round(model.subjectRect.width));
		const shadowHeight = Math.max(1, Math.round(model.subjectRect.height));
		resizeScratchCanvas(scratch.shadowCanvas, scratch.shadowCtx, shadowWidth, shadowHeight);
		drawMaskLayer(
			scratch.shadowCtx,
			model.matteMask,
			{ x: 0, y: 0, width: shadowWidth, height: shadowHeight },
			model.matteCrop,
			model.edgeFeatherPx + 0.75,
			model.matteInsetPx + 0.8,
			mirror,
		);
		scratch.shadowCtx.globalCompositeOperation = "source-in";
		scratch.shadowCtx.fillStyle = "rgba(0, 0, 0, 1)";
		scratch.shadowCtx.fillRect(0, 0, shadowWidth, shadowHeight);
		scratch.shadowCtx.globalCompositeOperation = "source-over";

		ctx.save();
		ctx.globalAlpha = model.contactShadowOpacity;
		ctx.filter = `blur(${model.contactShadowBlurPx}px)`;
		ctx.drawImage(
			scratch.shadowCanvas,
			model.subjectRect.x,
			model.subjectRect.y + model.contactShadowOffsetYPx,
			model.subjectRect.width,
			model.subjectRect.height,
		);
		ctx.restore();
	}

	drawMaskedLayer({
		targetCtx: ctx,
		source,
		mask: model.matteMask,
		crop: model.matteCrop,
		destRect: model.subjectRect,
		mirror,
		filter: model.subjectFilter,
		edgeFeatherPx: model.edgeFeatherPx,
		matteInsetPx: model.matteInsetPx,
		scratch,
	});
}

export function getWebcamMotionEasing(
	preset: WebcamEffects["presetId"] | WebcamStylePresetDefinition["id"] | undefined,
	fallback = DEFAULT_CAMERA_LAYOUT_MOTION_PRESET,
) {
	switch (preset ?? fallback) {
		case "fullscreen-commentary":
		case "spotlight":
			return "smooth";
		case "floating-card":
			return "focused";
		default:
			return fallback;
	}
}
