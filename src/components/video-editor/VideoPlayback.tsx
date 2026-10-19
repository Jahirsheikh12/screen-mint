import {
	Application,
	BlurFilter,
	Container,
	Graphics,
	Sprite,
	Texture,
	VideoSource,
} from "pixi.js";
import { MotionBlurFilter } from "pixi-filters/motion-blur";
import type React from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { createWebcamZoomMotionState } from "./cameraLayouts";
import { applyOpacityToHex, buildFrameShadowFilter, hasVisibleFrameShadow } from "./frameEffects";
import {
	type CursorTelemetryPoint,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CLICK_EFFECTS_ENABLED,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_STYLE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_MOVEMENT_STYLE,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_SPRING,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_CURSOR_TILT,
	DEFAULT_CURSOR_TRAIL_LENGTH,
	DEFAULT_CURSOR_TRAIL_OPACITY,
	DEFAULT_CURSOR_TYPE_MODE,
	DEFAULT_HIDE_CURSOR_WHEN_IDLE,
	DEFAULT_HIGH_QUALITY_SVG_CURSORS,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	DEFAULT_KEYBOARD_SHORTCUT_THEME,
	DEFAULT_SMOOTH_CURSOR_MOVEMENT,
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_REGION,
	type PreviewQuality,
	type SpeedRegion,
	type TrimRegion,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomRegion,
} from "./types";
import {
	createPlaybackCameraState,
	evaluatePlaybackCameraFrame,
} from "./videoPlayback/cameraEvaluator";
import { DEFAULT_FOCUS } from "./videoPlayback/constants";
import {
	DEFAULT_CURSOR_CONFIG,
	getCursorVisualState,
	PixiCursorOverlay,
	preloadCursorAssets,
} from "./videoPlayback/cursorRenderer";
import type { CursorMotionSnapshot, CursorSimulationPath } from "./videoPlayback/cursorSimulation";
import { resolveCursorV2Config } from "./videoPlayback/cursorV2";
import { getMockupDefinition } from "./videoPlayback/deviceMockups";
import { clampFocusToStage as clampFocusToStageUtil } from "./videoPlayback/focusUtils";
import { HiddenPreviewVideo } from "./videoPlayback/HiddenPreviewVideo";
import { layoutVideoContent as layoutVideoContentUtil } from "./videoPlayback/layoutUtils";
import { updateOverlayIndicator } from "./videoPlayback/overlayUtils";
import { PlaybackOverlays } from "./videoPlayback/PlaybackOverlays";
import type { VideoPlaybackProps, VideoPlaybackRef } from "./videoPlayback/playbackTypes";
import { type PreviewGeometry, rectsEqual } from "./videoPlayback/previewGeometry";
import {
	addPreviewHold,
	clearPreviewHolds,
	getActivePreviewHold,
	type PreviewHoldLease,
	type PreviewHoldReason,
	removePreviewHold,
	resolvePreviewFrameOverlaySource,
} from "./videoPlayback/previewHoldState";
import {
	commitPreviewQualitySwitch,
	createPreviewQualitySwitchState,
	getEffectivePreviewResolution,
	type PreviewQualitySwitchState,
	requestPreviewQualitySwitch,
	rollbackPreviewQualitySwitch,
} from "./videoPlayback/previewQuality";
import {
	hasRenderablePreviewFrame,
	restorePreviewFrame as restorePreviewVideoFrame,
} from "./videoPlayback/previewRecovery";
import { usePlaybackLatestRefs } from "./videoPlayback/usePlaybackLatestRefs";
import { usePlaybackWebcamFrame } from "./videoPlayback/usePlaybackWebcamFrame";
import { useResolvedWallpaper } from "./videoPlayback/useResolvedWallpaper";
import { useZoomFocusDrag } from "./videoPlayback/useZoomFocusDrag";
import { createVideoEventHandlers } from "./videoPlayback/videoEventHandlers";
import {
	applyZoomTransform,
	createMotionBlurState,
	type MotionBlurState,
} from "./videoPlayback/zoomTransform";

type PreviewClickPulse = {
	startedAtMs: number;
};

const CLICK_EFFECT_VISIBLE_MS = 600;
const PREVIEW_CLICK_PULSE_DURATION_MS = 900;

function drawPreviewClipMask(
	graphics: Graphics,
	rect: { x: number; y: number; width: number; height: number },
	borderRadius: number,
) {
	graphics.clear();

	if (rect.width <= 0 || rect.height <= 0) {
		return;
	}

	graphics.roundRect(rect.x, rect.y, rect.width, rect.height, borderRadius);
	graphics.fill({ color: 0xffffff });
}

function fitAspectRect(
	width: number,
	height: number,
	aspectRatio: number,
): { x: number; y: number; width: number; height: number } {
	if (!width || !height || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
		return { x: 0, y: 0, width, height };
	}

	const containerRatio = width / height;
	if (containerRatio > aspectRatio) {
		const rectWidth = height * aspectRatio;
		return {
			x: (width - rectWidth) / 2,
			y: 0,
			width: rectWidth,
			height,
		};
	}

	const rectHeight = width / aspectRatio;
	return {
		x: 0,
		y: (height - rectHeight) / 2,
		width,
		height: rectHeight,
	};
}

function createPreviewClickMotionSnapshot(timeMs: number): CursorMotionSnapshot {
	return {
		timeMs,
		cx: 0.5,
		cy: 0.5,
		rawCx: 0.5,
		rawCy: 0.5,
		predictedCx: 0.5,
		predictedCy: 0.5,
		velocityX: 0,
		velocityY: 0,
		heading: 0,
		speed: 0,
		cursorType: "arrow",
		latestInteractionType: "click",
		latestInteractionAgeMs: 0,
		isDragging: false,
		isDwell: false,
		isTextInput: false,
		intent: "targeting",
		confidence: "high",
		isActive: true,
		lastActiveTimeMs: timeMs,
		lastBecameActiveTimeMs: timeMs,
		lastBecameInactiveTimeMs: timeMs,
		isDiscontinuous: false,
	};
}

const VideoPlayback = forwardRef<VideoPlaybackRef, VideoPlaybackProps>(
	(
		{
			videoPath,
			onDurationChange,
			onTimeUpdate,
			currentTime,
			onPlayStateChange,
			onError,
			wallpaper,
			zoomRegions,
			selectedZoomId,
			onSelectZoom,
			onZoomFocusChange,
			isPlaying,
			frameShadowSize = 0,
			frameShadowOpacity = 0,
			frameShadowBlur = 0,
			previewQuality,
			onPreviewQualitySwitchFailed,
			backgroundBlur = 0,
			hideBackground = false,
			zoomMotionBlur = 0,
			connectZooms = true,
			zoomTiming,
			frameBorderEnabled = false,
			frameBorderWidth = 0,
			frameBorderColor = "#000000",
			frameBorderOpacity = 0.5,
			deviceMockup = "none",
			borderRadius = 0,
			padding = 0,
			cropRegion,
			trimRegions = [],
			speedRegions = [],
			aspectRatio,
			annotationRegions = [],
			selectedAnnotationId,
			onSelectAnnotation,
			onAnnotationPositionChange,
			onAnnotationSizeChange,
			cursorTelemetry = [],
			keyboardShortcutCallouts = [],
			showKeyboardShortcuts = false,
			keyboardShortcutPosition = DEFAULT_KEYBOARD_SHORTCUT_POSITION,
			keyboardShortcutTheme = DEFAULT_KEYBOARD_SHORTCUT_THEME,
			keyboardShortcutScale = DEFAULT_KEYBOARD_SHORTCUT_SCALE,
			keyboardShortcutOpacity = DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
			keyboardShortcutMaxVisible = DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
			showCursor = false,
			cursorSize = DEFAULT_CURSOR_SIZE,
			cursorSmoothing = DEFAULT_CURSOR_SMOOTHING,
			cursorMotionBlur = DEFAULT_CURSOR_MOTION_BLUR,
			cursorClickBounce = DEFAULT_CURSOR_CLICK_BOUNCE,
			cursorSway = DEFAULT_CURSOR_SWAY,
			cursorStyle = DEFAULT_CURSOR_STYLE,
			cursorPack = "classic",
			cursorColor = DEFAULT_CURSOR_COLOR,
			cursorOpacity = DEFAULT_CURSOR_OPACITY,
			clickEffectsEnabled = DEFAULT_CLICK_EFFECTS_ENABLED,
			clickHighlightColor = DEFAULT_CLICK_HIGHLIGHT_COLOR,
			clickHighlightSize = DEFAULT_CLICK_HIGHLIGHT_SIZE,
			clickHighlightOpacity = DEFAULT_CLICK_HIGHLIGHT_OPACITY,
			cursorClickStyle = DEFAULT_CURSOR_CLICK_STYLE,
			cursorTrailLength = DEFAULT_CURSOR_TRAIL_LENGTH,
			cursorTrailOpacity = DEFAULT_CURSOR_TRAIL_OPACITY,
			cursorTypeMode = DEFAULT_CURSOR_TYPE_MODE,
			cursorTilt = DEFAULT_CURSOR_TILT,
			hideWhenIdle = DEFAULT_HIDE_CURSOR_WHEN_IDLE,
			idleHideDelayMs = DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
			smoothMovementEnabled = DEFAULT_SMOOTH_CURSOR_MOVEMENT,
			cursorMovementStyle = DEFAULT_CURSOR_MOVEMENT_STYLE,
			cursorSpring = DEFAULT_CURSOR_SPRING,
			highQualitySvgCursors = DEFAULT_HIGH_QUALITY_SVG_CURSORS,
			cameraSpring = DEFAULT_CAMERA_SPRING,
			webcamPath,
			webcamRegion,
			webcamEffects = DEFAULT_WEBCAM_EFFECTS,
			webcamPreviewMode = "exact",
			showWebcam = true,
			mirrorWebcam = false,
			cameraSizeDuringZoom = 1,
			cameraLayouts = [],
			onWebcamHealthMetricsChange,
			onWebcamPositionChange,
			onWebcamSizeChange,
			webcamSelected = false,
			selectedCameraLayoutId = null,
			onSelectWebcam,
			captionRegions = [],
			captionSettings,
			isEditingCaptionPosition = false,
			onCaptionPositionOverrideChange,
		},
		ref,
	) => {
		const videoRef = useRef<HTMLVideoElement | null>(null);
		const containerRef = useRef<HTMLDivElement | null>(null);
		const appRef = useRef<Application | null>(null);
		const videoSpriteRef = useRef<Sprite | null>(null);
		const videoTextureRef = useRef<Texture | null>(null);
		const videoContainerRef = useRef<Container | null>(null);
		const cursorContainerRef = useRef<Container | null>(null);
		const cameraContainerRef = useRef<Container | null>(null);
		const deviceMockupCanvasRef = useRef<HTMLCanvasElement | null>(null);
		const timeUpdateAnimationRef = useRef<number | null>(null);
		const [pixiReady, setPixiReady] = useState(false);
		const [videoReady, setVideoReady] = useState(false);
		const [cachedPreviewFrameSrc, setCachedPreviewFrameSrc] = useState<string | null>(null);
		const [activePreviewHoldSrc, setActivePreviewHoldSrc] = useState<string | null>(null);
		const [previewRendererEpoch, setPreviewRendererEpoch] = useState(0);
		const [rendererPreviewQuality, setRendererPreviewQuality] = useState(previewQuality);
		const [previewGeometry, setPreviewGeometry] = useState<PreviewGeometry | null>(null);
		const [isPreviewQualitySwitching, setIsPreviewQualitySwitching] = useState(false);
		const [isPreviewRecoveryActive, setIsPreviewRecoveryActive] = useState(false);
		// const mockupCanvasRef = useRef<HTMLCanvasElement | null>(null);
		const overlayRef = useRef<HTMLDivElement | null>(null);
		const focusIndicatorRef = useRef<HTMLDivElement | null>(null);
		const frameBorderRef = useRef<HTMLDivElement | null>(null);
		const currentTimeRef = useRef(0);
		const zoomRegionsRef = useRef<ZoomRegion[]>([]);
		const selectedZoomIdRef = useRef<string | null>(null);
		const animationStateRef = useRef(createPlaybackCameraState());
		const webcamMotionStateRef = useRef(createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION));
		const webcamLayoutMotionStateRef = useRef(createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION));
		const blurFilterRef = useRef<BlurFilter | null>(null);
		const motionBlurFilterRef = useRef<MotionBlurFilter | null>(null);
		const isDraggingFocusRef = useRef(false);
		const stageSizeRef = useRef({ width: 0, height: 0 });
		const videoSizeRef = useRef({ width: 0, height: 0 });
		const baseScaleRef = useRef(1);
		const baseOffsetRef = useRef({ x: 0, y: 0 });
		const baseMaskRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
		const cropBoundsRef = useRef({ startX: 0, endX: 0, startY: 0, endY: 0 });
		const maskGraphicsRef = useRef<Graphics | null>(null);
		const previewClipMaskRef = useRef<Graphics | null>(null);
		const isPlayingRef = useRef(isPlaying);
		const pixiReadyRef = useRef(false);
		const videoReadyRef = useRef(false);
		const hasStablePreviewRef = useRef(false);
		const cachedPreviewFrameRef = useRef<string | null>(null);
		const isSeekingRef = useRef(false);
		const allowPlaybackRef = useRef(false);
		const isPreviewRecoveryInProgressRef = useRef(false);
		const lockedVideoDimensionsRef = useRef<{
			width: number;
			height: number;
		} | null>(null);
		const layoutVideoContentRef = useRef<(() => void) | null>(null);
		const trimRegionsRef = useRef<TrimRegion[]>([]);
		const speedRegionsRef = useRef<SpeedRegion[]>([]);
		const zoomMotionBlurRef = useRef(zoomMotionBlur);
		const connectZoomsRef = useRef(connectZooms);
		const zoomTimingRef = useRef(zoomTiming);
		zoomTimingRef.current = zoomTiming;
		const videoReadyRafRef = useRef<number | null>(null);
		const cursorOverlayRef = useRef<PixiCursorOverlay | null>(null);
		const cursorTelemetryRef = useRef<CursorTelemetryPoint[]>([]);
		const cursorSimulationPathRef = useRef<CursorSimulationPath | null>(null);
		const showCursorRef = useRef(showCursor);
		const cursorSizeRef = useRef(cursorSize);
		const cursorSmoothingRef = useRef(cursorSmoothing);
		const cursorMotionBlurRef = useRef(cursorMotionBlur);
		const cursorClickBounceRef = useRef(cursorClickBounce);
		const cursorSwayRef = useRef(cursorSway);
		const cursorStyleRef = useRef(cursorStyle);
		const cursorPackRef = useRef(cursorPack);
		const cursorColorRef = useRef(cursorColor);
		const cursorOpacityRef = useRef(cursorOpacity);
		const clickEffectsEnabledRef = useRef(clickEffectsEnabled);
		const clickHighlightColorRef = useRef(clickHighlightColor);
		const clickHighlightSizeRef = useRef(clickHighlightSize);
		const clickHighlightOpacityRef = useRef(clickHighlightOpacity);
		const cursorClickStyleRef = useRef(cursorClickStyle);
		cursorClickStyleRef.current = cursorClickStyle;
		const previewClickPulseRef = useRef<PreviewClickPulse | null>(null);
		const previousClickEffectsRef = useRef({
			cursorClickBounce,
			clickEffectsEnabled,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorClickStyle,
		});
		const cursorTrailLengthRef = useRef(cursorTrailLength);
		const cursorTrailOpacityRef = useRef(cursorTrailOpacity);
		const cursorTypeModeRef = useRef(cursorTypeMode);
		const cursorTiltRef = useRef(cursorTilt);
		const hideWhenIdleRef = useRef(hideWhenIdle);
		const idleHideDelayMsRef = useRef(idleHideDelayMs);
		const smoothMovementEnabledRef = useRef(smoothMovementEnabled);
		const cursorMovementStyleRef = useRef(cursorMovementStyle);
		const cursorSpringRef = useRef(cursorSpring);
		const highQualitySvgCursorsRef = useRef(highQualitySvgCursors);
		const cameraSpringRef = useRef(cameraSpring);
		const motionBlurStateRef = useRef<MotionBlurState>(createMotionBlurState());
		const previewQualitySwitchStateRef = useRef<PreviewQualitySwitchState>(
			createPreviewQualitySwitchState(previewQuality),
		);
		const pendingPreviewQualitySwitchRef = useRef<{
			token: number;
			targetQuality: PreviewQuality;
			fallbackQuality: PreviewQuality;
			restoreTime: number;
			wasPlaying: boolean;
		} | null>(null);
		const previewRecoveryPromiseRef = useRef<Promise<void> | null>(null);
		const previewHoldTokenRef = useRef(0);
		const previewHoldsRef = useRef<Map<string, PreviewHoldLease>>(clearPreviewHolds());
		const previewRendererEpochRef = useRef(0);
		const previewRendererResetPromiseRef = useRef<Promise<void> | null>(null);
		const previewQualitySwitchTokenRef = useRef(0);
		const desiredPreviewQualityRef = useRef(previewQuality);
		const previewResolution = useMemo(
			() =>
				getEffectivePreviewResolution(window.devicePixelRatio || 1, rendererPreviewQuality, {
					width: window.innerWidth,
					height: window.innerHeight,
				}),
			[rendererPreviewQuality],
		);
		useEffect(() => {
			desiredPreviewQualityRef.current = previewQuality;
		}, [previewQuality]);
		const { rects: webcamPreviewRects, model: resolvedWebcamModel } = usePlaybackWebcamFrame({
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
			isHeld: activePreviewHoldSrc !== null,
			isPreviewQualitySwitching,
			isPreviewRecoveryActive,
		});

		const clampFocusToStage = useCallback((focus: ZoomFocus, depth: ZoomDepth) => {
			return clampFocusToStageUtil(focus, depth, stageSizeRef.current);
		}, []);

		const updateOverlayForRegion = useCallback(
			(region: ZoomRegion | null, focusOverride?: ZoomFocus) => {
				const overlayEl = overlayRef.current;
				const indicatorEl = focusIndicatorRef.current;

				if (!overlayEl || !indicatorEl) {
					return;
				}

				// Update stage size from overlay dimensions
				const stageWidth = overlayEl.clientWidth;
				const stageHeight = overlayEl.clientHeight;
				if (stageWidth && stageHeight) {
					stageSizeRef.current = { width: stageWidth, height: stageHeight };
				}

				updateOverlayIndicator({
					overlayEl,
					indicatorEl,
					region,
					focusOverride,
					baseMask: baseMaskRef.current,
					isPlaying: isPlayingRef.current,
				});
			},
			[],
		);

		const updateFrameBorderOverlay = useCallback(() => {
			const frameBorderEl = frameBorderRef.current;
			const maskRect = baseMaskRef.current;

			if (!frameBorderEl) {
				return;
			}

			const shouldShowBorder =
				frameBorderEnabled &&
				frameBorderWidth > 0 &&
				frameBorderOpacity > 0 &&
				maskRect.width > 0 &&
				maskRect.height > 0;

			if (!shouldShowBorder) {
				frameBorderEl.style.display = "none";
				return;
			}

			frameBorderEl.style.display = "block";
			frameBorderEl.style.left = `${maskRect.x}px`;
			frameBorderEl.style.top = `${maskRect.y}px`;
			frameBorderEl.style.width = `${maskRect.width}px`;
			frameBorderEl.style.height = `${maskRect.height}px`;
			frameBorderEl.style.borderRadius = `${borderRadius}px`;
			frameBorderEl.style.boxShadow = `0 0 0 ${frameBorderWidth}px ${applyOpacityToHex(frameBorderColor, frameBorderOpacity)}`;
		}, [borderRadius, frameBorderColor, frameBorderEnabled, frameBorderOpacity, frameBorderWidth]);

		const updateDeviceMockupOverlay = useCallback(() => {
			const canvas = deviceMockupCanvasRef.current;
			const container = containerRef.current;
			if (!canvas || !container || deviceMockup === "none" || !previewGeometry) {
				if (canvas) {
					canvas.style.display = "none";
				}
				return;
			}

			const definition = getMockupDefinition(deviceMockup);
			if (!definition) {
				canvas.style.display = "none";
				return;
			}

			const width = container.clientWidth;
			const height = container.clientHeight;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.max(1, Math.round(width * dpr));
			canvas.height = Math.max(1, Math.round(height * dpr));
			canvas.style.display = "block";
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);

			const frame = previewGeometry.maskRect;
			const inset = definition.inset;
			const deviceW = frame.width / Math.max(0.01, 1 - inset.left - inset.right);
			const deviceH = frame.height / Math.max(0.01, 1 - inset.top - inset.bottom);
			const deviceX = frame.x - deviceW * inset.left;
			const deviceY = frame.y - deviceH * inset.top;
			ctx.save();
			ctx.translate(deviceX, deviceY);
			definition.drawFrame(ctx, deviceW, deviceH, {
				x: frame.x - deviceX,
				y: frame.y - deviceY,
				w: frame.width,
				h: frame.height,
			});
			ctx.restore();
		}, [deviceMockup, previewGeometry]);

		const layoutVideoContent = useCallback(() => {
			const container = containerRef.current;
			const app = appRef.current;
			const videoSprite = videoSpriteRef.current;
			const maskGraphics = maskGraphicsRef.current;
			const videoElement = videoRef.current;
			const cameraContainer = cameraContainerRef.current;
			const previewClipMask = previewClipMaskRef.current;

			if (
				!container ||
				!app ||
				!videoSprite ||
				!maskGraphics ||
				!videoElement ||
				!cameraContainer ||
				!previewClipMask
			) {
				return;
			}

			// Lock video dimensions on first layout to prevent resize issues
			if (
				!lockedVideoDimensionsRef.current &&
				videoElement.videoWidth > 0 &&
				videoElement.videoHeight > 0
			) {
				lockedVideoDimensionsRef.current = {
					width: videoElement.videoWidth,
					height: videoElement.videoHeight,
				};
			}

			const result = layoutVideoContentUtil({
				container,
				app,
				videoSprite,
				maskGraphics,
				videoElement,
				cropRegion,
				lockedVideoDimensions: lockedVideoDimensionsRef.current,
				borderRadius,
				padding,
				aspectRatio,
			});

			if (result) {
				stageSizeRef.current = result.stageSize;
				videoSizeRef.current = result.videoSize;
				baseScaleRef.current = result.baseScale;
				baseOffsetRef.current = result.baseOffset;
				baseMaskRef.current = result.maskRect;
				cropBoundsRef.current = result.cropBounds;
				drawPreviewClipMask(previewClipMask, result.maskRect, borderRadius);
				setPreviewGeometry((current) => {
					const nextGeometry: PreviewGeometry = {
						stageRect: {
							x: 0,
							y: 0,
							width: result.stageSize.width,
							height: result.stageSize.height,
						},
						frameRect: result.frameRect,
						maskRect: result.maskRect,
					};

					if (
						current &&
						rectsEqual(current.stageRect, nextGeometry.stageRect) &&
						rectsEqual(current.frameRect, nextGeometry.frameRect) &&
						rectsEqual(current.maskRect, nextGeometry.maskRect)
					) {
						return current;
					}

					return nextGeometry;
				});
				updateFrameBorderOverlay();
				updateDeviceMockupOverlay();

				// Reset camera container to identity
				cameraContainer.scale.set(1);
				cameraContainer.position.set(0, 0);

				const selectedId = selectedZoomIdRef.current;
				const activeRegion = selectedId
					? (zoomRegionsRef.current.find((region) => region.id === selectedId) ?? null)
					: null;

				updateOverlayForRegion(activeRegion);
			}
		}, [
			updateFrameBorderOverlay,
			updateDeviceMockupOverlay,
			updateOverlayForRegion,
			cropRegion,
			borderRadius,
			padding,
			aspectRatio,
		]);

		useEffect(() => {
			layoutVideoContentRef.current = layoutVideoContent;
		}, [layoutVideoContent]);

		useEffect(() => {
			updateFrameBorderOverlay();
		}, [updateFrameBorderOverlay]);

		useEffect(() => {
			updateDeviceMockupOverlay();
		}, [updateDeviceMockupOverlay]);

		const selectedZoom = useMemo(() => {
			if (!selectedZoomId) return null;
			return zoomRegions.find((region) => region.id === selectedZoomId) ?? null;
		}, [zoomRegions, selectedZoomId]);

		const seekVideoToTime = useCallback((video: HTMLVideoElement, time: number) => {
			if (Number.isNaN(time) || Math.abs(video.currentTime - time) < 0.0001) {
				return Promise.resolve();
			}

			return new Promise<void>((resolve) => {
				const handleSeeked = () => {
					video.removeEventListener("seeked", handleSeeked);
					resolve();
				};

				video.addEventListener("seeked", handleSeeked, { once: true });
				video.currentTime = time;
			});
		}, []);

		const refreshVideoFrame = useCallback(async () => {
			const video = videoRef.current;
			if (!video || Number.isNaN(video.currentTime)) {
				return;
			}

			const restoreTime = video.currentTime;
			const duration = Number.isFinite(video.duration) ? video.duration : 0;
			const epsilon = duration > 0 ? Math.min(1 / 120, duration / 1000 || 1 / 120) : 1 / 120;
			const nudgeTarget =
				restoreTime > epsilon
					? restoreTime - epsilon
					: Math.min(duration || restoreTime + epsilon, restoreTime + epsilon);

			if (Math.abs(nudgeTarget - restoreTime) < 0.000001) {
				return;
			}

			await new Promise<void>((resolve) => {
				const handleFirstSeeked = () => {
					video.removeEventListener("seeked", handleFirstSeeked);
					const handleSecondSeeked = () => {
						video.removeEventListener("seeked", handleSecondSeeked);
						video.pause();
						resolve();
					};

					video.addEventListener("seeked", handleSecondSeeked, {
						once: true,
					});
					video.currentTime = restoreTime;
				};

				video.addEventListener("seeked", handleFirstSeeked, { once: true });
				video.currentTime = nudgeTarget;
			});
		}, []);

		const waitForPreviewLayerBinding = useCallback(
			async (timeoutMs = 1_500, previousSprite: Sprite | null = null) => {
				const deadline = performance.now() + timeoutMs;

				await new Promise<void>((resolve, reject) => {
					const waitForBinding = () => {
						if (
							videoSpriteRef.current &&
							(previousSprite == null || videoSpriteRef.current !== previousSprite) &&
							(videoTextureRef.current ?? videoSpriteRef.current.texture)
						) {
							resolve();
							return;
						}

						if (performance.now() >= deadline) {
							reject(new Error("Preview recovery timed out while waiting for the preview layer."));
							return;
						}

						requestAnimationFrame(waitForBinding);
					};

					waitForBinding();
				});
			},
			[],
		);

		const syncPreviewVideoTexture = useCallback(async () => {
			const video = videoRef.current;
			const app = appRef.current;
			if (!video || !app || !hasRenderablePreviewFrame(video)) {
				return;
			}

			if (!videoReady) {
				setVideoReady(true);
				await waitForPreviewLayerBinding().catch((error) => {
					console.warn("Preview layer did not rebind immediately after recovery:", error);
				});
			}

			const sprite = videoSpriteRef.current;
			const texture = videoTextureRef.current ?? sprite?.texture ?? null;
			if (!sprite || !texture) {
				return;
			}

			videoTextureRef.current = texture;
			const source = texture.source as {
				autoUpdate?: boolean;
				update?: () => void;
				updateFrame?: () => void;
			};

			if ("autoUpdate" in source) {
				source.autoUpdate = true;
			}
			if (typeof source.updateFrame === "function") {
				source.updateFrame();
			} else {
				source.update?.();
			}
			texture.update();
			layoutVideoContentRef.current?.();
			app.render();
		}, [videoReady, waitForPreviewLayerBinding]);

		const capturePreviewFrameSnapshot = useCallback(async () => {
			const app = appRef.current;
			if (!app || !pixiReadyRef.current || !videoReadyRef.current) {
				return cachedPreviewFrameRef.current;
			}

			try {
				await syncPreviewVideoTexture();
				app.render();
				const frameSrc = app.canvas.toDataURL("image/png");
				cachedPreviewFrameRef.current = frameSrc;
				setCachedPreviewFrameSrc(frameSrc);
				return frameSrc;
			} catch (error) {
				console.warn("Failed to capture the current preview frame:", error);
				return cachedPreviewFrameRef.current;
			}
		}, [syncPreviewVideoTexture]);

		const syncActivePreviewHoldState = useCallback(() => {
			const activeHold = getActivePreviewHold(previewHoldsRef.current);
			setActivePreviewHoldSrc(activeHold?.frameSrc ?? null);
		}, []);

		const waitForPreviewRendererReset = useCallback(
			async (previousApp: Application | null, previousSprite: Sprite | null, timeoutMs = 3_000) => {
				const deadline = performance.now() + timeoutMs;

				await new Promise<void>((resolve, reject) => {
					const waitForReset = () => {
						const hasNewApp =
							appRef.current != null &&
							appRef.current !== previousApp &&
							pixiReadyRef.current === true;
						const hasNewSprite =
							videoReadyRef.current === false ||
							(videoSpriteRef.current != null && videoSpriteRef.current !== previousSprite);

						if (hasNewApp && hasNewSprite) {
							resolve();
							return;
						}

						if (performance.now() >= deadline) {
							reject(
								new Error("Preview recovery timed out while waiting for the preview renderer."),
							);
							return;
						}

						requestAnimationFrame(waitForReset);
					};

					waitForReset();
				});
			},
			[],
		);

		const recreatePreviewRenderer = useCallback(async () => {
			if (previewRendererResetPromiseRef.current) {
				return previewRendererResetPromiseRef.current;
			}

			const resetPromise = (async () => {
				const video = videoRef.current;
				if (!video || !hasRenderablePreviewFrame(video)) {
					return;
				}

				const previousApp = appRef.current;
				const previousSprite = videoSpriteRef.current;
				setPixiReady(false);
				previewRendererEpochRef.current += 1;
				setPreviewRendererEpoch(previewRendererEpochRef.current);
				await waitForPreviewRendererReset(previousApp, previousSprite).catch((error) => {
					console.warn("Preview renderer did not reset immediately:", error);
				});
				await syncPreviewVideoTexture();
			})().finally(() => {
				previewRendererResetPromiseRef.current = null;
			});

			previewRendererResetPromiseRef.current = resetPromise;
			return resetPromise;
		}, [syncPreviewVideoTexture, waitForPreviewRendererReset]);

		const acquirePreviewHold = useCallback(
			async (reason: PreviewHoldReason) => {
				const frameSrc = await capturePreviewFrameSnapshot();
				const token = `preview-hold-${++previewHoldTokenRef.current}`;

				if (frameSrc) {
					previewHoldsRef.current = addPreviewHold(previewHoldsRef.current, {
						token,
						reason,
						frameSrc,
					});
					syncActivePreviewHoldState();
				}

				return token;
			},
			[capturePreviewFrameSnapshot, syncActivePreviewHoldState],
		);

		const releasePreviewHold = useCallback(
			(token: string) => {
				previewHoldsRef.current = removePreviewHold(previewHoldsRef.current, token);
				syncActivePreviewHoldState();
			},
			[syncActivePreviewHoldState],
		);

		const prepareVideoTextureReload = useCallback(() => {
			if (videoReadyRafRef.current) {
				cancelAnimationFrame(videoReadyRafRef.current);
				videoReadyRafRef.current = null;
			}
		}, []);

		const restorePreviewFrame = useCallback(
			async (options: { forceReload?: boolean; resumePlayback?: boolean } = {}) => {
				if (previewRecoveryPromiseRef.current) {
					return previewRecoveryPromiseRef.current;
				}

				const video = videoRef.current;
				if (!video) {
					return;
				}

				const recoveryPromise = (async () => {
					const resumePlayback =
						options.resumePlayback ?? (isPlayingRef.current && allowPlaybackRef.current);

					allowPlaybackRef.current = false;
					isPreviewRecoveryInProgressRef.current = true;
					setIsPreviewRecoveryActive(true);

					await restorePreviewVideoFrame(video, {
						fallbackTime: currentTimeRef.current / 1000,
						forceReload: options.forceReload,
						resumePlayback,
						prepareForReload: prepareVideoTextureReload,
						redrawFrame: refreshVideoFrame,
						syncPreviewLayer: recreatePreviewRenderer,
					});

					if (resumePlayback) {
						allowPlaybackRef.current = true;
					}
				})()
					.catch(async (error) => {
						console.warn("Preview recovery did not complete:", error);

						if (!videoPath) {
							return;
						}

						try {
							const availability = await window.electronAPI.checkFileAvailable(videoPath);
							if (availability.success && availability.exists === false) {
								onError(
									`Failed to load video because the source is no longer available: ${videoPath}`,
								);
							}
						} catch (availabilityError) {
							console.warn(
								"Failed to confirm whether the preview source is still available:",
								availabilityError,
							);
						}
					})
					.finally(() => {
						isPreviewRecoveryInProgressRef.current = false;
						previewRecoveryPromiseRef.current = null;
						setIsPreviewRecoveryActive(false);
					});

				previewRecoveryPromiseRef.current = recoveryPromise;
				return recoveryPromise;
			},
			[onError, prepareVideoTextureReload, recreatePreviewRenderer, refreshVideoFrame, videoPath],
		);

		const beginPreviewQualitySwitch = useCallback((targetQuality: PreviewQuality) => {
			const coordinator = previewQualitySwitchStateRef.current;
			const video = videoRef.current;
			const restoreTime = video?.currentTime ?? currentTimeRef.current / 1000;
			const wasPlaying = Boolean(video && !video.paused && !video.ended);

			pendingPreviewQualitySwitchRef.current = {
				token: ++previewQualitySwitchTokenRef.current,
				targetQuality,
				fallbackQuality: coordinator.lastStableQuality,
				restoreTime,
				wasPlaying,
			};

			allowPlaybackRef.current = false;
			setIsPreviewQualitySwitching(true);
			if (video && !video.paused) {
				video.pause();
			}

			setRendererPreviewQuality(targetQuality);
		}, []);

		const handlePreviewQualitySwitchFailure = useCallback(
			(error: unknown, expectedQuality: PreviewQuality) => {
				const pendingSwitch = pendingPreviewQualitySwitchRef.current;
				if (!pendingSwitch || pendingSwitch.targetQuality !== expectedQuality) {
					onError(error instanceof Error ? error.message : "Failed to initialize preview renderer");
					return;
				}

				const coordinator = previewQualitySwitchStateRef.current;
				const hadQueuedQuality = coordinator.queuedQuality !== null;
				const { state, fallbackQuality, startQuality } = rollbackPreviewQualitySwitch(coordinator);
				previewQualitySwitchStateRef.current = state;
				pendingPreviewQualitySwitchRef.current = null;
				beginPreviewQualitySwitch(startQuality);

				if (!hadQueuedQuality && desiredPreviewQualityRef.current === expectedQuality) {
					onPreviewQualitySwitchFailed?.(fallbackQuality);
				}
			},
			[beginPreviewQualitySwitch, onError, onPreviewQualitySwitchFailed],
		);

		useImperativeHandle(ref, () => ({
			video: videoRef.current,
			app: appRef.current,
			videoSprite: videoSpriteRef.current,
			videoContainer: videoContainerRef.current,
			containerRef,
			play: async () => {
				const vid = videoRef.current;
				if (!vid) return;
				try {
					allowPlaybackRef.current = true;
					// If video has ended, seek to beginning and wait for seek to complete
					// before calling play, to avoid the isSeekingRef guard in handlePlay
					if (vid.ended) {
						vid.currentTime = 0;
						await new Promise<void>((resolve) => {
							const onSeeked = () => {
								vid.removeEventListener("seeked", onSeeked);
								resolve();
							};
							vid.addEventListener("seeked", onSeeked);
						});
					}
					await vid.play();
				} catch (error) {
					allowPlaybackRef.current = false;
					throw error;
				}
			},
			pause: () => {
				const video = videoRef.current;
				allowPlaybackRef.current = false;
				if (!video) {
					return;
				}
				video.pause();
			},
			refreshFrame: async () => {
				await refreshVideoFrame();
			},
			restorePreviewFrame,
			acquirePreviewHold,
			releasePreviewHold,
		}));

		useEffect(() => {
			const { state, startQuality } = requestPreviewQualitySwitch(
				previewQualitySwitchStateRef.current,
				previewQuality,
			);
			previewQualitySwitchStateRef.current = state;

			if (startQuality) {
				beginPreviewQualitySwitch(startQuality);
			}
		}, [beginPreviewQualitySwitch, previewQuality]);

		useEffect(() => {
			const pendingSwitch = pendingPreviewQualitySwitchRef.current;
			if (!pendingSwitch || !pixiReady || !videoReady) {
				return;
			}

			if (pendingSwitch.targetQuality !== rendererPreviewQuality) {
				return;
			}

			let cancelled = false;
			const switchToken = pendingSwitch.token;

			void (async () => {
				try {
					const video = videoRef.current;
					if (!video) {
						throw new Error("Preview video is unavailable.");
					}

					await seekVideoToTime(video, pendingSwitch.restoreTime);
					await refreshVideoFrame();

					if (cancelled || pendingPreviewQualitySwitchRef.current?.token !== switchToken) {
						return;
					}

					const { state, startQuality } = commitPreviewQualitySwitch(
						previewQualitySwitchStateRef.current,
					);
					previewQualitySwitchStateRef.current = state;
					pendingPreviewQualitySwitchRef.current = null;
					setIsPreviewQualitySwitching(false);

					if (!startQuality && pendingSwitch.wasPlaying) {
						allowPlaybackRef.current = true;
						void video.play().catch(() => {
							allowPlaybackRef.current = false;
						});
					}

					if (startQuality) {
						beginPreviewQualitySwitch(startQuality);
					}
				} catch (error) {
					if (!cancelled && pendingPreviewQualitySwitchRef.current?.token === switchToken) {
						setIsPreviewQualitySwitching(false);
						handlePreviewQualitySwitchFailure(error, pendingSwitch.targetQuality);
					}
				}
			})();

			return () => {
				cancelled = true;
			};
		}, [
			beginPreviewQualitySwitch,
			handlePreviewQualitySwitchFailure,
			pixiReady,
			refreshVideoFrame,
			rendererPreviewQuality,
			seekVideoToTime,
			videoReady,
		]);

		const {
			handleOverlayPointerDown,
			handleOverlayPointerMove,
			handleOverlayPointerUp,
			handleOverlayPointerLeave,
		} = useZoomFocusDrag({
			overlayRef,
			isPlayingRef,
			isDraggingFocusRef,
			selectedZoomIdRef,
			zoomRegionsRef,
			stageSizeRef,
			baseMaskRef,
			clampFocusToStage,
			onSelectZoom,
			onZoomFocusChange,
			updateOverlayForRegion,
		});

		const refreshOverlayForPlayingState = useCallback(() => {
			if (pixiReady && videoReady) {
				updateOverlayForRegion(selectedZoom);
			}
		}, [pixiReady, selectedZoom, updateOverlayForRegion, videoReady]);

		usePlaybackLatestRefs({
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
			clickEffectsEnabled,
			clickEffectsEnabledRef,
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
			onPlayingStateRefreshed: refreshOverlayForPlayingState,
		});

		const hasRecordedClickNear = useCallback((timeMs: number) => {
			return getCursorVisualState(cursorTelemetryRef.current, timeMs).clickProgress > 0;
		}, []);

		const getPreviewClickSample = useCallback(
			(playbackTimeMs: number, frameTimeMs: number) => {
				const pulse = previewClickPulseRef.current;
				if (!pulse) {
					return null;
				}

				const elapsedMs = frameTimeMs - pulse.startedAtMs;
				if (elapsedMs > PREVIEW_CLICK_PULSE_DURATION_MS) {
					previewClickPulseRef.current = null;
					return null;
				}

				if (hasRecordedClickNear(playbackTimeMs)) {
					return null;
				}

				const visualAgeMs = elapsedMs % CLICK_EFFECT_VISIBLE_MS;
				return {
					timeMs: playbackTimeMs - visualAgeMs,
					interactionType: "click" as const,
				};
			},
			[hasRecordedClickNear],
		);

		useEffect(() => {
			const previous = previousClickEffectsRef.current;
			const changed =
				previous.cursorClickBounce !== cursorClickBounce ||
				previous.clickEffectsEnabled !== clickEffectsEnabled ||
				previous.clickHighlightColor !== clickHighlightColor ||
				previous.clickHighlightSize !== clickHighlightSize ||
				previous.clickHighlightOpacity !== clickHighlightOpacity ||
				previous.cursorClickStyle !== cursorClickStyle;

			previousClickEffectsRef.current = {
				cursorClickBounce,
				clickEffectsEnabled,
				clickHighlightColor,
				clickHighlightSize,
				clickHighlightOpacity,
				cursorClickStyle,
			};

			if (
				!changed ||
				!showCursor ||
				!clickEffectsEnabled ||
				clickHighlightSize <= 0 ||
				clickHighlightOpacity <= 0 ||
				!cursorOverlayRef.current
			) {
				return;
			}

			const playbackTimeMs = currentTimeRef.current || currentTime * 1000;
			if (hasRecordedClickNear(playbackTimeMs)) {
				return;
			}

			previewClickPulseRef.current = {
				startedAtMs: performance.now(),
			};
		}, [
			cursorClickBounce,
			clickEffectsEnabled,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorClickStyle,
			showCursor,
			currentTime,
			hasRecordedClickNear,
		]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;

			const app = appRef.current;
			const cameraContainer = cameraContainerRef.current;
			const video = videoRef.current;

			if (!app || !cameraContainer || !video) return;

			const tickerWasStarted = app.ticker?.started || false;
			if (tickerWasStarted && app.ticker) {
				app.ticker.stop();
			}

			const wasPlaying = !video.paused;
			if (wasPlaying) {
				video.pause();
			}

			animationStateRef.current = createPlaybackCameraState();

			// Reset cursor overlay smoothing on layout change
			cursorOverlayRef.current?.reset();

			// Reset motion blur state for clean transitions
			motionBlurStateRef.current = createMotionBlurState();

			if (blurFilterRef.current) {
				blurFilterRef.current.blur = 0;
			}

			requestAnimationFrame(() => {
				const container = cameraContainerRef.current;
				const videoStage = videoContainerRef.current;
				const sprite = videoSpriteRef.current;
				const currentApp = appRef.current;
				if (!container || !videoStage || !sprite || !currentApp) {
					return;
				}

				container.scale.set(1);
				container.position.set(0, 0);
				videoStage.scale.set(1);
				videoStage.position.set(0, 0);
				sprite.scale.set(1);
				sprite.position.set(0, 0);

				layoutVideoContent();

				applyZoomTransform({
					cameraContainer: container,
					blurFilter: blurFilterRef.current,
					stageSize: stageSizeRef.current,
					baseMask: baseMaskRef.current,
					zoomScale: 1,
					focusX: DEFAULT_FOCUS.cx,
					focusY: DEFAULT_FOCUS.cy,
					motionIntensity: 0,
					isPlaying: false,
					motionBlurAmount: zoomMotionBlurRef.current,
				});

				requestAnimationFrame(() => {
					const finalApp = appRef.current;
					if (wasPlaying && video) {
						video.play().catch(() => {
							// Playback can be blocked transiently while the preview resets.
						});
					}
					if (tickerWasStarted && finalApp?.ticker) {
						finalApp.ticker.start();
					}
				});
			});
		}, [pixiReady, videoReady, layoutVideoContent]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;
			const container = containerRef.current;
			if (!container) return;

			if (typeof ResizeObserver === "undefined") {
				return;
			}

			const observer = new ResizeObserver(() => {
				layoutVideoContent();
			});

			observer.observe(container);
			return () => {
				observer.disconnect();
			};
		}, [pixiReady, videoReady, layoutVideoContent]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;
			updateOverlayForRegion(selectedZoom);
		}, [selectedZoom, pixiReady, videoReady, updateOverlayForRegion]);

		useEffect(() => {
			const overlayEl = overlayRef.current;
			if (!overlayEl) return;
			if (!selectedZoom) {
				overlayEl.style.cursor = "default";
				overlayEl.style.pointerEvents = "none";
				return;
			}
			overlayEl.style.cursor = isPlaying ? "not-allowed" : "grab";
			overlayEl.style.pointerEvents = isPlaying ? "none" : "auto";
		}, [selectedZoom, isPlaying]);

		useEffect(() => {
			const container = containerRef.current;
			if (!container) return;
			void previewRendererEpoch;

			let mounted = true;
			let app: Application | null = null;

			(async () => {
				let cursorOverlayEnabled = true;
				try {
					await preloadCursorAssets();
				} catch (error) {
					cursorOverlayEnabled = false;
					console.warn(
						"Native cursor assets are unavailable in preview; continuing without cursor overlay.",
						error,
					);
				}

				app = new Application();

				await app.init({
					width: container.clientWidth,
					height: container.clientHeight,
					backgroundAlpha: 0,
					antialias: true,
					resolution: previewResolution,
					autoDensity: true,
				});

				app.ticker.maxFPS = 60;

				if (!mounted) {
					app.destroy(true, {
						children: true,
						texture: false,
						textureSource: false,
					});
					return;
				}

				appRef.current = app;
				container.appendChild(app.canvas);

				// Camera container - this will be scaled/positioned for zoom
				const cameraContainer = new Container();
				cameraContainerRef.current = cameraContainer;
				app.stage.addChild(cameraContainer);

				const previewClipMask = new Graphics();
				previewClipMaskRef.current = previewClipMask;
				app.stage.addChild(previewClipMask);
				cameraContainer.mask = previewClipMask;

				// Video container - holds the masked video sprite
				const videoContainer = new Container();
				videoContainerRef.current = videoContainer;
				cameraContainer.addChild(videoContainer);

				const cursorContainer = new Container();
				cursorContainerRef.current = cursorContainer;
				cameraContainer.addChild(cursorContainer);

				// Cursor overlay - rendered above the masked video so it can sit in front
				// of the content without getting clipped.
				if (cursorOverlayEnabled) {
					const resolvedCursorConfig = resolveCursorV2Config({
						cursorPack: cursorPackRef.current,
						cursorTypeMode: cursorTypeModeRef.current,
						cursorTilt: cursorTiltRef.current,
						hideWhenIdle: hideWhenIdleRef.current,
						idleHideDelayMs: idleHideDelayMsRef.current,
						smoothMovementEnabled: smoothMovementEnabledRef.current,
						cursorMovementStyle: cursorMovementStyleRef.current,
						cursorSpring: cursorSpringRef.current,
						highQualitySvgCursors: highQualitySvgCursorsRef.current,
					});
					const cursorOverlay = new PixiCursorOverlay({
						dotRadius: DEFAULT_CURSOR_CONFIG.dotRadius * cursorSizeRef.current,
						smoothingFactor: smoothMovementEnabledRef.current ? cursorSmoothingRef.current : 0,
						motionBlur: cursorMotionBlurRef.current,
						clickBounce: cursorClickBounceRef.current,
						clickEffectsEnabled: clickEffectsEnabledRef.current,
						sway: cursorSwayRef.current,
						cursorStyle: cursorStyleRef.current,
						cursorPack: resolvedCursorConfig.cursorPack,
						cursorColor: cursorColorRef.current,
						cursorOpacity: cursorOpacityRef.current,
						clickHighlightColor: clickHighlightColorRef.current,
						clickHighlightSize: clickHighlightSizeRef.current,
						clickHighlightOpacity: clickHighlightOpacityRef.current,
						clickStyle: cursorClickStyleRef.current,
						trailLength: cursorTrailLengthRef.current,
						trailOpacity: cursorTrailOpacityRef.current,
						springConfig: resolvedCursorConfig.springConfig,
						cursorTypeMode: resolvedCursorConfig.cursorTypeMode,
						cursorTilt: resolvedCursorConfig.cursorTilt,
						hideWhenIdle: resolvedCursorConfig.hideWhenIdle,
						idleHideDelayMs: resolvedCursorConfig.idleHideDelayMs,
						preferSystemCursorAssets: resolvedCursorConfig.preferSystemCursorAssets,
					});
					cursorOverlayRef.current = cursorOverlay;
					cursorContainer.addChild(cursorOverlay.container);
				} else {
					cursorOverlayRef.current = null;
				}

				setPixiReady(true);
			})().catch((error) => {
				if (!mounted) {
					return;
				}
				console.error("Failed to initialize preview renderer:", error);
				if (pendingPreviewQualitySwitchRef.current?.targetQuality === rendererPreviewQuality) {
					handlePreviewQualitySwitchFailure(error, rendererPreviewQuality);
					return;
				}
				onError(error instanceof Error ? error.message : "Failed to initialize preview renderer");
			});

			return () => {
				mounted = false;
				setPixiReady(false);
				if (cursorOverlayRef.current) {
					cursorOverlayRef.current.destroy();
					cursorOverlayRef.current = null;
				}
				if (app && app.renderer) {
					app.destroy(true, {
						children: true,
						texture: false,
						textureSource: false,
					});
				}
				appRef.current = null;
				cameraContainerRef.current = null;
				videoContainerRef.current = null;
				cursorContainerRef.current = null;
				videoSpriteRef.current = null;
				maskGraphicsRef.current = null;
				previewClipMaskRef.current = null;
			};
		}, [
			handlePreviewQualitySwitchFailure,
			onError,
			previewRendererEpoch,
			previewResolution,
			rendererPreviewQuality,
		]);

		useEffect(() => {
			const video = videoRef.current;
			if (!video) return;
			void videoPath;
			video.pause();
			video.currentTime = 0;
			allowPlaybackRef.current = false;
			hasStablePreviewRef.current = false;
			cachedPreviewFrameRef.current = null;
			previewHoldsRef.current = clearPreviewHolds();
			setCachedPreviewFrameSrc(null);
			setActivePreviewHoldSrc(null);
			setPreviewGeometry(null);
			setIsPreviewQualitySwitching(false);
			setIsPreviewRecoveryActive(false);
			lockedVideoDimensionsRef.current = null;
			setVideoReady(false);
			if (videoReadyRafRef.current) {
				cancelAnimationFrame(videoReadyRafRef.current);
				videoReadyRafRef.current = null;
			}
		}, [videoPath]);

		useEffect(() => {
			if (!videoPath) {
				return;
			}

			const captureFrameIfPossible = () => {
				if (document.visibilityState === "hidden") {
					return;
				}
				void capturePreviewFrameSnapshot();
			};

			const recoverPreviewIfNeeded = () => {
				if (document.visibilityState === "hidden") {
					return;
				}

				const video = videoRef.current;
				if (!video || previewRecoveryPromiseRef.current) {
					return;
				}

				if (hasRenderablePreviewFrame(video)) {
					return;
				}

				void restorePreviewFrame();
			};

			const handleVisibilityChange = () => {
				if (document.visibilityState === "hidden") {
					captureFrameIfPossible();
					return;
				}
				if (document.visibilityState === "visible") {
					recoverPreviewIfNeeded();
				}
			};

			window.addEventListener("blur", captureFrameIfPossible);
			window.addEventListener("focus", recoverPreviewIfNeeded);
			document.addEventListener("visibilitychange", handleVisibilityChange);

			return () => {
				window.removeEventListener("blur", captureFrameIfPossible);
				window.removeEventListener("focus", recoverPreviewIfNeeded);
				document.removeEventListener("visibilitychange", handleVisibilityChange);
			};
		}, [capturePreviewFrameSnapshot, restorePreviewFrame, videoPath]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;
			hasStablePreviewRef.current = true;
			void capturePreviewFrameSnapshot();
		}, [capturePreviewFrameSnapshot, pixiReady, videoReady]);

		useEffect(() => {
			if (!videoPath || !hasStablePreviewRef.current) {
				return;
			}

			if (pixiReady && videoReady) {
				return;
			}

			if (previewRecoveryPromiseRef.current || previewRendererResetPromiseRef.current) {
				return;
			}

			const healId = window.setTimeout(() => {
				const video = videoRef.current;
				if (!video || previewRecoveryPromiseRef.current || previewRendererResetPromiseRef.current) {
					return;
				}

				if (hasRenderablePreviewFrame(video)) {
					void recreatePreviewRenderer();
					return;
				}

				void restorePreviewFrame();
			}, 150);

			return () => {
				window.clearTimeout(healId);
			};
		}, [pixiReady, recreatePreviewRenderer, restorePreviewFrame, videoPath, videoReady]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;

			const video = videoRef.current;
			const app = appRef.current;
			const videoContainer = videoContainerRef.current;
			const cursorContainer = cursorContainerRef.current;

			if (!video || !app || !videoContainer || !cursorContainer) return;
			if (video.videoWidth === 0 || video.videoHeight === 0) return;

			const source = VideoSource.from(video);
			if ("autoPlay" in source) {
				(source as { autoPlay?: boolean }).autoPlay = false;
			}
			if ("autoUpdate" in source) {
				(source as { autoUpdate?: boolean }).autoUpdate = true;
			}
			const videoTexture = Texture.from(source);
			videoTextureRef.current = videoTexture;

			const videoSprite = new Sprite(videoTexture);
			videoSpriteRef.current = videoSprite;

			const maskGraphics = new Graphics();
			videoContainer.addChild(videoSprite);
			videoContainer.addChild(maskGraphics);
			videoContainer.mask = maskGraphics;
			maskGraphicsRef.current = maskGraphics;
			if (cursorOverlayRef.current) {
				cursorContainer.addChild(cursorOverlayRef.current.container);
			}

			animationStateRef.current = createPlaybackCameraState();

			const blurFilter = new BlurFilter();
			blurFilter.quality = 3;
			blurFilter.resolution = app.renderer.resolution;
			blurFilter.blur = 0;
			const motionBlurFilter = new MotionBlurFilter([0, 0], 5, 0);
			videoContainer.filters = [blurFilter, motionBlurFilter];
			blurFilterRef.current = blurFilter;
			motionBlurFilterRef.current = motionBlurFilter;

			layoutVideoContent();
			video.pause();

			const { handlePlay, handlePause, handleSeeked, handleSeeking } = createVideoEventHandlers({
				video,
				isSeekingRef,
				isPlayingRef,
				allowPlaybackRef,
				suppressEventEmissionRef: isPreviewRecoveryInProgressRef,
				currentTimeRef,
				timeUpdateAnimationRef,
				onPlayStateChange,
				onTimeUpdate,
				trimRegionsRef,
				speedRegionsRef,
			});

			video.addEventListener("play", handlePlay);
			video.addEventListener("pause", handlePause);
			video.addEventListener("ended", handlePause);
			video.addEventListener("seeked", handleSeeked);
			video.addEventListener("seeking", handleSeeking);

			return () => {
				video.removeEventListener("play", handlePlay);
				video.removeEventListener("pause", handlePause);
				video.removeEventListener("ended", handlePause);
				video.removeEventListener("seeked", handleSeeked);
				video.removeEventListener("seeking", handleSeeking);

				if (timeUpdateAnimationRef.current) {
					cancelAnimationFrame(timeUpdateAnimationRef.current);
				}

				if (videoSprite) {
					videoContainer.removeChild(videoSprite);
					videoSprite.destroy();
				}
				if (maskGraphics) {
					videoContainer.removeChild(maskGraphics);
					maskGraphics.destroy();
				}
				videoContainer.mask = null;
				maskGraphicsRef.current = null;
				if (blurFilterRef.current) {
					videoContainer.filters = [];
					blurFilterRef.current.destroy();
					blurFilterRef.current = null;
				}
				if (motionBlurFilterRef.current) {
					motionBlurFilterRef.current.destroy();
					motionBlurFilterRef.current = null;
				}
				videoTexture.destroy(false);

				if (videoTextureRef.current === videoTexture) {
					videoTextureRef.current = null;
				}
				videoSpriteRef.current = null;
			};
		}, [layoutVideoContent, onPlayStateChange, onTimeUpdate, pixiReady, videoReady]);

		useEffect(() => {
			if (!pixiReady || !videoReady) return;

			const app = appRef.current;
			const videoSprite = videoSpriteRef.current;
			const videoContainer = videoContainerRef.current;
			if (!app || !videoSprite || !videoContainer) return;

			const applyTransform = (
				transform: { scale: number; x: number; y: number },
				focus: ZoomFocus,
				motionIntensity: number,
				motionVector: { x: number; y: number },
			) => {
				const cameraContainer = cameraContainerRef.current;
				if (!cameraContainer) return;

				const state = animationStateRef.current;

				const appliedTransform = applyZoomTransform({
					cameraContainer,
					blurFilter: blurFilterRef.current,
					stageSize: stageSizeRef.current,
					baseMask: baseMaskRef.current,
					zoomScale: state.scale,
					zoomProgress: state.progress,
					focusX: focus.cx,
					focusY: focus.cy,
					motionIntensity,
					motionVector,
					isPlaying: isPlayingRef.current,
					motionBlurAmount: zoomMotionBlurRef.current,
					motionBlurFilter: motionBlurFilterRef.current,
					transformOverride: transform,
					motionBlurState: motionBlurStateRef.current,
					frameTimeMs: performance.now(),
				});

				state.x = appliedTransform.x;
				state.y = appliedTransform.y;
				state.appliedScale = appliedTransform.scale;
				updateFrameBorderOverlay();
			};

			const ticker = () => {
				const state = animationStateRef.current;
				const nowMs = performance.now();
				const playbackTimeMs = currentTimeRef.current;

				// If a zoom is selected but video is not playing, show default unzoomed view
				// (the overlay will show where the zoom will be)
				const selectedId = selectedZoomIdRef.current;
				const hasSelectedZoom = selectedId !== null;
				const shouldShowUnzoomedView = hasSelectedZoom && !isPlayingRef.current;
				const shouldSmooth = isPlayingRef.current && !isSeekingRef.current;
				const evaluation = evaluatePlaybackCameraFrame({
					state,
					frameTimeMs: nowMs,
					playbackTimeMs,
					cursorSimulationPath: cursorSimulationPathRef.current,
					zoomRegions: shouldShowUnzoomedView ? [] : zoomRegionsRef.current,
					connectZooms: connectZoomsRef.current,
					zoomTiming: zoomTimingRef.current,
					geometry: {
						stageSize: stageSizeRef.current,
						baseMask: baseMaskRef.current,
					},
					shouldSmooth,
					cameraSpring: cameraSpringRef.current,
				});
				animationStateRef.current = evaluation.state;

				applyTransform(
					evaluation.transform,
					evaluation.targetFocus,
					evaluation.motionIntensity,
					evaluation.motionVector,
				);

				// Update cursor overlay
				const cursorOverlay = cursorOverlayRef.current;
				if (cursorOverlay) {
					const previewClickSample = getPreviewClickSample(playbackTimeMs, nowMs);
					cursorOverlay.updateFromMotionSnapshot(
						evaluation.simulatedCursor ??
							(previewClickSample ? createPreviewClickMotionSnapshot(playbackTimeMs) : null),
						cursorTelemetryRef.current,
						playbackTimeMs,
						baseMaskRef.current,
						showCursorRef.current,
						!isPlayingRef.current || isSeekingRef.current,
						previewClickSample,
					);
				}
			};

			app.ticker.add(ticker);
			return () => {
				if (app && app.ticker) {
					app.ticker.remove(ticker);
				}
			};
		}, [pixiReady, videoReady, updateFrameBorderOverlay, getPreviewClickSample]);

		useEffect(() => {
			const overlay = cursorOverlayRef.current;
			if (!overlay) {
				return;
			}

			const resolvedCursorConfig = resolveCursorV2Config({
				cursorPack,
				cursorTypeMode,
				cursorTilt,
				hideWhenIdle,
				idleHideDelayMs,
				smoothMovementEnabled,
				cursorMovementStyle,
				cursorSpring,
				highQualitySvgCursors,
			});
			overlay.setDotRadius(DEFAULT_CURSOR_CONFIG.dotRadius * cursorSize);
			overlay.setSmoothingFactor(smoothMovementEnabled ? cursorSmoothing : 0);
			overlay.setMotionBlur(cursorMotionBlur);
			overlay.setClickBounce(cursorClickBounce);
			overlay.setClickEffectsEnabled(clickEffectsEnabled);
			overlay.setSway(cursorSway);
			overlay.setCursorStyle(cursorStyle);
			overlay.setCursorColor(cursorColor);
			overlay.setCursorOpacity(cursorOpacity);
			overlay.setClickHighlightColor(clickHighlightColor);
			overlay.setClickHighlightSize(clickHighlightSize);
			overlay.setClickHighlightOpacity(clickHighlightOpacity);
			overlay.setClickStyle(cursorClickStyle);
			overlay.setTrailLength(cursorTrailLength);
			overlay.setTrailOpacity(cursorTrailOpacity);
			overlay.setSpringConfig(resolvedCursorConfig.springConfig);
			overlay.setCursorTypeMode(resolvedCursorConfig.cursorTypeMode);
			overlay.setCursorTilt(resolvedCursorConfig.cursorTilt);
			overlay.setHideWhenIdle(resolvedCursorConfig.hideWhenIdle);
			overlay.setIdleHideDelayMs(resolvedCursorConfig.idleHideDelayMs);
			overlay.setPreferSystemCursorAssets(resolvedCursorConfig.preferSystemCursorAssets);
			overlay.reset();
		}, [
			cursorSize,
			cursorSmoothing,
			cursorMotionBlur,
			cursorClickBounce,
			clickEffectsEnabled,
			cursorSway,
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorClickStyle,
			cursorTrailLength,
			cursorTrailOpacity,
			cursorTypeMode,
			cursorTilt,
			hideWhenIdle,
			idleHideDelayMs,
			smoothMovementEnabled,
			cursorMovementStyle,
			cursorSpring,
			highQualitySvgCursors,
		]);

		useEffect(() => {
			const cursorContainer = cursorContainerRef.current;
			if (!cursorContainer) {
				return;
			}

			let cancelled = false;

			(async () => {
				try {
					await preloadCursorAssets();
				} catch (error) {
					console.warn(
						"Native cursor assets are unavailable in preview; continuing without cursor overlay.",
						error,
					);
					if (!cancelled && cursorOverlayRef.current) {
						cursorOverlayRef.current.destroy();
						cursorOverlayRef.current = null;
					}
					return;
				}

				if (cancelled || !cursorContainerRef.current) {
					return;
				}

				if (cursorOverlayRef.current) {
					cursorOverlayRef.current.destroy();
				}

				const resolvedCursorConfig = resolveCursorV2Config({
					cursorPack,
					cursorTypeMode: cursorTypeModeRef.current,
					cursorTilt: cursorTiltRef.current,
					hideWhenIdle: hideWhenIdleRef.current,
					idleHideDelayMs: idleHideDelayMsRef.current,
					smoothMovementEnabled: smoothMovementEnabledRef.current,
					cursorMovementStyle: cursorMovementStyleRef.current,
					cursorSpring: cursorSpringRef.current,
					highQualitySvgCursors: highQualitySvgCursorsRef.current,
				});
				const cursorOverlay = new PixiCursorOverlay({
					dotRadius: DEFAULT_CURSOR_CONFIG.dotRadius * cursorSizeRef.current,
					smoothingFactor: smoothMovementEnabledRef.current ? cursorSmoothingRef.current : 0,
					motionBlur: cursorMotionBlurRef.current,
					clickBounce: cursorClickBounceRef.current,
					clickEffectsEnabled: clickEffectsEnabledRef.current,
					sway: cursorSwayRef.current,
					cursorStyle: cursorStyleRef.current,
					cursorPack,
					cursorColor: cursorColorRef.current,
					cursorOpacity: cursorOpacityRef.current,
					clickHighlightColor: clickHighlightColorRef.current,
					clickHighlightSize: clickHighlightSizeRef.current,
					clickHighlightOpacity: clickHighlightOpacityRef.current,
					clickStyle: cursorClickStyleRef.current,
					trailLength: cursorTrailLengthRef.current,
					trailOpacity: cursorTrailOpacityRef.current,
					springConfig: resolvedCursorConfig.springConfig,
					cursorTypeMode: resolvedCursorConfig.cursorTypeMode,
					cursorTilt: resolvedCursorConfig.cursorTilt,
					hideWhenIdle: resolvedCursorConfig.hideWhenIdle,
					idleHideDelayMs: resolvedCursorConfig.idleHideDelayMs,
					preferSystemCursorAssets: resolvedCursorConfig.preferSystemCursorAssets,
				});
				cursorOverlayRef.current = cursorOverlay;
				cursorContainerRef.current.addChild(cursorOverlay.container);
				cursorOverlay.reset();
			})().catch((error) => {
				console.warn("Failed to rebuild cursor overlay for the selected pack:", error);
			});

			return () => {
				cancelled = true;
			};
		}, [cursorPack]);

		const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
			const video = e.currentTarget;
			onDurationChange(video.duration);

			if (!isPreviewRecoveryInProgressRef.current) {
				video.currentTime = 0;
				video.pause();
				allowPlaybackRef.current = false;
				currentTimeRef.current = 0;
			}

			if (videoReadyRafRef.current) {
				cancelAnimationFrame(videoReadyRafRef.current);
				videoReadyRafRef.current = null;
			}

			const waitForRenderableFrame = () => {
				const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;
				const hasData = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
				if (hasDimensions && hasData) {
					videoReadyRafRef.current = null;
					setVideoReady(true);
					return;
				}
				videoReadyRafRef.current = requestAnimationFrame(waitForRenderableFrame);
			};

			videoReadyRafRef.current = requestAnimationFrame(waitForRenderableFrame);
		};

		const resolvedWallpaper = useResolvedWallpaper(wallpaper);

		useEffect(() => {
			return () => {
				if (videoReadyRafRef.current) {
					cancelAnimationFrame(videoReadyRafRef.current);
					videoReadyRafRef.current = null;
				}
			};
		}, []);

		const isImageUrl = Boolean(
			resolvedWallpaper &&
				(resolvedWallpaper.startsWith("file://") ||
					resolvedWallpaper.startsWith("http") ||
					resolvedWallpaper.startsWith("/") ||
					resolvedWallpaper.startsWith("data:")),
		);
		const backgroundStyle = isImageUrl
			? { backgroundImage: `url(${resolvedWallpaper || ""})` }
			: { background: resolvedWallpaper || "" };
		const ratioVideoWidth =
			lockedVideoDimensionsRef.current?.width ?? videoRef.current?.videoWidth ?? 16;
		const ratioVideoHeight =
			lockedVideoDimensionsRef.current?.height ?? videoRef.current?.videoHeight ?? 9;
		const cropX = Math.min(Math.max(cropRegion?.x ?? 0, 0), 1);
		const cropY = Math.min(Math.max(cropRegion?.y ?? 0, 0), 1);
		const cropWidth = Math.min(Math.max(cropRegion?.width ?? 1, 0.0001), 1 - cropX);
		const cropHeight = Math.min(Math.max(cropRegion?.height ?? 1, 0.0001), 1 - cropY);
		const nativeAspectRatio = Math.max(
			0.0001,
			(ratioVideoWidth * cropWidth) / Math.max(0.0001, ratioVideoHeight * cropHeight),
		);
		const outputAspectRatio = getAspectRatioValue(aspectRatio, nativeAspectRatio);
		const backgroundStageWidth =
			previewGeometry?.stageRect.width ?? containerRef.current?.clientWidth ?? 0;
		const backgroundStageHeight =
			previewGeometry?.stageRect.height ?? containerRef.current?.clientHeight ?? 0;
		const backgroundCanvasRect = fitAspectRect(
			backgroundStageWidth,
			backgroundStageHeight,
			outputAspectRatio,
		);
		const backgroundCanvasStyle: React.CSSProperties = {
			left: `${backgroundCanvasRect.x}px`,
			top: `${backgroundCanvasRect.y}px`,
			width: `${backgroundCanvasRect.width}px`,
			height: `${backgroundCanvasRect.height}px`,
			borderRadius: `${Math.max(0, borderRadius)}px`,
		};
		const backgroundBlurInset = backgroundBlur > 0 ? Math.ceil(backgroundBlur * 2) : 0;
		const fallbackPreviewFrameSrc = resolvePreviewFrameOverlaySource({
			activePreviewHoldSrc,
			cachedPreviewFrameSrc,
			pixiReady,
			videoReady,
			hasVideoPath: Boolean(videoPath),
		});
		const isPreviewWebcamHeld =
			activePreviewHoldSrc !== null || isPreviewQualitySwitching || isPreviewRecoveryActive;

		return (
			<div className="relative overflow-hidden w-full h-full">
				{/* Background layer */}
				{!hideBackground && (
					<div className="absolute overflow-hidden" style={backgroundCanvasStyle}>
						<div
							className="absolute bg-cover bg-center"
							style={{
								...backgroundStyle,
								inset: `-${backgroundBlurInset}px`,
								filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : "none",
							}}
						/>
					</div>
				)}
				<div
					ref={containerRef}
					className="absolute inset-0"
					style={{
						zIndex: 2,
						filter: hasVisibleFrameShadow({
							size: frameShadowSize,
							opacity: frameShadowOpacity,
							blur: frameShadowBlur,
						})
							? buildFrameShadowFilter({
									size: frameShadowSize,
									opacity: frameShadowOpacity,
									blur: frameShadowBlur,
								})
							: "none",
					}}
				/>
				<div
					ref={frameBorderRef}
					className="absolute pointer-events-none"
					style={{ display: "none", zIndex: 1 }}
				/>
				{fallbackPreviewFrameSrc && (
					<img
						src={fallbackPreviewFrameSrc}
						alt=""
						aria-hidden="true"
						className="absolute inset-0 pointer-events-none select-none"
						style={{
							zIndex: 2,
							width: "100%",
							height: "100%",
							objectFit: "fill",
						}}
					/>
				)}
				<canvas
					ref={deviceMockupCanvasRef}
					aria-hidden="true"
					className="absolute inset-0 pointer-events-none"
					style={{ display: "none", zIndex: 3, width: "100%", height: "100%" }}
				/>
				{/* Only render overlay after PIXI and video are fully initialized */}
				{pixiReady && videoReady && (
					<PlaybackOverlays
						overlayRef={overlayRef}
						focusIndicatorRef={focusIndicatorRef}
						annotationRegions={annotationRegions}
						selectedAnnotationId={selectedAnnotationId}
						onSelectAnnotation={onSelectAnnotation}
						onAnnotationPositionChange={onAnnotationPositionChange}
						onAnnotationSizeChange={onAnnotationSizeChange}
						currentTime={currentTime}
						webcamPath={webcamPath}
						resolvedWebcamModel={resolvedWebcamModel}
						webcamPreviewRects={webcamPreviewRects}
						webcamEffects={webcamEffects}
						webcamPreviewMode={webcamPreviewMode}
						isPlaying={isPlaying}
						isPreviewWebcamHeld={isPreviewWebcamHeld}
						playbackRate={videoRef.current?.playbackRate ?? 1}
						onWebcamHealthMetricsChange={onWebcamHealthMetricsChange}
						webcamSelected={webcamSelected}
						selectedCameraLayoutId={selectedCameraLayoutId}
						onWebcamPositionChange={onWebcamPositionChange}
						onWebcamSizeChange={onWebcamSizeChange}
						onSelectWebcam={onSelectWebcam}
						captionRegions={captionRegions}
						captionSettings={captionSettings}
						isEditingCaptionPosition={isEditingCaptionPosition}
						onCaptionPositionOverrideChange={onCaptionPositionOverrideChange}
						showKeyboardShortcuts={showKeyboardShortcuts}
						keyboardShortcutCallouts={keyboardShortcutCallouts}
						keyboardShortcutPosition={keyboardShortcutPosition}
						keyboardShortcutTheme={keyboardShortcutTheme}
						keyboardShortcutScale={keyboardShortcutScale}
						keyboardShortcutOpacity={keyboardShortcutOpacity}
						keyboardShortcutMaxVisible={keyboardShortcutMaxVisible}
						onPointerDown={handleOverlayPointerDown}
						onPointerMove={handleOverlayPointerMove}
						onPointerUp={handleOverlayPointerUp}
						onPointerLeave={handleOverlayPointerLeave}
					/>
				)}
				<HiddenPreviewVideo
					videoRef={videoRef}
					videoPath={videoPath}
					onLoadedMetadata={handleLoadedMetadata}
					onDurationChange={onDurationChange}
					onError={onError}
					isPreviewRecoveryInProgressRef={isPreviewRecoveryInProgressRef}
				/>
			</div>
		);
	},
);

VideoPlayback.displayName = "VideoPlayback";

export default VideoPlayback;
