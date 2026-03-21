export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZoomFocus {
	cx: number; // normalized horizontal center (0-1)
	cy: number; // normalized vertical center (0-1)
}

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	depth: ZoomDepth;
	focus: ZoomFocus;
}

export interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: "move" | "click" | "double-click" | "right-click" | "middle-click" | "mouseup";
	cursorType?:
		| "arrow"
		| "text"
		| "pointer"
		| "crosshair"
		| "open-hand"
		| "closed-hand"
		| "resize-ew"
		| "resize-ns"
		| "not-allowed";
}

export interface CursorVisualSettings {
	size: number;
	smoothing: number;
	motionBlur: number;
	clickBounce: number;
	sway: number;
}

export const DEFAULT_CURSOR_SIZE = 3.0;
export const DEFAULT_CURSOR_SMOOTHING = 0.67;
export const DEFAULT_CURSOR_MOTION_BLUR = 0.35;
export const DEFAULT_CURSOR_CLICK_BOUNCE = 2.5;
export const DEFAULT_CURSOR_SWAY = 0.25;
export const DEFAULT_ZOOM_MOTION_BLUR = 0.35;

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

export type WebcamAnchor =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "free";

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
	color: "#10B981",
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

export function getRecommendedWebcamRegion(aspectRatio?: string): WebcamRegion {
	const normalized = aspectRatio?.trim().toLowerCase();
	let size = DEFAULT_WEBCAM_REGION.size.width;

	if (normalized && normalized.includes(":")) {
		const [rawWidth, rawHeight] = normalized.split(":");
		const width = Number.parseFloat(rawWidth);
		const height = Number.parseFloat(rawHeight);
		if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
			const ratio = width / height;
			size = ratio <= 1.05 ? 22 : 18;
		}
	}

	return {
		...DEFAULT_WEBCAM_REGION,
		position: { ...DEFAULT_WEBCAM_REGION.position },
		size: { width: size, height: size },
	};
}

export type CameraLayoutMode = "default" | "fullscreen" | "hidden";

export interface CameraLayoutRegion {
	id: string;
	startMs: number;
	endMs: number;
	mode: CameraLayoutMode;
	regionOverride?: Partial<WebcamRegion>;
}

export interface CameraSessionState {
	enabled: boolean;
	deviceId?: string;
	previewVisible: boolean;
	previewMirrored: boolean;
}

export const DEFAULT_CAMERA_LAYOUT_MODE: CameraLayoutMode = "default";
export const DEFAULT_CAMERA_SIZE_DURING_ZOOM = 0.72;
export const CAMERA_ZOOM_SCALE_DISABLED = 1;

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

export interface AudioRegion {
	id: string;
	startMs: number;
	endMs: number;
	audioPath: string;
	volume: number;
}

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
export type CaptionAnimationMode = "static" | "active-word";
export type CaptionBackend = "whisper.cpp" | "apple-speech";
export type CaptionBackendPreference = "auto" | CaptionBackend;
export type CaptionModel = "base" | "small" | "medium";
export type CaptionTrackStatus = "idle" | "generating" | "ready" | "error";
export type CaptionSourceAudio = "microphone" | "mixed";

export interface CaptionStyle {
	preset: CaptionStylePreset;
	fontSize: number;
	fontFamily: string;
	fontWeight: "normal" | "bold" | "800";
	color: string;
	backgroundColor: string;
	backgroundOpacity: number;
	outlineColor: string;
	outlineWidth: number;
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

export interface CaptionSettings {
	style: CaptionStyle;
	position: CaptionPosition;
	enabled: boolean;
	animationMode: CaptionAnimationMode;
	maxLines: number;
	maxWordsPerLine: number;
	safeAreaInset: number;
	showTranscriptPanel: boolean;
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

export const CAPTION_STYLE_PRESETS: Record<CaptionStylePreset, CaptionStyle> = {
	classic: {
		preset: "classic",
		fontSize: 28,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "bold",
		color: "#ffffff",
		backgroundColor: "#000000",
		backgroundOpacity: 0.7,
		outlineColor: "#000000",
		outlineWidth: 0,
		textTransform: "none",
	},
	boxed: {
		preset: "boxed",
		fontSize: 26,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "bold",
		color: "#ffffff",
		backgroundColor: "#10B981",
		backgroundOpacity: 0.9,
		outlineColor: "#000000",
		outlineWidth: 0,
		textTransform: "uppercase",
	},
	karaoke: {
		preset: "karaoke",
		fontSize: 32,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "800",
		color: "#FFD700",
		backgroundColor: "#000000",
		backgroundOpacity: 0.5,
		outlineColor: "#000000",
		outlineWidth: 2,
		textTransform: "uppercase",
	},
	outline: {
		preset: "outline",
		fontSize: 30,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "bold",
		color: "#ffffff",
		backgroundColor: "transparent",
		backgroundOpacity: 0,
		outlineColor: "#000000",
		outlineWidth: 3,
		textTransform: "none",
	},
	neon: {
		preset: "neon",
		fontSize: 28,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "800",
		color: "#00FF88",
		backgroundColor: "#000000",
		backgroundOpacity: 0.4,
		outlineColor: "#00FF88",
		outlineWidth: 1,
		textTransform: "uppercase",
	},
	minimal: {
		preset: "minimal",
		fontSize: 24,
		fontFamily: getDefaultCaptionFontFamily(),
		fontWeight: "normal",
		color: "#ffffff",
		backgroundColor: "transparent",
		backgroundOpacity: 0,
		outlineColor: "#000000",
		outlineWidth: 1,
		textTransform: "none",
	},
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { ...CAPTION_STYLE_PRESETS.classic };

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
	style: DEFAULT_CAPTION_STYLE,
	position: "bottom",
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
