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
	SlidersHorizontal,
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
import { type AppLocale, LOCALE_LABELS, SUPPORTED_LOCALES } from "@/i18n/config";
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
	getGifExportSettingsForPreset,
	getVideoExportSettingsForPreset,
	QUICK_VIDEO_QUALITIES,
	type QuickGifSettings,
	type QuickVideoQuality,
	type QuickVideoSettings,
	resolveGifExportPlan,
	resolveQuickBaseDimensions,
	resolveQuickVideoDimensions,
	resolveVideoExportPlan,
	StreamingVideoDecoder,
	selectExportV2Engine,
	toGifExportSettings,
	toVideoExportSettings,
	type VideoExportSettings,
} from "@/lib/exporter";
import { VideoExporter } from "@/lib/exporter/videoExporter";
import {
	deriveVideoNameFromPath,
	ensureFileExtension,
	normalizeVideoDisplayName,
} from "@/lib/fileNames";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import { AutoPolishPanel } from "./AutoPolishPanel";
import { type AudioMixSettings, DEFAULT_AUDIO_MIX_SETTINGS } from "./audioMix";
import { loadAudioSelectionDurationMs } from "./audioRegionUtils";
import { type AutoPolishContentType, buildAutoPolishResult } from "./autoPolish";
import { buildCaptionSidecar } from "./captionSidecar";
import { ConfirmActionDialog, MissingCursorDataDialog, PresetNameDialog } from "./EditorDialogs";
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
import { ExportDialog } from "./export/ExportDialog";
import { createExportProgressThrottler } from "./exportProgressThrottler";
import {
	buildSourceVideoMetadata,
	mergeGifExportDetails,
	mergeVideoExportDetails,
	resolveSourceFrameRate,
} from "./exportUtils";
import { FeedbackDialog } from "./FeedbackDialog";
import { getLegacyShadowIntensityFromFrameShadow } from "./frameEffects";
import { deriveKeyboardShortcutCallouts } from "./keyboardShortcuts";
import { ProjectBrowserDialog } from "./ProjectBrowserDialog";
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
	withLegacyZoomTiming,
} from "./projectPersistence";
import { captureProjectThumbnail } from "./projectThumbnail";
import { QuickShareDialog } from "./QuickShareDialog";
import SettingsPanel from "./SettingsPanel";
import {
	applyAutoBeautify,
	applyScenePreset,
	type BeautifyContext,
	buildAutoZoomRegionsFromTelemetry,
} from "./scenePresets";
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
	MOTION_PRESETS,
	type MotionPresetId,
	type PaddingSides,
	type PaddingValue,
	type PlaybackSpeed,
	type PreviewQuality,
	type ScenePresetId,
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
import { detectMotionPreset, motionPresetToCursorSpring } from "./videoPlayback/cursorV2";
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
	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
			title={t("common.app.language", "Language")}
			aria-label={t("common.app.language", "Language")}
		>
			<Languages className="h-4 w-4" />
			<span className="text-label font-medium">
				{LOCALE_LABELS[locale as AppLocale] ?? locale.toUpperCase()}
			</span>
		</button>
	);
}

/** Preview / timeline split when the timeline is expanded. */
const EXPANDED_TIMELINE_LAYOUT = [40, 60];

export default function VideoEditor() {
	const { t } = useI18n();
	const tSettings = useScopedT("settings");
	const tDialogs = useScopedT("dialogs");
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
			quickExport: stored.quickExport,
			exportFormat: stored.quickExport.format,
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
	const [audioMix, setAudioMix] = useState<AudioMixSettings>(DEFAULT_AUDIO_MIX_SETTINGS);
	const [rightSidebarSection, setRightSidebarSection] = useState<"edit" | "polish">("edit");
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
	// Clip volume/mute lives on the saved recording-audio track so it persists and exports.
	const primaryAudioTrack = audioMix.tracks.find((track) => track.kind === "primary");
	const clipVolume = primaryAudioTrack
		? primaryAudioTrack.muted
			? 0
			: primaryAudioTrack.volume
		: 1;
	const setClipVolume = useCallback((volume: number) => {
		setAudioMix((mix) => ({
			...mix,
			tracks: mix.tracks.map((track) =>
				track.kind === "primary"
					? { ...track, muted: volume <= 0, volume: volume > 0 ? volume : track.volume }
					: track,
			),
		}));
	}, []);
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
	const [zoomTemporalBlur, setZoomTemporalBlur] = useState(
		initialEditorPreferences.zoomTemporalBlur,
	);
	const [connectZooms, setConnectZooms] = useState(initialEditorPreferences.connectZooms);
	const [zoomTiming, setZoomTiming] = useState(initialEditorPreferences.zoomTiming);
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
	const [cursorClickStyle, setCursorClickStyle] = useState(
		initialEditorPreferences.cursorClickStyle,
	);
	const motionPreset = useMemo(
		() =>
			detectMotionPreset({
				zoomInDurationMs: zoomTiming.zoomInDurationMs,
				zoomOutDurationMs: zoomTiming.zoomOutDurationMs,
				cursorSize,
				cursorSmoothing,
				cursorClickBounce,
				cursorClickBounceDurationMs: cursorClickStyle.bounceDurationMs,
				cursorSpring,
			}),
		[zoomTiming, cursorSize, cursorSmoothing, cursorClickBounce, cursorClickStyle, cursorSpring],
	);
	const applyMotionPreset = useCallback((presetId: MotionPresetId) => {
		const preset = MOTION_PRESETS[presetId];
		setZoomTiming((timing) => ({
			...timing,
			zoomInDurationMs: preset.zoomInDurationMs,
			zoomOutDurationMs: preset.zoomOutDurationMs,
		}));
		setCursorSize(preset.cursorSize);
		setCursorSmoothing(preset.cursorSmoothing);
		setCursorClickBounce(preset.cursorClickBounce);
		setCursorClickStyle((style) => ({
			...style,
			bounceDurationMs: preset.cursorClickBounceDurationMs,
		}));
		setSmoothMovementEnabled(true);
		setCursorMovementStyle("custom");
		setCursorSpring(motionPresetToCursorSpring(preset));
	}, []);
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
	const [paddingSides, setPaddingSides] = useState<PaddingSides | null>(
		initialEditorPreferences.paddingSides,
	);
	const effectivePadding: PaddingValue = paddingSides ?? padding;
	const [cropRegion, setCropRegion] = useState<CropRegion>(initialEditorPreferences.cropRegion);
	const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [keyboardTelemetry, setKeyboardTelemetry] = useState<KeyboardTelemetrySample[]>([]);
	const [keyboardTelemetryPlatform, setKeyboardTelemetryPlatform] =
		useState<KeyboardPlatform>("win32");
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
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
	const [quickVideoExport, setQuickVideoExport] = useState<QuickVideoSettings>(
		initialEditorPreferences.quickExport.video,
	);
	const [quickGifExport, setQuickGifExport] = useState<QuickGifSettings>(
		initialEditorPreferences.quickExport.gif,
	);
	const [includeCaptionSidecar, setIncludeCaptionSidecar] = useState(false);
	const [exportAnnouncements, setExportAnnouncements] = useState<string[]>([]);
	useEffect(() => {
		let cancelled = false;
		void window.electronAPI
			?.getAnnouncements?.()
			.then((announcements) => {
				if (cancelled) return;
				setExportAnnouncements(
					announcements
						.filter((announcement) => announcement.presentation === "export")
						.map((announcement) =>
							[announcement.title, announcement.body].filter(Boolean).join(" — ").slice(0, 220),
						),
				);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);
	const [scenePresetId, setScenePresetId] = useState<ScenePresetId | undefined>(undefined);
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
	// Panels are sized in percent; keep the settings sidebar usable on narrow windows.
	const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const onResize = () => setViewportWidth(window.innerWidth);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	const sidebarMinSize = Math.min(55, Math.max(20, (360 / Math.max(1, viewportWidth - 24)) * 100));
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
				name: t("editor.shell.balanced", "Balanced"),
				controls: normalizeProjectEditor({}),
			},
			{
				id: "preset-cinematic",
				name: t("editor.shell.cinematic", "Cinematic"),
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
				name: t("editor.shell.social", "Social"),
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
		[t],
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
				zoomTemporalBlur,
				connectZooms,
				zoomTiming,
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
				cursorClickStyle,
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
				borderRadius,
				frameBorderEnabled,
				frameBorderWidth,
				frameBorderColor,
				frameBorderOpacity,
				padding,
				paddingSides,
				cropRegion,
				zoomRegions,
				trimRegions,
				cutPoints,
				speedRegions,
				annotationRegions,
				audioRegions,
				aspectRatio,
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
				scenePresetId,
				audioMix,
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
			zoomTemporalBlur,
			connectZooms,
			zoomTiming,
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
			cursorClickStyle,
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
			borderRadius,
			frameBorderEnabled,
			frameBorderWidth,
			frameBorderColor,
			frameBorderOpacity,
			padding,
			paddingSides,
			cropRegion,
			zoomRegions,
			trimRegions,
			cutPoints,
			speedRegions,
			annotationRegions,
			audioRegions,
			aspectRatio,
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
			scenePresetId,
			audioMix,
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
			setZoomTemporalBlur(controls.zoomTemporalBlur);
			setConnectZooms(controls.connectZooms);
			setZoomTiming(controls.zoomTiming);
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
			setCursorClickStyle(controls.cursorClickStyle);
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
			setPaddingSides(controls.paddingSides);
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
			setScenePresetId(controls.scenePresetId);

			if (options.includeTimeline) {
				// Clip volume belongs to this video, like the timeline; presets leave it alone.
				setAudioMix(controls.audioMix);
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
			...buildCurrentPresetControls(),
			selectedCameraLayoutId,
			webcamSelected,
			selectedZoomId,
			selectedSpeedId,
			selectedAnnotationId,
			selectedAudioId,
			selectedCaptionId,
		};
	}, [
		buildCurrentPresetControls,
		selectedCameraLayoutId,
		webcamSelected,
		selectedZoomId,
		selectedSpeedId,
		selectedAnnotationId,
		selectedAudioId,
		selectedCaptionId,
	]);

	const applyHistorySnapshot = useCallback(
		(snapshot: EditorHistorySnapshot) => {
			const cloned = cloneEditorHistorySnapshot(snapshot);
			applyEditorControls(cloned, { includeTimeline: true });
			setSelectedCameraLayoutId(cloned.selectedCameraLayoutId);
			setWebcamSelected(cloned.webcamSelected);
			setSelectedZoomId(cloned.selectedZoomId);
			setSelectedSpeedId(cloned.selectedSpeedId);
			setSelectedAnnotationId(cloned.selectedAnnotationId);
			setSelectedAudioId(cloned.selectedAudioId);
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
		[applyEditorControls],
	);

	const { canUndo, canRedo, handleUndo, handleRedo, resetHistory } = useEditorHistory({
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
			const normalizedEditor = normalizeProjectEditor(
				withLegacyZoomTiming(project.version, project.editor),
			);
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

			resetHistory();
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
			resetHistory,
		],
	);

	// What a save would write right now. The unsaved-changes check compares this same snapshot,
	// so saving and change detection can't disagree about which fields matter.
	const currentProjectArtifacts = useMemo(() => {
		const sourcePath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		if (!sourcePath) {
			return null;
		}
		return editorPersistenceService.buildProjectArtifacts({
			sourcePath,
			videoName,
			editor: { ...buildCurrentPresetControls(), webcamPath: webcamPath ?? undefined },
			webcamSessionMetadata: webcamSessionMetadata ?? undefined,
		});
	}, [
		buildCurrentPresetControls,
		videoPath,
		videoSourcePath,
		videoName,
		webcamPath,
		webcamSessionMetadata,
	]);
	const currentProjectSnapshot = currentProjectArtifacts?.projectSnapshot ?? null;

	// A recording never saved as a project has no saved snapshot to compare with; any edit made
	// since it opened (undo history is reset on load) counts as unsaved work.
	const hasUnsavedChanges = currentProjectPath
		? editorPersistenceService.hasUnsavedChanges({
				currentProjectPath,
				currentProjectSnapshot,
				lastSavedSnapshot,
			})
		: canUndo;

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
							resetHistory();
							// Reset every editor control (and timeline data) to defaults so
							// a brand-new recording never inherits the previous video's
							// tweaks. Users restore prior settings via presets.
							const newRecordingEditor = normalizeProjectEditor({});
							applyEditorControls(newRecordingEditor, { includeTimeline: true });
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
							resetHistory();
							applyEditorControls(normalizeProjectEditor({}), {
								includeTimeline: true,
							});
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
		resetHistory,
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
			quickExport: { format: exportFormat, video: quickVideoExport, gif: quickGifExport },
		});
	}, [
		previewQuality,
		webcamPreviewMode,
		customPresets,
		exportFormat,
		quickVideoExport,
		quickGifExport,
	]);

	useEffect(() => {
		return () => {
			editorPreferencesService.flush();
		};
	}, []);

	const saveProject = useCallback(
		async (forceSaveAs: boolean): Promise<boolean> => {
			if (!videoPath) {
				toast.error(t("editor.shell.noVideoLoaded", "No video loaded"));
				return false;
			}

			const projectArtifacts = currentProjectArtifacts;
			if (!projectArtifacts) {
				toast.error(
					t("editor.shell.unableToDetermineSource", "Unable to determine source video path"),
				);
				return false;
			}

			const thumbnail = captureProjectThumbnail(videoPlaybackRef.current?.app ?? null);
			const result = await window.electronAPI.saveProjectFile(
				thumbnail ? { ...projectArtifacts.projectData, thumbnail } : projectArtifacts.projectData,
				projectArtifacts.fileNameBase,
				forceSaveAs ? undefined : (currentProjectPath ?? undefined),
			);

			if (result.canceled) {
				toast.info(t("editor.shell.projectSaveCanceled", "Project save canceled"));
				return false;
			}

			if (!result.success) {
				toast.error(
					result.message || t("editor.shell.failedToSaveProject", "Failed to save project"),
				);
				return false;
			}

			if (result.path) {
				dispatchSession({ type: "set-current-project-path", path: result.path });
			}
			dispatchSession({
				type: "set-last-saved-snapshot",
				snapshot: projectArtifacts.projectSnapshot,
			});

			toast.success(`Project saved to ${result.path}`);
			return true;
		},
		[videoPath, currentProjectArtifacts, currentProjectPath, t],
	);

	const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
	const { handleSaveProject, handleLoadProject, handleOpenProjectAtPath } =
		useVideoEditorProjectFileActions({
			hasUnsavedChanges,
			isExporting,
			isTranscribing,
			saveProject,
			applyLoadedProject,
		});

	const cursorTelemetryLoadedForRef = useRef<string | null>(null);
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
					cursorTelemetryLoadedForRef.current = videoPath;
					setCursorTelemetryLoadSettled(true);
				}
			}
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
		};
	}, [videoPath]);

	// A fresh recording with no cursor samples means tracking failed; say so once per recording.
	const [missingCursorDataOpen, setMissingCursorDataOpen] = useState(false);
	const missingCursorDataShownForRef = useRef<string | null>(null);
	useEffect(() => {
		if (!cursorTelemetryLoadSettled || !videoPath || cursorTelemetry.length > 0) return;
		if (cursorTelemetryLoadedForRef.current !== videoPath) return;
		const recordingPath = postRecordingContext?.recordingPath;
		if (!recordingPath || toFileUrl(recordingPath) !== videoPath) return;
		if (missingCursorDataShownForRef.current === videoPath) return;
		missingCursorDataShownForRef.current = videoPath;
		setMissingCursorDataOpen(true);
	}, [cursorTelemetryLoadSettled, cursorTelemetry.length, postRecordingContext, videoPath]);

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
			zoomTiming,
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
	}, [loopCursor, zoomRegions, displayedTimelineWindow, connectZooms, zoomTiming]);

	const buildBeautifyContext = useCallback((): BeautifyContext => {
		const video = videoPlaybackRef.current?.video;
		const width = video?.videoWidth || sourceVideoWidth || 1920;
		const height = video?.videoHeight || sourceVideoHeight || 1080;
		return {
			sourceWidth: width,
			sourceHeight: height,
			durationMs: Math.max(0, Math.round(duration * 1000)),
			aspectRatio,
			hasCursorTelemetry: effectiveCursorTelemetry.length >= 2,
			cursorTelemetry: effectiveCursorTelemetry,
			hasWebcam: Boolean(resolvedWebcamPath),
			hasCaptions: captionRegions.length > 0,
			existingZoomCount: zoomRegions.length,
		};
	}, [
		aspectRatio,
		captionRegions.length,
		duration,
		effectiveCursorTelemetry,
		resolvedWebcamPath,
		sourceVideoHeight,
		sourceVideoWidth,
		zoomRegions.length,
	]);

	const applyPresetUpdates = useCallback(
		(updates: Partial<ReturnType<typeof normalizeProjectEditor>>) => {
			const nextEditor = normalizeProjectEditor({
				...buildCurrentPresetControls(),
				...updates,
			});
			applyEditorControls(nextEditor, { includeTimeline: true });
			nextZoomIdRef.current = deriveNextId(
				"zoom",
				nextEditor.zoomRegions.map((region) => region.id),
			);
		},
		[applyEditorControls, buildCurrentPresetControls],
	);

	const handleApplyScenePreset = useCallback(
		(presetId: ScenePresetId) => {
			const currentEditor = buildCurrentPresetControls();
			const updates = applyScenePreset(currentEditor, buildBeautifyContext(), presetId);
			applyPresetUpdates(updates);
			toast.success(t("editor.shell.scenePresetApplied", "Scene preset applied"));
		},
		[applyPresetUpdates, buildBeautifyContext, buildCurrentPresetControls, t],
	);

	const handleAutoBeautify = useCallback(
		(options: { regenerateZooms?: boolean } = {}) => {
			const currentEditor = buildCurrentPresetControls();
			const result = applyAutoBeautify(currentEditor, buildBeautifyContext(), {
				regenerateZooms: options.regenerateZooms,
				nextZoomIndex: nextZoomIdRef.current,
			});
			applyPresetUpdates(result.updates);
			const zoomMessage =
				result.zoomStatus === "created"
					? ` Added ${result.zoomCount} smart zoom${result.zoomCount === 1 ? "" : "s"}.`
					: result.zoomStatus === "preserved"
						? " Existing zooms were preserved."
						: " No smart zooms were available.";
			toast.success(t("editor.shell.autoBeautifyApplied", "Auto Beautify applied"), {
				description: zoomMessage,
			});
		},
		[applyPresetUpdates, buildBeautifyContext, buildCurrentPresetControls, t],
	);

	const handleAutoPolish = useCallback(
		(contentType: AutoPolishContentType) => {
			const result = buildAutoPolishResult({
				aspectRatio,
				durationMs: Math.max(0, Math.round(duration * 1000)),
				cursorTelemetry: effectiveCursorTelemetry,
				captionTrack,
				contentType,
			});
			if (result.zoomRegions.length > 0) {
				setZoomRegions(result.zoomRegions);
				nextZoomIdRef.current = deriveNextId(
					"zoom",
					result.zoomRegions.map((region) => region.id),
				);
			}
			setShowCursor(result.showCursor);
			setVideoExportSettings(getVideoExportSettingsForPreset(result.exportPreset));
			setGifExportSettings(
				getGifExportSettingsForPreset(
					result.exportPreset === "fast-share"
						? "small-share"
						: result.exportPreset === "master"
							? "quality"
							: result.exportPreset,
				),
			);
			toast.success(t("editor.shell.autoPolishApplied", "Auto Polish applied"), {
				description: `${contentType.split("-").join(" ")} preset with ${result.zoomRegions.length} zoom${result.zoomRegions.length === 1 ? "" : "s"}.`,
			});
		},
		[aspectRatio, captionTrack, duration, effectiveCursorTelemetry, t],
	);

	const handleRegenerateSmartZooms = useCallback(() => {
		const context = buildBeautifyContext();
		const nextZoomRegions = buildAutoZoomRegionsFromTelemetry(context, 1);
		if (nextZoomRegions.length === 0) {
			toast.info(t("editor.shell.noSmartZoomsFound", "No smart zooms found for this recording."));
			return;
		}
		setZoomRegions(nextZoomRegions);
		setSelectedZoomId(null);
		setScenePresetId((current) => current ?? "custom");
		nextZoomIdRef.current = deriveNextId(
			"zoom",
			nextZoomRegions.map((region) => region.id),
		);
		toast.success(t("editor.shell.smartZoomsRegenerated", "Smart zooms regenerated"), {
			description: `Created ${nextZoomRegions.length} zoom region${
				nextZoomRegions.length === 1 ? "" : "s"
			}.`,
		});
	}, [buildBeautifyContext, t]);

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
				mode: suggestion.mode ?? "cursor-follow",
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
		setSelectedSpeedId(null);
		setSelectedAnnotationId(null);
		setSelectedAudioId(null);
	}, []);

	const handleSelectCameraLayout = useCallback((id: string | null) => {
		setSelectedCameraLayoutId(id);
		if (id) {
			setWebcamSelected(false);
			setSelectedZoomId(null);
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
		setSelectedSpeedId(null);
		setSelectedCameraLayoutId(null);
		setWebcamSelected(false);
		setSelectedAnnotationId(null);
	}, []);

	const handleZoomSuggested = useCallback((span: Span, focus: ZoomFocus, mode?: ZoomMode) => {
		const id = `zoom-${nextZoomIdRef.current++}`;
		const newRegion: ZoomRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			depth: DEFAULT_ZOOM_DEPTH,
			focus: clampFocusToDepth(focus, DEFAULT_ZOOM_DEPTH),
			mode: mode ?? "cursor-follow",
			tracking: DEFAULT_CURSOR_FOLLOW_TRACKING,
		};
		setZoomRegions((prev) => [...prev, newRegion]);
		setSelectedZoomId(id);
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
						const focus = simulatedCursor
							? clampFocusToDepth(
									{ cx: simulatedCursor.rawCx, cy: simulatedCursor.rawCy },
									region.depth,
								)
							: resolveZoomRegionFocus(region, simulatedCursor, region.focus, 0).focus;
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

	const handleSelectSpeed = useCallback((id: string | null) => {
		setSelectedSpeedId(id);
		if (id) {
			setSelectedZoomId(null);
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
				toast.error(t("editor.shell.couldNotReadAudio", "Could not read audio file"), {
					description: t(
						"editor.shell.theSelectedAudioCould",
						"The selected audio could not be loaded.",
					),
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
				toast.error(t("editor.shell.cannotPlaceAudioHere", "Cannot place audio here"), {
					description: t(
						"editor.shell.audioRegionAlreadyExists",
						"Audio region already exists at this location or not enough space available.",
					),
				});
				return;
			}

			const shouldLoop = selection.loop ?? selection.sourceType === "built-in";
			const actualDuration = shouldLoop
				? Math.min(gapToNext, totalMs - startPos)
				: Math.min(resolvedDurationMs, gapToNext, totalMs - startPos);
			if (actualDuration <= 0) {
				toast.error(t("editor.shell.cannotPlaceAudioHere", "Cannot place audio here"), {
					description: t(
						"editor.shell.thereIsNoRoom",
						"There is no room left at the current playhead position.",
					),
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
			setSelectedAnnotationId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
		},
		[audioRegions, currentTime, duration, t],
	);

	const [timelineExpanded, setTimelineExpanded] = useState(false);
	const handleToggleTimelineExpanded = useCallback(() => {
		const next = !timelineExpanded;
		panelGroupRef.current?.setLayout(next ? EXPANDED_TIMELINE_LAYOUT : workspaceLayoutSizes);
		setTimelineExpanded(next);
	}, [timelineExpanded, workspaceLayoutSizes]);

	const handleSeparateClipAudio = useCallback(() => {
		const sourcePath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		const totalMs = Math.round(duration * 1000);
		if (!sourcePath || totalMs <= 0) return;
		const id = `audio-${nextAudioIdRef.current++}`;
		setAudioRegions((prev) => [
			...prev,
			{
				id,
				startMs: 0,
				endMs: totalMs,
				sourceType: "file",
				audioPath: sourcePath,
				volume: clipVolume > 0 ? clipVolume : 1,
				fadeInMs: 0,
				fadeOutMs: 0,
				loop: false,
			},
		]);
		setClipVolume(0);
		setSelectedAudioId(id);
		toast.success(t("editor.shell.clipAudioMovedTo", "Clip audio moved to its own track"));
	}, [videoSourcePath, videoPath, duration, clipVolume, setClipVolume, t]);

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
				toast.error(t("editor.shell.couldNotReadAudio", "Could not read audio file"), {
					description: t(
						"editor.shell.theSelectedAudioCould",
						"The selected audio could not be loaded.",
					),
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
		[handleAudioAdded, selectedAudioRegion, t],
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

	const handleAudioNormalizeChange = useCallback((id: string, normalize: boolean) => {
		setAudioRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, normalize } : region)),
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
			toast.error(t("editor.shell.selectedAudioFileIs", "Selected audio file is not accessible."));
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
		toast.success(t("editor.shell.audioSourceRelinked", "Audio source relinked."));
	}, [selectedAudioRegion, t]);

	const handleRemoveMissingAudio = useCallback(() => {
		if (!selectedAudioRegion) {
			return;
		}

		setAudioRegions((prev) => prev.filter((region) => region.id !== selectedAudioRegion.id));
		toast.success(t("editor.shell.audioRemovedFromThis", "Audio removed from this project."));
	}, [selectedAudioRegion, t]);

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

	const handleAnnotationAdded = useCallback(
		(span: Span) => {
			const id = `annotation-${nextAnnotationIdRef.current++}`;
			const zIndex = nextAnnotationZIndexRef.current++; // Assign z-index based on creation order
			const newRegion: AnnotationRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				type: "text",
				content: t("editor.shell.enterText", "Enter text..."),
				position: { ...DEFAULT_ANNOTATION_POSITION },
				size: { ...DEFAULT_ANNOTATION_SIZE },
				style: { ...DEFAULT_ANNOTATION_STYLE },
				zIndex,
			};
			setAnnotationRegions((prev) => [...prev, newRegion]);
			setSelectedAnnotationId(id);
			setSelectedZoomId(null);
			setSelectedSpeedId(null);
			setSelectedCameraLayoutId(null);
			setWebcamSelected(false);
		},
		[t],
	);

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

	const handleAnnotationTypeChange = useCallback(
		(id: string, type: AnnotationRegion["type"]) => {
			setAnnotationRegions((prev) => {
				const updated = prev.map((region) => {
					if (region.id !== id) return region;

					const updatedRegion = { ...region, type };

					// Restore content from type-specific storage
					if (type === "text") {
						updatedRegion.content =
							region.textContent || t("editor.shell.enterText", "Enter text...");
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
		},
		[t],
	);

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
			toast.error(
				t("editor.shell.selectedWebcamFileIs", "Selected webcam file is not accessible."),
			);
			return;
		}

		setShowWebcam(true);
		toast.success(t("editor.shell.webcamSourceRelinked", "Webcam source relinked."));
	}, [syncWebcamAvailability, t]);

	const handleRemoveWebcamFromProject = useCallback(async () => {
		clearWebcamState();
		await window.electronAPI.clearCurrentWebcamPath();
		toast.success(t("editor.shell.webcamRemovedFromThis", "Webcam removed from this project."));
	}, [clearWebcamState, t]);

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
		handleDeleteCaptionModel,
		handleCustomWhisperFile,
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

	const handleExportMenuOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				// Outside click only hides the menu; a running export or pending save is kept.
				dispatchSession({ type: "set-export-dialog-open", value: false });
				return;
			}
			if (hasPendingExportSave) {
				dispatchSession({ type: "set-export-status", status: "canceled" });
				dispatchSession({
					type: "set-export-error",
					error: tDialogs(
						"export.saveCanceled",
						"Save canceled. Click Save Again to save without rendering again.",
					),
				});
			} else if (
				!isExporting &&
				(exportStatus === "saved" || exportStatus === "failed" || exportStatus === "canceled")
			) {
				dispatchSession({ type: "set-export-status", status: "idle" });
				dispatchSession({ type: "set-export-error", error: null });
				dispatchSession({ type: "set-exported-file-path", path: undefined });
			}
			dispatchSession({ type: "set-export-dialog-open", value: true });
		},
		[exportStatus, hasPendingExportSave, isExporting, tDialogs],
	);
	const handleShortcutOpenExport = useCallback(() => {
		if (videoPath) handleExportMenuOpenChange(true);
	}, [handleExportMenuOpenChange, videoPath]);

	useVideoEditorKeyboardShortcuts({
		shortcuts,
		isMac,
		handleUndo,
		handleRedo,
		handleOpenExport: handleShortcutOpenExport,
		videoPlaybackRef,
	});

	useTimelineSelectionPruning({
		selectedZoomId,
		setSelectedZoomId,
		zoomRegions,
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
		discardPendingSave,
		openRecordingsFolder,
	} = useVideoEditorExportActions({
		exportV2JobIdRef,
		exporterRef,
		pendingExportSaveRef,
		dispatchSession,
		t: tDialogs,
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
				captionSidecar?: { srt?: string; vtt?: string };
			} = {},
		) => {
			if (!videoPath) {
				toast.error(tDialogs("export.noVideo", "No video loaded"));
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error(tDialogs("export.videoNotReady", "The video isn't ready yet"));
				return;
			}

			dispatchSession({ type: "set-exporting", value: true });
			dispatchSession({ type: "set-export-status", status: "exporting" });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
			discardPendingSave();

			let keepExportDialogOpen = true;
			const saveMode = options.saveMode ?? "dialog";
			let previewRestoreTime = video.currentTime;
			let shouldResumePreviewPlayback = isPlaying;
			let previewRestored = false;
			let previewHoldToken: string | null = null;
			const progressThrottler = createExportProgressThrottler((progress) => {
				dispatchSession({ type: "set-export-progress", progress });
			});

			const captionSidecar = options.captionSidecar;
			const setPendingSave = (save: { blob?: Blob; tempPath?: string; fileName: string }) => {
				pendingExportSaveRef.current = { ...save, captionSidecar };
				dispatchSession({ type: "set-pending-export-save", value: true });
			};
			const saveCanceledMessage = tDialogs(
				"export.saveCanceled",
				"Save canceled. Click Save Again to save without rendering again.",
			);

			const saveExportedBlob = async ({
				blob,
				fileName,
			}: {
				blob: Blob;
				fileName: string;
			}): Promise<boolean> => {
				if (saveMode === "clipboard") {
					dispatchSession({ type: "set-export-status", status: "saving" });
					const arrayBuffer = await blob.arrayBuffer();
					const copyResult = await window.electronAPI.copyExportedToClipboard(
						arrayBuffer,
						fileName,
					);
					if (copyResult.success) {
						toast.success(tDialogs("export.copiedToClipboard", "Copied to clipboard."));
						dispatchSession({
							type: "set-exported-file-path",
							path: copyResult.path ?? "",
						});
						dispatchSession({ type: "set-export-status", status: "saved" });
						return false;
					}

					dispatchSession({
						type: "set-export-error",
						error:
							copyResult.error || tDialogs("export.copyFailed", "Could not copy to the clipboard"),
					});
					dispatchSession({ type: "set-export-status", status: "failed" });
					toast.error(
						copyResult.error || tDialogs("export.copyFailed", "Could not copy to the clipboard"),
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

					const errorMessage =
						saveResult.message || tDialogs("export.saveFailed", "Failed to save the export");
					setPendingSave({ blob, fileName });
					dispatchSession({ type: "set-export-error", error: errorMessage });
					dispatchSession({ type: "set-export-status", status: "failed" });
					toast.error(errorMessage);
					return true;
				}

				dispatchSession({ type: "set-export-status", status: "awaiting-save-path" });
				const savePathResult = await window.electronAPI.showExportSaveDialog(fileName);
				if ("canceled" in savePathResult && savePathResult.canceled) {
					setPendingSave({ blob, fileName });
					dispatchSession({ type: "set-export-error", error: saveCanceledMessage });
					dispatchSession({ type: "set-export-status", status: "canceled" });
					return true;
				}

				if (!savePathResult.success || !savePathResult.path) {
					const errorMessage =
						savePathResult.message ||
						tDialogs("export.openSaveDialogFailed", "Couldn't open the save dialog");
					setPendingSave({ blob, fileName });
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
					captionSidecar,
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

				const errorMessage =
					writeResult.message || tDialogs("export.saveFailed", "Failed to save the export");
				setPendingSave({ blob, fileName });
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
					paddingSides !== null ||
					padding !== 0 ||
					borderRadius !== 0 ||
					frameBorderEnabled ||
					hasFrameShadow ||
					backgroundBlur > 0 ||
					hideBackground ||
					deviceMockup !== "none";
				const exportV2Selection = selectExportV2Engine({
					format: settings.format,
					hasVisualComposition,
					hasExternalAudio: audioRegions.length > 0 || clipVolume !== 1,
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
							: "temp";
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
					zoomTemporalBlur,
					connectZooms,
					zoomTiming,
					deviceMockup,
					frameBorderEnabled,
					frameBorderWidth,
					frameBorderColor,
					frameBorderOpacity,
					borderRadius,
					padding: effectivePadding,
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
					cursorClickStyle,
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
					sourceAudioVolume: clipVolume,
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
				}: {
					request: ExportV2StartRequest;
					onDetails: (details: ExportDetails) => void;
				}): Promise<{ handled: boolean; keepDialogOpen: boolean }> => {
					const capabilities = await window.electronAPI.exportV2Probe();
					const canUseGifPipeline =
						request.format === "gif" && capabilities.gif.ffmpegPalettePipeline;
					if (!capabilities.enabled && !canUseGifPipeline) {
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
								error: saveCanceledMessage,
							});
							dispatchSession({ type: "set-export-status", status: "canceled" });
							return { handled: true, keepDialogOpen: true };
						}

						if (!result.success || !result.path || !result.details) {
							const errorMessage = result.error || tDialogs("export.failed", "Export failed");
							dispatchSession({ type: "set-export-error", error: errorMessage });
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(errorMessage);
							return { handled: true, keepDialogOpen: true };
						}

						onDetails(result.details);
						if (request.destination === "temp") {
							// Rendered first; now ask where to save it. A cancel keeps the file for Save Again.
							dispatchSession({ type: "set-export-status", status: "awaiting-save-path" });
							const saveResult = await window.electronAPI.finalizeExportedTemp({
								tempPath: result.path,
								fileName: request.fileName,
								captionSidecar,
							});
							if (!saveResult.success || !saveResult.path) {
								setPendingSave({ tempPath: result.path, fileName: request.fileName });
								dispatchSession({
									type: "set-export-error",
									error: saveResult.canceled
										? saveCanceledMessage
										: saveResult.message ||
											tDialogs("export.saveFailed", "Failed to save the export"),
								});
								dispatchSession({
									type: "set-export-status",
									status: saveResult.canceled ? "canceled" : "failed",
								});
								return { handled: true, keepDialogOpen: true };
							}
							result.path = saveResult.path;
						}
						dispatchSession({
							type: "set-exported-file-path",
							path: result.path,
						});
						dispatchSession({ type: "set-export-status", status: "saved" });
						if (result.copiedToClipboard) {
							toast.success(tDialogs("export.copiedToClipboard", "Copied to clipboard."));
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
								mode: "none",
								expectAudio: false,
								audioRegionCount: 0,
								hasSpeedRegions: false,
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
							zoomTemporalBlur,
							connectZooms,
							zoomTiming,
							deviceMockup,
							frameBorderEnabled,
							frameBorderWidth,
							frameBorderColor,
							frameBorderOpacity,
							borderRadius,
							padding: effectivePadding,
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
							cursorClickStyle,
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
							});
						} else {
							dispatchSession({
								type: "set-export-error",
								error: result.error || tDialogs("export.failed", "Export failed"),
							});
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(result.error || tDialogs("export.failed", "Export failed"));
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
							keyframeIntervalSeconds: videoPlan.keyframeIntervalSeconds,
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
							keyframeIntervalSeconds: videoPlan.keyframeIntervalSeconds,
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
							zoomTemporalBlur,
							connectZooms,
							zoomTiming,
							deviceMockup,
							frameBorderEnabled,
							frameBorderWidth,
							frameBorderColor,
							frameBorderOpacity,
							borderRadius,
							padding: effectivePadding,
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
							cursorClickStyle,
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
							sourceAudioVolume: clipVolume,
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
							});
						} else {
							dispatchSession({
								type: "set-export-error",
								error: result.error || tDialogs("export.failed", "Export failed"),
							});
							dispatchSession({ type: "set-export-status", status: "failed" });
							toast.error(result.error || tDialogs("export.failed", "Export failed"));
						}
					}
				}

				await restorePreviewAfterExport(false);
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage =
					error instanceof Error ? error.message : t("editor.shell.unknownError", "Unknown error");
				dispatchSession({ type: "set-export-error", error: errorMessage });
				dispatchSession({ type: "set-export-status", status: "failed" });
				toast.error(
					tDialogs("export.failedWithReason", "Export failed: {{reason}}", {
						reason: errorMessage,
					}),
				);
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
				// Keep the menu where the user left it on success; reopen it when something needs attention.
				if (keepExportDialogOpen) {
					dispatchSession({ type: "set-export-dialog-open", value: true });
				}
				dispatchSession({ type: "set-export-progress", progress: null });
			}
		},
		[
			tDialogs,
			discardPendingSave,
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
			zoomTemporalBlur,
			connectZooms,
			zoomTiming,
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
			cursorClickStyle,
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
			deviceMockup,
			borderRadius,
			padding,
			effectivePadding,
			clipVolume,
			paddingSides,
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
			t,
		],
	);

	const buildQuickExportSettings = useCallback((): ExportSettings | null => {
		const advanced = buildDefaultExportSettings();
		const video = videoPlaybackRef.current?.video;
		if (!advanced || !video) {
			return null;
		}
		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceWidth / sourceHeight);
		const base = resolveQuickBaseDimensions(sourceWidth, sourceHeight, aspectRatioValue);
		const gif = toGifExportSettings(
			quickGifExport,
			base.height,
			getGifExportSettingsForPreset("balanced"),
		);
		const gifPlan = resolveGifExportPlan(
			buildSourceVideoMetadata({
				width: sourceWidth,
				height: sourceHeight,
				frameRate: sourceFrameRate,
			}),
			gif,
			aspectRatioValue,
			Math.round(duration * 1000),
		);
		return {
			...advanced,
			video: toVideoExportSettings(quickVideoExport, videoExportSettings),
			gif: { ...gif, width: gifPlan.width, height: gifPlan.height },
		};
	}, [
		aspectRatio,
		buildDefaultExportSettings,
		duration,
		quickGifExport,
		quickVideoExport,
		sourceFrameRate,
		videoExportSettings,
	]);

	const handleOpenExportDialog = useCallback(
		(destination: ExportDestination = "file", useAdvancedSettings = false) => {
			if (!videoPath) {
				toast.error(tDialogs("export.noVideo", "No video loaded"));
				return;
			}

			if (hasPendingExportSave) {
				handleExportMenuOpenChange(true);
				return;
			}

			const settings = useAdvancedSettings
				? buildDefaultExportSettings()
				: buildQuickExportSettings();
			if (!settings) {
				return;
			}
			const captionSidecar =
				settings.format === "mp4" && includeCaptionSidecar
					? buildCaptionSidecar(captionTrack, trimRegions, speedRegions)
					: undefined;

			dispatchSession({ type: "set-export-dialog-open", value: true });
			dispatchSession({ type: "set-export-status", status: "exporting" });
			dispatchSession({ type: "set-export-error", error: null });

			if (destination === "clipboard") {
				handleExport(settings, { saveMode: "clipboard" });
			} else {
				handleExport(settings, { captionSidecar });
			}
		},
		[
			videoPath,
			hasPendingExportSave,
			buildDefaultExportSettings,
			buildQuickExportSettings,
			captionTrack,
			handleExport,
			handleExportMenuOpenChange,
			includeCaptionSidecar,
			speedRegions,
			tDialogs,
			trimRegions,
		],
	);

	const handleExportToClipboard = useCallback(async () => {
		const settings = buildQuickExportSettings();
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
					toast.success(
						t(
							"editor.shell.savedLocallyAndCopied",
							"Saved locally and copied the file path to your clipboard.",
						),
					);
					return;
				}
				toast.error(
					copyResult.message ||
						copyResult.error ||
						t("editor.shell.failedToCopyFile", "Failed to copy file path."),
				);
			},
		});
	}, [buildQuickExportSettings, handleExport, t]);

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

	// Read at render time: the menu re-renders on open, after the video's metadata is known.
	const quickExportDimensions = (() => {
		const video = videoPlaybackRef.current?.video;
		const sourceWidth = video?.videoWidth || 1920;
		const sourceHeight = video?.videoHeight || 1080;
		const aspectValue = getAspectRatioValue(aspectRatio, sourceWidth / sourceHeight);
		const base = resolveQuickBaseDimensions(sourceWidth, sourceHeight, aspectValue);
		const videoDims = Object.fromEntries(
			QUICK_VIDEO_QUALITIES.map((quality) => [quality, resolveQuickVideoDimensions(base, quality)]),
		) as Record<QuickVideoQuality, { width: number; height: number }>;
		const gifPlan = resolveGifExportPlan(
			buildSourceVideoMetadata({
				width: sourceWidth,
				height: sourceHeight,
				frameRate: sourceFrameRate,
			}),
			toGifExportSettings(quickGifExport, base.height, getGifExportSettingsForPreset("balanced")),
			aspectValue,
		);
		return { video: videoDims, gif: { width: gifPlan.width, height: gifPlan.height } };
	})();

	if (error) {
		return (
			<div className="flex items-center justify-center h-screen bg-canvas">
				<div
					className="flex flex-col items-center gap-4"
					style={{
						animation: "editor-loading-enter 0.5s cubic-bezier(0.16,1,0.3,1) both",
					}}
				>
					<div className="text-danger-fg/80 text-body">{error}</div>
					<button
						type="button"
						onClick={handleLoadProject}
						className="px-4 py-2 rounded-lg bg-fill-hover text-fg-muted text-body font-medium hover:bg-fill-pressed hover:text-fg transition-all border border-line"
					>
						{t("editor.shell.loadProjectFile", "Load Project File")}
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
		<div className="relative h-screen bg-canvas overflow-hidden">
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
					className="flex flex-col h-full text-fg selection:bg-accent/30 transition-opacity duration-300 ease-out"
					style={{ opacity: editorReady ? 1 : 0 }}
				>
					{/* Header Bar - matches Screen Studio reference */}
					<div
						className="relative h-11 flex-shrink-0 bg-surface border-b border-line flex items-center gap-2 px-4 z-50"
						style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
					>
						{/* Left: macOS traffic lights spacer + action icons */}
						<div
							className="flex shrink-0 items-center gap-0.5 ml-[72px]"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						>
							<Tooltip
								content={t("editor.shell.saveProject", "Save Project")}
								shortcut={isMac ? "⌘ + S" : "Ctrl + S"}
								side="bottom"
							>
								<button
									type="button"
									onClick={() => void handleSaveProject()}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
								>
									<Save className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip
								content={t("editor.shell.openRecordingsFolder", "Open Recordings Folder")}
								side="bottom"
							>
								<button
									type="button"
									onClick={() => void openRecordingsFolder()}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
								>
									<FolderOpen className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip
								content={t("editor.shell.keyboardShortcuts", "Keyboard Shortcuts")}
								side="bottom"
							>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
									onClick={openConfig}
								>
									<Keyboard className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip content={t("editor.shell.deleteProject", "Delete Project")} side="bottom">
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-danger hover:text-on-danger cursor-pointer"
									onClick={() => void handleDeleteProject()}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</Tooltip>
						</div>

						{/* Center: editable video name */}
						<div
							className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1"
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
										aria-label={t("editor.shell.videoName", "Video name")}
										className="h-7 w-full max-w-[320px] min-w-0 rounded-md border border-line-strong bg-fill-hover px-2.5 text-center text-body font-medium text-fg-muted outline-none transition placeholder:text-fg-subtle focus:border-accent/45 focus:bg-fill-hover focus:ring-2 focus:ring-accent/15"
									/>
									<Tooltip content={t("editor.shell.saveName", "Save Name")} side="bottom">
										<button
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={commitVideoNameEdit}
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
											aria-label={t("editor.shell.saveVideoName", "Save video name")}
										>
											<Check className="h-3.5 w-3.5" />
										</button>
									</Tooltip>
									<Tooltip content={t("editor.shell.cancel", "Cancel")} side="bottom">
										<button
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={cancelVideoNameEdit}
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition hover:bg-fill-hover hover:text-fg cursor-pointer"
											aria-label={t("editor.shell.cancelVideoNameEdit", "Cancel video name edit")}
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
										className="min-w-0 max-w-[400px] shrink truncate rounded-md px-2 py-1 text-body font-medium text-fg-muted transition hover:bg-fill-hover hover:text-fg-muted cursor-text"
										title={videoName}
										aria-label={t("editor.shell.editVideoName", "Edit video name")}
									>
										{videoName}
									</button>
									<Tooltip content={t("editor.shell.editName", "Edit Name")} side="bottom">
										<button
											type="button"
											onClick={startVideoNameEdit}
											className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle opacity-70 transition hover:bg-fill-hover hover:text-fg hover:opacity-100 cursor-pointer"
											aria-label={t("editor.shell.editVideoName", "Edit video name")}
										>
											<Pencil className="h-3.5 w-3.5" />
										</button>
									</Tooltip>
								</>
							)}
						</div>

						{/* Right: Undo/Redo, Presets, Layout, Settings, Export */}
						<div
							className="flex shrink-0 items-center gap-0.5"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						>
							{/* Undo / Redo */}
							<Tooltip
								content={t("editor.shell.undo", "Undo")}
								shortcut={isMac ? "⌘ + Z" : "Ctrl + Z"}
								side="bottom"
							>
								<button
									type="button"
									onClick={handleUndo}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition hover:bg-fill-hover hover:text-fg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									disabled={!canUndo}
								>
									<Undo2 className="h-4 w-4" />
								</button>
							</Tooltip>
							<Tooltip
								content={t("editor.shell.redo", "Redo")}
								shortcut={isMac ? "⌘ + ⇧ + Z" : "Ctrl + Y"}
								side="bottom"
							>
								<button
									type="button"
									onClick={handleRedo}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition hover:bg-fill-hover hover:text-fg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									disabled={!canRedo}
								>
									<Redo2 className="h-4 w-4" />
								</button>
							</Tooltip>

							<div className="mx-1 h-5 w-px bg-line-strong" />

							{/* Presets dropdown */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
									>
										<Sparkles className="h-3.5 w-3.5" />
										<span className="hidden text-label font-medium lg:inline">
											{t("editor.header.presets", "Presets")}
										</span>
										<ChevronDown className="h-3 w-3 text-fg-subtle" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="bg-raised border-line-strong min-w-[160px]"
								>
									<DropdownMenuLabel className="text-caption font-medium text-fg-subtle">
										{t("editor.shell.applyPreset", "Apply preset")}
									</DropdownMenuLabel>
									{allPresets.map((preset) => (
										<DropdownMenuItem
											key={preset.id}
											onSelect={() => applyPreset(preset)}
											className="text-fg-muted hover:text-fg hover:bg-fill-hover cursor-pointer"
										>
											{preset.name}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator className="bg-fill-hover" />
									<DropdownMenuItem
										onSelect={handleSavePreset}
										className="text-fg-muted hover:text-fg hover:bg-fill-hover cursor-pointer"
									>
										{t("editor.shell.saveCurrentAsPreset", "Save current as preset...")}
									</DropdownMenuItem>
									<DropdownMenuSub>
										<DropdownMenuSubTrigger
											disabled={customPresets.length === 0}
											className="text-fg-muted"
										>
											{t("editor.shell.deletePreset", "Delete preset")}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="min-w-[180px] border-line-strong bg-raised">
											{customPresets.length === 0 ? (
												<DropdownMenuItem disabled className="text-fg-subtle">
													{t("editor.shell.noSavedPresets", "No saved presets")}
												</DropdownMenuItem>
											) : (
												customPresets.map((preset) => (
													<DropdownMenuItem
														key={`delete-${preset.id}`}
														onSelect={() => handleDeletePreset(preset.id)}
														className="text-fg-muted hover:text-fg hover:bg-fill-hover cursor-pointer"
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
							<Tooltip content={t("editor.shell.toggleLayout", "Toggle Layout")} side="bottom">
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
									onClick={cycleWorkspaceLayout}
								>
									<SplitSquareHorizontal className="h-4 w-4" />
								</button>
							</Tooltip>

							<Tooltip content={t("editor.shell.projects", "Projects")} side="bottom">
								<button
									type="button"
									aria-label={t("editor.shell.openProjectBrowser", "Open project browser")}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
									onClick={() => setProjectBrowserOpen(true)}
								>
									<FolderOpen className="h-4 w-4" />
								</button>
							</Tooltip>
							<ProjectBrowserDialog
								open={projectBrowserOpen}
								onOpenChange={setProjectBrowserOpen}
								onOpenProject={handleOpenProjectAtPath}
							/>

							{/* Language, appearance, feedback */}
							<LanguageSwitcher />
							<AppearanceSwitcher />
							<FeedbackDialog />

							<div className="mx-1 h-5 w-px bg-line-strong" />

							<button
								type="button"
								onClick={() => handleExportMenuOpenChange(true)}
								title={`${tSettings("export.buttonTooltip", "Export video or GIF")} (${isMac ? "⌘E" : "Ctrl+E"})`}
								disabled={!videoPath}
								className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-on-accent font-semibold text-label transition bg-accent hover:bg-accent-hover cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Download className="h-3.5 w-3.5" />
								<span>{tSettings("export.button", "Export")}</span>
							</button>
							<ExportDialog
								open={showExportDialog}
								onOpenChange={handleExportMenuOpenChange}
								status={exportStatus}
								progress={exportProgress}
								error={exportError}
								exportedFilePath={exportedFilePath}
								details={exportDetails}
								hasPendingSave={hasPendingExportSave}
								format={exportFormat}
								onFormatChange={setExportFormat}
								video={quickVideoExport}
								onVideoChange={(patch) =>
									setQuickVideoExport((previous) => ({ ...previous, ...patch }))
								}
								gif={quickGifExport}
								onGifChange={(patch) =>
									setQuickGifExport((previous) => ({ ...previous, ...patch }))
								}
								videoDimensions={quickExportDimensions.video}
								gifDimensions={quickExportDimensions.gif}
								showCaptionSidecar={Boolean(captionTrack?.segments.length)}
								includeCaptionSidecar={includeCaptionSidecar}
								onIncludeCaptionSidecarChange={setIncludeCaptionSidecar}
								extraMessages={exportAnnouncements}
								onExport={() => handleOpenExportDialog("file")}
								onCancel={handleCancelExport}
								onRetrySave={() => void handleRetrySaveExport()}
								onDismiss={handleExportDialogClose}
								onReveal={() => {
									if (exportedFilePath) void window.electronAPI.revealInFolder(exportedFilePath);
								}}
								onOpenAdvanced={() => {
									dispatchSession({ type: "set-export-dialog-open", value: false });
									dispatchSession({ type: "set-export-settings-open", value: true });
								}}
							/>
						</div>
					</div>

					<PanelGroup ref={panelGroupRef} direction="vertical" className="flex-1 min-h-0">
						{/* Top section: Video preview + Settings sidebar */}
						<Panel defaultSize={workspaceLayoutSizes[0]} minSize={35}>
							<PanelGroup
								direction="horizontal"
								autoSaveId="video-editor-horizontal-layout"
								className="flex h-full pb-0 pt-3 pl-3 pr-3 gap-3"
							>
								{/* Video preview area */}
								<Panel minSize={40} className="flex flex-col min-w-0 overflow-hidden rounded-xl">
									{missingWebcamPath && (
										<div className="mx-3 mt-3 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2.5 text-label text-fg">
											<div className="flex items-center justify-between gap-3">
												<div className="min-w-0">
													<div className="font-semibold text-fg">
														{t("settings.webcam.missingTitle", "Webcam source missing")}
													</div>
													<div className="mt-1 truncate text-fg-muted">{missingWebcamPath}</div>
												</div>
												<div className="flex shrink-0 items-center gap-2">
													<button
														type="button"
														onClick={() => void handleRelinkMissingWebcam()}
														className="rounded-md border border-accent/30 bg-accent/15 px-2.5 py-1 text-caption font-semibold text-fg hover:bg-accent/25"
													>
														{t("settings.webcam.relink", "Relink webcam")}
													</button>
													<button
														type="button"
														onClick={() => void handleRemoveWebcamFromProject()}
														className="rounded-md border border-line-strong bg-fill-subtle px-2.5 py-1 text-caption font-semibold text-fg hover:bg-fill-hover"
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
											zoomTiming={zoomTiming}
											frameBorderEnabled={frameBorderEnabled}
											frameBorderWidth={frameBorderWidth}
											frameBorderColor={frameBorderColor}
											frameBorderOpacity={frameBorderOpacity}
											deviceMockup={deviceMockup}
											borderRadius={borderRadius}
											padding={effectivePadding}
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
											cursorClickStyle={cursorClickStyle}
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
								</Panel>

								<PanelResizeHandle className="w-1.5 flex items-center justify-center group cursor-col-resize z-10 transition-colors rounded-full hover:bg-fill-hover active:bg-fill-pressed">
									<div className="h-16 w-1 rounded-full bg-fill-hover group-hover:bg-accent/50 group-active:bg-accent transition-colors" />
								</PanelResizeHandle>

								{/* Right section: settings sidebar */}
								<Panel
									defaultSize={Math.max(25, sidebarMinSize)}
									minSize={sidebarMinSize}
									maxSize={Math.max(45, sidebarMinSize)}
									className="flex flex-col min-w-0 h-full gap-2 relative"
								>
									<div className="shrink-0 flex items-center justify-center z-10">
										<div className="grid w-full max-w-sm grid-cols-2 gap-0.5 rounded-lg bg-fill-hover p-0.5">
											<button
												type="button"
												onClick={() => setRightSidebarSection("edit")}
												className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-label font-medium transition-colors duration-fast ${
													rightSidebarSection === "edit"
														? "bg-control text-fg shadow-sm"
														: "text-fg-muted hover:text-fg"
												}`}
											>
												<SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
												<span className="truncate">{t("editor.sidebar.edit", "Edit")}</span>
											</button>
											<button
												type="button"
												onClick={() => setRightSidebarSection("polish")}
												className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-label font-medium transition-colors duration-fast ${
													rightSidebarSection === "polish"
														? "bg-control text-fg shadow-sm"
														: "text-fg-muted hover:text-fg"
												}`}
											>
												<Sparkles className="h-3.5 w-3.5 shrink-0" />
												<span className="truncate">{t("editor.sidebar.polish", "Polish")}</span>
											</button>
										</div>
									</div>
									<div className="min-h-0 flex-1">
										{rightSidebarSection === "polish" ? (
											<AutoPolishPanel embedded onAutoPolish={handleAutoPolish} />
										) : (
											<SettingsPanel
												selected={wallpaper}
												onWallpaperChange={setWallpaper}
												previewQuality={previewQuality}
												onPreviewQualityChange={setPreviewQuality}
												selectedZoomDepth={
													selectedZoomId
														? zoomRegions.find((z) => z.id === selectedZoomId)?.depth
														: null
												}
												selectedZoomMode={
													selectedZoomId
														? (zoomRegions.find((z) => z.id === selectedZoomId)?.mode ??
															DEFAULT_ZOOM_MODE)
														: null
												}
												onZoomDepthChange={(depth) =>
													selectedZoomId && handleZoomDepthChange(depth)
												}
												onZoomModeChange={handleZoomModeChange}
												selectedZoomId={selectedZoomId}
												onZoomDelete={handleZoomDelete}
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
												zoomTemporalBlur={zoomTemporalBlur}
												onZoomTemporalBlurChange={setZoomTemporalBlur}
												connectZooms={connectZooms}
												zoomTiming={zoomTiming}
												onConnectZoomsChange={setConnectZooms}
												onZoomTimingChange={setZoomTiming}
												showCursor={showCursor}
												onShowCursorChange={setShowCursor}
												loopCursor={loopCursor}
												onLoopCursorChange={setLoopCursor}
												cursorSize={cursorSize}
												onCursorSizeChange={setCursorSize}
												cursorMotionBlur={cursorMotionBlur}
												onCursorMotionBlurChange={setCursorMotionBlur}
												cursorClickBounce={cursorClickBounce}
												onCursorClickBounceChange={setCursorClickBounce}
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
												cursorClickStyle={cursorClickStyle}
												onClickHighlightOpacityChange={setClickHighlightOpacity}
												onCursorClickStyleChange={setCursorClickStyle}
												motionPreset={motionPreset}
												onApplyMotionPreset={applyMotionPreset}
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
												paddingSides={paddingSides}
												onPaddingSidesChange={setPaddingSides}
												onPaddingChange={setPadding}
												cropRegion={cropRegion}
												baseCropRegion={legacyCaptureCorrectionCrop}
												onCropChange={setCropRegion}
												aspectRatio={aspectRatio}
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
												onAudioNormalizeChange={handleAudioNormalizeChange}
												onAudioDelete={handleAudioDelete}
												missingAudioPath={missingSelectedAudioPath}
												onRelinkMissingAudio={handleRelinkMissingAudio}
												onRemoveMissingAudio={handleRemoveMissingAudio}
												captionRegions={captionRegions}
												captionGenerationOptions={captionGenerationOptions}
												captionGenerationProgress={captionGenerationProgress}
												captionModelStatus={captionModelStatus}
												onDeleteCaptionModel={handleDeleteCaptionModel}
												onCustomWhisperFile={handleCustomWhisperFile}
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
												activeScenePresetId={scenePresetId}
												hasCursorTelemetry={effectiveCursorTelemetry.length >= 2}
												hasExistingZooms={zoomRegions.length > 0}
												onApplyScenePreset={handleApplyScenePreset}
												onAutoBeautify={() => handleAutoBeautify()}
												onRegenerateSmartZooms={handleRegenerateSmartZooms}
											/>
										)}
									</div>
								</Panel>
							</PanelGroup>
						</Panel>

						<PanelResizeHandle className="h-4 flex items-center justify-center mx-2 group/handle outline-none cursor-row-resize">
							<div className="w-12 h-1 bg-fill-hover group-hover/handle:bg-fg-subtle rounded-full transition-colors duration-200"></div>
						</PanelResizeHandle>

						{/* Full-width Timeline section */}
						<Panel defaultSize={workspaceLayoutSizes[1]} minSize={12}>
							<div className="h-[calc(100%-0.75rem)] min-h-0 mx-3 mb-3 bg-surface rounded-xl shadow-panel overflow-hidden flex flex-col relative z-10">
								<TimelineEditor
									videoDuration={duration}
									currentTime={currentTime}
									videoPath={videoPath}
									hasAudio={videoHasAudio}
									clipVolume={clipVolume}
									onClipVolumeChange={setClipVolume}
									onSeparateClipAudio={handleSeparateClipAudio}
									timelineExpanded={timelineExpanded}
									onToggleTimelineExpanded={handleToggleTimelineExpanded}
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
						onExport={(destination) => handleOpenExportDialog(destination, true)}
					/>

					<QuickShareDialog
						isOpen={showQuickShare}
						onClose={() => dispatchSession({ type: "set-quick-share-open", value: false })}
						onSave={handleQuickShareSave}
						onCopy={() => void handleExportToClipboard()}
						onEdit={handleQuickShareEdit}
					/>

					<MissingCursorDataDialog
						open={missingCursorDataOpen}
						isMac={isMac}
						onClose={() => setMissingCursorDataOpen(false)}
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
