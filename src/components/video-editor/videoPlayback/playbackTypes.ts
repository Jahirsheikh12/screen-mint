import type { Application, Container, Sprite } from "pixi.js";
import type React from "react";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { PixelRect } from "../cameraLayouts";
import type {
	AnnotationRegion,
	CameraLayoutRegion,
	CameraSpringSettings,
	CaptionPositionOverride,
	CaptionRegion,
	CaptionSettings,
	CropRegion,
	CursorClickStyleSettings,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorStyle,
	CursorTelemetryPoint,
	CursorTypeMode,
	DeviceMockup,
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	PaddingValue,
	PreviewQuality,
	SpeedRegion,
	TrimRegion,
	WebcamEffects,
	WebcamHealthMetrics,
	WebcamPreviewMode,
	WebcamRegion,
	ZoomFocus,
	ZoomRegion,
	ZoomTimingSettings,
} from "../types";
import type { PreviewHoldReason } from "./previewHoldState";

export interface VideoPlaybackProps {
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
	zoomTiming?: Partial<ZoomTimingSettings>;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	deviceMockup?: DeviceMockup;
	borderRadius?: number;
	padding?: PaddingValue;
	cropRegion?: CropRegion;
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
	clickEffectsEnabled?: boolean;
	clickHighlightColor?: string;
	clickHighlightSize?: number;
	clickHighlightOpacity?: number;
	cursorClickStyle?: CursorClickStyleSettings;
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
	cameraSpring?: CameraSpringSettings;
	webcamPath?: string | null;
	webcamRegion?: WebcamRegion;
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
	captionRegions?: CaptionRegion[];
	captionSettings?: CaptionSettings;
	isEditingCaptionPosition?: boolean;
	onCaptionPositionOverrideChange?: (override: CaptionPositionOverride | null) => void;
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

export interface WebcamPreviewRects {
	stage: PixelRect;
	composition: PixelRect;
	content: PixelRect;
}
