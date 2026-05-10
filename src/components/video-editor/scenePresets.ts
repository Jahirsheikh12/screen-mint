import {
	getDefaultGifExportSettings,
	getVideoExportSettingsForPreset,
	type VideoExportSettings,
} from "@/lib/exporter";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import type { ProjectEditorState } from "./projectPersistence";
import { buildAutoZoomSuggestions } from "./timeline/zoomSuggestionUtils";
import {
	CAPTION_STYLE_PRESETS,
	type CursorTelemetryPoint,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CAPTION_SETTINGS,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	getRecommendedWebcamDefaults,
	type ScenePresetId,
	type ZoomRegion,
} from "./types";

export interface BeautifyContext {
	sourceWidth: number;
	sourceHeight: number;
	durationMs: number;
	aspectRatio: AspectRatio;
	hasCursorTelemetry: boolean;
	cursorTelemetry: CursorTelemetryPoint[];
	hasWebcam: boolean;
	hasCaptions: boolean;
	existingZoomCount: number;
}

export interface ScenePresetDefinition {
	id: ScenePresetId;
	label: string;
	description: string;
	recommendedFor: string;
	apply: (editorState: ProjectEditorState, context: BeautifyContext) => Partial<ProjectEditorState>;
}

export interface AutoBeautifyResult {
	presetId: ScenePresetId;
	updates: Partial<ProjectEditorState>;
	zoomStatus: "created" | "preserved" | "unavailable";
	zoomCount: number;
}

const polishedVideoExport: VideoExportSettings = {
	...getVideoExportSettingsForPreset("quality"),
	mode: "preset",
	preset: "quality",
	optimizeForWeb: true,
};

const STUDIO_WALLPAPERS = {
	launch: "/wallpapers/black-liquid.jpg",
	demo: "/wallpapers/green-blue-waves.jpg",
	lesson: "/wallpapers/topography-lines.jpg",
	vertical: "/wallpapers/multicolor-ribbons.jpg",
	handoff: "/wallpapers/gray-liquid-glass.jpg",
} as const;

const cleanCaptionSettings = {
	...DEFAULT_CAPTION_SETTINGS,
	enabled: true,
	position: "bottom" as const,
	animationMode: "active-word" as const,
	style: {
		...CAPTION_STYLE_PRESETS.minimal,
		fontSize: 27,
		color: "#f8fafc",
		highlightColor: "#f59e0b",
		shadowColor: "#020617",
		shadowBlur: 10,
		shadowOffsetY: 3,
	},
};

function commonPolish(): Partial<ProjectEditorState> {
	return {
		hideBackground: false,
		frameShadowSize: 30,
		frameShadowOpacity: 0.5,
		frameShadowBlur: 50,
		backgroundBlur: 0.45,
		zoomMotionBlur: 0.52,
		connectZooms: true,
		showCursor: true,
		cursorSize: 3.6,
		cursorSmoothing: 0.86,
		cursorMotionBlur: 0.46,
		cursorClickBounce: 2.65,
		cursorSway: 0.36,
		cursorPack: "classic",
		cursorTypeMode: "auto",
		cursorTilt: 0.18,
		hideWhenIdle: true,
		idleHideDelayMs: 1500,
		smoothMovementEnabled: true,
		cursorMovementStyle: "smooth",
		cursorSpring: {
			tension: 238,
			friction: 38,
			mass: 0.92,
		},
		cameraSpring: DEFAULT_CAMERA_SPRING,
		highQualitySvgCursors: true,
		cursorColor: "#ffffff",
		cursorOpacity: 1,
		clickEffectsEnabled: true,
		clickHighlightColor: "#f59e0b",
		clickHighlightSize: 1.18,
		clickHighlightOpacity: 0.54,
		cursorTrailLength: 0,
		cursorTrailOpacity: 0.3,
		frameBorderEnabled: true,
		frameBorderWidth: 1,
		frameBorderColor: "#ffffff",
		frameBorderOpacity: 0.18,
		borderRadius: 20,
		padding: 54,
		exportFormat: "mp4",
		exportDestination: "file",
		videoExportSettings: polishedVideoExport,
		gifExportSettings: getDefaultGifExportSettings(),
	};
}

function maybeCaptions(context: BeautifyContext, position: "bottom" | "center" = "bottom") {
	return context.hasCaptions
		? {
				captionSettings: {
					...cleanCaptionSettings,
					position,
					style: {
						...cleanCaptionSettings.style,
						fontSize: position === "center" ? 30 : cleanCaptionSettings.style.fontSize,
					},
				},
			}
		: {};
}

function maybeWebcam(context: BeautifyContext, aspectRatio: AspectRatio) {
	if (!context.hasWebcam) {
		return {};
	}
	const webcamDefaults = getRecommendedWebcamDefaults(aspectRatio);
	return {
		showWebcam: webcamDefaults.showWebcam,
		mirrorWebcam: webcamDefaults.mirrorWebcam,
		webcamRegion: webcamDefaults.region,
		webcamEffects: webcamDefaults.effects,
		cameraSizeDuringZoom: webcamDefaults.cameraSizeDuringZoom,
	};
}

export const SCENE_PRESETS: ScenePresetDefinition[] = [
	{
		id: "saas-launch",
		label: "Launch Film",
		description: "A cinematic browser showcase for landing pages and launch teasers.",
		recommendedFor: "Hero videos, Product Hunt, founder launches",
		apply(_editorState, context) {
			const aspectRatio: AspectRatio = "16:9";
			return {
				...commonPolish(),
				scenePresetId: "saas-launch",
				aspectRatio,
				wallpaper: STUDIO_WALLPAPERS.launch,
				deviceMockup: "browser-window",
				padding: 62,
				borderRadius: 18,
				frameShadowSize: 38,
				frameShadowOpacity: 0.58,
				frameShadowBlur: 64,
				backgroundBlur: 0.65,
				zoomMotionBlur: 0.65,
				cursorPack: "classic",
				cursorSize: 3.2,
				cursorMotionBlur: 0.55,
				clickHighlightColor: "#14b8a6",
				clickHighlightSize: 1.08,
				showKeyboardShortcuts: false,
				...maybeCaptions(context),
				...maybeWebcam(context, aspectRatio),
			};
		},
	},
	{
		id: "product-demo",
		label: "Guided Demo",
		description: "Smooth cursor-follow motion that makes every click feel intentional.",
		recommendedFor: "Feature walkthroughs, onboarding, sales demos",
		apply(_editorState, context) {
			const aspectRatio: AspectRatio = "16:9";
			return {
				...commonPolish(),
				scenePresetId: "product-demo",
				aspectRatio,
				wallpaper: STUDIO_WALLPAPERS.demo,
				deviceMockup: "none",
				padding: 50,
				borderRadius: 22,
				frameShadowSize: 28,
				frameShadowOpacity: 0.48,
				cursorPack: "classic",
				cursorSize: 3.8,
				clickHighlightColor: "#f97316",
				clickHighlightOpacity: 0.58,
				...maybeCaptions(context),
				...maybeWebcam(context, aspectRatio),
			};
		},
	},
	{
		id: "tutorial",
		label: "Lesson Mode",
		description: "Readable, calm, and instructional with keys and captions emphasized.",
		recommendedFor: "Courses, docs, support, technical explainers",
		apply(editorState, context) {
			const aspectRatio: AspectRatio = editorState.aspectRatio === "9:16" ? "9:16" : "16:9";
			return {
				...commonPolish(),
				scenePresetId: "tutorial",
				aspectRatio,
				wallpaper: STUDIO_WALLPAPERS.lesson,
				deviceMockup: "none",
				padding: aspectRatio === "9:16" ? 38 : 44,
				borderRadius: 16,
				frameShadowSize: 22,
				frameShadowOpacity: 0.38,
				zoomMotionBlur: 0.32,
				cursorSize: 4.4,
				cursorMotionBlur: 0.28,
				cursorSway: 0.18,
				cursorPack: "classic",
				showKeyboardShortcuts: true,
				keyboardShortcutTheme: "glass",
				keyboardShortcutPosition: "bottom-center",
				keyboardShortcutScale: 1.12,
				keyboardShortcutMaxVisible: 2,
				...maybeCaptions(context),
				...maybeWebcam(context, aspectRatio),
			};
		},
	},
	{
		id: "social-vertical",
		label: "Vertical Hook",
		description: "Punchy 9:16 framing for fast clips that need to stop the scroll.",
		recommendedFor: "Shorts, Reels, TikTok, social launch clips",
		apply(_editorState, context) {
			const aspectRatio: AspectRatio = "9:16";
			return {
				...commonPolish(),
				scenePresetId: "social-vertical",
				aspectRatio,
				wallpaper: STUDIO_WALLPAPERS.vertical,
				deviceMockup: "none",
				padding: 30,
				borderRadius: 28,
				frameShadowSize: 40,
				frameShadowOpacity: 0.62,
				frameShadowBlur: 70,
				backgroundBlur: 0.85,
				zoomMotionBlur: 0.72,
				cursorSize: 4.8,
				cursorMotionBlur: 0.6,
				cursorPack: "classic",
				clickHighlightColor: "#f43f5e",
				clickHighlightSize: 1.35,
				clickHighlightOpacity: 0.68,
				showKeyboardShortcuts: false,
				...maybeCaptions(context, "center"),
				...maybeWebcam(context, aspectRatio),
			};
		},
	},
	{
		id: "bug-report-clean",
		label: "Clean Handoff",
		description: "Sharp, restrained output for reviews, bug reports, and team sharing.",
		recommendedFor: "Engineering handoffs, QA clips, design review",
		apply(editorState, context) {
			const nativeRatio =
				context.sourceHeight > 0 ? context.sourceWidth / context.sourceHeight : 16 / 9;
			const aspectRatio: AspectRatio =
				getAspectRatioValue(editorState.aspectRatio, nativeRatio) < 1 ? "9:16" : "native";
			return {
				scenePresetId: "bug-report-clean",
				aspectRatio,
				wallpaper: STUDIO_WALLPAPERS.handoff,
				hideBackground: false,
				frameShadowSize: 10,
				frameShadowOpacity: 0.2,
				frameShadowBlur: 16,
				backgroundBlur: 0,
				zoomMotionBlur: 0.18,
				connectZooms: true,
				showCursor: true,
				cursorSize: 3,
				cursorSmoothing: 0.65,
				cursorMotionBlur: 0.15,
				cursorClickBounce: 1.35,
				cursorSway: 0,
				cursorPack: "classic",
				cursorTypeMode: "auto",
				cursorTilt: 0,
				hideWhenIdle: false,
				smoothMovementEnabled: true,
				cursorMovementStyle: "smooth",
				clickEffectsEnabled: true,
				clickHighlightColor: "#38bdf8",
				clickHighlightSize: 0.92,
				clickHighlightOpacity: 0.42,
				cursorTrailLength: 0,
				showKeyboardShortcuts: false,
				deviceMockup: "none",
				frameBorderEnabled: false,
				borderRadius: 8,
				padding: aspectRatio === "native" ? 0 : 24,
				exportFormat: "mp4",
				exportDestination: "file",
				videoExportSettings: {
					...getVideoExportSettingsForPreset("balanced"),
					mode: "preset",
					preset: "balanced",
					optimizeForWeb: true,
				},
				gifExportSettings: getDefaultGifExportSettings(),
				...maybeCaptions(context),
				...maybeWebcam(context, aspectRatio),
			};
		},
	},
];

export function getScenePreset(id: ScenePresetId) {
	return SCENE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function chooseAutoBeautifyPreset(context: BeautifyContext): ScenePresetId {
	const sourceRatio =
		context.sourceHeight > 0 ? context.sourceWidth / context.sourceHeight : 16 / 9;
	const targetRatio = getAspectRatioValue(context.aspectRatio, sourceRatio);
	if (targetRatio < 0.9) {
		return "social-vertical";
	}
	if (!context.hasCursorTelemetry || context.cursorTelemetry.length < 8) {
		return "bug-report-clean";
	}
	if (context.durationMs <= 18_000 && sourceRatio >= 1.45) {
		return "saas-launch";
	}
	return "product-demo";
}

export function buildAutoZoomRegionsFromTelemetry(
	context: BeautifyContext,
	startIndex = 1,
): ZoomRegion[] {
	if (!context.hasCursorTelemetry || context.durationMs <= 0) {
		return [];
	}

	const result = buildAutoZoomSuggestions(context.cursorTelemetry, context.durationMs);
	if (result.status !== "ok") {
		return [];
	}

	return result.suggestions.slice(0, 8).map((suggestion, index) => ({
		id: `zoom-${startIndex + index}`,
		startMs: suggestion.startMs,
		endMs: suggestion.endMs,
		depth: context.aspectRatio === "9:16" ? 4 : 3,
		focus: suggestion.focus,
		mode: "cursor-follow",
		tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
	}));
}

export function applyScenePreset(
	editorState: ProjectEditorState,
	context: BeautifyContext,
	presetId: ScenePresetId,
): Partial<ProjectEditorState> {
	const preset = getScenePreset(presetId);
	if (!preset) {
		return {};
	}
	return preset.apply(editorState, context);
}

export function applyAutoBeautify(
	editorState: ProjectEditorState,
	context: BeautifyContext,
	options: { regenerateZooms?: boolean; nextZoomIndex?: number } = {},
): AutoBeautifyResult {
	const presetId = chooseAutoBeautifyPreset(context);
	const updates = applyScenePreset(editorState, context, presetId);
	const shouldCreateZooms =
		context.hasCursorTelemetry && (options.regenerateZooms || context.existingZoomCount === 0);
	const zoomRegions = shouldCreateZooms
		? buildAutoZoomRegionsFromTelemetry(context, options.nextZoomIndex ?? 1)
		: [];

	if (zoomRegions.length > 0) {
		updates.zoomRegions = options.regenerateZooms
			? zoomRegions
			: [...(editorState.zoomRegions ?? []), ...zoomRegions];
	}

	return {
		presetId,
		updates,
		zoomStatus:
			zoomRegions.length > 0
				? "created"
				: context.existingZoomCount > 0
					? "preserved"
					: "unavailable",
		zoomCount: zoomRegions.length,
	};
}
