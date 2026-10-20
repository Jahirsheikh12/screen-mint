import type {
	ExportFormat,
	ExportQuality,
	GifSizePreset,
	QuickGifSettings,
	QuickVideoSettings,
} from "@/lib/exporter";
import {
	DEFAULT_QUICK_GIF_SETTINGS,
	DEFAULT_QUICK_VIDEO_SETTINGS,
	mapLegacyExportQualityToVideoSettings,
	mapLegacyGifSizePreset,
	normalizeQuickGifSettings,
	normalizeQuickVideoSettings,
} from "@/lib/exporter";
import { normalizeProjectEditor, type ProjectEditorState } from "./projectPersistence";
import {
	DEFAULT_PREVIEW_QUALITY,
	DEFAULT_WEBCAM_PREVIEW_MODE,
	type PreviewQuality,
	type WebcamPreviewMode,
} from "./types";

type PersistedEditorControls = Pick<
	ProjectEditorState,
	| "wallpaper"
	| "hideBackground"
	| "shadowIntensity"
	| "frameShadowSize"
	| "frameShadowOpacity"
	| "frameShadowBlur"
	| "backgroundBlur"
	| "zoomMotionBlur"
	| "zoomTemporalBlur"
	| "connectZooms"
	| "zoomTiming"
	| "showCursor"
	| "loopCursor"
	| "cursorSize"
	| "cursorSmoothing"
	| "cursorMotionBlur"
	| "cursorClickBounce"
	| "cursorSway"
	| "cursorStyle"
	| "cursorPack"
	| "cursorTypeMode"
	| "cursorTilt"
	| "hideWhenIdle"
	| "idleHideDelayMs"
	| "smoothMovementEnabled"
	| "cursorMovementStyle"
	| "cursorSpring"
	| "cameraSpring"
	| "highQualitySvgCursors"
	| "cursorColor"
	| "cursorOpacity"
	| "clickEffectsEnabled"
	| "clickHighlightColor"
	| "clickHighlightSize"
	| "clickHighlightOpacity"
	| "cursorClickStyle"
	| "cursorTrailLength"
	| "cursorTrailOpacity"
	| "showKeyboardShortcuts"
	| "keyboardShortcutPosition"
	| "keyboardShortcutTheme"
	| "keyboardShortcutScale"
	| "keyboardShortcutOpacity"
	| "keyboardShortcutDisplayMs"
	| "keyboardShortcutMaxVisible"
	| "deviceMockup"
	| "frameBorderEnabled"
	| "frameBorderWidth"
	| "frameBorderColor"
	| "frameBorderOpacity"
	| "borderRadius"
	| "padding"
	| "paddingSides"
	| "cropRegion"
	| "aspectRatio"
	| "webcamRegion"
	| "webcamEffects"
	| "webcamPreviewMode"
	| "showWebcam"
	| "mirrorWebcam"
	| "cameraSizeDuringZoom"
	| "exportFormat"
	| "exportDestination"
	| "videoExportSettings"
	| "gifExportSettings"
>;

type PartialEditorControls = Partial<PersistedEditorControls>;

export type EditorWorkspaceLayout = "default" | "preview-focus" | "timeline-focus";

export interface EditorPreset {
	id: string;
	name: string;
	controls: PersistedEditorControls;
}

/** Last choices made in the Export menu; remembered across sessions like preview quality. */
export interface QuickExportPreferences {
	format: ExportFormat;
	video: QuickVideoSettings;
	gif: QuickGifSettings;
}

export const DEFAULT_QUICK_EXPORT_PREFERENCES: QuickExportPreferences = {
	format: "mp4",
	video: DEFAULT_QUICK_VIDEO_SETTINGS,
	gif: DEFAULT_QUICK_GIF_SETTINGS,
};

export function normalizeQuickExportPreferences(raw: unknown): QuickExportPreferences {
	const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	return {
		format: value.format === "gif" ? "gif" : "mp4",
		video: normalizeQuickVideoSettings(value.video),
		gif: normalizeQuickGifSettings(value.gif),
	};
}

export interface EditorPreferences extends PersistedEditorControls {
	previewQuality: PreviewQuality;
	quickExport: QuickExportPreferences;
	customAspectWidth: string;
	customAspectHeight: string;
	customWallpapers: string[];
	workspaceLayout: EditorWorkspaceLayout;
	presets: EditorPreset[];
}

export interface EditorPreferencesService {
	load(): EditorPreferences;
	save(preferences: Partial<EditorPreferences>): void;
	scheduleSave(preferences: Partial<EditorPreferences>): void;
	flush(): void;
	cancel(): void;
}

export const EDITOR_PREFERENCES_STORAGE_KEY = "screenmint.editor.preferences";

const DEFAULT_EDITOR_CONTROLS = normalizeProjectEditor({});

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
	wallpaper: DEFAULT_EDITOR_CONTROLS.wallpaper,
	hideBackground: DEFAULT_EDITOR_CONTROLS.hideBackground,
	shadowIntensity: DEFAULT_EDITOR_CONTROLS.shadowIntensity,
	frameShadowSize: DEFAULT_EDITOR_CONTROLS.frameShadowSize,
	frameShadowOpacity: DEFAULT_EDITOR_CONTROLS.frameShadowOpacity,
	frameShadowBlur: DEFAULT_EDITOR_CONTROLS.frameShadowBlur,
	backgroundBlur: DEFAULT_EDITOR_CONTROLS.backgroundBlur,
	zoomMotionBlur: DEFAULT_EDITOR_CONTROLS.zoomMotionBlur,
	zoomTemporalBlur: DEFAULT_EDITOR_CONTROLS.zoomTemporalBlur,
	connectZooms: DEFAULT_EDITOR_CONTROLS.connectZooms,
	zoomTiming: DEFAULT_EDITOR_CONTROLS.zoomTiming,
	showCursor: DEFAULT_EDITOR_CONTROLS.showCursor,
	loopCursor: DEFAULT_EDITOR_CONTROLS.loopCursor,
	cursorSize: DEFAULT_EDITOR_CONTROLS.cursorSize,
	cursorSmoothing: DEFAULT_EDITOR_CONTROLS.cursorSmoothing,
	cursorMotionBlur: DEFAULT_EDITOR_CONTROLS.cursorMotionBlur,
	cursorClickBounce: DEFAULT_EDITOR_CONTROLS.cursorClickBounce,
	cursorSway: DEFAULT_EDITOR_CONTROLS.cursorSway,
	cursorStyle: DEFAULT_EDITOR_CONTROLS.cursorStyle,
	cursorPack: DEFAULT_EDITOR_CONTROLS.cursorPack,
	cursorTypeMode: DEFAULT_EDITOR_CONTROLS.cursorTypeMode,
	cursorTilt: DEFAULT_EDITOR_CONTROLS.cursorTilt,
	hideWhenIdle: DEFAULT_EDITOR_CONTROLS.hideWhenIdle,
	idleHideDelayMs: DEFAULT_EDITOR_CONTROLS.idleHideDelayMs,
	smoothMovementEnabled: DEFAULT_EDITOR_CONTROLS.smoothMovementEnabled,
	cursorMovementStyle: DEFAULT_EDITOR_CONTROLS.cursorMovementStyle,
	cursorSpring: DEFAULT_EDITOR_CONTROLS.cursorSpring,
	cameraSpring: DEFAULT_EDITOR_CONTROLS.cameraSpring,
	highQualitySvgCursors: DEFAULT_EDITOR_CONTROLS.highQualitySvgCursors,
	cursorColor: DEFAULT_EDITOR_CONTROLS.cursorColor,
	cursorOpacity: DEFAULT_EDITOR_CONTROLS.cursorOpacity,
	clickEffectsEnabled: DEFAULT_EDITOR_CONTROLS.clickEffectsEnabled,
	clickHighlightColor: DEFAULT_EDITOR_CONTROLS.clickHighlightColor,
	clickHighlightSize: DEFAULT_EDITOR_CONTROLS.clickHighlightSize,
	clickHighlightOpacity: DEFAULT_EDITOR_CONTROLS.clickHighlightOpacity,
	cursorClickStyle: DEFAULT_EDITOR_CONTROLS.cursorClickStyle,
	cursorTrailLength: DEFAULT_EDITOR_CONTROLS.cursorTrailLength,
	cursorTrailOpacity: DEFAULT_EDITOR_CONTROLS.cursorTrailOpacity,
	showKeyboardShortcuts: DEFAULT_EDITOR_CONTROLS.showKeyboardShortcuts,
	keyboardShortcutPosition: DEFAULT_EDITOR_CONTROLS.keyboardShortcutPosition,
	keyboardShortcutTheme: DEFAULT_EDITOR_CONTROLS.keyboardShortcutTheme,
	keyboardShortcutScale: DEFAULT_EDITOR_CONTROLS.keyboardShortcutScale,
	keyboardShortcutOpacity: DEFAULT_EDITOR_CONTROLS.keyboardShortcutOpacity,
	keyboardShortcutDisplayMs: DEFAULT_EDITOR_CONTROLS.keyboardShortcutDisplayMs,
	keyboardShortcutMaxVisible: DEFAULT_EDITOR_CONTROLS.keyboardShortcutMaxVisible,
	deviceMockup: DEFAULT_EDITOR_CONTROLS.deviceMockup,
	frameBorderEnabled: DEFAULT_EDITOR_CONTROLS.frameBorderEnabled,
	frameBorderWidth: DEFAULT_EDITOR_CONTROLS.frameBorderWidth,
	frameBorderColor: DEFAULT_EDITOR_CONTROLS.frameBorderColor,
	frameBorderOpacity: DEFAULT_EDITOR_CONTROLS.frameBorderOpacity,
	borderRadius: DEFAULT_EDITOR_CONTROLS.borderRadius,
	padding: DEFAULT_EDITOR_CONTROLS.padding,
	paddingSides: DEFAULT_EDITOR_CONTROLS.paddingSides,
	cropRegion: DEFAULT_EDITOR_CONTROLS.cropRegion,
	aspectRatio: DEFAULT_EDITOR_CONTROLS.aspectRatio,
	webcamRegion: DEFAULT_EDITOR_CONTROLS.webcamRegion,
	webcamEffects: DEFAULT_EDITOR_CONTROLS.webcamEffects,
	webcamPreviewMode: DEFAULT_EDITOR_CONTROLS.webcamPreviewMode,
	showWebcam: DEFAULT_EDITOR_CONTROLS.showWebcam,
	mirrorWebcam: DEFAULT_EDITOR_CONTROLS.mirrorWebcam,
	cameraSizeDuringZoom: DEFAULT_EDITOR_CONTROLS.cameraSizeDuringZoom,
	exportFormat: DEFAULT_EDITOR_CONTROLS.exportFormat,
	exportDestination: DEFAULT_EDITOR_CONTROLS.exportDestination,
	videoExportSettings: DEFAULT_EDITOR_CONTROLS.videoExportSettings,
	gifExportSettings: DEFAULT_EDITOR_CONTROLS.gifExportSettings,
	previewQuality: DEFAULT_PREVIEW_QUALITY,
	quickExport: DEFAULT_QUICK_EXPORT_PREFERENCES,
	customAspectWidth: "16",
	customAspectHeight: "9",
	customWallpapers: [],
	workspaceLayout: "preview-focus",
	presets: [],
};

function normalizePositiveIntegerString(value: unknown, fallback: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return String(parsed);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function normalizeCropRegion(
	value: unknown,
	fallback: EditorPreferences["cropRegion"],
): EditorPreferences["cropRegion"] {
	if (!value || typeof value !== "object") {
		return fallback;
	}

	const raw = value as Partial<EditorPreferences["cropRegion"]>;
	const x = isFiniteNumber(raw.x) && raw.x >= 0 && raw.x < 1 ? raw.x : fallback.x;
	const y = isFiniteNumber(raw.y) && raw.y >= 0 && raw.y < 1 ? raw.y : fallback.y;
	const maxWidth = 1 - x;
	const maxHeight = 1 - y;
	const fallbackWidth = clamp(fallback.width, 0.01, maxWidth);
	const fallbackHeight = clamp(fallback.height, 0.01, maxHeight);
	const width =
		isFiniteNumber(raw.width) && raw.width >= 0.01 && raw.width <= maxWidth
			? raw.width
			: fallbackWidth;
	const height =
		isFiniteNumber(raw.height) && raw.height >= 0.01 && raw.height <= maxHeight
			? raw.height
			: fallbackHeight;

	return { x, y, width, height };
}

function normalizeCustomWallpapers(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) {
		return fallback;
	}

	return Array.from(
		new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)),
	);
}

function normalizeWorkspaceLayout(
	value: unknown,
	fallback: EditorWorkspaceLayout,
): EditorWorkspaceLayout {
	return value === "preview-focus" || value === "timeline-focus" || value === "default"
		? value
		: fallback;
}

function normalizePreviewQuality(value: unknown, fallback: PreviewQuality): PreviewQuality {
	return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function normalizeWebcamPreviewMode(
	value: unknown,
	fallback: WebcamPreviewMode,
): WebcamPreviewMode {
	return value === "performance" || value === "power-saving" || value === "exact"
		? value
		: fallback;
}

function normalizeEditorControls(
	raw: Partial<EditorPreferences>,
	fallback: EditorPreferences,
): PersistedEditorControls {
	const legacyRaw = raw as Partial<EditorPreferences> & {
		exportQuality?: ExportQuality;
		gifFrameRate?: number;
		gifLoop?: boolean;
		gifSizePreset?: GifSizePreset;
	};
	const candidateAspectRatio = raw.aspectRatio ?? fallback.aspectRatio;
	const candidatePadding =
		raw.padding ??
		(raw.aspectRatio === "native" && raw.padding == null ? undefined : fallback.padding);

	const candidate: PartialEditorControls = {
		wallpaper: raw.wallpaper ?? fallback.wallpaper,
		hideBackground: raw.hideBackground ?? fallback.hideBackground,
		shadowIntensity: raw.shadowIntensity ?? fallback.shadowIntensity,
		frameShadowSize: raw.frameShadowSize ?? fallback.frameShadowSize,
		frameShadowOpacity: raw.frameShadowOpacity ?? fallback.frameShadowOpacity,
		frameShadowBlur: raw.frameShadowBlur ?? fallback.frameShadowBlur,
		backgroundBlur: raw.backgroundBlur ?? fallback.backgroundBlur,
		zoomMotionBlur: raw.zoomMotionBlur ?? fallback.zoomMotionBlur,
		zoomTemporalBlur: raw.zoomTemporalBlur ?? fallback.zoomTemporalBlur,
		connectZooms: raw.connectZooms ?? fallback.connectZooms,
		zoomTiming: raw.zoomTiming ?? fallback.zoomTiming,
		showCursor: raw.showCursor ?? fallback.showCursor,
		loopCursor: raw.loopCursor ?? fallback.loopCursor,
		cursorSize: raw.cursorSize ?? fallback.cursorSize,
		cursorSmoothing: raw.cursorSmoothing ?? fallback.cursorSmoothing,
		cursorMotionBlur: raw.cursorMotionBlur ?? fallback.cursorMotionBlur,
		cursorClickBounce: raw.cursorClickBounce ?? fallback.cursorClickBounce,
		cursorSway: raw.cursorSway ?? fallback.cursorSway,
		cursorStyle: raw.cursorStyle ?? fallback.cursorStyle,
		cursorPack: raw.cursorPack ?? fallback.cursorPack,
		cursorTypeMode: raw.cursorTypeMode ?? fallback.cursorTypeMode,
		cursorTilt: raw.cursorTilt ?? fallback.cursorTilt,
		hideWhenIdle: raw.hideWhenIdle ?? fallback.hideWhenIdle,
		idleHideDelayMs: raw.idleHideDelayMs ?? fallback.idleHideDelayMs,
		smoothMovementEnabled: raw.smoothMovementEnabled ?? fallback.smoothMovementEnabled,
		cursorMovementStyle: raw.cursorMovementStyle ?? fallback.cursorMovementStyle,
		cursorSpring: raw.cursorSpring ?? fallback.cursorSpring,
		cameraSpring: raw.cameraSpring ?? fallback.cameraSpring,
		highQualitySvgCursors: raw.highQualitySvgCursors ?? fallback.highQualitySvgCursors,
		cursorColor: raw.cursorColor ?? fallback.cursorColor,
		cursorOpacity: raw.cursorOpacity ?? fallback.cursorOpacity,
		clickEffectsEnabled: raw.clickEffectsEnabled ?? fallback.clickEffectsEnabled,
		clickHighlightColor: raw.clickHighlightColor ?? fallback.clickHighlightColor,
		clickHighlightSize: raw.clickHighlightSize ?? fallback.clickHighlightSize,
		clickHighlightOpacity: raw.clickHighlightOpacity ?? fallback.clickHighlightOpacity,
		cursorClickStyle: raw.cursorClickStyle ?? fallback.cursorClickStyle,
		cursorTrailLength: raw.cursorTrailLength ?? fallback.cursorTrailLength,
		cursorTrailOpacity: raw.cursorTrailOpacity ?? fallback.cursorTrailOpacity,
		showKeyboardShortcuts: raw.showKeyboardShortcuts ?? fallback.showKeyboardShortcuts,
		keyboardShortcutPosition: raw.keyboardShortcutPosition ?? fallback.keyboardShortcutPosition,
		keyboardShortcutTheme: raw.keyboardShortcutTheme ?? fallback.keyboardShortcutTheme,
		keyboardShortcutScale: raw.keyboardShortcutScale ?? fallback.keyboardShortcutScale,
		keyboardShortcutOpacity: raw.keyboardShortcutOpacity ?? fallback.keyboardShortcutOpacity,
		keyboardShortcutDisplayMs: raw.keyboardShortcutDisplayMs ?? fallback.keyboardShortcutDisplayMs,
		keyboardShortcutMaxVisible:
			raw.keyboardShortcutMaxVisible ?? fallback.keyboardShortcutMaxVisible,
		deviceMockup: raw.deviceMockup ?? fallback.deviceMockup,
		frameBorderEnabled: raw.frameBorderEnabled ?? fallback.frameBorderEnabled,
		frameBorderWidth: raw.frameBorderWidth ?? fallback.frameBorderWidth,
		frameBorderColor: raw.frameBorderColor ?? fallback.frameBorderColor,
		frameBorderOpacity: raw.frameBorderOpacity ?? fallback.frameBorderOpacity,
		borderRadius: raw.borderRadius ?? fallback.borderRadius,
		padding: candidatePadding,
		paddingSides: raw.paddingSides ?? fallback.paddingSides,
		cropRegion: normalizeCropRegion(raw.cropRegion, fallback.cropRegion),
		aspectRatio: candidateAspectRatio,
		webcamRegion: raw.webcamRegion ?? fallback.webcamRegion,
		webcamEffects: raw.webcamEffects ?? fallback.webcamEffects,
		webcamPreviewMode: raw.webcamPreviewMode ?? fallback.webcamPreviewMode,
		showWebcam: raw.showWebcam ?? fallback.showWebcam,
		mirrorWebcam: raw.mirrorWebcam ?? fallback.mirrorWebcam,
		cameraSizeDuringZoom: raw.cameraSizeDuringZoom ?? fallback.cameraSizeDuringZoom,
		exportFormat: raw.exportFormat ?? fallback.exportFormat,
		exportDestination: raw.exportDestination ?? fallback.exportDestination,
		videoExportSettings:
			raw.videoExportSettings ?? mapLegacyExportQualityToVideoSettings(legacyRaw.exportQuality),
		gifExportSettings: raw.gifExportSettings ?? {
			...fallback.gifExportSettings,
			frameRate:
				legacyRaw.gifFrameRate === 15 ||
				legacyRaw.gifFrameRate === 20 ||
				legacyRaw.gifFrameRate === 25 ||
				legacyRaw.gifFrameRate === 30
					? legacyRaw.gifFrameRate
					: fallback.gifExportSettings.frameRate,
			loop:
				typeof legacyRaw.gifLoop === "boolean"
					? legacyRaw.gifLoop
					: fallback.gifExportSettings.loop,
			preset: mapLegacyGifSizePreset(legacyRaw.gifSizePreset),
		},
	};

	const normalized = normalizeProjectEditor(candidate);

	return {
		wallpaper: normalized.wallpaper,
		hideBackground: normalized.hideBackground,
		shadowIntensity: normalized.shadowIntensity,
		frameShadowSize: normalized.frameShadowSize,
		frameShadowOpacity: normalized.frameShadowOpacity,
		frameShadowBlur: normalized.frameShadowBlur,
		backgroundBlur: normalized.backgroundBlur,
		zoomMotionBlur: normalized.zoomMotionBlur,
		zoomTemporalBlur: normalized.zoomTemporalBlur,
		connectZooms: normalized.connectZooms,
		zoomTiming: normalized.zoomTiming,
		showCursor: normalized.showCursor,
		loopCursor: normalized.loopCursor,
		cursorSize: normalized.cursorSize,
		cursorSmoothing: normalized.cursorSmoothing,
		cursorMotionBlur: normalized.cursorMotionBlur,
		cursorClickBounce: normalized.cursorClickBounce,
		cursorSway: normalized.cursorSway,
		cursorStyle: normalized.cursorStyle,
		cursorPack: normalized.cursorPack,
		cursorTypeMode: normalized.cursorTypeMode,
		cursorTilt: normalized.cursorTilt,
		hideWhenIdle: normalized.hideWhenIdle,
		idleHideDelayMs: normalized.idleHideDelayMs,
		smoothMovementEnabled: normalized.smoothMovementEnabled,
		cursorMovementStyle: normalized.cursorMovementStyle,
		cursorSpring: normalized.cursorSpring,
		cameraSpring: normalized.cameraSpring,
		highQualitySvgCursors: normalized.highQualitySvgCursors,
		cursorColor: normalized.cursorColor,
		cursorOpacity: normalized.cursorOpacity,
		clickEffectsEnabled: normalized.clickEffectsEnabled,
		clickHighlightColor: normalized.clickHighlightColor,
		clickHighlightSize: normalized.clickHighlightSize,
		clickHighlightOpacity: normalized.clickHighlightOpacity,
		cursorClickStyle: normalized.cursorClickStyle,
		cursorTrailLength: normalized.cursorTrailLength,
		cursorTrailOpacity: normalized.cursorTrailOpacity,
		showKeyboardShortcuts: normalized.showKeyboardShortcuts,
		keyboardShortcutPosition: normalized.keyboardShortcutPosition,
		keyboardShortcutTheme: normalized.keyboardShortcutTheme,
		keyboardShortcutScale: normalized.keyboardShortcutScale,
		keyboardShortcutOpacity: normalized.keyboardShortcutOpacity,
		keyboardShortcutDisplayMs: normalized.keyboardShortcutDisplayMs,
		keyboardShortcutMaxVisible: normalized.keyboardShortcutMaxVisible,
		deviceMockup: normalized.deviceMockup,
		frameBorderEnabled: normalized.frameBorderEnabled,
		frameBorderWidth: normalized.frameBorderWidth,
		frameBorderColor: normalized.frameBorderColor,
		frameBorderOpacity: normalized.frameBorderOpacity,
		borderRadius: normalized.borderRadius,
		padding: normalized.padding,
		paddingSides: normalized.paddingSides,
		cropRegion: normalized.cropRegion,
		aspectRatio: normalized.aspectRatio,
		webcamRegion: normalized.webcamRegion,
		webcamEffects: normalized.webcamEffects,
		webcamPreviewMode: normalizeWebcamPreviewMode(
			normalized.webcamPreviewMode,
			fallback.webcamPreviewMode ?? DEFAULT_WEBCAM_PREVIEW_MODE,
		),
		showWebcam: normalized.showWebcam,
		mirrorWebcam: normalized.mirrorWebcam,
		cameraSizeDuringZoom: normalized.cameraSizeDuringZoom,
		exportFormat: normalized.exportFormat,
		exportDestination: normalized.exportDestination,
		videoExportSettings: normalized.videoExportSettings,
		gifExportSettings: normalized.gifExportSettings,
	};
}

export function normalizeEditorPreferences(
	candidate: unknown,
	fallback: EditorPreferences = DEFAULT_EDITOR_PREFERENCES,
): EditorPreferences {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<EditorPreferences>) : {};

	return {
		...normalizeEditorControls(raw, fallback),
		previewQuality: normalizePreviewQuality(raw.previewQuality, fallback.previewQuality),
		quickExport: normalizeQuickExportPreferences(raw.quickExport ?? fallback.quickExport),
		customAspectWidth: normalizePositiveIntegerString(
			raw.customAspectWidth,
			fallback.customAspectWidth,
		),
		customAspectHeight: normalizePositiveIntegerString(
			raw.customAspectHeight,
			fallback.customAspectHeight,
		),
		customWallpapers: normalizeCustomWallpapers(raw.customWallpapers, fallback.customWallpapers),
		workspaceLayout: normalizeWorkspaceLayout(raw.workspaceLayout, fallback.workspaceLayout),
		presets: normalizePresets(raw.presets, fallback),
	};
}

function migrateEditorPreferences(candidate: unknown): unknown {
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		return candidate;
	}

	const raw = candidate as Partial<EditorPreferences>;
	if (raw.workspaceLayout !== "default") {
		return candidate;
	}

	return {
		...raw,
		workspaceLayout: DEFAULT_EDITOR_PREFERENCES.workspaceLayout,
	};
}

function normalizePresets(value: unknown, fallback: EditorPreferences): EditorPreset[] {
	if (!Array.isArray(value)) {
		return fallback.presets;
	}

	return value
		.filter((item): item is Partial<EditorPreset> => Boolean(item && typeof item === "object"))
		.map((item, index) => {
			const name =
				typeof item.name === "string" && item.name.trim().length > 0
					? item.name.trim()
					: `Preset ${index + 1}`;
			const id =
				typeof item.id === "string" && item.id.trim().length > 0
					? item.id.trim()
					: `preset-${index + 1}`;

			return {
				id,
				name,
				controls: normalizeEditorControls(
					(item.controls as Partial<EditorPreferences>) ?? {},
					fallback,
				),
			};
		});
}

export function loadEditorPreferences(): EditorPreferences {
	if (typeof globalThis.localStorage === "undefined") {
		return DEFAULT_EDITOR_PREFERENCES;
	}

	try {
		const stored = globalThis.localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
		if (!stored) {
			return DEFAULT_EDITOR_PREFERENCES;
		}

		const prefs = normalizeEditorPreferences(migrateEditorPreferences(JSON.parse(stored)));
		globalThis.localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
		return prefs;
	} catch {
		return DEFAULT_EDITOR_PREFERENCES;
	}
}

export function saveEditorPreferences(preferences: Partial<EditorPreferences>): void {
	if (typeof globalThis.localStorage === "undefined") {
		return;
	}

	try {
		const current = loadEditorPreferences();
		const merged = normalizeEditorPreferences({ ...current, ...preferences }, current);
		globalThis.localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
	} catch {
		// Ignore storage failures so editor controls still work.
	}
}
