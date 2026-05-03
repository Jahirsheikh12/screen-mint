import { type MutableRefObject, useEffect } from "react";
import type {
	CameraSpringSettings,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorStyle,
	CursorTelemetryPoint,
	CursorTypeMode,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "../types";
import { buildCursorSimulationPath, type CursorSimulationPath } from "./cursorSimulation";

interface UsePlaybackLatestRefsParams {
	zoomRegions: ZoomRegion[];
	zoomRegionsRef: MutableRefObject<ZoomRegion[]>;
	selectedZoomId: string | null;
	selectedZoomIdRef: MutableRefObject<string | null>;
	isPlaying: boolean;
	isPlayingRef: MutableRefObject<boolean>;
	pixiReady: boolean;
	pixiReadyRef: MutableRefObject<boolean>;
	videoReady: boolean;
	videoReadyRef: MutableRefObject<boolean>;
	cachedPreviewFrameSrc: string | null;
	cachedPreviewFrameRef: MutableRefObject<string | null>;
	trimRegions: TrimRegion[];
	trimRegionsRef: MutableRefObject<TrimRegion[]>;
	speedRegions: SpeedRegion[];
	speedRegionsRef: MutableRefObject<SpeedRegion[]>;
	zoomMotionBlur: number;
	zoomMotionBlurRef: MutableRefObject<number>;
	connectZooms: boolean;
	connectZoomsRef: MutableRefObject<boolean>;
	cursorTelemetry: CursorTelemetryPoint[];
	cursorTelemetryRef: MutableRefObject<CursorTelemetryPoint[]>;
	cursorSimulationPathRef: MutableRefObject<CursorSimulationPath | null>;
	showCursor: boolean;
	showCursorRef: MutableRefObject<boolean>;
	cursorSize: number;
	cursorSizeRef: MutableRefObject<number>;
	cursorSmoothing: number;
	cursorSmoothingRef: MutableRefObject<number>;
	cursorMotionBlur: number;
	cursorMotionBlurRef: MutableRefObject<number>;
	cursorClickBounce: number;
	cursorClickBounceRef: MutableRefObject<number>;
	cursorSway: number;
	cursorSwayRef: MutableRefObject<number>;
	cursorStyle: CursorStyle;
	cursorStyleRef: MutableRefObject<CursorStyle>;
	cursorPack: CursorPack;
	cursorPackRef: MutableRefObject<CursorPack>;
	cursorColor: string;
	cursorColorRef: MutableRefObject<string>;
	cursorOpacity: number;
	cursorOpacityRef: MutableRefObject<number>;
	clickHighlightColor: string;
	clickHighlightColorRef: MutableRefObject<string>;
	clickHighlightSize: number;
	clickHighlightSizeRef: MutableRefObject<number>;
	clickHighlightOpacity: number;
	clickHighlightOpacityRef: MutableRefObject<number>;
	cursorTrailLength: number;
	cursorTrailLengthRef: MutableRefObject<number>;
	cursorTrailOpacity: number;
	cursorTrailOpacityRef: MutableRefObject<number>;
	cursorTypeMode: CursorTypeMode;
	cursorTypeModeRef: MutableRefObject<CursorTypeMode>;
	cursorTilt: number;
	cursorTiltRef: MutableRefObject<number>;
	hideWhenIdle: boolean;
	hideWhenIdleRef: MutableRefObject<boolean>;
	idleHideDelayMs: number;
	idleHideDelayMsRef: MutableRefObject<number>;
	smoothMovementEnabled: boolean;
	smoothMovementEnabledRef: MutableRefObject<boolean>;
	cursorMovementStyle: CursorMovementStyle;
	cursorMovementStyleRef: MutableRefObject<CursorMovementStyle>;
	cursorSpring: CursorSpringSettings;
	cursorSpringRef: MutableRefObject<CursorSpringSettings>;
	highQualitySvgCursors: boolean;
	highQualitySvgCursorsRef: MutableRefObject<boolean>;
	cameraSpring: CameraSpringSettings;
	cameraSpringRef: MutableRefObject<CameraSpringSettings>;
	onPlayingStateRefreshed: () => void;
}

export function usePlaybackLatestRefs({
	zoomRegions,
	zoomRegionsRef,
	selectedZoomId,
	selectedZoomIdRef,
	isPlaying,
	isPlayingRef,
	pixiReady,
	pixiReadyRef,
	videoReady,
	videoReadyRef,
	cachedPreviewFrameSrc,
	cachedPreviewFrameRef,
	trimRegions,
	trimRegionsRef,
	speedRegions,
	speedRegionsRef,
	zoomMotionBlur,
	zoomMotionBlurRef,
	connectZooms,
	connectZoomsRef,
	cursorTelemetry,
	cursorTelemetryRef,
	cursorSimulationPathRef,
	showCursor,
	showCursorRef,
	cursorSize,
	cursorSizeRef,
	cursorSmoothing,
	cursorSmoothingRef,
	cursorMotionBlur,
	cursorMotionBlurRef,
	cursorClickBounce,
	cursorClickBounceRef,
	cursorSway,
	cursorSwayRef,
	cursorStyle,
	cursorStyleRef,
	cursorPack,
	cursorPackRef,
	cursorColor,
	cursorColorRef,
	cursorOpacity,
	cursorOpacityRef,
	clickHighlightColor,
	clickHighlightColorRef,
	clickHighlightSize,
	clickHighlightSizeRef,
	clickHighlightOpacity,
	clickHighlightOpacityRef,
	cursorTrailLength,
	cursorTrailLengthRef,
	cursorTrailOpacity,
	cursorTrailOpacityRef,
	cursorTypeMode,
	cursorTypeModeRef,
	cursorTilt,
	cursorTiltRef,
	hideWhenIdle,
	hideWhenIdleRef,
	idleHideDelayMs,
	idleHideDelayMsRef,
	smoothMovementEnabled,
	smoothMovementEnabledRef,
	cursorMovementStyle,
	cursorMovementStyleRef,
	cursorSpring,
	cursorSpringRef,
	highQualitySvgCursors,
	highQualitySvgCursorsRef,
	cameraSpring,
	cameraSpringRef,
	onPlayingStateRefreshed,
}: UsePlaybackLatestRefsParams) {
	useEffect(() => {
		zoomRegionsRef.current = zoomRegions;
	}, [zoomRegions, zoomRegionsRef]);

	useEffect(() => {
		selectedZoomIdRef.current = selectedZoomId;
	}, [selectedZoomId, selectedZoomIdRef]);

	useEffect(() => {
		isPlayingRef.current = isPlaying;
		onPlayingStateRefreshed();
	}, [isPlaying, isPlayingRef, onPlayingStateRefreshed]);

	useEffect(() => {
		pixiReadyRef.current = pixiReady;
	}, [pixiReady, pixiReadyRef]);

	useEffect(() => {
		videoReadyRef.current = videoReady;
	}, [videoReady, videoReadyRef]);

	useEffect(() => {
		cachedPreviewFrameRef.current = cachedPreviewFrameSrc;
	}, [cachedPreviewFrameRef, cachedPreviewFrameSrc]);

	useEffect(() => {
		trimRegionsRef.current = trimRegions;
	}, [trimRegions, trimRegionsRef]);

	useEffect(() => {
		speedRegionsRef.current = speedRegions;
	}, [speedRegions, speedRegionsRef]);

	useEffect(() => {
		zoomMotionBlurRef.current = zoomMotionBlur;
	}, [zoomMotionBlur, zoomMotionBlurRef]);

	useEffect(() => {
		connectZoomsRef.current = connectZooms;
	}, [connectZooms, connectZoomsRef]);

	useEffect(() => {
		cursorTelemetryRef.current = cursorTelemetry;
		cursorSimulationPathRef.current = buildCursorSimulationPath(
			cursorTelemetry,
			cursorTelemetry[cursorTelemetry.length - 1]?.timeMs ?? 0,
		);
	}, [cursorSimulationPathRef, cursorTelemetry, cursorTelemetryRef]);

	useEffect(() => {
		showCursorRef.current = showCursor;
	}, [showCursor, showCursorRef]);

	useEffect(() => {
		cursorSizeRef.current = cursorSize;
	}, [cursorSize, cursorSizeRef]);

	useEffect(() => {
		cursorSmoothingRef.current = cursorSmoothing;
	}, [cursorSmoothing, cursorSmoothingRef]);

	useEffect(() => {
		cursorMotionBlurRef.current = cursorMotionBlur;
	}, [cursorMotionBlur, cursorMotionBlurRef]);

	useEffect(() => {
		cursorClickBounceRef.current = cursorClickBounce;
	}, [cursorClickBounce, cursorClickBounceRef]);

	useEffect(() => {
		cursorSwayRef.current = cursorSway;
	}, [cursorSway, cursorSwayRef]);

	useEffect(() => {
		cursorStyleRef.current = cursorStyle;
	}, [cursorStyle, cursorStyleRef]);

	useEffect(() => {
		cursorPackRef.current = cursorPack;
	}, [cursorPack, cursorPackRef]);

	useEffect(() => {
		cursorColorRef.current = cursorColor;
	}, [cursorColor, cursorColorRef]);

	useEffect(() => {
		cursorOpacityRef.current = cursorOpacity;
	}, [cursorOpacity, cursorOpacityRef]);

	useEffect(() => {
		clickHighlightColorRef.current = clickHighlightColor;
	}, [clickHighlightColor, clickHighlightColorRef]);

	useEffect(() => {
		clickHighlightSizeRef.current = clickHighlightSize;
	}, [clickHighlightSize, clickHighlightSizeRef]);

	useEffect(() => {
		clickHighlightOpacityRef.current = clickHighlightOpacity;
	}, [clickHighlightOpacity, clickHighlightOpacityRef]);

	useEffect(() => {
		cursorTrailLengthRef.current = cursorTrailLength;
	}, [cursorTrailLength, cursorTrailLengthRef]);

	useEffect(() => {
		cursorTrailOpacityRef.current = cursorTrailOpacity;
	}, [cursorTrailOpacity, cursorTrailOpacityRef]);

	useEffect(() => {
		cursorTypeModeRef.current = cursorTypeMode;
	}, [cursorTypeMode, cursorTypeModeRef]);

	useEffect(() => {
		cursorTiltRef.current = cursorTilt;
	}, [cursorTilt, cursorTiltRef]);

	useEffect(() => {
		hideWhenIdleRef.current = hideWhenIdle;
	}, [hideWhenIdle, hideWhenIdleRef]);

	useEffect(() => {
		idleHideDelayMsRef.current = idleHideDelayMs;
	}, [idleHideDelayMs, idleHideDelayMsRef]);

	useEffect(() => {
		smoothMovementEnabledRef.current = smoothMovementEnabled;
	}, [smoothMovementEnabled, smoothMovementEnabledRef]);

	useEffect(() => {
		cursorMovementStyleRef.current = cursorMovementStyle;
	}, [cursorMovementStyle, cursorMovementStyleRef]);

	useEffect(() => {
		cursorSpringRef.current = cursorSpring;
	}, [cursorSpring, cursorSpringRef]);

	useEffect(() => {
		highQualitySvgCursorsRef.current = highQualitySvgCursors;
	}, [highQualitySvgCursors, highQualitySvgCursorsRef]);

	useEffect(() => {
		cameraSpringRef.current = cameraSpring;
	}, [cameraSpring, cameraSpringRef]);
}
