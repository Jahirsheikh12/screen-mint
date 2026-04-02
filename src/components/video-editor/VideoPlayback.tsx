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
import { resolveCameraLayoutState } from "./cameraLayouts";
import { applyOpacityToHex, buildFrameShadowFilter, hasVisibleFrameShadow } from "./frameEffects";
import { KeyboardShortcutOverlay } from "./KeyboardShortcutOverlay";
import {
	type AnnotationRegion,
	type CameraLayoutRegion,
	type CursorPack,
	type CursorTelemetryPoint,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	DEFAULT_KEYBOARD_SHORTCUT_THEME,
	type KeyboardShortcutCallout,
	type KeyboardShortcutPosition,
	type KeyboardShortcutTheme,
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
	PixiCursorOverlay,
	preloadCursorAssets,
} from "./videoPlayback/cursorRenderer";
import {
	buildCursorSimulationPath,
	type CursorSimulationPath,
} from "./videoPlayback/cursorSimulation";
import { computeMockupScreenRect, drawDeviceMockup } from "./videoPlayback/deviceMockups";
import { clampFocusToStage as clampFocusToStageUtil } from "./videoPlayback/focusUtils";
import { layoutVideoContent as layoutVideoContentUtil } from "./videoPlayback/layoutUtils";
import { clamp01 } from "./videoPlayback/mathUtils";
import { updateOverlayIndicator } from "./videoPlayback/overlayUtils";
import {
	commitPreviewQualitySwitch,
	createPreviewQualitySwitchState,
	getEffectivePreviewResolution,
	type PreviewQualitySwitchState,
	requestPreviewQualitySwitch,
	rollbackPreviewQualitySwitch,
} from "./videoPlayback/previewQuality";
import { createVideoEventHandlers } from "./videoPlayback/videoEventHandlers";
import {
	applyZoomTransform,
	createMotionBlurState,
	type MotionBlurState,
} from "./videoPlayback/zoomTransform";
import { WebcamOverlay } from "./WebcamOverlay";

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
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	deviceMockup?: import("./types").DeviceMockup;
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
	cursorPack?: CursorPack;
	webcamPath?: string | null;
	webcamRegion?: import("./types").WebcamRegion;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	onWebcamPositionChange?: (position: { x: number; y: number }) => void;
	onWebcamSizeChange?: (size: { width: number; height: number }) => void;
	webcamSelected?: boolean;
	selectedCameraLayoutId?: string | null;
	onSelectWebcam?: () => void;
	captionRegions?: import("./types").CaptionRegion[];
	captionSettings?: import("./types").CaptionSettings;
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
			zoomMotionBlur = 0,
			connectZooms = true,
			deviceMockup = "none",
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
			cursorPack = "classic",
			webcamPath,
			webcamRegion,
			showWebcam = true,
			mirrorWebcam = false,
			cameraSizeDuringZoom = 1,
			cameraLayouts = [],
			onWebcamPositionChange,
			onWebcamSizeChange,
			webcamSelected = false,
			selectedCameraLayoutId = null,
			onSelectWebcam,
			captionRegions = [],
			captionSettings,
		},
		ref,
	) => {
		const videoRef = useRef<HTMLVideoElement | null>(null);
		const containerRef = useRef<HTMLDivElement | null>(null);
		const appRef = useRef<Application | null>(null);
		const videoSpriteRef = useRef<Sprite | null>(null);
		const videoContainerRef = useRef<Container | null>(null);
		const cursorContainerRef = useRef<Container | null>(null);
		const cameraContainerRef = useRef<Container | null>(null);
		const timeUpdateAnimationRef = useRef<number | null>(null);
		const [pixiReady, setPixiReady] = useState(false);
		const [videoReady, setVideoReady] = useState(false);
		const [rendererPreviewQuality, setRendererPreviewQuality] = useState(previewQuality);
		const mockupCanvasRef = useRef<HTMLCanvasElement | null>(null);
		const overlayRef = useRef<HTMLDivElement | null>(null);
		const focusIndicatorRef = useRef<HTMLDivElement | null>(null);
		const frameBorderRef = useRef<HTMLDivElement | null>(null);
		const currentTimeRef = useRef(0);
		const zoomRegionsRef = useRef<ZoomRegion[]>([]);
		const selectedZoomIdRef = useRef<string | null>(null);
		const animationStateRef = useRef(createPlaybackCameraState());
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
		const isSeekingRef = useRef(false);
		const allowPlaybackRef = useRef(false);
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
		const cursorPackRef = useRef(cursorPack);
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
		const previewQualitySwitchTokenRef = useRef(0);
		const desiredPreviewQualityRef = useRef(previewQuality);
		const previewResolution = useMemo(
			() => getEffectivePreviewResolution(window.devicePixelRatio || 1, rendererPreviewQuality),
			[rendererPreviewQuality],
		);
		useEffect(() => {
			desiredPreviewQualityRef.current = previewQuality;
		}, [previewQuality]);
		const resolvedCameraState = useMemo(() => {
			if (!webcamRegion) {
				return null;
			}

			return resolveCameraLayoutState({
				timeMs: Math.round(currentTime * 1000),
				webcamRegion,
				showWebcam,
				mirrorWebcam,
				cameraLayouts,
				zoomRegions,
				connectZooms,
				cameraSizeDuringZoom,
			});
		}, [
			cameraLayouts,
			cameraSizeDuringZoom,
			connectZooms,
			currentTime,
			mirrorWebcam,
			showWebcam,
			webcamRegion,
			zoomRegions,
		]);

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
				updateFrameBorderOverlay();

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
			cursorPackRef.current = cursorPack;
		}, [cursorPack]);

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
					const cursorOverlay = new PixiCursorOverlay({
						dotRadius: DEFAULT_CURSOR_CONFIG.dotRadius * cursorSizeRef.current,
						smoothingFactor: cursorSmoothingRef.current,
						motionBlur: cursorMotionBlurRef.current,
						clickBounce: cursorClickBounceRef.current,
						sway: cursorSwayRef.current,
						cursorPack: cursorPackRef.current,
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
		}, [handlePreviewQualitySwitchFailure, onError, previewResolution, rendererPreviewQuality]);

		useEffect(() => {
			const video = videoRef.current;
			if (!video) return;
			void videoPath;
			video.pause();
			video.currentTime = 0;
			allowPlaybackRef.current = false;
			lockedVideoDimensionsRef.current = null;
			setVideoReady(false);
			if (videoReadyRafRef.current) {
				cancelAnimationFrame(videoReadyRafRef.current);
				videoReadyRafRef.current = null;
			}
		}, [videoPath]);

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

				videoSpriteRef.current = null;
			};
		}, [pixiReady, videoReady, onPlayStateChange, onTimeUpdate, layoutVideoContent]);

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
		}, [pixiReady, videoReady]);

		useEffect(() => {
			const overlay = cursorOverlayRef.current;
			if (!overlay) {
				return;
			}

			overlay.setDotRadius(DEFAULT_CURSOR_CONFIG.dotRadius * cursorSize);
			overlay.setSmoothingFactor(cursorSmoothing);
			overlay.setMotionBlur(cursorMotionBlur);
			overlay.setClickBounce(cursorClickBounce);
			overlay.setSway(cursorSway);
			overlay.reset();
		}, [cursorSize, cursorSmoothing, cursorMotionBlur, cursorClickBounce, cursorSway]);

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

				const cursorOverlay = new PixiCursorOverlay({
					dotRadius: DEFAULT_CURSOR_CONFIG.dotRadius * cursorSizeRef.current,
					smoothingFactor: cursorSmoothingRef.current,
					motionBlur: cursorMotionBlurRef.current,
					clickBounce: cursorClickBounceRef.current,
					sway: cursorSwayRef.current,
					cursorPack,
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
			video.currentTime = 0;
			video.pause();
			allowPlaybackRef.current = false;
			currentTimeRef.current = 0;

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

		// Device mockup overlay rendering
		const drawMockupOverlay = useCallback(() => {
			const canvas = mockupCanvasRef.current;
			const container = containerRef.current;
			if (!canvas || !container) return;

			const w = container.clientWidth;
			const h = container.clientHeight;
			if (!w || !h) return;

			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.clearRect(0, 0, w, h);

			if (deviceMockup === "none") return;

			const mask = baseMaskRef.current;
			if (!mask.width || !mask.height) return;

			const videoAR = mask.width / mask.height;
			const screenRect = computeMockupScreenRect(deviceMockup, w, h, videoAR);
			if (!screenRect) return;

			drawDeviceMockup(ctx, deviceMockup, w, h, screenRect);
		}, [deviceMockup]);

		// biome-ignore lint/correctness/useExhaustiveDependencies: padding/borderRadius/cropRegion are component props that affect layout
		useEffect(() => {
			drawMockupOverlay();
		}, [drawMockupOverlay, padding, borderRadius, cropRegion]);

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

		return (
			<div className="relative overflow-hidden w-full h-full">
				{/* Background layer */}
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{
						...backgroundStyle,
						filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : "none",
					}}
				/>
				<div
					ref={containerRef}
					className="absolute inset-0"
					style={{
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
					style={{ display: "none" }}
				/>
				{/* Device mockup overlay */}
				{deviceMockup !== "none" && (
					<canvas
						ref={mockupCanvasRef}
						className="absolute inset-0 pointer-events-none"
						style={{ zIndex: 1 }}
					/>
				)}
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
						{webcamPath && resolvedCameraState && resolvedCameraState.mode !== "hidden" && (
							<WebcamOverlay
								webcamPath={webcamPath}
								webcamRegion={resolvedCameraState.region}
								mode={resolvedCameraState.mode}
								currentTime={currentTime}
								containerWidth={overlayRef.current?.clientWidth || 800}
								containerHeight={overlayRef.current?.clientHeight || 600}
								isSelected={
									webcamSelected ||
									(selectedCameraLayoutId === resolvedCameraState.activeLayoutId &&
										resolvedCameraState.mode === "default")
								}
								mirror={resolvedCameraState.mirror}
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
					className="hidden"
					preload="metadata"
					playsInline
					onLoadedMetadata={handleLoadedMetadata}
					onDurationChange={(e) => {
						onDurationChange(e.currentTarget.duration);
					}}
					onError={(e) => {
						const videoEl = e.currentTarget;
						const mediaError = videoEl.error;
						const code = mediaError?.code ?? "unknown";
						const msg = mediaError?.message ?? "";
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
