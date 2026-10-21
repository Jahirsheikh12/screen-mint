import { type MutableRefObject, useEffect, useMemo } from "react";
import {
	createWebcamZoomMotionState,
	type PixelRect,
	type WebcamZoomMotionState,
} from "../cameraLayouts";
import {
	type CameraLayoutRegion,
	type CursorTelemetryPoint,
	DEFAULT_WEBCAM_REGION,
	type WebcamEffects,
	type WebcamPreviewMode,
	type WebcamRegion,
	type ZoomRegion,
	type ZoomTimingSettings,
} from "../types";
import { evaluateWebcamFrame } from "../webcamFrameEvaluation";
import type { WebcamPreviewRects } from "./playbackTypes";
import type { PreviewGeometry } from "./previewGeometry";

interface UsePlaybackWebcamFrameParams {
	previewGeometry: PreviewGeometry | null;
	stageSizeRef: MutableRefObject<{ width: number; height: number }>;
	webcamMotionStateRef: MutableRefObject<WebcamZoomMotionState>;
	webcamLayoutMotionStateRef: MutableRefObject<WebcamZoomMotionState>;
	webcamRegion?: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam: boolean;
	cameraLayouts: CameraLayoutRegion[];
	zoomRegions: ZoomRegion[];
	cursorTelemetry: CursorTelemetryPoint[];
	connectZooms: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	cameraSizeDuringZoom: number;
	webcamEffects: WebcamEffects;
	webcamPreviewMode: WebcamPreviewMode;
	webcamPath?: string | null;
	currentTime: number;
	isPlaying: boolean;
	isHeld: boolean;
	isPreviewQualitySwitching: boolean;
	isPreviewRecoveryActive: boolean;
}

export function usePlaybackWebcamFrame({
	previewGeometry,
	stageSizeRef,
	webcamMotionStateRef,
	webcamLayoutMotionStateRef,
	webcamRegion,
	showWebcam,
	mirrorWebcam,
	cameraLayouts,
	zoomRegions,
	cursorTelemetry,
	connectZooms,
	zoomTiming,
	cameraSizeDuringZoom,
	webcamEffects,
	webcamPreviewMode,
	webcamPath,
	currentTime,
	isPlaying,
	isHeld,
	isPreviewQualitySwitching,
	isPreviewRecoveryActive,
}: UsePlaybackWebcamFrameParams) {
	const webcamStageX = previewGeometry?.stageRect?.x ?? 0;
	const webcamStageY = previewGeometry?.stageRect?.y ?? 0;
	const webcamStageWidth =
		previewGeometry?.stageRect?.width ?? (stageSizeRef.current?.width || 800);
	const webcamStageHeight =
		previewGeometry?.stageRect?.height ?? (stageSizeRef.current?.height || 600);
	const stageRect = useMemo<PixelRect>(
		() => ({
			x: webcamStageX,
			y: webcamStageY,
			width: webcamStageWidth,
			height: webcamStageHeight,
		}),
		[webcamStageHeight, webcamStageWidth, webcamStageX, webcamStageY],
	);
	const webcamCompositionX = previewGeometry?.frameRect?.x ?? webcamStageX;
	const webcamCompositionY = previewGeometry?.frameRect?.y ?? webcamStageY;
	const webcamCompositionWidth = previewGeometry?.frameRect?.width ?? webcamStageWidth;
	const webcamCompositionHeight = previewGeometry?.frameRect?.height ?? webcamStageHeight;
	const compositionRect = useMemo<PixelRect>(
		() => ({
			x: webcamCompositionX,
			y: webcamCompositionY,
			width: webcamCompositionWidth,
			height: webcamCompositionHeight,
		}),
		[webcamCompositionHeight, webcamCompositionWidth, webcamCompositionX, webcamCompositionY],
	);
	const webcamContentX = previewGeometry?.maskRect?.x ?? webcamCompositionX;
	const webcamContentY = previewGeometry?.maskRect?.y ?? webcamCompositionY;
	const webcamContentWidth = previewGeometry?.maskRect?.width ?? webcamCompositionWidth;
	const webcamContentHeight = previewGeometry?.maskRect?.height ?? webcamCompositionHeight;
	const contentRect = useMemo<PixelRect>(
		() => ({
			x: webcamContentX,
			y: webcamContentY,
			width: webcamContentWidth,
			height: webcamContentHeight,
		}),
		[webcamContentHeight, webcamContentWidth, webcamContentX, webcamContentY],
	);
	const rects = useMemo<WebcamPreviewRects>(
		() => ({
			stage: stageRect,
			composition: compositionRect,
			content: contentRect,
		}),
		[compositionRect, contentRect, stageRect],
	);

	const evaluation = useMemo(() => {
		if (!webcamRegion || !webcamMotionStateRef.current || !webcamLayoutMotionStateRef.current) {
			return null;
		}

		return evaluateWebcamFrame({
			state: {
				baseMotionState: webcamMotionStateRef.current,
				layoutMotionState: webcamLayoutMotionStateRef.current,
			},
			playbackTimeMs: Math.round(currentTime * 1000),
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraLayouts,
			zoomRegions,
			cursorTelemetry,
			connectZooms,
			zoomTiming,
			cameraSizeDuringZoom,
			enableCursorAvoidance: webcamEffects.subtleAvoidance,
			compositionRect,
			contentRect,
			containerWidth: stageRect.width,
			containerHeight: stageRect.height,
			effects: webcamEffects,
			renderMode: "preview",
			previewMode: webcamPreviewMode,
			sourceKey: webcamPath ?? "webcam-preview",
			shouldSmooth: isPlaying && !(isHeld || isPreviewQualitySwitching || isPreviewRecoveryActive),
		});
	}, [
		cameraLayouts,
		cameraSizeDuringZoom,
		compositionRect,
		connectZooms,
		zoomTiming,
		contentRect,
		cursorTelemetry,
		currentTime,
		isHeld,
		isPlaying,
		isPreviewQualitySwitching,
		isPreviewRecoveryActive,
		mirrorWebcam,
		showWebcam,
		stageRect,
		webcamEffects,
		webcamLayoutMotionStateRef,
		webcamMotionStateRef,
		webcamPath,
		webcamPreviewMode,
		webcamRegion,
		zoomRegions,
	]);

	useEffect(() => {
		if (!webcamRegion) {
			if (webcamMotionStateRef.current) {
				webcamMotionStateRef.current = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
			}
			if (webcamLayoutMotionStateRef.current) {
				webcamLayoutMotionStateRef.current = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
			}
			return;
		}

		if (!evaluation || !webcamMotionStateRef.current || !webcamLayoutMotionStateRef.current) {
			return;
		}

		webcamMotionStateRef.current = evaluation.baseMotionState;
		webcamLayoutMotionStateRef.current = evaluation.layoutMotionState;
	}, [evaluation, webcamLayoutMotionStateRef, webcamMotionStateRef, webcamRegion]);

	return {
		rects,
		evaluation,
		spec: evaluation?.renderSpec ?? null,
		model: evaluation?.renderSpec.renderModel ?? null,
	};
}
