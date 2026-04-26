export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;
export type PreviewQuality = "low" | "medium" | "high";

export interface ZoomFocus {
	cx: number; // normalized horizontal center (0-1)
	cy: number; // normalized vertical center (0-1)
}

export type ZoomMode = "static" | "cursor-follow";

export interface CursorFollowTracking {
	deadzone: number;
	lookAheadMs: number;
	maxPanPerSecond: number;
	dwellHoldMs: number;
	textHoldMs: number;
}

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	depth: ZoomDepth;
	focus: ZoomFocus;
	mode?: ZoomMode;
	tracking?: Partial<CursorFollowTracking>;
}

export type CursorType =
	| "arrow"
	| "text"
	| "pointer"
	| "crosshair"
	| "open-hand"
	| "closed-hand"
	| "resize-ew"
	| "resize-ns"
	| "resize-nesw"
	| "not-allowed"
	| "copy"
	| "help"
	| "move"
	| "zoom-in"
	| "zoom-out"
	| "screenshot-selection"
	| "unknown";

export type CursorInteractionType =
	| "move"
	| "mousedown"
	| "mouseup"
	| "drag-start"
	| "drag"
	| "drag-end"
	| "click"
	| "double-click"
	| "right-click"
	| "middle-click";

export type CursorTelemetryOrigin =
	| "hook"
	| "poll"
	| "native-monitor"
	| "normalized"
	| "gap-fill"
	| "synthetic";

export type CursorTelemetryConfidence = "high" | "medium" | "low";

export interface CursorTelemetryBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type CursorCaptureMode = "display" | "window" | "area";

export interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: CursorInteractionType;
	cursorType?: CursorType;
	rawX?: number;
	rawY?: number;
	origin?: CursorTelemetryOrigin;
	confidence?: CursorTelemetryConfidence;
	sourceBounds?: CursorTelemetryBounds;
	displayBounds?: CursorTelemetryBounds;
	sourceDisplayId?: number;
	displayScaleFactor?: number;
	captureMode?: CursorCaptureMode;
	velocityX?: number;
	velocityY?: number;
	heading?: number;
}

export type KeyboardTelemetryEventType = "keydown" | "keyup";
export type KeyboardPlatform = "darwin" | "win32" | "linux";

export interface KeyboardTelemetrySample {
	timeMs: number;
	type: KeyboardTelemetryEventType;
	key: string;
	keycode: number;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

export type KeyboardShortcutPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";
export type KeyboardShortcutTheme = "dark" | "light" | "glass";

export interface KeyboardShortcutCallout {
	id: string;
	startMs: number;
	endMs: number;
	keys: string[];
	labels: string[];
	platform: KeyboardPlatform;
}

export type CursorStyle = "default" | "dot" | "crosshair" | "circle" | "ring";
export type CursorTypeMode = "auto" | "circle";
export type CursorMovementStyle = "slow" | "smooth" | "mellow" | "fast" | "custom";

export interface CursorSpringSettings {
	tension: number;
	friction: number;
	mass: number;
}

export interface CameraSpringSettings {
	tension: number;
	friction: number;
	mass: number;
}

export type CursorPack =
	| "classic"
	| "custom"
	| "neon-glow"
	| "minimal-dot"
	| "glass-frost"
	| "retro-pixel"
	| "aurora-gradient"
	| "outline-bold"
	| "sunset-warm"
	| "midnight-elegance";

export interface CursorVisualSettings {
	size: number;
	smoothing: number;
	motionBlur: number;
	clickBounce: number;
	sway: number;
}

export const CURSOR_TYPE_MODE_OPTIONS: { value: CursorTypeMode; label: string }[] = [
	{ value: "auto", label: "Auto" },
	{ value: "circle", label: "Circle" },
];

export const CURSOR_MOVEMENT_STYLE_OPTIONS: {
	value: CursorMovementStyle;
	label: string;
}[] = [
	{ value: "slow", label: "Slow" },
	{ value: "smooth", label: "Smooth" },
	{ value: "mellow", label: "Mellow" },
	{ value: "fast", label: "Fast" },
	{ value: "custom", label: "Custom" },
];

export const CURSOR_STYLE_OPTIONS: { value: CursorStyle; label: string }[] = [
	{ value: "default", label: "Default" },
	{ value: "dot", label: "Dot" },
	{ value: "crosshair", label: "Crosshair" },
	{ value: "circle", label: "Circle" },
	{ value: "ring", label: "Ring" },
];
export const CURSOR_PACK_OPTIONS: { value: CursorPack; label: string }[] = [
	{ value: "classic", label: "Classic" },
	{ value: "custom", label: "Custom" },
	{ value: "neon-glow", label: "Neon Glow" },
	{ value: "minimal-dot", label: "Minimal Dot" },
	{ value: "glass-frost", label: "Glass Frost" },
	{ value: "retro-pixel", label: "Retro Pixel" },
	{ value: "aurora-gradient", label: "Aurora" },
	{ value: "outline-bold", label: "Outline Bold" },
	{ value: "sunset-warm", label: "Sunset Warm" },
	{ value: "midnight-elegance", label: "Midnight" },
];
export const CURSOR_TYPE_VALUES: CursorType[] = [
	"arrow",
	"text",
	"pointer",
	"crosshair",
	"open-hand",
	"closed-hand",
	"resize-ew",
	"resize-ns",
	"resize-nesw",
	"not-allowed",
	"copy",
	"help",
	"move",
	"zoom-in",
	"zoom-out",
	"screenshot-selection",
	"unknown",
];

export const DEFAULT_ZOOM_MODE: ZoomMode = "static";

export const DEFAULT_CURSOR_FOLLOW_TRACKING: CursorFollowTracking = {
	deadzone: 0.028,
	lookAheadMs: 72,
	maxPanPerSecond: 1.7,
	dwellHoldMs: 180,
	textHoldMs: 360,
};

export const DEFAULT_CURSOR_SIZE = 3.0;
export const DEFAULT_CURSOR_SMOOTHING = 0.67;
export const DEFAULT_CURSOR_MOTION_BLUR = 0.35;
export const DEFAULT_CURSOR_CLICK_BOUNCE = 2.5;
export const DEFAULT_CURSOR_SWAY = 0.25;
export const DEFAULT_CURSOR_STYLE: CursorStyle = "default";
export const DEFAULT_CURSOR_PACK: CursorPack = "classic";
export const DEFAULT_CURSOR_TYPE_MODE: CursorTypeMode = "auto";
export const DEFAULT_CURSOR_TILT = 0.125;
export const DEFAULT_HIDE_CURSOR_WHEN_IDLE = false;
export const DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS = 1500;
export const DEFAULT_SMOOTH_CURSOR_MOVEMENT = true;
export const DEFAULT_CURSOR_MOVEMENT_STYLE: CursorMovementStyle = "custom";
export const DEFAULT_CURSOR_SPRING: CursorSpringSettings = {
	tension: 319.6,
	friction: 60.49333333333333,
	mass: 1.0396666666666667,
};
export const DEFAULT_CAMERA_SPRING: CameraSpringSettings = {
	tension: 170,
	friction: 26,
	mass: 1.0,
};
export const DEFAULT_HIGH_QUALITY_SVG_CURSORS = true;
export const DEFAULT_CURSOR_COLOR = "#FFFFFF";
export const DEFAULT_CURSOR_OPACITY = 1.0;
export const DEFAULT_CLICK_HIGHLIGHT_COLOR = "#f59e0b";
export const DEFAULT_CLICK_HIGHLIGHT_SIZE = 1.0;
export const DEFAULT_CLICK_HIGHLIGHT_OPACITY = 0.5;
export const DEFAULT_CURSOR_TRAIL_LENGTH = 0;
export const DEFAULT_CURSOR_TRAIL_OPACITY = 0.3;
export type DeviceMockup =
	| "none"
	| "macbook-pro"
	| "macbook-air"
	| "imac"
	| "iphone"
	| "ipad"
	| "android-phone"
	| "browser-window"
	| "monitor";

export const DEFAULT_DEVICE_MOCKUP: DeviceMockup = "none";

export const DEVICE_MOCKUP_OPTIONS: { value: DeviceMockup; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "macbook-pro", label: "MacBook Pro" },
	{ value: "macbook-air", label: "MacBook Air" },
	{ value: "imac", label: "iMac" },
	{ value: "iphone", label: "iPhone" },
	{ value: "ipad", label: "iPad" },
	{ value: "android-phone", label: "Android" },
	{ value: "browser-window", label: "Browser" },
	{ value: "monitor", label: "Monitor" },
];

export const DEFAULT_ZOOM_MOTION_BLUR = 0.35;
export const DEFAULT_PREVIEW_QUALITY: PreviewQuality = "medium";
export const PREVIEW_QUALITY_OPTIONS: Array<{ value: PreviewQuality; label: string }> = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];
export const DEFAULT_SHOW_KEYBOARD_SHORTCUTS = false;
export const DEFAULT_KEYBOARD_SHORTCUT_POSITION: KeyboardShortcutPosition = "bottom-center";
export const DEFAULT_KEYBOARD_SHORTCUT_THEME: KeyboardShortcutTheme = "dark";
export const DEFAULT_KEYBOARD_SHORTCUT_SCALE = 1;
export const DEFAULT_KEYBOARD_SHORTCUT_OPACITY = 1;
export const DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS = 1350;
export const DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE = 1;

export const KEYBOARD_SHORTCUT_POSITION_OPTIONS: Array<{
	value: KeyboardShortcutPosition;
	label: string;
}> = [
	{ value: "top-left", label: "Top Left" },
	{ value: "top-center", label: "Top Center" },
	{ value: "top-right", label: "Top Right" },
	{ value: "bottom-left", label: "Bottom Left" },
	{ value: "bottom-center", label: "Bottom Center" },
	{ value: "bottom-right", label: "Bottom Right" },
];

export const KEYBOARD_SHORTCUT_THEME_OPTIONS: Array<{
	value: KeyboardShortcutTheme;
	label: string;
}> = [
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
	{ value: "glass", label: "Glass" },
];

export interface TrimRegion {
	id: string;
	startMs: number;
	endMs: number;
}

export type AnnotationType = "text" | "image" | "figure" | "blur";

export type ArrowDirection =
	| "up"
	| "down"
	| "left"
	| "right"
	| "up-right"
	| "up-left"
	| "down-right"
	| "down-left";

export interface BlurData {
	blurAmount: number;
	shape: "rectangle" | "circle";
}

export const DEFAULT_BLUR_DATA: BlurData = {
	blurAmount: 10,
	shape: "rectangle",
};

export interface FigureData {
	arrowDirection: ArrowDirection;
	color: string;
	strokeWidth: number;
}

export interface AnnotationPosition {
	x: number;
	y: number;
}

export interface AnnotationSize {
	width: number;
	height: number;
}

export type WebcamAnchor = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "free";

export interface AnnotationTextStyle {
	color: string;
	backgroundColor: string;
	fontSize: number; // pixels
	fontFamily: string;
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
	textAlign: "left" | "center" | "right";
}

function getDefaultAnnotationFontFamily() {
	if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
		return '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif';
	}

	return "Inter, system-ui, sans-serif";
}

export interface AnnotationRegion {
	id: string;
	startMs: number;
	endMs: number;
	type: AnnotationType;
	content: string; // Legacy - still used for current type
	textContent?: string; // Separate storage for text
	imageContent?: string; // Separate storage for image data URL
	position: AnnotationPosition;
	size: AnnotationSize;
	style: AnnotationTextStyle;
	zIndex: number;
	figureData?: FigureData;
	blurData?: BlurData;
}

export const DEFAULT_ANNOTATION_POSITION: AnnotationPosition = {
	x: 50,
	y: 50,
};

export const DEFAULT_ANNOTATION_SIZE: AnnotationSize = {
	width: 30,
	height: 20,
};

export const DEFAULT_ANNOTATION_STYLE: AnnotationTextStyle = {
	color: "#ffffff",
	backgroundColor: "transparent",
	fontSize: 32,
	fontFamily: getDefaultAnnotationFontFamily(),
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "center",
};

export const DEFAULT_FIGURE_DATA: FigureData = {
	arrowDirection: "right",
	color: "#F59E0B",
	strokeWidth: 4,
};

export interface WebcamRegion {
	position: { x: number; y: number }; // percentage 0-100
	size: { width: number; height: number }; // percentage 0-100
	anchor: WebcamAnchor;
	marginPct: number;
	shape: "circle" | "rectangle" | "square";
	borderRadius: number;
	opacity: number; // 0-1
	borderWidth: number;
	borderColor: string;
}

export type WebcamBackgroundMode = "none" | "blur" | "solid" | "image";
export type WebcamShadowStyle = "soft" | "lifted" | "spotlight" | "none";
export type WebcamMotionPreset = "focused" | "smooth" | "instant";
export type WebcamStylePresetId =
	| "classic-circle"
	| "presenter-soft"
	| "floating-card"
	| "spotlight"
	| "fullscreen-commentary"
	| "custom";
export type WebcamEffectFallbackState =
	| "none"
	| "segmentation-unavailable"
	| "reduced-segmentation-rate"
	| "reduced-background-sampling"
	| "replacement-disabled"
	| "raw-webcam-only";
export type WebcamRenderQualityTier =
	| "full-preview"
	| "reduced-cadence"
	| "reduced-preview-resolution"
	| "simplified-preview-effects"
	| "raw-webcam-only";
export type WebcamDegradationStep = WebcamRenderQualityTier | "export-reference";
export type WebcamSegmentationProviderStatus = "not-required" | "ready" | "unavailable";
export type WebcamPreviewMode = "exact" | "performance" | "power-saving";
export type CameraPreviewSize = "small" | "medium" | "large";
export type CameraPreviewCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type CameraPreviewShape = "rounded-rect" | "circle";

export interface WebcamEffects {
	presetId: WebcamStylePresetId;
	backgroundMode: WebcamBackgroundMode;
	backgroundBlurStrength: number;
	backgroundColor: string;
	backgroundImagePath?: string;
	edgeFeather: number;
	portraitScale: number;
	portraitOffset: { x: number; y: number };
	shadowStyle: WebcamShadowStyle;
	shadowStrength: number;
	shadowColor: string;
	exposure: number;
	contrast: number;
	saturation: number;
	warmth: number;
	noiseReduction: number;
	faceAwareFraming: boolean;
	subtleAvoidance: boolean;
}

export interface WebcamHealthMetrics {
	targetFps: number;
	observedFps: number;
	segmentationFps: number;
	droppedFrameRatio: number;
	effectFallbackState: WebcamEffectFallbackState;
	previewMode?: WebcamPreviewMode;
	configuredBackgroundMode?: WebcamBackgroundMode;
	appliedBackgroundMode?: WebcamBackgroundMode;
	degradationStep?: WebcamDegradationStep;
	previewQualityTier?: WebcamRenderQualityTier;
	segmentationWorkingWidth?: number;
	segmentationWorkingHeight?: number;
	segmentationProviderStatus?: WebcamSegmentationProviderStatus;
	renderResolutionScale?: number;
	driftMs?: number;
	renderLatencyMs?: number;
	frameQueueDepth?: number;
	segmentCompatibilityWarnings?: string[];
	fallbackReason?: string;
}

export const DEFAULT_WEBCAM_REGION: WebcamRegion = {
	position: { x: 78, y: 78 },
	size: { width: 18, height: 18 },
	anchor: "bottom-right",
	marginPct: 4,
	shape: "circle",
	borderRadius: 50,
	opacity: 1,
	borderWidth: 2,
	borderColor: "#ffffff",
};

export const DEFAULT_WEBCAM_EFFECTS: WebcamEffects = {
	presetId: "classic-circle",
	backgroundMode: "none",
	backgroundBlurStrength: 14,
	backgroundColor: "#111827",
	backgroundImagePath: undefined,
	edgeFeather: 10,
	portraitScale: 1,
	portraitOffset: { x: 0, y: 0 },
	shadowStyle: "soft",
	shadowStrength: 0.5,
	shadowColor: "#000000",
	exposure: 0,
	contrast: 1,
	saturation: 1,
	warmth: 0,
	noiseReduction: 0,
	faceAwareFraming: false,
	subtleAvoidance: true,
};

export const DEFAULT_WEBCAM_HEALTH_METRICS: WebcamHealthMetrics = {
	targetFps: 0,
	observedFps: 0,
	segmentationFps: 0,
	droppedFrameRatio: 0,
	effectFallbackState: "none",
};
export const DEFAULT_WEBCAM_PREVIEW_MODE: WebcamPreviewMode = "performance";

export interface RecommendedWebcamDefaults {
	region: WebcamRegion;
	effects: WebcamEffects;
	cameraSizeDuringZoom: number;
	showWebcam: boolean;
	mirrorWebcam: boolean;
	previewSize: CameraPreviewSize;
	previewCorner: CameraPreviewCorner;
	previewShape: CameraPreviewShape;
}

function resolveAspectRatioValue(aspectRatio?: string): number | null {
	const normalized = aspectRatio?.trim().toLowerCase();
	if (!normalized || !normalized.includes(":")) {
		return null;
	}

	const [rawWidth, rawHeight] = normalized.split(":");
	const width = Number.parseFloat(rawWidth);
	const height = Number.parseFloat(rawHeight);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return null;
	}

	return width / height;
}

function isCompactAspectRatio(aspectRatio?: string) {
	const ratio = resolveAspectRatioValue(aspectRatio);
	return ratio !== null && ratio <= 1.05;
}

export function getRecommendedWebcamDefaults(aspectRatio?: string): RecommendedWebcamDefaults {
	const useCompactDefaults = isCompactAspectRatio(aspectRatio);

	if (useCompactDefaults) {
		return {
			region: {
				...DEFAULT_WEBCAM_REGION,
				position: { ...DEFAULT_WEBCAM_REGION.position },
				size: { width: 22, height: 22 },
				anchor: "top-right",
				shape: "rectangle",
				borderWidth: 0,
				borderRadius: 24,
			},
			effects: {
				...DEFAULT_WEBCAM_EFFECTS,
				portraitOffset: { ...DEFAULT_WEBCAM_EFFECTS.portraitOffset },
				presetId: "presenter-soft",
				backgroundMode: "blur",
				backgroundBlurStrength: 18,
				portraitScale: 1.06,
				edgeFeather: 14,
				shadowStyle: "lifted",
				shadowStrength: 0.75,
			},
			cameraSizeDuringZoom: 0.62,
			showWebcam: true,
			mirrorWebcam: false,
			previewSize: DEFAULT_CAMERA_PREVIEW_SIZE,
			previewCorner: DEFAULT_CAMERA_PREVIEW_CORNER,
			previewShape: "rounded-rect",
		};
	}

	return {
		region: {
			...DEFAULT_WEBCAM_REGION,
			position: { ...DEFAULT_WEBCAM_REGION.position },
			size: { width: 18, height: 18 },
			anchor: "top-right",
			shape: "rectangle",
			borderWidth: 1,
			borderRadius: 20,
			borderColor: "#e2e8f0",
		},
		effects: {
			...DEFAULT_WEBCAM_EFFECTS,
			portraitOffset: { ...DEFAULT_WEBCAM_EFFECTS.portraitOffset },
			presetId: "floating-card",
			backgroundMode: "solid",
			backgroundColor: "#0f172a",
			portraitScale: 1.08,
			edgeFeather: 16,
			shadowStyle: "lifted",
			shadowStrength: 0.85,
		},
		cameraSizeDuringZoom: 0.68,
		showWebcam: true,
		mirrorWebcam: false,
		previewSize: DEFAULT_CAMERA_PREVIEW_SIZE,
		previewCorner: DEFAULT_CAMERA_PREVIEW_CORNER,
		previewShape: "rounded-rect",
	};
}

export function getRecommendedWebcamRegion(aspectRatio?: string): WebcamRegion {
	return getRecommendedWebcamDefaults(aspectRatio).region;
}

export function getRecommendedWebcamEffects(aspectRatio?: string): WebcamEffects {
	return getRecommendedWebcamDefaults(aspectRatio).effects;
}

export type CameraLayoutMode = "default" | "fullscreen" | "hidden";

export interface CameraLayoutRegion {
	id: string;
	startMs: number;
	endMs: number;
	mode: CameraLayoutMode;
	regionOverride?: Partial<WebcamRegion>;
	transitionInMs?: number;
	transitionOutMs?: number;
	motionPreset?: WebcamMotionPreset;
}

export interface WebcamCaptureProfile {
	width: number;
	height: number;
	frameRate: number;
	aspectRatio: number;
}

export const WEBCAM_RENDER_PIPELINE_VERSION = 2;

export interface WebcamSessionMetadata {
	sessionCaptureProfile?: WebcamCaptureProfile | null;
	captureProfile?: WebcamCaptureProfile | null;
	segmentOffsetsMs?: number[];
	segmentProfiles?: Array<WebcamCaptureProfile | null>;
	segmentCompatibilityMode?: "copy" | "normalized";
	renderPipelineVersion: number;
}

export interface CameraSessionState {
	enabled: boolean;
	deviceId?: string;
	previewVisible: boolean;
	previewMirrored: boolean;
	previewSize: CameraPreviewSize;
	previewCorner: CameraPreviewCorner;
	previewShape: CameraPreviewShape;
	resolvedCaptureProfile?: WebcamCaptureProfile;
}

export const DEFAULT_CAMERA_LAYOUT_MODE: CameraLayoutMode = "default";
export const DEFAULT_CAMERA_SIZE_DURING_ZOOM = 0.72;
export const CAMERA_ZOOM_SCALE_DISABLED = 1;
export const DEFAULT_CAMERA_LAYOUT_TRANSITION_IN_MS = 260;
export const DEFAULT_CAMERA_LAYOUT_TRANSITION_OUT_MS = 220;
export const DEFAULT_CAMERA_LAYOUT_MOTION_PRESET: WebcamMotionPreset = "focused";
export const DEFAULT_CAMERA_PREVIEW_SIZE: CameraPreviewSize = "medium";
export const DEFAULT_CAMERA_PREVIEW_CORNER: CameraPreviewCorner = "top-right";
export const DEFAULT_CAMERA_PREVIEW_SHAPE: CameraPreviewShape = "rounded-rect";

export interface CropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const DEFAULT_CROP_REGION: CropRegion = {
	x: 0,
	y: 0,
	width: 1,
	height: 1,
};

export type AudioSourceType = "built-in" | "file";

export interface AudioRegionSource {
	sourceType: AudioSourceType;
	assetId?: string;
	audioPath?: string;
}

export interface AudioTrackSelection extends AudioRegionSource {
	durationMs?: number;
	defaultVolume?: number;
	loop?: boolean;
}

export interface AudioRegion extends AudioRegionSource {
	id: string;
	startMs: number;
	endMs: number;
	volume: number;
	fadeInMs: number;
	fadeOutMs: number;
	loop: boolean;
}

export const DEFAULT_AUDIO_REGION_VOLUME = 0.18;
export const DEFAULT_AUDIO_FADE_IN_MS = 250;
export const DEFAULT_AUDIO_FADE_OUT_MS = 600;

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1.25 | 1.5 | 1.75 | 2;

export interface SpeedRegion {
	id: string;
	startMs: number;
	endMs: number;
	speed: PlaybackSpeed;
}

export const SPEED_OPTIONS: Array<{ speed: PlaybackSpeed; label: string }> = [
	{ speed: 0.25, label: "0.25×" },
	{ speed: 0.5, label: "0.5×" },
	{ speed: 0.75, label: "0.75×" },
	{ speed: 1.25, label: "1.25×" },
	{ speed: 1.5, label: "1.5×" },
	{ speed: 1.75, label: "1.75×" },
	{ speed: 2, label: "2×" },
];

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1.5;

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
	1: 1.25,
	2: 1.5,
	3: 1.8,
	4: 2.2,
	5: 3.5,
	6: 5.0,
};

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;

// ── Captions ──

export type CaptionStylePreset = "classic" | "boxed" | "karaoke" | "outline" | "neon" | "minimal";
export type CaptionAnimationMode =
	| "static"
	| "active-word"
	| "fade"
	| "pop"
	| "typewriter"
	| "karaoke-fill";
export type CaptionBackend = "whisper.cpp" | "apple-speech";
export type CaptionBackendPreference = "auto" | CaptionBackend;
export type CaptionModel = "base" | "small" | "medium";
export type CaptionTrackStatus = "idle" | "generating" | "ready" | "error";
export type CaptionSourceAudio = "microphone" | "mixed";

export const CAPTION_ANIMATION_MODES: CaptionAnimationMode[] = [
	"static",
	"active-word",
	"fade",
	"pop",
	"typewriter",
	"karaoke-fill",
];

export interface CaptionStyle {
	preset: CaptionStylePreset;
	fontSize: number;
	fontFamily: string;
	fontWeight: "normal" | "bold" | "800";
	fontStyle: "normal" | "italic";
	color: string;
	highlightColor: string;
	backgroundColor: string;
	backgroundOpacity: number;
	borderRadius: number;
	outlineColor: string;
	outlineWidth: number;
	shadowColor: string;
	shadowBlur: number;
	shadowOffsetY: number;
	letterSpacing: number;
	lineHeight: number;
	textTransform: "none" | "uppercase";
}

export interface CaptionWord {
	id: string;
	text: string;
	startMs: number;
	endMs: number;
	confidence?: number;
}

export interface CaptionSegment {
	id: string;
	startMs: number;
	endMs: number;
	text: string;
	words: CaptionWord[];
	source?: "manual" | "generated";
}

export type CaptionRegion = CaptionSegment;

export type CaptionPosition = "top" | "center" | "bottom";

export interface CaptionPositionOverride {
	xPercent: number;
	yPercent: number;
}

export interface CaptionSettings {
	style: CaptionStyle;
	position: CaptionPosition;
	positionOverride: CaptionPositionOverride | null;
	enabled: boolean;
	animationMode: CaptionAnimationMode;
	maxLines: number;
	maxWordsPerLine: number;
	safeAreaInset: number;
	showTranscriptPanel: boolean;
}

export interface CaptionUserPreset {
	id: string;
	name: string;
	createdAt: string;
	style: CaptionStyle;
	animationMode: CaptionAnimationMode;
}

export interface CaptionTrack {
	backend: CaptionBackend;
	model: CaptionModel;
	language: string;
	prompt: string;
	sourceAudio: CaptionSourceAudio;
	sourceAudioPath?: string;
	status: CaptionTrackStatus;
	error?: string;
	generatedAt?: string;
	segments: CaptionSegment[];
}

export interface CaptionGenerationOptions {
	preferredBackend: CaptionBackendPreference;
	model: CaptionModel;
	language: string;
	prompt: string;
	preferredSourceAudio: CaptionSourceAudio;
}

export interface CaptionGenerationProgress {
	stage: "bootstrap" | "model" | "audio" | "transcribe" | "align" | "complete";
	percentage: number;
	message: string;
}

export interface CaptionModelStatus {
	ready: boolean;
	availableModels: CaptionModel[];
	downloadedModels: CaptionModel[];
	availableSourceAudios: CaptionSourceAudio[];
	availableBackends: CaptionBackend[];
	recommendedBackend: CaptionBackend;
	backendMessages: Partial<Record<CaptionBackend, string>>;
}

export interface CaptionGenerationResult {
	track: CaptionTrack;
	progress?: CaptionGenerationProgress;
}

function getDefaultCaptionFontFamily() {
	if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
		return '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif';
	}
	return "Inter, system-ui, sans-serif";
}

const BASE_CAPTION_STYLE: Omit<CaptionStyle, "preset"> = {
	fontSize: 28,
	fontFamily: getDefaultCaptionFontFamily(),
	fontWeight: "bold",
	fontStyle: "normal",
	color: "#ffffff",
	highlightColor: "#F59E0B",
	backgroundColor: "#000000",
	backgroundOpacity: 0.7,
	borderRadius: 6,
	outlineColor: "#000000",
	outlineWidth: 0,
	shadowColor: "#000000",
	shadowBlur: 0,
	shadowOffsetY: 0,
	letterSpacing: 0,
	lineHeight: 1.3,
	textTransform: "none",
};

export const CAPTION_STYLE_PRESETS: Record<CaptionStylePreset, CaptionStyle> = {
	classic: {
		...BASE_CAPTION_STYLE,
		preset: "classic",
		fontSize: 28,
		color: "#ffffff",
		highlightColor: "#F59E0B",
		backgroundColor: "#000000",
		backgroundOpacity: 0.7,
	},
	boxed: {
		...BASE_CAPTION_STYLE,
		preset: "boxed",
		fontSize: 26,
		fontWeight: "bold",
		color: "#ffffff",
		highlightColor: "#ffffff",
		backgroundColor: "#F59E0B",
		backgroundOpacity: 0.95,
		borderRadius: 10,
		textTransform: "uppercase",
	},
	karaoke: {
		...BASE_CAPTION_STYLE,
		preset: "karaoke",
		fontSize: 32,
		fontWeight: "800",
		color: "#ffffff",
		highlightColor: "#F59E0B",
		backgroundColor: "#000000",
		backgroundOpacity: 0.55,
		borderRadius: 8,
		outlineColor: "#000000",
		outlineWidth: 2,
		textTransform: "uppercase",
	},
	outline: {
		...BASE_CAPTION_STYLE,
		preset: "outline",
		fontSize: 30,
		fontWeight: "bold",
		color: "#ffffff",
		highlightColor: "#F59E0B",
		backgroundColor: "transparent",
		backgroundOpacity: 0,
		outlineColor: "#000000",
		outlineWidth: 3,
	},
	neon: {
		...BASE_CAPTION_STYLE,
		preset: "neon",
		fontSize: 28,
		fontWeight: "800",
		color: "#00FF88",
		highlightColor: "#ffffff",
		backgroundColor: "#000000",
		backgroundOpacity: 0.4,
		outlineColor: "#00FF88",
		outlineWidth: 1,
		shadowColor: "#00FF88",
		shadowBlur: 12,
		textTransform: "uppercase",
	},
	minimal: {
		...BASE_CAPTION_STYLE,
		preset: "minimal",
		fontSize: 24,
		fontWeight: "normal",
		color: "#ffffff",
		highlightColor: "#F59E0B",
		backgroundColor: "transparent",
		backgroundOpacity: 0,
		outlineColor: "#000000",
		outlineWidth: 1,
	},
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { ...CAPTION_STYLE_PRESETS.classic };

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
	style: DEFAULT_CAPTION_STYLE,
	position: "bottom",
	positionOverride: null,
	enabled: false,
	animationMode: "active-word",
	maxLines: 2,
	maxWordsPerLine: 6,
	safeAreaInset: 8,
	showTranscriptPanel: true,
};

export const DEFAULT_CAPTION_GENERATION_OPTIONS: CaptionGenerationOptions = {
	preferredBackend: "auto",
	model: "medium",
	language: "auto",
	prompt: "",
	preferredSourceAudio: "microphone",
};

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
	return {
		cx: clamp(focus.cx, 0, 1),
		cy: clamp(focus.cy, 0, 1),
	};
}

function clamp(value: number, min: number, max: number) {
	if (Number.isNaN(value)) return (min + max) / 2;
	return Math.min(max, Math.max(min, value));
}
