import {
	Camera,
	Captions,
	Clapperboard,
	Crop,
	Gauge,
	Keyboard,
	MessageSquare,
	MousePointer2,
	Music,
	Palette,
	Sparkles,
	X,
	ZoomIn,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BUILT_IN_BACKGROUND_MUSIC } from "@/lib/backgroundMusic";
import { WALLPAPER_PATHS } from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { useI18n, useScopedT } from "../../contexts/I18nContext";
import { loadAudioSelectionDurationMs, resolveAudioSourceUrl } from "./audioRegionUtils";
import { CropControl } from "./CropControl";
import { CaptionsTab } from "./captions/CaptionsTab";
import { editorPreferencesService } from "./editorPreferencesService";
import {
	DEFAULT_FRAME_BORDER_COLOR,
	DEFAULT_FRAME_BORDER_ENABLED,
	DEFAULT_FRAME_BORDER_OPACITY,
	DEFAULT_FRAME_BORDER_WIDTH,
	DEFAULT_FRAME_SHADOW_BLUR,
	DEFAULT_FRAME_SHADOW_OPACITY,
	DEFAULT_FRAME_SHADOW_SIZE,
} from "./frameEffects";
import { DEFAULT_VIDEO_PREVIEW_PADDING } from "./projectPersistence";
import { AnnotationSettingsTab } from "./settings/AnnotationSettingsTab";
import { AudioSettingsTab } from "./settings/AudioSettingsTab";
import { BackgroundSettingsTab } from "./settings/BackgroundSettingsTab";
import { CursorSettingsTab } from "./settings/CursorSettingsTab";
import { EffectsSettingsTab } from "./settings/EffectsSettingsTab";
import { KeyboardSettingsTab } from "./settings/KeyboardSettingsTab";
import { StudioSettingsTab } from "./settings/StudioSettingsTab";
import { SpeedSettingsTab, ZoomSettingsTab } from "./settings/TimelineRegionSettingsTabs";
import { WebcamSettingsTab } from "./settings/WebcamSettingsTab";
import {
	type BackgroundTab,
	GRADIENT_PRESETS,
	getBackgroundTabForWallpaper,
	getInitialBuiltInWallpaperPreviewPaths,
	groupBuiltInTracksByMood,
	isHexWallpaper,
	loadBuiltInWallpaperPreviewPaths,
	parseGradientString,
} from "./settingsPanelBackground";
import { SidebarTabButton } from "./settingsPanelLayout";
import type {
	AnnotationRegion,
	AnnotationType,
	AudioRegion,
	AudioTrackSelection,
	BlurData,
	CameraLayoutRegion,
	CaptionGenerationOptions,
	CaptionGenerationProgress,
	CaptionModel,
	CaptionModelStatus,
	CaptionRegion,
	CaptionSegment,
	CaptionSettings,
	CaptionStyle,
	CaptionStylePreset,
	CaptionUserPreset,
	CropRegion,
	CursorClickStyleSettings,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorTypeMode,
	FigureData,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	MotionPresetId,
	PaddingSides,
	PlaybackSpeed,
	PreviewQuality,
	ScenePresetId,
	WebcamEffects,
	WebcamHealthMetrics,
	WebcamPreviewMode,
	WebcamRegion,
	ZoomDepth,
	ZoomMode,
	ZoomTemporalBlurSettings,
	ZoomTimingSettings,
} from "./types";
import {
	CAMERA_ZOOM_SCALE_DISABLED,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CLICK_EFFECTS_ENABLED,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_STYLE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	DEFAULT_CURSOR_MOVEMENT_STYLE,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_SPRING,
	DEFAULT_CURSOR_TILT,
	DEFAULT_CURSOR_TRAIL_LENGTH,
	DEFAULT_CURSOR_TRAIL_OPACITY,
	DEFAULT_CURSOR_TYPE_MODE,
	DEFAULT_HIDE_CURSOR_WHEN_IDLE,
	DEFAULT_HIGH_QUALITY_SVG_CURSORS,
	DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	DEFAULT_KEYBOARD_SHORTCUT_THEME,
	DEFAULT_PREVIEW_QUALITY,
	DEFAULT_SMOOTH_CURSOR_MOVEMENT,
	DEFAULT_ZOOM_MODE,
	DEFAULT_ZOOM_TEMPORAL_BLUR,
	DEFAULT_ZOOM_TIMING,
} from "./types";

interface SettingsPanelProps {
	selected: string;
	onWallpaperChange: (path: string) => void;
	previewQuality?: PreviewQuality;
	onPreviewQualityChange?: (quality: PreviewQuality) => void;
	selectedZoomDepth?: ZoomDepth | null;
	selectedZoomMode?: ZoomMode | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	onZoomModeChange?: (mode: ZoomMode) => void;
	selectedZoomId?: string | null;
	onZoomDelete?: (id: string) => void;
	frameShadowSize?: number;
	onFrameShadowSizeChange?: (size: number) => void;
	frameShadowOpacity?: number;
	onFrameShadowOpacityChange?: (opacity: number) => void;
	frameShadowBlur?: number;
	onFrameShadowBlurChange?: (blur: number) => void;
	backgroundBlur?: number;
	onBackgroundBlurChange?: (amount: number) => void;
	hideBackground?: boolean;
	onHideBackgroundChange?: (hidden: boolean) => void;
	zoomMotionBlur?: number;
	onZoomMotionBlurChange?: (amount: number) => void;
	zoomTemporalBlur?: ZoomTemporalBlurSettings;
	onZoomTemporalBlurChange?: (settings: ZoomTemporalBlurSettings) => void;
	connectZooms?: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	zoomTiming?: ZoomTimingSettings;
	onZoomTimingChange?: (timing: ZoomTimingSettings) => void;
	showCursor?: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	loopCursor?: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorSize?: number;
	onCursorSizeChange?: (size: number) => void;
	cursorMotionBlur?: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorClickBounce?: number;
	onCursorClickBounceChange?: (amount: number) => void;
	cursorPack?: CursorPack;
	onCursorPackChange?: (pack: CursorPack) => void;
	cursorTypeMode?: CursorTypeMode;
	onCursorTypeModeChange?: (mode: CursorTypeMode) => void;
	cursorTilt?: number;
	onCursorTiltChange?: (tilt: number) => void;
	hideWhenIdle?: boolean;
	onHideWhenIdleChange?: (enabled: boolean) => void;
	idleHideDelayMs?: number;
	onIdleHideDelayMsChange?: (delayMs: number) => void;
	smoothMovementEnabled?: boolean;
	onSmoothMovementEnabledChange?: (enabled: boolean) => void;
	cursorMovementStyle?: CursorMovementStyle;
	onCursorMovementStyleChange?: (style: CursorMovementStyle) => void;
	cursorSpring?: CursorSpringSettings;
	onCursorSpringChange?: (spring: CursorSpringSettings) => void;
	cameraSpring?: import("./types").CameraSpringSettings;
	onCameraSpringChange?: (spring: import("./types").CameraSpringSettings) => void;
	highQualitySvgCursors?: boolean;
	onHighQualitySvgCursorsChange?: (enabled: boolean) => void;
	cursorColor?: string;
	onCursorColorChange?: (color: string) => void;
	cursorOpacity?: number;
	onCursorOpacityChange?: (opacity: number) => void;
	clickEffectsEnabled?: boolean;
	onClickEffectsEnabledChange?: (enabled: boolean) => void;
	clickHighlightColor?: string;
	onClickHighlightColorChange?: (color: string) => void;
	clickHighlightSize?: number;
	onClickHighlightSizeChange?: (size: number) => void;
	clickHighlightOpacity?: number;
	onClickHighlightOpacityChange?: (opacity: number) => void;
	cursorClickStyle?: CursorClickStyleSettings;
	onCursorClickStyleChange?: (style: CursorClickStyleSettings) => void;
	motionPreset?: MotionPresetId | null;
	onApplyMotionPreset?: (preset: MotionPresetId) => void;
	cursorTrailLength?: number;
	onCursorTrailLengthChange?: (length: number) => void;
	cursorTrailOpacity?: number;
	onCursorTrailOpacityChange?: (opacity: number) => void;
	showKeyboardShortcuts?: boolean;
	onShowKeyboardShortcutsChange?: (enabled: boolean) => void;
	keyboardShortcutPosition?: KeyboardShortcutPosition;
	onKeyboardShortcutPositionChange?: (position: KeyboardShortcutPosition) => void;
	keyboardShortcutTheme?: KeyboardShortcutTheme;
	onKeyboardShortcutThemeChange?: (theme: KeyboardShortcutTheme) => void;
	keyboardShortcutScale?: number;
	onKeyboardShortcutScaleChange?: (scale: number) => void;
	keyboardShortcutOpacity?: number;
	onKeyboardShortcutOpacityChange?: (opacity: number) => void;
	keyboardShortcutDisplayMs?: number;
	onKeyboardShortcutDisplayMsChange?: (durationMs: number) => void;
	keyboardShortcutMaxVisible?: number;
	onKeyboardShortcutMaxVisibleChange?: (count: number) => void;
	frameBorderEnabled?: boolean;
	onFrameBorderEnabledChange?: (enabled: boolean) => void;
	frameBorderWidth?: number;
	onFrameBorderWidthChange?: (width: number) => void;
	frameBorderColor?: string;
	onFrameBorderColorChange?: (color: string) => void;
	frameBorderOpacity?: number;
	onFrameBorderOpacityChange?: (opacity: number) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding?: number;
	onPaddingChange?: (padding: number) => void;
	paddingSides?: PaddingSides | null;
	onPaddingSidesChange?: (sides: PaddingSides | null) => void;
	cropRegion?: CropRegion;
	baseCropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	videoElement?: HTMLVideoElement | null;
	selectedAnnotationId?: string | null;
	annotationRegions?: AnnotationRegion[];
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationBlurDataChange?: (id: string, blurData: BlurData) => void;
	onAnnotationDelete?: (id: string) => void;
	webcamPath?: string | null;
	webcamMissing?: boolean;
	missingWebcamPath?: string | null;
	showWebcam?: boolean;
	onShowWebcamChange?: (show: boolean) => void;
	mirrorWebcam?: boolean;
	onMirrorWebcamChange?: (mirror: boolean) => void;
	webcamRegion?: WebcamRegion;
	webcamEffects?: WebcamEffects;
	webcamPreviewMode?: WebcamPreviewMode;
	webcamHealthMetrics?: WebcamHealthMetrics | null;
	onWebcamRegionChange?: (region: Partial<WebcamRegion>) => void;
	onWebcamEffectsChange?: (effects: Partial<WebcamEffects>) => void;
	onWebcamPreviewModeChange?: (mode: WebcamPreviewMode) => void;
	onApplyWebcamPreset?: (presetId: WebcamEffects["presetId"]) => void;
	onResetRecommendedWebcam?: () => void;
	onResetSelectedCameraLayout?: () => void;
	onRelinkMissingWebcam?: () => void;
	onRemoveMissingWebcam?: () => void;
	cameraSizeDuringZoom?: number;
	onCameraSizeDuringZoomChange?: (scale: number) => void;
	cameraLayouts?: CameraLayoutRegion[];
	selectedCameraLayoutId?: string | null;
	onCameraLayoutChange?: (id: string, region: Partial<CameraLayoutRegion>) => void;
	cameraSelected?: boolean;
	selectedSpeedId?: string | null;
	selectedSpeedValue?: PlaybackSpeed | null;
	onSpeedChange?: (speed: PlaybackSpeed) => void;
	onSpeedDelete?: (id: string) => void;
	audioRegions?: AudioRegion[];
	selectedAudioId?: string | null;
	onAudioAddAtPlayhead?: (selection: AudioTrackSelection) => void | Promise<void>;
	onReplaceSelectedAudio?: (selection: AudioTrackSelection) => void | Promise<void>;
	onAudioVolumeChange?: (id: string, volume: number) => void;
	onAudioFadeChange?: (
		id: string,
		updates: Partial<Pick<AudioRegion, "fadeInMs" | "fadeOutMs">>,
	) => void;
	onAudioLoopChange?: (id: string, loop: boolean) => void;
	onAudioNormalizeChange?: (id: string, normalize: boolean) => void;
	onAudioDelete?: (id: string) => void;
	missingAudioPath?: string | null;
	onRelinkMissingAudio?: () => void;
	onRemoveMissingAudio?: () => void;
	captionRegions?: CaptionRegion[];
	captionGenerationOptions?: CaptionGenerationOptions;
	captionGenerationProgress?: CaptionGenerationProgress | null;
	captionModelStatus?: CaptionModelStatus | null;
	onDeleteCaptionModel?: (model: CaptionModel) => void;
	onCustomWhisperFile?: (kind: "model" | "executable", action: "choose" | "clear") => void;
	captionSettings?: CaptionSettings;
	selectedCaptionId?: string | null;
	onSelectCaption?: (id: string | null) => void;
	onCaptionTextChange?: (id: string, text: string) => void;
	onCaptionDelete?: (id: string) => void;
	onDeleteAllCaptions?: () => void;
	onCaptionSplit?: (id: string) => void;
	onCaptionMergeNext?: (id: string) => void;
	onCaptionStylePresetChange?: (preset: CaptionStylePreset) => void;
	onCaptionSettingsChange?: (settings: Partial<CaptionSettings>) => void;
	onCaptionStyleChange?: (style: Partial<CaptionStyle>) => void;
	onCaptionGenerationOptionsChange?: (options: Partial<CaptionGenerationOptions>) => void;
	onCaptionExport?: (format: "srt" | "vtt" | "txt") => void;
	onCaptionImport?: (segments: CaptionSegment[], mode: "replace" | "append") => void;
	onApplyCaptionPreset?: (preset: CaptionUserPreset) => void;
	isEditingCaptionPosition?: boolean;
	onToggleCaptionPositionEditing?: (next: boolean) => void;
	isTranscribing?: boolean;
	onAutoTranscribe?: () => void;
	onCancelCaptionGeneration?: () => void;
	activeScenePresetId?: ScenePresetId;
	hasCursorTelemetry?: boolean;
	hasExistingZooms?: boolean;
	onApplyScenePreset?: (presetId: ScenePresetId) => void;
	onAutoBeautify?: () => void;
	onRegenerateSmartZooms?: () => void;
}

export default function SettingsPanel({
	selected,
	onWallpaperChange,
	previewQuality = DEFAULT_PREVIEW_QUALITY,
	onPreviewQualityChange,
	selectedZoomDepth,
	selectedZoomMode = DEFAULT_ZOOM_MODE,
	onZoomDepthChange,
	onZoomModeChange,
	selectedZoomId,
	onZoomDelete,
	frameShadowSize = DEFAULT_FRAME_SHADOW_SIZE,
	onFrameShadowSizeChange,
	frameShadowOpacity = DEFAULT_FRAME_SHADOW_OPACITY,
	onFrameShadowOpacityChange,
	frameShadowBlur = DEFAULT_FRAME_SHADOW_BLUR,
	onFrameShadowBlurChange,
	backgroundBlur = 0,
	onBackgroundBlurChange,
	hideBackground = false,
	onHideBackgroundChange,
	zoomMotionBlur = 0,
	onZoomMotionBlurChange,
	zoomTemporalBlur = DEFAULT_ZOOM_TEMPORAL_BLUR,
	onZoomTemporalBlurChange,
	connectZooms = true,
	onConnectZoomsChange,
	zoomTiming = DEFAULT_ZOOM_TIMING,
	onZoomTimingChange,
	showCursor = false,
	onShowCursorChange,
	loopCursor = false,
	onLoopCursorChange,
	cursorSize = 5,
	onCursorSizeChange,
	cursorMotionBlur = 0.35,
	onCursorMotionBlurChange,
	cursorClickBounce = 1,
	onCursorClickBounceChange,
	cursorPack = "classic",
	onCursorPackChange,
	cursorTypeMode = DEFAULT_CURSOR_TYPE_MODE,
	onCursorTypeModeChange,
	cursorTilt = DEFAULT_CURSOR_TILT,
	onCursorTiltChange,
	hideWhenIdle = DEFAULT_HIDE_CURSOR_WHEN_IDLE,
	onHideWhenIdleChange,
	idleHideDelayMs = DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	onIdleHideDelayMsChange,
	smoothMovementEnabled = DEFAULT_SMOOTH_CURSOR_MOVEMENT,
	onSmoothMovementEnabledChange,
	cursorMovementStyle = DEFAULT_CURSOR_MOVEMENT_STYLE,
	onCursorMovementStyleChange,
	cursorSpring = DEFAULT_CURSOR_SPRING,
	onCursorSpringChange,
	cameraSpring = DEFAULT_CAMERA_SPRING,
	onCameraSpringChange,
	highQualitySvgCursors = DEFAULT_HIGH_QUALITY_SVG_CURSORS,
	onHighQualitySvgCursorsChange,
	cursorColor = DEFAULT_CURSOR_COLOR,
	onCursorColorChange,
	cursorOpacity = DEFAULT_CURSOR_OPACITY,
	onCursorOpacityChange,
	clickEffectsEnabled = DEFAULT_CLICK_EFFECTS_ENABLED,
	onClickEffectsEnabledChange,
	clickHighlightColor = DEFAULT_CLICK_HIGHLIGHT_COLOR,
	onClickHighlightColorChange,
	clickHighlightSize = DEFAULT_CLICK_HIGHLIGHT_SIZE,
	onClickHighlightSizeChange,
	clickHighlightOpacity = DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	onClickHighlightOpacityChange,
	cursorClickStyle = DEFAULT_CURSOR_CLICK_STYLE,
	onCursorClickStyleChange,
	motionPreset = null,
	onApplyMotionPreset,
	cursorTrailLength = DEFAULT_CURSOR_TRAIL_LENGTH,
	onCursorTrailLengthChange,
	cursorTrailOpacity = DEFAULT_CURSOR_TRAIL_OPACITY,
	onCursorTrailOpacityChange,
	showKeyboardShortcuts = false,
	onShowKeyboardShortcutsChange,
	keyboardShortcutPosition = DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	onKeyboardShortcutPositionChange,
	keyboardShortcutTheme = DEFAULT_KEYBOARD_SHORTCUT_THEME,
	onKeyboardShortcutThemeChange,
	keyboardShortcutScale = DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	onKeyboardShortcutScaleChange,
	keyboardShortcutOpacity = DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	onKeyboardShortcutOpacityChange,
	keyboardShortcutDisplayMs = DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
	onKeyboardShortcutDisplayMsChange,
	keyboardShortcutMaxVisible = DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	onKeyboardShortcutMaxVisibleChange,
	frameBorderEnabled = DEFAULT_FRAME_BORDER_ENABLED,
	onFrameBorderEnabledChange,
	frameBorderWidth = DEFAULT_FRAME_BORDER_WIDTH,
	onFrameBorderWidthChange,
	frameBorderColor = DEFAULT_FRAME_BORDER_COLOR,
	onFrameBorderColorChange,
	frameBorderOpacity = DEFAULT_FRAME_BORDER_OPACITY,
	onFrameBorderOpacityChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	padding = DEFAULT_VIDEO_PREVIEW_PADDING,
	onPaddingChange,
	paddingSides = null,
	onPaddingSidesChange,
	cropRegion,
	baseCropRegion,
	onCropChange,
	aspectRatio,
	videoElement,
	selectedAnnotationId,
	annotationRegions = [],
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationBlurDataChange,
	onAnnotationDelete,
	webcamPath,
	webcamMissing = false,
	missingWebcamPath,
	showWebcam = true,
	onShowWebcamChange,
	mirrorWebcam = false,
	onMirrorWebcamChange,
	webcamRegion,
	webcamEffects,
	webcamPreviewMode = "exact",
	webcamHealthMetrics,
	onWebcamRegionChange,
	onWebcamEffectsChange,
	onWebcamPreviewModeChange,
	onApplyWebcamPreset,
	onResetRecommendedWebcam,
	onResetSelectedCameraLayout,
	onRelinkMissingWebcam,
	onRemoveMissingWebcam,
	cameraSizeDuringZoom = CAMERA_ZOOM_SCALE_DISABLED,
	onCameraSizeDuringZoomChange,
	cameraLayouts = [],
	selectedCameraLayoutId,
	onCameraLayoutChange,
	cameraSelected = false,
	selectedSpeedId,
	selectedSpeedValue,
	onSpeedChange,
	onSpeedDelete,
	audioRegions = [],
	selectedAudioId,
	onAudioAddAtPlayhead,
	onReplaceSelectedAudio,
	onAudioVolumeChange,
	onAudioFadeChange,
	onAudioLoopChange,
	onAudioNormalizeChange,
	onAudioDelete,
	missingAudioPath,
	onRelinkMissingAudio,
	onRemoveMissingAudio,
	captionRegions = [],
	captionGenerationOptions,
	captionGenerationProgress,
	captionModelStatus,
	onDeleteCaptionModel,
	onCustomWhisperFile,
	captionSettings,
	selectedCaptionId,
	onSelectCaption,
	onCaptionTextChange,
	onCaptionDelete,
	onDeleteAllCaptions,
	onCaptionSplit,
	onCaptionMergeNext,
	onCaptionStylePresetChange,
	onCaptionSettingsChange,
	onCaptionStyleChange,
	onCaptionGenerationOptionsChange,
	onCaptionExport,
	onCaptionImport,
	onApplyCaptionPreset,
	isEditingCaptionPosition = false,
	onToggleCaptionPositionEditing,
	isTranscribing = false,
	onAutoTranscribe,
	onCancelCaptionGeneration,
	activeScenePresetId,
	hasCursorTelemetry = false,
	hasExistingZooms = false,
	onApplyScenePreset,
	onAutoBeautify,
	onRegenerateSmartZooms,
}: SettingsPanelProps) {
	const tSettings = useScopedT("settings");
	const { t } = useI18n();
	const initialEditorPreferences = useMemo(() => editorPreferencesService.load(), []);
	const [wallpaperPreviewPaths, setWallpaperPreviewPaths] = useState<string[]>(
		getInitialBuiltInWallpaperPreviewPaths,
	);
	const [customImages, setCustomImages] = useState<string[]>(
		initialEditorPreferences.customWallpapers,
	);
	const [showLegacyCursorSettings, setShowLegacyCursorSettings] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const hasUsableCaptionAudio =
		!captionModelStatus || captionModelStatus.availableSourceAudios.length > 0;
	const supportsAppleSpeech =
		captionModelStatus?.availableBackends.includes("apple-speech") ?? false;

	useEffect(() => {
		let mounted = true;
		void loadBuiltInWallpaperPreviewPaths().then((resolved) => {
			if (mounted) {
				setWallpaperPreviewPaths(resolved);
			}
		});
		return () => {
			mounted = false;
		};
	}, []);
	const colorPalette = [
		"#FF0000",
		"#FFD700",
		"#00FF00",
		"#FFFFFF",
		"#0000FF",
		"#FF6B00",
		"#9B59B6",
		"#E91E63",
		"#00BCD4",
		"#FF5722",
		"#8BC34A",
		"#FFC107",
		"#F59E0B",
		"#000000",
		"#607D8B",
		"#795548",
	];

	const [selectedColor, setSelectedColor] = useState(
		isHexWallpaper(selected) ? selected : "#ADADAD",
	);
	const initialGradientState = (() => {
		if (selected.startsWith("linear-gradient") || selected.startsWith("radial-gradient")) {
			const parsed = parseGradientString(selected);
			if (parsed) return parsed;
		}
		return {
			from: GRADIENT_PRESETS[0].from,
			to: GRADIENT_PRESETS[0].to,
			angle: GRADIENT_PRESETS[0].angle,
		};
	})();
	const [gradientFromColor, setGradientFromColor] = useState(initialGradientState.from);
	const [gradientToColor, setGradientToColor] = useState(initialGradientState.to);
	const [gradientAngle, setGradientAngle] = useState(initialGradientState.angle);
	const [gradientNoise, setGradientNoise] = useState(0);
	const gradient = `linear-gradient(${gradientAngle}deg, ${gradientFromColor} 0%, ${gradientToColor} 100%)`;
	const [backgroundTab, setBackgroundTab] = useState<BackgroundTab>(() =>
		getBackgroundTabForWallpaper(selected),
	);
	const [showCropModal, setShowCropModal] = useState(false);
	const [showAdvancedShadowSettings, setShowAdvancedShadowSettings] = useState(true);
	const [showAdvancedWebcam, setShowAdvancedWebcam] = useState(false);
	const [activeTab, setActiveTab] = useState<
		| "effects"
		| "studio"
		| "cursor"
		| "keyboard"
		| "background"
		| "zoom"
		| "speed"
		| "audio"
		| "annotation"
		| "webcam"
		| "captions"
	>("effects");
	const cropSnapshotRef = useRef<CropRegion | null>(null);
	const selectedAudio = selectedAudioId
		? (audioRegions.find((region) => region.id === selectedAudioId) ?? null)
		: null;
	const builtInTracksByMood = useMemo(() => groupBuiltInTracksByMood(), []);
	const [selectedBuiltInTrackId, setSelectedBuiltInTrackId] = useState<string | null>(
		BUILT_IN_BACKGROUND_MUSIC[0]?.id ?? null,
	);
	const selectedBuiltInTrack =
		BUILT_IN_BACKGROUND_MUSIC.find((track) => track.id === selectedBuiltInTrackId) ?? null;
	const [builtInTrackDurations, setBuiltInTrackDurations] = useState<Record<string, number>>({});
	const [playingBuiltInTrackId, setPlayingBuiltInTrackId] = useState<string | null>(null);
	const builtInPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		setBackgroundTab(getBackgroundTabForWallpaper(selected));

		if (isHexWallpaper(selected)) {
			setSelectedColor(selected);
		}

		if (selected.startsWith("linear-gradient") || selected.startsWith("radial-gradient")) {
			const parsed = parseGradientString(selected);
			if (parsed) {
				setGradientFromColor(parsed.from);
				setGradientToColor(parsed.to);
				setGradientAngle(parsed.angle);
			}
		}

		if (selected.startsWith("data:image") && !customImages.includes(selected)) {
			setCustomImages((prev) => [selected, ...prev]);
		}
	}, [customImages, selected]);

	useEffect(() => {
		editorPreferencesService.scheduleSave({ customWallpapers: customImages });
	}, [customImages]);

	useEffect(() => {
		return () => {
			editorPreferencesService.flush();
		};
	}, []);

	const zoomEnabled = Boolean(selectedZoomDepth);

	const handleDeleteClick = () => {
		if (selectedZoomId && onZoomDelete) {
			onZoomDelete(selectedZoomId);
		}
	};

	useEscapeKey(showCropModal, () => handleCropCancel());

	const handleCropToggle = () => {
		if (!showCropModal && cropRegion) {
			cropSnapshotRef.current = { ...cropRegion };
		}
		setShowCropModal(!showCropModal);
	};

	const handleCropCancel = () => {
		if (cropSnapshotRef.current && onCropChange) {
			onCropChange(cropSnapshotRef.current);
		}
		setShowCropModal(false);
	};

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		const normalizedType = file.type.toLowerCase();
		const normalizedName = file.name.toLowerCase();
		const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
		const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
		const hasValidExtension = validExtensions.some((extension) =>
			normalizedName.endsWith(extension),
		);
		if (!(validTypes.includes(normalizedType) || (!normalizedType && hasValidExtension))) {
			toast.error(tSettings("background.uploadError"), {
				description: tSettings("background.uploadErrorDescription"),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				setCustomImages((prev) => [...prev, dataUrl]);
				onWallpaperChange(dataUrl);
				toast.success(tSettings("background.uploadSuccess"));
			}
		};

		reader.onerror = () => {
			toast.error(t("common.errors.failedToUploadImage"), {
				description: t("common.errors.fileReadError"),
			});
		};

		reader.readAsDataURL(file);
		// Reset input so the same file can be selected again
		event.target.value = "";
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		setCustomImages((prev) => prev.filter((img) => img !== imageUrl));
		// If the removed image was selected, clear selection
		if (selected === imageUrl) {
			onWallpaperChange(WALLPAPER_PATHS[0]);
		}
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;
	const selectedCameraLayout = selectedCameraLayoutId
		? (cameraLayouts.find((layout) => layout.id === selectedCameraLayoutId) ?? null)
		: null;

	// Auto-switch to annotation tab when an annotation is selected
	useEffect(() => {
		if (selectedAnnotation) {
			setActiveTab("annotation");
		}
	}, [selectedAnnotation]);

	useEffect(() => {
		if (selectedAudio) {
			setActiveTab("audio");
		}
	}, [selectedAudio]);

	useEffect(() => {
		if (cameraSelected || selectedCameraLayout) {
			setActiveTab("webcam");
		}
	}, [cameraSelected, selectedCameraLayout]);

	useEffect(() => {
		if (selectedAudio?.sourceType === "built-in" && selectedAudio.assetId) {
			setSelectedBuiltInTrackId(selectedAudio.assetId);
		}
	}, [selectedAudio]);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const durations = await Promise.all(
				BUILT_IN_BACKGROUND_MUSIC.map(async (track) => [
					track.id,
					await loadAudioSelectionDurationMs({
						sourceType: "built-in",
						assetId: track.id,
					}),
				]),
			);
			if (!cancelled) {
				setBuiltInTrackDurations(Object.fromEntries(durations));
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleSelectBuiltInTrack = async (trackId: string) => {
		setSelectedBuiltInTrackId(trackId);
		await onAudioAddAtPlayhead?.({
			sourceType: "built-in",
			assetId: trackId,
			loop: true,
		});
	};

	const handleToggleBuiltInPreview = async (trackId: string) => {
		const currentAudio = builtInPreviewAudioRef.current;
		if (currentAudio && playingBuiltInTrackId === trackId && !currentAudio.paused) {
			currentAudio.pause();
			setPlayingBuiltInTrackId(null);
			return;
		}

		const sourceUrl = await resolveAudioSourceUrl({
			sourceType: "built-in",
			assetId: trackId,
		});
		if (!sourceUrl) {
			return;
		}

		let audio = builtInPreviewAudioRef.current;
		if (!audio) {
			audio = new Audio();
			audio.preload = "auto";
			audio.onended = () => setPlayingBuiltInTrackId(null);
			builtInPreviewAudioRef.current = audio;
		}

		if (audio.src !== sourceUrl) {
			audio.pause();
			audio.src = sourceUrl;
		}

		audio.currentTime = 0;
		try {
			await audio.play();
			setPlayingBuiltInTrackId(trackId);
		} catch {
			setPlayingBuiltInTrackId(null);
		}
	};

	const handleReplaceBuiltInAudio = async () => {
		if (!selectedBuiltInTrackId || !selectedAudio) {
			return;
		}

		await onReplaceSelectedAudio?.({
			sourceType: "built-in",
			assetId: selectedBuiltInTrackId,
			loop: true,
		});
	};

	const handleImportAudio = async () => {
		const result = await window.electronAPI.openAudioFilePicker();
		if (result.canceled || !result.success || !result.path) {
			return;
		}

		const selection: AudioTrackSelection = {
			sourceType: "file",
			audioPath: result.path,
			loop: false,
		};

		await onAudioAddAtPlayhead?.(selection);
	};

	const handleReplaceWithUploadedAudio = async () => {
		if (!selectedAudio) {
			return;
		}

		const result = await window.electronAPI.openAudioFilePicker();
		if (result.canceled || !result.success || !result.path) {
			return;
		}

		await onReplaceSelectedAudio?.({
			sourceType: "file",
			audioPath: result.path,
			loop: selectedAudio.loop,
		});
	};

	useEffect(() => {
		return () => {
			const audio = builtInPreviewAudioRef.current;
			if (audio) {
				audio.pause();
				audio.src = "";
			}
		};
	}, []);

	const sidebarTabs = [
		{ id: "effects" as const, icon: Sparkles, label: tSettings("effects.title") },
		{
			id: "cursor" as const,
			icon: MousePointer2,
			label: t("editor.settingsPanel.cursor", "Cursor"),
		},
		{ id: "keyboard" as const, icon: Keyboard, label: tSettings("keyboard.title") },
		{ id: "background" as const, icon: Palette, label: tSettings("background.title") },
		{ id: "zoom" as const, icon: ZoomIn, label: tSettings("zoom.level") },
		{ id: "speed" as const, icon: Gauge, label: tSettings("speed.playbackSpeed") },
		{ id: "audio" as const, icon: Music, label: tSettings("audio.title", "Audio") },
		{
			id: "annotation" as const,
			icon: MessageSquare,
			label: t("editor.settingsPanel.annotation", "Annotation"),
		},
		{
			id: "captions" as const,
			icon: Captions,
			label: t("editor.settingsPanel.captions", "Captions"),
		},
		...(webcamPath
			? [{ id: "webcam" as const, icon: Camera, label: tSettings("webcam.title") }]
			: []),
		{
			id: "studio" as const,
			icon: Clapperboard,
			label: t("editor.settingsPanel.studio", "Studio"),
		},
	];

	const tabGroups = [
		{ ids: ["effects", "cursor", "keyboard"], label: t("editor.settingsPanel.capture", "Capture") },
		{ ids: ["background", "zoom", "speed"], label: t("editor.settingsPanel.canvas", "Canvas") },
		{
			ids: ["audio", "annotation", "captions", "webcam"],
			label: t("editor.settingsPanel.overlay", "Overlay"),
		},
		{ ids: ["studio"], label: t("editor.settingsPanel.studio", "Studio") },
	];

	return (
		<div className="w-full h-full shrink-0 min-w-0 bg-surface rounded-xl flex flex-row shadow-panel overflow-hidden">
			{/* Sidebar navigation */}
			<div className="flex flex-col gap-1 p-2 border-r border-line w-[52px] shrink-0 overflow-y-auto custom-scrollbar items-center">
				{tabGroups.map((group, groupIndex) => (
					<div key={group.label} className="flex flex-col items-center w-full gap-1">
						{groupIndex > 0 && <div className="my-1.5 h-px w-5 bg-line" />}
						{sidebarTabs
							.filter((tab) => group.ids.includes(tab.id))
							.map((tab) => (
								<SidebarTabButton
									key={tab.id}
									icon={tab.icon}
									label={tab.label}
									isActive={activeTab === tab.id}
									onClick={() => setActiveTab(tab.id)}
								/>
							))}
					</div>
				))}
			</div>

			{/* Content area */}
			<div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-4 pb-0 relative">
				{activeTab === "studio" && (
					<StudioSettingsTab
						activePresetId={activeScenePresetId}
						hasCursorTelemetry={hasCursorTelemetry}
						hasExistingZooms={hasExistingZooms}
						onApplyPreset={(presetId) => onApplyScenePreset?.(presetId)}
						onAutoBeautify={() => onAutoBeautify?.()}
						onRegenerateZooms={() => onRegenerateSmartZooms?.()}
					/>
				)}

				{/* Effects tab */}
				{activeTab === "effects" && (
					<EffectsSettingsTab
						tSettings={tSettings}
						previewQuality={previewQuality}
						onPreviewQualityChange={onPreviewQualityChange}
						connectZooms={connectZooms}
						onConnectZoomsChange={onConnectZoomsChange}
						zoomTiming={zoomTiming}
						onZoomTimingChange={onZoomTimingChange}
						hideBackground={hideBackground}
						onHideBackgroundChange={onHideBackgroundChange}
						backgroundBlur={backgroundBlur}
						onBackgroundBlurChange={onBackgroundBlurChange}
						zoomMotionBlur={zoomMotionBlur}
						onZoomMotionBlurChange={onZoomMotionBlurChange}
						zoomTemporalBlur={zoomTemporalBlur}
						onZoomTemporalBlurChange={onZoomTemporalBlurChange}
						showAdvancedShadowSettings={showAdvancedShadowSettings}
						onToggleAdvancedShadowSettings={() => setShowAdvancedShadowSettings((value) => !value)}
						frameShadowSize={frameShadowSize}
						onFrameShadowSizeChange={onFrameShadowSizeChange}
						frameShadowOpacity={frameShadowOpacity}
						onFrameShadowOpacityChange={onFrameShadowOpacityChange}
						frameShadowBlur={frameShadowBlur}
						onFrameShadowBlurChange={onFrameShadowBlurChange}
						frameBorderEnabled={frameBorderEnabled}
						onFrameBorderEnabledChange={onFrameBorderEnabledChange}
						frameBorderWidth={frameBorderWidth}
						onFrameBorderWidthChange={onFrameBorderWidthChange}
						frameBorderColor={frameBorderColor}
						onFrameBorderColorChange={onFrameBorderColorChange}
						frameBorderOpacity={frameBorderOpacity}
						onFrameBorderOpacityChange={onFrameBorderOpacityChange}
						borderRadius={borderRadius}
						onBorderRadiusChange={onBorderRadiusChange}
						padding={padding}
						onPaddingChange={onPaddingChange}
						paddingSides={paddingSides}
						onPaddingSidesChange={onPaddingSidesChange}
						onCropToggle={handleCropToggle}
					/>
				)}
				{/* Cursor tab */}
				{activeTab === "cursor" && (
					<CursorSettingsTab
						tSettings={tSettings}
						showCursor={showCursor}
						onShowCursorChange={onShowCursorChange}
						hideWhenIdle={hideWhenIdle}
						onHideWhenIdleChange={onHideWhenIdleChange}
						idleHideDelayMs={idleHideDelayMs}
						onIdleHideDelayMsChange={onIdleHideDelayMsChange}
						cursorTypeMode={cursorTypeMode}
						onCursorTypeModeChange={onCursorTypeModeChange}
						cursorSize={cursorSize}
						onCursorSizeChange={onCursorSizeChange}
						cursorTilt={cursorTilt}
						onCursorTiltChange={onCursorTiltChange}
						cursorMovementStyle={cursorMovementStyle}
						onCursorMovementStyleChange={onCursorMovementStyleChange}
						smoothMovementEnabled={smoothMovementEnabled}
						onSmoothMovementEnabledChange={onSmoothMovementEnabledChange}
						cursorSpring={cursorSpring}
						onCursorSpringChange={onCursorSpringChange}
						cameraSpring={cameraSpring}
						onCameraSpringChange={onCameraSpringChange}
						highQualitySvgCursors={highQualitySvgCursors}
						onHighQualitySvgCursorsChange={onHighQualitySvgCursorsChange}
						showLegacyCursorSettings={showLegacyCursorSettings}
						onToggleLegacyCursorSettings={() => setShowLegacyCursorSettings((current) => !current)}
						loopCursor={loopCursor}
						onLoopCursorChange={onLoopCursorChange}
						cursorPack={cursorPack}
						onCursorPackChange={onCursorPackChange}
						cursorColor={cursorColor}
						onCursorColorChange={onCursorColorChange}
						cursorOpacity={cursorOpacity}
						onCursorOpacityChange={onCursorOpacityChange}
						cursorMotionBlur={cursorMotionBlur}
						onCursorMotionBlurChange={onCursorMotionBlurChange}
						cursorTrailLength={cursorTrailLength}
						onCursorTrailLengthChange={onCursorTrailLengthChange}
						cursorTrailOpacity={cursorTrailOpacity}
						onCursorTrailOpacityChange={onCursorTrailOpacityChange}
						clickEffectsEnabled={clickEffectsEnabled}
						onClickEffectsEnabledChange={onClickEffectsEnabledChange}
						cursorClickBounce={cursorClickBounce}
						onCursorClickBounceChange={onCursorClickBounceChange}
						clickHighlightColor={clickHighlightColor}
						onClickHighlightColorChange={onClickHighlightColorChange}
						clickHighlightSize={clickHighlightSize}
						onClickHighlightSizeChange={onClickHighlightSizeChange}
						clickHighlightOpacity={clickHighlightOpacity}
						onClickHighlightOpacityChange={onClickHighlightOpacityChange}
						cursorClickStyle={cursorClickStyle}
						onCursorClickStyleChange={onCursorClickStyleChange}
						motionPreset={motionPreset}
						onApplyMotionPreset={onApplyMotionPreset}
					/>
				)}

				{activeTab === "keyboard" && (
					<KeyboardSettingsTab
						tSettings={tSettings}
						showKeyboardShortcuts={showKeyboardShortcuts}
						onShowKeyboardShortcutsChange={onShowKeyboardShortcutsChange}
						keyboardShortcutPosition={keyboardShortcutPosition}
						onKeyboardShortcutPositionChange={onKeyboardShortcutPositionChange}
						keyboardShortcutTheme={keyboardShortcutTheme}
						onKeyboardShortcutThemeChange={onKeyboardShortcutThemeChange}
						keyboardShortcutScale={keyboardShortcutScale}
						onKeyboardShortcutScaleChange={onKeyboardShortcutScaleChange}
						keyboardShortcutOpacity={keyboardShortcutOpacity}
						onKeyboardShortcutOpacityChange={onKeyboardShortcutOpacityChange}
						keyboardShortcutDisplayMs={keyboardShortcutDisplayMs}
						onKeyboardShortcutDisplayMsChange={onKeyboardShortcutDisplayMsChange}
						keyboardShortcutMaxVisible={keyboardShortcutMaxVisible}
						onKeyboardShortcutMaxVisibleChange={onKeyboardShortcutMaxVisibleChange}
					/>
				)}

				{/* Background tab */}
				{activeTab === "background" && (
					<BackgroundSettingsTab
						tSettings={tSettings}
						hideBackground={hideBackground}
						selected={selected}
						onWallpaperChange={onWallpaperChange}
						backgroundTab={backgroundTab}
						onBackgroundTabChange={setBackgroundTab}
						fileInputRef={fileInputRef}
						onImageUpload={handleImageUpload}
						customImages={customImages}
						onRemoveCustomImage={handleRemoveCustomImage}
						wallpaperPreviewPaths={wallpaperPreviewPaths}
						selectedColor={selectedColor}
						onSelectedColorChange={setSelectedColor}
						colorPalette={colorPalette}
						gradient={gradient}
						gradientFromColor={gradientFromColor}
						onGradientFromColorChange={setGradientFromColor}
						gradientToColor={gradientToColor}
						onGradientToColorChange={setGradientToColor}
						gradientAngle={gradientAngle}
						onGradientAngleChange={setGradientAngle}
						gradientNoise={gradientNoise}
						onGradientNoiseChange={setGradientNoise}
						initialGradientState={initialGradientState}
					/>
				)}

				{/* Zoom tab */}
				{activeTab === "zoom" && (
					<ZoomSettingsTab
						tSettings={tSettings}
						selectedZoomDepth={selectedZoomDepth}
						selectedZoomMode={selectedZoomMode}
						onZoomDepthChange={onZoomDepthChange}
						onZoomModeChange={onZoomModeChange}
						zoomEnabled={zoomEnabled}
						onZoomDelete={handleDeleteClick}
					/>
				)}

				{/* Speed tab */}
				{activeTab === "speed" && (
					<SpeedSettingsTab
						tSettings={tSettings}
						selectedSpeedId={selectedSpeedId}
						selectedSpeedValue={selectedSpeedValue}
						onSpeedChange={onSpeedChange}
						onSpeedDelete={onSpeedDelete}
					/>
				)}

				{activeTab === "audio" && (
					<AudioSettingsTab
						tSettings={tSettings}
						builtInTracksByMood={builtInTracksByMood}
						selectedBuiltInTrackId={selectedBuiltInTrackId}
						selectedBuiltInTrack={selectedBuiltInTrack}
						builtInTrackDurations={builtInTrackDurations}
						playingBuiltInTrackId={playingBuiltInTrackId}
						selectedAudio={selectedAudio}
						missingAudioPath={missingAudioPath}
						onImportAudio={handleImportAudio}
						onSelectBuiltInTrack={handleSelectBuiltInTrack}
						onToggleBuiltInPreview={handleToggleBuiltInPreview}
						onReplaceBuiltInAudio={handleReplaceBuiltInAudio}
						onReplaceWithUploadedAudio={handleReplaceWithUploadedAudio}
						onRelinkMissingAudio={onRelinkMissingAudio}
						onRemoveMissingAudio={onRemoveMissingAudio}
						onAudioLoopChange={onAudioLoopChange}
						onAudioNormalizeChange={onAudioNormalizeChange}
						onAudioVolumeChange={onAudioVolumeChange}
						onAudioFadeChange={onAudioFadeChange}
						onAudioDelete={onAudioDelete}
					/>
				)}

				{/* Annotation tab */}
				{activeTab === "annotation" && (
					<AnnotationSettingsTab
						selectedAnnotation={selectedAnnotation}
						onAnnotationContentChange={onAnnotationContentChange}
						onAnnotationTypeChange={onAnnotationTypeChange}
						onAnnotationStyleChange={onAnnotationStyleChange}
						onAnnotationFigureDataChange={onAnnotationFigureDataChange}
						onAnnotationBlurDataChange={onAnnotationBlurDataChange}
						onAnnotationDelete={onAnnotationDelete}
					/>
				)}

				{/* Captions tab */}
				{activeTab === "captions" && captionSettings && (
					<CaptionsTab
						captionRegions={captionRegions}
						captionSettings={captionSettings}
						captionGenerationOptions={captionGenerationOptions}
						captionGenerationProgress={captionGenerationProgress}
						captionModelStatus={captionModelStatus}
						onDeleteCaptionModel={onDeleteCaptionModel}
						onCustomWhisperFile={onCustomWhisperFile}
						isTranscribing={isTranscribing}
						selectedCaptionId={selectedCaptionId}
						isEditingCaptionPosition={isEditingCaptionPosition}
						onToggleCaptionPositionEditing={(next) => onToggleCaptionPositionEditing?.(next)}
						onCaptionSettingsChange={(partial) => onCaptionSettingsChange?.(partial)}
						onCaptionStyleChange={(partial) => onCaptionStyleChange?.(partial)}
						onCaptionStylePresetChange={onCaptionStylePresetChange}
						onApplyCaptionPreset={(preset) => onApplyCaptionPreset?.(preset)}
						onCaptionGenerationOptionsChange={onCaptionGenerationOptionsChange}
						onCaptionTextChange={onCaptionTextChange}
						onCaptionDelete={onCaptionDelete}
						onDeleteAllCaptions={onDeleteAllCaptions}
						onCaptionSplit={onCaptionSplit}
						onCaptionMergeNext={onCaptionMergeNext}
						onSelectCaption={onSelectCaption}
						onAutoTranscribe={onAutoTranscribe}
						onCancelCaptionGeneration={onCancelCaptionGeneration}
						onCaptionExport={onCaptionExport}
						onCaptionImport={onCaptionImport}
						hasUsableCaptionAudio={hasUsableCaptionAudio}
						supportsAppleSpeech={supportsAppleSpeech}
					/>
				)}

				{/* Webcam tab */}
				{activeTab === "webcam" && webcamPath && webcamRegion && (
					<WebcamSettingsTab
						tSettings={tSettings}
						aspectRatio={aspectRatio}
						webcamMissing={webcamMissing}
						missingWebcamPath={missingWebcamPath}
						webcamPath={webcamPath}
						onRelinkMissingWebcam={onRelinkMissingWebcam}
						onRemoveMissingWebcam={onRemoveMissingWebcam}
						showAdvancedWebcam={showAdvancedWebcam}
						onToggleAdvancedWebcam={() => setShowAdvancedWebcam((prev) => !prev)}
						selectedCameraLayout={selectedCameraLayout}
						onCameraLayoutChange={onCameraLayoutChange}
						onResetRecommendedWebcam={onResetRecommendedWebcam}
						onResetSelectedCameraLayout={onResetSelectedCameraLayout}
						showWebcam={showWebcam}
						onShowWebcamChange={onShowWebcamChange}
						mirrorWebcam={mirrorWebcam}
						onMirrorWebcamChange={onMirrorWebcamChange}
						webcamRegion={webcamRegion}
						onWebcamRegionChange={onWebcamRegionChange}
						cameraSizeDuringZoom={cameraSizeDuringZoom}
						onCameraSizeDuringZoomChange={onCameraSizeDuringZoomChange}
						webcamEffects={webcamEffects}
						onWebcamEffectsChange={onWebcamEffectsChange}
						webcamPreviewMode={webcamPreviewMode}
						onWebcamPreviewModeChange={onWebcamPreviewModeChange}
						webcamHealthMetrics={webcamHealthMetrics}
						onApplyWebcamPreset={onApplyWebcamPreset}
					/>
				)}
			</div>

			{showCropModal &&
				cropRegion &&
				onCropChange &&
				createPortal(
					<>
						{/* Backdrop */}
						<div
							className="fixed inset-0 bg-scrim/50 backdrop-blur-[2px] z-50 opacity-100 duration-300 ease-out animate-in fade-in"
							onClick={handleCropCancel}
						/>

						{/* Dialog */}
						<div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
							<div
								role="dialog"
								aria-modal="true"
								className="pointer-events-auto w-[90vw] max-w-5xl max-h-[90vh] bg-raised rounded-xl shadow-dialog overflow-hidden opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3"
							>
								{/* Top accent line */}

								<div className="flex max-h-[calc(90vh-2px)] flex-col p-5 sm:p-8">
									{/* Header */}
									<div className="mb-4 flex shrink-0 items-center justify-between gap-3 sm:mb-6">
										<div className="flex min-w-0 items-center gap-3">
											<div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-accent/20 to-accent-hover/10 border border-accent/20 flex items-center justify-center">
												<Crop className="w-5 h-5 text-accent-fg" />
											</div>
											<div>
												<h2 className="text-heading font-semibold text-fg tracking-tight">
													{tSettings("crop.title")}
												</h2>
												<p className="text-caption text-fg-subtle mt-0.5">
													{tSettings("crop.instruction")}
												</p>
											</div>
										</div>
										<button
											type="button"
											onClick={handleCropCancel}
											className="rounded-xl p-2 text-fg-subtle hover:text-fg hover:bg-fill-hover transition-all duration-200 active:scale-95"
										>
											<X className="w-4 h-4" />
										</button>
									</div>

									{/* Crop area: the only part that scrolls, so the buttons stay visible */}
									<div className="custom-scrollbar min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-sunken">
										<CropControl
											videoElement={videoElement || null}
											cropRegion={cropRegion}
											baseCropRegion={baseCropRegion}
											onCropChange={onCropChange}
											aspectRatio={aspectRatio}
										/>
									</div>

									{/* Footer */}
									<div className="h-px shrink-0 bg-gradient-to-r from-transparent via-line to-transparent mt-4 mb-4 sm:mt-6 sm:mb-5" />
									<div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
										<Button
											variant="outline"
											onClick={handleCropCancel}
											className="h-10 px-5 text-label font-medium bg-fill-subtle border-line text-fg-muted hover:bg-fill-hover hover:text-fg hover:border-line-strong rounded-xl transition-all duration-200"
										>
											{t("editor.settingsPanel.cancel", "Cancel")}
										</Button>
										<Button
											onClick={() => setShowCropModal(false)}
											className="h-10 px-6 text-label font-semibold bg-accent hover:bg-accent-hover text-on-accent rounded-xl shadow-sm active:scale-[0.98] transition-all duration-200 border border-accent/30"
										>
											{t("common.actions.done")}
										</Button>
									</div>
								</div>
							</div>
						</div>
					</>,
					document.body,
				)}
		</div>
	);
}
