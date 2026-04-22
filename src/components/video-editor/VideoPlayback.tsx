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
import { getAssetPath, getRenderableAssetUrl } from "@/lib/assetPath";
import {
	DEFAULT_WALLPAPER_PATH,
	DEFAULT_WALLPAPER_RELATIVE_PATH,
	normalizeWallpaperSelection,
} from "@/lib/wallpapers";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { CaptionOverlay } from "./CaptionOverlay";
import { createWebcamZoomMotionState, type PixelRect } from "./cameraLayouts";
import { applyOpacityToHex, buildFrameShadowFilter, hasVisibleFrameShadow } from "./frameEffects";
import { KeyboardShortcutOverlay } from "./KeyboardShortcutOverlay";
import {
	type AnnotationRegion,
	type CameraLayoutRegion,
	type CursorMovementStyle,
	type CursorPack,
	type CursorSpringSettings,
	type CursorStyle,
	type CursorTelemetryPoint,
	type CursorTypeMode,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
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
	type KeyboardShortcutCallout,
	type KeyboardShortcutPosition,
	type KeyboardShortcutTheme,
	type PreviewQuality,
	type SpeedRegion,
	type TrimRegion,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamPreviewMode,
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
	PixiCursorOverlay,
	preloadCursorAssets,
} from "./videoPlayback/cursorRenderer";
import {
	buildCursorSimulationPath,
	type CursorSimulationPath,
} from "./videoPlayback/cursorSimulation";
import { resolveCursorV2Config } from "./videoPlayback/cursorV2";
// import { computeMockupScreenRect, drawDeviceMockup } from "./videoPlayback/deviceMockups";
import { clampFocusToStage as clampFocusToStageUtil } from "./videoPlayback/focusUtils";
import { layoutVideoContent as layoutVideoContentUtil } from "./videoPlayback/layoutUtils";
import { clamp01 } from "./videoPlayback/mathUtils";
import { updateOverlayIndicator } from "./videoPlayback/overlayUtils";
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
import { createVideoEventHandlers } from "./videoPlayback/videoEventHandlers";
import {
	applyZoomTransform,
	createMotionBlurState,
	type MotionBlurState,
	projectFrameRect,
} from "./videoPlayback/zoomTransform";
import { WebcamOverlay } from "./WebcamOverlay";
import { evaluateWebcamFrame } from "./webcamFrameEvaluation";

interface VideoPlaybackProps {
	videoPath: string;
	onDurationChange: (duration: number) => void;
	onTimeUpdate: (time: number) => void;
	currentTime: number;
	onPlayStateChange: (playing: boolean) => void;
	onError: (error: string) => void;
	wallpaper?: string;
	zoomRegions: ZoomRegion[];
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	onZoomFocusChange: (id: string, focus: ZoomFocus) => void;
	isPlaying: boolean;
	frameShadowSize?: number;
	frameShadowOpacity?: number;
	frameShadowBlur?: number;
	previewQuality: PreviewQuality;
	onPreviewQualitySwitchFailed?: (fallbackQuality: PreviewQuality) => void;
	backgroundBlur?: number;
	hideBackground?: boolean;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	borderRadius?: number;
	padding?: number;
	cropRegion?: import("./types").CropRegion;
	trimRegions?: TrimRegion[];
	speedRegions?: SpeedRegion[];
	aspectRatio: AspectRatio;
	annotationRegions?: AnnotationRegion[];
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	onAnnotationPositionChange?: (id: string, position: { x: number; y: number }) => void;
	onAnnotationSizeChange?: (id: string, size: { width: number; height: number }) => void;
	cursorTelemetry?: CursorTelemetryPoint[];
	keyboardShortcutCallouts?: KeyboardShortcutCallout[];
	showKeyboardShortcuts?: boolean;
	keyboardShortcutPosition?: KeyboardShortcutPosition;
	keyboardShortcutTheme?: KeyboardShortcutTheme;
	keyboardShortcutScale?: number;
	keyboardShortcutOpacity?: number;
	keyboardShortcutMaxVisible?: number;
	showCursor?: boolean;
	cursorSize?: number;
	cursorSmoothing?: number;
	cursorMotionBlur?: number;
	cursorClickBounce?: number;
	cursorSway?: number;
	cursorStyle?: CursorStyle;
	cursorPack?: CursorPack;
	cursorColor?: string;
	cursorOpacity?: number;
	clickHighlightColor?: string;
	clickHighlightSize?: number;
	clickHighlightOpacity?: number;
	cursorTrailLength?: number;
	cursorTrailOpacity?: number;
	cursorTypeMode?: CursorTypeMode;
	cursorTilt?: number;
	hideWhenIdle?: boolean;
	idleHideDelayMs?: number;
	smoothMovementEnabled?: boolean;
	cursorMovementStyle?: CursorMovementStyle;
	cursorSpring?: CursorSpringSettings;
	highQualitySvgCursors?: boolean;
	cameraSpring?: import("./types").CameraSpringSettings;
	webcamPath?: string | null;
	webcamRegion?: import("./types").WebcamRegion;
	webcamEffects?: WebcamEffects;
	webcamPreviewMode?: WebcamPreviewMode;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	onWebcamHealthMetricsChange?: (metrics: WebcamHealthMetrics | null) => void;
	onWebcamPositionChange?: (position: { x: number; y: number }) => void;
	onWebcamSizeChange?: (size: { width: number; height: number }) => void;
	webcamSelected?: boolean;
	selectedCameraLayoutId?: string | null;
	onSelectWebcam?: () => void;
	captionRegions?: import("./types").CaptionRegion[];
	captionSettings?: import("./types").CaptionSettings;
	isEditingCaptionPosition?: boolean;
	onCaptionPositionOverrideChange?: (
		override: import("./types").CaptionPositionOverride | null,
	) => void;
}

export interface VideoPlaybackRef {
	video: HTMLVideoElement | null;
	app: Application | null;
	videoSprite: Sprite | null;
	videoContainer: Container | null;
	containerRef: React.RefObject<HTMLDivElement>;
	play: () => Promise<void>;
	pause: () => void;
	refreshFrame: () => Promise<void>;
	restorePreviewFrame: (options?: {
		forceReload?: boolean;
		resumePlayback?: boolean;
	}) => Promise<void>;
	acquirePreviewHold: (reason: PreviewHoldReason) => Promise<string>;
	releasePreviewHold: (token: string) => void;
}

interface PreviewGeometry {
	stageRect: PixelRect;
	frameRect: PixelRect;
	maskRect: PixelRect;
}

function rectsEqual(left: PixelRect, right: PixelRect) {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	);
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
			frameBorderEnabled = false,
			frameBorderWidth = 0,
			frameBorderColor = "#000000",
			frameBorderOpacity = 0.5,
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
			clickHighlightColor = DEFAULT_CLICK_HIGHLIGHT_COLOR,
			clickHighlightSize = DEFAULT_CLICK_HIGHLIGHT_SIZE,
			clickHighlightOpacity = DEFAULT_CLICK_HIGHLIGHT_OPACITY,
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
		const clickHighlightColorRef = useRef(clickHighlightColor);
		const clickHighlightSizeRef = useRef(clickHighlightSize);
		const clickHighlightOpacityRef = useRef(clickHighlightOpacity);
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
			() => getEffectivePreviewResolution(window.devicePixelRatio || 1, rendererPreviewQuality),
			[rendererPreviewQuality],
		);
		useEffect(() => {
			desiredPreviewQualityRef.current = previewQuality;
		}, [previewQuality]);
		const webcamStageX = previewGeometry?.stageRect?.x ?? 0;
		const webcamStageY = previewGeometry?.stageRect?.y ?? 0;
		const webcamStageWidth =
			previewGeometry?.stageRect?.width ?? (stageSizeRef.current.width || 800);
		const webcamStageHeight =
			previewGeometry?.stageRect?.height ?? (stageSizeRef.current.height || 600);
		const webcamStageRect = useMemo<PixelRect>(() => {
			return {
				x: webcamStageX,
				y: webcamStageY,
				width: webcamStageWidth,
				height: webcamStageHeight,
			};
		}, [webcamStageHeight, webcamStageWidth, webcamStageX, webcamStageY]);
		const webcamCompositionX = previewGeometry?.frameRect?.x ?? webcamStageX;
		const webcamCompositionY = previewGeometry?.frameRect?.y ?? webcamStageY;
		const webcamCompositionWidth = previewGeometry?.frameRect?.width ?? webcamStageWidth;
		const webcamCompositionHeight = previewGeometry?.frameRect?.height ?? webcamStageHeight;
		const webcamCompositionRect = useMemo<PixelRect>(
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
		const webcamContentRect = useMemo<PixelRect>(
			() => ({
				x: webcamContentX,
				y: webcamContentY,
				width: webcamContentWidth,
				height: webcamContentHeight,
			}),
			[webcamContentHeight, webcamContentWidth, webcamContentX, webcamContentY],
		);
		const resolvedWebcamEvaluation = useMemo(() => {
			if (!webcamRegion) {
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
				cameraSizeDuringZoom,
				enableCursorAvoidance: webcamEffects.subtleAvoidance,
				compositionRect: webcamCompositionRect,
				contentRect: webcamContentRect,
				containerWidth: webcamStageRect.width,
				containerHeight: webcamStageRect.height,
				effects: webcamEffects,
				renderMode: "preview",
				previewMode: webcamPreviewMode,
				sourceKey: webcamPath ?? "webcam-preview",
				shouldSmooth:
					isPlaying &&
					!(activePreviewHoldSrc !== null || isPreviewQualitySwitching || isPreviewRecoveryActive),
			});
		}, [
			activePreviewHoldSrc,
			cameraLayouts,
			cameraSizeDuringZoom,
			connectZooms,
			cursorTelemetry,
			currentTime,
			isPlaying,
			isPreviewQualitySwitching,
			isPreviewRecoveryActive,
			mirrorWebcam,
			showWebcam,
			webcamEffects,
			webcamPreviewMode,
			webcamCompositionRect,
			webcamContentRect,
			webcamStageRect,
			webcamPath,
			webcamRegion,
			zoomRegions,
		]);
		const resolvedWebcamSpec = resolvedWebcamEvaluation?.renderSpec ?? null;
		const resolvedWebcamModel = resolvedWebcamSpec?.renderModel ?? null;

		useEffect(() => {
			if (!webcamRegion) {
				webcamMotionStateRef.current = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
				webcamLayoutMotionStateRef.current = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
				return;
			}

			if (!resolvedWebcamEvaluation) {
				return;
			}

			webcamMotionStateRef.current = resolvedWebcamEvaluation.baseMotionState;
			webcamLayoutMotionStateRef.current = resolvedWebcamEvaluation.layoutMotionState;
		}, [resolvedWebcamEvaluation, webcamRegion]);

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

		const updateFrameBorderOverlay = useCallback(
			(transformOverride?: { scale: number; x: number; y: number }) => {
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

				const projectedFrame = projectFrameRect({
					rect: maskRect,
					transform: transformOverride ?? {
						scale: animationStateRef.current.appliedScale,
						x: animationStateRef.current.x,
						y: animationStateRef.current.y,
					},
					borderRadius,
					borderWidth: frameBorderWidth,
				});

				frameBorderEl.style.display = "block";
				frameBorderEl.style.left = `${projectedFrame.rect.x}px`;
				frameBorderEl.style.top = `${projectedFrame.rect.y}px`;
				frameBorderEl.style.width = `${projectedFrame.rect.width}px`;
				frameBorderEl.style.height = `${projectedFrame.rect.height}px`;
				frameBorderEl.style.borderRadius = `${projectedFrame.borderRadius}px`;
				frameBorderEl.style.boxShadow = `0 0 0 ${projectedFrame.borderWidth}px ${applyOpacityToHex(frameBorderColor, frameBorderOpacity)}`;
			},
			[borderRadius, frameBorderColor, frameBorderEnabled, frameBorderOpacity, frameBorderWidth],
		);

		const layoutVideoContent = useCallback(() => {
			const container = containerRef.current;
			const app = appRef.current;
			const videoSprite = videoSpriteRef.current;
			const maskGraphics = maskGraphicsRef.current;
			const videoElement = videoRef.current;
			const cameraContainer = cameraContainerRef.current;

			if (
				!container ||
				!app ||
				!videoSprite ||
				!maskGraphics ||
				!videoElement ||
				!cameraContainer
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
				updateFrameBorderOverlay({ scale: 1, x: 0, y: 0 });

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

		const updateFocusFromClientPoint = (clientX: number, clientY: number) => {
			const overlayEl = overlayRef.current;
			if (!overlayEl) return;

			const regionId = selectedZoomIdRef.current;
			if (!regionId) return;

			const region = zoomRegionsRef.current.find((r) => r.id === regionId);
			if (!region) return;

			const rect = overlayEl.getBoundingClientRect();
			const stageWidth = rect.width;
			const stageHeight = rect.height;

			if (!stageWidth || !stageHeight) {
				return;
			}

			stageSizeRef.current = { width: stageWidth, height: stageHeight };

			const localX = clientX - rect.left;
			const localY = clientY - rect.top;
			const baseMask = baseMaskRef.current;

			const unclampedFocus: ZoomFocus = {
				cx: clamp01((localX - baseMask.x) / Math.max(1, baseMask.width)),
				cy: clamp01((localY - baseMask.y) / Math.max(1, baseMask.height)),
			};
			const clampedFocus = clampFocusToStage(unclampedFocus, region.depth);

			onZoomFocusChange(region.id, clampedFocus);
			updateOverlayForRegion({ ...region, focus: clampedFocus }, clampedFocus);
		};

		const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
			if (isPlayingRef.current) return;
			const regionId = selectedZoomIdRef.current;
			if (!regionId) return;
			const region = zoomRegionsRef.current.find((r) => r.id === regionId);
			if (!region) return;
			onSelectZoom(region.id);
			event.preventDefault();
			isDraggingFocusRef.current = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			updateFocusFromClientPoint(event.clientX, event.clientY);
		};

		const handleOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
			if (!isDraggingFocusRef.current) return;
			event.preventDefault();
			updateFocusFromClientPoint(event.clientX, event.clientY);
		};

		const endFocusDrag = (event: React.PointerEvent<HTMLDivElement>) => {
			if (!isDraggingFocusRef.current) return;
			isDraggingFocusRef.current = false;
			try {
				event.currentTarget.releasePointerCapture(event.pointerId);
			} catch {
				// Pointer capture may already be released if the interaction was interrupted.
			}
		};

		const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
			endFocusDrag(event);
		};

		const handleOverlayPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
			endFocusDrag(event);
		};

		useEffect(() => {
			zoomRegionsRef.current = zoomRegions;
		}, [zoomRegions]);

		useEffect(() => {
			selectedZoomIdRef.current = selectedZoomId;
		}, [selectedZoomId]);

		useEffect(() => {
			isPlayingRef.current = isPlaying;
			// Hide/show the zoom focus indicator when play state changes
			if (pixiReady && videoReady) {
				updateOverlayForRegion(selectedZoom);
			}
		}, [isPlaying, pixiReady, videoReady, selectedZoom, updateOverlayForRegion]);

		useEffect(() => {
			pixiReadyRef.current = pixiReady;
		}, [pixiReady]);

		useEffect(() => {
			videoReadyRef.current = videoReady;
		}, [videoReady]);

		useEffect(() => {
			cachedPreviewFrameRef.current = cachedPreviewFrameSrc;
		}, [cachedPreviewFrameSrc]);

		useEffect(() => {
			trimRegionsRef.current = trimRegions;
		}, [trimRegions]);

		useEffect(() => {
			speedRegionsRef.current = speedRegions;
		}, [speedRegions]);

		useEffect(() => {
			zoomMotionBlurRef.current = zoomMotionBlur;
		}, [zoomMotionBlur]);

		useEffect(() => {
			connectZoomsRef.current = connectZooms;
		}, [connectZooms]);

		useEffect(() => {
			cursorTelemetryRef.current = cursorTelemetry;
			cursorSimulationPathRef.current = buildCursorSimulationPath(
				cursorTelemetry,
				cursorTelemetry[cursorTelemetry.length - 1]?.timeMs ?? 0,
			);
		}, [cursorTelemetry]);

		useEffect(() => {
			showCursorRef.current = showCursor;
		}, [showCursor]);

		useEffect(() => {
			cursorSizeRef.current = cursorSize;
		}, [cursorSize]);

		useEffect(() => {
			cursorSmoothingRef.current = cursorSmoothing;
		}, [cursorSmoothing]);

		useEffect(() => {
			cursorMotionBlurRef.current = cursorMotionBlur;
		}, [cursorMotionBlur]);

		useEffect(() => {
			cursorClickBounceRef.current = cursorClickBounce;
		}, [cursorClickBounce]);

		useEffect(() => {
			cursorSwayRef.current = cursorSway;
		}, [cursorSway]);

		useEffect(() => {
			cursorStyleRef.current = cursorStyle;
		}, [cursorStyle]);

		useEffect(() => {
			cursorPackRef.current = cursorPack;
		}, [cursorPack]);

		useEffect(() => {
			cursorColorRef.current = cursorColor;
		}, [cursorColor]);

		useEffect(() => {
			cursorOpacityRef.current = cursorOpacity;
		}, [cursorOpacity]);

		useEffect(() => {
			clickHighlightColorRef.current = clickHighlightColor;
		}, [clickHighlightColor]);

		useEffect(() => {
			clickHighlightSizeRef.current = clickHighlightSize;
		}, [clickHighlightSize]);

		useEffect(() => {
			clickHighlightOpacityRef.current = clickHighlightOpacity;
		}, [clickHighlightOpacity]);

		useEffect(() => {
			cursorTrailLengthRef.current = cursorTrailLength;
		}, [cursorTrailLength]);

		useEffect(() => {
			cursorTrailOpacityRef.current = cursorTrailOpacity;
		}, [cursorTrailOpacity]);

		useEffect(() => {
			cursorTypeModeRef.current = cursorTypeMode;
		}, [cursorTypeMode]);

		useEffect(() => {
			cursorTiltRef.current = cursorTilt;
		}, [cursorTilt]);

		useEffect(() => {
			hideWhenIdleRef.current = hideWhenIdle;
		}, [hideWhenIdle]);

		useEffect(() => {
			idleHideDelayMsRef.current = idleHideDelayMs;
		}, [idleHideDelayMs]);

		useEffect(() => {
			smoothMovementEnabledRef.current = smoothMovementEnabled;
		}, [smoothMovementEnabled]);

		useEffect(() => {
			cursorMovementStyleRef.current = cursorMovementStyle;
		}, [cursorMovementStyle]);

		useEffect(() => {
			cursorSpringRef.current = cursorSpring;
		}, [cursorSpring]);

		useEffect(() => {
			highQualitySvgCursorsRef.current = highQualitySvgCursors;
		}, [highQualitySvgCursors]);

		useEffect(() => {
			cameraSpringRef.current = cameraSpring;
		}, [cameraSpring]);

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
						sway: cursorSwayRef.current,
						cursorStyle: cursorStyleRef.current,
						cursorPack: resolvedCursorConfig.cursorPack,
						cursorColor: cursorColorRef.current,
						cursorOpacity: cursorOpacityRef.current,
						clickHighlightColor: clickHighlightColorRef.current,
						clickHighlightSize: clickHighlightSizeRef.current,
						clickHighlightOpacity: clickHighlightOpacityRef.current,
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
				updateFrameBorderOverlay(appliedTransform);
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
					cursorOverlay.updateFromMotionSnapshot(
						evaluation.simulatedCursor,
						cursorTelemetryRef.current,
						playbackTimeMs,
						baseMaskRef.current,
						showCursorRef.current,
						!isPlayingRef.current || isSeekingRef.current,
					);
				}
			};

			app.ticker.add(ticker);
			return () => {
				if (app && app.ticker) {
					app.ticker.remove(ticker);
				}
			};
		}, [pixiReady, videoReady, updateFrameBorderOverlay]);

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
			overlay.setSway(cursorSway);
			overlay.setCursorStyle(cursorStyle);
			overlay.setCursorColor(cursorColor);
			overlay.setCursorOpacity(cursorOpacity);
			overlay.setClickHighlightColor(clickHighlightColor);
			overlay.setClickHighlightSize(clickHighlightSize);
			overlay.setClickHighlightOpacity(clickHighlightOpacity);
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
			cursorSway,
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
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
					sway: cursorSwayRef.current,
					cursorStyle: cursorStyleRef.current,
					cursorPack,
					cursorColor: cursorColorRef.current,
					cursorOpacity: cursorOpacityRef.current,
					clickHighlightColor: clickHighlightColorRef.current,
					clickHighlightSize: clickHighlightSizeRef.current,
					clickHighlightOpacity: clickHighlightOpacityRef.current,
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

		const [resolvedWallpaper, setResolvedWallpaper] = useState<string | null>(null);

		useEffect(() => {
			let mounted = true;
			(async () => {
				const resolvedDefaultWallpaper = await getRenderableAssetUrl(
					await getAssetPath(DEFAULT_WALLPAPER_RELATIVE_PATH),
				);

				try {
					const selectedWallpaper = wallpaper
						? normalizeWallpaperSelection(wallpaper)
						: DEFAULT_WALLPAPER_PATH;

					if (!selectedWallpaper) {
						if (mounted) setResolvedWallpaper(resolvedDefaultWallpaper);
						return;
					}

					if (
						selectedWallpaper.startsWith("#") ||
						selectedWallpaper.startsWith("linear-gradient") ||
						selectedWallpaper.startsWith("radial-gradient")
					) {
						if (mounted) setResolvedWallpaper(selectedWallpaper);
						return;
					}

					// If it's a data URL (custom uploaded image), use as-is
					if (selectedWallpaper.startsWith("data:")) {
						if (mounted) setResolvedWallpaper(selectedWallpaper);
						return;
					}

					if (
						selectedWallpaper.startsWith("http") ||
						selectedWallpaper.startsWith("file://") ||
						selectedWallpaper.startsWith("/")
					) {
						const renderable = await getRenderableAssetUrl(selectedWallpaper);
						if (mounted) setResolvedWallpaper(renderable);
						return;
					}
					const p = await getRenderableAssetUrl(
						await getAssetPath(selectedWallpaper.replace(/^\//, "")),
					);
					if (mounted) setResolvedWallpaper(p);
				} catch {
					if (mounted) setResolvedWallpaper(resolvedDefaultWallpaper);
				}
			})();
			return () => {
				mounted = false;
			};
		}, [wallpaper]);

		useEffect(() => {
			return () => {
				if (videoReadyRafRef.current) {
					cancelAnimationFrame(videoReadyRafRef.current);
					videoReadyRafRef.current = null;
				}
			};
		}, []);

		// Device mockups are temporarily disabled in the video editor preview.

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
					<div
						className="absolute inset-0 bg-cover bg-center"
						style={{
							...backgroundStyle,
							filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : "none",
						}}
					/>
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
				{/* Device mockup overlay is temporarily disabled in the video editor preview. */}
				{/* Only render overlay after PIXI and video are fully initialized */}
				{pixiReady && videoReady && (
					<div
						ref={overlayRef}
						className="absolute inset-0 select-none"
						style={{ pointerEvents: "none" }}
						onPointerDown={handleOverlayPointerDown}
						onPointerMove={handleOverlayPointerMove}
						onPointerUp={handleOverlayPointerUp}
						onPointerLeave={handleOverlayPointerLeave}
					>
						<div
							ref={focusIndicatorRef}
							className="absolute rounded-md border border-[#F59E0B]/80 bg-[#F59E0B]/20 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
							style={{ display: "none", pointerEvents: "none" }}
						/>
						{(() => {
							const filtered = (annotationRegions || []).filter((annotation) => {
								if (typeof annotation.startMs !== "number" || typeof annotation.endMs !== "number")
									return false;

								if (annotation.id === selectedAnnotationId) return true;

								const timeMs = Math.round(currentTime * 1000);
								return timeMs >= annotation.startMs && timeMs <= annotation.endMs;
							});

							// Sort by z-index (lowest to highest) so higher z-index renders on top
							const sorted = [...filtered].sort((a, b) => a.zIndex - b.zIndex);

							// Handle click-through cycling: when clicking same annotation, cycle to next
							const handleAnnotationClick = (clickedId: string) => {
								if (!onSelectAnnotation) return;

								// If clicking on already selected annotation and there are multiple overlapping
								if (clickedId === selectedAnnotationId && sorted.length > 1) {
									// Find current index and cycle to next
									const currentIndex = sorted.findIndex((a) => a.id === clickedId);
									const nextIndex = (currentIndex + 1) % sorted.length;
									onSelectAnnotation(sorted[nextIndex].id);
								} else {
									// First click or clicking different annotation
									onSelectAnnotation(clickedId);
								}
							};

							return sorted.map((annotation) => (
								<AnnotationOverlay
									key={annotation.id}
									annotation={annotation}
									isSelected={annotation.id === selectedAnnotationId}
									containerWidth={overlayRef.current?.clientWidth || 800}
									containerHeight={overlayRef.current?.clientHeight || 600}
									onPositionChange={(id, position) => onAnnotationPositionChange?.(id, position)}
									onSizeChange={(id, size) => onAnnotationSizeChange?.(id, size)}
									onClick={handleAnnotationClick}
									zIndex={annotation.zIndex}
									isSelectedBoost={annotation.id === selectedAnnotationId}
								/>
							));
						})()}
						{webcamPath && resolvedWebcamModel && resolvedWebcamModel.opacity > 0 && (
							<WebcamOverlay
								webcamPath={webcamPath}
								renderModel={resolvedWebcamModel}
								compositionRect={webcamCompositionRect}
								webcamEffects={webcamEffects}
								webcamPreviewMode={webcamPreviewMode}
								currentTime={currentTime}
								isPlaying={isPlaying}
								isHeld={isPreviewWebcamHeld}
								playbackRate={videoRef.current?.playbackRate ?? 1}
								onHealthMetricsChange={onWebcamHealthMetricsChange}
								isSelected={
									webcamSelected ||
									(selectedCameraLayoutId === resolvedWebcamModel.activeLayoutId &&
										resolvedWebcamModel.mode === "default")
								}
								onPositionChange={(position) => onWebcamPositionChange?.(position)}
								onSizeChange={(size) => onWebcamSizeChange?.(size)}
								onClick={() => onSelectWebcam?.()}
							/>
						)}
						{captionSettings && (
							<CaptionOverlay
								captionRegions={captionRegions}
								captionSettings={captionSettings}
								currentTimeMs={Math.round(currentTime * 1000)}
								containerWidth={overlayRef.current?.clientWidth || 800}
								containerHeight={overlayRef.current?.clientHeight || 600}
								isEditing={isEditingCaptionPosition}
								onPositionOverrideChange={onCaptionPositionOverrideChange}
							/>
						)}
						{showKeyboardShortcuts && (
							<KeyboardShortcutOverlay
								callouts={keyboardShortcutCallouts}
								position={keyboardShortcutPosition}
								theme={keyboardShortcutTheme}
								scale={keyboardShortcutScale}
								opacity={keyboardShortcutOpacity}
								maxVisible={keyboardShortcutMaxVisible}
								currentTimeMs={Math.round(currentTime * 1000)}
								containerWidth={overlayRef.current?.clientWidth || 800}
							/>
						)}
					</div>
				)}
				<video
					ref={videoRef}
					src={videoPath}
					preload="metadata"
					playsInline
					style={{
						position: "absolute",
						width: 1,
						height: 1,
						opacity: 0,
						pointerEvents: "none",
						left: -10_000,
						top: 0,
					}}
					onLoadedMetadata={handleLoadedMetadata}
					onDurationChange={(e) => {
						onDurationChange(e.currentTarget.duration);
					}}
					onError={(e) => {
						const videoEl = e.currentTarget;
						const mediaError = videoEl.error;
						const code = mediaError?.code ?? "unknown";
						const msg = mediaError?.message ?? "";

						if (isPreviewRecoveryInProgressRef.current) {
							console.warn("Ignoring transient video error during preview recovery:", {
								code,
								message: msg,
								src: videoEl.src,
							});
							return;
						}

						console.error("Video load error:", {
							code,
							message: msg,
							src: videoEl.src,
						});
						onError(
							`Failed to load video (error ${code}${msg ? `: ${msg}` : ""}). Source: ${videoEl.src}`,
						);
					}}
				/>
			</div>
		);
	},
);

VideoPlayback.displayName = "VideoPlayback";

export default VideoPlayback;
