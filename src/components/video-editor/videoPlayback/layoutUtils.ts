import { Application, Graphics, Sprite } from "pixi.js";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import type { CropRegion, CursorTelemetryPoint } from "../types";

interface LayoutParams {
	container: HTMLDivElement;
	app: Application;
	videoSprite: Sprite;
	maskGraphics: Graphics;
	videoElement: HTMLVideoElement;
	cropRegion?: CropRegion;
	lockedVideoDimensions?: { width: number; height: number } | null;
	borderRadius?: number;
	padding?: number;
	aspectRatio?: AspectRatio;
}

interface LayoutResult {
	stageSize: { width: number; height: number };
	frameRect: { x: number; y: number; width: number; height: number };
	videoSize: { width: number; height: number };
	baseScale: number;
	baseOffset: { x: number; y: number };
	maskRect: { x: number; y: number; width: number; height: number };
	cropBounds: { startX: number; endX: number; startY: number; endY: number };
}

interface VideoLayoutGeometryParams {
	containerWidth: number;
	containerHeight: number;
	videoWidth: number;
	videoHeight: number;
	cropRegion?: CropRegion;
	padding?: number;
	aspectRatio?: AspectRatio;
}

export interface LegacyCaptureCorrectionParams {
	videoWidth: number;
	videoHeight: number;
	cursorTelemetry?: CursorTelemetryPoint[];
}

const FULL_CROP_REGION: CropRegion = { x: 0, y: 0, width: 1, height: 1 };
const LEGACY_CAPTURE_CORRECTION_THRESHOLD = 0.015;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalizeCropRegion(cropRegion?: CropRegion): CropRegion {
	if (!cropRegion) {
		return FULL_CROP_REGION;
	}

	const x = clamp(cropRegion.x, 0, 1);
	const y = clamp(cropRegion.y, 0, 1);
	const maxWidth = Math.max(0.0001, 1 - x);
	const maxHeight = Math.max(0.0001, 1 - y);

	return {
		x,
		y,
		width: clamp(cropRegion.width, 0.0001, maxWidth),
		height: clamp(cropRegion.height, 0.0001, maxHeight),
	};
}

function fitRectWithin(
	width: number,
	height: number,
	aspectRatio: number,
): { width: number; height: number } {
	if (!width || !height || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
		return { width: 0, height: 0 };
	}

	const viewportAspectRatio = width / height;
	if (viewportAspectRatio > aspectRatio) {
		return {
			width: height * aspectRatio,
			height,
		};
	}

	return {
		width,
		height: width / aspectRatio,
	};
}

function centerRect(
	containerWidth: number,
	containerHeight: number,
	rectWidth: number,
	rectHeight: number,
): { x: number; y: number; width: number; height: number } {
	return {
		x: (containerWidth - rectWidth) / 2,
		y: (containerHeight - rectHeight) / 2,
		width: rectWidth,
		height: rectHeight,
	};
}

export function composeCropRegions(baseCropRegion: CropRegion, cropRegion: CropRegion): CropRegion {
	const base = normalizeCropRegion(baseCropRegion);
	const crop = normalizeCropRegion(cropRegion);

	return normalizeCropRegion({
		x: base.x + crop.x * base.width,
		y: base.y + crop.y * base.height,
		width: base.width * crop.width,
		height: base.height * crop.height,
	});
}

export function invertCropRegionWithinBase(
	baseCropRegion: CropRegion,
	composedCropRegion: CropRegion,
): CropRegion {
	const base = normalizeCropRegion(baseCropRegion);
	const composed = normalizeCropRegion(composedCropRegion);
	const safeWidth = Math.max(base.width, 0.0001);
	const safeHeight = Math.max(base.height, 0.0001);

	return normalizeCropRegion({
		x: (composed.x - base.x) / safeWidth,
		y: (composed.y - base.y) / safeHeight,
		width: composed.width / safeWidth,
		height: composed.height / safeHeight,
	});
}

export function deriveLegacyCaptureCorrectionCrop(
	params: LegacyCaptureCorrectionParams,
): CropRegion {
	const { videoWidth, videoHeight, cursorTelemetry = [] } = params;
	if (!videoWidth || !videoHeight) {
		return FULL_CROP_REGION;
	}

	const telemetrySample = cursorTelemetry.find(
		(sample) =>
			(sample.captureMode === "display" || sample.captureMode === "window") &&
			sample.sourceBounds?.width &&
			sample.sourceBounds?.height,
	);

	if (!telemetrySample?.sourceBounds) {
		return FULL_CROP_REGION;
	}

	const sourceAspectRatio =
		telemetrySample.sourceBounds.width / telemetrySample.sourceBounds.height;
	const encodedAspectRatio = videoWidth / videoHeight;

	if (
		!Number.isFinite(sourceAspectRatio) ||
		sourceAspectRatio <= 0 ||
		!Number.isFinite(encodedAspectRatio) ||
		encodedAspectRatio <= 0
	) {
		return FULL_CROP_REGION;
	}

	if (Math.abs(sourceAspectRatio - encodedAspectRatio) <= LEGACY_CAPTURE_CORRECTION_THRESHOLD) {
		return FULL_CROP_REGION;
	}

	if (encodedAspectRatio > sourceAspectRatio) {
		const width = clamp(sourceAspectRatio / encodedAspectRatio, 0.0001, 1);
		return {
			x: (1 - width) / 2,
			y: 0,
			width,
			height: 1,
		};
	}

	const height = clamp(encodedAspectRatio / sourceAspectRatio, 0.0001, 1);
	return {
		x: 0,
		y: (1 - height) / 2,
		width: 1,
		height,
	};
}

export function calculateVideoLayoutGeometry(
	params: VideoLayoutGeometryParams,
): LayoutResult | null {
	const {
		containerWidth,
		containerHeight,
		videoWidth,
		videoHeight,
		cropRegion,
		padding = 0,
		aspectRatio = "native",
	} = params;

	if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
		return null;
	}

	const crop = normalizeCropRegion(cropRegion);

	const croppedVideoWidth = videoWidth * crop.width;
	const croppedVideoHeight = videoHeight * crop.height;

	if (!croppedVideoWidth || !croppedVideoHeight) {
		return null;
	}

	const cropStartX = crop.x * videoWidth;
	const cropStartY = crop.y * videoHeight;
	const cropEndX = cropStartX + croppedVideoWidth;
	const cropEndY = cropStartY + croppedVideoHeight;

	const croppedVideoAspectRatio = croppedVideoWidth / croppedVideoHeight;
	const paddingScale = 1.0 - (padding / 100) * 0.4;
	const availableWidth = containerWidth * paddingScale;
	const availableHeight = containerHeight * paddingScale;
	const targetFrameAspectRatio = getAspectRatioValue(aspectRatio, croppedVideoAspectRatio);
	const frameSize = fitRectWithin(availableWidth, availableHeight, targetFrameAspectRatio);
	const frameRect = centerRect(containerWidth, containerHeight, frameSize.width, frameSize.height);
	const contentSize = fitRectWithin(frameRect.width, frameRect.height, croppedVideoAspectRatio);
	const maskRect = centerRect(
		frameRect.width,
		frameRect.height,
		contentSize.width,
		contentSize.height,
	);
	maskRect.x += frameRect.x;
	maskRect.y += frameRect.y;

	const scale = Math.min(maskRect.width / croppedVideoWidth, maskRect.height / croppedVideoHeight);

	const fullVideoDisplayWidth = videoWidth * scale;
	const fullVideoDisplayHeight = videoHeight * scale;
	const spriteX = maskRect.x - crop.x * fullVideoDisplayWidth;
	const spriteY = maskRect.y - crop.y * fullVideoDisplayHeight;

	return {
		stageSize: { width: containerWidth, height: containerHeight },
		frameRect,
		videoSize: { width: croppedVideoWidth, height: croppedVideoHeight },
		baseScale: scale,
		baseOffset: { x: spriteX, y: spriteY },
		maskRect,
		cropBounds: { startX: cropStartX, endX: cropEndX, startY: cropStartY, endY: cropEndY },
	};
}

export function layoutVideoContent(params: LayoutParams): LayoutResult | null {
	const {
		container,
		app,
		videoSprite,
		maskGraphics,
		videoElement,
		cropRegion,
		lockedVideoDimensions,
		borderRadius = 0,
		padding = 0,
		aspectRatio = "native",
	} = params;

	const videoWidth = lockedVideoDimensions?.width || videoElement.videoWidth;
	const videoHeight = lockedVideoDimensions?.height || videoElement.videoHeight;

	if (!videoWidth || !videoHeight) {
		return null;
	}

	const width = container.clientWidth;
	const height = container.clientHeight;

	if (!width || !height) {
		return null;
	}

	app.renderer.resize(width, height);
	app.canvas.style.width = "100%";
	app.canvas.style.height = "100%";

	const result = calculateVideoLayoutGeometry({
		containerWidth: width,
		containerHeight: height,
		videoWidth,
		videoHeight,
		cropRegion,
		padding,
		aspectRatio,
	});

	if (!result) {
		return null;
	}

	videoSprite.scale.set(result.baseScale);
	videoSprite.position.set(result.baseOffset.x, result.baseOffset.y);

	// Apply border radius
	maskGraphics.clear();
	maskGraphics.roundRect(
		result.maskRect.x,
		result.maskRect.y,
		result.maskRect.width,
		result.maskRect.height,
		borderRadius,
	);
	maskGraphics.fill({ color: 0xffffff });

	return result;
}
