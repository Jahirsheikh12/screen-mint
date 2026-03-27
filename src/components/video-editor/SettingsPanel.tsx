import Block from "@uiw/react-color-block";
import {
	AlertTriangle,
	Camera,
	Captions,
	Crop,
	Gauge,
	Keyboard,
	Loader2,
	MessageSquare,
	MousePointer2,
	Music,
	Palette,
	Pause,
	Play,
	Sparkles,
	Trash2,
	Upload,
	X,
	ZoomIn,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssetPath, getRenderableAssetUrl } from "@/lib/assetPath";
import { type BackgroundMusicMood, BUILT_IN_BACKGROUND_MUSIC } from "@/lib/backgroundMusic";
import { cn } from "@/lib/utils";
import { BUILT_IN_WALLPAPERS, WALLPAPER_PATHS, WALLPAPER_RELATIVE_PATHS } from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { useI18n, useScopedT } from "../../contexts/I18nContext";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import {
	getAudioRegionDisplayName,
	loadAudioSelectionDurationMs,
	resolveAudioSourceUrl,
} from "./audioRegionUtils";
import { CropControl } from "./CropControl";
import { loadEditorPreferences, saveEditorPreferences } from "./editorPreferences";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { SliderControl } from "./SliderControl";
import type {
	AnnotationRegion,
	AnnotationType,
	AudioRegion,
	AudioTrackSelection,
	BlurData,
	CameraLayoutRegion,
	CaptionGenerationOptions,
	CaptionGenerationProgress,
	CaptionModelStatus,
	CaptionRegion,
	CaptionSettings,
	CaptionStyle,
	CaptionStylePreset,
	CropRegion,
	CursorPack,
	CursorStyle,
	FigureData,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	PlaybackSpeed,
	WebcamRegion,
	ZoomDepth,
} from "./types";
import {
	CAMERA_ZOOM_SCALE_DISABLED,
	CAPTION_STYLE_PRESETS,
	CURSOR_PACK_OPTIONS,
	CURSOR_STYLE_OPTIONS,
	DEFAULT_AUDIO_FADE_IN_MS,
	DEFAULT_AUDIO_FADE_OUT_MS,
	DEFAULT_AUDIO_REGION_VOLUME,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_CURSOR_TRAIL_LENGTH,
	DEFAULT_CURSOR_TRAIL_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_POSITION,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	DEFAULT_KEYBOARD_SHORTCUT_THEME,
	DEFAULT_ZOOM_MOTION_BLUR,
	KEYBOARD_SHORTCUT_POSITION_OPTIONS,
	KEYBOARD_SHORTCUT_THEME_OPTIONS,
	SPEED_OPTIONS,
} from "./types";
import { fromCursorSwaySliderValue, toCursorSwaySliderValue } from "./videoPlayback/cursorSway";

const GRADIENTS = [
	"linear-gradient(135deg, #03045e 0%, #0077b6 42%, #90e0ef 100%)",
	"linear-gradient(135deg, #0b090a 0%, #161a1d 38%, #e5383b 100%)",
	"linear-gradient(145deg, #14213d 0%, #fca311 52%, #ffe8b6 100%)",
	"linear-gradient(135deg, #081c15 0%, #1b4332 44%, #95d5b2 100%)",
	"linear-gradient(140deg, #2b2d42 0%, #8d99ae 48%, #edf2f4 100%)",
	"linear-gradient(135deg, #240046 0%, #7b2cbf 45%, #c77dff 100%)",
	"linear-gradient(130deg, #3d0000 0%, #9d0208 44%, #ffba08 100%)",
	"linear-gradient(145deg, #001219 0%, #005f73 42%, #ee9b00 100%)",
	"linear-gradient(135deg, #111827 0%, #1f2937 40%, #f59e0b 100%)",
	"linear-gradient(150deg, #1a1a40 0%, #4c1d95 42%, #f472b6 100%)",
	"radial-gradient(circle at 20% 20%, #fefae0 0%, #dda15e 42%, #6b705c 100%)",
	"radial-gradient(circle at 50% 25%, #f8f9fa 0%, #cdb4db 40%, #5a189a 100%)",
	"radial-gradient(circle at 78% 18%, #f1faee 0%, #a8dadc 40%, #1d3557 100%)",
	"radial-gradient(circle at 28% 30%, #fff1e6 0%, #ff7f51 42%, #7b2d26 100%)",
	"radial-gradient(circle at 65% 32%, #fff7ed 0%, #fb7185 38%, #7c2d12 100%)",
	"linear-gradient(135deg, #023047 0%, #219ebc 46%, #ffb703 100%)",
	"linear-gradient(135deg, #0f0c29 0%, #302b63 44%, #f27121 100%)",
	"linear-gradient(145deg, #2f3e46 0%, #52796f 40%, #cad2c5 100%)",
	"linear-gradient(130deg, #1b263b 0%, #415a77 44%, #e0e1dd 100%)",
	"linear-gradient(140deg, #10002b 0%, #5a189a 46%, #ff6d00 100%)",
	"linear-gradient(135deg, #2d033b 0%, #810ca8 42%, #e5b8f4 100%)",
	"linear-gradient(145deg, #1f2421 0%, #216869 42%, #9cc5a1 100%)",
	"linear-gradient(135deg, #3c096c 0%, #7b2cbf 44%, #ff8500 100%)",
	"linear-gradient(140deg, #0d1b2a 0%, #1b263b 42%, #778da9 100%)",
	"linear-gradient(135deg, #3a5a40 0%, #588157 40%, #dad7cd 100%)",
	"linear-gradient(145deg, #2b2d42 0%, #ef233c 42%, #ffd166 100%)",
	"linear-gradient(135deg, #001d3d 0%, #003566 40%, #ffc300 100%)",
	"linear-gradient(135deg, #0a1128 0%, #1282a2 46%, #f0f3bd 100%)",
	"linear-gradient(145deg, #2d00f7 0%, #6a00f4 38%, #ff8500 100%)",
	"linear-gradient(135deg, #004b23 0%, #38b000 42%, #ccff33 100%)",
	"linear-gradient(140deg, #590d22 0%, #a4133c 44%, #ffccd5 100%)",
	"linear-gradient(145deg, #14281d 0%, #355834 40%, #c2c5aa 100%)",
	"linear-gradient(135deg, #03071e 0%, #6a040f 44%, #faa307 100%)",
	"linear-gradient(150deg, #1d3557 0%, #457b9d 40%, #f1faee 100%)",
	"linear-gradient(135deg, #22577a 0%, #38a3a5 42%, #c7f9cc 100%)",
	"linear-gradient(145deg, #3c1642 0%, #086375 40%, #f5dd90 100%)",
	"linear-gradient(140deg, #2f1847 0%, #624763 38%, #f9c784 100%)",
	"radial-gradient(circle at 22% 24%, #fff8e7 0%, #ffd166 36%, #118ab2 100%)",
	"radial-gradient(circle at 72% 20%, #f8f9ff 0%, #b8c0ff 40%, #7209b7 100%)",
	"radial-gradient(circle at 30% 70%, #fef2f2 0%, #fda4af 34%, #7f1d1d 100%)",
	"radial-gradient(circle at 80% 32%, #f1fff8 0%, #95d5b2 38%, #081c15 100%)",
	"radial-gradient(circle at 46% 18%, #fff7f0 0%, #ffb4a2 40%, #6d6875 100%)",
	"linear-gradient(135deg, #283618 0%, #606c38 40%, #fefae0 100%)",
	"linear-gradient(145deg, #1e1e24 0%, #92140c 42%, #ffcf99 100%)",
	"linear-gradient(135deg, #001524 0%, #15616d 44%, #ffecd1 100%)",
	"linear-gradient(140deg, #0d1321 0%, #1d2d44 42%, #f0ebd8 100%)",
	"linear-gradient(145deg, #201e1f 0%, #4f5d75 40%, #ef8354 100%)",
];

type BackgroundTab = "image" | "color" | "gradient";

function isHexWallpaper(value: string): boolean {
	return /^#(?:[0-9a-f]{3}){1,2}$/i.test(value);
}

function formatAudioDuration(durationMs?: number) {
	if (!durationMs || durationMs <= 0) {
		return "--:--";
	}

	const seconds = Math.max(1, Math.round(durationMs / 1000));
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getBackgroundTabForWallpaper(value: string): BackgroundTab {
	if (
		GRADIENTS.includes(value) ||
		value.startsWith("linear-gradient") ||
		value.startsWith("radial-gradient")
	) {
		return "gradient";
	}

	if (isHexWallpaper(value)) {
		return "color";
	}

	return "image";
}

function groupBuiltInTracksByMood() {
	return BUILT_IN_BACKGROUND_MUSIC.reduce<
		Record<BackgroundMusicMood, typeof BUILT_IN_BACKGROUND_MUSIC>
	>(
		(acc, track) => {
			if (!acc[track.mood]) {
				acc[track.mood] = [];
			}

			acc[track.mood].push(track);
			return acc;
		},
		{
			"upbeat-tech": [],
			"calm-ambient": [],
			"crisp-minimal": [],
			"warm-corporate": [],
			"punchy-motion": [],
			"studio-focus": [],
		},
	);
}

interface SettingsPanelProps {
	selected: string;
	onWallpaperChange: (path: string) => void;
	selectedZoomDepth?: ZoomDepth | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	selectedZoomId?: string | null;
	onZoomDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onTrimDelete?: (id: string) => void;
	shadowIntensity?: number;
	onShadowChange?: (intensity: number) => void;
	backgroundBlur?: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlur?: number;
	onZoomMotionBlurChange?: (amount: number) => void;
	connectZooms?: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	showCursor?: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	loopCursor?: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorSize?: number;
	onCursorSizeChange?: (size: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (smoothing: number) => void;
	cursorMotionBlur?: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorClickBounce?: number;
	onCursorClickBounceChange?: (amount: number) => void;
	cursorSway?: number;
	onCursorSwayChange?: (amount: number) => void;
	cursorStyle?: CursorStyle;
	onCursorStyleChange?: (style: CursorStyle) => void;
	cursorPack?: CursorPack;
	onCursorPackChange?: (pack: CursorPack) => void;
	cursorColor?: string;
	onCursorColorChange?: (color: string) => void;
	cursorOpacity?: number;
	onCursorOpacityChange?: (opacity: number) => void;
	clickHighlightColor?: string;
	onClickHighlightColorChange?: (color: string) => void;
	clickHighlightSize?: number;
	onClickHighlightSizeChange?: (size: number) => void;
	clickHighlightOpacity?: number;
	onClickHighlightOpacityChange?: (opacity: number) => void;
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
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding?: number;
	onPaddingChange?: (padding: number) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
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
	onWebcamRegionChange?: (region: Partial<WebcamRegion>) => void;
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
	onAudioDelete?: (id: string) => void;
	missingAudioPath?: string | null;
	onRelinkMissingAudio?: () => void;
	onRemoveMissingAudio?: () => void;
	captionRegions?: CaptionRegion[];
	captionGenerationOptions?: CaptionGenerationOptions;
	captionGenerationProgress?: CaptionGenerationProgress | null;
	captionModelStatus?: CaptionModelStatus | null;
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
	isTranscribing?: boolean;
	onAutoTranscribe?: () => void;
	onCancelCaptionGeneration?: () => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

export default function SettingsPanel({
	selected,
	onWallpaperChange,
	selectedZoomDepth,
	onZoomDepthChange,
	selectedZoomId,
	onZoomDelete,
	selectedTrimId,
	onTrimDelete,
	shadowIntensity = 0.67,
	onShadowChange,
	backgroundBlur = 0,
	onBackgroundBlurChange,
	zoomMotionBlur = 0,
	onZoomMotionBlurChange,
	connectZooms = true,
	onConnectZoomsChange,
	showCursor = false,
	onShowCursorChange,
	loopCursor = false,
	onLoopCursorChange,
	cursorSize = 5,
	onCursorSizeChange,
	cursorSmoothing = 2,
	onCursorSmoothingChange,
	cursorMotionBlur = 0.35,
	onCursorMotionBlurChange,
	cursorClickBounce = 1,
	onCursorClickBounceChange,
	cursorSway = DEFAULT_CURSOR_SWAY,
	onCursorSwayChange,
	cursorStyle = "default",
	onCursorStyleChange,
	cursorPack = "classic",
	onCursorPackChange,
	cursorColor = DEFAULT_CURSOR_COLOR,
	onCursorColorChange,
	cursorOpacity = DEFAULT_CURSOR_OPACITY,
	onCursorOpacityChange,
	clickHighlightColor = DEFAULT_CLICK_HIGHLIGHT_COLOR,
	onClickHighlightColorChange,
	clickHighlightSize = DEFAULT_CLICK_HIGHLIGHT_SIZE,
	onClickHighlightSizeChange,
	clickHighlightOpacity = DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	onClickHighlightOpacityChange,
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
	borderRadius = 12.5,
	onBorderRadiusChange,
	padding = 0,
	onPaddingChange,
	cropRegion,
	onCropChange,
	aspectRatio,
	onAspectRatioChange,
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
	onWebcamRegionChange,
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
	onAudioDelete,
	missingAudioPath,
	onRelinkMissingAudio,
	onRemoveMissingAudio,
	captionRegions = [],
	captionGenerationOptions,
	captionGenerationProgress,
	captionModelStatus,
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
	isTranscribing = false,
	onAutoTranscribe,
	onCancelCaptionGeneration,
}: SettingsPanelProps) {
	const tSettings = useScopedT("settings");
	const { t } = useI18n();
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [wallpaperPreviewPaths, setWallpaperPreviewPaths] = useState<string[]>([]);
	const [customImages, setCustomImages] = useState<string[]>(
		initialEditorPreferences.customWallpapers,
	);
	const removeBackgroundStateRef = useRef<{
		aspectRatio: AspectRatio;
		padding: number;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const hasUsableCaptionAudio =
		!captionModelStatus || captionModelStatus.availableSourceAudios.length > 0;
	const selectedCaptionBackend =
		captionGenerationOptions?.preferredBackend ??
		DEFAULT_CAPTION_GENERATION_OPTIONS.preferredBackend;
	const isAppleSpeechSelected = selectedCaptionBackend === "apple-speech";
	const supportsAppleSpeech =
		captionModelStatus?.availableBackends.includes("apple-speech") ?? false;

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const resolved = await Promise.all(
					WALLPAPER_RELATIVE_PATHS.map(async (path) =>
						getRenderableAssetUrl(await getAssetPath(path)),
					),
				);
				if (mounted) setWallpaperPreviewPaths(resolved);
			} catch {
				if (mounted) setWallpaperPreviewPaths(WALLPAPER_PATHS);
			}
		})();
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
		"#10B981",
		"#000000",
		"#607D8B",
		"#795548",
	];

	const [selectedColor, setSelectedColor] = useState(
		isHexWallpaper(selected) ? selected : "#ADADAD",
	);
	const [gradient, setGradient] = useState<string>(
		GRADIENTS.includes(selected) ? selected : GRADIENTS[0],
	);
	const [backgroundTab, setBackgroundTab] = useState<BackgroundTab>(() =>
		getBackgroundTabForWallpaper(selected),
	);
	const [showCropModal, setShowCropModal] = useState(false);
	const [showAdvancedWebcam, setShowAdvancedWebcam] = useState(false);
	const [activeTab, setActiveTab] = useState<
		| "effects"
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

		if (GRADIENTS.includes(selected)) {
			setGradient(selected);
		}

		if (selected.startsWith("data:image") && !customImages.includes(selected)) {
			setCustomImages((prev) => [selected, ...prev]);
		}
	}, [customImages, selected]);

	useEffect(() => {
		saveEditorPreferences({ customWallpapers: customImages });
	}, [customImages]);

	const zoomEnabled = Boolean(selectedZoomDepth);
	const trimEnabled = Boolean(selectedTrimId);

	const handleDeleteClick = () => {
		if (selectedZoomId && onZoomDelete) {
			onZoomDelete(selectedZoomId);
		}
	};

	const handleTrimDeleteClick = () => {
		if (selectedTrimId && onTrimDelete) {
			onTrimDelete(selectedTrimId);
		}
	};

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
			toast.error(t("common.failedToUploadImage"), {
				description: t("common.errorReadingFile"),
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

	const webcamSizeValue = webcamRegion
		? Math.round(((webcamRegion.size.width + webcamRegion.size.height) / 2) * 10) / 10
		: 20;

	const handleWebcamSizeSliderChange = (nextSize: number) => {
		if (!webcamRegion || !onWebcamRegionChange) {
			return;
		}

		const width = Math.max(8, Math.min(40, nextSize));
		const aspectRatio =
			webcamRegion.shape === "circle" || webcamRegion.shape === "square"
				? 1
				: webcamRegion.size.height / Math.max(webcamRegion.size.width, 0.01);
		onWebcamRegionChange({
			size: {
				width,
				height: Math.max(8, Math.min(40, width * aspectRatio)),
			},
		});
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;
	const selectedCameraLayout = selectedCameraLayoutId
		? cameraLayouts.find((layout) => layout.id === selectedCameraLayoutId)
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
		{ id: "cursor" as const, icon: MousePointer2, label: "Cursor" },
		{ id: "keyboard" as const, icon: Keyboard, label: tSettings("keyboard.title") },
		{ id: "background" as const, icon: Palette, label: tSettings("background.title") },
		{ id: "zoom" as const, icon: ZoomIn, label: tSettings("zoom.level") },
		{ id: "speed" as const, icon: Gauge, label: tSettings("speed.playbackSpeed") },
		{ id: "audio" as const, icon: Music, label: tSettings("audio.title", "Audio") },
		{ id: "annotation" as const, icon: MessageSquare, label: "Annotation" },
		{ id: "captions" as const, icon: Captions, label: "Captions" },
		...(webcamPath
			? [{ id: "webcam" as const, icon: Camera, label: tSettings("webcam.title") }]
			: []),
	];

	return (
		<div className="w-[400px] shrink-0 min-w-0 bg-[#0A0F0D] border border-white/5 rounded-2xl flex flex-row shadow-xl h-full overflow-hidden">
			{/* Sidebar navigation */}
			<div className="flex flex-col gap-1 p-1.5 border-r border-white/5 bg-white/[0.02]">
				{sidebarTabs.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							title={tab.label}
							className={cn(
								"flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
								isActive
									? "bg-[#10B981] text-white shadow-md shadow-[#10B981]/20"
									: "text-slate-500 hover:text-slate-300 hover:bg-white/5",
							)}
						>
							<tab.icon className="w-5 h-5" />
						</button>
					);
				})}
			</div>

			{/* Content area */}
			<div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-3 pb-0">
				{/* Effects tab */}
				{activeTab === "effects" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("effects.title")}
							</span>
							<KeyboardShortcutsHelp />
						</div>

						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("effects.connectZooms")}
								</div>
								<Switch
									checked={connectZooms}
									onCheckedChange={onConnectZoomsChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("effects.removeBackground")}
								</div>
								<Switch
									checked={aspectRatio === "native" && padding === 0}
									onCheckedChange={(checked) => {
										if (checked) {
											removeBackgroundStateRef.current = {
												aspectRatio,
												padding,
											};
											onAspectRatioChange?.("native");
											onPaddingChange?.(0);
										}
									}}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.backgroundBlur")}
									value={backgroundBlur}
									defaultValue={0}
									min={0}
									max={8}
									step={0.25}
									onChange={(v) => onBackgroundBlurChange?.(v)}
									formatValue={(v) => `${v.toFixed(1)}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								/>
							</div>
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.zoomMotionBlur")}
									value={zoomMotionBlur}
									defaultValue={DEFAULT_ZOOM_MOTION_BLUR}
									min={0}
									max={2}
									step={0.05}
									onChange={(v) => onZoomMotionBlurChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
								/>
							</div>
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.shadow")}
									value={shadowIntensity}
									defaultValue={0}
									min={0}
									max={1}
									step={0.01}
									onChange={(v) => onShadowChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								/>
							</div>
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.roundness")}
									value={borderRadius}
									defaultValue={12.5}
									min={0}
									max={25}
									step={0.5}
									onChange={(v) => onBorderRadiusChange?.(v)}
									formatValue={(v) => `${v}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								/>
							</div>
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.padding")}
									value={padding}
									defaultValue={0}
									min={0}
									max={100}
									step={1}
									onChange={(v) => onPaddingChange?.(v)}
									formatValue={(v) => `${v}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
								/>
							</div>
						</div>

						<Button
							onClick={handleCropToggle}
							variant="outline"
							className="w-full mt-2 gap-1.5 bg-white/5 text-slate-200 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white text-[10px] h-8 transition-all"
						>
							<Crop className="w-3 h-3" />
							{tSettings("crop.title")}
						</Button>
					</div>
				)}

				{/* Cursor tab */}
				{activeTab === "cursor" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("cursor.title")}
							</span>
						</div>

						<div className="flex flex-col gap-1.5">
							{/* Show / Loop toggles */}
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("effects.showCursor")}
								</div>
								<Switch
									checked={showCursor}
									onCheckedChange={onShowCursorChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("effects.loopCursor")}
								</div>
								<Switch
									checked={loopCursor}
									onCheckedChange={onLoopCursorChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("cursor.pack")}
								</div>
								<div className="grid grid-cols-2 gap-1">
									{CURSOR_PACK_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() => onCursorPackChange?.(opt.value)}
											className={cn(
												"px-2 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer",
												cursorPack === opt.value
													? "bg-[#10B981] text-white shadow-sm"
													: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
											)}
										>
											{opt.label}
										</button>
									))}
								</div>
							</div>

							{/* Cursor Style */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">Style</div>
								<div className="grid grid-cols-5 gap-1">
									{CURSOR_STYLE_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() => onCursorStyleChange?.(opt.value)}
											className={cn(
												"px-1.5 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer",
												cursorStyle === opt.value
													? "bg-[#10B981] text-white shadow-sm"
													: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
											)}
										>
											{opt.label}
										</button>
									))}
								</div>
							</div>

							{/* Cursor Color */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">Cursor Color</div>
								<div className="flex items-center gap-2">
									<input
										type="color"
										value={cursorColor}
										onChange={(e) => onCursorColorChange?.(e.target.value)}
										className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent"
									/>
									<input
										type="text"
										value={cursorColor}
										onChange={(e) => onCursorColorChange?.(e.target.value)}
										className="flex-1 h-7 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#10B981]"
									/>
									<button
										type="button"
										onClick={() => onCursorColorChange?.(DEFAULT_CURSOR_COLOR)}
										className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
									>
										Reset
									</button>
								</div>
							</div>

							{/* Cursor Opacity */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label="Cursor Opacity"
									value={cursorOpacity}
									defaultValue={DEFAULT_CURSOR_OPACITY}
									min={0.1}
									max={1}
									step={0.05}
									onChange={(v) => onCursorOpacityChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								/>
							</div>

							{/* Cursor Size */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.cursorSize")}
									value={cursorSize}
									defaultValue={DEFAULT_CURSOR_SIZE}
									min={0.5}
									max={10}
									step={0.05}
									onChange={(v) => onCursorSizeChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
								/>
							</div>

							{/* Section: Motion */}
							<div className="mt-2 mb-1">
								<span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
									Motion
								</span>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.cursorSmoothing")}
									value={cursorSmoothing}
									defaultValue={DEFAULT_CURSOR_SMOOTHING}
									min={0}
									max={2}
									step={0.01}
									onChange={(v) => onCursorSmoothingChange?.(v)}
									formatValue={(v) => (v <= 0 ? "Off" : v.toFixed(2))}
									parseInput={(t) => parseFloat(t)}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.cursorMotionBlur")}
									value={cursorMotionBlur}
									defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
									min={0}
									max={2}
									step={0.05}
									onChange={(v) => onCursorMotionBlurChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.cursorSway")}
									value={toCursorSwaySliderValue(cursorSway)}
									defaultValue={toCursorSwaySliderValue(DEFAULT_CURSOR_SWAY)}
									min={0}
									max={toCursorSwaySliderValue(2)}
									step={toCursorSwaySliderValue(0.05)}
									onChange={(v) => onCursorSwayChange?.(fromCursorSwaySliderValue(v))}
									formatValue={(v) => (v <= 0 ? "Off" : `${v.toFixed(2)}×`)}
									parseInput={(t) => {
										const normalized = t.trim().toLowerCase();
										if (normalized === "off") {
											return 0;
										}
										return parseFloat(t.replace(/×$/, ""));
									}}
								/>
							</div>

							{/* Trail */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label="Trail Length"
									value={cursorTrailLength}
									defaultValue={DEFAULT_CURSOR_TRAIL_LENGTH}
									min={0}
									max={20}
									step={1}
									onChange={(v) => onCursorTrailLengthChange?.(v)}
									formatValue={(v) => (v <= 0 ? "Off" : `${v}`)}
									parseInput={(t) => {
										if (t.trim().toLowerCase() === "off") return 0;
										return parseInt(t, 10);
									}}
								/>
							</div>

							{cursorTrailLength > 0 && (
								<div className="p-2 rounded-lg bg-white/5 border border-white/5">
									<SliderControl
										label="Trail Opacity"
										value={cursorTrailOpacity}
										defaultValue={DEFAULT_CURSOR_TRAIL_OPACITY}
										min={0.05}
										max={1}
										step={0.05}
										onChange={(v) => onCursorTrailOpacityChange?.(v)}
										formatValue={(v) => `${Math.round(v * 100)}%`}
										parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
									/>
								</div>
							)}

							{/* Section: Click Effects */}
							<div className="mt-2 mb-1">
								<span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
									Click Effects
								</span>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("effects.cursorClickBounce")}
									value={cursorClickBounce}
									defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
									min={0}
									max={5}
									step={0.05}
									onChange={(v) => onCursorClickBounceChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
								/>
							</div>

							{/* Click Highlight Color */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">Click Highlight Color</div>
								<div className="flex items-center gap-2">
									<input
										type="color"
										value={clickHighlightColor}
										onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
										className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent"
									/>
									<input
										type="text"
										value={clickHighlightColor}
										onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
										className="flex-1 h-7 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#10B981]"
									/>
									<button
										type="button"
										onClick={() => onClickHighlightColorChange?.(DEFAULT_CLICK_HIGHLIGHT_COLOR)}
										className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
									>
										Reset
									</button>
								</div>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label="Click Highlight Size"
									value={clickHighlightSize}
									defaultValue={DEFAULT_CLICK_HIGHLIGHT_SIZE}
									min={0}
									max={3}
									step={0.1}
									onChange={(v) => onClickHighlightSizeChange?.(v)}
									formatValue={(v) => (v <= 0 ? "Off" : `${v.toFixed(1)}×`)}
									parseInput={(t) => {
										if (t.trim().toLowerCase() === "off") return 0;
										return parseFloat(t.replace(/×$/, ""));
									}}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label="Click Highlight Opacity"
									value={clickHighlightOpacity}
									defaultValue={DEFAULT_CLICK_HIGHLIGHT_OPACITY}
									min={0}
									max={1}
									step={0.05}
									onChange={(v) => onClickHighlightOpacityChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								/>
							</div>
						</div>
					</div>
				)}

				{activeTab === "keyboard" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("keyboard.title")}
							</span>
						</div>

						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("keyboard.showShortcuts")}
								</div>
								<Switch
									checked={showKeyboardShortcuts}
									onCheckedChange={onShowKeyboardShortcutsChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("keyboard.position")}
								</div>
								<div className="grid grid-cols-2 gap-1">
									{KEYBOARD_SHORTCUT_POSITION_OPTIONS.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={() => onKeyboardShortcutPositionChange?.(option.value)}
											className={cn(
												"px-2 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer",
												keyboardShortcutPosition === option.value
													? "bg-[#10B981] text-white shadow-sm"
													: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
											)}
										>
											{tSettings(`keyboard.positions.${option.value}`)}
										</button>
									))}
								</div>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("keyboard.theme")}
								</div>
								<div className="grid grid-cols-3 gap-1">
									{KEYBOARD_SHORTCUT_THEME_OPTIONS.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={() => onKeyboardShortcutThemeChange?.(option.value)}
											className={cn(
												"px-2 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer",
												keyboardShortcutTheme === option.value
													? "bg-[#10B981] text-white shadow-sm"
													: "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
											)}
										>
											{tSettings(`keyboard.themes.${option.value}`)}
										</button>
									))}
								</div>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("keyboard.scale")}
									value={keyboardShortcutScale}
									defaultValue={DEFAULT_KEYBOARD_SHORTCUT_SCALE}
									min={0.5}
									max={2}
									step={0.05}
									onChange={(value) => onKeyboardShortcutScaleChange?.(value)}
									formatValue={(value) => `${value.toFixed(2)}×`}
									parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("keyboard.opacity")}
									value={keyboardShortcutOpacity}
									defaultValue={DEFAULT_KEYBOARD_SHORTCUT_OPACITY}
									min={0.05}
									max={1}
									step={0.05}
									onChange={(value) => onKeyboardShortcutOpacityChange?.(value)}
									formatValue={(value) => `${Math.round(value * 100)}%`}
									parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("keyboard.displayDuration")}
									value={keyboardShortcutDisplayMs}
									defaultValue={DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS}
									min={250}
									max={4000}
									step={50}
									onChange={(value) => onKeyboardShortcutDisplayMsChange?.(value)}
									formatValue={(value) => `${Math.round(value)}ms`}
									parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("keyboard.maxVisible")}
									value={keyboardShortcutMaxVisible}
									defaultValue={DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE}
									min={1}
									max={3}
									step={1}
									onChange={(value) =>
										onKeyboardShortcutMaxVisibleChange?.(Math.round(value))
									}
									formatValue={(value) => `${Math.round(value)}`}
									parseInput={(text) => parseInt(text, 10)}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Background tab */}
				{activeTab === "background" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("background.title")}
							</span>
						</div>
						<Tabs
							value={backgroundTab}
							onValueChange={(value) => setBackgroundTab(value as BackgroundTab)}
							className="w-full"
						>
							<TabsList className="mb-2 bg-white/5 border border-white/5 p-0.5 w-full grid grid-cols-3 h-7 rounded-lg">
								<TabsTrigger
									value="image"
									className="data-[state=active]:bg-[#10B981] data-[state=active]:text-white text-slate-400 text-[10px] py-1 rounded-md transition-all"
								>
									{tSettings("background.image")}
								</TabsTrigger>
								<TabsTrigger
									value="color"
									className="data-[state=active]:bg-[#10B981] data-[state=active]:text-white text-slate-400 text-[10px] py-1 rounded-md transition-all"
								>
									{tSettings("background.color")}
								</TabsTrigger>
								<TabsTrigger
									value="gradient"
									className="data-[state=active]:bg-[#10B981] data-[state=active]:text-white text-slate-400 text-[10px] py-1 rounded-md transition-all"
								>
									{tSettings("background.gradient")}
								</TabsTrigger>
							</TabsList>

							<div className="max-h-[min(300px,40vh)] overflow-y-auto custom-scrollbar">
								<TabsContent value="image" className="mt-0 space-y-2">
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImageUpload}
										accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
										className="hidden"
									/>
									<Button
										onClick={() => fileInputRef.current?.click()}
										variant="outline"
										className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-[#10B981] hover:text-white hover:border-[#10B981] transition-all h-7 text-[10px]"
									>
										<Upload className="w-3 h-3" />
										{tSettings("background.uploadCustom")}
									</Button>

									<div className="grid grid-cols-7 gap-1.5">
										{customImages.map((imageUrl, idx) => {
											const isSelected = selected === imageUrl;
											return (
												<div
													key={`custom-${idx}`}
													className={cn(
														"aspect-square w-9 h-9 rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 relative group shadow-sm",
														isSelected
															? "border-[#10B981] ring-1 ring-[#10B981]/30"
															: "border-white/10 hover:border-[#10B981]/40 opacity-80 hover:opacity-100 bg-white/5",
													)}
													style={{
														backgroundImage: `url(${imageUrl})`,
														backgroundSize: "cover",
														backgroundPosition: "center",
													}}
													onClick={() => onWallpaperChange(imageUrl)}
													role="button"
												>
													<button
														onClick={(e) => handleRemoveCustomImage(imageUrl, e)}
														className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
													>
														<X className="w-2 h-2 text-white" />
													</button>
												</div>
											);
										})}

										{(wallpaperPreviewPaths.length > 0
											? wallpaperPreviewPaths
											: WALLPAPER_PATHS
										).map((previewPath, index) => {
											const wallpaper = BUILT_IN_WALLPAPERS[index];
											const wallpaperValue = WALLPAPER_PATHS[index] ?? previewPath;
											const isSelected = (() => {
												if (!selected) return false;
												if (selected === wallpaperValue || selected === previewPath) return true;
												try {
													const clean = (s: string) =>
														s.replace(/^file:\/\//, "").replace(/^\//, "");
													if (clean(selected).endsWith(clean(wallpaperValue))) return true;
													if (clean(wallpaperValue).endsWith(clean(selected))) return true;
													if (clean(selected).endsWith(clean(previewPath))) return true;
													if (clean(previewPath).endsWith(clean(selected))) return true;
												} catch {
													return false;
												}
												return false;
											})();
											return (
												<div
													key={wallpaperValue}
													className={cn(
														"aspect-square w-9 h-9 rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
														isSelected
															? "border-[#10B981] ring-1 ring-[#10B981]/30"
															: "border-white/10 hover:border-[#10B981]/40 opacity-80 hover:opacity-100 bg-white/5",
													)}
													aria-label={wallpaper?.label ?? `Wallpaper ${index + 1}`}
													title={wallpaper?.label ?? `Wallpaper ${index + 1}`}
													style={{
														backgroundImage: `url(${previewPath})`,
														backgroundSize: "cover",
														backgroundPosition: "center",
													}}
													onClick={() => onWallpaperChange(wallpaperValue)}
													role="button"
												/>
											);
										})}
									</div>
								</TabsContent>

								<TabsContent value="color" className="mt-0">
									<div className="p-1">
										<Block
											color={selectedColor}
											colors={colorPalette}
											onChange={(color) => {
												setSelectedColor(color.hex);
												onWallpaperChange(color.hex);
											}}
											style={{
												width: "100%",
												borderRadius: "8px",
											}}
										/>
									</div>
								</TabsContent>

								<TabsContent value="gradient" className="mt-0">
									<div className="grid grid-cols-7 gap-1.5">
										{GRADIENTS.map((g, idx) => (
											<div
												key={g}
												className={cn(
													"aspect-square w-9 h-9 rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
													gradient === g
														? "border-[#10B981] ring-1 ring-[#10B981]/30"
														: "border-white/10 hover:border-[#10B981]/40 opacity-80 hover:opacity-100 bg-white/5",
												)}
												style={{ background: g }}
												aria-label={`Gradient ${idx + 1}`}
												onClick={() => {
													setGradient(g);
													onWallpaperChange(g);
												}}
												role="button"
											/>
										))}
									</div>
								</TabsContent>
							</div>
						</Tabs>
					</div>
				)}

				{/* Zoom tab */}
				{activeTab === "zoom" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">{tSettings("zoom.level")}</span>
							{zoomEnabled && selectedZoomDepth && (
								<span className="text-[10px] uppercase tracking-wider font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
									{ZOOM_DEPTH_OPTIONS.find((o) => o.depth === selectedZoomDepth)?.label}
								</span>
							)}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{ZOOM_DEPTH_OPTIONS.map((option) => {
								const isActive = selectedZoomDepth === option.depth;
								return (
									<Button
										key={option.depth}
										type="button"
										disabled={!zoomEnabled}
										onClick={() => onZoomDepthChange?.(option.depth)}
										className={cn(
											"h-9 rounded-lg border shadow-sm transition-all justify-center",
											"duration-200 ease-out",
											zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
											isActive
												? "border-[#10B981] bg-[#10B981] text-white shadow-[#10B981]/20"
												: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200",
										)}
									>
										<span className="text-xs font-semibold">{option.label}</span>
									</Button>
								);
							})}
						</div>
						{!zoomEnabled && (
							<p className="text-[10px] text-slate-500 mt-2 text-center">
								{tSettings("zoom.selectRegion")}
							</p>
						)}
						{zoomEnabled && (
							<Button
								onClick={handleDeleteClick}
								variant="destructive"
								size="sm"
								className="mt-2 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
							>
								<Trash2 className="w-3 h-3" />
								{tSettings("zoom.deleteZoom")}
							</Button>
						)}

						{trimEnabled && (
							<div className="mt-4 pt-4 border-t border-white/5">
								<span className="text-sm font-medium text-slate-200 mb-3 block">
									{tSettings("trim.deleteRegion")}
								</span>
								<Button
									onClick={handleTrimDeleteClick}
									variant="destructive"
									size="sm"
									className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
								>
									<Trash2 className="w-3 h-3" />
									{tSettings("trim.deleteRegion")}
								</Button>
							</div>
						)}
					</div>
				)}

				{/* Speed tab */}
				{activeTab === "speed" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("speed.playbackSpeed")}
							</span>
							{selectedSpeedId && selectedSpeedValue && (
								<span className="text-[10px] uppercase tracking-wider font-medium text-[#d97706] bg-[#d97706]/10 px-2 py-0.5 rounded-full">
									{SPEED_OPTIONS.find((o) => o.speed === selectedSpeedValue)?.label ??
										`${selectedSpeedValue}×`}
								</span>
							)}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{SPEED_OPTIONS.map((option) => {
								const isActive = selectedSpeedValue === option.speed;
								return (
									<Button
										key={option.speed}
										type="button"
										disabled={!selectedSpeedId}
										onClick={() => onSpeedChange?.(option.speed)}
										className={cn(
											"h-9 rounded-lg border shadow-sm transition-all justify-center",
											"duration-200 ease-out",
											selectedSpeedId
												? "opacity-100 cursor-pointer"
												: "opacity-40 cursor-not-allowed",
											isActive
												? "border-[#d97706] bg-[#d97706] text-white shadow-[#d97706]/20"
												: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200",
										)}
									>
										<span className="text-xs font-semibold">{option.label}</span>
									</Button>
								);
							})}
						</div>
						{!selectedSpeedId && (
							<p className="text-[10px] text-slate-500 mt-2 text-center">
								{tSettings("speed.selectRegion")}
							</p>
						)}
						{selectedSpeedId && (
							<Button
								onClick={() => selectedSpeedId && onSpeedDelete?.(selectedSpeedId)}
								variant="destructive"
								size="sm"
								className="mt-2 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
							>
								<Trash2 className="w-3 h-3" />
								{tSettings("speed.deleteRegion")}
							</Button>
						)}
					</div>
				)}

				{activeTab === "audio" && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("audio.title", "Background Audio")}
							</span>
							<span className="text-[10px] uppercase tracking-wider font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
								{tSettings("audio.subtleMix", "Subtle Mix")}
							</span>
						</div>

						<div className="flex flex-col gap-1.5">
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<p className="text-[11px] text-slate-400 leading-relaxed">
									{tSettings(
										"audio.subtitle",
										"Keep your voice clear and add a subtle music bed for polished demos.",
									)}
								</p>
								<div className="mt-3 flex gap-2">
									<Button
										type="button"
										onClick={() => void handleImportAudio()}
										className="w-full gap-2 bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 hover:border-white/20"
									>
										<Upload className="h-3.5 w-3.5" />
										{tSettings("audio.upload", "Upload audio")}
									</Button>
								</div>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("audio.library", "Built-in Library")}
								</div>
								{Object.entries(builtInTracksByMood).map(([mood, tracks]) => (
									<div key={mood} className="mb-3 last:mb-0">
										<div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
											{tSettings(`audio.moods.${mood}`, mood)}
										</div>
										<div className="space-y-1.5">
											{tracks.map((track) => {
												const isSelected = track.id === selectedBuiltInTrackId;
												return (
													<button
														key={track.id}
														type="button"
														onClick={() => void handleSelectBuiltInTrack(track.id)}
														className={cn(
															"w-full rounded-lg border px-2.5 py-2 text-left transition-all",
															isSelected
																? "border-[#10B981]/40 bg-[#10B981]/10"
																: "border-white/8 bg-black/10 hover:bg-white/5 hover:border-white/15",
														)}
													>
														<div className="flex items-center justify-between gap-3">
															<div className="flex min-w-0 items-center gap-2">
																<button
																	type="button"
																	onClick={(event) => {
																		event.stopPropagation();
																		void handleToggleBuiltInPreview(track.id);
																	}}
																	className={cn(
																		"flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
																		playingBuiltInTrackId === track.id
																			? "border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981]"
																			: "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-slate-100",
																	)}
																	aria-label={
																		playingBuiltInTrackId === track.id
																			? "Pause preview"
																			: "Play preview"
																	}
																>
																	{playingBuiltInTrackId === track.id ? (
																		<Pause className="h-3.5 w-3.5" />
																	) : (
																		<Play className="h-3.5 w-3.5 fill-current" />
																	)}
																</button>
																<div className="min-w-0">
																	<div className="truncate text-xs font-medium text-slate-200">
																		{track.label}
																	</div>
																	<div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
																		<span>
																			{formatAudioDuration(builtInTrackDurations[track.id])}
																		</span>
																		<span className="text-white/15">•</span>
																		<span>
																			{tSettings(`audio.moods.${track.mood}`, track.mood)}
																		</span>
																	</div>
																</div>
															</div>
															<div className="text-[10px] text-slate-500">
																{Math.round(track.defaultVolume * 100)}%
															</div>
														</div>
													</button>
												);
											})}
										</div>
									</div>
								))}
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("audio.selectedRegion", "Selected Region")}
								</div>
								{selectedAudio ? (
									<div className="space-y-2">
										<div className="rounded-lg bg-black/10 border border-white/5 px-2.5 py-2">
											<div className="text-xs font-medium text-slate-200">
												{getAudioRegionDisplayName(selectedAudio)}
											</div>
											<div className="mt-0.5 text-[10px] text-slate-500">
												{selectedAudio.sourceType === "built-in"
													? tSettings("audio.builtIn", "Built-in")
													: tSettings("audio.uploaded", "Uploaded")}
											</div>
										</div>

										<div className="grid grid-cols-2 gap-2">
											<Button
												type="button"
												onClick={() => void handleReplaceBuiltInAudio()}
												disabled={!selectedBuiltInTrack}
												className="gap-2 bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 hover:border-white/20"
											>
												<Music className="h-3.5 w-3.5" />
												{tSettings("audio.replaceBuiltIn", "Replace selected")}
											</Button>
											<Button
												type="button"
												onClick={() => void handleReplaceWithUploadedAudio()}
												className="gap-2 bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 hover:border-white/20"
											>
												<Upload className="h-3.5 w-3.5" />
												{tSettings("audio.replaceUpload", "Replace with file")}
											</Button>
										</div>

										{missingAudioPath && (
											<div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-[11px] text-amber-100">
												<div className="font-semibold text-amber-50">
													{tSettings("audio.missingTitle", "Audio source missing")}
												</div>
												<div className="mt-1 truncate text-amber-100/80">{missingAudioPath}</div>
												<div className="mt-2 flex gap-2">
													<Button
														type="button"
														onClick={() => void onRelinkMissingAudio?.()}
														className="flex-1 bg-amber-300/20 text-amber-50 hover:bg-amber-300/30"
													>
														{tSettings("audio.relink", "Relink audio")}
													</Button>
													<Button
														type="button"
														onClick={() => onRemoveMissingAudio?.()}
														className="flex-1 bg-white/7 text-slate-100 hover:bg-white/12"
													>
														{tSettings("audio.remove", "Remove")}
													</Button>
												</div>
											</div>
										)}

										<div className="flex items-center justify-between p-2 rounded-lg bg-black/10 border border-white/5">
											<div className="text-xs font-medium text-slate-300">
												{tSettings("audio.loop", "Loop audio")}
											</div>
											<Switch
												checked={selectedAudio.loop}
												onCheckedChange={(checked) =>
													onAudioLoopChange?.(selectedAudio.id, checked)
												}
												className="data-[state=checked]:bg-[#10B981] scale-90"
											/>
										</div>

										<div className="p-2 rounded-lg bg-black/10 border border-white/5">
											<SliderControl
												label={tSettings("audio.volume", "Volume")}
												value={selectedAudio.volume}
												defaultValue={DEFAULT_AUDIO_REGION_VOLUME}
												min={0}
												max={1}
												step={0.01}
												onChange={(value) => onAudioVolumeChange?.(selectedAudio.id, value)}
												formatValue={(value) => `${Math.round(value * 100)}%`}
												parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
											/>
										</div>
										<div className="p-2 rounded-lg bg-black/10 border border-white/5">
											<SliderControl
												label={tSettings("audio.fadeIn", "Fade In")}
												value={selectedAudio.fadeInMs}
												defaultValue={DEFAULT_AUDIO_FADE_IN_MS}
												min={0}
												max={3000}
												step={50}
												onChange={(value) =>
													onAudioFadeChange?.(selectedAudio.id, { fadeInMs: value })
												}
												formatValue={(value) => `${Math.round(value)}ms`}
												parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
											/>
										</div>
										<div className="p-2 rounded-lg bg-black/10 border border-white/5">
											<SliderControl
												label={tSettings("audio.fadeOut", "Fade Out")}
												value={selectedAudio.fadeOutMs}
												defaultValue={DEFAULT_AUDIO_FADE_OUT_MS}
												min={0}
												max={3000}
												step={50}
												onChange={(value) =>
													onAudioFadeChange?.(selectedAudio.id, { fadeOutMs: value })
												}
												formatValue={(value) => `${Math.round(value)}ms`}
												parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
											/>
										</div>
										<Button
											type="button"
											onClick={() => onAudioDelete?.(selectedAudio.id)}
											variant="destructive"
											size="sm"
											className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all h-8 text-xs"
										>
											<Trash2 className="h-3 w-3" />
											{tSettings("audio.deleteRegion", "Delete Audio Region")}
										</Button>
									</div>
								) : (
									<p className="text-[10px] text-slate-500 text-center py-2">
										{tSettings(
											"audio.empty",
											"Choose a built-in track or upload your own file, then add it at the playhead.",
										)}
									</p>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Annotation tab */}
				{activeTab === "annotation" && (
					<div>
						{selectedAnnotation &&
						onAnnotationContentChange &&
						onAnnotationTypeChange &&
						onAnnotationStyleChange &&
						onAnnotationDelete ? (
							<AnnotationSettingsPanel
								annotation={selectedAnnotation}
								onContentChange={(content) =>
									onAnnotationContentChange(selectedAnnotation.id, content)
								}
								onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
								onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
								onFigureDataChange={
									onAnnotationFigureDataChange
										? (figureData) =>
												onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
										: undefined
								}
								onBlurDataChange={
									onAnnotationBlurDataChange
										? (blurData) => onAnnotationBlurDataChange(selectedAnnotation.id, blurData)
										: undefined
								}
								onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
								inline
							/>
						) : (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<MessageSquare className="w-8 h-8 text-slate-600 mb-3" />
								<p className="text-sm font-medium text-slate-400">No Annotation Selected</p>
								<p className="text-xs text-slate-500 mt-1">
									Select an annotation on the timeline to edit its settings
								</p>
							</div>
						)}
					</div>
				)}

				{/* Captions tab */}
				{activeTab === "captions" && captionSettings && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{t("editor.captions.title", "Captions")}
							</span>
							{captionRegions.length > 0 && (
								<span className="text-[10px] uppercase tracking-wider font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
									{captionRegions.length} caption{captionRegions.length !== 1 ? "s" : ""}
								</span>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							{/* Enable/Disable */}
							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{t("editor.captions.showCaptions", "Show Captions")}
								</div>
								<Switch
									checked={captionSettings.enabled}
									onCheckedChange={(enabled) => onCaptionSettingsChange?.({ enabled })}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-2">
								<div className="flex items-center justify-between">
									<div>
										<div className="text-xs font-medium text-slate-300">
											{t("editor.captions.localTranscript", "Local Transcript")}
										</div>
										<div className="text-[10px] text-slate-500 mt-0.5">
											{!hasUsableCaptionAudio
												? t(
														"editor.captions.noAudioAvailable",
														"No microphone or video audio was found for this recording",
													)
												: captionModelStatus?.downloadedModels.length
													? t("editor.captions.modelsReady", "Models ready: {{models}}", {
															models: captionModelStatus.downloadedModels.join(", "),
														})
													: t(
															"editor.captions.noLocalModel",
															"No local Whisper model downloaded yet",
														)}
										</div>
										{supportsAppleSpeech && (
											<div className="text-[10px] text-slate-500 mt-0.5">
												{t(
													"editor.captions.appleSpeechAvailable",
													"Apple Speech is also available on this Mac for fixed-language voice tracks.",
												)}
											</div>
										)}
									</div>
									{isTranscribing && (
										<div className="text-[10px] uppercase tracking-wider text-[#10B981]">
											{captionGenerationProgress?.message ||
												t("editor.captions.working", "Working...")}
										</div>
									)}
								</div>

								<div className="grid grid-cols-3 gap-2">
									<select
										value={selectedCaptionBackend}
										onChange={(event) =>
											onCaptionGenerationOptionsChange?.({
												preferredBackend: event.target.value as
													| "auto"
													| "whisper.cpp"
													| "apple-speech",
											})
										}
										className="h-9 rounded-lg border border-white/5 bg-white/5 px-3 text-xs text-slate-200 outline-none"
									>
										<option value="auto">{t("editor.captions.backendAuto", "Automatic")}</option>
										<option value="whisper.cpp">
											{t("editor.captions.backendWhisper", "Whisper")}
										</option>
										{supportsAppleSpeech && (
											<option value="apple-speech">
												{t("editor.captions.backendAppleSpeech", "Apple Speech")}
											</option>
										)}
									</select>
									<select
										value={
											captionGenerationOptions?.model ?? DEFAULT_CAPTION_GENERATION_OPTIONS.model
										}
										disabled={isAppleSpeechSelected}
										onChange={(event) =>
											onCaptionGenerationOptionsChange?.({
												model: event.target.value as "base" | "small" | "medium",
											})
										}
										className="h-9 rounded-lg border border-white/5 bg-white/5 px-3 text-xs text-slate-200 outline-none"
									>
										<option value="base">{t("editor.captions.modelBase", "Base")}</option>
										<option value="small">{t("editor.captions.modelSmall", "Small")}</option>
										<option value="medium">{t("editor.captions.modelMedium", "Medium")}</option>
									</select>
									<select
										value={
											captionModelStatus?.availableSourceAudios.includes(
												captionGenerationOptions?.preferredSourceAudio ?? "microphone",
											)
												? (captionGenerationOptions?.preferredSourceAudio ?? "microphone")
												: "mixed"
										}
										onChange={(event) =>
											onCaptionGenerationOptionsChange?.({
												preferredSourceAudio: event.target.value as "microphone" | "mixed",
											})
										}
										className="h-9 rounded-lg border border-white/5 bg-white/5 px-3 text-xs text-slate-200 outline-none"
									>
										{captionModelStatus?.availableSourceAudios.includes("microphone") && (
											<option value="microphone">
												{t("editor.captions.sourceMicrophone", "Microphone")}
											</option>
										)}
										<option value="mixed">{t("editor.captions.sourceMixed", "Mixed Audio")}</option>
									</select>
								</div>

								<input
									type="text"
									value={captionGenerationOptions?.language ?? "auto"}
									onChange={(event) =>
										onCaptionGenerationOptionsChange?.({ language: event.target.value || "auto" })
									}
									placeholder={t("editor.captions.languagePlaceholder", "Language (auto)")}
									className="w-full h-9 rounded-lg border border-white/5 bg-white/5 px-3 text-xs text-slate-200 outline-none"
								/>
								<textarea
									value={captionGenerationOptions?.prompt ?? ""}
									disabled={isAppleSpeechSelected}
									onChange={(event) =>
										onCaptionGenerationOptionsChange?.({ prompt: event.target.value })
									}
									placeholder={t(
										"editor.captions.promptPlaceholder",
										"Optional prompt to bias names or terminology",
									)}
									className="w-full min-h-[72px] rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none resize-none"
								/>
								{isAppleSpeechSelected && (
									<div className="text-[10px] text-slate-500">
										{t(
											"editor.captions.appleSpeechHint",
											"Apple Speech works best with microphone audio and a fixed language. Prompt bias is only used by Whisper.",
										)}
									</div>
								)}

								<Button
									type="button"
									onClick={onAutoTranscribe}
									disabled={isTranscribing || !hasUsableCaptionAudio}
									className="w-full h-9 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 text-xs font-semibold"
								>
									{isTranscribing ? (
										<>
											<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
											{captionGenerationProgress?.message ||
												t("editor.captions.transcribing", "Transcribing...")}
										</>
									) : (
										<>
											<Captions className="w-3.5 h-3.5 mr-1.5" />
											{t("editor.captions.generateTranscript", "Generate Transcript")}
										</>
									)}
								</Button>

								{isTranscribing && (
									<Button
										type="button"
										onClick={onCancelCaptionGeneration}
										className="w-full h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-semibold"
									>
										{t("editor.captions.cancelGeneration", "Cancel Generation")}
									</Button>
								)}

								<div className="grid grid-cols-3 gap-1.5">
									<Button
										type="button"
										onClick={() => onCaptionExport?.("srt")}
										disabled={captionRegions.length === 0}
										className="h-8 rounded-lg border border-white/5 bg-white/5 text-[10px] text-slate-300"
									>
										{t("editor.captions.exportSrt", "Export SRT")}
									</Button>
									<Button
										type="button"
										onClick={() => onCaptionExport?.("vtt")}
										disabled={captionRegions.length === 0}
										className="h-8 rounded-lg border border-white/5 bg-white/5 text-[10px] text-slate-300"
									>
										{t("editor.captions.exportVtt", "Export VTT")}
									</Button>
									<Button
										type="button"
										onClick={() => onCaptionExport?.("txt")}
										disabled={captionRegions.length === 0}
										className="h-8 rounded-lg border border-white/5 bg-white/5 text-[10px] text-slate-300"
									>
										{t("editor.captions.exportTxt", "Export TXT")}
									</Button>
								</div>
							</div>

							{/* Style presets */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{t("editor.captions.stylePreset", "Style Preset")}
								</label>
								<div className="grid grid-cols-3 gap-1.5">
									{(Object.keys(CAPTION_STYLE_PRESETS) as CaptionStylePreset[]).map((preset) => (
										<Button
											key={preset}
											type="button"
											onClick={() => onCaptionStylePresetChange?.(preset)}
											className={cn(
												"h-8 rounded-lg border shadow-sm transition-all justify-center",
												captionSettings.style.preset === preset
													? "border-[#10B981] bg-[#10B981] text-white"
													: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10",
											)}
										>
											<span className="text-[10px] font-semibold capitalize">{preset}</span>
										</Button>
									))}
								</div>
							</div>

							{/* Position */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{t("editor.captions.position", "Position")}
								</label>
								<div className="grid grid-cols-3 gap-2">
									{(["top", "center", "bottom"] as const).map((pos) => (
										<Button
											key={pos}
											type="button"
											onClick={() => onCaptionSettingsChange?.({ position: pos })}
											className={cn(
												"h-8 rounded-lg border shadow-sm transition-all justify-center",
												captionSettings.position === pos
													? "border-[#10B981] bg-[#10B981] text-white"
													: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10",
											)}
										>
											<span className="text-[10px] font-semibold capitalize">{pos}</span>
										</Button>
									))}
								</div>
							</div>

							{/* Font size */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={t("editor.captions.fontSize", "Font Size")}
									value={captionSettings.style.fontSize}
									defaultValue={28}
									min={14}
									max={64}
									step={1}
									onChange={(v) => onCaptionStyleChange?.({ fontSize: v })}
									formatValue={(v) => `${v}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								/>
							</div>

							{/* Text color */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{t("editor.captions.textColor", "Text Color")}
								</label>
								<Block
									color={captionSettings.style.color}
									onChange={(color) => onCaptionStyleChange?.({ color: color.hex })}
									colors={[
										"#FFFFFF",
										"#FFD700",
										"#00FF88",
										"#FF6B6B",
										"#00BFFF",
										"#FF69B4",
										"#000000",
										"#10B981",
									]}
								/>
							</div>

							{/* Background opacity */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={t("editor.captions.backgroundOpacity", "Background Opacity")}
									value={captionSettings.style.backgroundOpacity}
									defaultValue={0.7}
									min={0}
									max={1}
									step={0.05}
									onChange={(v) => onCaptionStyleChange?.({ backgroundOpacity: v })}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								/>
							</div>

							{/* Outline width */}
							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={t("editor.captions.outlineWidth", "Outline Width")}
									value={captionSettings.style.outlineWidth}
									defaultValue={0}
									min={0}
									max={5}
									step={0.5}
									onChange={(v) => onCaptionStyleChange?.({ outlineWidth: v })}
									formatValue={(v) => `${v}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={t("editor.captions.wordsPerLine", "Words Per Line")}
									value={captionSettings.maxWordsPerLine}
									defaultValue={6}
									min={1}
									max={12}
									step={1}
									onChange={(v) => onCaptionSettingsChange?.({ maxWordsPerLine: v })}
									formatValue={(v) => `${v}`}
									parseInput={(t) => parseFloat(t)}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={t("editor.captions.safeArea", "Safe Area")}
									value={captionSettings.safeAreaInset}
									defaultValue={8}
									min={2}
									max={20}
									step={1}
									onChange={(v) => onCaptionSettingsChange?.({ safeAreaInset: v })}
									formatValue={(v) => `${v}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
								/>
							</div>

							{/* Caption list */}
							{captionRegions.length > 0 && (
								<div className="p-2 rounded-lg bg-white/5 border border-white/5">
									<div className="flex items-center justify-between mb-2">
										<label className="text-xs font-medium text-slate-300">
											{t("editor.captions.title", "Captions")} ({captionRegions.length})
										</label>
										<Button
											type="button"
											onClick={onDeleteAllCaptions}
											className="h-6 px-2 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px]"
										>
											<Trash2 className="w-3 h-3 mr-1" />
											{t("editor.captions.clearAll", "Clear All")}
										</Button>
									</div>
									<div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
										{captionRegions.map((caption) => (
											<div
												key={caption.id}
												onClick={() => onSelectCaption?.(caption.id)}
												className={cn(
													"flex items-start gap-2 p-1.5 rounded-md border cursor-pointer transition-all",
													selectedCaptionId === caption.id
														? "border-[#10B981] bg-[#10B981]/10"
														: "border-white/5 bg-white/[0.02] hover:bg-white/5",
												)}
											>
												<div className="flex-1 min-w-0">
													<div className="text-[10px] text-slate-500 mb-1">
														{(caption.startMs / 1000).toFixed(2)}s -{" "}
														{(caption.endMs / 1000).toFixed(2)}s
													</div>
													<textarea
														value={caption.text}
														onChange={(e) => onCaptionTextChange?.(caption.id, e.target.value)}
														onClick={(e) => e.stopPropagation()}
														className="w-full min-h-[54px] text-[11px] text-slate-300 bg-transparent border-none outline-none resize-none"
														placeholder={t("editor.captions.captionPlaceholder", "Caption text...")}
													/>
													<div className="flex gap-1.5 mt-1">
														<Button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																onCaptionSplit?.(caption.id);
															}}
															className="h-6 px-2 rounded border border-white/5 bg-white/5 text-[10px] text-slate-300"
														>
															{t("editor.captions.split", "Split")}
														</Button>
														<Button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																onCaptionMergeNext?.(caption.id);
															}}
															className="h-6 px-2 rounded border border-white/5 bg-white/5 text-[10px] text-slate-300"
														>
															{t("editor.captions.mergeNext", "Merge Next")}
														</Button>
													</div>
												</div>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onCaptionDelete?.(caption.id);
													}}
													className="shrink-0 p-0.5 text-slate-500 hover:text-red-400 transition-colors"
												>
													<X className="w-3 h-3" />
												</button>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Webcam tab */}
				{activeTab === "webcam" && webcamPath && webcamRegion && (
					<div>
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-slate-200">
								{tSettings("webcam.title")}
							</span>
							<div className="flex items-center gap-2">
								{selectedCameraLayout && (
									<span className="text-[10px] uppercase tracking-wider font-medium text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-0.5 rounded-full">
										{tSettings("webcam.layoutBadge")}
									</span>
								)}
								<Button
									type="button"
									onClick={() => setShowAdvancedWebcam((prev) => !prev)}
									className="h-7 rounded-lg border border-white/10 bg-white/5 px-2 text-[10px] font-semibold text-slate-300 hover:bg-white/10"
								>
									{showAdvancedWebcam
										? tSettings("webcam.hideAdvanced")
										: tSettings("webcam.showAdvanced")}
								</Button>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							{webcamMissing && (
								<div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100">
									<div className="flex items-start gap-2">
										<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
										<div className="min-w-0">
											<div className="font-semibold text-amber-50">
												{tSettings("webcam.missingTitle")}
											</div>
											<div className="mt-1 text-amber-100/80">
												{tSettings("webcam.missingDescription")}
											</div>
											{missingWebcamPath && (
												<div className="mt-2 truncate rounded-md bg-black/20 px-2 py-1 font-mono text-[10px] text-amber-50/80">
													{missingWebcamPath}
												</div>
											)}
											<div className="mt-3 grid grid-cols-2 gap-2">
												<Button
													type="button"
													onClick={onRelinkMissingWebcam}
													className="h-8 rounded-lg border border-amber-300/30 bg-amber-300/15 text-[10px] font-semibold text-amber-50 hover:bg-amber-300/25"
												>
													{tSettings("webcam.relink")}
												</Button>
												<Button
													type="button"
													onClick={onRemoveMissingWebcam}
													className="h-8 rounded-lg border border-white/10 bg-white/5 text-[10px] font-semibold text-slate-200 hover:bg-white/10"
												>
													{tSettings("webcam.remove")}
												</Button>
											</div>
										</div>
									</div>
								</div>
							)}

							<div className="grid grid-cols-2 gap-2">
								<Button
									type="button"
									onClick={onResetRecommendedWebcam}
									className="h-8 rounded-lg border border-[#10B981]/30 bg-[#10B981]/12 text-[10px] font-semibold text-[#9ff0c8] hover:bg-[#10B981]/20"
								>
									{tSettings("webcam.resetRecommended")}
								</Button>
								{selectedCameraLayout ? (
									<Button
										type="button"
										onClick={onResetSelectedCameraLayout}
										className="h-8 rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/12 text-[10px] font-semibold text-[#a9c7ff] hover:bg-[#3b82f6]/20"
									>
										{tSettings("webcam.resetLayout")}
									</Button>
								) : (
									<div className="h-8 rounded-lg border border-white/5 bg-white/[0.03] px-2 text-[10px] font-medium text-slate-500 flex items-center justify-center">
										{tSettings("webcam.recommendedDefaults")}
									</div>
								)}
							</div>

							{selectedCameraLayout && (
								<div className="p-2 rounded-lg bg-white/5 border border-white/5">
									<label className="text-xs font-medium text-slate-300 mb-2 block">
										{tSettings("webcam.cameraLayout")}
									</label>
									<div className="grid grid-cols-3 gap-2">
										{(
											[
												["default", tSettings("webcam.defaultMode")],
												["fullscreen", tSettings("webcam.fullscreenMode")],
												["hidden", tSettings("webcam.hiddenMode")],
											] as const
										).map(([mode, label]) => (
											<Button
												key={mode}
												type="button"
												onClick={() => onCameraLayoutChange?.(selectedCameraLayout.id, { mode })}
												className={cn(
													"h-9 rounded-lg border shadow-sm transition-all justify-center",
													selectedCameraLayout.mode === mode
														? "border-[#3b82f6] bg-[#3b82f6] text-white"
														: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10",
												)}
											>
												<span className="text-xs font-semibold">{label}</span>
											</Button>
										))}
									</div>
								</div>
							)}

							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("webcam.showWebcam")}
								</div>
								<Switch
									checked={showWebcam}
									onCheckedChange={onShowWebcamChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>

							<div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
								<div className="text-xs font-medium text-slate-300">
									{tSettings("webcam.mirrorCamera")}
								</div>
								<Switch
									checked={mirrorWebcam}
									onCheckedChange={onMirrorWebcamChange}
									className="data-[state=checked]:bg-[#10B981] scale-90"
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("webcam.cameraDuringZoom")}
									value={cameraSizeDuringZoom}
									defaultValue={CAMERA_ZOOM_SCALE_DISABLED}
									min={0.4}
									max={1}
									step={0.05}
									onChange={(v) => onCameraSizeDuringZoomChange?.(v)}
									formatValue={(v) =>
										v >= CAMERA_ZOOM_SCALE_DISABLED
											? tSettings("webcam.sameSize")
											: `${Math.round(v * 100)}%`
									}
									parseInput={(t) => {
										const normalized = t.trim().toLowerCase();
										if (
											normalized === tSettings("webcam.sameSize").trim().toLowerCase() ||
											normalized === "off"
										) {
											return CAMERA_ZOOM_SCALE_DISABLED;
										}
										return parseFloat(t.replace(/%$/, "")) / 100;
									}}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("webcam.size")}
									value={webcamSizeValue}
									defaultValue={18}
									min={8}
									max={40}
									step={0.5}
									onChange={handleWebcamSizeSliderChange}
									formatValue={(v) => `${v.toFixed(1)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
								/>
							</div>

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<SliderControl
									label={tSettings("webcam.borderWidth")}
									value={webcamRegion.borderWidth}
									defaultValue={3}
									min={0}
									max={10}
									step={1}
									onChange={(v) => onWebcamRegionChange?.({ borderWidth: v })}
									formatValue={(v) => `${v}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								/>
							</div>

							{(webcamRegion.shape === "rectangle" || webcamRegion.shape === "square") && (
								<div className="p-2 rounded-lg bg-white/5 border border-white/5">
									<SliderControl
										label={tSettings("webcam.roundness")}
										value={webcamRegion.borderRadius}
										defaultValue={12}
										min={0}
										max={50}
										step={1}
										onChange={(v) => onWebcamRegionChange?.({ borderRadius: v })}
										formatValue={(v) => `${v}px`}
										parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
									/>
								</div>
							)}

							<div className="p-2 rounded-lg bg-white/5 border border-white/5">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{tSettings("webcam.position")}
								</label>
								<div className="grid grid-cols-2 gap-2">
									{[
										{ label: tSettings("webcam.topLeft"), anchor: "top-left" as const },
										{ label: tSettings("webcam.topRight"), anchor: "top-right" as const },
										{ label: tSettings("webcam.bottomLeft"), anchor: "bottom-left" as const },
										{ label: tSettings("webcam.bottomRight"), anchor: "bottom-right" as const },
									].map((preset) => (
										<Button
											key={preset.label}
											type="button"
											onClick={() =>
												onWebcamRegionChange?.({
													anchor: preset.anchor,
													marginPct: 4,
												})
											}
											className={cn(
												"h-8 rounded-lg border text-[10px] transition-colors",
												webcamRegion.anchor === preset.anchor
													? "border-[#10B981]/40 bg-[#10B981]/12 text-[#a7f3d0]"
													: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10",
											)}
										>
											{preset.label}
										</Button>
									))}
								</div>
							</div>

							{showAdvancedWebcam && (
								<>
									<div className="p-2 rounded-lg bg-white/5 border border-white/5">
										<label className="text-xs font-medium text-slate-300 mb-2 block">
											{tSettings("webcam.shape")}
										</label>
										<div className="grid grid-cols-3 gap-2">
											{(["circle", "square", "rectangle"] as const).map((shape) => (
												<Button
													key={shape}
													type="button"
													onClick={() => onWebcamRegionChange?.({ shape })}
													className={cn(
														"h-9 rounded-lg border shadow-sm transition-all justify-center",
														webcamRegion.shape === shape
															? "border-[#10B981] bg-[#10B981] text-white"
															: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10",
													)}
												>
													<span className="text-xs font-semibold capitalize">{shape}</span>
												</Button>
											))}
										</div>
									</div>

									<div className="p-2 rounded-lg bg-white/5 border border-white/5">
										<SliderControl
											label={tSettings("webcam.opacity")}
											value={webcamRegion.opacity}
											defaultValue={1}
											min={0.1}
											max={1}
											step={0.05}
											onChange={(v) => onWebcamRegionChange?.({ opacity: v })}
											formatValue={(v) => `${Math.round(v * 100)}%`}
											parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
										/>
									</div>

									<div className="p-2 rounded-lg bg-white/5 border border-white/5">
										<SliderControl
											label={tSettings("webcam.borderWidth")}
											value={webcamRegion.borderWidth}
											defaultValue={2}
											min={0}
											max={10}
											step={1}
											onChange={(v) => onWebcamRegionChange?.({ borderWidth: v })}
											formatValue={(v) => `${v}px`}
											parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
										/>
									</div>

									{(webcamRegion.shape === "rectangle" || webcamRegion.shape === "square") && (
										<div className="p-2 rounded-lg bg-white/5 border border-white/5">
											<SliderControl
												label={tSettings("webcam.roundness")}
												value={webcamRegion.borderRadius}
												defaultValue={12}
												min={0}
												max={50}
												step={1}
												onChange={(v) => onWebcamRegionChange?.({ borderRadius: v })}
												formatValue={(v) => `${v}px`}
												parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
											/>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				)}
			</div>

			{showCropModal && cropRegion && onCropChange && (
				<>
					<div
						className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
						onClick={handleCropCancel}
					/>
					<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#0A0F0D] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-5xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200">
						<div className="flex items-center justify-between mb-6">
							<div>
								<span className="text-xl font-bold text-slate-200">{tSettings("crop.title")}</span>
								<p className="text-sm text-slate-400 mt-2">{tSettings("crop.instruction")}</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCropCancel}
								className="hover:bg-white/10 text-slate-400 hover:text-white"
							>
								<X className="w-5 h-5" />
							</Button>
						</div>
						<CropControl
							videoElement={videoElement || null}
							cropRegion={cropRegion}
							onCropChange={onCropChange}
							aspectRatio={aspectRatio}
						/>
						<div className="mt-6 flex justify-end">
							<Button
								onClick={() => setShowCropModal(false)}
								size="lg"
								className="bg-[#10B981] hover:bg-[#10B981]/90 text-white"
							>
								{t("common.actions.done")}
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
