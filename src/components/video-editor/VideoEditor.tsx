import type { Span } from "dnd-timeline";
import {
	Check,
	ChevronDown,
	Download,
	FolderOpen,
	Keyboard,
	Languages,
	Pencil,
	Redo2,
	Save,
	Sparkles,
	SplitSquareHorizontal,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
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
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { type AppLocale, SUPPORTED_LOCALES } from "@/i18n/config";
import { getBackgroundMusicAssetById } from "@/lib/backgroundMusic";
import {
	type ExportDestination,
	type ExportDetails,
	type ExportFormat,
	type ExportSettings,
	type ExportV2Destination,
	type ExportV2StartRequest,
	type GifExportConfig,
	GifExporter,
	resolveGifExportPlan,
	resolveVideoExportPlan,
	StreamingVideoDecoder,
	selectExportV2Engine,
	type VideoExportSettings,
} from "@/lib/exporter";
import { VideoExporter } from "@/lib/exporter/videoExporter";
import {
	deriveVideoNameFromPath,
	ensureFileExtension,
	normalizeVideoDisplayName,
} from "@/lib/fileNames";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { loadAudioSelectionDurationMs } from "./audioRegionUtils";
import { ConfirmActionDialog, PresetNameDialog } from "./EditorDialogs";
import { ExportDialog } from "./ExportDialog";
import { ExportSettingsDialog } from "./ExportSettingsDialog";
import {
	cloneEditorHistorySnapshot,
	type EditorHistorySnapshot,
	useEditorHistory,
} from "./editorHistory";
import { editorPersistenceService } from "./editorPersistenceService";
import {
	DEFAULT_EDITOR_PREFERENCES,
	type EditorPreset,
	type EditorWorkspaceLayout,
} from "./editorPreferences";
import { editorPreferencesService } from "./editorPreferencesService";
import { createInitialEditorSessionState, editorSessionReducer } from "./editorSession";
import { createExportProgressThrottler } from "./exportProgressThrottler";
import {
	buildSourceVideoMetadata,
	mergeGifExportDetails,
	mergeVideoExportDetails,
	resolveSourceFrameRate,
} from "./exportUtils";
import { getLegacyShadowIntensityFromFrameShadow } from "./frameEffects";
import { deriveKeyboardShortcutCallouts } from "./keyboardShortcuts";
import {
	type PostRecordingAutoZoomBootstrapState,
	resolvePostRecordingAutoZoomDecision,
} from "./postRecordingAutoZoomUtils";
import {
	DEFAULT_VIDEO_PREVIEW_PADDING,
	deriveNextId,
	fromFileUrl,
	normalizeProjectEditor,
	normalizeWebcamSessionMetadata,
	toFileUrl,
	validateProjectData,
} from "./projectPersistence";
import { QuickShareDialog } from "./QuickShareDialog";
import SettingsPanel from "./SettingsPanel";
import TimelineEditor from "./timeline/TimelineEditor";
import { buildAutoZoomSuggestions, normalizeCursorTelemetry } from "./timeline/zoomSuggestionUtils";
import {
	type AnnotationRegion,
	type AudioRegion,
	type AudioTrackSelection,
	type BlurData,
	type CameraLayoutRegion,
	type CaptionGenerationOptions,
	type CaptionGenerationProgress,
	type CaptionModelStatus,
	type CaptionSettings,
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
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CAPTION_SETTINGS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	DEFAULT_FIGURE_DATA,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_WEBCAM_HEALTH_METRICS,
	DEFAULT_WEBCAM_PREVIEW_MODE,
	DEFAULT_ZOOM_DEPTH,
	DEFAULT_ZOOM_MODE,
	type FigureData,
	getRecommendedWebcamDefaults,
	type KeyboardPlatform,
	type KeyboardTelemetrySample,
	type PlaybackSpeed,
	type PreviewQuality,
	type SpeedRegion,
	type TrimRegion,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamPreviewMode,
	type WebcamRegion,
	type WebcamSessionMetadata,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomRegion,
} from "./types";
import { useDefaultExportSettings } from "./useDefaultExportSettings";
import { usePostRecordingActions } from "./usePostRecordingActions";
import { useSourceVideoMetadata } from "./useSourceVideoMetadata";
import { useTimelineSelectionPruning } from "./useTimelineSelectionPruning";
import { useVideoEditorAudioPreview } from "./useVideoEditorAudioPreview";
import { useVideoEditorCaptions } from "./useVideoEditorCaptions";
import { type PendingExportSave, useVideoEditorExportActions } from "./useVideoEditorExportActions";
import { useVideoEditorKeyboardShortcuts } from "./useVideoEditorKeyboardShortcuts";
import { useVideoEditorMediaAvailability } from "./useVideoEditorMediaAvailability";
import { useVideoEditorProjectActions } from "./useVideoEditorProjectActions";
import { useVideoEditorProjectFileActions } from "./useVideoEditorProjectFileActions";
import { useVideoNameEditing } from "./useVideoNameEditing";
import { VideoEditorSkeleton } from "./VideoEditorSkeleton";
import VideoPlayback from "./VideoPlayback";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";
import {
	buildCursorSimulationPath,
	evaluateCursorMotionSnapshot,
} from "./videoPlayback/cursorSimulation";
import { composeCropRegions, deriveLegacyCaptureCorrectionCrop } from "./videoPlayback/layoutUtils";
import type { VideoPlaybackRef } from "./videoPlayback/playbackTypes";
import { resolveZoomRegionFocus } from "./videoPlayback/smartZoomController";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";
import { applyWebcamStylePreset, normalizeWebcamEffects } from "./webcamEffects";
import { normalizeWebcamRegion } from "./webcamRegionUtils";

const LOOP_CURSOR_END_WINDOW_MS = 670;

function getWorkspaceLayoutSizes(layout: EditorWorkspaceLayout): [number, number] {
	if (layout === "preview-focus") {
		return [80, 20];
	}

	if (layout === "timeline-focus") {
		return [42, 58];
	}

	return [65, 35];
}

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
	const tSettings = useScopedT("settings");
	// Editor control values (wallpaper, cursor, frame, export, etc.) always start
	// from defaults for every new session. The only settings we restore from
	// localStorage are genuine app-level prefs (preview quality, custom aspect inputs,
	// custom wallpaper library) and the user's saved presets.
	// Users can re-apply a preset to bring back their preferred settings.
	const initialEditorPreferences = useMemo(() => {
		const stored = editorPreferencesService.load();
		const recommendedWebcamDefaults = getRecommendedWebcamDefaults(
			DEFAULT_EDITOR_PREFERENCES.aspectRatio,
		);
		return {
			...DEFAULT_EDITOR_PREFERENCES,
			webcamRegion: recommendedWebcamDefaults.region,
			webcamEffects: recommendedWebcamDefaults.effects,
			showWebcam: recommendedWebcamDefaults.showWebcam,
			mirrorWebcam: recommendedWebcamDefaults.mirrorWebcam,
			cameraSizeDuringZoom: recommendedWebcamDefaults.cameraSizeDuringZoom,
			previewQuality: stored.previewQuality,
			webcamPreviewMode: stored.webcamPreviewMode,
			workspaceLayout: DEFAULT_EDITOR_PREFERENCES.workspaceLayout,
			customAspectWidth: stored.customAspectWidth,
			customAspectHeight: stored.customAspectHeight,
			customWallpapers: stored.customWallpapers,
			presets: stored.presets,
		};
	}, []);
	const [sessionState, dispatchSession] = useReducer(
		editorSessionReducer,
		undefined,
		createInitialEditorSessionState,
	);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const {
		videoName,
		setVideoName,
		draftVideoName,
		setDraftVideoName,
		isEditingVideoName,
		setIsEditingVideoName,
		videoNameInputRef,
		startVideoNameEdit,
		commitVideoNameEdit,
		cancelVideoNameEdit,
		handleVideoNameInputBlur,
		handleVideoNameInputKeyDown,
	} = useVideoNameEditing("Untitled");
	const [videoHasAudio, setVideoHasAudio] = useState(false);
	const [clipVolume, setClipVolume] = useState(1);
	const [loading, setLoading] = useState(true);
	const [skeletonVisible, setSkeletonVisible] = useState(true);
	const [editorReady, setEditorReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [wallpaper, setWallpaper] = useState<string>(initialEditorPreferences.wallpaper);
	const [hideBackground, setHideBackground] = useState(initialEditorPreferences.hideBackground);
	const [frameShadowSize, setFrameShadowSize] = useState(initialEditorPreferences.frameShadowSize);
	const [frameShadowOpacity, setFrameShadowOpacity] = useState(
		initialEditorPreferences.frameShadowOpacity,
	);
	const [frameShadowBlur, setFrameShadowBlur] = useState(initialEditorPreferences.frameShadowBlur);
	const [backgroundBlur, setBackgroundBlur] = useState(initialEditorPreferences.backgroundBlur);
	const [zoomMotionBlur, setZoomMotionBlur] = useState(initialEditorPreferences.zoomMotionBlur);
	const [connectZooms, setConnectZooms] = useState(initialEditorPreferences.connectZooms);
	const [showCursor, setShowCursor] = useState(initialEditorPreferences.showCursor);
	const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(
		initialEditorPreferences.previewQuality,
	);
	const [webcamPreviewMode, setWebcamPreviewMode] = useState<WebcamPreviewMode>(
		initialEditorPreferences.webcamPreviewMode ?? DEFAULT_WEBCAM_PREVIEW_MODE,
	);
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
	const [cursorTypeMode, setCursorTypeMode] = useState(initialEditorPreferences.cursorTypeMode);
	const [cursorTilt, setCursorTilt] = useState(initialEditorPreferences.cursorTilt);
	const [hideWhenIdle, setHideWhenIdle] = useState(initialEditorPreferences.hideWhenIdle);
	const [idleHideDelayMs, setIdleHideDelayMs] = useState(initialEditorPreferences.idleHideDelayMs);
	const [smoothMovementEnabled, setSmoothMovementEnabled] = useState(
		initialEditorPreferences.smoothMovementEnabled,
	);
	const [cursorMovementStyle, setCursorMovementStyle] = useState(
		initialEditorPreferences.cursorMovementStyle,
	);
	const [cursorSpring, setCursorSpring] = useState(initialEditorPreferences.cursorSpring);
	const [cameraSpring, setCameraSpring] = useState(
		initialEditorPreferences.cameraSpring ?? DEFAULT_CAMERA_SPRING,
	);
	const [highQualitySvgCursors, setHighQualitySvgCursors] = useState(
		initialEditorPreferences.highQualitySvgCursors,
	);
	const [cursorColor, setCursorColor] = useState(initialEditorPreferences.cursorColor);
	const [cursorOpacity, setCursorOpacity] = useState(initialEditorPreferences.cursorOpacity);
	const [clickEffectsEnabled, setClickEffectsEnabled] = useState(
		initialEditorPreferences.clickEffectsEnabled,
	);
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
	const [deviceMockup, setDeviceMockup] = useState(initialEditorPreferences.deviceMockup);
	const [frameBorderEnabled, setFrameBorderEnabled] = useState(
		initialEditorPreferences.frameBorderEnabled,
	);
	const [frameBorderWidth, setFrameBorderWidth] = useState(
		initialEditorPreferences.frameBorderWidth,
	);
	const [frameBorderColor, setFrameBorderColor] = useState(
		initialEditorPreferences.frameBorderColor,
	);
	const [frameBorderOpacity, setFrameBorderOpacity] = useState(
		initialEditorPreferences.frameBorderOpacity,
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
	const [isEditingCaptionPosition, setIsEditingCaptionPosition] = useState(false);
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
	const [webcamEffects, setWebcamEffects] = useState<WebcamEffects>({
		...initialEditorPreferences.webcamEffects,
		portraitOffset: { ...initialEditorPreferences.webcamEffects.portraitOffset },
	});
	const [webcamHealthMetrics, setWebcamHealthMetrics] = useState<WebcamHealthMetrics | null>(null);
	const [webcamSessionMetadata, setWebcamSessionMetadata] = useState<WebcamSessionMetadata | null>(
		null,
	);
	const [cameraSizeDuringZoom, setCameraSizeDuringZoom] = useState(
		initialEditorPreferences.cameraSizeDuringZoom,
	);
	const [cameraLayouts, setCameraLayouts] = useState<CameraLayoutRegion[]>([]);
	const [selectedCameraLayoutId, setSelectedCameraLayoutId] = useState<string | null>(null);
	const [webcamSelected, setWebcamSelected] = useState(false);
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialEditorPreferences.aspectRatio);
	const [videoExportSettings, setVideoExportSettings] = useState<VideoExportSettings>(
		initialEditorPreferences.videoExportSettings,
	);
	const [exportFormat, setExportFormat] = useState<ExportFormat>(
		initialEditorPreferences.exportFormat,
	);
	const [exportDestination, setExportDestination] = useState<ExportDestination>(
		initialEditorPreferences.exportDestination,
	);
	const [gifExportSettings, setGifExportSettings] = useState<GifExportConfig>(
		initialEditorPreferences.gifExportSettings,
	);
	const [sourceFrameRate, setSourceFrameRate] = useState(60);
	const [workspaceLayout, setWorkspaceLayout] = useState<EditorWorkspaceLayout>(
		initialEditorPreferences.workspaceLayout,
	);
	const [customPresets, setCustomPresets] = useState<EditorPreset[]>(
		initialEditorPreferences.presets,
	);
	const [cursorTelemetryLoadSettled, setCursorTelemetryLoadSettled] = useState(false);
	const [postRecordingAutoZoomBootstrap, setPostRecordingAutoZoomBootstrap] =
		useState<PostRecordingAutoZoomBootstrapState | null>(null);
	const captionRegions = captionTrack?.segments ?? [];
	const workspaceLayoutSizes = useMemo(
		() => getWorkspaceLayoutSizes(workspaceLayout),
		[workspaceLayout],
	);

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
	const exportV2JobIdRef = useRef<string | null>(null);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);
	const resolvedWebcamPath = missingWebcamPath ? null : webcamPath;
	const currentProjectPath = sessionState.currentProjectPath;
	const isExporting = sessionState.isExporting;
	const exportProgress = sessionState.exportProgress;
	const exportError = sessionState.exportError;
	const exportStatus = sessionState.exportStatus;
	const showExportDialog = sessionState.modals.exportDialogOpen;
	const showExportSettings = sessionState.modals.exportSettingsOpen;
	const exportDetails = sessionState.exportDetails;
	const exportedFilePath = sessionState.exportedFilePath;
	const hasPendingExportSave = sessionState.hasPendingExportSave;
	const lastSavedSnapshot = sessionState.lastSavedSnapshot;
	const showQuickShare = sessionState.modals.quickShareOpen;
	const postRecordingContext = sessionState.postRecordingContext;
	const isTranscribing = sessionState.isTranscribing;
	const selectedAudioRegion = selectedAudioId
		? (audioRegions.find((region) => region.id === selectedAudioId) ?? null)
		: null;
	const missingSelectedAudioPath = selectedAudioId ? missingAudioPathsById[selectedAudioId] : null;
	const shadowIntensity = useMemo(
		() =>
			getLegacyShadowIntensityFromFrameShadow({
				size: frameShadowSize,
				opacity: frameShadowOpacity,
				blur: frameShadowBlur,
			}),
		[frameShadowBlur, frameShadowOpacity, frameShadowSize],
	);

	useSourceVideoMetadata({
		videoPath,
		setSourceFrameRate,
		setVideoHasAudio,
	});

	const { clearWebcamState, syncWebcamAvailability, syncAudioAvailability } =
		useVideoEditorMediaAvailability({
			aspectRatio: initialEditorPreferences.aspectRatio,
			setWebcamPath,
			setMissingWebcamPath,
			setWebcamSessionMetadata,
			setWebcamRegion,
			setWebcamEffects,
			setWebcamHealthMetrics,
			setWebcamPreviewMode,
			setShowWebcam,
			setMirrorWebcam,
			setCameraSizeDuringZoom,
			setCameraLayouts,
			setSelectedCameraLayoutId,
			setWebcamSelected,
			setMissingAudioPathsById,
		});

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
				hideBackground,
				shadowIntensity,
				frameShadowSize,
				frameShadowOpacity,
				frameShadowBlur,
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
				cursorTypeMode,
				cursorTilt,
				hideWhenIdle,
				idleHideDelayMs,
				smoothMovementEnabled,
				cursorMovementStyle,
				cursorSpring,
				cameraSpring,
				highQualitySvgCursors,
				cursorColor,
				cursorOpacity,
				clickEffectsEnabled,
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
				frameBorderEnabled,
				frameBorderWidth,
				frameBorderColor,
				frameBorderOpacity,
				padding,
				cropRegion,
				aspectRatio,
				webcamRegion,
				webcamEffects,
				webcamPreviewMode,
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				exportFormat,
				exportDestination,
				videoExportSettings,
				gifExportSettings,
			}),
		[
			wallpaper,
			hideBackground,
			shadowIntensity,
			frameShadowSize,
			frameShadowOpacity,
			frameShadowBlur,
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
			cursorTypeMode,
			cursorTilt,
			hideWhenIdle,
			idleHideDelayMs,
			smoothMovementEnabled,
			cursorMovementStyle,
			cursorSpring,
			cameraSpring,
			highQualitySvgCursors,
			cursorColor,
			cursorOpacity,
			clickEffectsEnabled,
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
			frameBorderEnabled,
			frameBorderWidth,
			frameBorderColor,
			frameBorderOpacity,
			padding,
			cropRegion,
			aspectRatio,
			webcamRegion,
			webcamEffects,
			webcamPreviewMode,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			exportFormat,
			exportDestination,
			videoExportSettings,
			gifExportSettings,
		],
	);

	const applyEditorControls = useCallback(
		(
			controls: ReturnType<typeof normalizeProjectEditor>,
			options: { includeTimeline?: boolean } = {},
		) => {
			setWallpaper(controls.wallpaper);
			setHideBackground(controls.hideBackground);
			setFrameShadowSize(controls.frameShadowSize);
			setFrameShadowOpacity(controls.frameShadowOpacity);
			setFrameShadowBlur(controls.frameShadowBlur);
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
			setCursorTypeMode(controls.cursorTypeMode);
			setCursorTilt(controls.cursorTilt);
			setHideWhenIdle(controls.hideWhenIdle);
			setIdleHideDelayMs(controls.idleHideDelayMs);
			setSmoothMovementEnabled(controls.smoothMovementEnabled);
			setCursorMovementStyle(controls.cursorMovementStyle);
			setCursorSpring(controls.cursorSpring);
			setCameraSpring(controls.cameraSpring ?? DEFAULT_CAMERA_SPRING);
			setHighQualitySvgCursors(controls.highQualitySvgCursors);
			setCursorColor(controls.cursorColor);
			setCursorOpacity(controls.cursorOpacity);
			setClickEffectsEnabled(controls.clickEffectsEnabled);
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
			setDeviceMockup(controls.deviceMockup);
			setFrameBorderEnabled(controls.frameBorderEnabled);
			setFrameBorderWidth(controls.frameBorderWidth);
			setFrameBorderColor(controls.frameBorderColor);
			setFrameBorderOpacity(controls.frameBorderOpacity);
			setBorderRadius(controls.borderRadius);
			setPadding(controls.padding);
			setCropRegion(controls.cropRegion);
			setAspectRatio(controls.aspectRatio);
			setShowWebcam(controls.showWebcam);
			setMirrorWebcam(controls.mirrorWebcam);
			setWebcamRegion({ ...controls.webcamRegion });
			setWebcamEffects({
				...controls.webcamEffects,
				portraitOffset: { ...controls.webcamEffects.portraitOffset },
			});
			setWebcamHealthMetrics(null);
			setWebcamPreviewMode(controls.webcamPreviewMode ?? DEFAULT_WEBCAM_PREVIEW_MODE);
			setCameraSizeDuringZoom(controls.cameraSizeDuringZoom);
			setCaptionSettings(controls.captionSettings);
			setCaptionGenerationOptions(controls.captionGenerationOptions);
			setExportFormat(controls.exportFormat);
			setExportDestination(controls.exportDestination);
			setVideoExportSettings(controls.videoExportSettings);
			setGifExportSettings(controls.gifExportSettings);

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
			webcamEffects,
			webcamPreviewMode,
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
		webcamEffects,
		webcamPreviewMode,
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

	const applyHistorySnapshot = useCallback((snapshot: EditorHistorySnapshot) => {
		const cloned = cloneEditorHistorySnapshot(snapshot);
		setZoomRegions(cloned.zoomRegions);
		setTrimRegions(cloned.trimRegions);
		setCutPoints(cloned.cutPoints);
		setSpeedRegions(cloned.speedRegions);
		setAnnotationRegions(cloned.annotationRegions);
		setAudioRegions(cloned.audioRegions);
		setCameraLayouts(cloned.cameraLayouts);
		setWebcamRegion(cloned.webcamRegion);
		setWebcamEffects(cloned.webcamEffects);
		setWebcamPreviewMode(cloned.webcamPreviewMode);
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
	}, []);

	const { historyPastRef, historyFutureRef, handleUndo, handleRedo } = useEditorHistory({
		buildSnapshot: buildHistorySnapshot,
		applySnapshot: applyHistorySnapshot,
	});

	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const sourcePath = fromFileUrl(project.videoPath);
			const loadedVideoName = normalizeVideoDisplayName(
				project.videoName ?? deriveVideoNameFromPath(path ?? sourcePath),
			);
			const normalizedEditor = normalizeProjectEditor(project.editor);
			const normalizedWebcamSessionMetadata =
				normalizeWebcamSessionMetadata(project.webcamSessionMetadata) ?? null;

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
			setVideoName(loadedVideoName);
			setDraftVideoName(loadedVideoName);
			setIsEditingVideoName(false);
			dispatchSession({ type: "set-current-project-path", path: path ?? null });
			applyEditorControls(normalizedEditor, { includeTimeline: true });
			setWebcamSessionMetadata(normalizedWebcamSessionMetadata);
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

			dispatchSession({
				type: "set-last-saved-snapshot",
				snapshot: editorPersistenceService.buildProjectArtifacts({
					sourcePath,
					editor: normalizedEditor,
					videoName: loadedVideoName,
					webcamSessionMetadata: normalizedWebcamSessionMetadata ?? undefined,
				}).projectSnapshot,
			});
			return true;
		},
		[
			applyEditorControls,
			syncWebcamAvailability,
			setDraftVideoName,
			setIsEditingVideoName,
			setVideoName,
		],
	);

	const currentProjectSnapshot = useMemo(() => {
		const sourcePath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		if (!sourcePath) {
			return null;
		}
		return editorPersistenceService.buildProjectArtifacts({
			sourcePath,
			videoName,
			editor: {
				wallpaper,
				hideBackground,
				shadowIntensity,
				frameShadowSize,
				frameShadowOpacity,
				frameShadowBlur,
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
				cursorTypeMode,
				cursorTilt,
				hideWhenIdle,
				idleHideDelayMs,
				smoothMovementEnabled,
				cursorMovementStyle,
				cursorSpring,
				cameraSpring,
				highQualitySvgCursors,
				cursorColor,
				cursorOpacity,
				clickEffectsEnabled,
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
				deviceMockup,
				frameBorderEnabled,
				frameBorderWidth,
				frameBorderColor,
				frameBorderOpacity,
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
				webcamEffects,
				webcamPreviewMode,
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				cameraLayouts,
				captionTrack,
				captionSettings,
				captionGenerationOptions,
				exportFormat,
				exportDestination,
				videoExportSettings,
				gifExportSettings,
			},
			webcamSessionMetadata: webcamSessionMetadata ?? undefined,
		}).projectSnapshot;
	}, [
		videoPath,
		videoSourcePath,
		videoName,
		wallpaper,
		hideBackground,
		shadowIntensity,
		frameShadowSize,
		frameShadowOpacity,
		frameShadowBlur,
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
		cursorTypeMode,
		cursorTilt,
		hideWhenIdle,
		idleHideDelayMs,
		smoothMovementEnabled,
		cursorMovementStyle,
		cursorSpring,
		cameraSpring,
		highQualitySvgCursors,
		cursorColor,
		cursorOpacity,
		clickEffectsEnabled,
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
		deviceMockup,
		frameBorderEnabled,
		frameBorderWidth,
		frameBorderColor,
		frameBorderOpacity,
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
		webcamEffects,
		showWebcam,
		mirrorWebcam,
		cameraSizeDuringZoom,
		cameraLayouts,
		captionTrack,
		captionSettings,
		captionGenerationOptions,
		exportFormat,
		exportDestination,
		videoExportSettings,
		gifExportSettings,
		webcamSessionMetadata,
		webcamPreviewMode,
	]);

	const hasUnsavedChanges = editorPersistenceService.hasUnsavedChanges({
		currentProjectPath,
		currentProjectSnapshot,
		lastSavedSnapshot,
	});

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
					// If we were launched from a stop-recording transition, the main
					// process is still finalizing the video in the background. Wait
					// for that to resolve so we get the real final path.
					const initialContextResult = await window.electronAPI.getPostRecordingContext();
					const awaitingFinalization =
						initialContextResult.success &&
						initialContextResult.context != null &&
						!initialContextResult.context.recordingPath;

					if (awaitingFinalization) {
						const finalized = await window.electronAPI.awaitRecordingFinalized();
						if (!finalized.success || !finalized.path) {
							setError(
								"Error finalizing recording: " +
									String(finalized.error ?? finalized.message ?? "unknown error"),
							);
						} else {
							const sourcePath = fromFileUrl(finalized.path);
							const nextVideoName = deriveVideoNameFromPath(sourcePath);
							setVideoSourcePath(sourcePath);
							setVideoPath(toFileUrl(sourcePath));
							setVideoName(nextVideoName);
							setDraftVideoName(nextVideoName);
							setIsEditingVideoName(false);
							setWebcamSessionMetadata(
								normalizeWebcamSessionMetadata(finalized.webcamSessionMetadata) ?? null,
							);
							dispatchSession({ type: "set-current-project-path", path: null });
							dispatchSession({ type: "set-last-saved-snapshot", snapshot: null });
							// Reset every editor control (and timeline data) to defaults so
							// a brand-new recording never inherits the previous video's
							// tweaks. Users restore prior settings via presets.
							applyEditorControls(normalizeProjectEditor({}), { includeTimeline: true });
							setAspectRatio("native");
							setPadding(DEFAULT_VIDEO_PREVIEW_PADDING);

							if (finalized.webcamPath) {
								setWebcamPath(finalized.webcamPath);
								await syncWebcamAvailability(finalized.webcamPath, { quiet: false });
								setShowWebcam(true);
							} else {
								clearWebcamState();
							}
						}
					} else {
						const result = await window.electronAPI.getCurrentVideoPath();
						if (result.success && result.path) {
							const sourcePath = fromFileUrl(result.path);
							const nextVideoName = deriveVideoNameFromPath(sourcePath);
							setVideoSourcePath(sourcePath);
							setVideoPath(toFileUrl(sourcePath));
							setVideoName(nextVideoName);
							setDraftVideoName(nextVideoName);
							setIsEditingVideoName(false);
							setWebcamSessionMetadata(null);
							dispatchSession({ type: "set-current-project-path", path: null });
							dispatchSession({ type: "set-last-saved-snapshot", snapshot: null });
							applyEditorControls(normalizeProjectEditor({}), { includeTimeline: true });
							setAspectRatio("native");
							setPadding(DEFAULT_VIDEO_PREVIEW_PADDING);

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
				}

				const postRecordingResult = await window.electronAPI.getPostRecordingContext();
				if (postRecordingResult.success) {
					setWebcamSessionMetadata(
						normalizeWebcamSessionMetadata(postRecordingResult.context?.webcamSessionMetadata) ??
							null,
					);
					dispatchSession({
						type: "set-post-recording-context",
						context: postRecordingResult.context ?? null,
					});
				}
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
	}, [
		applyEditorControls,
		applyLoadedProject,
		clearWebcamState,
		syncWebcamAvailability,
		setDraftVideoName,
		setIsEditingVideoName,
		setVideoName,
	]);

	// Crossfade skeleton → editor when loading finishes
	useEffect(() => {
		if (!loading) {
			let removeTimer: ReturnType<typeof setTimeout>;
			const paintFrame = setTimeout(() => {
				setEditorReady(true);
				removeTimer = setTimeout(() => setSkeletonVisible(false), 400);
			}, 50);
			return () => {
				clearTimeout(paintFrame);
				clearTimeout(removeTimer);
			};
		}
	}, [loading]);

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

	// Only genuine app-level preferences and user-saved presets persist across
	// sessions. Per-video editor controls (wallpaper, cursor, frame, export,
	// etc.) intentionally do NOT get written here — every new recording should
	// open with default settings. Users re-use prior settings via presets.
	useEffect(() => {
		editorPreferencesService.scheduleSave({
			previewQuality,
			webcamPreviewMode,
			presets: customPresets,
		});
	}, [previewQuality, webcamPreviewMode, customPresets]);

	useEffect(() => {
		return () => {
			editorPreferencesService.flush();
		};
	}, []);

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

			const projectArtifacts = editorPersistenceService.buildProjectArtifacts({
				sourcePath,
				videoName,
				editor: {
					wallpaper,
					hideBackground,
					shadowIntensity,
					frameShadowSize,
					frameShadowOpacity,
					frameShadowBlur,
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
					cursorTypeMode,
					cursorTilt,
					hideWhenIdle,
					idleHideDelayMs,
					smoothMovementEnabled,
					cursorMovementStyle,
					cursorSpring,
					cameraSpring,
					highQualitySvgCursors,
					cursorColor,
					cursorOpacity,
					clickEffectsEnabled,
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
					deviceMockup,
					frameBorderEnabled,
					frameBorderWidth,
					frameBorderColor,
					frameBorderOpacity,
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
					webcamEffects,
					webcamPreviewMode,
					showWebcam,
					mirrorWebcam,
					cameraSizeDuringZoom,
					cameraLayouts,
					captionTrack,
					captionSettings,
					captionGenerationOptions,
					exportFormat,
					exportDestination,
					videoExportSettings,
					gifExportSettings,
				},
				webcamSessionMetadata: webcamSessionMetadata ?? undefined,
			});
			const result = await window.electronAPI.saveProjectFile(
				projectArtifacts.projectData,
				projectArtifacts.fileNameBase,
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
				dispatchSession({ type: "set-current-project-path", path: result.path });
			}
			dispatchSession({
				type: "set-last-saved-snapshot",
				snapshot: projectArtifacts.projectSnapshot,
			});

			toast.success(`Project saved to ${result.path}`);
		},
		[
			videoPath,
			videoSourcePath,
			videoName,
			currentProjectPath,
			wallpaper,
			hideBackground,
			shadowIntensity,
			frameShadowSize,
			frameShadowOpacity,
			frameShadowBlur,
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
			cursorTypeMode,
			cursorTilt,
			hideWhenIdle,
			idleHideDelayMs,
			smoothMovementEnabled,
			cursorMovementStyle,
			cursorSpring,
			cameraSpring,
			highQualitySvgCursors,
			cursorColor,
			cursorOpacity,
			clickEffectsEnabled,
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
			frameBorderEnabled,
			frameBorderWidth,
			frameBorderColor,
			frameBorderOpacity,
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
			webcamEffects,
			webcamPreviewMode,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			cameraLayouts,
			captionTrack,
			captionSettings,
			captionGenerationOptions,
			exportFormat,
			exportDestination,
			videoExportSettings,
			gifExportSettings,
			deviceMockup,
			webcamSessionMetadata,
		],
	);

	const { handleSaveProject, handleLoadProject } = useVideoEditorProjectFileActions({
		hasUnsavedChanges,
		isExporting,
		isTranscribing,
		saveProject,
		applyLoadedProject,
	});

	useEffect(() => {
		let mounted = true;

		async function loadCursorTelemetry() {
			if (!videoPath) {
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetryLoadSettled(true);
				}
				return;
			}

			if (mounted) {
				setCursorTelemetryLoadSettled(false);
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
			} finally {
				if (mounted) {
					setCursorTelemetryLoadSettled(true);
				}
			}
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
		};
	}, [videoPath]);

	useEffect(() => {
		if (!postRecordingContext?.recordingPath || !videoPath) {
			return;
		}

		const postRecordingVideoPath = toFileUrl(postRecordingContext.recordingPath);
		if (postRecordingVideoPath !== videoPath) {
			return;
		}

		setPostRecordingAutoZoomBootstrap((current) => {
			if (current?.videoPath === videoPath) {
				return current;
			}

			return {
				videoPath,
				enabled: Boolean(postRecordingContext.autoCreateZooms),
				settled: false,
			};
		});
	}, [postRecordingContext, videoPath]);

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

	const sourceVideoWidth = videoPlaybackRef.current?.video?.videoWidth || 0;
	const sourceVideoHeight = videoPlaybackRef.current?.video?.videoHeight || 0;

	const legacyCaptureCorrectionCrop = useMemo(
		() =>
			deriveLegacyCaptureCorrectionCrop({
				videoWidth: sourceVideoWidth,
				videoHeight: sourceVideoHeight,
				cursorTelemetry,
			}),
		[cursorTelemetry, sourceVideoHeight, sourceVideoWidth],
	);

	const effectiveCropRegion = useMemo(
		() => composeCropRegions(legacyCaptureCorrectionCrop, cropRegion),
		[cropRegion, legacyCaptureCorrectionCrop],
	);

	const cursorSimulationPath = useMemo(
		() =>
			buildCursorSimulationPath(
				effectiveCursorTelemetry,
				Math.max(
					displayedTimelineWindow.endMs,
					effectiveCursorTelemetry[effectiveCursorTelemetry.length - 1]?.timeMs ?? 0,
				),
			),
		[displayedTimelineWindow.endMs, effectiveCursorTelemetry],
	);

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
		const decision = resolvePostRecordingAutoZoomDecision({
			bootstrap: postRecordingAutoZoomBootstrap,
			videoPath,
			durationSeconds: duration,
			cursorTelemetryLoadSettled,
			normalizedCursorTelemetryLength: normalizedCursorTelemetry.length,
			zoomRegionCount: zoomRegions.length,
		});

		if (decision === "idle" || decision === "wait" || !videoPath) {
			return;
		}

		if (decision === "settle") {
			setPostRecordingAutoZoomBootstrap((current) =>
				current && current.videoPath === videoPath ? { ...current, settled: true } : current,
			);
			return;
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		const suggestionResult = buildAutoZoomSuggestions(normalizedCursorTelemetry, totalMs);

		setZoomRegions((prev) => {
			if (prev.length > 0 || suggestionResult.suggestions.length === 0) {
				return prev;
			}

			let nextId = nextZoomIdRef.current;
			const additions: ZoomRegion[] = suggestionResult.suggestions.map((suggestion) => ({
				id: `zoom-${nextId++}`,
				startMs: suggestion.startMs,
				endMs: suggestion.endMs,
				depth: DEFAULT_ZOOM_DEPTH,
				focus: clampFocusToDepth(suggestion.focus, DEFAULT_ZOOM_DEPTH),
				mode: "cursor-follow",
				tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
			}));

			nextZoomIdRef.current = nextId;
			return [...prev, ...additions];
		});

		setPostRecordingAutoZoomBootstrap((current) =>
			current && current.videoPath === videoPath ? { ...current, settled: true } : current,
		);
	}, [
		cursorTelemetryLoadSettled,
		duration,
		normalizedCursorTelemetry,
		postRecordingAutoZoomBootstrap,
		videoPath,
		zoomRegions.length,
	]);

	useLayoutEffect(() => {
		panelGroupRef.current?.setLayout(workspaceLayoutSizes);
	}, [workspaceLayoutSizes]);

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

	const handlePreviewQualitySwitchFailed = useCallback(
		(fallbackQuality: PreviewQuality) => {
			setPreviewQuality(fallbackQuality);
			toast.error(tSettings("previewQuality.switchFailed"));
		},
		[tSettings],
	);

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
			mode: DEFAULT_ZOOM_MODE,
			tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
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
			mode: "cursor-follow",
			tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
		};
		setZoomRegions((prev) => [...prev, newRegion]);
		setSelectedZoomId(id);
		setSelectedTrimId(null);
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleZoomModeChange = useCallback(
		(mode: ZoomMode) => {
			if (!selectedZoomId) {
				return;
			}

			const currentTimeMs = Math.round(currentTime * 1000);
			const simulatedCursor = evaluateCursorMotionSnapshot(
				cursorSimulationPath,
				currentTimeMs,
				null,
			);
			setZoomRegions((prev) =>
				prev.map((region) => {
					if (region.id !== selectedZoomId) {
						return region;
					}

					if (mode === "static") {
						const { focus } = resolveZoomRegionFocus(region, simulatedCursor, region.focus, 0);
						return {
							...region,
							mode,
							focus,
						};
					}

					return {
						...region,
						mode,
						tracking: region.tracking ?? DEFAULT_CURSOR_FOLLOW_TRACKING,
					};
				}),
			);
		},
		[currentTime, cursorSimulationPath, selectedZoomId],
	);

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
				mode: "default",
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

	const handleWebcamEffectsChange = useCallback((updates: Partial<WebcamEffects>) => {
		setWebcamEffects((prev) =>
			normalizeWebcamEffects({
				...prev,
				...updates,
				presetId: updates.presetId ?? "custom",
				portraitOffset: updates.portraitOffset
					? { ...prev.portraitOffset, ...updates.portraitOffset }
					: prev.portraitOffset,
			}),
		);
	}, []);

	const handleApplyWebcamPreset = useCallback(
		(presetId: WebcamEffects["presetId"]) => {
			setWebcamRegion((prevRegion) => {
				const applied = applyWebcamStylePreset({
					presetId,
					baseRegion: prevRegion,
					baseEffects: webcamEffects,
				});
				setWebcamEffects(applied.effects);
				return normalizeWebcamRegion(applied.region);
			});
		},
		[webcamEffects],
	);

	const handleResetRecommendedWebcam = useCallback(() => {
		const recommendedWebcamDefaults = getRecommendedWebcamDefaults(aspectRatio);
		setWebcamRegion(recommendedWebcamDefaults.region);
		setWebcamEffects(recommendedWebcamDefaults.effects);
		setWebcamHealthMetrics(DEFAULT_WEBCAM_HEALTH_METRICS);
		setShowWebcam(recommendedWebcamDefaults.showWebcam);
		setMirrorWebcam(recommendedWebcamDefaults.mirrorWebcam);
		setCameraSizeDuringZoom(recommendedWebcamDefaults.cameraSizeDuringZoom);
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

	const {
		handleCaptionAdded,
		handleCaptionSpanChange,
		handleCaptionTextChange,
		handleCaptionDelete,
		handleDeleteAllCaptions,
		handleCaptionStylePresetChange,
		handleCaptionSettingsChange,
		handleCaptionStyleChange,
		handleApplyCaptionPreset,
		handleToggleCaptionPositionEditing,
		handleCaptionPositionOverrideChange,
		handleCaptionImport,
		handleAutoTranscribe,
		handleCaptionGenerationOptionsChange,
		handleCaptionSplit,
		handleCaptionMergeNext,
		handleTranscriptExport,
		handleCancelCaptionGeneration,
	} = useVideoEditorCaptions({
		t,
		videoPath,
		isTranscribing,
		captionTrack,
		captionGenerationOptions,
		nextCaptionIdRef,
		dispatchSession,
		setCaptionTrack,
		setCaptionSettings,
		setCaptionGenerationOptions,
		setCaptionGenerationProgress,
		setCaptionModelStatus,
		setSelectedCaptionId,
		setIsEditingCaptionPosition,
	});

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

	useVideoEditorKeyboardShortcuts({
		shortcuts,
		isMac,
		handleUndo,
		handleRedo,
		videoPlaybackRef,
	});

	useTimelineSelectionPruning({
		selectedZoomId,
		setSelectedZoomId,
		zoomRegions,
		selectedTrimId,
		setSelectedTrimId,
		trimRegions,
		selectedAnnotationId,
		setSelectedAnnotationId,
		annotationRegions,
		selectedSpeedId,
		setSelectedSpeedId,
		speedRegions,
		selectedAudioId,
		setSelectedAudioId,
		audioRegions,
	});

	useEffect(() => {
		void syncAudioAvailability(audioRegions);
	}, [audioRegions, syncAudioAvailability]);

	useVideoEditorAudioPreview({
		audioRegions,
		currentTime,
		isPlaying,
		clipVolume,
		missingAudioPathsById,
		resolvedAudioSourceUrls,
		setResolvedAudioSourceUrls,
		videoPlaybackRef,
	});

	const {
		showExportSuccessToast,
		handleCancelExport,
		handleExportDialogClose,
		handleRetrySaveExport,
		openRecordingsFolder,
	} = useVideoEditorExportActions({
		exportV2JobIdRef,
		exporterRef,
		pendingExportSaveRef,
		dispatchSession,
	});

	const buildDefaultExportSettings = useDefaultExportSettings({
		videoPlaybackRef,
		aspectRatio,
		duration,
		sourceFrameRate,
		exportFormat,
		exportDestination,
		videoExportSettings,
		gifExportSettings,
	});

	const handleExport = useCallback(
		async (
			settings: ExportSettings,
			options: {
				saveMode?: "dialog" | "recordings" | "clipboard";
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

			dispatchSession({ type: "set-exporting", value: true });
			dispatchSession({ type: "set-export-status", status: "exporting" });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
			pendingExportSaveRef.current = null;
			dispatchSession({ type: "set-pending-export-save", value: false });

			let keepExportDialogOpen = true;
			const saveMode = options.saveMode ?? "dialog";
			let previewRestoreTime = video.currentTime;
			let shouldResumePreviewPlayback = isPlaying;
			let previewRestored = false;
			let previewHoldToken: string | null = null;
			const progressThrottler = createExportProgressThrottler((progress) => {
				dispatchSession({ type: "set-export-progress", progress });
			});

			const setPendingSave = (blob: Blob, fileName: string) => {
				pendingExportSaveRef.current = { blob, fileName };
				dispatchSession({ type: "set-pending-export-save", value: true });
			};

			const saveExportedBlob = async ({
				blob,
				fileName,
				formatName,
			}: {
				blob: Blob;
				fileName: string;
				formatName: "GIF" | "video";
			}): Promise<boolean> => {
				if (saveMode === "clipboard") {
					dispatchSession({ type: "set-export-status", status: "saving" });
					const arrayBuffer = await blob.arrayBuffer();
					const copyResult = await window.electronAPI.copyExportedToClipboard(
						arrayBuffer,
						fileName,
					);
					if (copyResult.success) {
						toast.success(`${formatName === "GIF" ? "GIF" : "Video"} copied to clipboard.`);
						dispatchSession({
							type: "set-exported-file-path",
							path: copyResult.path ?? "",
						});
						dispatchSession({ type: "set-export-status", status: "saved" });
						return false;
					}

					dispatchSession({
						type: "set-export-error",
						error: copyResult.error || `Failed to copy ${formatName.toLowerCase()} to clipboard`,
					});
					dispatchSession({ type: "set-export-status", status: "failed" });
					toast.error(
						copyResult.error || `Failed to copy ${formatName.toLowerCase()} to clipboard`,
					);
					return true;
				}

				if (saveMode === "recordings") {
					dispatchSession({ type: "set-export-status", status: "saving" });
					const arrayBuffer = await blob.arrayBuffer();
					const saveResult = await window.electronAPI.saveExportedVideoToRecordings(
						arrayBuffer,
						fileName,
					);

					if (saveResult.success && saveResult.path) {
						showExportSuccessToast(saveResult.path);
						dispatchSession({
							type: "set-exported-file-path",
							path: saveResult.path,
						});
						dispatchSession({ type: "set-export-status", status: "saved" });
						await options.onSaved?.(saveResult.path);
						return false;
					}

					const errorMessage = saveResult.message || `Failed to save ${formatName}`;
					setPendingSave(blob, fileName);
					dispatchSession({ type: "set-export-error", error: errorMessage });
					dispatchSession({ type: "set-export-status", status: "failed" });
					toast.error(errorMessage);
					return true;
				}

				dispatchSession({ type: "set-export-status", status: "awaiting-save-path" });
				const savePathResult = await window.electronAPI.showExportSaveDialog(fileName);
				if ("canceled" in savePathResult && savePathResult.canceled) {
					setPendingSave(blob, fileName);
					dispatchSession({
						type: "set-export-error",
						error: "Save dialog canceled. Click Save Again to save without re-rendering.",
					});
					dispatchSession({ type: "set-export-status", status: "canceled" });
					toast.info("Save canceled. You can save again without re-exporting.");
					return true;
				}

				if (!savePathResult.success || !savePathResult.path) {
					const errorMessage = savePathResult.message || "Failed to open save dialog";
					setPendingSave(blob, fileName);
					dispatchSession({ type: "set-export-error", error: errorMessage });
					dispatchSession({ type: "set-export-status", status: "failed" });
					toast.error(errorMessage);
					return true;
				}

				dispatchSession({ type: "set-export-status", status: "saving" });
				const arrayBuffer = await blob.arrayBuffer();
				const writeResult = await window.electronAPI.writeExportedVideoToPath(
					arrayBuffer,
					savePathResult.path,
				);

				if (writeResult.success && writeResult.path) {
					showExportSuccessToast(writeResult.path);
					dispatchSession({
						type: "set-exported-file-path",
						path: writeResult.path,
					});
					dispatchSession({ type: "set-export-status", status: "saved" });
					await options.onSaved?.(writeResult.path);
					return false;
				}

				const errorMessage = writeResult.message || `Failed to save ${formatName}`;
				setPendingSave(blob, fileName);
				dispatchSession({ type: "set-export-error", error: errorMessage });
				dispatchSession({ type: "set-export-status", status: "failed" });
				toast.error(errorMessage);
				return true;
			};

			const restorePreviewAfterExport = async (forceReload = false) => {
				const playback = videoPlaybackRef.current;
				if (!playback) {
					return;
				}

				try {
					await playback.restorePreviewFrame({
						forceReload,
						resumePlayback: shouldResumePreviewPlayback,
					});
					previewRestored = true;
				} catch {
					// The playback component already reports unrecoverable preview errors.
				}
			};

			try {
				dispatchSession({ type: "set-export-details", details: null });
				const wasPlaying = isPlaying;
				previewRestoreTime = video.currentTime;
				shouldResumePreviewPlayback = wasPlaying;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}
				previewHoldToken = (await videoPlaybackRef.current?.acquirePreviewHold("export")) ?? null;

				const sourceWidth = video.videoWidth || 1920;
				const sourceHeight = video.videoHeight || 1080;
				const sourceAspectRatio = sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
				const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);
				let exportSourceFrameRate = resolveSourceFrameRate(sourceFrameRate);
				const metadataDecoder = new StreamingVideoDecoder();
				try {
					const metadata = await metadataDecoder.loadMetadata(videoPath);
					exportSourceFrameRate = resolveSourceFrameRate(metadata.frameRate);
					if (exportSourceFrameRate !== sourceFrameRate) {
						setSourceFrameRate(exportSourceFrameRate);
					}
				} catch (error) {
					console.warn("[VideoEditor] Falling back to cached source FPS for export:", error);
				} finally {
					metadataDecoder.destroy();
				}
				const sourceMetadata = buildSourceVideoMetadata({
					width: sourceWidth,
					height: sourceHeight,
					frameRate: exportSourceFrameRate,
					durationMs: Math.round(duration * 1000),
				});

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;

				const isDefaultCropRegion =
					Math.abs(effectiveCropRegion.x - DEFAULT_CROP_REGION.x) < 0.0001 &&
					Math.abs(effectiveCropRegion.y - DEFAULT_CROP_REGION.y) < 0.0001 &&
					Math.abs(effectiveCropRegion.width - DEFAULT_CROP_REGION.width) < 0.0001 &&
					Math.abs(effectiveCropRegion.height - DEFAULT_CROP_REGION.height) < 0.0001;
				const hasFrameShadow =
					frameShadowOpacity > 0 && (frameShadowSize > 0 || frameShadowBlur > 0);
				const hasCaptionExport =
					Boolean(captionSettings?.enabled) && (captionRegions?.length ?? 0) > 0;
				const hasKeyboardShortcutExport =
					Boolean(showKeyboardShortcuts) && keyboardShortcutCallouts.length > 0;
				const hasCursorExport = Boolean(showCursor) && effectiveCursorTelemetry.length > 0;
				const hasWebcamExport = Boolean(showWebcam) && Boolean(resolvedWebcamPath);
				const hasVisualComposition =
					effectiveZoomRegions.length > 0 ||
					!isDefaultCropRegion ||
					aspectRatio !== "native" ||
					padding !== 0 ||
					borderRadius !== 0 ||
					frameBorderEnabled ||
					hasFrameShadow ||
					backgroundBlur > 0 ||
					hideBackground;
				const exportV2Selection = selectExportV2Engine({
					format: settings.format,
					hasVisualComposition,
					hasExternalAudio: audioRegions.length > 0,
					hasWebcam: hasWebcamExport,
					hasCaptions: hasCaptionExport,
					hasAnnotations: annotationRegions.length > 0,
					hasCursorOverlay: hasCursorExport,
					hasKeyboardCallouts: hasKeyboardShortcutExport,
					hasSpeedRegions: speedRegions.length > 0,
					hasTrimRegions: trimRegions.length > 0,
				});
				const exportV2Destination: ExportV2Destination =
					saveMode === "recordings"
						? "recordings"
						: saveMode === "clipboard"
							? "clipboard"
							: "file";
				const compositionPayload = {
					videoUrl: videoPath,
					wallpaper,
					trimRegions,
					speedRegions,
					showShadow: hasFrameShadow,
					shadowIntensity,
					frameShadowSize,
					frameShadowOpacity,
					frameShadowBlur,
					backgroundBlur,
					hideBackground,
					zoomMotionBlur,
					connectZooms,
					deviceMockup: "none" as const,
					frameBorderEnabled,
					frameBorderWidth,
					frameBorderColor,
					frameBorderOpacity,
					borderRadius,
					padding,
					videoPadding: padding,
					cropRegion: effectiveCropRegion,
					aspectRatio,
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
					cursorStyle,
					cursorPack,
					cursorColor,
					cursorOpacity,
					clickEffectsEnabled,
					clickHighlightColor,
					clickHighlightSize,
					clickHighlightOpacity,
					cursorTrailLength,
					cursorTrailOpacity,
					cursorTypeMode,
					cursorTilt,
					hideWhenIdle,
					idleHideDelayMs,
					smoothMovementEnabled,
					cursorMovementStyle,
					cursorSpring,
					highQualitySvgCursors,
					cameraSpring,
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
					webcamEffects,
					showWebcam,
					mirrorWebcam,
					cameraSizeDuringZoom,
					cameraLayouts,
					captionRegions,
					captionSettings,
					sourceWidth,
					sourceHeight,
				};

				const tryExportV2 = async ({
					request,
					onDetails,
					formatName,
				}: {
					request: ExportV2StartRequest;
					onDetails: (details: ExportDetails) => void;
					formatName: "GIF" | "video";
				}): Promise<{ handled: boolean; keepDialogOpen: boolean }> => {
					const capabilities = await window.electronAPI.exportV2Probe();
					if (!capabilities.enabled) {
						return { handled: false, keepDialogOpen: true };
					}

					if (
						exportV2Selection.engine === "direct-native" &&
						request.format === "mp4" &&
						!capabilities.videoEncoders.some((encoder) => encoder.available)
					) {
						return { handled: false, keepDialogOpen: true };
					}
					if (
						exportV2Selection.engine === "direct-native" &&
						request.format === "gif" &&
						!capabilities.gif.ffmpegPalettePipeline
					) {
						return { handled: false, keepDialogOpen: true };
					}

					const jobId = `export-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
					exportV2JobIdRef.current = jobId;
					const unsubscribe = window.electronAPI.onExportV2Progress((progress) => {
						if (progress.jobId === jobId) {
							progressThrottler.push(progress);
						}
					});

					try {
						const result = await window.electronAPI.exportV2Start({
							...request,
							jobId,
						});
						progressThrottler.flush();

						if (result.fallbackToLegacy) {
							return { handled: false, keepDialogOpen: true };
						}

						if (result.canceled) {
							dispatchSession({
								type: "set-export-error",
								error: "Save dialog canceled. Reopen export to choose another location.",
							});
							dispatchSession({ type: "set-export-status", status: "canceled" });
							return { handled: true, keepDialogOpen: true };
						}

						if (!result.success || !result.path || !result.details) {
							const errorMessage = result.error || `${formatName} export failed`;
							dispatchSession({ type: "set-export-error", error: errorMessage });
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(errorMessage);
							return { handled: true, keepDialogOpen: true };
						}

						onDetails(result.details);
						dispatchSession({
							type: "set-exported-file-path",
							path: result.path,
						});
						dispatchSession({ type: "set-export-status", status: "saved" });
						if (result.copiedToClipboard) {
							toast.success(`${formatName === "GIF" ? "GIF" : "Video"} copied to clipboard.`);
						} else {
							showExportSuccessToast(result.path);
						}
						await options.onSaved?.(result.path);
						return { handled: true, keepDialogOpen: false };
					} finally {
						unsubscribe();
						if (exportV2JobIdRef.current === jobId) {
							exportV2JobIdRef.current = null;
						}
					}
				};

				if (settings.format === "gif") {
					// GIF Export
					const gifPlan = resolveGifExportPlan(
						sourceMetadata,
						settings.gif,
						aspectRatioValue,
						Math.round(duration * 1000),
					);
					const fileName = ensureFileExtension(videoName, "gif");
					const exportV2Result = await tryExportV2({
						request: {
							sourcePath: videoPath,
							fileName,
							destination: exportV2Destination,
							format: "gif",
							width: gifPlan.width,
							height: gifPlan.height,
							frameRate: gifPlan.frameRate,
							durationMs: Math.round(duration * 1000),
							trimRegions,
							speedRegions,
							compositionPayload,
							audioPlan: {
								mode:
									audioRegions.length > 0 || speedRegions.length > 0 ? "timeline-mix" : "source",
								expectAudio: true,
								sourcePath: videoPath,
								audioRegionCount: audioRegions.length,
								hasSpeedRegions: speedRegions.length > 0,
							},
							validationPolicy: "warn",
							gif: {
								colorCount: gifPlan.colorCount,
								ditherMode: gifPlan.ditherMode,
								motionSensitivity: gifPlan.motionSensitivity,
								loop: gifPlan.loop,
								dedupeFrames: gifPlan.dedupeFrames,
							},
							selection: exportV2Selection,
						},
						onDetails: (details) => {
							dispatchSession({
								type: "set-export-details",
								details: mergeGifExportDetails(gifPlan, details, details.fileSizeBytes),
							});
						},
						formatName: "GIF",
					});

					if (exportV2Result.handled) {
						keepExportDialogOpen = exportV2Result.keepDialogOpen;
					} else {
						const gifExporter = new GifExporter({
							videoUrl: videoPath,
							width: gifPlan.width,
							height: gifPlan.height,
							frameRate: gifPlan.frameRate,
							loop: gifPlan.loop,
							preset: gifPlan.preset,
							dedupeFrames: gifPlan.dedupeFrames,
							colorCount: gifPlan.colorCount,
							ditherMode: gifPlan.ditherMode,
							motionSensitivity: gifPlan.motionSensitivity,
							wallpaper,
							trimRegions,
							speedRegions,
							showShadow: frameShadowOpacity > 0 && (frameShadowSize > 0 || frameShadowBlur > 0),
							shadowIntensity,
							frameShadowSize,
							frameShadowOpacity,
							frameShadowBlur,
							backgroundBlur,
							hideBackground,
							zoomMotionBlur,
							connectZooms,
							deviceMockup: "none",
							frameBorderEnabled,
							frameBorderWidth,
							frameBorderColor,
							frameBorderOpacity,
							borderRadius,
							padding,
							videoPadding: padding,
							cropRegion: effectiveCropRegion,
							aspectRatio,
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
							cursorStyle,
							cursorPack,
							cursorColor,
							cursorOpacity,
							clickEffectsEnabled,
							clickHighlightColor,
							clickHighlightSize,
							clickHighlightOpacity,
							cursorTrailLength,
							cursorTrailOpacity,
							cursorTypeMode,
							cursorTilt,
							hideWhenIdle,
							idleHideDelayMs,
							smoothMovementEnabled,
							cursorMovementStyle,
							cursorSpring,
							highQualitySvgCursors,
							cameraSpring,
							keyboardShortcutPosition,
							keyboardShortcutTheme,
							keyboardShortcutScale,
							keyboardShortcutOpacity,
							keyboardShortcutMaxVisible,
							previewWidth,
							previewHeight,
							webcamPath: resolvedWebcamPath,
							webcamRegion,
							webcamEffects,
							showWebcam,
							mirrorWebcam,
							cameraSizeDuringZoom,
							cameraLayouts,
							captionRegions,
							captionSettings,
							onProgress: progressThrottler.push,
						});

						exporterRef.current = gifExporter as unknown as VideoExporter;
						const result = await gifExporter.export();

						if (result.success && result.blob) {
							progressThrottler.flush();
							dispatchSession({
								type: "set-export-details",
								details: mergeGifExportDetails(gifPlan, result.details, result.blob.size),
							});
							keepExportDialogOpen = await saveExportedBlob({
								blob: result.blob,
								fileName,
								formatName: "GIF",
							});
						} else {
							dispatchSession({
								type: "set-export-error",
								error: result.error || "GIF export failed",
							});
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(result.error || "GIF export failed");
						}
					}
				} else {
					// MP4 Export
					const videoPlan = resolveVideoExportPlan(
						sourceMetadata,
						settings.video,
						aspectRatioValue,
					);
					const fileName = ensureFileExtension(videoName, "mp4");
					const exportV2Result = await tryExportV2({
						request: {
							sourcePath: videoPath,
							fileName,
							destination: exportV2Destination,
							format: "mp4",
							width: videoPlan.width,
							height: videoPlan.height,
							frameRate: videoPlan.frameRate,
							bitrate: videoPlan.bitrate,
							bitrateMode: videoPlan.bitrateMode,
							durationMs: Math.round(duration * 1000),
							trimRegions,
							speedRegions,
							compositionPayload,
							audioPlan: {
								mode:
									audioRegions.length > 0 || speedRegions.length > 0 ? "timeline-mix" : "source",
								expectAudio: true,
								sourcePath: videoPath,
								audioRegionCount: audioRegions.length,
								hasSpeedRegions: speedRegions.length > 0,
							},
							validationPolicy: "warn",
							selection: exportV2Selection,
						},
						onDetails: (details) => {
							dispatchSession({
								type: "set-export-details",
								details: mergeVideoExportDetails(videoPlan, details, details.fileSizeBytes),
							});
						},
						formatName: "video",
					});

					if (exportV2Result.handled) {
						keepExportDialogOpen = exportV2Result.keepDialogOpen;
					} else {
						const exporter = new VideoExporter({
							videoUrl: videoPath,
							width: videoPlan.width,
							height: videoPlan.height,
							frameRate: videoPlan.frameRate,
							bitrate: videoPlan.bitrate,
							codec: videoPlan.codec,
							codecCandidates: videoPlan.codecCandidates,
							encoderCandidates: videoPlan.encoderCandidates,
							fallbackSteps: videoPlan.fallbackSteps,
							wallpaper,
							trimRegions,
							speedRegions,
							showShadow: frameShadowOpacity > 0 && (frameShadowSize > 0 || frameShadowBlur > 0),
							shadowIntensity,
							frameShadowSize,
							frameShadowOpacity,
							frameShadowBlur,
							backgroundBlur,
							hideBackground,
							zoomMotionBlur,
							connectZooms,
							deviceMockup: "none",
							frameBorderEnabled,
							frameBorderWidth,
							frameBorderColor,
							frameBorderOpacity,
							borderRadius,
							padding,
							cropRegion: effectiveCropRegion,
							aspectRatio,
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
							cursorStyle,
							cursorPack,
							cursorColor,
							cursorOpacity,
							clickEffectsEnabled,
							clickHighlightColor,
							clickHighlightSize,
							clickHighlightOpacity,
							cursorTrailLength,
							cursorTrailOpacity,
							cursorTypeMode,
							cursorTilt,
							hideWhenIdle,
							idleHideDelayMs,
							smoothMovementEnabled,
							cursorMovementStyle,
							cursorSpring,
							highQualitySvgCursors,
							cameraSpring,
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
							webcamEffects,
							showWebcam,
							mirrorWebcam,
							cameraSizeDuringZoom,
							cameraLayouts,
							captionRegions,
							captionSettings,
							forceFFmpegDecoder: videoPlan.forceFFmpegDecoder,
							onProgress: progressThrottler.push,
						});

						exporterRef.current = exporter;
						const result = await exporter.export();

						if (result.success && result.blob) {
							progressThrottler.flush();
							dispatchSession({
								type: "set-export-details",
								details: mergeVideoExportDetails(videoPlan, result.details, result.blob.size),
							});
							keepExportDialogOpen = await saveExportedBlob({
								blob: result.blob,
								fileName,
								formatName: "video",
							});
						} else {
							dispatchSession({
								type: "set-export-error",
								error: result.error || "Export failed",
							});
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(result.error || "Export failed");
						}
					}
				}

				await restorePreviewAfterExport(false);
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				dispatchSession({ type: "set-export-error", error: errorMessage });
				dispatchSession({ type: "set-export-status", status: "failed" });
				toast.error(`Export failed: ${errorMessage}`);
			} finally {
				progressThrottler.flush();
				if (!previewRestored) {
					const playback = videoPlaybackRef.current;
					if (playback?.video) {
						playback.video.currentTime = previewRestoreTime;
					}
					await playback
						?.restorePreviewFrame({
							forceReload: false,
							resumePlayback: shouldResumePreviewPlayback,
						})
						.catch(() => undefined);
				}
				if (previewHoldToken) {
					videoPlaybackRef.current?.releasePreviewHold(previewHoldToken);
				}
				dispatchSession({ type: "set-exporting", value: false });
				exporterRef.current = null;
				dispatchSession({ type: "set-export-dialog-open", value: keepExportDialogOpen });
				dispatchSession({ type: "set-export-progress", progress: null });
			}
		},
		[
			videoPath,
			videoName,
			wallpaper,
			trimRegions,
			speedRegions,
			shadowIntensity,
			frameShadowSize,
			frameShadowOpacity,
			frameShadowBlur,
			backgroundBlur,
			hideBackground,
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
			cursorStyle,
			cursorPack,
			cursorColor,
			cursorOpacity,
			clickEffectsEnabled,
			clickHighlightColor,
			clickHighlightSize,
			clickHighlightOpacity,
			cursorTrailLength,
			cursorTrailOpacity,
			cursorTypeMode,
			cursorTilt,
			hideWhenIdle,
			idleHideDelayMs,
			smoothMovementEnabled,
			cursorMovementStyle,
			cursorSpring,
			cameraSpring,
			highQualitySvgCursors,
			keyboardShortcutPosition,
			keyboardShortcutTheme,
			keyboardShortcutScale,
			keyboardShortcutOpacity,
			keyboardShortcutMaxVisible,
			audioRegions,
			frameBorderEnabled,
			frameBorderWidth,
			frameBorderColor,
			frameBorderOpacity,
			borderRadius,
			padding,
			effectiveCropRegion,
			annotationRegions,
			isPlaying,
			aspectRatio,
			effectiveZoomRegions,
			showExportSuccessToast,
			resolvedWebcamPath,
			webcamRegion,
			webcamEffects,
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			cameraLayouts,
			captionRegions,
			captionSettings,
			duration,
			sourceFrameRate,
		],
	);

	const handleOpenExportDialog = useCallback(
		(destination: ExportDestination = "file") => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			if (hasPendingExportSave) {
				dispatchSession({ type: "set-export-dialog-open", value: true });
				dispatchSession({ type: "set-export-status", status: "canceled" });
				dispatchSession({
					type: "set-export-error",
					error: "Save dialog canceled. Click Save Again to save without re-rendering.",
				});
				return;
			}

			const settings = buildDefaultExportSettings();
			if (!settings) {
				return;
			}

			dispatchSession({ type: "set-export-dialog-open", value: true });
			dispatchSession({ type: "set-export-status", status: "exporting" });
			dispatchSession({ type: "set-export-error", error: null });

			if (destination === "clipboard") {
				handleExport(settings, { saveMode: "clipboard" });
			} else {
				handleExport(settings);
			}
		},
		[videoPath, hasPendingExportSave, buildDefaultExportSettings, handleExport],
	);

	const handleExportToClipboard = useCallback(async () => {
		const settings = buildDefaultExportSettings();
		if (!settings) {
			return;
		}

		dispatchSession({ type: "set-quick-share-open", value: false });
		dispatchSession({ type: "set-export-dialog-open", value: true });
		dispatchSession({ type: "set-export-status", status: "exporting" });
		dispatchSession({ type: "set-export-error", error: null });
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

	const {
		handleQuickShareSave,
		handleQuickShareEdit,
		cycleWorkspaceLayout,
		applyPreset,
		handleSavePreset,
		handleConfirmSavePreset,
		handleDeletePreset,
		handleDeleteProject,
		handleConfirmDialogAction,
	} = useVideoEditorProjectActions({
		currentProjectPath,
		videoSourcePath,
		webcamPath,
		customPresets,
		setCustomPresets,
		setWorkspaceLayout,
		sessionState,
		dispatchSession,
		buildCurrentPresetControls,
		applyEditorControls,
		handleOpenExportDialog,
	});

	usePostRecordingActions({
		loading,
		error,
		videoPath,
		duration,
		postRecordingContext,
		postRecordingAutoZoomBootstrap,
		dispatchSession,
		handleOpenExportDialog,
		handleExportToClipboard,
	});

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
		<div className="relative h-screen bg-[#0c0c0f] overflow-hidden">
			{/* Skeleton overlay — fades out */}
			{skeletonVisible && (
				<div
					className="absolute inset-0 z-50 transition-opacity duration-300 ease-out"
					style={{
						opacity: editorReady ? 0 : 1,
						pointerEvents: editorReady ? "none" : "auto",
					}}
				>
					<VideoEditorSkeleton />
				</div>
			)}

			{/* Real editor — fades in once loading is done */}
			{!loading && (
				<div
					className="flex flex-col h-full text-slate-200 selection:bg-[#f59e0b]/30 transition-opacity duration-300 ease-out"
					style={{ opacity: editorReady ? 1 : 0 }}
				>
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
							<Tooltip content="Save Project" shortcut={isMac ? "⌘ + S" : "Ctrl + S"} side="bottom">
								<button
									type="button"
									onClick={() => void handleSaveProject()}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
								>
									<Save className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip content="Open Recordings Folder" side="bottom">
								<button
									type="button"
									onClick={() => void openRecordingsFolder()}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
								>
									<FolderOpen className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip content="Keyboard Shortcuts" side="bottom">
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
									onClick={openConfig}
								>
									<Keyboard className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip content="Delete Project" side="bottom">
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-400/80 hover:text-white cursor-pointer"
									onClick={() => void handleDeleteProject()}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</Tooltip>
						</div>

						{/* Center: editable video name */}
						<div
							className="absolute left-1/2 -translate-x-1/2 flex h-8 max-w-[460px] items-center gap-1"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						>
							{isEditingVideoName ? (
								<>
									<input
										ref={videoNameInputRef}
										type="text"
										value={draftVideoName}
										onChange={(event) => setDraftVideoName(event.target.value)}
										onBlur={handleVideoNameInputBlur}
										onKeyDown={handleVideoNameInputKeyDown}
										aria-label="Video name"
										className="h-7 w-[320px] rounded-md border border-white/10 bg-white/[0.07] px-2.5 text-center text-[13px] font-medium text-white/85 outline-none transition placeholder:text-white/25 focus:border-amber-300/45 focus:bg-white/[0.09] focus:ring-2 focus:ring-amber-300/15"
									/>
									<Tooltip content="Save Name" side="bottom">
										<button
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={commitVideoNameEdit}
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
											aria-label="Save video name"
										>
											<Check className="h-3.5 w-3.5" />
										</button>
									</Tooltip>
									<Tooltip content="Cancel" side="bottom">
										<button
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={cancelVideoNameEdit}
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-white cursor-pointer"
											aria-label="Cancel video name edit"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								</>
							) : (
								<>
									<button
										type="button"
										onClick={startVideoNameEdit}
										onDoubleClick={startVideoNameEdit}
										className="min-w-0 max-w-[400px] truncate rounded-md px-2 py-1 text-[13px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/85 cursor-text"
										title={videoName}
										aria-label="Edit video name"
									>
										{videoName}
									</button>
									<Tooltip content="Edit Name" side="bottom">
										<button
											type="button"
											onClick={startVideoNameEdit}
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-70 transition hover:bg-white/8 hover:text-white hover:opacity-100 cursor-pointer"
											aria-label="Edit video name"
										>
											<Pencil className="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								</>
							)}
						</div>

						{/* Right: Undo/Redo, Presets, Layout, Settings, Export */}
						<div
							className="ml-auto flex items-center gap-0.5"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						>
							{/* Undo / Redo */}
							<Tooltip content="Undo" shortcut={isMac ? "⌘ + Z" : "Ctrl + Z"} side="bottom">
								<button
									type="button"
									onClick={handleUndo}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									disabled={historyPastRef.current.length === 0}
								>
									<Undo2 className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip content="Redo" shortcut={isMac ? "⌘ + ⇧ + Z" : "Ctrl + Y"} side="bottom">
								<button
									type="button"
									onClick={handleRedo}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/8 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									disabled={historyFutureRef.current.length === 0}
								>
									<Redo2 className="h-4 w-4" />
								</button>
							</Tooltip>

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
								<DropdownMenuContent
									align="end"
									className="bg-[#1a1a1a] border-white/10 min-w-[160px]"
								>
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
							<Tooltip content="Toggle Layout" side="bottom">
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/8 hover:text-white cursor-pointer"
									onClick={cycleWorkspaceLayout}
								>
									<SplitSquareHorizontal className="h-4 w-4" />
								</button>
							</Tooltip>

							{/* Language Switcher */}
							<LanguageSwitcher />

							<div className="w-[1px] h-5 bg-white/10 mx-1" />

							{/* Export button - amber */}
							<Tooltip
								content="Export Video or GIF"
								shortcut={isMac ? "⌘ + E" : "Ctrl + E"}
								side="bottom"
							>
								<button
									type="button"
									onClick={() => dispatchSession({ type: "set-export-settings-open", value: true })}
									className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-white font-semibold text-xs transition bg-[#f59e0b] hover:bg-[#d97706] cursor-pointer shadow-lg shadow-amber-500/20"
								>
									<Download className="h-3.5 w-3.5" />
									<span>Export</span>
								</button>
							</Tooltip>
						</div>
					</div>

					<PanelGroup ref={panelGroupRef} direction="vertical" className="flex-1 min-h-0">
						{/* Top section: Video preview + Settings sidebar */}
						<Panel defaultSize={workspaceLayoutSizes[0]} minSize={35}>
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
											hideBackground={hideBackground}
											zoomRegions={effectiveZoomRegions}
											selectedZoomId={selectedZoomId}
											onSelectZoom={handleSelectZoom}
											onZoomFocusChange={handleZoomFocusChange}
											isPlaying={isPlaying}
											frameShadowSize={frameShadowSize}
											frameShadowOpacity={frameShadowOpacity}
											frameShadowBlur={frameShadowBlur}
											previewQuality={isExporting ? "low" : previewQuality}
											onPreviewQualitySwitchFailed={handlePreviewQualitySwitchFailed}
											backgroundBlur={backgroundBlur}
											zoomMotionBlur={zoomMotionBlur}
											connectZooms={connectZooms}
											frameBorderEnabled={frameBorderEnabled}
											frameBorderWidth={frameBorderWidth}
											frameBorderColor={frameBorderColor}
											frameBorderOpacity={frameBorderOpacity}
											borderRadius={borderRadius}
											padding={padding}
											cropRegion={effectiveCropRegion}
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
											cursorStyle={cursorStyle}
											cursorPack={cursorPack}
											cursorColor={cursorColor}
											cursorOpacity={cursorOpacity}
											clickEffectsEnabled={clickEffectsEnabled}
											clickHighlightColor={clickHighlightColor}
											clickHighlightSize={clickHighlightSize}
											clickHighlightOpacity={clickHighlightOpacity}
											cursorTrailLength={cursorTrailLength}
											cursorTrailOpacity={cursorTrailOpacity}
											cursorTypeMode={cursorTypeMode}
											cursorTilt={cursorTilt}
											hideWhenIdle={hideWhenIdle}
											idleHideDelayMs={idleHideDelayMs}
											smoothMovementEnabled={smoothMovementEnabled}
											cursorMovementStyle={cursorMovementStyle}
											cursorSpring={cursorSpring}
											highQualitySvgCursors={highQualitySvgCursors}
											cameraSpring={cameraSpring}
											webcamPath={resolvedWebcamPath}
											webcamRegion={webcamRegion}
											webcamEffects={webcamEffects}
											webcamPreviewMode={isExporting ? "power-saving" : webcamPreviewMode}
											showWebcam={showWebcam}
											mirrorWebcam={mirrorWebcam}
											cameraSizeDuringZoom={cameraSizeDuringZoom}
											cameraLayouts={cameraLayouts}
											onWebcamHealthMetricsChange={setWebcamHealthMetrics}
											onWebcamPositionChange={handleWebcamPositionChange}
											onWebcamSizeChange={handleWebcamSizeChange}
											webcamSelected={webcamSelected}
											selectedCameraLayoutId={selectedCameraLayoutId}
											onSelectWebcam={handleSelectWebcam}
											captionRegions={captionRegions}
											captionSettings={captionSettings}
											isEditingCaptionPosition={isEditingCaptionPosition}
											onCaptionPositionOverrideChange={handleCaptionPositionOverrideChange}
										/>
									</div>
								</div>

								{/* Right section: settings sidebar */}
								<SettingsPanel
									selected={wallpaper}
									onWallpaperChange={setWallpaper}
									previewQuality={previewQuality}
									onPreviewQualityChange={setPreviewQuality}
									selectedZoomDepth={
										selectedZoomId ? zoomRegions.find((z) => z.id === selectedZoomId)?.depth : null
									}
									selectedZoomMode={
										selectedZoomId
											? (zoomRegions.find((z) => z.id === selectedZoomId)?.mode ??
												DEFAULT_ZOOM_MODE)
											: null
									}
									onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
									onZoomModeChange={handleZoomModeChange}
									selectedZoomId={selectedZoomId}
									onZoomDelete={handleZoomDelete}
									selectedTrimId={selectedTrimId}
									onTrimDelete={handleTrimDelete}
									frameShadowSize={frameShadowSize}
									onFrameShadowSizeChange={setFrameShadowSize}
									frameShadowOpacity={frameShadowOpacity}
									onFrameShadowOpacityChange={setFrameShadowOpacity}
									frameShadowBlur={frameShadowBlur}
									onFrameShadowBlurChange={setFrameShadowBlur}
									backgroundBlur={backgroundBlur}
									hideBackground={hideBackground}
									onHideBackgroundChange={setHideBackground}
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
									cursorPack={cursorPack}
									onCursorPackChange={setCursorPack}
									cursorTypeMode={cursorTypeMode}
									onCursorTypeModeChange={setCursorTypeMode}
									cursorTilt={cursorTilt}
									onCursorTiltChange={setCursorTilt}
									hideWhenIdle={hideWhenIdle}
									onHideWhenIdleChange={setHideWhenIdle}
									idleHideDelayMs={idleHideDelayMs}
									onIdleHideDelayMsChange={setIdleHideDelayMs}
									smoothMovementEnabled={smoothMovementEnabled}
									onSmoothMovementEnabledChange={setSmoothMovementEnabled}
									cursorMovementStyle={cursorMovementStyle}
									onCursorMovementStyleChange={setCursorMovementStyle}
									cursorSpring={cursorSpring}
									onCursorSpringChange={setCursorSpring}
									cameraSpring={cameraSpring}
									onCameraSpringChange={setCameraSpring}
									highQualitySvgCursors={highQualitySvgCursors}
									onHighQualitySvgCursorsChange={setHighQualitySvgCursors}
									cursorColor={cursorColor}
									onCursorColorChange={setCursorColor}
									cursorOpacity={cursorOpacity}
									onCursorOpacityChange={setCursorOpacity}
									clickEffectsEnabled={clickEffectsEnabled}
									onClickEffectsEnabledChange={setClickEffectsEnabled}
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
									frameBorderEnabled={frameBorderEnabled}
									onFrameBorderEnabledChange={setFrameBorderEnabled}
									frameBorderWidth={frameBorderWidth}
									onFrameBorderWidthChange={setFrameBorderWidth}
									frameBorderColor={frameBorderColor}
									onFrameBorderColorChange={setFrameBorderColor}
									frameBorderOpacity={frameBorderOpacity}
									onFrameBorderOpacityChange={setFrameBorderOpacity}
									borderRadius={borderRadius}
									onBorderRadiusChange={setBorderRadius}
									padding={padding}
									onPaddingChange={setPadding}
									cropRegion={cropRegion}
									baseCropRegion={legacyCaptureCorrectionCrop}
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
									webcamEffects={webcamEffects}
									webcamPreviewMode={webcamPreviewMode}
									webcamHealthMetrics={webcamHealthMetrics}
									onWebcamPreviewModeChange={setWebcamPreviewMode}
									onWebcamRegionChange={handleWebcamRegionChange}
									onWebcamEffectsChange={handleWebcamEffectsChange}
									onApplyWebcamPreset={handleApplyWebcamPreset}
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
									onCaptionImport={handleCaptionImport}
									onApplyCaptionPreset={handleApplyCaptionPreset}
									isEditingCaptionPosition={isEditingCaptionPosition}
									onToggleCaptionPositionEditing={handleToggleCaptionPositionEditing}
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
						<Panel defaultSize={workspaceLayoutSizes[1]} minSize={12}>
							<div className="h-[calc(100%-0.5rem)] min-h-0 mx-4 mb-2 bg-[#0c0c0f] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
								<TimelineEditor
									videoDuration={duration}
									currentTime={currentTime}
									videoPath={videoPath}
									hasAudio={videoHasAudio}
									clipVolume={clipVolume}
									onClipVolumeChange={setClipVolume}
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

					<ExportSettingsDialog
						isOpen={showExportSettings}
						onClose={() => dispatchSession({ type: "set-export-settings-open", value: false })}
						exportFormat={exportFormat}
						onExportFormatChange={setExportFormat}
						exportDestination={exportDestination}
						onExportDestinationChange={setExportDestination}
						videoExportSettings={videoExportSettings}
						onVideoExportSettingsChange={setVideoExportSettings}
						gifExportSettings={gifExportSettings}
						onGifExportSettingsChange={setGifExportSettings}
						resolvedVideoPlan={resolveVideoExportPlan(
							buildSourceVideoMetadata({
								width: videoPlaybackRef.current?.video?.videoWidth || 1920,
								height: videoPlaybackRef.current?.video?.videoHeight || 1080,
								frameRate: sourceFrameRate,
								durationMs: Math.round(duration * 1000),
							}),
							videoExportSettings,
							getAspectRatioValue(
								aspectRatio,
								(videoPlaybackRef.current?.video?.videoWidth || 1920) /
									(videoPlaybackRef.current?.video?.videoHeight || 1080),
							),
						)}
						resolvedGifPlan={resolveGifExportPlan(
							buildSourceVideoMetadata({
								width: videoPlaybackRef.current?.video?.videoWidth || 1920,
								height: videoPlaybackRef.current?.video?.videoHeight || 1080,
								frameRate: sourceFrameRate,
								durationMs: Math.round(duration * 1000),
							}),
							gifExportSettings,
							getAspectRatioValue(
								aspectRatio,
								(videoPlaybackRef.current?.video?.videoWidth || 1920) /
									(videoPlaybackRef.current?.video?.videoHeight || 1080),
							),
							Math.round(duration * 1000),
						)}
						onExport={handleOpenExportDialog}
					/>

					<ExportDialog
						isOpen={showExportDialog}
						onClose={handleExportDialogClose}
						progress={exportProgress}
						isExporting={isExporting}
						exportStatus={exportStatus}
						error={exportError}
						onCancel={handleCancelExport}
						onRetrySave={handleRetrySaveExport}
						canRetrySave={hasPendingExportSave}
						exportFormat={exportFormat}
						details={exportDetails}
						exportedFilePath={exportedFilePath}
					/>

					<QuickShareDialog
						isOpen={showQuickShare}
						onClose={() => dispatchSession({ type: "set-quick-share-open", value: false })}
						onSave={handleQuickShareSave}
						onCopy={() => void handleExportToClipboard()}
						onEdit={handleQuickShareEdit}
					/>

					<PresetNameDialog
						isOpen={sessionState.modals.presetDialog.isOpen}
						name={sessionState.modals.presetDialog.name}
						onNameChange={(name) => dispatchSession({ type: "set-preset-dialog-name", name })}
						onCancel={() => dispatchSession({ type: "close-preset-dialog" })}
						onConfirm={handleConfirmSavePreset}
					/>

					<ConfirmActionDialog
						dialog={sessionState.modals.confirmDialog}
						onCancel={() => dispatchSession({ type: "close-confirm-dialog" })}
						onConfirm={() => void handleConfirmDialogAction()}
					/>
				</div>
			)}
		</div>
	);
}
