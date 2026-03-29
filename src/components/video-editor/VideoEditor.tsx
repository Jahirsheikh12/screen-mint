import type { Span } from "dnd-timeline";
import {
	ChevronDown,
	Download,
	FolderOpen,
	Keyboard,
	Languages,
	Redo2,
	Save,
	Sparkles,
	SplitSquareHorizontal,
	Trash2,
	Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ImperativePanelGroupHandle,
	Panel,
	PanelGroup,
	PanelResizeHandle,
} from "react-resizable-panels";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { type AppLocale, SUPPORTED_LOCALES } from "@/i18n/config";
import { getBackgroundMusicAssetById } from "@/lib/backgroundMusic";
import {
	calculateOutputDimensions,
	type ExportFormat,
	type ExportProgress,
	type ExportQuality,
	type ExportSettings,
	GIF_SIZE_PRESETS,
	GifExporter,
	type GifFrameRate,
	type GifSizePreset,
	VideoExporter,
} from "@/lib/exporter";
import type { PostRecordingContext } from "@/lib/recording/postRecording";
import { matchesShortcut } from "@/lib/shortcuts";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import {
	getAudioPlaybackOffsetSeconds,
	getAudioRegionFadeMultiplier,
	isFileAudioSource,
	loadAudioSelectionDurationMs,
	resolveAudioSourceUrl,
} from "./audioRegionUtils";
import { ExportDialog } from "./ExportDialog";
import { ExportSettingsDialog } from "./ExportSettingsDialog";
import {
	type EditorPreset,
	type EditorWorkspaceLayout,
	loadEditorPreferences,
	saveEditorPreferences,
} from "./editorPreferences";
import { deriveKeyboardShortcutCallouts } from "./keyboardShortcuts";
import {
	createProjectData,
	deriveNextId,
	fromFileUrl,
	normalizeProjectEditor,
	toFileUrl,
	validateProjectData,
} from "./projectPersistence";
import { QuickShareDialog } from "./QuickShareDialog";
import SettingsPanel from "./SettingsPanel";
import TimelineEditor from "./timeline/TimelineEditor";
import {
	detectInteractionCandidates,
	normalizeCursorTelemetry,
} from "./timeline/zoomSuggestionUtils";
import {
	type AnnotationRegion,
	type AudioRegion,
	type AudioTrackSelection,
	type BlurData,
	CAPTION_STYLE_PRESETS,
	type CameraLayoutRegion,
	type CaptionGenerationOptions,
	type CaptionGenerationProgress,
	type CaptionModelStatus,
	type CaptionRegion,
	type CaptionSettings,
	type CaptionStylePreset,
	type CaptionTrack,
	type CropRegion,
	type CursorTelemetryPoint,
	clampFocusToDepth,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUDIO_FADE_IN_MS,
	DEFAULT_AUDIO_FADE_OUT_MS,
	DEFAULT_AUDIO_REGION_VOLUME,
	DEFAULT_BLUR_DATA,
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CAPTION_SETTINGS,
	DEFAULT_FIGURE_DATA,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_ZOOM_DEPTH,
	type FigureData,
	getRecommendedWebcamRegion,
	type KeyboardPlatform,
	type KeyboardTelemetrySample,
	type PlaybackSpeed,
	type SpeedRegion,
	type TrimRegion,
	type WebcamRegion,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomRegion,
} from "./types";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";
import { normalizeWebcamRegion } from "./webcamRegionUtils";

const LOOP_CURSOR_END_WINDOW_MS = 670;

type EditorHistorySnapshot = {
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	cutPoints: number[];
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	cameraLayouts: CameraLayoutRegion[];
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam: boolean;
	cameraSizeDuringZoom: number;
	selectedCameraLayoutId: string | null;
	webcamSelected: boolean;
	selectedZoomId: string | null;
	selectedTrimId: string | null;
	selectedSpeedId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
	captionTrack: CaptionTrack | null;
	captionSettings: CaptionSettings;
	selectedCaptionId: string | null;
};

type PendingExportSave = {
	fileName: string;
	arrayBuffer: ArrayBuffer;
};

function LanguageSwitcher() {
	const { locale, setLocale, t } = useI18n();
	const idx = SUPPORTED_LOCALES.indexOf(locale as (typeof SUPPORTED_LOCALES)[number]);
	const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length] as AppLocale;
	const labels: Record<string, string> = {
		en: "EN",
		es: "ES",
		"zh-CN": "中文",
	};
	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
			title={t("common.app.language", "Language")}
			aria-label={t("common.app.language", "Language")}
		>
			<Languages className="h-4 w-4" />
			<span className="text-xs font-medium">{labels[locale] ?? locale.toUpperCase()}</span>
		</button>
	);
}

export default function VideoEditor() {
	const { t } = useI18n();
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [wallpaper, setWallpaper] = useState<string>(initialEditorPreferences.wallpaper);
	const [shadowIntensity, setShadowIntensity] = useState(initialEditorPreferences.shadowIntensity);
	const [backgroundBlur, setBackgroundBlur] = useState(initialEditorPreferences.backgroundBlur);
	const [zoomMotionBlur, setZoomMotionBlur] = useState(initialEditorPreferences.zoomMotionBlur);
	const [connectZooms, setConnectZooms] = useState(initialEditorPreferences.connectZooms);
	const [showCursor, setShowCursor] = useState(initialEditorPreferences.showCursor);
	const [loopCursor, setLoopCursor] = useState(initialEditorPreferences.loopCursor);
	const [cursorSize, setCursorSize] = useState(initialEditorPreferences.cursorSize);
	const [cursorSmoothing, setCursorSmoothing] = useState(initialEditorPreferences.cursorSmoothing);
	const [cursorMotionBlur, setCursorMotionBlur] = useState(
		initialEditorPreferences.cursorMotionBlur,
	);
	const [cursorClickBounce, setCursorClickBounce] = useState(
		initialEditorPreferences.cursorClickBounce,
	);
	const [cursorSway, setCursorSway] = useState(initialEditorPreferences.cursorSway);
	const [cursorStyle, setCursorStyle] = useState(initialEditorPreferences.cursorStyle);
	const [cursorPack, setCursorPack] = useState(initialEditorPreferences.cursorPack);
	const [cursorColor, setCursorColor] = useState(initialEditorPreferences.cursorColor);
	const [cursorOpacity, setCursorOpacity] = useState(initialEditorPreferences.cursorOpacity);
	const [clickHighlightColor, setClickHighlightColor] = useState(
		initialEditorPreferences.clickHighlightColor,
	);
	const [clickHighlightSize, setClickHighlightSize] = useState(
		initialEditorPreferences.clickHighlightSize,
	);
	const [clickHighlightOpacity, setClickHighlightOpacity] = useState(
		initialEditorPreferences.clickHighlightOpacity,
	);
	const [cursorTrailLength, setCursorTrailLength] = useState(
		initialEditorPreferences.cursorTrailLength,
	);
	const [cursorTrailOpacity, setCursorTrailOpacity] = useState(
		initialEditorPreferences.cursorTrailOpacity,
	);
	const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(
		initialEditorPreferences.showKeyboardShortcuts,
	);
	const [keyboardShortcutPosition, setKeyboardShortcutPosition] = useState(
		initialEditorPreferences.keyboardShortcutPosition,
	);
	const [keyboardShortcutTheme, setKeyboardShortcutTheme] = useState(
		initialEditorPreferences.keyboardShortcutTheme,
	);
	const [keyboardShortcutScale, setKeyboardShortcutScale] = useState(
		initialEditorPreferences.keyboardShortcutScale,
	);
	const [keyboardShortcutOpacity, setKeyboardShortcutOpacity] = useState(
		initialEditorPreferences.keyboardShortcutOpacity,
	);
	const [keyboardShortcutDisplayMs, setKeyboardShortcutDisplayMs] = useState(
		initialEditorPreferences.keyboardShortcutDisplayMs,
	);
	const [keyboardShortcutMaxVisible, setKeyboardShortcutMaxVisible] = useState(
		initialEditorPreferences.keyboardShortcutMaxVisible,
	);
	const [borderRadius, setBorderRadius] = useState(initialEditorPreferences.borderRadius);
	const [padding, setPadding] = useState(initialEditorPreferences.padding);
	const [cropRegion, setCropRegion] = useState<CropRegion>(initialEditorPreferences.cropRegion);
	const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [keyboardTelemetry, setKeyboardTelemetry] = useState<KeyboardTelemetrySample[]>([]);
	const [keyboardTelemetryPlatform, setKeyboardTelemetryPlatform] =
		useState<KeyboardPlatform>("win32");
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
	const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
	const [cutPoints, setCutPoints] = useState<number[]>([]);
	const [speedRegions, setSpeedRegions] = useState<SpeedRegion[]>([]);
	const [selectedSpeedId, setSelectedSpeedId] = useState<string | null>(null);
	const [annotationRegions, setAnnotationRegions] = useState<AnnotationRegion[]>([]);
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
	const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);
	const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
	const [captionTrack, setCaptionTrack] = useState<CaptionTrack | null>(null);
	const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
	const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
		...DEFAULT_CAPTION_SETTINGS,
		style: { ...DEFAULT_CAPTION_SETTINGS.style },
	});
	const [captionGenerationOptions, setCaptionGenerationOptions] =
		useState<CaptionGenerationOptions>(DEFAULT_CAPTION_GENERATION_OPTIONS);
	const [captionGenerationProgress, setCaptionGenerationProgress] =
		useState<CaptionGenerationProgress | null>(null);
	const [captionModelStatus, setCaptionModelStatus] = useState<CaptionModelStatus | null>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [webcamPath, setWebcamPath] = useState<string | null>(null);
	const [missingWebcamPath, setMissingWebcamPath] = useState<string | null>(null);
	const [missingAudioPathsById, setMissingAudioPathsById] = useState<Record<string, string>>({});
	const [resolvedAudioSourceUrls, setResolvedAudioSourceUrls] = useState<Record<string, string>>(
		{},
	);
	const [webcamRegion, setWebcamRegion] = useState<WebcamRegion>({
		...initialEditorPreferences.webcamRegion,
		position: { ...initialEditorPreferences.webcamRegion.position },
		size: { ...initialEditorPreferences.webcamRegion.size },
	});
	const [showWebcam, setShowWebcam] = useState(initialEditorPreferences.showWebcam);
	const [mirrorWebcam, setMirrorWebcam] = useState(initialEditorPreferences.mirrorWebcam);
	const [cameraSizeDuringZoom, setCameraSizeDuringZoom] = useState(
		initialEditorPreferences.cameraSizeDuringZoom,
	);
	const [cameraLayouts, setCameraLayouts] = useState<CameraLayoutRegion[]>([]);
	const [selectedCameraLayoutId, setSelectedCameraLayoutId] = useState<string | null>(null);
	const [webcamSelected, setWebcamSelected] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [showExportSettings, setShowExportSettings] = useState(false);
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialEditorPreferences.aspectRatio);
	const [exportQuality, setExportQuality] = useState<ExportQuality>(
		initialEditorPreferences.exportQuality,
	);
	const [exportFormat, setExportFormat] = useState<ExportFormat>(
		initialEditorPreferences.exportFormat,
	);
	const [gifFrameRate, setGifFrameRate] = useState<GifFrameRate>(
		initialEditorPreferences.gifFrameRate,
	);
	const [gifLoop, setGifLoop] = useState(initialEditorPreferences.gifLoop);
	const [gifSizePreset, setGifSizePreset] = useState<GifSizePreset>(
		initialEditorPreferences.gifSizePreset,
	);
	const [workspaceLayout, setWorkspaceLayout] = useState<EditorWorkspaceLayout>(
		initialEditorPreferences.workspaceLayout,
	);
	const [customPresets, setCustomPresets] = useState<EditorPreset[]>(
		initialEditorPreferences.presets,
	);
	const [exportedFilePath, setExportedFilePath] = useState<string | undefined>(undefined);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);
	const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
	const [showQuickShare, setShowQuickShare] = useState(false);
	const [postRecordingContext, setPostRecordingContext] = useState<PostRecordingContext | null>(
		null,
	);
	const captionRegions = captionTrack?.segments ?? [];

	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const panelGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
	const nextZoomIdRef = useRef(1);
	const nextTrimIdRef = useRef(1);
	const nextSpeedIdRef = useRef(1);
	const nextAudioIdRef = useRef(1);
	const nextCameraLayoutIdRef = useRef(1);

	const { shortcuts, isMac, openConfig } = useShortcuts();
	const nextAnnotationIdRef = useRef(1);
	const nextAnnotationZIndexRef = useRef(1); // Track z-index for stacking order
	const nextCaptionIdRef = useRef(1);
	const exporterRef = useRef<VideoExporter | null>(null);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
	const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
	const historyCurrentRef = useRef<EditorHistorySnapshot | null>(null);
	const applyingHistoryRef = useRef(false);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);
	const webcamAvailabilityRequestRef = useRef(0);
	const notifiedMissingWebcamPathRef = useRef<string | null>(null);
	const audioAvailabilityRequestRef = useRef(0);
	const handledPostRecordingContextRef = useRef<string | null>(null);
	const resolvedWebcamPath = missingWebcamPath ? null : webcamPath;
	const selectedAudioRegion = selectedAudioId
		? (audioRegions.find((region) => region.id === selectedAudioId) ?? null)
		: null;
	const missingSelectedAudioPath = selectedAudioId ? missingAudioPathsById[selectedAudioId] : null;

	const clearWebcamState = useCallback(() => {
		setWebcamPath(null);
		setMissingWebcamPath(null);
		setWebcamRegion(getRecommendedWebcamRegion(initialEditorPreferences.aspectRatio));
		setShowWebcam(true);
		setMirrorWebcam(false);
		setCameraSizeDuringZoom(DEFAULT_CAMERA_SIZE_DURING_ZOOM);
		setCameraLayouts([]);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
	}, [initialEditorPreferences.aspectRatio]);

	const builtInPresets = useMemo<EditorPreset[]>(
		() => [
			{
				id: "preset-balanced",
				name: "Balanced",
				controls: normalizeProjectEditor({}),
			},
			{
				id: "preset-cinematic",
				name: "Cinematic",
				controls: normalizeProjectEditor({
					shadowIntensity: 0.9,
					backgroundBlur: 0.2,
					padding: 64,
					borderRadius: 24,
					cursorSize: 6,
					cursorSmoothing: 0.9,
				}),
			},
			{
				id: "preset-social",
				name: "Social",
				controls: normalizeProjectEditor({
					aspectRatio: "9:16",
					padding: 28,
					borderRadius: 28,
					showCursor: true,
					cursorSize: 6.5,
					showWebcam: false,
				}),
			},
		],
		[],
	);

	const allPresets = useMemo(
		() => [...builtInPresets, ...customPresets],
		[builtInPresets, customPresets],
	);

	const buildCurrentPresetControls = useCallback(
		() =>
			normalizeProjectEditor({
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				connectZooms,
				showCursor,
				loopCursor,
				cursorSize,
				cursorSmoothing,
				cursorMotionBlur,
				cursorClickBounce,
				cursorSway,
				cursorStyle,
				cursorPack,
				cursorColor,
				cursorOpacity,
				clickHighlightColor,
				clickHighlightSize,
				clickHighlightOpacity,
				cursorTrailLength,
				cursorTrailOpacity,
				showKeyboardShortcuts,
				keyboardShortcutPosition,
				keyboardShortcutTheme,
				keyboardShortcutScale,
				keyboardShortcutOpacity,
				keyboardShortcutDisplayMs,
				keyboardShortcutMaxVisible,
				borderRadius,
				padding,
				cropRegion,
				aspectRatio,
				webcamRegion,
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				exportQuality,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
			}),
		[
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			connectZooms,
			showCursor,
			loopCursor,
			cursorSize,
			cursorSmoothing,
			cursorMotionBlur,
			cursorClickBounce,
			cursorSway,
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorTrailLength,
			cursorTrailOpacity,
			showKeyboardShortcuts,
			keyboardShortcutPosition,
			keyboardShortcutTheme,
			keyboardShortcutScale,
			keyboardShortcutOpacity,
			keyboardShortcutDisplayMs,
			keyboardShortcutMaxVisible,
			borderRadius,
			padding,
			cropRegion,
			aspectRatio,
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			exportQuality,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		],
	);

	const applyEditorControls = useCallback(
		(
			controls: ReturnType<typeof normalizeProjectEditor>,
			options: { includeTimeline?: boolean } = {},
		) => {
			setWallpaper(controls.wallpaper);
			setShadowIntensity(controls.shadowIntensity);
			setBackgroundBlur(controls.backgroundBlur);
			setZoomMotionBlur(controls.zoomMotionBlur);
			setConnectZooms(controls.connectZooms);
			setShowCursor(controls.showCursor);
			setLoopCursor(controls.loopCursor);
			setCursorSize(controls.cursorSize);
			setCursorSmoothing(controls.cursorSmoothing);
			setCursorMotionBlur(controls.cursorMotionBlur);
			setCursorClickBounce(controls.cursorClickBounce);
			setCursorSway(controls.cursorSway);
			setCursorStyle(controls.cursorStyle);
			setCursorPack(controls.cursorPack);
			setCursorColor(controls.cursorColor);
			setCursorOpacity(controls.cursorOpacity);
			setClickHighlightColor(controls.clickHighlightColor);
			setClickHighlightSize(controls.clickHighlightSize);
			setClickHighlightOpacity(controls.clickHighlightOpacity);
			setCursorTrailLength(controls.cursorTrailLength);
			setCursorTrailOpacity(controls.cursorTrailOpacity);
			setShowKeyboardShortcuts(controls.showKeyboardShortcuts);
			setKeyboardShortcutPosition(controls.keyboardShortcutPosition);
			setKeyboardShortcutTheme(controls.keyboardShortcutTheme);
			setKeyboardShortcutScale(controls.keyboardShortcutScale);
			setKeyboardShortcutOpacity(controls.keyboardShortcutOpacity);
			setKeyboardShortcutDisplayMs(controls.keyboardShortcutDisplayMs);
			setKeyboardShortcutMaxVisible(controls.keyboardShortcutMaxVisible);
			setBorderRadius(controls.borderRadius);
			setPadding(controls.padding);
			setCropRegion(controls.cropRegion);
			setAspectRatio(controls.aspectRatio);
			setShowWebcam(controls.showWebcam);
			setMirrorWebcam(controls.mirrorWebcam);
			setWebcamRegion({ ...controls.webcamRegion });
			setCameraSizeDuringZoom(controls.cameraSizeDuringZoom);
			setCaptionSettings(controls.captionSettings);
			setCaptionGenerationOptions(controls.captionGenerationOptions);
			setExportQuality(controls.exportQuality);
			setExportFormat(controls.exportFormat);
			setGifFrameRate(controls.gifFrameRate);
			setGifLoop(controls.gifLoop);
			setGifSizePreset(controls.gifSizePreset);

			if (options.includeTimeline) {
				setZoomRegions(controls.zoomRegions);
				setTrimRegions(controls.trimRegions);
				setCutPoints(controls.cutPoints ?? []);
				setSpeedRegions(controls.speedRegions);
				setAnnotationRegions(controls.annotationRegions);
				setAudioRegions(controls.audioRegions);
				setCameraLayouts(controls.cameraLayouts);
				setCaptionTrack(controls.captionTrack);
			}
		},
		[],
	);

	const syncWebcamAvailability = useCallback(
		async (candidatePath: string | null, options: { quiet?: boolean } = {}) => {
			const requestId = ++webcamAvailabilityRequestRef.current;

			if (!candidatePath) {
				setMissingWebcamPath(null);
				notifiedMissingWebcamPathRef.current = null;
				return true;
			}

			const result = await window.electronAPI.checkFileAvailable(candidatePath);
			if (requestId !== webcamAvailabilityRequestRef.current) {
				return false;
			}

			if (result.success && result.exists) {
				setMissingWebcamPath(null);
				notifiedMissingWebcamPathRef.current = null;
				return true;
			}

			setMissingWebcamPath(candidatePath);
			if (!options.quiet && notifiedMissingWebcamPathRef.current !== candidatePath) {
				notifiedMissingWebcamPathRef.current = candidatePath;
				toast.warning("Webcam source is missing. Relink it or remove it from the project.");
			}

			return false;
		},
		[],
	);

	const syncAudioAvailability = useCallback(async (regions: AudioRegion[]) => {
		const requestId = ++audioAvailabilityRequestRef.current;
		const nextMissingEntries = await Promise.all(
			regions
				.filter((region) => isFileAudioSource(region) && region.audioPath)
				.map(async (region) => {
					const result = await window.electronAPI.checkFileAvailable(region.audioPath ?? "");
					return result.success && result.exists
						? null
						: ([region.id, region.audioPath ?? ""] as const);
				}),
		);

		if (requestId !== audioAvailabilityRequestRef.current) {
			return;
		}

		setMissingAudioPathsById(
			Object.fromEntries(nextMissingEntries.filter(Boolean) as Array<[string, string]>),
		);
	}, []);

	const cloneSnapshot = useCallback((snapshot: EditorHistorySnapshot): EditorHistorySnapshot => {
		return {
			zoomRegions: JSON.parse(JSON.stringify(snapshot.zoomRegions)),
			trimRegions: JSON.parse(JSON.stringify(snapshot.trimRegions)),
			cutPoints: [...snapshot.cutPoints],
			speedRegions: JSON.parse(JSON.stringify(snapshot.speedRegions)),
			annotationRegions: JSON.parse(JSON.stringify(snapshot.annotationRegions)),
			audioRegions: JSON.parse(JSON.stringify(snapshot.audioRegions)),
			cameraLayouts: JSON.parse(JSON.stringify(snapshot.cameraLayouts)),
			webcamRegion: JSON.parse(JSON.stringify(snapshot.webcamRegion)),
			showWebcam: snapshot.showWebcam,
			mirrorWebcam: snapshot.mirrorWebcam,
			cameraSizeDuringZoom: snapshot.cameraSizeDuringZoom,
			selectedCameraLayoutId: snapshot.selectedCameraLayoutId,
			webcamSelected: snapshot.webcamSelected,
			selectedZoomId: snapshot.selectedZoomId,
			selectedTrimId: snapshot.selectedTrimId,
			selectedSpeedId: snapshot.selectedSpeedId,
			selectedAnnotationId: snapshot.selectedAnnotationId,
			selectedAudioId: snapshot.selectedAudioId,
			captionTrack: snapshot.captionTrack
				? JSON.parse(JSON.stringify(snapshot.captionTrack))
				: null,
			captionSettings: JSON.parse(JSON.stringify(snapshot.captionSettings)),
			selectedCaptionId: snapshot.selectedCaptionId,
		};
	}, []);

	const buildHistorySnapshot = useCallback((): EditorHistorySnapshot => {
		return {
			zoomRegions,
			trimRegions,
			cutPoints,
			speedRegions,
			annotationRegions,
			audioRegions,
			cameraLayouts,
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			selectedCameraLayoutId,
			webcamSelected,
			selectedZoomId,
			selectedTrimId,
			selectedSpeedId,
			selectedAnnotationId,
			selectedAudioId,
			captionTrack,
			captionSettings,
			selectedCaptionId,
		};
	}, [
		zoomRegions,
		trimRegions,
		cutPoints,
		speedRegions,
		annotationRegions,
		audioRegions,
		cameraLayouts,
		webcamRegion,
		showWebcam,
		mirrorWebcam,
		cameraSizeDuringZoom,
		selectedCameraLayoutId,
		webcamSelected,
		selectedZoomId,
		selectedTrimId,
		selectedSpeedId,
		selectedAnnotationId,
		selectedAudioId,
		captionTrack,
		captionSettings,
		selectedCaptionId,
	]);

	const applyHistorySnapshot = useCallback(
		(snapshot: EditorHistorySnapshot) => {
			applyingHistoryRef.current = true;
			const cloned = cloneSnapshot(snapshot);
			setZoomRegions(cloned.zoomRegions);
			setTrimRegions(cloned.trimRegions);
			setCutPoints(cloned.cutPoints);
			setSpeedRegions(cloned.speedRegions);
			setAnnotationRegions(cloned.annotationRegions);
			setAudioRegions(cloned.audioRegions);
			setCameraLayouts(cloned.cameraLayouts);
			setWebcamRegion(cloned.webcamRegion);
			setShowWebcam(cloned.showWebcam);
			setMirrorWebcam(cloned.mirrorWebcam);
			setCameraSizeDuringZoom(cloned.cameraSizeDuringZoom);
			setSelectedCameraLayoutId(cloned.selectedCameraLayoutId);
			setWebcamSelected(cloned.webcamSelected);
			setSelectedZoomId(cloned.selectedZoomId);
			setSelectedTrimId(cloned.selectedTrimId);
			setSelectedSpeedId(cloned.selectedSpeedId);
			setSelectedAnnotationId(cloned.selectedAnnotationId);
			setSelectedAudioId(cloned.selectedAudioId);
			setCaptionTrack(cloned.captionTrack);
			setCaptionSettings(cloned.captionSettings);
			setSelectedCaptionId(cloned.selectedCaptionId);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				cloned.zoomRegions.map((region) => region.id),
			);
			nextTrimIdRef.current = deriveNextId(
				"trim",
				cloned.trimRegions.map((region) => region.id),
			);
			nextSpeedIdRef.current = deriveNextId(
				"speed",
				cloned.speedRegions.map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				cloned.annotationRegions.map((region) => region.id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				cloned.audioRegions.map((region) => region.id),
			);
			nextCameraLayoutIdRef.current = deriveNextId(
				"camera-layout",
				cloned.cameraLayouts.map((layout) => layout.id),
			);
			nextCaptionIdRef.current = deriveNextId(
				"caption",
				(cloned.captionTrack?.segments ?? []).map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				cloned.annotationRegions.reduce((max, region) => Math.max(max, region.zIndex), 0) + 1;
		},
		[cloneSnapshot],
	);

	const handleUndo = useCallback(() => {
		if (historyPastRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneSnapshot(buildHistorySnapshot());
		const previous = historyPastRef.current.pop();
		if (!previous) return;

		historyFutureRef.current.push(cloneSnapshot(current));
		historyCurrentRef.current = cloneSnapshot(previous);
		applyHistorySnapshot(previous);
	}, [applyHistorySnapshot, buildHistorySnapshot, cloneSnapshot]);

	const handleRedo = useCallback(() => {
		if (historyFutureRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneSnapshot(buildHistorySnapshot());
		const next = historyFutureRef.current.pop();
		if (!next) return;

		historyPastRef.current.push(cloneSnapshot(current));
		historyCurrentRef.current = cloneSnapshot(next);
		applyHistorySnapshot(next);
	}, [applyHistorySnapshot, buildHistorySnapshot, cloneSnapshot]);

	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const sourcePath = fromFileUrl(project.videoPath);
			const normalizedEditor = normalizeProjectEditor(project.editor);

			try {
				videoPlaybackRef.current?.pause();
			} catch {
				// no-op
			}
			setIsPlaying(false);
			setCurrentTime(0);
			setDuration(0);

			setError(null);
			setVideoSourcePath(sourcePath);
			setVideoPath(toFileUrl(sourcePath));
			setCurrentProjectPath(path ?? null);
			applyEditorControls(normalizedEditor, { includeTimeline: true });
			setWebcamPath(normalizedEditor.webcamPath ?? null);
			await syncWebcamAvailability(normalizedEditor.webcamPath ?? null, { quiet: false });

			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedSpeedId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
			setSelectedCaptionId(null);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				normalizedEditor.zoomRegions.map((region) => region.id),
			);
			nextTrimIdRef.current = deriveNextId(
				"trim",
				normalizedEditor.trimRegions.map((region) => region.id),
			);
			nextSpeedIdRef.current = deriveNextId(
				"speed",
				normalizedEditor.speedRegions.map((region) => region.id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				normalizedEditor.audioRegions.map((region) => region.id),
			);
			nextCameraLayoutIdRef.current = deriveNextId(
				"camera-layout",
				normalizedEditor.cameraLayouts.map((layout) => layout.id),
			);
			nextCaptionIdRef.current = deriveNextId(
				"caption",
				(normalizedEditor.captionTrack?.segments ?? []).map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				normalizedEditor.annotationRegions.map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				normalizedEditor.annotationRegions.reduce(
					(max, region) => Math.max(max, region.zIndex),
					0,
				) + 1;

			setLastSavedSnapshot(JSON.stringify(createProjectData(sourcePath, normalizedEditor)));
			return true;
		},
		[applyEditorControls, syncWebcamAvailability],
	);

	const currentProjectSnapshot = useMemo(() => {
		const sourcePath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		if (!sourcePath) {
			return null;
		}
		return JSON.stringify(
			createProjectData(sourcePath, {
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				connectZooms,
				showCursor,
				loopCursor,
				cursorSize,
				cursorSmoothing,
				cursorMotionBlur,
				cursorClickBounce,
				cursorSway,
				cursorStyle,
				cursorPack,
				cursorColor,
				cursorOpacity,
				clickHighlightColor,
				clickHighlightSize,
				clickHighlightOpacity,
				cursorTrailLength,
				cursorTrailOpacity,
				showKeyboardShortcuts,
				keyboardShortcutPosition,
				keyboardShortcutTheme,
				keyboardShortcutScale,
				keyboardShortcutOpacity,
				keyboardShortcutDisplayMs,
				keyboardShortcutMaxVisible,
				borderRadius,
				padding,
				cropRegion,
				zoomRegions,
				trimRegions,
				cutPoints,
				speedRegions,
				annotationRegions,
				audioRegions,
				aspectRatio,
				webcamPath: webcamPath ?? undefined,
				webcamRegion,
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				cameraLayouts,
				captionTrack,
				captionSettings,
				captionGenerationOptions,
				exportQuality,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
			}),
		);
	}, [
		videoPath,
		videoSourcePath,
		wallpaper,
		shadowIntensity,
		backgroundBlur,
		zoomMotionBlur,
		connectZooms,
		showCursor,
		loopCursor,
		cursorSize,
		cursorSmoothing,
		cursorMotionBlur,
		cursorClickBounce,
		cursorSway,
		cursorStyle,
		cursorPack,
		cursorColor,
		cursorOpacity,
		clickHighlightColor,
		clickHighlightSize,
		clickHighlightOpacity,
		cursorTrailLength,
		cursorTrailOpacity,
		showKeyboardShortcuts,
		keyboardShortcutPosition,
		keyboardShortcutTheme,
		keyboardShortcutScale,
		keyboardShortcutOpacity,
		keyboardShortcutDisplayMs,
		keyboardShortcutMaxVisible,
		borderRadius,
		padding,
		cropRegion,
		zoomRegions,
		trimRegions,
		cutPoints,
		speedRegions,
		audioRegions,
		annotationRegions,
		aspectRatio,
		webcamPath,
		webcamRegion,
		showWebcam,
		mirrorWebcam,
		cameraSizeDuringZoom,
		cameraLayouts,
		captionTrack,
		captionSettings,
		captionGenerationOptions,
		exportQuality,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
	]);

	useEffect(() => {
		const snapshot = cloneSnapshot(buildHistorySnapshot());

		if (!historyCurrentRef.current) {
			historyCurrentRef.current = snapshot;
			return;
		}

		if (applyingHistoryRef.current) {
			historyCurrentRef.current = snapshot;
			applyingHistoryRef.current = false;
			return;
		}

		const currentSerialized = JSON.stringify(historyCurrentRef.current);
		const nextSerialized = JSON.stringify(snapshot);
		if (currentSerialized === nextSerialized) {
			return;
		}

		historyPastRef.current.push(cloneSnapshot(historyCurrentRef.current));
		if (historyPastRef.current.length > 100) {
			historyPastRef.current.shift();
		}
		historyCurrentRef.current = snapshot;
		historyFutureRef.current = [];
	}, [buildHistorySnapshot, cloneSnapshot]);

	const hasUnsavedChanges = Boolean(
		currentProjectPath &&
			currentProjectSnapshot &&
			lastSavedSnapshot &&
			currentProjectSnapshot !== lastSavedSnapshot,
	);

	useEffect(() => {
		async function loadInitialData() {
			try {
				let restoredProject = false;
				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					restoredProject = await applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
				}

				if (!restoredProject) {
					const result = await window.electronAPI.getCurrentVideoPath();
					if (result.success && result.path) {
						const sourcePath = fromFileUrl(result.path);
						setVideoSourcePath(sourcePath);
						setVideoPath(toFileUrl(sourcePath));
						setCurrentProjectPath(null);
						setLastSavedSnapshot(null);
						setAspectRatio("native");
						setPadding(0);

						const webcamResult = await window.electronAPI.getCurrentWebcamPath();
						if (webcamResult.success && webcamResult.path) {
							setWebcamPath(webcamResult.path);
							await syncWebcamAvailability(webcamResult.path, { quiet: false });
							setShowWebcam(true);
						} else {
							clearWebcamState();
						}
					} else {
						setError("No video to load. Please record or select a video.");
					}
				}

				const postRecordingResult = await window.electronAPI.getPostRecordingContext();
				if (postRecordingResult.success) {
					setPostRecordingContext(postRecordingResult.context ?? null);
				}
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
	}, [applyLoadedProject, clearWebcamState, syncWebcamAvailability]);

	useEffect(() => {
		const unsubscribe = window.electronAPI.onCaptionGenerationProgress((progress) => {
			setCaptionGenerationProgress(progress);
		});
		return unsubscribe;
	}, []);

	useEffect(() => {
		void syncWebcamAvailability(webcamPath, { quiet: true });
	}, [syncWebcamAvailability, webcamPath]);

	useEffect(() => {
		if (!videoPath) {
			setCaptionModelStatus(null);
			return;
		}

		void (async () => {
			const status = await window.electronAPI.getCaptionModelStatus(videoPath);
			if (status.success && status.status) {
				setCaptionModelStatus(status.status);
			}
		})();
	}, [videoPath]);

	useEffect(() => {
		saveEditorPreferences({
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			connectZooms,
			showCursor,
			loopCursor,
			cursorSize,
			cursorSmoothing,
			cursorMotionBlur,
			cursorClickBounce,
			cursorSway,
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorTrailLength,
			cursorTrailOpacity,
			showKeyboardShortcuts,
			keyboardShortcutPosition,
			keyboardShortcutTheme,
			keyboardShortcutScale,
			keyboardShortcutOpacity,
			keyboardShortcutDisplayMs,
			keyboardShortcutMaxVisible,
			borderRadius,
			padding,
			cropRegion,
			aspectRatio,
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			exportQuality,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			workspaceLayout,
			presets: customPresets,
		});
	}, [
		wallpaper,
		shadowIntensity,
		backgroundBlur,
		zoomMotionBlur,
		connectZooms,
		showCursor,
		loopCursor,
		cursorSize,
		cursorSmoothing,
		cursorMotionBlur,
		cursorClickBounce,
		cursorSway,
		cursorStyle,
		cursorPack,
		cursorColor,
		cursorOpacity,
		clickHighlightColor,
		clickHighlightSize,
		clickHighlightOpacity,
		cursorTrailLength,
		cursorTrailOpacity,
		showKeyboardShortcuts,
		keyboardShortcutPosition,
		keyboardShortcutTheme,
		keyboardShortcutScale,
		keyboardShortcutOpacity,
		keyboardShortcutDisplayMs,
		keyboardShortcutMaxVisible,
		borderRadius,
		padding,
		cropRegion,
		aspectRatio,
		webcamRegion,
		showWebcam,
		mirrorWebcam,
		cameraSizeDuringZoom,
		exportQuality,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		workspaceLayout,
		customPresets,
	]);

	const saveProject = useCallback(
		async (forceSaveAs: boolean) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const sourcePath = videoSourcePath ?? fromFileUrl(videoPath);
			if (!sourcePath) {
				toast.error("Unable to determine source video path");
				return;
			}

			const projectData = createProjectData(sourcePath, {
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				connectZooms,
				showCursor,
				loopCursor,
				cursorSize,
				cursorSmoothing,
				cursorMotionBlur,
				cursorClickBounce,
				cursorSway,
				cursorStyle,
				cursorPack,
				cursorColor,
				cursorOpacity,
				clickHighlightColor,
				clickHighlightSize,
				clickHighlightOpacity,
				cursorTrailLength,
				cursorTrailOpacity,
				showKeyboardShortcuts,
				keyboardShortcutPosition,
				keyboardShortcutTheme,
				keyboardShortcutScale,
				keyboardShortcutOpacity,
				keyboardShortcutDisplayMs,
				keyboardShortcutMaxVisible,
				borderRadius,
				padding,
				cropRegion,
				zoomRegions,
				trimRegions,
				cutPoints,
				speedRegions,
				annotationRegions,
				audioRegions,
				aspectRatio,
				webcamPath: webcamPath ?? undefined,
				webcamRegion,
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				cameraLayouts,
				captionTrack,
				captionSettings,
				captionGenerationOptions,
				exportQuality,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
			});

			const fileNameBase =
				sourcePath
					.split(/[\\/]/)
					.pop()
					?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
			const projectSnapshot = JSON.stringify(projectData);
			const result = await window.electronAPI.saveProjectFile(
				projectData,
				fileNameBase,
				forceSaveAs ? undefined : (currentProjectPath ?? undefined),
			);

			if (result.canceled) {
				toast.info("Project save canceled");
				return;
			}

			if (!result.success) {
				toast.error(result.message || "Failed to save project");
				return;
			}

			if (result.path) {
				setCurrentProjectPath(result.path);
			}
			setLastSavedSnapshot(projectSnapshot);

			toast.success(`Project saved to ${result.path}`);
		},
		[
			videoPath,
			videoSourcePath,
			currentProjectPath,
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			connectZooms,
			showCursor,
			loopCursor,
			cursorSize,
			cursorSmoothing,
			cursorMotionBlur,
			cursorClickBounce,
			cursorSway,
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorTrailLength,
			cursorTrailOpacity,
			showKeyboardShortcuts,
			keyboardShortcutPosition,
			keyboardShortcutTheme,
			keyboardShortcutScale,
			keyboardShortcutOpacity,
			keyboardShortcutDisplayMs,
			keyboardShortcutMaxVisible,
			borderRadius,
			padding,
			cropRegion,
			zoomRegions,
			trimRegions,
			cutPoints,
			speedRegions,
			annotationRegions,
			audioRegions,
			aspectRatio,
			webcamPath,
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			cameraLayouts,
			captionTrack,
			captionSettings,
			captionGenerationOptions,
			exportQuality,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		],
	);

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!hasUnsavedChanges) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		window.electronAPI.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		const cleanup = window.electronAPI.onRequestSaveBeforeClose(async () => {
			await saveProject(false);
		});

		return () => cleanup?.();
	}, [saveProject]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		await saveProject(true);
	}, [saveProject]);

	const handleLoadProject = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();

		if (result.canceled) {
			return;
		}

		if (!result.success) {
			toast.error(result.message || "Failed to load project");
			return;
		}

		const restored = await applyLoadedProject(result.project, result.path ?? null);
		if (!restored) {
			toast.error("Invalid project file format");
			return;
		}

		toast.success(`Project loaded from ${result.path}`);
	}, [applyLoadedProject]);

	useEffect(() => {
		const removeLoadListener = window.electronAPI.onMenuLoadProject(handleLoadProject);
		const removeSaveListener = window.electronAPI.onMenuSaveProject(handleSaveProject);
		const removeSaveAsListener = window.electronAPI.onMenuSaveProjectAs(handleSaveProjectAs);

		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleLoadProject, handleSaveProject, handleSaveProjectAs]);

	useEffect(() => {
		let mounted = true;

		async function loadCursorTelemetry() {
			if (!videoPath) {
				if (mounted) {
					setCursorTelemetry([]);
				}
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(fromFileUrl(videoPath));
				if (mounted) {
					setCursorTelemetry(result.success ? result.samples : []);
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) {
					setCursorTelemetry([]);
				}
			}
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
		};
	}, [videoPath]);

	useEffect(() => {
		let mounted = true;

		async function loadKeyboardTelemetry() {
			if (!videoPath) {
				if (mounted) {
					setKeyboardTelemetry([]);
					setKeyboardTelemetryPlatform("win32");
				}
				return;
			}

			try {
				const result = await window.electronAPI.getKeyboardTelemetry(fromFileUrl(videoPath));
				if (mounted) {
					setKeyboardTelemetry(result.success ? result.samples : []);
					setKeyboardTelemetryPlatform(result.platform);
				}
			} catch (telemetryError) {
				console.warn("Unable to load keyboard telemetry:", telemetryError);
				if (mounted) {
					setKeyboardTelemetry([]);
					setKeyboardTelemetryPlatform("win32");
				}
			}
		}

		void loadKeyboardTelemetry();

		return () => {
			mounted = false;
		};
	}, [videoPath]);

	const normalizedCursorTelemetry = useMemo(() => {
		if (cursorTelemetry.length === 0) {
			return [] as CursorTelemetryPoint[];
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		return normalizeCursorTelemetry(
			cursorTelemetry,
			totalMs > 0 ? totalMs : Number.MAX_SAFE_INTEGER,
		);
	}, [cursorTelemetry, duration]);

	const keyboardShortcutCallouts = useMemo(
		() =>
			deriveKeyboardShortcutCallouts(
				keyboardTelemetry,
				keyboardTelemetryPlatform,
				keyboardShortcutDisplayMs,
			),
		[keyboardTelemetry, keyboardTelemetryPlatform, keyboardShortcutDisplayMs],
	);

	const displayedTimelineWindow = useMemo(() => {
		const totalMs = Math.max(0, Math.round(duration * 1000));
		return getDisplayedTimelineWindowMs(totalMs, trimRegions);
	}, [duration, trimRegions]);

	const effectiveCursorTelemetry = useMemo(() => {
		if (!loopCursor) {
			return normalizedCursorTelemetry;
		}

		if (
			normalizedCursorTelemetry.length < 2 ||
			displayedTimelineWindow.endMs <= displayedTimelineWindow.startMs
		) {
			return normalizedCursorTelemetry;
		}

		return buildLoopedCursorTelemetry(
			normalizedCursorTelemetry,
			displayedTimelineWindow.endMs,
			displayedTimelineWindow.startMs,
		);
	}, [loopCursor, normalizedCursorTelemetry, displayedTimelineWindow]);

	const effectiveZoomRegions = useMemo(() => {
		if (!loopCursor || zoomRegions.length === 0) {
			return zoomRegions;
		}

		if (displayedTimelineWindow.endMs <= displayedTimelineWindow.startMs) {
			return zoomRegions;
		}

		const dominantAtStart = findDominantRegion(zoomRegions, displayedTimelineWindow.startMs, {
			connectZooms,
		}).region;
		if (!dominantAtStart) {
			return zoomRegions;
		}

		const endWindowStartMs = Math.max(
			displayedTimelineWindow.startMs,
			displayedTimelineWindow.endMs - LOOP_CURSOR_END_WINDOW_MS,
		);
		const loopEndRegion: ZoomRegion = {
			id: `${dominantAtStart.id}__loop-end-sync`,
			startMs: endWindowStartMs,
			endMs: displayedTimelineWindow.endMs,
			depth: dominantAtStart.depth,
			focus: {
				cx: dominantAtStart.focus.cx,
				cy: dominantAtStart.focus.cy,
			},
		};

		return [...zoomRegions.filter((region) => region.id !== loopEndRegion.id), loopEndRegion];
	}, [loopCursor, zoomRegions, displayedTimelineWindow, connectZooms]);

	useEffect(() => {
		if (
			!videoPath ||
			duration <= 0 ||
			zoomRegions.length > 0 ||
			normalizedCursorTelemetry.length < 2 ||
			!postRecordingContext?.autoCreateZooms
		) {
			return;
		}

		if (autoSuggestedVideoPathRef.current === videoPath) {
			return;
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		if (totalMs <= 0) {
			return;
		}

		const candidates = detectInteractionCandidates(normalizedCursorTelemetry);
		if (candidates.length === 0) {
			autoSuggestedVideoPathRef.current = videoPath;
			return;
		}

		const DEFAULT_DURATION_MS = 1100;
		const MIN_SPACING_MS = 1800;
		const sortedCandidates = [...candidates].sort((a, b) => b.strength - a.strength);
		const acceptedCenters: number[] = [];

		setZoomRegions((prev) => {
			if (prev.length > 0) {
				return prev;
			}

			const reservedSpans: Array<{ start: number; end: number }> = [];
			const additions: ZoomRegion[] = [];
			let nextId = nextZoomIdRef.current;

			sortedCandidates.forEach((candidate) => {
				const tooCloseToAccepted = acceptedCenters.some(
					(center) => Math.abs(center - candidate.centerTimeMs) < MIN_SPACING_MS,
				);
				if (tooCloseToAccepted) {
					return;
				}

				const centeredStart = Math.round(candidate.centerTimeMs - DEFAULT_DURATION_MS / 2);
				const startMs = Math.max(0, Math.min(centeredStart, totalMs - DEFAULT_DURATION_MS));
				const endMs = Math.min(totalMs, startMs + DEFAULT_DURATION_MS);

				const hasOverlap = reservedSpans.some((span) => endMs > span.start && startMs < span.end);
				if (hasOverlap) {
					return;
				}

				additions.push({
					id: `zoom-${nextId++}`,
					startMs,
					endMs,
					depth: DEFAULT_ZOOM_DEPTH,
					focus: clampFocusToDepth(candidate.focus, DEFAULT_ZOOM_DEPTH),
				});
				reservedSpans.push({ start: startMs, end: endMs });
				acceptedCenters.push(candidate.centerTimeMs);
			});

			if (additions.length === 0) {
				return prev;
			}

			nextZoomIdRef.current = nextId;
			return [...prev, ...additions];
		});

		autoSuggestedVideoPathRef.current = videoPath;
	}, [
		videoPath,
		duration,
		normalizedCursorTelemetry,
		postRecordingContext?.autoCreateZooms,
		zoomRegions.length,
	]);

	useEffect(() => {
		const layout =
			workspaceLayout === "preview-focus"
				? [78, 22]
				: workspaceLayout === "timeline-focus"
					? [42, 58]
					: [65, 35];

		panelGroupRef.current?.setLayout(layout);
	}, [workspaceLayout]);

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (isPlaying) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	function handleSeek(time: number) {
		const video = videoPlaybackRef.current?.video;
		if (!video) return;
		video.currentTime = time;
	}

	const handleSelectZoom = useCallback((id: string | null) => {
		setSelectedZoomId(id);
		if (id) {
			setSelectedTrimId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleSelectTrim = useCallback((id: string | null) => {
		setSelectedTrimId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleSelectAnnotation = useCallback((id: string | null) => {
		setSelectedAnnotationId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
			setSelectedAudioId(null);
		}
	}, []);

	const handleSelectWebcam = useCallback(() => {
		setWebcamSelected(true);
		setSelectedCameraLayoutId(null);
		setSelectedZoomId(null);
		setSelectedTrimId(null);
		setSelectedSpeedId(null);
		setSelectedAnnotationId(null);
		setSelectedAudioId(null);
	}, []);

	const handleSelectCameraLayout = useCallback((id: string | null) => {
		setSelectedCameraLayoutId(id);
		if (id) {
			setWebcamSelected(false);
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedSpeedId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleZoomAdded = useCallback((span: Span) => {
		const id = `zoom-${nextZoomIdRef.current++}`;
		const newRegion: ZoomRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			depth: DEFAULT_ZOOM_DEPTH,
			focus: { cx: 0.5, cy: 0.5 },
		};
		setZoomRegions((prev) => [...prev, newRegion]);
		setSelectedZoomId(id);
		setSelectedTrimId(null);
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleZoomSuggested = useCallback((span: Span, focus: ZoomFocus) => {
		const id = `zoom-${nextZoomIdRef.current++}`;
		const newRegion: ZoomRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			depth: DEFAULT_ZOOM_DEPTH,
			focus: clampFocusToDepth(focus, DEFAULT_ZOOM_DEPTH),
		};
		setZoomRegions((prev) => [...prev, newRegion]);
		setSelectedZoomId(id);
		setSelectedTrimId(null);
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleTrimAdded = useCallback((span: Span) => {
		const id = `trim-${nextTrimIdRef.current++}`;
		const newRegion: TrimRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
		};
		setTrimRegions((prev) => [...prev, newRegion]);
		setSelectedTrimId(id);
		setSelectedZoomId(null);
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleSplitClip = useCallback(
		(timeMs: number) => {
			const t = Math.round(timeMs);
			const totalMs = Math.round(duration * 1000);
			if (t <= 0 || t >= totalMs) return;
			// Don't split inside a trim region
			if (trimRegions.some((r) => t > r.startMs && t < r.endMs)) return;
			setCutPoints((prev) => {
				// Don't add duplicate (within 10ms tolerance)
				if (prev.some((cp) => Math.abs(cp - t) < 10)) return prev;
				return [...prev, t].sort((a, b) => a - b);
			});
		},
		[duration, trimRegions],
	);

	const handleDeleteSegment = useCallback((startMs: number, endMs: number) => {
		if (endMs <= startMs) return;
		const id = `trim-${nextTrimIdRef.current++}`;
		const newRegion: TrimRegion = { id, startMs: Math.round(startMs), endMs: Math.round(endMs) };
		setTrimRegions((prev) => {
			const updated = [...prev, newRegion].sort((a, b) => a.startMs - b.startMs);
			// Merge overlapping/adjacent trim regions
			const merged: TrimRegion[] = [];
			for (const region of updated) {
				const last = merged[merged.length - 1];
				if (last && region.startMs <= last.endMs) {
					last.endMs = Math.max(last.endMs, region.endMs);
				} else {
					merged.push({ ...region });
				}
			}
			return merged;
		});
		// Remove cut points that are now inside trim regions
		setCutPoints((prev) => prev.filter((cp) => cp <= startMs || cp >= endMs));
		setSelectedTrimId(null);
	}, []);

	const handleZoomSpanChange = useCallback((id: string, span: Span) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleTrimSpanChange = useCallback((id: string, span: Span) => {
		setTrimRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							focus: clampFocusToDepth(focus, region.depth),
						}
					: region,
			),
		);
	}, []);

	const handleZoomDepthChange = useCallback(
		(depth: ZoomDepth) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) =>
					region.id === selectedZoomId
						? {
								...region,
								depth,
								focus: clampFocusToDepth(region.focus, depth),
							}
						: region,
				),
			);
		},
		[selectedZoomId],
	);

	const handleZoomDelete = useCallback(
		(id: string) => {
			setZoomRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedZoomId === id) {
				setSelectedZoomId(null);
			}
		},
		[selectedZoomId],
	);

	const handleTrimDelete = useCallback(
		(id: string) => {
			setTrimRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedTrimId === id) {
				setSelectedTrimId(null);
			}
		},
		[selectedTrimId],
	);

	const handleSelectSpeed = useCallback((id: string | null) => {
		setSelectedSpeedId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleSpeedAdded = useCallback((span: Span) => {
		const id = `speed-${nextSpeedIdRef.current++}`;
		const newRegion: SpeedRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			speed: DEFAULT_PLAYBACK_SPEED,
		};
		setSpeedRegions((prev) => [...prev, newRegion]);
		setSelectedSpeedId(id);
		setSelectedZoomId(null);
		setSelectedTrimId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleSpeedSpanChange = useCallback((id: string, span: Span) => {
		setSpeedRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleSpeedDelete = useCallback(
		(id: string) => {
			setSpeedRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedSpeedId === id) {
				setSelectedSpeedId(null);
			}
		},
		[selectedSpeedId],
	);

	const handleSelectAudio = useCallback((id: string | null) => {
		setSelectedAudioId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
		}
	}, []);

	const handleAudioAdded = useCallback(
		async (selection: AudioTrackSelection, clickTimeMs?: number) => {
			const totalMs = Math.max(0, Math.round(duration * 1000));
			if (totalMs === 0) {
				return;
			}

			const resolvedDurationMs =
				selection.durationMs && selection.durationMs > 0
					? selection.durationMs
					: await loadAudioSelectionDurationMs(selection);
			if (resolvedDurationMs <= 0) {
				toast.error("Could not read audio file", {
					description: "The selected audio could not be loaded.",
				});
				return;
			}

			const startPos = Math.max(
				0,
				Math.min(
					clickTimeMs != null ? Math.round(clickTimeMs) : Math.round(currentTime * 1000),
					totalMs,
				),
			);
			const sorted = [...audioRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);

			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place audio here", {
					description:
						"Audio region already exists at this location or not enough space available.",
				});
				return;
			}

			const shouldLoop = selection.loop ?? selection.sourceType === "built-in";
			const actualDuration = shouldLoop
				? Math.min(gapToNext, totalMs - startPos)
				: Math.min(resolvedDurationMs, gapToNext, totalMs - startPos);
			if (actualDuration <= 0) {
				toast.error("Cannot place audio here", {
					description: "There is no room left at the current playhead position.",
				});
				return;
			}

			const builtInAsset =
				selection.sourceType === "built-in" ? getBackgroundMusicAssetById(selection.assetId) : null;
			const id = `audio-${nextAudioIdRef.current++}`;
			const newRegion: AudioRegion = {
				id,
				startMs: startPos,
				endMs: startPos + actualDuration,
				sourceType: selection.sourceType,
				assetId: selection.sourceType === "built-in" ? selection.assetId : undefined,
				audioPath: selection.sourceType === "file" ? selection.audioPath : undefined,
				volume:
					selection.defaultVolume ?? builtInAsset?.defaultVolume ?? DEFAULT_AUDIO_REGION_VOLUME,
				fadeInMs: DEFAULT_AUDIO_FADE_IN_MS,
				fadeOutMs: DEFAULT_AUDIO_FADE_OUT_MS,
				loop: shouldLoop,
			};

			setAudioRegions((prev) => [...prev, newRegion]);
			setSelectedAudioId(id);
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
		},
		[audioRegions, currentTime, duration],
	);

	const handleReplaceSelectedAudioSource = useCallback(
		async (selection: AudioTrackSelection) => {
			if (!selectedAudioRegion) {
				await handleAudioAdded(selection);
				return;
			}

			const resolvedDurationMs =
				selection.durationMs && selection.durationMs > 0
					? selection.durationMs
					: await loadAudioSelectionDurationMs(selection);
			if (resolvedDurationMs <= 0) {
				toast.error("Could not read audio file", {
					description: "The selected audio could not be loaded.",
				});
				return;
			}

			setAudioRegions((prev) =>
				prev.map((region) => {
					if (region.id !== selectedAudioRegion.id) {
						return region;
					}

					return {
						...region,
						sourceType: selection.sourceType,
						assetId: selection.sourceType === "built-in" ? selection.assetId : undefined,
						audioPath: selection.sourceType === "file" ? selection.audioPath : undefined,
						endMs:
							(selection.loop ?? selection.sourceType === "built-in")
								? region.endMs
								: Math.min(region.endMs, region.startMs + resolvedDurationMs),
						loop: selection.loop ?? selection.sourceType === "built-in",
					};
				}),
			);
		},
		[handleAudioAdded, selectedAudioRegion],
	);

	const handleAudioVolumeChange = useCallback((id: string, volume: number) => {
		setAudioRegions((prev) =>
			prev.map((region) =>
				region.id === id ? { ...region, volume: Math.max(0, Math.min(1, volume)) } : region,
			),
		);
	}, []);

	const handleAudioFadeChange = useCallback(
		(id: string, updates: Partial<Pick<AudioRegion, "fadeInMs" | "fadeOutMs">>) => {
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === id
						? {
								...region,
								fadeInMs:
									typeof updates.fadeInMs === "number"
										? Math.max(0, Math.round(updates.fadeInMs))
										: region.fadeInMs,
								fadeOutMs:
									typeof updates.fadeOutMs === "number"
										? Math.max(0, Math.round(updates.fadeOutMs))
										: region.fadeOutMs,
							}
						: region,
				),
			);
		},
		[],
	);

	const handleAudioLoopChange = useCallback((id: string, loop: boolean) => {
		setAudioRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, loop } : region)),
		);
	}, []);

	const handleAudioSpanChange = useCallback((id: string, span: Span) => {
		setAudioRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleAudioDelete = useCallback(
		(id: string) => {
			setAudioRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAudioId === id) {
				setSelectedAudioId(null);
			}
		},
		[selectedAudioId],
	);

	const handleRelinkMissingAudio = useCallback(async () => {
		if (!selectedAudioRegion || selectedAudioRegion.sourceType !== "file") {
			return;
		}

		const result = await window.electronAPI.openAudioFilePicker();
		if (result.canceled || !result.success || !result.path) {
			return;
		}

		const resolvedDurationMs = await loadAudioSelectionDurationMs({
			sourceType: "file",
			audioPath: result.path,
		});
		if (resolvedDurationMs <= 0) {
			toast.error("Selected audio file is not accessible.");
			return;
		}

		setAudioRegions((prev) =>
			prev.map((region) =>
				region.id === selectedAudioRegion.id
					? {
							...region,
							audioPath: result.path,
							endMs: Math.min(region.endMs, region.startMs + resolvedDurationMs),
						}
					: region,
			),
		);
		toast.success("Audio source relinked.");
	}, [selectedAudioRegion]);

	const handleRemoveMissingAudio = useCallback(() => {
		if (!selectedAudioRegion) {
			return;
		}

		setAudioRegions((prev) => prev.filter((region) => region.id !== selectedAudioRegion.id));
		toast.success("Audio removed from this project.");
	}, [selectedAudioRegion]);

	const handleSpeedChange = useCallback(
		(speed: PlaybackSpeed) => {
			if (!selectedSpeedId) return;
			setSpeedRegions((prev) =>
				prev.map((region) => (region.id === selectedSpeedId ? { ...region, speed } : region)),
			);
		},
		[selectedSpeedId],
	);

	const handleCameraLayoutAdded = useCallback(
		(span: Span) => {
			const id = `camera-layout-${nextCameraLayoutIdRef.current++}`;
			const newLayout: CameraLayoutRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				mode: "fullscreen",
			};
			setCameraLayouts((prev) => [...prev, newLayout]);
			handleSelectCameraLayout(id);
		},
		[handleSelectCameraLayout],
	);

	const handleCameraLayoutSpanChange = useCallback((id: string, span: Span) => {
		setCameraLayouts((prev) =>
			prev.map((layout) =>
				layout.id === id
					? {
							...layout,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: layout,
			),
		);
	}, []);

	const handleCameraLayoutDelete = useCallback(
		(id: string) => {
			setCameraLayouts((prev) => prev.filter((layout) => layout.id !== id));
			if (selectedCameraLayoutId === id) {
				setSelectedCameraLayoutId(null);
			}
		},
		[selectedCameraLayoutId],
	);

	const handleCameraLayoutChange = useCallback(
		(id: string, updates: Partial<CameraLayoutRegion>) => {
			setCameraLayouts((prev) =>
				prev.map((layout) =>
					layout.id === id
						? {
								...layout,
								...updates,
							}
						: layout,
				),
			);
		},
		[],
	);

	const handleAnnotationAdded = useCallback((span: Span) => {
		const id = `annotation-${nextAnnotationIdRef.current++}`;
		const zIndex = nextAnnotationZIndexRef.current++; // Assign z-index based on creation order
		const newRegion: AnnotationRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			type: "text",
			content: "Enter text...",
			position: { ...DEFAULT_ANNOTATION_POSITION },
			size: { ...DEFAULT_ANNOTATION_SIZE },
			style: { ...DEFAULT_ANNOTATION_STYLE },
			zIndex,
		};
		setAnnotationRegions((prev) => [...prev, newRegion]);
		setSelectedAnnotationId(id);
		setSelectedZoomId(null);
		setSelectedTrimId(null);
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
	}, []);

	const handleAnnotationSpanChange = useCallback((id: string, span: Span) => {
		setAnnotationRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleAnnotationDelete = useCallback(
		(id: string) => {
			setAnnotationRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAnnotationId === id) {
				setSelectedAnnotationId(null);
			}
		},
		[selectedAnnotationId],
	);

	const handleAnnotationContentChange = useCallback((id: string, content: string) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				// Store content in type-specific fields
				if (region.type === "text") {
					return { ...region, content, textContent: content };
				} else if (region.type === "image") {
					return { ...region, content, imageContent: content };
				} else {
					return { ...region, content };
				}
			});
			return updated;
		});
	}, []);

	const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion["type"]) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				const updatedRegion = { ...region, type };

				// Restore content from type-specific storage
				if (type === "text") {
					updatedRegion.content = region.textContent || "Enter text...";
				} else if (type === "image") {
					updatedRegion.content = region.imageContent || "";
				} else if (type === "figure") {
					updatedRegion.content = "";
					if (!region.figureData) {
						updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
					}
				} else if (type === "blur") {
					updatedRegion.content = "";
					if (!region.blurData) {
						updatedRegion.blurData = { ...DEFAULT_BLUR_DATA };
					}
				}

				return updatedRegion;
			});
			return updated;
		});
	}, []);

	const handleAnnotationStyleChange = useCallback(
		(id: string, style: Partial<AnnotationRegion["style"]>) => {
			setAnnotationRegions((prev) =>
				prev.map((region) =>
					region.id === id ? { ...region, style: { ...region.style, ...style } } : region,
				),
			);
		},
		[],
	);

	const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, figureData } : region)),
		);
	}, []);

	const updateSelectedCameraLayoutRegionOverride = useCallback(
		(updates: Partial<WebcamRegion>) => {
			if (!selectedCameraLayoutId) {
				return false;
			}

			let applied = false;
			setCameraLayouts((prev) =>
				prev.map((layout) => {
					if (layout.id !== selectedCameraLayoutId || layout.mode !== "default") {
						return layout;
					}

					applied = true;
					const baseRegion = layout.regionOverride
						? normalizeWebcamRegion({
								...webcamRegion,
								...layout.regionOverride,
								position: {
									...webcamRegion.position,
									...layout.regionOverride.position,
								},
								size: {
									...webcamRegion.size,
									...layout.regionOverride.size,
								},
							})
						: webcamRegion;

					const nextRegion = normalizeWebcamRegion({
						...baseRegion,
						...updates,
						position: updates.position
							? { ...baseRegion.position, ...updates.position }
							: baseRegion.position,
						size: updates.size ? { ...baseRegion.size, ...updates.size } : baseRegion.size,
					});

					return {
						...layout,
						regionOverride: {
							position: { ...nextRegion.position },
							size: { ...nextRegion.size },
							anchor: nextRegion.anchor,
							marginPct: nextRegion.marginPct,
							shape: nextRegion.shape,
							borderRadius: nextRegion.borderRadius,
							opacity: nextRegion.opacity,
							borderWidth: nextRegion.borderWidth,
							borderColor: nextRegion.borderColor,
						},
					};
				}),
			);

			return applied;
		},
		[selectedCameraLayoutId, webcamRegion],
	);

	const handleWebcamPositionChange = useCallback(
		(position: { x: number; y: number }) => {
			if (updateSelectedCameraLayoutRegionOverride({ position, anchor: "free" })) {
				return;
			}

			setWebcamRegion((prev) => normalizeWebcamRegion({ ...prev, position, anchor: "free" }));
		},
		[updateSelectedCameraLayoutRegionOverride],
	);

	const handleWebcamSizeChange = useCallback(
		(size: { width: number; height: number }) => {
			if (updateSelectedCameraLayoutRegionOverride({ size, anchor: "free" })) {
				return;
			}

			setWebcamRegion((prev) => normalizeWebcamRegion({ ...prev, size, anchor: "free" }));
		},
		[updateSelectedCameraLayoutRegionOverride],
	);

	const handleWebcamRegionChange = useCallback(
		(region: Partial<WebcamRegion>) => {
			if (updateSelectedCameraLayoutRegionOverride(region)) {
				return;
			}

			setWebcamRegion((prev) => ({
				...normalizeWebcamRegion({
					...prev,
					...region,
					position: region.position ? { ...prev.position, ...region.position } : prev.position,
					size: region.size ? { ...prev.size, ...region.size } : prev.size,
				}),
			}));
		},
		[updateSelectedCameraLayoutRegionOverride],
	);

	const handleResetRecommendedWebcam = useCallback(() => {
		setWebcamRegion(getRecommendedWebcamRegion(aspectRatio));
		setShowWebcam(true);
		setMirrorWebcam(false);
		setCameraSizeDuringZoom(DEFAULT_CAMERA_SIZE_DURING_ZOOM);
	}, [aspectRatio]);

	const handleResetSelectedCameraLayout = useCallback(() => {
		if (!selectedCameraLayoutId) return;

		setCameraLayouts((prev) =>
			prev.map((layout) =>
				layout.id === selectedCameraLayoutId ? { ...layout, regionOverride: undefined } : layout,
			),
		);
	}, [selectedCameraLayoutId]);

	const handleRelinkMissingWebcam = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled || !result.success || !result.path) {
			return;
		}

		setWebcamPath(result.path);
		await window.electronAPI.setCurrentWebcamPath(result.path);
		const exists = await syncWebcamAvailability(result.path, { quiet: false });
		if (!exists) {
			toast.error("Selected webcam file is not accessible.");
			return;
		}

		setShowWebcam(true);
		toast.success("Webcam source relinked.");
	}, [syncWebcamAvailability]);

	const handleRemoveWebcamFromProject = useCallback(async () => {
		clearWebcamState();
		await window.electronAPI.clearCurrentWebcamPath();
		toast.success("Webcam removed from this project.");
	}, [clearWebcamState]);

	const handleAnnotationBlurDataChange = useCallback((id: string, blurData: BlurData) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, blurData } : region)),
		);
	}, []);

	// ── Caption handlers ──

	const createManualCaptionSegment = useCallback(
		(id: string, startMs: number, endMs: number, text: string) => {
			const tokens = text
				.split(/\s+/)
				.map((token) => token.trim())
				.filter(Boolean);
			const duration = Math.max(1, endMs - startMs);
			const step = Math.max(1, Math.round(duration / Math.max(1, tokens.length)));

			return {
				id,
				startMs,
				endMs,
				text,
				words: tokens.map((token, index) => {
					const wordStartMs = startMs + index * step;
					return {
						id: `${id}-word-${index + 1}`,
						text: token,
						startMs: wordStartMs,
						endMs: index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + step),
					};
				}),
				source: "manual" as const,
			};
		},
		[],
	);

	const updateCaptionSegments = useCallback(
		(updater: (segments: CaptionRegion[]) => CaptionRegion[]) => {
			setCaptionTrack((prev) => {
				const baseTrack: CaptionTrack = prev ?? {
					backend:
						captionGenerationOptions.preferredBackend === "apple-speech"
							? "apple-speech"
							: "whisper.cpp",
					model: captionGenerationOptions.model,
					language: captionGenerationOptions.language,
					prompt: captionGenerationOptions.prompt,
					sourceAudio: captionGenerationOptions.preferredSourceAudio,
					status: "ready",
					segments: [],
				};
				return {
					...baseTrack,
					segments: updater(baseTrack.segments),
					status: "ready",
					error: undefined,
				};
			});
		},
		[captionGenerationOptions],
	);

	const handleCaptionAdded = useCallback(
		(span: { start: number; end: number }) => {
			const id = `caption-${nextCaptionIdRef.current++}`;
			updateCaptionSegments((prev) => [
				...prev,
				createManualCaptionSegment(
					id,
					span.start,
					span.end,
					t("editor.captions.defaultText", "Caption text"),
				),
			]);
			setSelectedCaptionId(id);
		},
		[createManualCaptionSegment, t, updateCaptionSegments],
	);

	const handleCaptionSpanChange = useCallback(
		(id: string, span: { start: number; end: number }) => {
			updateCaptionSegments((prev) =>
				prev.map((segment) =>
					segment.id === id
						? createManualCaptionSegment(id, span.start, span.end, segment.text)
						: segment,
				),
			);
		},
		[createManualCaptionSegment, updateCaptionSegments],
	);

	const handleCaptionTextChange = useCallback(
		(id: string, text: string) => {
			updateCaptionSegments((prev) =>
				prev.map((segment) =>
					segment.id === id
						? createManualCaptionSegment(id, segment.startMs, segment.endMs, text)
						: segment,
				),
			);
		},
		[createManualCaptionSegment, updateCaptionSegments],
	);

	const handleCaptionDelete = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => prev.filter((segment) => segment.id !== id));
			setSelectedCaptionId((prev) => (prev === id ? null : prev));
		},
		[updateCaptionSegments],
	);

	const handleDeleteAllCaptions = useCallback(() => {
		setCaptionTrack((prev) =>
			prev ? { ...prev, segments: [], status: "idle", error: undefined } : null,
		);
		setSelectedCaptionId(null);
	}, []);

	const handleCaptionStylePresetChange = useCallback((preset: CaptionStylePreset) => {
		setCaptionSettings((prev) => ({
			...prev,
			style: { ...CAPTION_STYLE_PRESETS[preset] },
		}));
	}, []);

	const handleCaptionSettingsChange = useCallback((partial: Partial<CaptionSettings>) => {
		setCaptionSettings((prev) => ({ ...prev, ...partial }));
	}, []);

	const handleCaptionStyleChange = useCallback((partial: Partial<CaptionSettings["style"]>) => {
		setCaptionSettings((prev) => ({
			...prev,
			style: { ...prev.style, ...partial },
		}));
	}, []);

	const getFriendlyCaptionErrorMessage = useCallback(
		(error: unknown) => {
			const rawMessage = error instanceof Error ? error.message : String(error ?? "");
			const normalizedMessage = rawMessage.toLowerCase();

			if (
				normalizedMessage.includes("no usable audio track") ||
				normalizedMessage.includes("does not contain any stream") ||
				normalizedMessage.includes("no microphone or video audio")
			) {
				return t(
					"editor.captions.transcribeNoAudio",
					"This recording has no usable audio. Turn on microphone or system audio, then record again.",
				);
			}

			if (
				normalizedMessage.includes("failed to download whisper model") ||
				normalizedMessage.includes("failed to download whisper vad model") ||
				normalizedMessage.includes("download whisper")
			) {
				return t(
					"editor.captions.transcribeModelDownloadFailed",
					"ScreenMint couldn't download the local speech model. Check your internet connection and try again.",
				);
			}

			if (normalizedMessage.includes("apple speech requires a specific language")) {
				return t(
					"editor.captions.transcribeAppleSpeechNeedsLanguage",
					"Apple Speech needs a fixed language. Choose the spoken language, then try again.",
				);
			}

			if (
				normalizedMessage.includes("speech recognition permission") ||
				normalizedMessage.includes("permission is denied")
			) {
				return t(
					"editor.captions.transcribeSpeechPermissionNeeded",
					"Allow speech recognition for ScreenMint in macOS settings, then try again.",
				);
			}

			if (
				normalizedMessage.includes("on-device apple speech is unavailable") ||
				normalizedMessage.includes("apple speech is unavailable for the selected language")
			) {
				return t(
					"editor.captions.transcribeAppleSpeechUnavailable",
					"Apple Speech is unavailable for this language on this Mac. Switch to Whisper or choose another language.",
				);
			}

			if (
				normalizedMessage.includes("whisper cli build tools are unavailable") ||
				normalizedMessage.includes("cmake") ||
				normalizedMessage.includes("xcode command line tools") ||
				normalizedMessage.includes("visual studio c++ build tools")
			) {
				return t(
					"editor.captions.transcribeRuntimeSetupFailed",
					"ScreenMint couldn't prepare the local caption engine on this device. Install the required build tools and try again.",
				);
			}

			if (
				normalizedMessage.includes("bad_alloc") ||
				normalizedMessage.includes("bad allocation") ||
				normalizedMessage.includes("out of memory") ||
				normalizedMessage.includes("not enough memory")
			) {
				return t(
					"editor.captions.transcribeLowMemory",
					"Your device ran out of memory while transcribing. Try the Small model for this recording.",
				);
			}

			return t("editor.captions.transcribeFailed", "Failed to transcribe audio locally.");
		},
		[t],
	);

	const handleAutoTranscribe = useCallback(async () => {
		if (!videoPath || isTranscribing) return;
		setIsTranscribing(true);
		setCaptionGenerationProgress({
			stage: "bootstrap",
			percentage: 0,
			message: t("editor.captions.preparing", "Preparing local transcription..."),
		});

		try {
			const result = await window.electronAPI.generateCaptions({
				videoPath,
				preferredBackend: captionGenerationOptions.preferredBackend,
				model: captionGenerationOptions.model,
				language: captionGenerationOptions.language,
				prompt: captionGenerationOptions.prompt,
				preferredSourceAudio: captionGenerationOptions.preferredSourceAudio,
			});

			if (!result.success && result.canceled) {
				setCaptionGenerationProgress(null);
				return;
			}

			if (!result.success || !result.track) {
				throw new Error(result.error || result.message || "Failed to generate captions.");
			}

			setCaptionTrack(result.track);
			setCaptionSettings((prev) => ({ ...prev, enabled: true }));
			setCaptionGenerationOptions((prev) => ({
				...prev,
				preferredBackend: result.track?.backend ?? prev.preferredBackend,
				model: result.track?.model ?? prev.model,
				language: result.track?.language ?? prev.language,
				prompt: result.track?.prompt ?? prev.prompt,
				preferredSourceAudio: result.track?.sourceAudio ?? prev.preferredSourceAudio,
			}));
			setSelectedCaptionId(result.track.segments[0]?.id ?? null);
			setCaptionGenerationProgress({
				stage: "complete",
				percentage: 100,
				message: t("editor.captions.transcriptReady", "Transcript ready"),
			});
			const status = await window.electronAPI.getCaptionModelStatus(videoPath);
			if (status.success && status.status) {
				setCaptionModelStatus(status.status);
			}
			toast.success(
				t("editor.captions.generatedSegments", "Generated {{count}} transcript segments", {
					count: result.track.segments.length,
				}),
			);
		} catch (error) {
			console.error("Transcription error:", error);
			setCaptionGenerationProgress(null);
			toast.error(getFriendlyCaptionErrorMessage(error));
		} finally {
			setIsTranscribing(false);
		}
	}, [captionGenerationOptions, getFriendlyCaptionErrorMessage, isTranscribing, t, videoPath]);

	const handleCaptionGenerationOptionsChange = useCallback(
		(partial: Partial<CaptionGenerationOptions>) => {
			setCaptionGenerationOptions((prev) => ({ ...prev, ...partial }));
		},
		[],
	);

	const handleCaptionSplit = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => {
				const segment = prev.find((entry) => entry.id === id);
				if (!segment) {
					return prev;
				}

				if (segment.words.length < 2) {
					return prev;
				}

				const splitIndex = Math.floor(segment.words.length / 2);
				const leftWords = segment.words.slice(0, splitIndex);
				const rightWords = segment.words.slice(splitIndex);
				if (leftWords.length === 0 || rightWords.length === 0) {
					return prev;
				}

				const leftId = `caption-${nextCaptionIdRef.current++}`;
				const rightId = `caption-${nextCaptionIdRef.current++}`;
				const leftSegment: CaptionRegion = {
					id: leftId,
					startMs: segment.startMs,
					endMs: leftWords[leftWords.length - 1]?.endMs ?? segment.startMs,
					text: leftWords.map((word) => word.text).join(" "),
					words: leftWords.map((word, index) => ({ ...word, id: `${leftId}-word-${index + 1}` })),
					source: segment.source,
				};
				const rightSegment: CaptionRegion = {
					id: rightId,
					startMs: rightWords[0]?.startMs ?? segment.endMs,
					endMs: segment.endMs,
					text: rightWords.map((word) => word.text).join(" "),
					words: rightWords.map((word, index) => ({ ...word, id: `${rightId}-word-${index + 1}` })),
					source: segment.source,
				};

				return prev.flatMap((entry) => (entry.id === id ? [leftSegment, rightSegment] : [entry]));
			});
		},
		[updateCaptionSegments],
	);

	const handleCaptionMergeNext = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => {
				const index = prev.findIndex((entry) => entry.id === id);
				if (index < 0 || index >= prev.length - 1) {
					return prev;
				}

				const current = prev[index];
				const next = prev[index + 1];
				const mergedId = `caption-${nextCaptionIdRef.current++}`;
				const mergedWords = [...current.words, ...next.words].map((word, wordIndex) => ({
					...word,
					id: `${mergedId}-word-${wordIndex + 1}`,
				}));
				const merged: CaptionRegion = {
					id: mergedId,
					startMs: current.startMs,
					endMs: next.endMs,
					text: `${current.text} ${next.text}`.trim(),
					words: mergedWords,
					source: current.source,
				};

				return [...prev.slice(0, index), merged, ...prev.slice(index + 2)];
			});
		},
		[updateCaptionSegments],
	);

	const handleTranscriptExport = useCallback(
		async (format: "srt" | "vtt" | "txt") => {
			if (!captionTrack || captionTrack.segments.length === 0 || !videoPath) {
				toast.info(
					t("editor.captions.noTranscriptToExport", "No transcript is available to export."),
				);
				return;
			}

			const result = await window.electronAPI.exportCaptionsTranscript({
				videoPath,
				format,
				track: captionTrack,
			});

			if (!result.success && result.canceled) {
				return;
			}

			if (!result.success) {
				toast.error(
					result.message || t("editor.captions.exportFailed", "Failed to export transcript."),
				);
				return;
			}

			toast.success(
				t("editor.captions.exported", "Transcript exported as {{format}}", {
					format: format.toUpperCase(),
				}),
			);
		},
		[captionTrack, t, videoPath],
	);

	const handleCancelCaptionGeneration = useCallback(async () => {
		await window.electronAPI.cancelCaptionGeneration();
		setIsTranscribing(false);
		setCaptionGenerationProgress(null);
		toast.info(t("editor.captions.cancelled", "Caption generation cancelled"));
	}, [t]);

	const handleAnnotationPositionChange = useCallback(
		(id: string, position: { x: number; y: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, position } : region)),
			);
		},
		[],
	);

	const handleAnnotationSizeChange = useCallback(
		(id: string, size: { width: number; height: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, size } : region)),
			);
		},
		[],
	);

	// Global Tab prevention
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isEditableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			const usesPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();

			if (usesPrimaryModifier && !e.altKey && key === "z") {
				if (!isEditableTarget) {
					e.preventDefault();
					if (e.shiftKey) {
						handleRedo();
					} else {
						handleUndo();
					}
				}
				return;
			}

			if (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && key === "y") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleRedo();
				}
				return;
			}

			if (e.key === "Tab") {
				// Allow tab only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				// Allow space only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [shortcuts, isMac, handleUndo, handleRedo]);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions]);

	useEffect(() => {
		if (selectedTrimId && !trimRegions.some((region) => region.id === selectedTrimId)) {
			setSelectedTrimId(null);
		}
	}, [selectedTrimId, trimRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedSpeedId && !speedRegions.some((region) => region.id === selectedSpeedId)) {
			setSelectedSpeedId(null);
		}
	}, [selectedSpeedId, speedRegions]);

	useEffect(() => {
		if (selectedAudioId && !audioRegions.some((region) => region.id === selectedAudioId)) {
			setSelectedAudioId(null);
		}
	}, [selectedAudioId, audioRegions]);

	useEffect(() => {
		void syncAudioAvailability(audioRegions);
	}, [audioRegions, syncAudioAvailability]);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const entries = await Promise.all(
				audioRegions.map(
					async (region) => [region.id, await resolveAudioSourceUrl(region)] as const,
				),
			);
			if (cancelled) {
				return;
			}

			setResolvedAudioSourceUrls(
				Object.fromEntries(
					entries.filter(
						(entry): entry is readonly [string, string] => typeof entry[1] === "string",
					),
				),
			);
		})();

		return () => {
			cancelled = true;
		};
	}, [audioRegions]);

	// Audio playback sync: manage Audio elements that play in sync with video
	const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

	useEffect(() => {
		const existing = audioElementsRef.current;
		const currentIds = new Set(audioRegions.map((r) => r.id));

		// Remove old audio elements
		for (const [id, audio] of existing) {
			if (!currentIds.has(id)) {
				audio.pause();
				audio.src = "";
				existing.delete(id);
			}
		}

		// Create/update audio elements
		for (const region of audioRegions) {
			let audio = existing.get(region.id);
			if (!audio) {
				audio = new Audio();
				audio.preload = "auto";
				existing.set(region.id, audio);
			}

			const expectedSrc = missingAudioPathsById[region.id]
				? ""
				: (resolvedAudioSourceUrls[region.id] ?? "");
			if (audio.src !== expectedSrc) {
				audio.pause();
				audio.src = expectedSrc;
			}
			audio.volume = Math.max(0, Math.min(1, region.volume));
		}

		return () => {
			for (const audio of existing.values()) {
				audio.pause();
				audio.src = "";
			}
			existing.clear();
		};
	}, [audioRegions, missingAudioPathsById, resolvedAudioSourceUrls]);

	// Sync audio playback with video currentTime and isPlaying state
	useEffect(() => {
		for (const region of audioRegions) {
			const audio = audioElementsRef.current.get(region.id);
			if (!audio) continue;

			const currentTimeMs = currentTime * 1000;
			const isInRegion = currentTimeMs >= region.startMs && currentTimeMs < region.endMs;
			audio.volume = Math.max(
				0,
				Math.min(1, region.volume * getAudioRegionFadeMultiplier(region, currentTimeMs)),
			);

			if (isPlaying && isInRegion && !missingAudioPathsById[region.id] && audio.src) {
				const audioOffset = getAudioPlaybackOffsetSeconds(region, currentTimeMs, audio.duration);
				// Only seek if significantly out of sync (> 200ms)
				if (Math.abs(audio.currentTime - audioOffset) > 0.2) {
					audio.currentTime = audioOffset;
				}
				const hasPlayableContent = region.loop || audioOffset < Math.max(0, audio.duration - 0.05);
				if (audio.paused && hasPlayableContent) {
					audio.play().catch(() => undefined);
				}
			} else {
				if (!audio.paused) {
					audio.pause();
				}
			}
		}
	}, [currentTime, audioRegions, isPlaying, missingAudioPathsById]);

	const showExportSuccessToast = useCallback((filePath: string) => {
		toast.success(`Exported successfully to ${filePath}`, {
			action: {
				label: "Show in Folder",
				onClick: async () => {
					try {
						const result = await window.electronAPI.revealInFolder(filePath);
						if (!result.success) {
							const errorMessage =
								result.error || result.message || "Failed to reveal item in folder.";
							toast.error(errorMessage);
						}
					} catch (err) {
						toast.error(`Error revealing in folder: ${String(err)}`);
					}
				},
			},
		});
	}, []);

	const buildDefaultExportSettings = useCallback((): ExportSettings | null => {
		const video = videoPlaybackRef.current?.video;
		if (!video) {
			toast.error("Video not ready");
			return null;
		}

		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const gifDimensions = calculateOutputDimensions(
			sourceWidth,
			sourceHeight,
			gifSizePreset,
			GIF_SIZE_PRESETS,
		);

		return {
			format: exportFormat,
			quality: exportFormat === "mp4" ? exportQuality : undefined,
			gifConfig:
				exportFormat === "gif"
					? {
							frameRate: gifFrameRate,
							loop: gifLoop,
							sizePreset: gifSizePreset,
							width: gifDimensions.width,
							height: gifDimensions.height,
						}
					: undefined,
		};
	}, [exportFormat, exportQuality, gifFrameRate, gifLoop, gifSizePreset]);

	const handleExport = useCallback(
		async (
			settings: ExportSettings,
			options: {
				saveMode?: "dialog" | "recordings";
				onSaved?: (filePath: string) => Promise<void> | void;
			} = {},
		) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video not ready");
				return;
			}

			setIsExporting(true);
			setExportProgress(null);
			setExportError(null);
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);

			let keepExportDialogOpen = false;
			const saveMode = options.saveMode ?? "dialog";

			try {
				const wasPlaying = isPlaying;
				const restoreTime = video.currentTime;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				const sourceWidth = video.videoWidth || 1920;
				const sourceHeight = video.videoHeight || 1080;
				const sourceAspectRatio = sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
				const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;

				if (settings.format === "gif" && settings.gifConfig) {
					// GIF Export
					const gifExporter = new GifExporter({
						videoUrl: videoPath,
						width: settings.gifConfig.width,
						height: settings.gifConfig.height,
						frameRate: settings.gifConfig.frameRate,
						loop: settings.gifConfig.loop,
						sizePreset: settings.gifConfig.sizePreset,
						wallpaper,
						trimRegions,
						speedRegions,
						showShadow: shadowIntensity > 0,
						shadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						connectZooms,
						borderRadius,
						padding,
						videoPadding: padding,
						cropRegion,
						annotationRegions,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						keyboardShortcutCallouts,
						showCursor,
						showKeyboardShortcuts,
						cursorSize,
						cursorSmoothing,
						cursorMotionBlur,
						cursorClickBounce,
						cursorSway,
						cursorPack,
						keyboardShortcutPosition,
						keyboardShortcutTheme,
						keyboardShortcutScale,
						keyboardShortcutOpacity,
						keyboardShortcutMaxVisible,
						previewWidth,
						previewHeight,
						webcamPath: resolvedWebcamPath,
						webcamRegion,
						showWebcam,
						mirrorWebcam,
						cameraSizeDuringZoom,
						cameraLayouts,
						captionRegions,
						captionSettings,
						onProgress: (progress: ExportProgress) => {
							setExportProgress(progress);
						},
					});

					exporterRef.current = gifExporter as unknown as VideoExporter;
					const result = await gifExporter.export();

					if (result.success && result.blob) {
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;

						const saveResult =
							saveMode === "recordings"
								? await window.electronAPI.saveExportedVideoToRecordings(arrayBuffer, fileName)
								: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

						if ("canceled" in saveResult && saveResult.canceled) {
							pendingExportSaveRef.current = { arrayBuffer, fileName };
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							await options.onSaved?.(saveResult.path);
						} else {
							setExportError(saveResult.message || "Failed to save GIF");
							toast.error(saveResult.message || "Failed to save GIF");
						}
					} else {
						setExportError(result.error || "GIF export failed");
						toast.error(result.error || "GIF export failed");
					}
				} else {
					// MP4 Export
					const quality = settings.quality || exportQuality;
					let exportWidth: number;
					let exportHeight: number;
					let bitrate: number;

					if (quality === "source") {
						// Use source resolution
						exportWidth = sourceWidth;
						exportHeight = sourceHeight;

						if (aspectRatio === "native") {
							exportWidth = Math.floor(sourceWidth / 2) * 2;
							exportHeight = Math.floor(sourceHeight / 2) * 2;
						} else if (aspectRatioValue === 1) {
							// Square (1:1): use smaller dimension to avoid codec limits
							const baseDimension = Math.floor(Math.min(sourceWidth, sourceHeight) / 2) * 2;
							exportWidth = baseDimension;
							exportHeight = baseDimension;
						} else if (aspectRatioValue > 1) {
							// Landscape: find largest even dimensions that exactly match aspect ratio
							const baseWidth = Math.floor(sourceWidth / 2) * 2;
							let found = false;
							for (let w = baseWidth; w >= 100 && !found; w -= 2) {
								const h = Math.round(w / aspectRatioValue);
								if (h % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
									exportWidth = w;
									exportHeight = h;
									found = true;
								}
							}
							if (!found) {
								exportWidth = baseWidth;
								exportHeight = Math.floor(baseWidth / aspectRatioValue / 2) * 2;
							}
						} else {
							// Portrait: find largest even dimensions that exactly match aspect ratio
							const baseHeight = Math.floor(sourceHeight / 2) * 2;
							let found = false;
							for (let h = baseHeight; h >= 100 && !found; h -= 2) {
								const w = Math.round(h * aspectRatioValue);
								if (w % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
									exportWidth = w;
									exportHeight = h;
									found = true;
								}
							}
							if (!found) {
								exportHeight = baseHeight;
								exportWidth = Math.floor((baseHeight * aspectRatioValue) / 2) * 2;
							}
						}

						// Calculate visually lossless bitrate matching screen recording optimization
						const totalPixels = exportWidth * exportHeight;
						bitrate = 30_000_000;
						if (totalPixels > 1920 * 1080 && totalPixels <= 2560 * 1440) {
							bitrate = 50_000_000;
						} else if (totalPixels > 2560 * 1440) {
							bitrate = 80_000_000;
						}
					} else {
						// Use quality-based target resolution
						const targetHeight = quality === "medium" ? 720 : 1080;

						// Calculate dimensions maintaining aspect ratio
						exportHeight = Math.floor(targetHeight / 2) * 2;
						exportWidth = Math.floor((exportHeight * aspectRatioValue) / 2) * 2;

						// Adjust bitrate for lower resolutions
						const totalPixels = exportWidth * exportHeight;
						if (totalPixels <= 1280 * 720) {
							bitrate = 10_000_000;
						} else if (totalPixels <= 1920 * 1080) {
							bitrate = 20_000_000;
						} else {
							bitrate = 30_000_000;
						}
					}

					const exporter = new VideoExporter({
						videoUrl: videoPath,
						width: exportWidth,
						height: exportHeight,
						frameRate: 60,
						bitrate,
						codec: "avc1.640033",
						wallpaper,
						trimRegions,
						speedRegions,
						showShadow: shadowIntensity > 0,
						shadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						connectZooms,
						borderRadius,
						padding,
						cropRegion,
						annotationRegions,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						keyboardShortcutCallouts,
						showCursor,
						showKeyboardShortcuts,
						cursorSize,
						cursorSmoothing,
						cursorMotionBlur,
						cursorClickBounce,
						cursorSway,
						cursorPack,
						keyboardShortcutPosition,
						keyboardShortcutTheme,
						keyboardShortcutScale,
						keyboardShortcutOpacity,
						keyboardShortcutMaxVisible,
						audioRegions,
						previewWidth,
						previewHeight,
						webcamPath: resolvedWebcamPath,
						webcamRegion,
						showWebcam,
						mirrorWebcam,
						cameraSizeDuringZoom,
						cameraLayouts,
						captionRegions,
						captionSettings,
						onProgress: (progress: ExportProgress) => {
							setExportProgress(progress);
						},
					});

					exporterRef.current = exporter;
					const result = await exporter.export();

					if (result.success && result.blob) {
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;

						const saveResult =
							saveMode === "recordings"
								? await window.electronAPI.saveExportedVideoToRecordings(arrayBuffer, fileName)
								: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

						if ("canceled" in saveResult && saveResult.canceled) {
							pendingExportSaveRef.current = { arrayBuffer, fileName };
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							await options.onSaved?.(saveResult.path);
						} else {
							setExportError(saveResult.message || "Failed to save video");
							toast.error(saveResult.message || "Failed to save video");
						}
					} else {
						setExportError(result.error || "Export failed");
						toast.error(result.error || "Export failed");
					}
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				} else {
					video.currentTime = restoreTime;
					await videoPlaybackRef.current?.refreshFrame();
				}
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				setExportError(errorMessage);
				toast.error(`Export failed: ${errorMessage}`);
			} finally {
				if (!isPlaying) {
					await videoPlaybackRef.current?.refreshFrame().catch(() => undefined);
				}
				setIsExporting(false);
				exporterRef.current = null;
				setShowExportDialog(keepExportDialogOpen);
				setExportProgress(null);
			}
		},
		[
			videoPath,
			wallpaper,
			trimRegions,
			speedRegions,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			connectZooms,
			showCursor,
			showKeyboardShortcuts,
			effectiveCursorTelemetry,
			keyboardShortcutCallouts,
			cursorSize,
			cursorSmoothing,
			cursorMotionBlur,
			cursorClickBounce,
			cursorSway,
			cursorPack,
			keyboardShortcutPosition,
			keyboardShortcutTheme,
			keyboardShortcutScale,
			keyboardShortcutOpacity,
			keyboardShortcutMaxVisible,
			audioRegions,
			borderRadius,
			padding,
			cropRegion,
			annotationRegions,
			isPlaying,
			aspectRatio,
			exportQuality,
			effectiveZoomRegions,
			showExportSuccessToast,
			resolvedWebcamPath,
			webcamRegion,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			cameraLayouts,
			captionRegions,
			captionSettings,
		],
	);

	const handleOpenExportDialog = useCallback(() => {
		if (!videoPath) {
			toast.error("No video loaded");
			return;
		}

		if (hasPendingExportSave) {
			setShowExportDialog(true);
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			return;
		}

		const settings = buildDefaultExportSettings();
		if (!settings) {
			return;
		}

		setShowExportDialog(true);
		setExportError(null);

		// Start export immediately
		handleExport(settings);
	}, [videoPath, hasPendingExportSave, buildDefaultExportSettings, handleExport]);

	const handleExportToClipboard = useCallback(async () => {
		const settings = buildDefaultExportSettings();
		if (!settings) {
			return;
		}

		setShowQuickShare(false);
		setShowExportDialog(true);
		setExportError(null);
		await handleExport(settings, {
			saveMode: "recordings",
			onSaved: async (filePath) => {
				const copyResult = await window.electronAPI.copyTextToClipboard(filePath);
				if (copyResult.success) {
					toast.success("Saved locally and copied the file path to your clipboard.");
					return;
				}
				toast.error(copyResult.message || copyResult.error || "Failed to copy file path.");
			},
		});
	}, [buildDefaultExportSettings, handleExport]);

	const handleQuickShareSave = useCallback(() => {
		setShowQuickShare(false);
		handleOpenExportDialog();
	}, [handleOpenExportDialog]);

	const handleQuickShareEdit = useCallback(() => {
		setShowQuickShare(false);
	}, []);

	const cycleWorkspaceLayout = useCallback(() => {
		setWorkspaceLayout((current) => {
			if (current === "default") return "preview-focus";
			if (current === "preview-focus") return "timeline-focus";
			return "default";
		});
	}, []);

	const applyPreset = useCallback(
		(preset: EditorPreset) => {
			applyEditorControls(normalizeProjectEditor(preset.controls));
			toast.success(`Applied ${preset.name} preset.`);
		},
		[applyEditorControls],
	);

	const handleSavePreset = useCallback(() => {
		const input = window.prompt("Name this preset", "My preset");
		const name = input?.trim();
		if (!name) {
			return;
		}

		const preset: EditorPreset = {
			id: `preset-${Date.now()}`,
			name,
			controls: buildCurrentPresetControls(),
		};

		setCustomPresets((prev) => [...prev, preset]);
		toast.success(`Saved ${name} preset.`);
	}, [buildCurrentPresetControls]);

	const handleDeletePreset = useCallback((presetId: string) => {
		setCustomPresets((prev) => {
			const target = prev.find((preset) => preset.id === presetId);
			if (!target) {
				return prev;
			}

			if (!window.confirm(`Delete preset "${target.name}"?`)) {
				return prev;
			}

			toast.success(`Deleted ${target.name} preset.`);
			return prev.filter((preset) => preset.id !== presetId);
		});
	}, []);

	const handleDeleteProject = useCallback(async () => {
		const confirmDelete = window.confirm(
			[
				"Delete this ScreenMint project and any managed recording media?",
				"",
				"Imported files outside the ScreenMint recordings folder will be kept.",
			].join("\n"),
		);
		if (!confirmDelete) {
			return;
		}

		const result = await window.electronAPI.deleteProjectAndMedia({
			projectPath: currentProjectPath,
			videoPath: videoSourcePath,
			webcamPath,
		});

		if (!result.success) {
			toast.error(result.message || result.error || "Failed to delete the project.");
			return;
		}

		const deletedCount = result.deletedPaths?.length ?? 0;
		const skippedCount = result.skippedPaths?.length ?? 0;
		toast.success(
			deletedCount > 0
				? `Deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}.${
						skippedCount > 0
							? ` Kept ${skippedCount} external file${skippedCount === 1 ? "" : "s"}.`
							: ""
					}`
				: skippedCount > 0
					? `Removed this recording from the editor. Kept ${skippedCount} external file${
							skippedCount === 1 ? "" : "s"
						}.`
					: "Project removed.",
		);

		await window.electronAPI.switchToHud();
	}, [currentProjectPath, videoSourcePath, webcamPath]);

	useEffect(() => {
		if (loading || error || !videoPath || !postRecordingContext) {
			return;
		}

		if (
			(postRecordingContext.action === "export-save-file" ||
				postRecordingContext.action === "export-clipboard") &&
			duration <= 0
		) {
			return;
		}

		const contextKey = JSON.stringify(postRecordingContext);
		if (handledPostRecordingContextRef.current === contextKey) {
			return;
		}

		handledPostRecordingContextRef.current = contextKey;

		void (async () => {
			switch (postRecordingContext.action) {
				case "export-save-file":
					handleOpenExportDialog();
					break;
				case "export-clipboard":
					await handleExportToClipboard();
					break;
				case "export-share-link":
					setShowQuickShare(true);
					toast.info("Share links need a backend before they can be enabled.");
					break;
				case "create-project":
				default:
					if (postRecordingContext.openQuickShare) {
						setShowQuickShare(true);
					}
					break;
			}

			await window.electronAPI.clearPostRecordingContext();
			setPostRecordingContext(null);
		})();
	}, [
		duration,
		error,
		handleExportToClipboard,
		handleOpenExportDialog,
		loading,
		postRecordingContext,
		videoPath,
	]);

	const handleCancelExport = useCallback(() => {
		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			setShowExportDialog(false);
			setIsExporting(false);
			setExportProgress(null);
			setExportError(null);
			setExportedFilePath(undefined);
		}
	}, []);

	const handleExportDialogClose = useCallback(() => {
		setShowExportDialog(false);
		setExportedFilePath(undefined);
	}, []);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		const saveResult = await window.electronAPI.saveExportedVideo(
			pendingSave.arrayBuffer,
			pendingSave.fileName,
		);

		if ("canceled" in saveResult && saveResult.canceled) {
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			toast.info("Save canceled. You can try again.");
			return;
		}

		if (saveResult.success && saveResult.path) {
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);
			setExportError(null);
			setExportedFilePath(saveResult.path);
			showExportSuccessToast(saveResult.path);
			setShowExportDialog(false);
			return;
		}

		const errorMessage = saveResult.message || "Failed to save video";
		setExportError(errorMessage);
		toast.error(errorMessage);
	}, [showExportSuccessToast]);

	const openRecordingsFolder = useCallback(async () => {
		try {
			const result = await window.electronAPI.openRecordingsFolder();
			if (!result.success) {
				toast.error(result.message || result.error || "Failed to open recordings folder.");
			}
		} catch (error) {
			toast.error(`Failed to open recordings folder: ${String(error)}`);
		}
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0b]">
				<div
					className="flex flex-col items-center gap-5"
					style={{
						animation: "editor-loading-enter 0.5s cubic-bezier(0.16,1,0.3,1) both",
					}}
				>
					{/* Pulsing ring loader */}
					<div className="relative flex items-center justify-center w-14 h-14">
						<div
							className="absolute inset-0 rounded-full border-2 border-white/[0.06]"
							style={{
								animation: "editor-ring-pulse 2s ease-in-out infinite",
							}}
						/>
						<div
							className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/30"
							style={{
								animation: "editor-ring-spin 1s linear infinite",
							}}
						/>
						<img
							src="/app-icons/screenmint-64.png"
							alt="ScreenMint"
							className="h-8 w-8 rounded-lg"
						/>
					</div>
					<div className="flex flex-col items-center gap-1.5">
						<span className="text-[13px] font-medium text-white/70">Preparing your video</span>
						<span className="text-[11px] text-white/25">This will only take a moment</span>
					</div>
				</div>
				<style>
					{`
						@keyframes editor-loading-enter {
							from { opacity: 0; transform: scale(0.95); }
							to { opacity: 1; transform: scale(1); }
						}
						@keyframes editor-ring-spin {
							to { transform: rotate(360deg); }
						}
						@keyframes editor-ring-pulse {
							0%, 100% { transform: scale(1); opacity: 0.5; }
							50% { transform: scale(1.08); opacity: 1; }
						}
					`}
				</style>
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
				<div
					className="flex flex-col items-center gap-4"
					style={{
						animation: "editor-loading-enter 0.5s cubic-bezier(0.16,1,0.3,1) both",
					}}
				>
					<div className="text-red-400/80 text-sm">{error}</div>
					<button
						type="button"
						onClick={handleLoadProject}
						className="px-4 py-2 rounded-lg bg-white/[0.08] text-white/70 text-[13px] font-medium hover:bg-white/[0.12] hover:text-white/90 transition-all border border-white/[0.06]"
					>
						Load Project File
					</button>
				</div>
				<style>
					{`
						@keyframes editor-loading-enter {
							from { opacity: 0; transform: scale(0.95); }
							to { opacity: 1; transform: scale(1); }
						}
					`}
				</style>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-[#0c0c0f] text-slate-200 overflow-hidden selection:bg-[#f59e0b]/30">
			{/* Header Bar - matches Screen Studio reference */}
			<div
				className="relative h-11 flex-shrink-0 bg-[#111114] border-b border-white/5 flex items-center px-4 z-50"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				{/* Left: macOS traffic lights spacer + action icons */}
				<div
					className="flex items-center gap-0.5 ml-[72px]"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<button
						type="button"
						onClick={() => void handleSaveProject()}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
						title="Save Project"
					>
						<Save className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => void openRecordingsFolder()}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
						title="Open Recordings Folder"
					>
						<FolderOpen className="h-4 w-4" />
					</button>
					<button
						type="button"
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
						title="Keyboard Shortcuts"
						onClick={openConfig}
					>
						<Keyboard className="h-4 w-4" />
					</button>
					<button
						type="button"
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-400/80 hover:text-white cursor-pointer"
						title="Delete Project"
						onClick={() => void handleDeleteProject()}
					>
						<Trash2 className="h-4 w-4" />
					</button>
				</div>

				{/* Center: Project filename */}
				<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
					<span className="text-[13px] font-medium text-white/60 truncate max-w-[400px]">
						{currentProjectPath
							? currentProjectPath
									.split(/[\\/]/)
									.pop()
									?.replace(/\.[^.]+$/, "") || "Untitled"
							: videoSourcePath
								? videoSourcePath
										.split(/[\\/]/)
										.pop()
										?.replace(/\.[^.]+$/, "") || "Untitled"
								: "ScreenMint"}
					</span>
				</div>

				{/* Right: Undo/Redo, Presets, Layout, Settings, Export */}
				<div
					className="ml-auto flex items-center gap-0.5"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{/* Undo / Redo */}
					<button
						type="button"
						onClick={handleUndo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						title="Undo (⌘Z)"
						disabled={historyPastRef.current.length === 0}
					>
						<Undo2 className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={handleRedo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
						title="Redo (⌘⇧Z)"
						disabled={historyFutureRef.current.length === 0}
					>
						<Redo2 className="h-4 w-4" />
					</button>

					<div className="w-[1px] h-5 bg-white/10 mx-1" />

					{/* Presets dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-slate-300 transition hover:bg-white/8 hover:text-white cursor-pointer"
							>
								<Sparkles className="h-3.5 w-3.5" />
								<span className="text-xs font-medium">Presets</span>
								<ChevronDown className="h-3 w-3 text-slate-500" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10 min-w-[160px]">
							<DropdownMenuLabel className="text-[11px] font-medium text-white/45">
								Apply preset
							</DropdownMenuLabel>
							{allPresets.map((preset) => (
								<DropdownMenuItem
									key={preset.id}
									onSelect={() => applyPreset(preset)}
									className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
								>
									{preset.name}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator className="bg-white/10" />
							<DropdownMenuItem
								onSelect={handleSavePreset}
								className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
							>
								Save current as preset...
							</DropdownMenuItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger
									disabled={customPresets.length === 0}
									className="text-slate-300"
								>
									Delete preset
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="min-w-[180px] border-white/10 bg-[#1a1a1a]">
									{customPresets.length === 0 ? (
										<DropdownMenuItem disabled className="text-slate-500">
											No saved presets
										</DropdownMenuItem>
									) : (
										customPresets.map((preset) => (
											<DropdownMenuItem
												key={`delete-${preset.id}`}
												onSelect={() => handleDeletePreset(preset.id)}
												className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
											>
												{preset.name}
											</DropdownMenuItem>
										))
									)}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Layout toggle */}
					<button
						type="button"
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
						title="Toggle Layout"
						onClick={cycleWorkspaceLayout}
					>
						<SplitSquareHorizontal className="h-4 w-4" />
					</button>

					{/* Language Switcher */}
					<LanguageSwitcher />

					<div className="w-[1px] h-5 bg-white/10 mx-1" />

					{/* Export button - amber */}
					<button
						type="button"
						onClick={() => setShowExportSettings(true)}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-white font-semibold text-xs transition bg-[#f59e0b] hover:bg-[#d97706] cursor-pointer shadow-lg shadow-amber-500/20"
						title="Export"
					>
						<Download className="h-3.5 w-3.5" />
						<span>Export</span>
					</button>
				</div>
			</div>

			<PanelGroup ref={panelGroupRef} direction="vertical" className="flex-1 min-h-0">
				{/* Top section: Video preview + Settings sidebar */}
				<Panel defaultSize={65} minSize={35}>
					<div className="flex h-full pb-0 gap-3 pr-3 pl-3 pt-3">
						{/* Video preview area */}
						<div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl">
							{missingWebcamPath && (
								<div className="mx-3 mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
									<div className="flex items-center justify-between gap-3">
										<div className="min-w-0">
											<div className="font-semibold text-amber-50">
												{t("settings.webcam.missingTitle", "Webcam source missing")}
											</div>
											<div className="mt-1 truncate text-amber-100/80">{missingWebcamPath}</div>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											<button
												type="button"
												onClick={() => void handleRelinkMissingWebcam()}
												className="rounded-md border border-amber-300/30 bg-amber-300/15 px-2.5 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-300/25"
											>
												{t("settings.webcam.relink", "Relink webcam")}
											</button>
											<button
												type="button"
												onClick={() => void handleRemoveWebcamFromProject()}
												className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
											>
												{t("settings.webcam.remove", "Remove webcam")}
											</button>
										</div>
									</div>
								</div>
							)}
							<div className="relative w-full h-full">
								<VideoPlayback
									key={videoPath || "no-video"}
									aspectRatio={aspectRatio}
									ref={videoPlaybackRef}
									videoPath={videoPath || ""}
									onDurationChange={setDuration}
									onTimeUpdate={setCurrentTime}
									currentTime={currentTime}
									onPlayStateChange={setIsPlaying}
									onError={setError}
									wallpaper={wallpaper}
									zoomRegions={effectiveZoomRegions}
									selectedZoomId={selectedZoomId}
									onSelectZoom={handleSelectZoom}
									onZoomFocusChange={handleZoomFocusChange}
									isPlaying={isPlaying}
									showShadow={shadowIntensity > 0}
									shadowIntensity={shadowIntensity}
									backgroundBlur={backgroundBlur}
									zoomMotionBlur={zoomMotionBlur}
									connectZooms={connectZooms}
									borderRadius={borderRadius}
									padding={padding}
									cropRegion={cropRegion}
									trimRegions={trimRegions}
									speedRegions={speedRegions}
									annotationRegions={annotationRegions}
									selectedAnnotationId={selectedAnnotationId}
									onSelectAnnotation={handleSelectAnnotation}
									onAnnotationPositionChange={handleAnnotationPositionChange}
									onAnnotationSizeChange={handleAnnotationSizeChange}
									cursorTelemetry={effectiveCursorTelemetry}
									keyboardShortcutCallouts={keyboardShortcutCallouts}
									showKeyboardShortcuts={showKeyboardShortcuts}
									keyboardShortcutPosition={keyboardShortcutPosition}
									keyboardShortcutTheme={keyboardShortcutTheme}
									keyboardShortcutScale={keyboardShortcutScale}
									keyboardShortcutOpacity={keyboardShortcutOpacity}
									keyboardShortcutMaxVisible={keyboardShortcutMaxVisible}
									showCursor={showCursor}
									cursorSize={cursorSize}
									cursorSmoothing={cursorSmoothing}
									cursorMotionBlur={cursorMotionBlur}
									cursorClickBounce={cursorClickBounce}
									cursorSway={cursorSway}
									cursorPack={cursorPack}
									webcamPath={resolvedWebcamPath}
									webcamRegion={webcamRegion}
									showWebcam={showWebcam}
									mirrorWebcam={mirrorWebcam}
									cameraSizeDuringZoom={cameraSizeDuringZoom}
									cameraLayouts={cameraLayouts}
									onWebcamPositionChange={handleWebcamPositionChange}
									onWebcamSizeChange={handleWebcamSizeChange}
									webcamSelected={webcamSelected}
									selectedCameraLayoutId={selectedCameraLayoutId}
									onSelectWebcam={handleSelectWebcam}
									captionRegions={captionRegions}
									captionSettings={captionSettings}
								/>
							</div>
						</div>

						{/* Right section: settings sidebar */}
						<SettingsPanel
							selected={wallpaper}
							onWallpaperChange={setWallpaper}
							selectedZoomDepth={
								selectedZoomId ? zoomRegions.find((z) => z.id === selectedZoomId)?.depth : null
							}
							onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
							selectedZoomId={selectedZoomId}
							onZoomDelete={handleZoomDelete}
							selectedTrimId={selectedTrimId}
							onTrimDelete={handleTrimDelete}
							shadowIntensity={shadowIntensity}
							onShadowChange={setShadowIntensity}
							backgroundBlur={backgroundBlur}
							onBackgroundBlurChange={setBackgroundBlur}
							zoomMotionBlur={zoomMotionBlur}
							onZoomMotionBlurChange={setZoomMotionBlur}
							connectZooms={connectZooms}
							onConnectZoomsChange={setConnectZooms}
							showCursor={showCursor}
							onShowCursorChange={setShowCursor}
							loopCursor={loopCursor}
							onLoopCursorChange={setLoopCursor}
							cursorSize={cursorSize}
							onCursorSizeChange={setCursorSize}
							cursorSmoothing={cursorSmoothing}
							onCursorSmoothingChange={setCursorSmoothing}
							cursorMotionBlur={cursorMotionBlur}
							onCursorMotionBlurChange={setCursorMotionBlur}
							cursorClickBounce={cursorClickBounce}
							onCursorClickBounceChange={setCursorClickBounce}
							cursorSway={cursorSway}
							onCursorSwayChange={setCursorSway}
							cursorStyle={cursorStyle}
							onCursorStyleChange={setCursorStyle}
							cursorPack={cursorPack}
							onCursorPackChange={setCursorPack}
							cursorColor={cursorColor}
							onCursorColorChange={setCursorColor}
							cursorOpacity={cursorOpacity}
							onCursorOpacityChange={setCursorOpacity}
							clickHighlightColor={clickHighlightColor}
							onClickHighlightColorChange={setClickHighlightColor}
							clickHighlightSize={clickHighlightSize}
							onClickHighlightSizeChange={setClickHighlightSize}
							clickHighlightOpacity={clickHighlightOpacity}
							onClickHighlightOpacityChange={setClickHighlightOpacity}
							cursorTrailLength={cursorTrailLength}
							onCursorTrailLengthChange={setCursorTrailLength}
							cursorTrailOpacity={cursorTrailOpacity}
							onCursorTrailOpacityChange={setCursorTrailOpacity}
							showKeyboardShortcuts={showKeyboardShortcuts}
							onShowKeyboardShortcutsChange={setShowKeyboardShortcuts}
							keyboardShortcutPosition={keyboardShortcutPosition}
							onKeyboardShortcutPositionChange={setKeyboardShortcutPosition}
							keyboardShortcutTheme={keyboardShortcutTheme}
							onKeyboardShortcutThemeChange={setKeyboardShortcutTheme}
							keyboardShortcutScale={keyboardShortcutScale}
							onKeyboardShortcutScaleChange={setKeyboardShortcutScale}
							keyboardShortcutOpacity={keyboardShortcutOpacity}
							onKeyboardShortcutOpacityChange={setKeyboardShortcutOpacity}
							keyboardShortcutDisplayMs={keyboardShortcutDisplayMs}
							onKeyboardShortcutDisplayMsChange={setKeyboardShortcutDisplayMs}
							keyboardShortcutMaxVisible={keyboardShortcutMaxVisible}
							onKeyboardShortcutMaxVisibleChange={setKeyboardShortcutMaxVisible}
							borderRadius={borderRadius}
							onBorderRadiusChange={setBorderRadius}
							padding={padding}
							onPaddingChange={setPadding}
							cropRegion={cropRegion}
							onCropChange={setCropRegion}
							aspectRatio={aspectRatio}
							onAspectRatioChange={setAspectRatio}
							videoElement={videoPlaybackRef.current?.video || null}
							selectedAnnotationId={selectedAnnotationId}
							annotationRegions={annotationRegions}
							onAnnotationContentChange={handleAnnotationContentChange}
							onAnnotationTypeChange={handleAnnotationTypeChange}
							onAnnotationStyleChange={handleAnnotationStyleChange}
							onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
							onAnnotationBlurDataChange={handleAnnotationBlurDataChange}
							onAnnotationDelete={handleAnnotationDelete}
							webcamPath={webcamPath}
							webcamMissing={Boolean(missingWebcamPath)}
							missingWebcamPath={missingWebcamPath}
							showWebcam={showWebcam}
							mirrorWebcam={mirrorWebcam}
							cameraSizeDuringZoom={cameraSizeDuringZoom}
							onShowWebcamChange={setShowWebcam}
							webcamRegion={webcamRegion}
							onWebcamRegionChange={handleWebcamRegionChange}
							onResetRecommendedWebcam={handleResetRecommendedWebcam}
							onResetSelectedCameraLayout={handleResetSelectedCameraLayout}
							onRelinkMissingWebcam={() => void handleRelinkMissingWebcam()}
							onRemoveMissingWebcam={() => void handleRemoveWebcamFromProject()}
							onMirrorWebcamChange={setMirrorWebcam}
							selectedCameraLayoutId={selectedCameraLayoutId}
							cameraLayouts={cameraLayouts}
							onCameraLayoutChange={handleCameraLayoutChange}
							cameraSelected={webcamSelected}
							onCameraSizeDuringZoomChange={setCameraSizeDuringZoom}
							selectedSpeedId={selectedSpeedId}
							selectedSpeedValue={
								selectedSpeedId
									? (speedRegions.find((r) => r.id === selectedSpeedId)?.speed ?? null)
									: null
							}
							onSpeedChange={handleSpeedChange}
							onSpeedDelete={handleSpeedDelete}
							audioRegions={audioRegions}
							selectedAudioId={selectedAudioId}
							onAudioAddAtPlayhead={handleAudioAdded}
							onReplaceSelectedAudio={handleReplaceSelectedAudioSource}
							onAudioVolumeChange={handleAudioVolumeChange}
							onAudioFadeChange={handleAudioFadeChange}
							onAudioLoopChange={handleAudioLoopChange}
							onAudioDelete={handleAudioDelete}
							missingAudioPath={missingSelectedAudioPath}
							onRelinkMissingAudio={handleRelinkMissingAudio}
							onRemoveMissingAudio={handleRemoveMissingAudio}
							captionRegions={captionRegions}
							captionGenerationOptions={captionGenerationOptions}
							captionGenerationProgress={captionGenerationProgress}
							captionModelStatus={captionModelStatus}
							captionSettings={captionSettings}
							selectedCaptionId={selectedCaptionId}
							onSelectCaption={setSelectedCaptionId}
							onCaptionTextChange={handleCaptionTextChange}
							onCaptionDelete={handleCaptionDelete}
							onDeleteAllCaptions={handleDeleteAllCaptions}
							onCaptionSplit={handleCaptionSplit}
							onCaptionMergeNext={handleCaptionMergeNext}
							onCaptionStylePresetChange={handleCaptionStylePresetChange}
							onCaptionSettingsChange={handleCaptionSettingsChange}
							onCaptionStyleChange={handleCaptionStyleChange}
							onCaptionGenerationOptionsChange={handleCaptionGenerationOptionsChange}
							onCaptionExport={handleTranscriptExport}
							isTranscribing={isTranscribing}
							onAutoTranscribe={handleAutoTranscribe}
							onCancelCaptionGeneration={handleCancelCaptionGeneration}
						/>
					</div>
				</Panel>

				<PanelResizeHandle className="h-3 bg-[#0c0c0f]/80 hover:bg-[#0c0c0f] transition-colors flex items-center justify-center mx-4">
					<div className="w-8 h-1 bg-white/20 rounded-full"></div>
				</PanelResizeHandle>

				{/* Full-width Timeline section */}
				<Panel defaultSize={35} minSize={15}>
					<div className="h-full min-h-0 mx-4 mb-4 bg-[#0c0c0f] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
						<TimelineEditor
							videoDuration={duration}
							currentTime={currentTime}
							onSeek={handleSeek}
							cursorTelemetry={effectiveCursorTelemetry}
							zoomRegions={effectiveZoomRegions}
							onZoomAdded={handleZoomAdded}
							onZoomSuggested={handleZoomSuggested}
							onZoomSpanChange={handleZoomSpanChange}
							onZoomDelete={handleZoomDelete}
							selectedZoomId={selectedZoomId}
							onSelectZoom={handleSelectZoom}
							trimRegions={trimRegions}
							cutPoints={cutPoints}
							onSplitClip={handleSplitClip}
							onDeleteSegment={handleDeleteSegment}
							onTrimAdded={handleTrimAdded}
							onTrimSpanChange={handleTrimSpanChange}
							onTrimDelete={handleTrimDelete}
							selectedTrimId={selectedTrimId}
							onSelectTrim={handleSelectTrim}
							speedRegions={speedRegions}
							onSpeedAdded={handleSpeedAdded}
							onSpeedSpanChange={handleSpeedSpanChange}
							onSpeedDelete={handleSpeedDelete}
							selectedSpeedId={selectedSpeedId}
							onSelectSpeed={handleSelectSpeed}
							audioRegions={audioRegions}
							onAudioAdded={handleAudioAdded}
							onAudioSpanChange={handleAudioSpanChange}
							onAudioDelete={handleAudioDelete}
							selectedAudioId={selectedAudioId}
							onSelectAudio={handleSelectAudio}
							annotationRegions={annotationRegions}
							onAnnotationAdded={handleAnnotationAdded}
							onAnnotationSpanChange={handleAnnotationSpanChange}
							onAnnotationDelete={handleAnnotationDelete}
							selectedAnnotationId={selectedAnnotationId}
							onSelectAnnotation={handleSelectAnnotation}
							cameraLayouts={cameraLayouts}
							onCameraLayoutAdded={handleCameraLayoutAdded}
							onCameraLayoutSpanChange={handleCameraLayoutSpanChange}
							onCameraLayoutDelete={handleCameraLayoutDelete}
							selectedCameraLayoutId={selectedCameraLayoutId}
							onSelectCameraLayout={handleSelectCameraLayout}
							captionRegions={captionRegions}
							onCaptionAdded={handleCaptionAdded}
							onCaptionSpanChange={handleCaptionSpanChange}
							onCaptionDelete={handleCaptionDelete}
							selectedCaptionId={selectedCaptionId}
							onSelectCaption={setSelectedCaptionId}
							aspectRatio={aspectRatio}
							onAspectRatioChange={setAspectRatio}
							isPlaying={isPlaying}
							onTogglePlayPause={togglePlayPause}
							onSkipBack={() => handleSeek(Math.max(0, currentTime - 5))}
							onSkipForward={() => handleSeek(Math.min(duration, currentTime + 5))}
							playbackSpeed={DEFAULT_PLAYBACK_SPEED}
						/>
					</div>
				</Panel>
			</PanelGroup>

			<Toaster theme="dark" className="pointer-events-auto" />

			<ExportSettingsDialog
				isOpen={showExportSettings}
				onClose={() => setShowExportSettings(false)}
				exportFormat={exportFormat}
				onExportFormatChange={setExportFormat}
				exportQuality={exportQuality}
				onExportQualityChange={setExportQuality}
				gifFrameRate={gifFrameRate}
				onGifFrameRateChange={setGifFrameRate}
				gifLoop={gifLoop}
				onGifLoopChange={setGifLoop}
				gifSizePreset={gifSizePreset}
				onGifSizePresetChange={setGifSizePreset}
				gifOutputDimensions={calculateOutputDimensions(
					videoPlaybackRef.current?.video?.videoWidth || 1920,
					videoPlaybackRef.current?.video?.videoHeight || 1080,
					gifSizePreset,
					GIF_SIZE_PRESETS,
				)}
				onSaveProject={handleSaveProject}
				onLoadProject={handleLoadProject}
				onExport={handleOpenExportDialog}
			/>

			<ExportDialog
				isOpen={showExportDialog}
				onClose={handleExportDialogClose}
				progress={exportProgress}
				isExporting={isExporting}
				error={exportError}
				onCancel={handleCancelExport}
				onRetrySave={handleRetrySaveExport}
				canRetrySave={hasPendingExportSave}
				exportFormat={exportFormat}
				exportedFilePath={exportedFilePath}
			/>

			<QuickShareDialog
				isOpen={showQuickShare}
				onClose={() => setShowQuickShare(false)}
				onSave={handleQuickShareSave}
				onCopy={() => void handleExportToClipboard()}
				onEdit={handleQuickShareEdit}
				shareDisabledReason="Share links need a backend before they can be enabled."
			/>
		</div>
	);
}
