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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
	type ExportFormat,
	type ExportSettings,
	type GifExportConfig,
	GifExporter,
	resolveGifExportPlan,
	resolveVideoExportPlan,
	StreamingVideoDecoder,
	VideoExporter,
	type VideoExportSettings,
} from "@/lib/exporter";
import { matchesShortcut } from "@/lib/shortcuts";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import {
	getAudioPlaybackOffsetSeconds,
	getAudioRegionFadeMultiplier,
	isFileAudioSource,
	loadAudioSelectionDurationMs,
	resolveAudioSourceUrl,
} from "./audioRegionUtils";
import { applyPresetToSettings } from "./captionPresets";
import { ConfirmActionDialog, PresetNameDialog } from "./EditorDialogs";
import { ExportDialog } from "./ExportDialog";
import { ExportSettingsDialog } from "./ExportSettingsDialog";
import { editorPersistenceService } from "./editorPersistenceService";
import {
	DEFAULT_EDITOR_PREFERENCES,
	type EditorPreset,
	type EditorWorkspaceLayout,
} from "./editorPreferences";
import { editorPreferencesService } from "./editorPreferencesService";
import {
	type ConfirmDialogState,
	createInitialEditorSessionState,
	editorSessionReducer,
} from "./editorSession";
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
	isPostRecordingAutoZoomPending,
	type PostRecordingAutoZoomBootstrapState,
	resolvePostRecordingAutoZoomDecision,
} from "./postRecordingAutoZoomUtils";
import {
	DEFAULT_VIDEO_PREVIEW_PADDING,
	deriveNextId,
	fromFileUrl,
	normalizeProjectEditor,
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
	CAPTION_STYLE_PRESETS,
	type CameraLayoutRegion,
	type CaptionGenerationOptions,
	type CaptionGenerationProgress,
	type CaptionModelStatus,
	type CaptionPositionOverride,
	type CaptionRegion,
	type CaptionSegment,
	type CaptionSettings,
	type CaptionStylePreset,
	type CaptionTrack,
	type CaptionUserPreset,
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
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CAPTION_SETTINGS,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	DEFAULT_FIGURE_DATA,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_ZOOM_DEPTH,
	DEFAULT_ZOOM_MODE,
	type FigureData,
	getRecommendedWebcamRegion,
	type KeyboardPlatform,
	type KeyboardTelemetrySample,
	type PlaybackSpeed,
	type PreviewQuality,
	type SpeedRegion,
	type TrimRegion,
	type WebcamRegion,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomRegion,
} from "./types";
import { VideoEditorSkeleton } from "./VideoEditorSkeleton";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";
import {
	buildCursorSimulationPath,
	evaluateCursorMotionSnapshot,
} from "./videoPlayback/cursorSimulation";
import { composeCropRegions, deriveLegacyCaptureCorrectionCrop } from "./videoPlayback/layoutUtils";
import { resolveZoomRegionFocus } from "./videoPlayback/smartZoomController";
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
	const tSettings = useScopedT("settings");
	// Editor control values (wallpaper, cursor, frame, export, etc.) always start
	// from defaults for every new session. The only settings we restore from
	// localStorage are genuine app-level prefs (preview quality, workspace layout,
	// custom aspect inputs, custom wallpaper library) and the user's saved presets.
	// Users can re-apply a preset to bring back their preferred settings.
	const initialEditorPreferences = useMemo(() => {
		const stored = editorPreferencesService.load();
		return {
			...DEFAULT_EDITOR_PREFERENCES,
			previewQuality: stored.previewQuality,
			workspaceLayout: stored.workspaceLayout,
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
	const currentProjectPath = sessionState.currentProjectPath;
	const isExporting = sessionState.isExporting;
	const exportProgress = sessionState.exportProgress;
	const exportError = sessionState.exportError;
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

	useEffect(() => {
		let cancelled = false;
		const decoder = videoPath ? new StreamingVideoDecoder() : null;

		if (!videoPath) {
			setSourceFrameRate(60);
			return;
		}

		void decoder
			?.loadMetadata(videoPath)
			.then((metadata) => {
				if (cancelled) {
					return;
				}
				setSourceFrameRate(resolveSourceFrameRate(metadata.frameRate));
				setVideoHasAudio(metadata.hasAudio);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				console.warn("[VideoEditor] Failed to load source FPS for export planning:", error);
				setSourceFrameRate(60);
			})
			.finally(() => {
				decoder?.destroy();
			});

		return () => {
			cancelled = true;
			decoder?.destroy();
		};
	}, [videoPath]);

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
			dispatchSession({ type: "set-current-project-path", path: path ?? null });
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

			dispatchSession({
				type: "set-last-saved-snapshot",
				snapshot: editorPersistenceService.buildProjectArtifacts({
					sourcePath,
					editor: normalizedEditor,
				}).projectSnapshot,
			});
			return true;
		},
		[applyEditorControls, syncWebcamAvailability],
	);

	const currentProjectSnapshot = useMemo(() => {
		const sourcePath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		if (!sourcePath) {
			return null;
		}
		return editorPersistenceService.buildProjectArtifacts({
			sourcePath,
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
				showWebcam,
				mirrorWebcam,
				cameraSizeDuringZoom,
				cameraLayouts,
				captionTrack,
				captionSettings,
				captionGenerationOptions,
				exportFormat,
				videoExportSettings,
				gifExportSettings,
			},
		}).projectSnapshot;
	}, [
		videoPath,
		videoSourcePath,
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
		showWebcam,
		mirrorWebcam,
		cameraSizeDuringZoom,
		cameraLayouts,
		captionTrack,
		captionSettings,
		captionGenerationOptions,
		exportFormat,
		videoExportSettings,
		gifExportSettings,
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
							setVideoSourcePath(sourcePath);
							setVideoPath(toFileUrl(sourcePath));
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
							setVideoSourcePath(sourcePath);
							setVideoPath(toFileUrl(sourcePath));
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
	}, [applyEditorControls, applyLoadedProject, clearWebcamState, syncWebcamAvailability]);

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
			workspaceLayout,
			presets: customPresets,
		});
	}, [previewQuality, workspaceLayout, customPresets]);

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
					showWebcam,
					mirrorWebcam,
					cameraSizeDuringZoom,
					cameraLayouts,
					captionTrack,
					captionSettings,
					captionGenerationOptions,
					exportFormat,
					videoExportSettings,
					gifExportSettings,
				},
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
			showWebcam,
			mirrorWebcam,
			cameraSizeDuringZoom,
			cameraLayouts,
			captionTrack,
			captionSettings,
			captionGenerationOptions,
			exportFormat,
			videoExportSettings,
			gifExportSettings,
			deviceMockup,
		],
	);

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			editorPreferencesService.flush();
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
		void window.electronAPI.setUpdaterBusyState({
			exporting: isExporting,
			transcribing: isTranscribing,
		});
	}, [isExporting, isTranscribing]);

	useEffect(() => {
		return () => {
			void window.electronAPI.setUpdaterBusyState({
				exporting: false,
				transcribing: false,
			});
		};
	}, []);

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

	const handleApplyCaptionPreset = useCallback((preset: CaptionUserPreset) => {
		setCaptionSettings((prev) => applyPresetToSettings(prev, preset));
	}, []);

	const handleToggleCaptionPositionEditing = useCallback((next: boolean) => {
		setIsEditingCaptionPosition(next);
	}, []);

	const handleCaptionPositionOverrideChange = useCallback(
		(override: CaptionPositionOverride | null) => {
			setCaptionSettings((prev) => ({ ...prev, positionOverride: override }));
		},
		[],
	);

	const handleCaptionImport = useCallback(
		(segments: CaptionSegment[], mode: "replace" | "append") => {
			if (segments.length === 0) return;
			setCaptionTrack((prev) => {
				const existing = prev?.segments ?? [];
				const nextSegments =
					mode === "replace"
						? segments
						: [...existing, ...segments].sort((a, b) => a.startMs - b.startMs);
				const base: CaptionTrack = prev ?? {
					backend: "whisper.cpp",
					model: captionGenerationOptions.model,
					language: captionGenerationOptions.language ?? "auto",
					prompt: captionGenerationOptions.prompt ?? "",
					sourceAudio: captionGenerationOptions.preferredSourceAudio ?? "microphone",
					status: "ready",
					segments: [],
				};
				return {
					...base,
					status: "ready",
					error: undefined,
					generatedAt: new Date().toISOString(),
					segments: nextSegments,
				};
			});
		},
		[captionGenerationOptions],
	);

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
		dispatchSession({ type: "set-transcribing", value: true });
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
			dispatchSession({ type: "set-transcribing", value: false });
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
		dispatchSession({ type: "set-transcribing", value: false });
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

	// Sync clip volume to the video element
	useEffect(() => {
		const video = videoPlaybackRef.current?.video;
		if (video) {
			video.volume = Math.max(0, Math.min(1, clipVolume));
		}
	}, [clipVolume]);

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
		const sourceAspectRatio = sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
		const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);
		const sourceMetadata = buildSourceVideoMetadata({
			width: sourceWidth,
			height: sourceHeight,
			frameRate: sourceFrameRate,
			durationMs: Math.round(duration * 1000),
		});
		const gifPlan = resolveGifExportPlan(
			sourceMetadata,
			gifExportSettings,
			aspectRatioValue,
			Math.round(duration * 1000),
		);

		return {
			format: exportFormat,
			destination: exportDestination,
			video: videoExportSettings,
			gif: {
				...gifExportSettings,
				width: gifPlan.width,
				height: gifPlan.height,
			},
		};
	}, [
		aspectRatio,
		duration,
		exportDestination,
		exportFormat,
		gifExportSettings,
		sourceFrameRate,
		videoExportSettings,
	]);

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

				if (settings.format === "gif") {
					// GIF Export
					const gifPlan = resolveGifExportPlan(
						sourceMetadata,
						settings.gif,
						aspectRatioValue,
						Math.round(duration * 1000),
					);
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
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;

						if (saveMode === "clipboard") {
							const copyResult = await window.electronAPI.copyExportedToClipboard(
								arrayBuffer,
								fileName,
							);
							if (copyResult.success) {
								toast.success("GIF copied to clipboard.");
								dispatchSession({
									type: "set-exported-file-path",
									path: copyResult.path ?? "",
								});
							} else {
								dispatchSession({
									type: "set-export-error",
									error: copyResult.error || "Failed to copy to clipboard",
								});
								toast.error(copyResult.error || "Failed to copy GIF to clipboard");
							}
						} else {
							const saveResult =
								saveMode === "recordings"
									? await window.electronAPI.saveExportedVideoToRecordings(arrayBuffer, fileName)
									: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

							if ("canceled" in saveResult && saveResult.canceled) {
								pendingExportSaveRef.current = { arrayBuffer, fileName };
								dispatchSession({ type: "set-pending-export-save", value: true });
								dispatchSession({
									type: "set-export-error",
									error: "Save dialog canceled. Click Save Again to save without re-rendering.",
								});
								toast.info("Save canceled. You can save again without re-exporting.");
								keepExportDialogOpen = true;
							} else if (saveResult.success && saveResult.path) {
								showExportSuccessToast(saveResult.path);
								dispatchSession({
									type: "set-exported-file-path",
									path: saveResult.path,
								});
								await options.onSaved?.(saveResult.path);
							} else {
								dispatchSession({
									type: "set-export-error",
									error: saveResult.message || "Failed to save GIF",
								});
								toast.error(saveResult.message || "Failed to save GIF");
							}
						}
					} else {
						dispatchSession({
							type: "set-export-error",
							error: result.error || "GIF export failed",
						});
						toast.error(result.error || "GIF export failed");
					}
				} else {
					// MP4 Export
					const videoPlan = resolveVideoExportPlan(
						sourceMetadata,
						settings.video,
						aspectRatioValue,
					);

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
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;

						if (saveMode === "clipboard") {
							const copyResult = await window.electronAPI.copyExportedToClipboard(
								arrayBuffer,
								fileName,
							);
							if (copyResult.success) {
								toast.success("Video copied to clipboard.");
								dispatchSession({
									type: "set-exported-file-path",
									path: copyResult.path ?? "",
								});
							} else {
								dispatchSession({
									type: "set-export-error",
									error: copyResult.error || "Failed to copy to clipboard",
								});
								toast.error(copyResult.error || "Failed to copy video to clipboard");
							}
						} else {
							const saveResult =
								saveMode === "recordings"
									? await window.electronAPI.saveExportedVideoToRecordings(arrayBuffer, fileName)
									: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

							if ("canceled" in saveResult && saveResult.canceled) {
								pendingExportSaveRef.current = { arrayBuffer, fileName };
								dispatchSession({ type: "set-pending-export-save", value: true });
								dispatchSession({
									type: "set-export-error",
									error: "Save dialog canceled. Click Save Again to save without re-rendering.",
								});
								toast.info("Save canceled. You can save again without re-exporting.");
								keepExportDialogOpen = true;
							} else if (saveResult.success && saveResult.path) {
								showExportSuccessToast(saveResult.path);
								dispatchSession({
									type: "set-exported-file-path",
									path: saveResult.path,
								});
								await options.onSaved?.(saveResult.path);
							} else {
								dispatchSession({
									type: "set-export-error",
									error: saveResult.message || "Failed to save video",
								});
								toast.error(saveResult.message || "Failed to save video");
							}
						}
					} else {
						dispatchSession({
							type: "set-export-error",
							error: result.error || "Export failed",
						});
						toast.error(result.error || "Export failed");
					}
				}

				await restorePreviewAfterExport(false);
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				dispatchSession({ type: "set-export-error", error: errorMessage });
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

	const handleQuickShareSave = useCallback(() => {
		dispatchSession({ type: "set-quick-share-open", value: false });
		handleOpenExportDialog();
	}, [handleOpenExportDialog]);

	const handleQuickShareEdit = useCallback(() => {
		dispatchSession({ type: "set-quick-share-open", value: false });
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
		dispatchSession({ type: "open-preset-dialog", name: "My preset" });
	}, []);

	const handleConfirmSavePreset = useCallback(() => {
		const name = sessionState.modals.presetDialog.name.trim();
		if (!name) {
			return;
		}

		const preset: EditorPreset = {
			id: `preset-${Date.now()}`,
			name,
			controls: buildCurrentPresetControls(),
		};

		setCustomPresets((prev) => [...prev, preset]);
		dispatchSession({ type: "close-preset-dialog" });
		toast.success(`Saved ${name} preset.`);
	}, [buildCurrentPresetControls, sessionState.modals.presetDialog.name]);

	const handleDeletePreset = useCallback(
		(presetId: string) => {
			const target = customPresets.find((preset) => preset.id === presetId);
			if (!target) {
				return;
			}

			dispatchSession({
				type: "open-confirm-dialog",
				dialog: {
					kind: "delete-preset",
					title: "Delete preset?",
					description: `Delete the preset "${target.name}"?`,
					confirmLabel: "Delete preset",
					payload: presetId,
					tone: "danger",
				},
			});
		},
		[customPresets],
	);

	const handleDeleteProject = useCallback(async () => {
		const dialog: ConfirmDialogState = {
			kind: "delete-project",
			title: "Delete project?",
			description: [
				"Delete this ScreenMint project and any managed recording media?",
				"",
				"Imported files outside the ScreenMint recordings folder will be kept.",
			].join("\n"),
			confirmLabel: "Delete project",
			tone: "danger",
		};
		dispatchSession({ type: "open-confirm-dialog", dialog });
	}, []);

	const confirmDeleteProject = useCallback(async () => {
		dispatchSession({ type: "close-confirm-dialog" });

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

	const handleConfirmDialogAction = useCallback(async () => {
		const dialog = sessionState.modals.confirmDialog;
		if (!dialog) {
			return;
		}

		if (dialog.kind === "delete-preset" && dialog.payload) {
			const target = customPresets.find((preset) => preset.id === dialog.payload);
			setCustomPresets((prev) => prev.filter((preset) => preset.id !== dialog.payload));
			dispatchSession({ type: "close-confirm-dialog" });
			if (target) {
				toast.success(`Deleted ${target.name} preset.`);
			}
			return;
		}

		if (dialog.kind === "delete-project") {
			await confirmDeleteProject();
		}
	}, [confirmDeleteProject, customPresets, sessionState.modals.confirmDialog]);

	useEffect(() => {
		if (loading || error || !videoPath || !postRecordingContext) {
			return;
		}

		if (isPostRecordingAutoZoomPending(postRecordingAutoZoomBootstrap, videoPath)) {
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
					dispatchSession({ type: "set-quick-share-open", value: true });
					toast.info("Share links are not available yet. Opening Quick Share instead.");
					break;
				case "create-project":
				default:
					if (postRecordingContext.openQuickShare) {
						dispatchSession({ type: "set-quick-share-open", value: true });
					}
					break;
			}

			await window.electronAPI.clearPostRecordingContext();
			dispatchSession({ type: "set-post-recording-context", context: null });
		})();
	}, [
		duration,
		error,
		handleExportToClipboard,
		handleOpenExportDialog,
		loading,
		postRecordingAutoZoomBootstrap,
		postRecordingContext,
		videoPath,
	]);

	const handleCancelExport = useCallback(() => {
		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			dispatchSession({ type: "set-export-dialog-open", value: false });
			dispatchSession({ type: "set-exporting", value: false });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
		}
	}, []);

	const handleExportDialogClose = useCallback(() => {
		dispatchSession({ type: "set-export-dialog-open", value: false });
		dispatchSession({ type: "set-exported-file-path", path: undefined });
		dispatchSession({ type: "set-export-error", error: null });
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
			dispatchSession({
				type: "set-export-error",
				error: "Save dialog canceled. Click Save Again to save without re-rendering.",
			});
			toast.info("Save canceled. You can try again.");
			return;
		}

		if (saveResult.success && saveResult.path) {
			pendingExportSaveRef.current = null;
			dispatchSession({ type: "set-pending-export-save", value: false });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: saveResult.path });
			showExportSuccessToast(saveResult.path);
			return;
		}

		const errorMessage = saveResult.message || "Failed to save video";
		dispatchSession({ type: "set-export-error", error: errorMessage });
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
											hideBackground={hideBackground}
											zoomRegions={effectiveZoomRegions}
											selectedZoomId={selectedZoomId}
											onSelectZoom={handleSelectZoom}
											onZoomFocusChange={handleZoomFocusChange}
											isPlaying={isPlaying}
											frameShadowSize={frameShadowSize}
											frameShadowOpacity={frameShadowOpacity}
											frameShadowBlur={frameShadowBlur}
											previewQuality={previewQuality}
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
						<Panel defaultSize={35} minSize={15}>
							<div className="h-full min-h-0 mx-4 mb-4 bg-[#0c0c0f] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
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
