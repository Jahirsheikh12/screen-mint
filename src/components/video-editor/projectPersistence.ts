import type {
	ExportDestination,
	ExportFormat,
	ExportQuality,
	GifExportConfig,
	GifFrameRate,
	GifSizePreset,
	VideoExportFrameRateMode,
	VideoExportSettings,
} from "@/lib/exporter";
import {
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
	getVideoExportSettingsForPreset,
	mapLegacyExportQualityToVideoSettings,
	mapLegacyGifSizePreset,
} from "@/lib/exporter";
import { normalizeWallpaperSelection, WALLPAPER_PATHS } from "@/lib/wallpapers";
import { ASPECT_RATIOS, type AspectRatio, isCustomAspectRatio } from "@/utils/aspectRatioUtils";
import {
	type AudioMixSettings,
	buildAudioMixTracksFromRegions,
	normalizeAudioMixSettings,
} from "./audioMix";
import {
	clampNumber,
	DEFAULT_FRAME_BORDER_COLOR,
	DEFAULT_FRAME_BORDER_ENABLED,
	DEFAULT_FRAME_BORDER_OPACITY,
	DEFAULT_FRAME_BORDER_WIDTH,
	DEFAULT_FRAME_SHADOW_BLUR,
	DEFAULT_FRAME_SHADOW_OPACITY,
	DEFAULT_FRAME_SHADOW_SIZE,
	getFrameShadowFromLegacyIntensity,
	getLegacyShadowIntensityFromFrameShadow,
	normalizeHexColor,
} from "./frameEffects";
import {
	type AnnotationRegion,
	type AudioRegion,
	type AudioSourceType,
	type CameraLayoutRegion,
	type CameraSpringSettings,
	type CaptionGenerationOptions,
	type CaptionRegion,
	type CaptionSettings,
	type CaptionTrack,
	type CaptionWord,
	type CropRegion,
	CURSOR_CLICK_BOUNCE_DURATION_MAX_MS,
	CURSOR_CLICK_BOUNCE_DURATION_MIN_MS,
	CURSOR_CLICK_EFFECT_STYLE_OPTIONS,
	CURSOR_PACK_OPTIONS,
	type CursorClickEffectStyle,
	type CursorClickStyleSettings,
	type CursorMovementStyle,
	type CursorPack,
	type CursorSpringSettings,
	type CursorStyle,
	type CursorTypeMode,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUDIO_FADE_IN_MS,
	DEFAULT_AUDIO_FADE_OUT_MS,
	DEFAULT_AUDIO_REGION_VOLUME,
	DEFAULT_BLUR_DATA,
	DEFAULT_CAMERA_LAYOUT_MODE,
	DEFAULT_CAMERA_LAYOUT_MOTION_PRESET,
	DEFAULT_CAMERA_LAYOUT_TRANSITION_IN_MS,
	DEFAULT_CAMERA_LAYOUT_TRANSITION_OUT_MS,
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CAPTION_SETTINGS,
	DEFAULT_CLICK_EFFECTS_ENABLED,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_STYLE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_PACK,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_SPRING,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_CURSOR_TRAIL_LENGTH,
	DEFAULT_CURSOR_TRAIL_OPACITY,
	DEFAULT_DEVICE_MOCKUP,
	DEFAULT_FIGURE_DATA,
	DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	DEFAULT_KEYBOARD_SHORTCUT_THEME,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_SHOW_KEYBOARD_SHORTCUTS,
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_PREVIEW_MODE,
	DEFAULT_WEBCAM_REGION,
	DEFAULT_ZOOM_DEPTH,
	DEFAULT_ZOOM_MODE,
	DEFAULT_ZOOM_MOTION_BLUR,
	DEFAULT_ZOOM_TEMPORAL_BLUR,
	DEFAULT_ZOOM_TIMING,
	DEVICE_MOCKUP_OPTIONS,
	type DeviceMockup,
	type KeyboardShortcutPosition,
	type KeyboardShortcutTheme,
	LEGACY_CURSOR_CLICK_STYLE,
	LEGACY_CURSOR_MOTION_BLUR_FACTOR,
	LEGACY_ZOOM_TIMING,
	PADDING_LINKED_MAX,
	PADDING_UNLINKED_VERTICAL_MAX,
	type PaddingSides,
	SCENE_PRESET_IDS,
	type ScenePresetId,
	type SpeedRegion,
	type TrimRegion,
	WEBCAM_RENDER_PIPELINE_VERSION,
	type WebcamEffects,
	type WebcamMotionPreset,
	type WebcamPreviewMode,
	type WebcamRegion,
	type WebcamSessionMetadata,
	ZOOM_TRANSITION_EASING_OPTIONS,
	type ZoomMode,
	type ZoomRegion,
	type ZoomTemporalBlurSettings,
	type ZoomTimingSettings,
	type ZoomTransitionEasing,
} from "./types";
import { normalizeCursorSpring, resolveCursorV2Fields } from "./videoPlayback/cursorV2";
import { composeCropRegions } from "./videoPlayback/layoutUtils";
import { normalizeWebcamEffects, normalizeWebcamSourceCrop } from "./webcamEffects";
import { normalizeWebcamRegion } from "./webcamRegionUtils";

function normalizeCameraSpring(
	candidate: Partial<CameraSpringSettings> | null | undefined,
): CameraSpringSettings {
	const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
	return {
		tension: isNum(candidate?.tension)
			? clamp(candidate.tension, 60, 500)
			: DEFAULT_CAMERA_SPRING.tension,
		friction: isNum(candidate?.friction)
			? clamp(candidate.friction, 8, 80)
			: DEFAULT_CAMERA_SPRING.friction,
		mass: isNum(candidate?.mass) ? clamp(candidate.mass, 0.3, 2.5) : DEFAULT_CAMERA_SPRING.mass,
	};
}

export const PROJECT_VERSION = 12;
export const DEFAULT_VIDEO_PREVIEW_PADDING = 40;

export interface ProjectEditorState {
	wallpaper: string;
	hideBackground: boolean;
	shadowIntensity: number;
	frameShadowSize: number;
	frameShadowOpacity: number;
	frameShadowBlur: number;
	backgroundBlur: number;
	zoomMotionBlur: number;
	zoomTemporalBlur: ZoomTemporalBlurSettings;
	connectZooms: boolean;
	zoomTiming: ZoomTimingSettings;
	showCursor: boolean;
	loopCursor: boolean;
	cursorSize: number;
	cursorSmoothing: number;
	cursorMotionBlur: number;
	cursorClickBounce: number;
	cursorSway: number;
	cursorStyle: import("./types").CursorStyle;
	cursorPack: CursorPack;
	cursorTypeMode: CursorTypeMode;
	cursorTilt: number;
	hideWhenIdle: boolean;
	idleHideDelayMs: number;
	smoothMovementEnabled: boolean;
	cursorMovementStyle: CursorMovementStyle;
	cursorSpring: CursorSpringSettings;
	cameraSpring: import("./types").CameraSpringSettings;
	highQualitySvgCursors: boolean;
	cursorColor: string;
	cursorOpacity: number;
	clickEffectsEnabled: boolean;
	clickHighlightColor: string;
	clickHighlightSize: number;
	clickHighlightOpacity: number;
	cursorClickStyle: CursorClickStyleSettings;
	cursorTrailLength: number;
	cursorTrailOpacity: number;
	showKeyboardShortcuts: boolean;
	keyboardShortcutPosition: KeyboardShortcutPosition;
	keyboardShortcutTheme: KeyboardShortcutTheme;
	keyboardShortcutScale: number;
	keyboardShortcutOpacity: number;
	keyboardShortcutDisplayMs: number;
	keyboardShortcutMaxVisible: number;
	deviceMockup: import("./types").DeviceMockup;
	frameBorderEnabled: boolean;
	frameBorderWidth: number;
	frameBorderColor: string;
	frameBorderOpacity: number;
	borderRadius: number;
	padding: number;
	/** Per-side padding; null = linked (uses `padding`). */
	paddingSides: PaddingSides | null;
	cropRegion: CropRegion;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	cutPoints: number[];
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	aspectRatio: AspectRatio;
	webcamPath?: string;
	webcamRegion: import("./types").WebcamRegion;
	webcamEffects: WebcamEffects;
	webcamPreviewMode: WebcamPreviewMode;
	showWebcam: boolean;
	mirrorWebcam: boolean;
	cameraSizeDuringZoom: number;
	cameraLayouts: CameraLayoutRegion[];
	captionTrack: CaptionTrack | null;
	captionSettings: CaptionSettings;
	captionGenerationOptions: CaptionGenerationOptions;
	exportFormat: ExportFormat;
	exportDestination: ExportDestination;
	videoExportSettings: VideoExportSettings;
	gifExportSettings: GifExportConfig;
	scenePresetId?: ScenePresetId;
	audioMix: AudioMixSettings;
}

export interface EditorProjectData {
	version: number;
	videoPath: string;
	videoName?: string;
	editor: ProjectEditorState;
	webcamSessionMetadata?: WebcamSessionMetadata;
}

function normalizePartialWebcamRegion(candidate: unknown): Partial<WebcamRegion> | undefined {
	if (!candidate || typeof candidate !== "object") {
		return undefined;
	}

	const partial = candidate as Partial<WebcamRegion>;
	const normalized: Partial<WebcamRegion> = {};

	if (partial.position && typeof partial.position === "object") {
		const position = partial.position as Partial<WebcamRegion["position"]>;
		const nextPosition: Partial<WebcamRegion["position"]> = {};

		if (isFiniteNumber(position.x)) {
			nextPosition.x = clamp(position.x, 0, 100);
		}

		if (isFiniteNumber(position.y)) {
			nextPosition.y = clamp(position.y, 0, 100);
		}

		if (Object.keys(nextPosition).length > 0) {
			normalized.position = {
				x: nextPosition.x ?? DEFAULT_WEBCAM_REGION.position.x,
				y: nextPosition.y ?? DEFAULT_WEBCAM_REGION.position.y,
			};

			if (partial.anchor == null) {
				normalized.anchor = "free";
			}
		}
	}

	if (partial.size && typeof partial.size === "object") {
		const size = partial.size as Partial<WebcamRegion["size"]>;
		const nextSize: Partial<WebcamRegion["size"]> = {};

		if (isFiniteNumber(size.width)) {
			nextSize.width = clamp(size.width, 1, 100);
		}

		if (isFiniteNumber(size.height)) {
			nextSize.height = clamp(size.height, 1, 100);
		}

		if (Object.keys(nextSize).length > 0) {
			normalized.size = {
				width: nextSize.width ?? DEFAULT_WEBCAM_REGION.size.width,
				height: nextSize.height ?? DEFAULT_WEBCAM_REGION.size.height,
			};
		}
	}

	if (partial.shape === "circle" || partial.shape === "rectangle" || partial.shape === "square") {
		normalized.shape = partial.shape;
	}

	if (
		partial.anchor === "top-left" ||
		partial.anchor === "top-right" ||
		partial.anchor === "bottom-left" ||
		partial.anchor === "bottom-right" ||
		partial.anchor === "free"
	) {
		normalized.anchor = partial.anchor;
	}

	if (isFiniteNumber(partial.marginPct)) {
		normalized.marginPct = clamp(partial.marginPct, 0, 12);
	}

	if (isFiniteNumber(partial.borderRadius)) {
		normalized.borderRadius = clamp(partial.borderRadius, 0, 100);
	}

	if (isFiniteNumber(partial.opacity)) {
		normalized.opacity = clamp(partial.opacity, 0, 1);
	}

	if (isFiniteNumber(partial.borderWidth)) {
		normalized.borderWidth = clamp(partial.borderWidth, 0, 20);
	}

	if (typeof partial.borderColor === "string" && partial.borderColor.trim().length > 0) {
		normalized.borderColor = partial.borderColor;
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePartialWebcamEffects(candidate: unknown): Partial<WebcamEffects> | undefined {
	if (!candidate || typeof candidate !== "object") {
		return undefined;
	}

	const partial = candidate as Partial<WebcamEffects>;
	const normalized: Partial<WebcamEffects> = {};

	if (
		partial.presetId === "classic-circle" ||
		partial.presetId === "presenter-soft" ||
		partial.presetId === "floating-card" ||
		partial.presetId === "spotlight" ||
		partial.presetId === "fullscreen-commentary" ||
		partial.presetId === "custom"
	) {
		normalized.presetId = partial.presetId;
	}

	if (
		partial.backgroundMode === "none" ||
		partial.backgroundMode === "blur" ||
		partial.backgroundMode === "solid" ||
		partial.backgroundMode === "image"
	) {
		normalized.backgroundMode = partial.backgroundMode;
	}

	if (isFiniteNumber(partial.backgroundBlurStrength)) {
		normalized.backgroundBlurStrength = clamp(partial.backgroundBlurStrength, 0, 32);
	}

	if (typeof partial.backgroundColor === "string" && partial.backgroundColor.trim().length > 0) {
		normalized.backgroundColor = partial.backgroundColor;
	}

	if (
		typeof partial.backgroundImagePath === "string" &&
		partial.backgroundImagePath.trim().length > 0
	) {
		normalized.backgroundImagePath = partial.backgroundImagePath;
	}

	if (isFiniteNumber(partial.edgeFeather)) {
		normalized.edgeFeather = clamp(partial.edgeFeather, 0, 32);
	}

	if (isFiniteNumber(partial.portraitScale)) {
		normalized.portraitScale = clamp(partial.portraitScale, 0.85, 1.35);
	}

	if (partial.portraitOffset && typeof partial.portraitOffset === "object") {
		const offset = partial.portraitOffset as Partial<WebcamEffects["portraitOffset"]>;
		normalized.portraitOffset = {
			x: isFiniteNumber(offset.x)
				? clamp(offset.x, -0.3, 0.3)
				: DEFAULT_WEBCAM_EFFECTS.portraitOffset.x,
			y: isFiniteNumber(offset.y)
				? clamp(offset.y, -0.3, 0.3)
				: DEFAULT_WEBCAM_EFFECTS.portraitOffset.y,
		};
	}

	if (
		partial.shadowStyle === "none" ||
		partial.shadowStyle === "soft" ||
		partial.shadowStyle === "lifted" ||
		partial.shadowStyle === "spotlight"
	) {
		normalized.shadowStyle = partial.shadowStyle;
	}

	if (isFiniteNumber(partial.shadowStrength)) {
		normalized.shadowStrength = clamp(partial.shadowStrength, 0, 1.5);
	}

	if (typeof partial.shadowColor === "string" && partial.shadowColor.trim().length > 0) {
		normalized.shadowColor = partial.shadowColor;
	}

	if (isFiniteNumber(partial.exposure)) {
		normalized.exposure = clamp(partial.exposure, -0.6, 0.6);
	}

	if (isFiniteNumber(partial.contrast)) {
		normalized.contrast = clamp(partial.contrast, 0.7, 1.6);
	}

	if (isFiniteNumber(partial.saturation)) {
		normalized.saturation = clamp(partial.saturation, 0.2, 1.8);
	}

	if (isFiniteNumber(partial.warmth)) {
		normalized.warmth = clamp(partial.warmth, -1, 1);
	}

	if (isFiniteNumber(partial.noiseReduction)) {
		normalized.noiseReduction = clamp(partial.noiseReduction, 0, 1);
	}

	if (typeof partial.faceAwareFraming === "boolean") {
		normalized.faceAwareFraming = partial.faceAwareFraming;
	}

	if (partial.sourceCrop && typeof partial.sourceCrop === "object") {
		normalized.sourceCrop = normalizeWebcamSourceCrop(partial.sourceCrop);
	}

	if (typeof partial.subtleAvoidance === "boolean") {
		normalized.subtleAvoidance = partial.subtleAvoidance;
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
	return clampNumber(value, min, max);
}

function normalizeVideoFrameRateMode(value: unknown, fallback: VideoExportFrameRateMode) {
	if (
		value === "30" ||
		value === 24 ||
		value === 25 ||
		value === 30 ||
		value === "24" ||
		value === "25"
	) {
		return "30";
	}
	if (
		value === "60" ||
		value === 48 ||
		value === 50 ||
		value === 60 ||
		value === "48" ||
		value === "50" ||
		value === "auto" ||
		value === "source"
	) {
		return "60";
	}
	return fallback;
}

function isFileUrl(value: string): boolean {
	return /^file:\/\//i.test(value);
}

function normalizeCameraLayouts(candidate: unknown): CameraLayoutRegion[] {
	if (!Array.isArray(candidate)) {
		return [];
	}

	return candidate
		.filter((value): value is Partial<CameraLayoutRegion> =>
			Boolean(value && typeof value === "object"),
		)
		.map((layout, index) => {
			const startMs = isFiniteNumber(layout.startMs) ? Math.max(0, Math.round(layout.startMs)) : 0;
			const endMs = isFiniteNumber(layout.endMs)
				? Math.max(startMs, Math.round(layout.endMs))
				: startMs;
			const mode =
				layout.mode === "fullscreen" || layout.mode === "hidden" || layout.mode === "default"
					? layout.mode
					: DEFAULT_CAMERA_LAYOUT_MODE;
			const motionPreset: WebcamMotionPreset =
				layout.motionPreset === "focused" ||
				layout.motionPreset === "smooth" ||
				layout.motionPreset === "instant"
					? layout.motionPreset
					: DEFAULT_CAMERA_LAYOUT_MOTION_PRESET;

			return {
				id:
					typeof layout.id === "string" && layout.id.trim().length > 0
						? layout.id
						: `camera-layout-${index + 1}`,
				startMs,
				endMs,
				mode,
				transitionInMs: isFiniteNumber(layout.transitionInMs)
					? clamp(layout.transitionInMs, 0, 3_000)
					: DEFAULT_CAMERA_LAYOUT_TRANSITION_IN_MS,
				transitionOutMs: isFiniteNumber(layout.transitionOutMs)
					? clamp(layout.transitionOutMs, 0, 3_000)
					: DEFAULT_CAMERA_LAYOUT_TRANSITION_OUT_MS,
				motionPreset,
				regionOverride: normalizePartialWebcamRegion(layout.regionOverride),
			};
		});
}

function encodePathSegments(pathname: string, keepWindowsDrive = false): string {
	return pathname
		.split("/")
		.map((segment, index) => {
			if (!segment) return "";
			if (keepWindowsDrive && index === 1 && /^[a-zA-Z]:$/.test(segment)) {
				return segment;
			}
			return encodeURIComponent(segment);
		})
		.join("/");
}

export function toFileUrl(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");

	// Windows drive path: C:/Users/...
	if (/^[a-zA-Z]:\//.test(normalized)) {
		return `file://${encodePathSegments(`/${normalized}`, true)}`;
	}

	// UNC path: //server/share/...
	if (normalized.startsWith("//")) {
		const [host, ...pathParts] = normalized.replace(/^\/+/, "").split("/");
		const encodedPath = pathParts.map((part) => encodeURIComponent(part)).join("/");
		return encodedPath ? `file://${host}/${encodedPath}` : `file://${host}/`;
	}

	const absolutePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
	return `file://${encodePathSegments(absolutePath)}`;
}

export function fromFileUrl(fileUrl: string): string {
	const value = fileUrl.trim();
	if (!isFileUrl(value)) {
		return fileUrl;
	}

	try {
		const url = new URL(value);
		const pathname = decodeURIComponent(url.pathname);

		if (url.host && url.host !== "localhost") {
			const uncPath = `//${url.host}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
			return uncPath.replace(/\//g, "\\");
		}

		if (/^\/[A-Za-z]:/.test(pathname)) {
			return pathname.slice(1);
		}

		return pathname;
	} catch {
		const rawFallbackPath = value.replace(/^file:\/\//i, "");
		let fallbackPath = rawFallbackPath;
		try {
			fallbackPath = decodeURIComponent(rawFallbackPath);
		} catch {
			// Keep raw best-effort path if percent decoding fails.
		}
		return fallbackPath.replace(/^\/([a-zA-Z]:)/, "$1");
	}
}

export function deriveNextId(prefix: string, ids: string[]): number {
	const max = ids.reduce((acc, id) => {
		const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
		if (!match) return acc;
		const value = Number(match[1]);
		return Number.isFinite(value) ? Math.max(acc, value) : acc;
	}, 0);
	return max + 1;
}

export function validateProjectData(candidate: unknown): candidate is EditorProjectData {
	if (!candidate || typeof candidate !== "object") return false;
	const project = candidate as Partial<EditorProjectData>;
	if (typeof project.version !== "number") return false;
	if (typeof project.videoPath !== "string" || !project.videoPath) return false;
	if (project.videoName != null && typeof project.videoName !== "string") return false;
	if (!project.editor || typeof project.editor !== "object") return false;
	return true;
}

function normalizeWebcamCaptureProfile(candidate: unknown) {
	if (!candidate || typeof candidate !== "object") {
		return undefined;
	}

	const profile = candidate as Partial<import("./types").WebcamCaptureProfile>;
	if (
		!isFiniteNumber(profile.width) ||
		!isFiniteNumber(profile.height) ||
		!isFiniteNumber(profile.frameRate) ||
		!isFiniteNumber(profile.aspectRatio)
	) {
		return undefined;
	}

	return {
		width: Math.max(1, Math.round(profile.width)),
		height: Math.max(1, Math.round(profile.height)),
		frameRate: clamp(Math.round(profile.frameRate), 1, 120),
		aspectRatio: clamp(profile.aspectRatio, 0.1, 10),
	};
}

export function normalizeWebcamSessionMetadata(
	candidate: unknown,
): WebcamSessionMetadata | undefined {
	if (!candidate || typeof candidate !== "object") {
		return undefined;
	}

	const metadata = candidate as Partial<WebcamSessionMetadata>;
	const segmentOffsetsMs = Array.isArray(metadata.segmentOffsetsMs)
		? metadata.segmentOffsetsMs
				.filter((value): value is number => isFiniteNumber(value))
				.map((value) => Math.max(0, Math.round(value)))
		: undefined;

	return {
		sessionCaptureProfile:
			normalizeWebcamCaptureProfile(metadata.sessionCaptureProfile) ??
			normalizeWebcamCaptureProfile(metadata.captureProfile) ??
			null,
		captureProfile: normalizeWebcamCaptureProfile(metadata.captureProfile) ?? null,
		segmentOffsetsMs,
		segmentProfiles: Array.isArray(metadata.segmentProfiles)
			? metadata.segmentProfiles.map((profile) => normalizeWebcamCaptureProfile(profile) ?? null)
			: undefined,
		segmentCompatibilityMode:
			metadata.segmentCompatibilityMode === "normalized" ? "normalized" : "copy",
		renderPipelineVersion: isFiniteNumber(metadata.renderPipelineVersion)
			? Math.max(1, Math.round(metadata.renderPipelineVersion))
			: WEBCAM_RENDER_PIPELINE_VERSION,
	};
}

function normalizeCaptionRegions(candidate: unknown): CaptionRegion[] {
	if (!Array.isArray(candidate)) {
		return [];
	}

	return candidate
		.filter((region): region is Partial<CaptionRegion> =>
			Boolean(
				region &&
					typeof region === "object" &&
					typeof (region as Partial<CaptionRegion>).id === "string",
			),
		)
		.map((region, index) => {
			const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
			const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
			const startMs = Math.max(0, Math.min(rawStart, rawEnd));
			const endMs = Math.max(startMs + 1, rawEnd);
			const text = typeof region.text === "string" ? region.text : "";
			const words = normalizeCaptionWords(
				(region as Partial<CaptionRegion>).words,
				typeof region.id === "string" && region.id.trim().length > 0
					? region.id
					: `caption-${index + 1}`,
				startMs,
				endMs,
				text,
			);

			return {
				id:
					typeof region.id === "string" && region.id.trim().length > 0
						? region.id
						: `caption-${index + 1}`,
				startMs,
				endMs,
				text,
				words,
				source: (region as Partial<CaptionRegion>).source === "manual" ? "manual" : "generated",
			};
		});
}

function normalizeCaptionWords(
	candidate: unknown,
	segmentId: string,
	startMs: number,
	endMs: number,
	text: string,
): CaptionWord[] {
	if (Array.isArray(candidate)) {
		return candidate
			.filter((word): word is Partial<CaptionWord> => Boolean(word && typeof word === "object"))
			.map((word, index) => {
				const rawStart = isFiniteNumber(word.startMs) ? Math.round(word.startMs) : startMs;
				const rawEnd = isFiniteNumber(word.endMs) ? Math.round(word.endMs) : rawStart + 1;
				const nextStart = Math.max(startMs, Math.min(rawStart, endMs));
				const nextEnd = Math.max(nextStart + 1, Math.min(rawEnd, endMs));
				return {
					id:
						typeof word.id === "string" && word.id.trim().length > 0
							? word.id
							: `${segmentId}-word-${index + 1}`,
					text: typeof word.text === "string" ? word.text : "",
					startMs: nextStart,
					endMs: nextEnd,
					confidence: isFiniteNumber(word.confidence) ? word.confidence : undefined,
				};
			});
	}

	const tokens = text
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
	if (tokens.length === 0) {
		return [];
	}

	const duration = Math.max(1, endMs - startMs);
	const step = Math.max(1, Math.round(duration / tokens.length));
	return tokens.map((token, index) => {
		const wordStartMs = startMs + index * step;
		return {
			id: `${segmentId}-word-${index + 1}`,
			text: token,
			startMs: wordStartMs,
			endMs: index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + step),
		};
	});
}

const VALID_CAPTION_ANIMATION_MODES: CaptionSettings["animationMode"][] = [
	"static",
	"active-word",
	"fade",
	"pop",
	"rise",
	"typewriter",
	"karaoke-fill",
];

function normalizeCaptionStyle(candidate: unknown): CaptionSettings["style"] {
	const defaults = DEFAULT_CAPTION_SETTINGS.style;
	if (!candidate || typeof candidate !== "object") {
		return { ...defaults };
	}
	const style = candidate as Partial<CaptionSettings["style"]>;
	const pickString = (value: unknown, fallback: string) =>
		typeof value === "string" && value.trim().length > 0 ? value : fallback;
	const pickNumber = (value: unknown, fallback: number) =>
		isFiniteNumber(value) ? value : fallback;
	return {
		preset:
			style.preset === "classic" ||
			style.preset === "boxed" ||
			style.preset === "karaoke" ||
			style.preset === "outline" ||
			style.preset === "neon" ||
			style.preset === "minimal"
				? style.preset
				: defaults.preset,
		fontSize: clamp(pickNumber(style.fontSize, defaults.fontSize), 10, 120),
		fontFamily: pickString(style.fontFamily, defaults.fontFamily),
		fontWeight:
			style.fontWeight === "normal" || style.fontWeight === "bold" || style.fontWeight === "800"
				? style.fontWeight
				: defaults.fontWeight,
		fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
		color: pickString(style.color, defaults.color),
		highlightColor: pickString(style.highlightColor, defaults.highlightColor),
		backgroundColor: pickString(style.backgroundColor, defaults.backgroundColor),
		backgroundOpacity: clamp(pickNumber(style.backgroundOpacity, defaults.backgroundOpacity), 0, 1),
		borderRadius: clamp(pickNumber(style.borderRadius, defaults.borderRadius), 0, 48),
		outlineColor: pickString(style.outlineColor, defaults.outlineColor),
		outlineWidth: clamp(pickNumber(style.outlineWidth, defaults.outlineWidth), 0, 10),
		shadowColor: pickString(style.shadowColor, defaults.shadowColor),
		shadowBlur: clamp(pickNumber(style.shadowBlur, defaults.shadowBlur), 0, 60),
		shadowOffsetY: clamp(pickNumber(style.shadowOffsetY, defaults.shadowOffsetY), -20, 20),
		letterSpacing: clamp(pickNumber(style.letterSpacing, defaults.letterSpacing), -4, 12),
		lineHeight: clamp(pickNumber(style.lineHeight, defaults.lineHeight), 0.8, 2.4),
		textTransform: style.textTransform === "uppercase" ? "uppercase" : "none",
	};
}

function normalizeCaptionPositionOverride(candidate: unknown): CaptionSettings["positionOverride"] {
	if (!candidate || typeof candidate !== "object") return null;
	const value = candidate as Partial<NonNullable<CaptionSettings["positionOverride"]>>;
	if (!isFiniteNumber(value.xPercent) || !isFiniteNumber(value.yPercent)) return null;
	return {
		xPercent: clamp(value.xPercent, 0, 100),
		yPercent: clamp(value.yPercent, 0, 100),
	};
}

function normalizeCaptionSettings(candidate: unknown): CaptionSettings {
	if (!candidate || typeof candidate !== "object") {
		return {
			...DEFAULT_CAPTION_SETTINGS,
			style: { ...DEFAULT_CAPTION_SETTINGS.style },
			positionOverride: null,
		};
	}

	const settings = candidate as Partial<CaptionSettings>;
	return {
		enabled: typeof settings.enabled === "boolean" ? settings.enabled : true,
		position:
			settings.position === "top" ||
			settings.position === "center" ||
			settings.position === "bottom"
				? settings.position
				: "bottom",
		positionOverride: normalizeCaptionPositionOverride(settings.positionOverride),
		style: normalizeCaptionStyle(settings.style),
		animationMode:
			typeof settings.animationMode === "string" &&
			VALID_CAPTION_ANIMATION_MODES.includes(
				settings.animationMode as CaptionSettings["animationMode"],
			)
				? (settings.animationMode as CaptionSettings["animationMode"])
				: DEFAULT_CAPTION_SETTINGS.animationMode,
		maxLines: isFiniteNumber(settings.maxLines)
			? clamp(Math.round(settings.maxLines), 1, 4)
			: DEFAULT_CAPTION_SETTINGS.maxLines,
		maxWordsPerLine: isFiniteNumber(settings.maxWordsPerLine)
			? clamp(Math.round(settings.maxWordsPerLine), 1, 12)
			: DEFAULT_CAPTION_SETTINGS.maxWordsPerLine,
		safeAreaInset: isFiniteNumber(settings.safeAreaInset)
			? clamp(settings.safeAreaInset, 2, 20)
			: DEFAULT_CAPTION_SETTINGS.safeAreaInset,
		maxWidthPercent: isFiniteNumber(settings.maxWidthPercent)
			? clamp(settings.maxWidthPercent, 40, 95)
			: DEFAULT_CAPTION_SETTINGS.maxWidthPercent,
		showTranscriptPanel:
			typeof settings.showTranscriptPanel === "boolean"
				? settings.showTranscriptPanel
				: DEFAULT_CAPTION_SETTINGS.showTranscriptPanel,
	};
}

function normalizeCaptionTrack(
	candidate: unknown,
	legacyRegions: CaptionRegion[],
): CaptionTrack | null {
	if (!candidate || typeof candidate !== "object") {
		if (legacyRegions.length === 0) {
			return null;
		}

		return {
			backend: "whisper.cpp",
			model: "base",
			language: "auto",
			prompt: "",
			sourceAudio: "mixed",
			status: "ready",
			segments: legacyRegions.map((segment) => ({
				...segment,
				source: "manual",
			})),
		};
	}

	const track = candidate as Partial<CaptionTrack>;
	const segments = normalizeCaptionRegions(track.segments);
	return {
		backend:
			track.backend === "apple-speech" || track.backend === "whisper.cpp"
				? track.backend
				: "whisper.cpp",
		model:
			track.model === "base" || track.model === "small" || track.model === "medium"
				? track.model
				: "base",
		language:
			typeof track.language === "string" && track.language.trim().length > 0
				? track.language
				: "auto",
		prompt: typeof track.prompt === "string" ? track.prompt : "",
		sourceAudio: track.sourceAudio === "microphone" ? "microphone" : "mixed",
		sourceAudioPath:
			typeof track.sourceAudioPath === "string" && track.sourceAudioPath.trim().length > 0
				? track.sourceAudioPath
				: undefined,
		status:
			track.status === "idle" ||
			track.status === "generating" ||
			track.status === "ready" ||
			track.status === "error"
				? track.status
				: segments.length > 0
					? "ready"
					: "idle",
		error: typeof track.error === "string" ? track.error : undefined,
		generatedAt: typeof track.generatedAt === "string" ? track.generatedAt : undefined,
		segments,
	};
}

function normalizeCaptionGenerationOptions(candidate: unknown): CaptionGenerationOptions {
	if (!candidate || typeof candidate !== "object") {
		return { ...DEFAULT_CAPTION_GENERATION_OPTIONS };
	}

	const options = candidate as Partial<CaptionGenerationOptions>;
	return {
		preferredBackend:
			options.preferredBackend === "auto" ||
			options.preferredBackend === "apple-speech" ||
			options.preferredBackend === "whisper.cpp"
				? options.preferredBackend
				: DEFAULT_CAPTION_GENERATION_OPTIONS.preferredBackend,
		model:
			options.model === "base" || options.model === "small" || options.model === "medium"
				? options.model
				: DEFAULT_CAPTION_GENERATION_OPTIONS.model,
		language:
			typeof options.language === "string" && options.language.trim().length > 0
				? options.language
				: DEFAULT_CAPTION_GENERATION_OPTIONS.language,
		prompt: typeof options.prompt === "string" ? options.prompt : "",
		preferredSourceAudio:
			options.preferredSourceAudio === "microphone" || options.preferredSourceAudio === "mixed"
				? options.preferredSourceAudio
				: DEFAULT_CAPTION_GENERATION_OPTIONS.preferredSourceAudio,
	};
}

function normalizeZoomMode(value: unknown): ZoomMode {
	return value === "cursor-follow" || value === "static" ? value : DEFAULT_ZOOM_MODE;
}

function normalizeZoomEasing(value: unknown, fallback: ZoomTransitionEasing): ZoomTransitionEasing {
	return ZOOM_TRANSITION_EASING_OPTIONS.some((option) => option.value === value)
		? (value as ZoomTransitionEasing)
		: fallback;
}

export function normalizeZoomTiming(candidate: unknown): ZoomTimingSettings {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<ZoomTimingSettings>) : {};
	const ms = (value: unknown, fallback: number, max: number) =>
		isFiniteNumber(value) ? clamp(value, 0, max) : fallback;
	return {
		zoomInDurationMs: ms(raw.zoomInDurationMs, DEFAULT_ZOOM_TIMING.zoomInDurationMs, 5000),
		zoomInOverlapMs: ms(raw.zoomInOverlapMs, DEFAULT_ZOOM_TIMING.zoomInOverlapMs, 5000),
		zoomOutDurationMs: ms(raw.zoomOutDurationMs, DEFAULT_ZOOM_TIMING.zoomOutDurationMs, 5000),
		connectedZoomGapMs: ms(raw.connectedZoomGapMs, DEFAULT_ZOOM_TIMING.connectedZoomGapMs, 10000),
		connectedZoomDurationMs: ms(
			raw.connectedZoomDurationMs,
			DEFAULT_ZOOM_TIMING.connectedZoomDurationMs,
			5000,
		),
		zoomInEasing: normalizeZoomEasing(raw.zoomInEasing, DEFAULT_ZOOM_TIMING.zoomInEasing),
		zoomOutEasing: normalizeZoomEasing(raw.zoomOutEasing, DEFAULT_ZOOM_TIMING.zoomOutEasing),
		connectedZoomEasing: normalizeZoomEasing(
			raw.connectedZoomEasing,
			DEFAULT_ZOOM_TIMING.connectedZoomEasing,
		),
	};
}

export function normalizeZoomTemporalBlur(candidate: unknown): ZoomTemporalBlurSettings {
	if (!candidate || typeof candidate !== "object") return { ...DEFAULT_ZOOM_TEMPORAL_BLUR };
	const raw = candidate as Partial<ZoomTemporalBlurSettings>;
	return {
		enabled: raw.enabled === true,
		sampleCount: isFiniteNumber(raw.sampleCount) ? clamp(Math.round(raw.sampleCount), 2, 32) : null,
		shutterFraction: isFiniteNumber(raw.shutterFraction) ? clamp(raw.shutterFraction, 0, 1) : null,
	};
}

export function normalizePaddingSides(candidate: unknown): PaddingSides | null {
	if (!candidate || typeof candidate !== "object") return null;
	const raw = candidate as Partial<PaddingSides>;
	const side = (value: unknown, max: number) => (isFiniteNumber(value) ? clamp(value, 0, max) : 0);
	return {
		top: side(raw.top, PADDING_UNLINKED_VERTICAL_MAX),
		bottom: side(raw.bottom, PADDING_UNLINKED_VERTICAL_MAX),
		left: side(raw.left, PADDING_LINKED_MAX),
		right: side(raw.right, PADDING_LINKED_MAX),
	};
}

export function normalizeCursorClickStyle(candidate: unknown): CursorClickStyleSettings {
	const raw =
		candidate && typeof candidate === "object"
			? (candidate as Partial<CursorClickStyleSettings>)
			: {};
	return {
		effect: CURSOR_CLICK_EFFECT_STYLE_OPTIONS.some((option) => option.value === raw.effect)
			? (raw.effect as CursorClickEffectStyle)
			: DEFAULT_CURSOR_CLICK_STYLE.effect,
		effectDurationMs: isFiniteNumber(raw.effectDurationMs)
			? clamp(raw.effectDurationMs, 100, 3000)
			: DEFAULT_CURSOR_CLICK_STYLE.effectDurationMs,
		bounceDurationMs: isFiniteNumber(raw.bounceDurationMs)
			? clamp(
					raw.bounceDurationMs,
					CURSOR_CLICK_BOUNCE_DURATION_MIN_MS,
					CURSOR_CLICK_BOUNCE_DURATION_MAX_MS,
				)
			: DEFAULT_CURSOR_CLICK_STYLE.bounceDurationMs,
		delayEffectUntilBounce:
			typeof raw.delayEffectUntilBounce === "boolean"
				? raw.delayEffectUntilBounce
				: DEFAULT_CURSOR_CLICK_STYLE.delayEffectUntilBounce,
	};
}

/**
 * Projects saved before v12 had fixed zoom/click timing and only bounced the cursor when click
 * effects were on; keep their look unchanged on load.
 */
export function withLegacyZoomTiming(
	version: number,
	editor: Partial<ProjectEditorState>,
): Partial<ProjectEditorState> {
	if (version >= 12) return editor;
	return {
		...editor,
		zoomTiming: editor.zoomTiming ?? LEGACY_ZOOM_TIMING,
		cursorClickStyle: editor.cursorClickStyle ?? LEGACY_CURSOR_CLICK_STYLE,
		...(editor.clickEffectsEnabled ? {} : { cursorClickBounce: 0 }),
		...(isFiniteNumber(editor.cursorMotionBlur)
			? { cursorMotionBlur: editor.cursorMotionBlur * LEGACY_CURSOR_MOTION_BLUR_FACTOR }
			: {}),
	};
}

function normalizeCursorFollowTracking(candidate: unknown) {
	if (!candidate || typeof candidate !== "object") {
		return { ...DEFAULT_CURSOR_FOLLOW_TRACKING };
	}

	const tracking = candidate as Partial<NonNullable<ZoomRegion["tracking"]>>;
	return {
		deadzone: isFiniteNumber(tracking.deadzone)
			? clamp(tracking.deadzone, 0, 0.2)
			: DEFAULT_CURSOR_FOLLOW_TRACKING.deadzone,
		lookAheadMs: isFiniteNumber(tracking.lookAheadMs)
			? clamp(Math.round(tracking.lookAheadMs), 0, 300)
			: DEFAULT_CURSOR_FOLLOW_TRACKING.lookAheadMs,
		maxPanPerSecond: isFiniteNumber(tracking.maxPanPerSecond)
			? clamp(tracking.maxPanPerSecond, 0.2, 3)
			: DEFAULT_CURSOR_FOLLOW_TRACKING.maxPanPerSecond,
		dwellHoldMs: isFiniteNumber(tracking.dwellHoldMs)
			? clamp(Math.round(tracking.dwellHoldMs), 0, 1000)
			: DEFAULT_CURSOR_FOLLOW_TRACKING.dwellHoldMs,
		textHoldMs: isFiniteNumber(tracking.textHoldMs)
			? clamp(Math.round(tracking.textHoldMs), 0, 1500)
			: DEFAULT_CURSOR_FOLLOW_TRACKING.textHoldMs,
	};
}

// Projects saved before the Layers panel was removed may carry a crop on the primary
// video layer; fold it into the main crop so they keep their look.
function foldLegacyLayerCrop(cropRegion: CropRegion, layers: unknown): CropRegion {
	if (!Array.isArray(layers)) return cropRegion;
	const primary = layers.find(
		(layer) => layer && typeof layer === "object" && layer.type === "video" && layer.isPrimary,
	) as { transform?: { crop?: Partial<CropRegion> } } | undefined;
	const crop = primary?.transform?.crop;
	if (
		!crop ||
		!isFiniteNumber(crop.x) ||
		!isFiniteNumber(crop.y) ||
		!isFiniteNumber(crop.width) ||
		!isFiniteNumber(crop.height)
	) {
		return cropRegion;
	}
	return composeCropRegions(cropRegion, {
		x: crop.x,
		y: crop.y,
		width: crop.width,
		height: crop.height,
	});
}

export function normalizeProjectEditor(editor: Partial<ProjectEditorState>): ProjectEditorState {
	const exportEditor = editor as Partial<ProjectEditorState> & {
		exportQuality?: ExportQuality;
		gifFrameRate?: GifFrameRate;
		gifLoop?: boolean;
		gifSizePreset?: GifSizePreset;
		videoExportSettings?: Partial<VideoExportSettings>;
		gifExportSettings?: Partial<GifExportConfig>;
	};
	const defaultVideoExportSettings = getDefaultVideoExportSettings();
	const defaultGifExportSettings = getDefaultGifExportSettings();
	const legacyVideoExportSettings = mapLegacyExportQualityToVideoSettings(
		exportEditor.exportQuality,
	);
	const legacyGifExportPreset = mapLegacyGifSizePreset(exportEditor.gifSizePreset);
	const normalizedVideoMode =
		exportEditor.videoExportSettings?.mode === "custom" ||
		exportEditor.videoExportSettings?.mode === "preset"
			? exportEditor.videoExportSettings.mode
			: "preset";
	const normalizedVideoPreset =
		exportEditor.videoExportSettings?.preset === "fast-share" ||
		exportEditor.videoExportSettings?.preset === "balanced" ||
		exportEditor.videoExportSettings?.preset === "quality" ||
		exportEditor.videoExportSettings?.preset === "master"
			? exportEditor.videoExportSettings.preset
			: legacyVideoExportSettings.preset;
	const presetVideoExportSettings = getVideoExportSettingsForPreset(normalizedVideoPreset);
	const normalizedVideoExportSettings: VideoExportSettings = {
		mode: normalizedVideoMode,
		preset: normalizedVideoPreset,
		resolutionMode:
			exportEditor.videoExportSettings?.resolutionMode === "720p" ||
			exportEditor.videoExportSettings?.resolutionMode === "1080p" ||
			exportEditor.videoExportSettings?.resolutionMode === "1440p" ||
			exportEditor.videoExportSettings?.resolutionMode === "2160p" ||
			exportEditor.videoExportSettings?.resolutionMode === "source"
				? exportEditor.videoExportSettings.resolutionMode
				: presetVideoExportSettings.resolutionMode,
		frameRateMode: normalizeVideoFrameRateMode(
			(exportEditor.videoExportSettings as Partial<{ frameRateMode: unknown }> | undefined)
				?.frameRateMode,
			presetVideoExportSettings.frameRateMode,
		),
		bitrateMode:
			exportEditor.videoExportSettings?.bitrateMode === "auto" ||
			exportEditor.videoExportSettings?.bitrateMode === "high" ||
			exportEditor.videoExportSettings?.bitrateMode === "very-high" ||
			exportEditor.videoExportSettings?.bitrateMode === "archive" ||
			exportEditor.videoExportSettings?.bitrateMode === "custom" ||
			exportEditor.videoExportSettings?.bitrateMode === "bpp"
				? exportEditor.videoExportSettings.bitrateMode
				: legacyVideoExportSettings.bitrateMode,
		customBitrateMbps:
			typeof exportEditor.videoExportSettings?.customBitrateMbps === "number" &&
			Number.isFinite(exportEditor.videoExportSettings.customBitrateMbps)
				? clamp(exportEditor.videoExportSettings.customBitrateMbps, 4, 80)
				: legacyVideoExportSettings.customBitrateMbps,
		bitsPerPixel:
			typeof exportEditor.videoExportSettings?.bitsPerPixel === "number" &&
			Number.isFinite(exportEditor.videoExportSettings.bitsPerPixel)
				? clamp(exportEditor.videoExportSettings.bitsPerPixel, 0.02, 0.5)
				: legacyVideoExportSettings.bitsPerPixel,
		forceFFmpegDecoder:
			typeof exportEditor.videoExportSettings?.forceFFmpegDecoder === "boolean"
				? exportEditor.videoExportSettings.forceFFmpegDecoder
				: legacyVideoExportSettings.forceFFmpegDecoder,
		optimizeForWeb:
			typeof exportEditor.videoExportSettings?.optimizeForWeb === "boolean"
				? exportEditor.videoExportSettings.optimizeForWeb
				: (legacyVideoExportSettings.optimizeForWeb ?? defaultVideoExportSettings.optimizeForWeb),
	};
	const normalizedGifExportSettings: GifExportConfig = {
		mode:
			exportEditor.gifExportSettings?.mode === "custom" ||
			exportEditor.gifExportSettings?.mode === "preset"
				? exportEditor.gifExportSettings.mode
				: "preset",
		preset:
			exportEditor.gifExportSettings?.preset === "small-share" ||
			exportEditor.gifExportSettings?.preset === "balanced" ||
			exportEditor.gifExportSettings?.preset === "quality"
				? exportEditor.gifExportSettings.preset
				: legacyGifExportPreset,
		resolutionMode:
			exportEditor.gifExportSettings?.resolutionMode === "480p" ||
			exportEditor.gifExportSettings?.resolutionMode === "720p" ||
			exportEditor.gifExportSettings?.resolutionMode === "1080p" ||
			exportEditor.gifExportSettings?.resolutionMode === "source"
				? exportEditor.gifExportSettings.resolutionMode
				: defaultGifExportSettings.resolutionMode,
		frameRate:
			exportEditor.gifExportSettings?.frameRate === 10 ||
			exportEditor.gifExportSettings?.frameRate === 12 ||
			exportEditor.gifExportSettings?.frameRate === 15 ||
			exportEditor.gifExportSettings?.frameRate === 20 ||
			exportEditor.gifExportSettings?.frameRate === 24 ||
			exportEditor.gifExportSettings?.frameRate === 25 ||
			exportEditor.gifExportSettings?.frameRate === 30
				? exportEditor.gifExportSettings.frameRate
				: exportEditor.gifFrameRate === 10 ||
						exportEditor.gifFrameRate === 12 ||
						exportEditor.gifFrameRate === 15 ||
						exportEditor.gifFrameRate === 20 ||
						exportEditor.gifFrameRate === 24 ||
						exportEditor.gifFrameRate === 25 ||
						exportEditor.gifFrameRate === 30
					? exportEditor.gifFrameRate
					: defaultGifExportSettings.frameRate,
		loop:
			typeof exportEditor.gifExportSettings?.loop === "boolean"
				? exportEditor.gifExportSettings.loop
				: typeof exportEditor.gifLoop === "boolean"
					? exportEditor.gifLoop
					: defaultGifExportSettings.loop,
		dedupeFrames:
			typeof exportEditor.gifExportSettings?.dedupeFrames === "boolean"
				? exportEditor.gifExportSettings.dedupeFrames
				: defaultGifExportSettings.dedupeFrames,
		colorCount:
			exportEditor.gifExportSettings?.colorCount === 64 ||
			exportEditor.gifExportSettings?.colorCount === 128 ||
			exportEditor.gifExportSettings?.colorCount === 256
				? exportEditor.gifExportSettings.colorCount
				: defaultGifExportSettings.colorCount,
		ditherMode:
			exportEditor.gifExportSettings?.ditherMode === "off" ||
			exportEditor.gifExportSettings?.ditherMode === "bayer" ||
			exportEditor.gifExportSettings?.ditherMode === "floyd-steinberg"
				? exportEditor.gifExportSettings.ditherMode
				: defaultGifExportSettings.ditherMode,
		motionSensitivity:
			exportEditor.gifExportSettings?.motionSensitivity === "low" ||
			exportEditor.gifExportSettings?.motionSensitivity === "balanced" ||
			exportEditor.gifExportSettings?.motionSensitivity === "high"
				? exportEditor.gifExportSettings.motionSensitivity
				: defaultGifExportSettings.motionSensitivity,
		width:
			typeof exportEditor.gifExportSettings?.width === "number"
				? exportEditor.gifExportSettings.width
				: defaultGifExportSettings.width,
		height:
			typeof exportEditor.gifExportSettings?.height === "number"
				? exportEditor.gifExportSettings.height
				: defaultGifExportSettings.height,
	};

	const validAspectRatios = new Set<AspectRatio>(ASPECT_RATIOS);
	const legacyMotionBlurEnabled = (editor as Partial<{ motionBlurEnabled: boolean }>)
		.motionBlurEnabled;
	const legacyShowBlur = (editor as Partial<{ showBlur: boolean }>).showBlur;
	const normalizedZoomMotionBlur = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).zoomMotionBlur,
	)
		? clamp((editor as Partial<ProjectEditorState>).zoomMotionBlur as number, 0, 2)
		: legacyMotionBlurEnabled
			? 0.35
			: DEFAULT_ZOOM_MOTION_BLUR;
	const normalizedBackgroundBlur = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).backgroundBlur,
	)
		? clamp((editor as Partial<ProjectEditorState>).backgroundBlur as number, 0, 8)
		: legacyShowBlur
			? 2
			: 0;

	const normalizedZoomRegions: ZoomRegion[] = Array.isArray(editor.zoomRegions)
		? editor.zoomRegions
				.filter((region): region is ZoomRegion => Boolean(region && typeof region.id === "string"))
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
					const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					return {
						id: region.id,
						startMs,
						endMs,
						depth: [1, 2, 3, 4, 5, 6].includes(region.depth) ? region.depth : DEFAULT_ZOOM_DEPTH,
						focus: {
							cx: clamp(isFiniteNumber(region.focus?.cx) ? region.focus.cx : 0.5, 0, 1),
							cy: clamp(isFiniteNumber(region.focus?.cy) ? region.focus.cy : 0.5, 0, 1),
						},
						mode: normalizeZoomMode(region.mode),
						tracking: normalizeCursorFollowTracking(region.tracking),
					};
				})
		: [];

	const normalizedTrimRegions: TrimRegion[] = Array.isArray(editor.trimRegions)
		? editor.trimRegions
				.filter((region): region is TrimRegion => Boolean(region && typeof region.id === "string"))
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
					const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);
					return {
						id: region.id,
						startMs,
						endMs,
					};
				})
		: [];

	const normalizedCutPoints: number[] = Array.isArray(
		(editor as Partial<ProjectEditorState> & { cutPoints?: number[] }).cutPoints,
	)
		? (
				(editor as Partial<ProjectEditorState> & { cutPoints?: number[] }).cutPoints as number[]
			).filter((cp) => typeof cp === "number" && Number.isFinite(cp) && cp > 0)
		: [];

	const normalizedSpeedRegions: SpeedRegion[] = Array.isArray(editor.speedRegions)
		? editor.speedRegions
				.filter((region): region is SpeedRegion => Boolean(region && typeof region.id === "string"))
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
					const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					const speed =
						region.speed === 0.25 ||
						region.speed === 0.5 ||
						region.speed === 0.75 ||
						region.speed === 1.25 ||
						region.speed === 1.5 ||
						region.speed === 1.75 ||
						region.speed === 2
							? region.speed
							: DEFAULT_PLAYBACK_SPEED;

					return {
						id: region.id,
						startMs,
						endMs,
						speed,
					};
				})
		: [];

	const normalizedAnnotationRegions: AnnotationRegion[] = Array.isArray(editor.annotationRegions)
		? editor.annotationRegions
				.filter((region): region is AnnotationRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region, index) => {
					const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
					const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					return {
						id: region.id,
						startMs,
						endMs,
						type:
							region.type === "image" || region.type === "figure" || region.type === "blur"
								? region.type
								: "text",
						content: typeof region.content === "string" ? region.content : "",
						textContent: typeof region.textContent === "string" ? region.textContent : undefined,
						imageContent: typeof region.imageContent === "string" ? region.imageContent : undefined,
						position: {
							x: clamp(
								isFiniteNumber(region.position?.x)
									? region.position.x
									: DEFAULT_ANNOTATION_POSITION.x,
								0,
								100,
							),
							y: clamp(
								isFiniteNumber(region.position?.y)
									? region.position.y
									: DEFAULT_ANNOTATION_POSITION.y,
								0,
								100,
							),
						},
						size: {
							width: clamp(
								isFiniteNumber(region.size?.width)
									? region.size.width
									: DEFAULT_ANNOTATION_SIZE.width,
								1,
								200,
							),
							height: clamp(
								isFiniteNumber(region.size?.height)
									? region.size.height
									: DEFAULT_ANNOTATION_SIZE.height,
								1,
								200,
							),
						},
						style: {
							...DEFAULT_ANNOTATION_STYLE,
							...(region.style && typeof region.style === "object" ? region.style : {}),
						},
						zIndex: isFiniteNumber(region.zIndex) ? region.zIndex : index + 1,
						figureData: region.figureData
							? {
									...DEFAULT_FIGURE_DATA,
									...region.figureData,
								}
							: undefined,
						blurData: region.blurData
							? {
									...DEFAULT_BLUR_DATA,
									...region.blurData,
								}
							: undefined,
					};
				})
		: [];

	const normalizedAudioRegions: AudioRegion[] = Array.isArray(
		(editor as Partial<ProjectEditorState>).audioRegions,
	)
		? ((editor as Partial<ProjectEditorState>).audioRegions as AudioRegion[])
				.filter((region): region is AudioRegion => Boolean(region && typeof region.id === "string"))
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs) ? Math.round(region.startMs) : 0;
					const rawEnd = isFiniteNumber(region.endMs) ? Math.round(region.endMs) : rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);
					const normalizedSourceType: AudioSourceType =
						region.sourceType === "built-in"
							? "built-in"
							: region.sourceType === "file"
								? "file"
								: typeof region.assetId === "string" && region.assetId.trim().length > 0
									? "built-in"
									: "file";
					const normalizedAssetId =
						typeof region.assetId === "string" && region.assetId.trim().length > 0
							? region.assetId
							: undefined;
					const normalizedAudioPath =
						typeof region.audioPath === "string" && region.audioPath.trim().length > 0
							? region.audioPath
							: undefined;

					return {
						id: region.id,
						startMs,
						endMs,
						sourceType: normalizedSourceType,
						assetId: normalizedSourceType === "built-in" ? normalizedAssetId : undefined,
						audioPath: normalizedSourceType === "file" ? normalizedAudioPath : undefined,
						volume: isFiniteNumber(region.volume)
							? clamp(region.volume, 0, 1)
							: DEFAULT_AUDIO_REGION_VOLUME,
						fadeInMs: isFiniteNumber(region.fadeInMs)
							? clamp(region.fadeInMs, 0, 10_000)
							: DEFAULT_AUDIO_FADE_IN_MS,
						fadeOutMs: isFiniteNumber(region.fadeOutMs)
							? clamp(region.fadeOutMs, 0, 10_000)
							: DEFAULT_AUDIO_FADE_OUT_MS,
						loop:
							typeof region.loop === "boolean" ? region.loop : normalizedSourceType === "built-in",
						...(region.normalize === true ? { normalize: true } : {}),
					};
				})
		: [];
	const legacyCaptionRegions = normalizeCaptionRegions(
		(editor as Partial<ProjectEditorState> & { captionRegions?: CaptionRegion[] }).captionRegions,
	);
	const normalizedCaptionTrack = normalizeCaptionTrack(
		(editor as Partial<ProjectEditorState> & { captionTrack?: CaptionTrack | null }).captionTrack,
		legacyCaptionRegions,
	);
	const normalizedAudioMix = normalizeAudioMixSettings(
		(editor as Partial<ProjectEditorState>).audioMix ?? {
			tracks: buildAudioMixTracksFromRegions(normalizedAudioRegions),
		},
	);
	const rawCropX = isFiniteNumber(editor.cropRegion?.x)
		? editor.cropRegion.x
		: DEFAULT_CROP_REGION.x;
	const rawCropY = isFiniteNumber(editor.cropRegion?.y)
		? editor.cropRegion.y
		: DEFAULT_CROP_REGION.y;
	const rawCropWidth = isFiniteNumber(editor.cropRegion?.width)
		? editor.cropRegion.width
		: DEFAULT_CROP_REGION.width;
	const rawCropHeight = isFiniteNumber(editor.cropRegion?.height)
		? editor.cropRegion.height
		: DEFAULT_CROP_REGION.height;
	const normalizedWebcamOverride = normalizePartialWebcamRegion(editor.webcamRegion);
	const normalizedWebcamEffects = normalizePartialWebcamEffects(
		(editor as Partial<ProjectEditorState>).webcamEffects,
	);

	const cropX = clamp(rawCropX, 0, 1);
	const cropY = clamp(rawCropY, 0, 1);
	const cropWidth = clamp(rawCropWidth, 0.01, 1 - cropX);
	const cropHeight = clamp(rawCropHeight, 0.01, 1 - cropY);
	const hasFullFrameCrop =
		cropX === DEFAULT_CROP_REGION.x &&
		cropY === DEFAULT_CROP_REGION.y &&
		cropWidth === DEFAULT_CROP_REGION.width &&
		cropHeight === DEFAULT_CROP_REGION.height;
	const normalizedAspectRatio: AspectRatio =
		typeof editor.aspectRatio === "string" &&
		(validAspectRatios.has(editor.aspectRatio as AspectRatio) ||
			isCustomAspectRatio(editor.aspectRatio))
			? (editor.aspectRatio as AspectRatio)
			: "16:9";
	const rawPadding = isFiniteNumber(editor.padding)
		? clamp(editor.padding, 0, 100)
		: DEFAULT_VIDEO_PREVIEW_PADDING;
	const normalizedPadding =
		hasFullFrameCrop &&
		(normalizedAspectRatio === "native" || normalizedAspectRatio === "16:9") &&
		rawPadding === 50
			? 0
			: rawPadding;
	const legacyShadowIntensity = isFiniteNumber(editor.shadowIntensity)
		? clamp(editor.shadowIntensity, 0, 1)
		: undefined;
	const defaultShadow =
		legacyShadowIntensity != null
			? getFrameShadowFromLegacyIntensity(legacyShadowIntensity)
			: {
					size: DEFAULT_FRAME_SHADOW_SIZE,
					opacity: DEFAULT_FRAME_SHADOW_OPACITY,
					blur: DEFAULT_FRAME_SHADOW_BLUR,
				};
	const normalizedFrameShadow = {
		size: isFiniteNumber((editor as Partial<ProjectEditorState>).frameShadowSize)
			? clamp((editor as Partial<ProjectEditorState>).frameShadowSize as number, 0, 48)
			: defaultShadow.size,
		opacity: isFiniteNumber((editor as Partial<ProjectEditorState>).frameShadowOpacity)
			? clamp((editor as Partial<ProjectEditorState>).frameShadowOpacity as number, 0, 1)
			: defaultShadow.opacity,
		blur: isFiniteNumber((editor as Partial<ProjectEditorState>).frameShadowBlur)
			? clamp((editor as Partial<ProjectEditorState>).frameShadowBlur as number, 0, 96)
			: defaultShadow.blur,
	};
	const normalizedFrameBorderColor =
		normalizeHexColor((editor as Partial<ProjectEditorState>).frameBorderColor ?? "") ??
		DEFAULT_FRAME_BORDER_COLOR;
	const normalizedFrameBorder = {
		enabled:
			typeof (editor as Partial<ProjectEditorState>).frameBorderEnabled === "boolean"
				? ((editor as Partial<ProjectEditorState>).frameBorderEnabled as boolean)
				: DEFAULT_FRAME_BORDER_ENABLED,
		width: isFiniteNumber((editor as Partial<ProjectEditorState>).frameBorderWidth)
			? clamp((editor as Partial<ProjectEditorState>).frameBorderWidth as number, 0, 20)
			: DEFAULT_FRAME_BORDER_WIDTH,
		color: normalizedFrameBorderColor,
		opacity: isFiniteNumber((editor as Partial<ProjectEditorState>).frameBorderOpacity)
			? clamp((editor as Partial<ProjectEditorState>).frameBorderOpacity as number, 0, 1)
			: DEFAULT_FRAME_BORDER_OPACITY,
	};
	const normalizedShadowIntensity =
		legacyShadowIntensity ?? getLegacyShadowIntensityFromFrameShadow(normalizedFrameShadow);
	const cursorV2Fields = resolveCursorV2Fields({
		cursorTypeMode: (editor as Partial<ProjectEditorState>).cursorTypeMode,
		cursorTilt: (editor as Partial<ProjectEditorState>).cursorTilt,
		hideWhenIdle: (editor as Partial<ProjectEditorState>).hideWhenIdle,
		idleHideDelayMs: (editor as Partial<ProjectEditorState>).idleHideDelayMs,
		smoothMovementEnabled: (editor as Partial<ProjectEditorState>).smoothMovementEnabled,
		cursorMovementStyle: (editor as Partial<ProjectEditorState>).cursorMovementStyle,
		cursorSpring: (editor as Partial<ProjectEditorState>).cursorSpring,
		highQualitySvgCursors: (editor as Partial<ProjectEditorState>).highQualitySvgCursors,
		legacyCursorSmoothing: editor.cursorSmoothing,
		legacyCursorSway: (editor as Partial<ProjectEditorState>).cursorSway,
	});

	return {
		wallpaper:
			typeof editor.wallpaper === "string"
				? normalizeWallpaperSelection(editor.wallpaper)
				: WALLPAPER_PATHS[0],
		hideBackground: typeof editor.hideBackground === "boolean" ? editor.hideBackground : false,
		shadowIntensity: normalizedShadowIntensity,
		frameShadowSize: normalizedFrameShadow.size,
		frameShadowOpacity: normalizedFrameShadow.opacity,
		frameShadowBlur: normalizedFrameShadow.blur,
		backgroundBlur: normalizedBackgroundBlur,
		zoomMotionBlur: normalizedZoomMotionBlur,
		zoomTemporalBlur: normalizeZoomTemporalBlur(editor.zoomTemporalBlur),
		connectZooms: typeof editor.connectZooms === "boolean" ? editor.connectZooms : true,
		zoomTiming: normalizeZoomTiming(editor.zoomTiming),
		showCursor: typeof editor.showCursor === "boolean" ? editor.showCursor : true,
		loopCursor: typeof editor.loopCursor === "boolean" ? editor.loopCursor : false,
		cursorSize: isFiniteNumber(editor.cursorSize)
			? clamp(editor.cursorSize, 0.5, 10)
			: DEFAULT_CURSOR_SIZE,
		cursorSmoothing: isFiniteNumber(editor.cursorSmoothing)
			? clamp(editor.cursorSmoothing, 0, 2)
			: DEFAULT_CURSOR_SMOOTHING,
		cursorMotionBlur: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorMotionBlur)
			? clamp((editor as Partial<ProjectEditorState>).cursorMotionBlur as number, 0, 5)
			: DEFAULT_CURSOR_MOTION_BLUR,
		cursorClickBounce: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorClickBounce)
			? clamp((editor as Partial<ProjectEditorState>).cursorClickBounce as number, 0, 5)
			: DEFAULT_CURSOR_CLICK_BOUNCE,
		cursorSway: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorSway)
			? clamp((editor as Partial<ProjectEditorState>).cursorSway as number, 0, 2)
			: DEFAULT_CURSOR_SWAY,
		cursorStyle:
			typeof editor.cursorStyle === "string" &&
			["default", "dot", "crosshair", "circle", "ring"].includes(editor.cursorStyle)
				? (editor.cursorStyle as CursorStyle)
				: DEFAULT_CURSOR_STYLE,
		cursorPack:
			typeof editor.cursorPack === "string" &&
			CURSOR_PACK_OPTIONS.some((opt) => opt.value === editor.cursorPack)
				? (editor.cursorPack as CursorPack)
				: DEFAULT_CURSOR_PACK,
		cursorTypeMode: cursorV2Fields.cursorTypeMode,
		cursorTilt: cursorV2Fields.cursorTilt,
		hideWhenIdle: cursorV2Fields.hideWhenIdle,
		idleHideDelayMs: cursorV2Fields.idleHideDelayMs,
		smoothMovementEnabled: cursorV2Fields.smoothMovementEnabled,
		cursorMovementStyle: cursorV2Fields.cursorMovementStyle,
		cursorSpring: normalizeCursorSpring(cursorV2Fields.cursorSpring, DEFAULT_CURSOR_SPRING),
		cameraSpring: normalizeCameraSpring((editor as Partial<ProjectEditorState>).cameraSpring),
		highQualitySvgCursors: cursorV2Fields.highQualitySvgCursors,
		cursorColor: typeof editor.cursorColor === "string" ? editor.cursorColor : DEFAULT_CURSOR_COLOR,
		cursorOpacity: isFiniteNumber(editor.cursorOpacity)
			? clamp(editor.cursorOpacity, 0, 1)
			: DEFAULT_CURSOR_OPACITY,
		clickEffectsEnabled:
			typeof editor.clickEffectsEnabled === "boolean"
				? editor.clickEffectsEnabled
				: DEFAULT_CLICK_EFFECTS_ENABLED,
		clickHighlightColor:
			typeof editor.clickHighlightColor === "string"
				? editor.clickHighlightColor
				: DEFAULT_CLICK_HIGHLIGHT_COLOR,
		clickHighlightSize: isFiniteNumber(editor.clickHighlightSize)
			? clamp(editor.clickHighlightSize, 0, 3)
			: DEFAULT_CLICK_HIGHLIGHT_SIZE,
		clickHighlightOpacity: isFiniteNumber(editor.clickHighlightOpacity)
			? clamp(editor.clickHighlightOpacity, 0, 1)
			: DEFAULT_CLICK_HIGHLIGHT_OPACITY,
		cursorClickStyle: normalizeCursorClickStyle(editor.cursorClickStyle),
		cursorTrailLength: isFiniteNumber(editor.cursorTrailLength)
			? clamp(editor.cursorTrailLength, 0, 20)
			: DEFAULT_CURSOR_TRAIL_LENGTH,
		cursorTrailOpacity: isFiniteNumber(editor.cursorTrailOpacity)
			? clamp(editor.cursorTrailOpacity, 0, 1)
			: DEFAULT_CURSOR_TRAIL_OPACITY,
		showKeyboardShortcuts:
			typeof editor.showKeyboardShortcuts === "boolean"
				? editor.showKeyboardShortcuts
				: DEFAULT_SHOW_KEYBOARD_SHORTCUTS,
		keyboardShortcutPosition:
			editor.keyboardShortcutPosition === "top-left" ||
			editor.keyboardShortcutPosition === "top-center" ||
			editor.keyboardShortcutPosition === "top-right" ||
			editor.keyboardShortcutPosition === "bottom-left" ||
			editor.keyboardShortcutPosition === "bottom-center" ||
			editor.keyboardShortcutPosition === "bottom-right"
				? editor.keyboardShortcutPosition
				: DEFAULT_KEYBOARD_SHORTCUT_POSITION,
		keyboardShortcutTheme:
			editor.keyboardShortcutTheme === "dark" ||
			editor.keyboardShortcutTheme === "light" ||
			editor.keyboardShortcutTheme === "glass"
				? editor.keyboardShortcutTheme
				: DEFAULT_KEYBOARD_SHORTCUT_THEME,
		keyboardShortcutScale: isFiniteNumber(editor.keyboardShortcutScale)
			? clamp(editor.keyboardShortcutScale, 0.5, 2)
			: DEFAULT_KEYBOARD_SHORTCUT_SCALE,
		keyboardShortcutOpacity: isFiniteNumber(editor.keyboardShortcutOpacity)
			? clamp(editor.keyboardShortcutOpacity, 0, 1)
			: DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
		keyboardShortcutDisplayMs: isFiniteNumber(editor.keyboardShortcutDisplayMs)
			? clamp(editor.keyboardShortcutDisplayMs, 250, 4000)
			: DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
		keyboardShortcutMaxVisible: isFiniteNumber(editor.keyboardShortcutMaxVisible)
			? clamp(Math.round(editor.keyboardShortcutMaxVisible), 1, 3)
			: DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
		deviceMockup:
			typeof editor.deviceMockup === "string" &&
			DEVICE_MOCKUP_OPTIONS.some((opt) => opt.value === editor.deviceMockup)
				? (editor.deviceMockup as DeviceMockup)
				: DEFAULT_DEVICE_MOCKUP,
		frameBorderEnabled: normalizedFrameBorder.enabled,
		frameBorderWidth: normalizedFrameBorder.width,
		frameBorderColor: normalizedFrameBorder.color,
		frameBorderOpacity: normalizedFrameBorder.opacity,
		borderRadius: typeof editor.borderRadius === "number" ? editor.borderRadius : 12.5,
		padding: normalizedPadding,
		paddingSides: normalizePaddingSides(editor.paddingSides),
		cropRegion: foldLegacyLayerCrop(
			{ x: cropX, y: cropY, width: cropWidth, height: cropHeight },
			(editor as { layers?: unknown }).layers,
		),
		zoomRegions: normalizedZoomRegions,
		trimRegions: normalizedTrimRegions,
		cutPoints: normalizedCutPoints,
		speedRegions: normalizedSpeedRegions,
		annotationRegions: normalizedAnnotationRegions,
		audioRegions: normalizedAudioRegions,
		aspectRatio: normalizedAspectRatio,
		exportFormat: editor.exportFormat === "gif" ? "gif" : "mp4",
		exportDestination:
			editor.exportDestination === "clipboard" || editor.exportDestination === "link"
				? editor.exportDestination
				: "file",
		videoExportSettings: normalizedVideoExportSettings,
		gifExportSettings: normalizedGifExportSettings,
		webcamPath: typeof editor.webcamPath === "string" ? editor.webcamPath : undefined,
		webcamRegion: normalizeWebcamRegion({
			...DEFAULT_WEBCAM_REGION,
			...normalizedWebcamOverride,
			position: {
				...DEFAULT_WEBCAM_REGION.position,
				...normalizedWebcamOverride?.position,
			},
			size: {
				...DEFAULT_WEBCAM_REGION.size,
				...normalizedWebcamOverride?.size,
			},
		}),
		webcamEffects: normalizeWebcamEffects({
			...DEFAULT_WEBCAM_EFFECTS,
			...normalizedWebcamEffects,
			portraitOffset: {
				...DEFAULT_WEBCAM_EFFECTS.portraitOffset,
				...normalizedWebcamEffects?.portraitOffset,
			},
		}),
		webcamPreviewMode:
			editor.webcamPreviewMode === "performance" ||
			editor.webcamPreviewMode === "power-saving" ||
			editor.webcamPreviewMode === "exact"
				? editor.webcamPreviewMode
				: DEFAULT_WEBCAM_PREVIEW_MODE,
		showWebcam: typeof editor.showWebcam === "boolean" ? editor.showWebcam : true,
		mirrorWebcam: typeof editor.mirrorWebcam === "boolean" ? editor.mirrorWebcam : false,
		cameraSizeDuringZoom: isFiniteNumber(editor.cameraSizeDuringZoom)
			? clamp(editor.cameraSizeDuringZoom, 0.25, 1)
			: DEFAULT_CAMERA_SIZE_DURING_ZOOM,
		cameraLayouts: normalizeCameraLayouts(editor.cameraLayouts),
		captionTrack: normalizedCaptionTrack,
		captionSettings: normalizeCaptionSettings(editor.captionSettings),
		captionGenerationOptions: normalizeCaptionGenerationOptions(
			(editor as Partial<ProjectEditorState>).captionGenerationOptions,
		),
		scenePresetId:
			typeof editor.scenePresetId === "string" &&
			SCENE_PRESET_IDS.includes(editor.scenePresetId as ScenePresetId)
				? (editor.scenePresetId as ScenePresetId)
				: undefined,
		audioMix: normalizedAudioMix,
	};
}

export function createProjectData(
	videoPath: string,
	editor: ProjectEditorState,
	webcamSessionMetadata?: WebcamSessionMetadata,
	videoName?: string,
): EditorProjectData {
	const normalizedEditor = normalizeProjectEditor(editor);
	return {
		version: PROJECT_VERSION,
		videoPath,
		...(videoName ? { videoName } : {}),
		editor: normalizedEditor,
		webcamSessionMetadata,
	};
}
