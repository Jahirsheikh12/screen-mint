import type {
	AnnotationRegion,
	AudioRegion,
	CameraLayoutRegion,
	CaptionRegion,
	CaptionSettings,
	CropRegion,
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
	SpeedRegion,
	TrimRegion,
	WebcamEffects,
	WebcamRegion,
	ZoomRegion,
	ZoomTemporalBlurSettings,
	ZoomTimingSettings,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type {
	ExportDetails,
	ExportFormat,
	ExportProgress,
	GifColorCount,
	GifDitherMode,
	GifMotionSensitivity,
	VideoBitrateMode,
} from "./types";

export type ExportV2Engine =
	| "direct-native"
	| "native-composed"
	| "composited-hardware"
	| "legacy-renderer";
export type ExportV2HardwareAcceleration = "hardware" | "software" | "unknown";
export type ExportV2Destination = "file" | "clipboard" | "recordings";

export interface ExportV2Capabilities {
	enabled: boolean;
	platform: NodeJS.Platform | string;
	ffmpegPath?: string;
	videoEncoders: ExportV2EncoderCandidate[];
	gif: {
		ffmpegPalettePipeline: boolean;
	};
	warnings: string[];
}

export interface ExportV2EncoderCandidate {
	name: string;
	label: string;
	hardwareAcceleration: ExportV2HardwareAcceleration;
	available: boolean;
}

export interface ExportV2EngineSignals {
	format: ExportFormat;
	hasVisualComposition: boolean;
	hasExternalAudio: boolean;
	hasWebcam: boolean;
	hasCaptions: boolean;
	hasAnnotations: boolean;
	hasCursorOverlay: boolean;
	hasKeyboardCallouts: boolean;
	hasSpeedRegions: boolean;
	hasTrimRegions: boolean;
}

export interface ExportV2EngineSelection {
	engine: ExportV2Engine;
	reason: string;
}

export interface ExportV2TrimRegion {
	startMs: number;
	endMs: number;
}

export interface ExportV2SpeedRegion {
	startMs: number;
	endMs: number;
	speed: number;
}

export interface ExportV2StartRequest {
	jobId?: string;
	sourcePath: string;
	fileName: string;
	destination: ExportV2Destination;
	format: ExportFormat;
	width: number;
	height: number;
	frameRate: number;
	bitrate?: number;
	bitrateMode?: VideoBitrateMode;
	durationMs?: number;
	trimRegions?: ExportV2TrimRegion[];
	speedRegions?: ExportV2SpeedRegion[];
	outputPath?: string;
	compositionPayload?: ExportCompositionPayload;
	audioPlan?: ExportV2AudioPlan;
	validationPolicy?: "strict" | "warn";
	gif?: {
		colorCount: GifColorCount;
		ditherMode: GifDitherMode;
		motionSensitivity: GifMotionSensitivity;
		loop: boolean;
		dedupeFrames: boolean;
	};
	selection: ExportV2EngineSelection;
}

export interface ExportV2GifPipeStartRequest {
	jobId?: string;
	outputPath: string;
	width: number;
	height: number;
	frameRate: number;
	durationMs?: number;
	gif: {
		colorCount: GifColorCount;
		ditherMode: GifDitherMode;
		motionSensitivity: GifMotionSensitivity;
		loop: boolean;
		dedupeFrames: boolean;
	};
}

export interface ExportV2AudioPlan {
	mode: "none" | "source" | "timeline-mix";
	expectAudio: boolean;
	sourcePath?: string;
	audioRegionCount?: number;
	hasSpeedRegions?: boolean;
}

export interface ExportCompositionPayload {
	videoUrl: string;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions?: TrimRegion[];
	speedRegions?: SpeedRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	frameShadowSize?: number;
	frameShadowOpacity?: number;
	frameShadowBlur?: number;
	backgroundBlur: number;
	hideBackground?: boolean;
	zoomMotionBlur?: number;
	zoomTemporalBlur?: ZoomTemporalBlurSettings;
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
	deviceMockup?: DeviceMockup;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	borderRadius?: number;
	padding?: number;
	videoPadding?: number;
	cropRegion: CropRegion;
	aspectRatio?: AspectRatio;
	annotationRegions?: AnnotationRegion[];
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
	cameraSpring?: import("@/components/video-editor/types").CameraSpringSettings;
	audioRegions?: AudioRegion[];
	previewWidth?: number;
	previewHeight?: number;
	webcamPath?: string | null;
	webcamRegion?: WebcamRegion;
	webcamEffects?: WebcamEffects;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	captionRegions?: CaptionRegion[];
	captionSettings?: CaptionSettings;
	sourceWidth?: number;
	sourceHeight?: number;
	forceFFmpegDecoder?: boolean;
}

export interface ExportV2Progress extends ExportProgress {
	jobId: string;
	engine: ExportV2Engine;
}

export interface ExportV2StartResult {
	success: boolean;
	jobId?: string;
	path?: string;
	copiedToClipboard?: boolean;
	details?: ExportDetails;
	error?: string;
	canceled?: boolean;
	fallbackToLegacy?: boolean;
}

export function selectExportV2Engine(signals: ExportV2EngineSignals): ExportV2EngineSelection {
	const requiresComposition =
		signals.hasVisualComposition ||
		signals.hasExternalAudio ||
		signals.hasWebcam ||
		signals.hasCaptions ||
		signals.hasAnnotations ||
		signals.hasCursorOverlay ||
		signals.hasKeyboardCallouts ||
		signals.hasSpeedRegions;

	if (requiresComposition) {
		const mayUseNativeComposition =
			signals.format === "mp4" &&
			!signals.hasExternalAudio &&
			!signals.hasWebcam &&
			!signals.hasKeyboardCallouts &&
			!signals.hasSpeedRegions;

		if (mayUseNativeComposition) {
			return {
				engine: "native-composed",
				reason:
					"Timeline uses common ScreenMint composition effects that can be attempted with native FFmpeg filters.",
			};
		}

		return {
			engine: "composited-hardware",
			reason: "Timeline uses ScreenMint visual composition, so v2 keeps the PIXI renderer path.",
		};
	}

	if (signals.format === "gif") {
		return {
			engine: "direct-native",
			reason: "Simple GIF export can use FFmpeg palette generation directly.",
		};
	}

	return {
		engine: "direct-native",
		reason: "Simple MP4 export can use FFmpeg native H.264 encoding directly.",
	};
}

export function shouldUseDirectNativeExport(selection: ExportV2EngineSelection): boolean {
	return selection.engine === "direct-native";
}
