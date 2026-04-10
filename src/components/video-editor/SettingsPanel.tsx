import {
	AlertTriangle,
	Camera,
	Captions,
	ChevronDown,
	ChevronUp,
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
import { ColorPicker } from "./ColorPicker";
import { CropControl } from "./CropControl";
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
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { DEFAULT_VIDEO_PREVIEW_PADDING } from "./projectPersistence";
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
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorTypeMode,
	FigureData,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	PlaybackSpeed,
	PreviewQuality,
	WebcamRegion,
	ZoomDepth,
	ZoomMode,
} from "./types";
import {
	CAMERA_ZOOM_SCALE_DISABLED,
	CAPTION_STYLE_PRESETS,
	CURSOR_MOVEMENT_STYLE_OPTIONS,
	CURSOR_PACK_OPTIONS,
	CURSOR_TYPE_MODE_OPTIONS,
	DEFAULT_AUDIO_FADE_IN_MS,
	DEFAULT_AUDIO_FADE_OUT_MS,
	DEFAULT_AUDIO_REGION_VOLUME,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_MOVEMENT_STYLE,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_SIZE,
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
	DEFAULT_ZOOM_MOTION_BLUR,
	KEYBOARD_SHORTCUT_POSITION_OPTIONS,
	KEYBOARD_SHORTCUT_THEME_OPTIONS,
	PREVIEW_QUALITY_OPTIONS,
	SPEED_OPTIONS,
} from "./types";
import { cursorPackPreviewUrls } from "./videoPlayback/cursorAssetPacks";

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
	previewQuality?: PreviewQuality;
	onPreviewQualityChange?: (quality: PreviewQuality) => void;
	selectedZoomDepth?: ZoomDepth | null;
	selectedZoomMode?: ZoomMode | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	onZoomModeChange?: (mode: ZoomMode) => void;
	selectedZoomId?: string | null;
	onZoomDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onTrimDelete?: (id: string) => void;
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
	deviceMockup?: import("./types").DeviceMockup;
	onDeviceMockupChange?: (mockup: import("./types").DeviceMockup) => void;
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
	cropRegion?: CropRegion;
	baseCropRegion?: CropRegion;
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

function SettingsSection({
	title,
	description,
	children,
	className,
	accentColor = "amber",
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	accentColor?: "amber" | "blue" | "red";
}) {
	const borderMap = {
		amber: "border-l-amber-500/60",
		blue: "border-l-blue-500/60",
		red: "border-l-red-500/60",
	};
	return (
		<div className={cn("mb-5 last:mb-2", className)}>
			<div className={cn("mb-2 pl-2.5 border-l-2", borderMap[accentColor])}>
				<h3 className="text-[11px] font-semibold text-slate-200 tracking-wide">{title}</h3>
				{description && (
					<p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
				)}
			</div>
			<div className="flex flex-col gap-1.5">{children}</div>
		</div>
	);
}

function TabContent({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-both",
				className,
			)}
		>
			{children}
		</div>
	);
}

function TabHeader({
	title,
	description,
	badge,
	badgeColor = "amber",
	trailing,
}: {
	title: string;
	description?: string;
	badge?: string;
	badgeColor?: "amber" | "blue";
	trailing?: React.ReactNode;
}) {
	const badgeColorMap = {
		amber: "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20",
		blue: "text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20",
	};
	return (
		<div className="mb-5 pb-3 border-b border-white/[0.06]">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[13px] font-semibold text-white tracking-tight">{title}</span>
					{badge && (
						<span
							className={cn(
								"text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
								badgeColorMap[badgeColor],
							)}
						>
							{badge}
						</span>
					)}
				</div>
				{trailing}
			</div>
			{description && (
				<p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{description}</p>
			)}
		</div>
	);
}

// function MockupPreviewCanvas({ mockup }: { mockup: import("./types").DeviceMockup }) {
// 	const canvasRef = useRef<HTMLCanvasElement>(null);
//
// 	useEffect(() => {
// 		const canvas = canvasRef.current;
// 		if (!canvas) return;
// 		canvas.width = 120;
// 		canvas.height = 90;
// 		renderMockupPreview(canvas, mockup);
// 	}, [mockup]);
//
// 	return <canvas ref={canvasRef} className="w-full h-full" />;
// }

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
	selectedTrimId,
	onTrimDelete,
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
	connectZooms = true,
	onConnectZoomsChange,
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
	const initialEditorPreferences = useMemo(() => editorPreferencesService.load(), []);
	const [wallpaperPreviewPaths, setWallpaperPreviewPaths] = useState<string[]>([]);
	const [customImages, setCustomImages] = useState<string[]>(
		initialEditorPreferences.customWallpapers,
	);
	const [showLegacyCursorSettings, setShowLegacyCursorSettings] = useState(false);
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
		"#F59E0B",
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
	const [showAdvancedShadowSettings, setShowAdvancedShadowSettings] = useState(true);
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
		editorPreferencesService.scheduleSave({ customWallpapers: customImages });
	}, [customImages]);

	useEffect(() => {
		return () => {
			editorPreferencesService.flush();
		};
	}, []);

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

	const tabGroups = [
		{ ids: ["effects", "cursor", "keyboard"], label: "Capture" },
		{ ids: ["background", "zoom", "speed"], label: "Canvas" },
		{ ids: ["audio", "annotation", "captions", "webcam"], label: "Overlay" },
	];

	return (
		<div className="w-[400px] shrink-0 min-w-0 bg-[#0A0F0D] border border-white/[0.06] rounded-2xl flex flex-row shadow-2xl shadow-black/40 h-full overflow-hidden">
			{/* Sidebar navigation */}
			<div className="flex flex-col gap-0.5 p-1.5 border-r border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
				{tabGroups.map((group, groupIndex) => (
					<div key={group.label}>
						{groupIndex > 0 && (
							<div className="mx-2 my-1.5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
						)}
						{sidebarTabs
							.filter((tab) => group.ids.includes(tab.id))
							.map((tab) => {
								const isActive = activeTab === tab.id;
								return (
									<button
										key={tab.id}
										type="button"
										onClick={() => setActiveTab(tab.id)}
										title={tab.label}
										className={cn(
											"relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ease-out group",
											isActive
												? "bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25 scale-105"
												: "text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] hover:scale-105 active:scale-95",
										)}
									>
										<tab.icon
											className={cn(
												"w-[18px] h-[18px] transition-transform duration-300",
												isActive && "drop-shadow-sm",
											)}
										/>
										{isActive && (
											<div className="absolute inset-0 rounded-lg bg-[#F59E0B]/10 animate-pulse pointer-events-none" />
										)}
									</button>
								);
							})}
					</div>
				))}
			</div>

			{/* Content area */}
			<div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-3 pb-0">
				{/* Effects tab */}
				{activeTab === "effects" && (
					<TabContent>
						<TabHeader
							title={tSettings("effects.title")}
							description="Control visual effects, transitions, and frame properties"
							trailing={<KeyboardShortcutsHelp />}
						/>

						<SettingsSection
							title={tSettings("previewQuality.title")}
							description={tSettings("previewQuality.description")}
						>
							<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
								<div className="grid grid-cols-3 gap-1.5">
									{PREVIEW_QUALITY_OPTIONS.map((option) => {
										const isActive = previewQuality === option.value;
										return (
											<Button
												key={option.value}
												type="button"
												onClick={() => onPreviewQualityChange?.(option.value)}
												className={cn(
													"h-10 rounded-xl border shadow-sm transition-all justify-center",
													"duration-200 ease-out",
													isActive
														? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25"
														: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-slate-200",
												)}
											>
												<span className="text-xs font-semibold">
													{tSettings(`previewQuality.options.${option.value}`)}
												</span>
											</Button>
										);
									})}
								</div>
								<p className="mt-2 text-[10px] leading-relaxed text-slate-500">
									{tSettings("previewQuality.helper")}
								</p>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Transitions"
							description="How zoom transitions connect and blend together"
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("effects.connectZooms")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Smoothly link adjacent zoom regions
									</div>
								</div>
								<Switch
									checked={connectZooms}
									onCheckedChange={onConnectZoomsChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("effects.removeBackground")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Hide wallpaper, color, and gradient backgrounds
									</div>
								</div>
								<Switch
									checked={hideBackground}
									onCheckedChange={(checked) => onHideBackgroundChange?.(checked)}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Visual Effects"
							description="Fine-tune blur, shadow, and motion effects"
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
							<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] transition-colors duration-200 hover:bg-white/[0.06]">
								<button
									type="button"
									onClick={() => setShowAdvancedShadowSettings((value) => !value)}
									className="flex w-full items-center justify-between px-3 py-2.5 text-left"
								>
									<div>
										<div className="text-[11px] font-medium text-slate-200">
											{tSettings("effects.advancedShadowSettings")}
										</div>
										<div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
											{tSettings("effects.advancedShadowDescription")}
										</div>
									</div>
									{showAdvancedShadowSettings ? (
										<ChevronUp className="h-3.5 w-3.5 text-slate-400" />
									) : (
										<ChevronDown className="h-3.5 w-3.5 text-slate-400" />
									)}
								</button>
								{showAdvancedShadowSettings && (
									<div className="flex flex-col gap-1.5 border-t border-white/[0.06] px-2.5 py-2.5">
										<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
											<SliderControl
												label={tSettings("effects.shadowSize")}
												value={frameShadowSize}
												defaultValue={DEFAULT_FRAME_SHADOW_SIZE}
												min={0}
												max={48}
												step={0.5}
												onChange={(v) => onFrameShadowSizeChange?.(v)}
												formatValue={(v) => `${v.toFixed(1)}px`}
												parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
											/>
										</div>
										<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
											<SliderControl
												label={tSettings("effects.shadowOpacity")}
												value={frameShadowOpacity}
												defaultValue={DEFAULT_FRAME_SHADOW_OPACITY}
												min={0}
												max={1}
												step={0.01}
												onChange={(v) => onFrameShadowOpacityChange?.(v)}
												formatValue={(v) => `${Math.round(v * 100)}%`}
												parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
											/>
										</div>
										<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
											<SliderControl
												label={tSettings("effects.shadowBlur")}
												value={frameShadowBlur}
												defaultValue={DEFAULT_FRAME_SHADOW_BLUR}
												min={0}
												max={96}
												step={1}
												onChange={(v) => onFrameShadowBlurChange?.(v)}
												formatValue={(v) => `${Math.round(v)}px`}
												parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
											/>
										</div>
									</div>
								)}
							</div>
						</SettingsSection>

						<SettingsSection
							title="Frame"
							description="Adjust the recording frame shape and spacing"
						>
							<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.06]">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-[11px] font-medium text-slate-200">
											{tSettings("effects.border")}
										</div>
										<div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
											{tSettings("effects.borderDescription")}
										</div>
									</div>
									<Switch
										checked={frameBorderEnabled}
										onCheckedChange={(checked) => onFrameBorderEnabledChange?.(checked)}
										className="data-[state=checked]:bg-[#3b82f6]"
									/>
								</div>
							</div>
							{frameBorderEnabled && (
								<>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<SliderControl
											label={tSettings("effects.borderWidth")}
											value={frameBorderWidth}
											defaultValue={DEFAULT_FRAME_BORDER_WIDTH}
											min={0}
											max={20}
											step={1}
											onChange={(v) => onFrameBorderWidthChange?.(v)}
											formatValue={(v) => `${Math.round(v)}px`}
											parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
										/>
									</div>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<label className="mb-2 block text-xs font-medium text-slate-300">
											{tSettings("effects.borderColor")}
										</label>
										<ColorPicker
											color={frameBorderColor}
											onChange={(color) => onFrameBorderColorChange?.(color.hex)}
											colors={[
												"#000000",
												"#FFFFFF",
												"#F59E0B",
												"#3B82F6",
												"#22C55E",
												"#EF4444",
												"#A855F7",
												"#F97316",
											]}
										/>
									</div>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<SliderControl
											label={tSettings("effects.borderOpacity")}
											value={frameBorderOpacity}
											defaultValue={DEFAULT_FRAME_BORDER_OPACITY}
											min={0}
											max={1}
											step={0.01}
											onChange={(v) => onFrameBorderOpacityChange?.(v)}
											formatValue={(v) => `${Math.round(v * 100)}%`}
											parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
										/>
									</div>
								</>
							)}
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<SliderControl
									label={tSettings("effects.padding")}
									value={padding}
									defaultValue={DEFAULT_VIDEO_PREVIEW_PADDING}
									min={0}
									max={100}
									step={1}
									onChange={(v) => onPaddingChange?.(v)}
									formatValue={(v) => `${v}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
								/>
							</div>
							<Button
								onClick={handleCropToggle}
								variant="outline"
								className="w-full gap-2 bg-white/[0.04] text-slate-200 border-white/[0.08] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 hover:text-[#F59E0B] text-[10px] h-9 rounded-xl transition-all duration-200"
							>
								<Crop className="w-3.5 h-3.5" />
								{tSettings("crop.title")}
							</Button>
						</SettingsSection>

						{/* Device mockups are temporarily disabled in the video editor. */}
						{/*
						<SettingsSection
							title="Device Mockup"
							description="Wrap your recording in a device frame"
						>
							<div className="grid grid-cols-3 gap-1.5">
								{DEVICE_MOCKUP_OPTIONS.map((opt) => (
									<button
										key={opt.value}
										type="button"
										onClick={() => onDeviceMockupChange?.(opt.value)}
										className={cn(
											"group relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 cursor-pointer",
											deviceMockup === opt.value
												? "bg-gradient-to-b from-[#F59E0B]/20 to-[#d97706]/10 ring-1 ring-[#F59E0B]/60 shadow-sm shadow-[#F59E0B]/10"
												: "bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/[0.1]",
										)}
										title={opt.label}
									>
										<div
											className={cn(
												"w-full aspect-[4/3] rounded-md overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-105",
												opt.value === "none"
													? "bg-white/[0.03] border border-dashed border-white/[0.08]"
													: "bg-slate-900/50",
											)}
										>
											{opt.value === "none" ? (
												<span className="text-[9px] text-slate-600">None</span>
											) : (
												<MockupPreviewCanvas mockup={opt.value} />
											)}
										</div>
										<span
											className={cn(
												"text-[9px] font-medium leading-tight text-center",
												deviceMockup === opt.value
													? "text-[#F59E0B]"
													: "text-slate-500 group-hover:text-slate-300",
											)}
										>
											{opt.label}
										</span>
									</button>
								))}
							</div>
						</SettingsSection>
						*/}
					</TabContent>
				)}

				{/* Cursor tab */}
				{activeTab === "cursor" && (
					<TabContent>
						<TabHeader
							title={tSettings("cursor.title")}
							description="Control cursor style, movement, visibility, and rendering quality"
						/>

						<SettingsSection
							title="Visibility"
							description="Control whether the cursor shows and when it fades away"
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("effects.showCursor", "Cursor")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Show the cursor in preview and export.
									</div>
								</div>
								<Switch
									checked={showCursor}
									onCheckedChange={onShowCursorChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("cursor.hideWhenIdle", "Hide When Idle")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Fade the cursor out after inactivity based on the timeline.
									</div>
								</div>
								<Switch
									checked={hideWhenIdle}
									onCheckedChange={onHideWhenIdleChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
							{hideWhenIdle && (
								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
									<SliderControl
										label={tSettings("cursor.idleDelay", "Idle Delay")}
										value={idleHideDelayMs}
										defaultValue={DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS}
										min={500}
										max={5000}
										step={50}
										onChange={(v) => onIdleHideDelayMsChange?.(Math.round(v))}
										formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
										parseInput={(t) => Math.round(parseFloat(t.replace(/s$/i, "").trim()) * 1000)}
									/>
								</div>
							)}
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.type", "Cursor Type")}
							description="Choose between using detected cursor states or a touch-style circle."
						>
							<div className="grid grid-cols-1 gap-2">
								{CURSOR_TYPE_MODE_OPTIONS.map((option) => {
									const description =
										option.value === "auto"
											? tSettings(
													"cursor.typeAutoDescription",
													"Uses the actual cursor from your recording.",
												)
											: tSettings(
													"cursor.typeCircleDescription",
													"A touch-style circle cursor like mobile simulators.",
												);
									return (
										<button
											key={option.value}
											type="button"
											onClick={() => onCursorTypeModeChange?.(option.value)}
											className={cn(
												"flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
												cursorTypeMode === option.value
													? "border-[#F59E0B]/55 bg-[#F59E0B]/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
													: "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
											)}
										>
											<div
												className={cn(
													"mt-1 h-4 w-4 rounded-full border",
													cursorTypeMode === option.value
														? "border-[#F59E0B] bg-[#F59E0B]"
														: "border-white/15 bg-transparent",
												)}
											/>
											<div>
												<div className="text-[15px] font-semibold text-slate-100">
													{option.label}
												</div>
												<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
													{description}
												</div>
											</div>
										</button>
									);
								})}
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label={tSettings("effects.cursorSize", "Size")}
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label={tSettings("cursor.tilt", "Tilt")}
									value={cursorTilt}
									defaultValue={DEFAULT_CURSOR_TILT}
									min={0}
									max={1}
									step={0.01}
									onChange={(v) => onCursorTiltChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.movementStyle", "Cursor Movement Style")}
							description="Choose a motion preset or fine-tune the spring behavior."
						>
							<div className="grid grid-cols-1 gap-2">
								{CURSOR_MOVEMENT_STYLE_OPTIONS.map((option) => {
									const descriptionMap: Record<CursorMovementStyle, string> = {
										slow: "Relaxed easing with a gentle follow and higher inertia.",
										smooth: "Ultra-smooth cinematic feel with high damping.",
										mellow: "Balanced smoothing for everyday tutorials and walkthroughs.",
										fast: "Quick, responsive smoothing for fast-paced content.",
										custom: "Tune tension, friction, and mass manually for full control.",
									};
									return (
										<button
											key={option.value}
											type="button"
											onClick={() => onCursorMovementStyleChange?.(option.value)}
											className={cn(
												"flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
												cursorMovementStyle === option.value
													? "border-[#F59E0B]/55 bg-[#F59E0B]/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
													: "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
											)}
										>
											<div
												className={cn(
													"mt-1 h-4 w-4 rounded-full border",
													cursorMovementStyle === option.value
														? "border-[#F59E0B] bg-[#F59E0B]"
														: "border-white/15 bg-transparent",
												)}
											/>
											<div>
												<div className="text-[15px] font-semibold text-slate-100">
													{option.label}
												</div>
												<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
													{descriptionMap[option.value]}
												</div>
											</div>
										</button>
									);
								})}
							</div>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("cursor.smoothMovement", "Smooth Movement")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Use spring smoothing instead of raw cursor tracking.
									</div>
								</div>
								<Switch
									checked={smoothMovementEnabled}
									onCheckedChange={onSmoothMovementEnabledChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
							{smoothMovementEnabled && cursorMovementStyle === "custom" && (
								<>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
										<SliderControl
											label={tSettings("cursor.tension", "Tension")}
											value={cursorSpring.tension}
											defaultValue={DEFAULT_CURSOR_SPRING.tension}
											min={120}
											max={700}
											step={1}
											onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, tension: v })}
											formatValue={(v) => `${Math.round(v)}`}
											parseInput={(t) => parseFloat(t)}
										/>
									</div>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
										<SliderControl
											label={tSettings("cursor.friction", "Friction")}
											value={cursorSpring.friction}
											defaultValue={DEFAULT_CURSOR_SPRING.friction}
											min={20}
											max={100}
											step={1}
											onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, friction: v })}
											formatValue={(v) => `${Math.round(v)}`}
											parseInput={(t) => parseFloat(t)}
										/>
									</div>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
										<SliderControl
											label={tSettings("cursor.mass", "Mass")}
											value={cursorSpring.mass}
											defaultValue={DEFAULT_CURSOR_SPRING.mass}
											min={0.5}
											max={1.6}
											step={0.01}
											onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, mass: v })}
											formatValue={(v) => `${v.toFixed(2)}`}
											parseInput={(t) => parseFloat(t)}
										/>
									</div>
								</>
							)}
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.cameraTracking", "Camera Tracking")}
							description="Fine-tune how the camera follows the cursor during zoom."
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label={tSettings("cursor.cameraTension", "Tension")}
									value={cameraSpring?.tension ?? DEFAULT_CAMERA_SPRING.tension}
									defaultValue={DEFAULT_CAMERA_SPRING.tension}
									min={60}
									max={500}
									step={1}
									onChange={(v) =>
										onCameraSpringChange?.({
											...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
											tension: v,
										})
									}
									formatValue={(v) => `${Math.round(v)}`}
									parseInput={(t) => parseFloat(t)}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label={tSettings("cursor.cameraFriction", "Friction")}
									value={cameraSpring?.friction ?? DEFAULT_CAMERA_SPRING.friction}
									defaultValue={DEFAULT_CAMERA_SPRING.friction}
									min={8}
									max={80}
									step={1}
									onChange={(v) =>
										onCameraSpringChange?.({
											...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
											friction: v,
										})
									}
									formatValue={(v) => `${Math.round(v)}`}
									parseInput={(t) => parseFloat(t)}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label={tSettings("cursor.cameraMass", "Mass")}
									value={cameraSpring?.mass ?? DEFAULT_CAMERA_SPRING.mass}
									defaultValue={DEFAULT_CAMERA_SPRING.mass}
									min={0.3}
									max={2.5}
									step={0.01}
									onChange={(v) =>
										onCameraSpringChange?.({
											...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
											mass: v,
										})
									}
									formatValue={(v) => `${v.toFixed(2)}`}
									parseInput={(t) => parseFloat(t)}
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.rendering", "Rendering")}
							description="Choose how cursor assets are rendered in preview and export."
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("cursor.highQualitySvg", "High Quality SVG Cursors")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Use Screen Mint&apos;s SVG cursor assets in preview and export.
									</div>
								</div>
								<Switch
									checked={highQualitySvgCursors}
									onCheckedChange={onHighQualitySvgCursorsChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
							<button
								type="button"
								onClick={() => setShowLegacyCursorSettings((current) => !current)}
								className="flex w-full items-center justify-between text-left"
							>
								<div>
									<div className="text-xs font-semibold text-slate-200">
										{tSettings("cursor.legacySettings", "Advanced Settings")}
									</div>
									<div className="mt-0.5 text-[10px] text-slate-500">
										Optional cursor appearance and compatibility controls for fine-tuning special
										cases.
									</div>
								</div>
								{showLegacyCursorSettings ? (
									<ChevronUp className="h-4 w-4 text-slate-400" />
								) : (
									<ChevronDown className="h-4 w-4 text-slate-400" />
								)}
							</button>
						</div>

						{showLegacyCursorSettings && (
							<>
								<SettingsSection
									title="Legacy Visibility"
									description="Compatibility controls for older projects"
								>
									<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<div>
											<div className="text-xs font-medium text-slate-300">
												{tSettings("effects.loopCursor")}
											</div>
											<div className="text-[10px] text-slate-500 mt-0.5">
												Loop cursor from last position to first
											</div>
										</div>
										<Switch
											checked={loopCursor}
											onCheckedChange={onLoopCursorChange}
											className="data-[state=checked]:bg-[#F59E0B] scale-90"
										/>
									</div>
								</SettingsSection>

								<SettingsSection title="Appearance" description="Customize how your cursor looks">
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<div className="text-xs font-medium text-slate-300 mb-2">
											{tSettings("cursor.pack")}
										</div>
										<div className="grid grid-cols-5 gap-1.5">
											{CURSOR_PACK_OPTIONS.map((opt) => (
												<button
													key={opt.value}
													type="button"
													onClick={() => onCursorPackChange?.(opt.value)}
													className={cn(
														"group relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
														cursorPack === opt.value
															? "bg-gradient-to-b from-[#F59E0B]/20 to-[#d97706]/10 ring-1 ring-[#F59E0B]/60 shadow-sm shadow-[#F59E0B]/10"
															: "bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/[0.1]",
													)}
													title={opt.label}
												>
													<div
														className={cn(
															"w-8 h-8 flex items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110",
															cursorPack === opt.value
																? "drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]"
																: "",
														)}
													>
														<img
															src={cursorPackPreviewUrls[opt.value]}
															alt={opt.label}
															className="w-6 h-6 object-contain pointer-events-none"
															draggable={false}
														/>
													</div>
													<span
														className={cn(
															"text-[8px] font-medium leading-tight text-center truncate w-full",
															cursorPack === opt.value
																? "text-[#F59E0B]"
																: "text-slate-500 group-hover:text-slate-300",
														)}
													>
														{opt.label}
													</span>
												</button>
											))}
										</div>
									</div>

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<div className="flex items-center justify-between mb-2.5">
											<span className="text-[11px] font-medium text-slate-300">Cursor Color</span>
											<button
												type="button"
												onClick={() => onCursorColorChange?.(DEFAULT_CURSOR_COLOR)}
												className="text-[10px] text-slate-600 hover:text-[#F59E0B] transition-colors duration-200 cursor-pointer"
											>
												Reset
											</button>
										</div>
										<div className="flex items-center gap-2">
											<label className="relative w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer overflow-hidden group hover:border-[#F59E0B]/40 transition-colors duration-200">
												<div
													className="absolute inset-[3px] rounded-[5px]"
													style={{ backgroundColor: cursorColor }}
												/>
												<input
													type="color"
													value={cursorColor}
													onChange={(e) => onCursorColorChange?.(e.target.value)}
													className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
											</label>
											<input
												type="text"
												value={cursorColor}
												onChange={(e) => onCursorColorChange?.(e.target.value)}
												className="flex-1 h-8 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-[11px] text-slate-200 font-mono tracking-wider focus:outline-none focus:border-[#F59E0B]/40 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
											/>
										</div>
									</div>

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
								</SettingsSection>

								<SettingsSection
									title="Motion"
									description="Fine-tune motion blur and trail effects"
								>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
										<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200 animate-in fade-in slide-in-from-top-1 duration-200">
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
								</SettingsSection>

								<SettingsSection
									title="Click Effects"
									description="Visual feedback when clicking"
									accentColor="amber"
								>
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<div className="flex items-center justify-between mb-2.5">
											<span className="text-[11px] font-medium text-slate-300">
												Click Highlight Color
											</span>
											<button
												type="button"
												onClick={() => onClickHighlightColorChange?.(DEFAULT_CLICK_HIGHLIGHT_COLOR)}
												className="text-[10px] text-slate-600 hover:text-[#F59E0B] transition-colors duration-200 cursor-pointer"
											>
												Reset
											</button>
										</div>
										<div className="flex items-center gap-2">
											<label className="relative w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer overflow-hidden group hover:border-[#F59E0B]/40 transition-colors duration-200">
												<div
													className="absolute inset-[3px] rounded-[5px]"
													style={{ backgroundColor: clickHighlightColor }}
												/>
												<input
													type="color"
													value={clickHighlightColor}
													onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
													className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
												/>
											</label>
											<input
												type="text"
												value={clickHighlightColor}
												onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
												className="flex-1 h-8 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-[11px] text-slate-200 font-mono tracking-wider focus:outline-none focus:border-[#F59E0B]/40 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
											/>
										</div>
									</div>

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
								</SettingsSection>
							</>
						)}
					</TabContent>
				)}

				{activeTab === "keyboard" && (
					<TabContent>
						<TabHeader
							title={tSettings("keyboard.title")}
							description="Show keyboard shortcuts used during recording"
						/>

						<SettingsSection
							title="Display"
							description="Toggle keyboard shortcut overlay visibility"
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("keyboard.showShortcuts")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Overlay shortcut keys in the video
									</div>
								</div>
								<Switch
									checked={showKeyboardShortcuts}
									onCheckedChange={onShowKeyboardShortcutsChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Layout"
							description="Position and style of the shortcut display"
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
												"px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer",
												keyboardShortcutPosition === option.value
													? "bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
													: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/[0.04]",
											)}
										>
											{tSettings(`keyboard.positions.${option.value}`)}
										</button>
									))}
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
												"px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer",
												keyboardShortcutTheme === option.value
													? "bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
													: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/[0.04]",
											)}
										>
											{tSettings(`keyboard.themes.${option.value}`)}
										</button>
									))}
								</div>
							</div>
						</SettingsSection>

						<SettingsSection title="Appearance" description="Fine-tune size, opacity, and timing">
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<SliderControl
									label={tSettings("keyboard.maxVisible")}
									value={keyboardShortcutMaxVisible}
									defaultValue={DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE}
									min={1}
									max={3}
									step={1}
									onChange={(value) => onKeyboardShortcutMaxVisibleChange?.(Math.round(value))}
									formatValue={(value) => `${Math.round(value)}`}
									parseInput={(text) => parseInt(text, 10)}
								/>
							</div>
						</SettingsSection>
					</TabContent>
				)}

				{/* Background tab */}
				{activeTab === "background" && (
					<TabContent>
						<TabHeader
							title={tSettings("background.title")}
							description="Set the backdrop behind your recording canvas"
						/>
						<Tabs
							value={backgroundTab}
							onValueChange={(value) => setBackgroundTab(value as BackgroundTab)}
							className="w-full"
						>
							<TabsList className="mb-3 bg-white/[0.04] border border-white/[0.06] p-0.5 w-full grid grid-cols-3 h-8 rounded-xl">
								<TabsTrigger
									value="image"
									className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[10px] font-medium py-1 rounded-lg transition-all duration-200"
								>
									{tSettings("background.image")}
								</TabsTrigger>
								<TabsTrigger
									value="color"
									className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[10px] font-medium py-1 rounded-lg transition-all duration-200"
								>
									{tSettings("background.color")}
								</TabsTrigger>
								<TabsTrigger
									value="gradient"
									className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[10px] font-medium py-1 rounded-lg transition-all duration-200"
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
										className="w-full gap-2 bg-white/[0.04] text-slate-200 border-white/[0.08] hover:bg-[#F59E0B]/15 hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all duration-200 h-8 text-[10px] rounded-xl"
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
														"aspect-square w-9 h-9 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 relative group shadow-sm hover:scale-105",
														isSelected
															? "border-[#F59E0B] ring-1 ring-[#F59E0B]/30"
															: "border-white/10 hover:border-[#F59E0B]/40 opacity-80 hover:opacity-100 bg-white/5",
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
														"aspect-square w-9 h-9 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:scale-105",
														isSelected
															? "border-[#F59E0B] ring-1 ring-[#F59E0B]/30"
															: "border-white/10 hover:border-[#F59E0B]/40 opacity-80 hover:opacity-100 bg-white/5",
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

								<TabsContent value="color" className="mt-0 p-2.5">
									<ColorPicker
										color={selectedColor}
										colors={colorPalette}
										onChange={(color) => {
											setSelectedColor(color.hex);
											onWallpaperChange(color.hex);
										}}
									/>
								</TabsContent>

								<TabsContent value="gradient" className="mt-0">
									<div className="grid grid-cols-7 gap-1.5">
										{GRADIENTS.map((g, idx) => (
											<div
												key={g}
												className={cn(
													"aspect-square w-9 h-9 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:scale-105",
													gradient === g
														? "border-[#F59E0B] ring-1 ring-[#F59E0B]/30"
														: "border-white/10 hover:border-[#F59E0B]/40 opacity-80 hover:opacity-100 bg-white/5",
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
					</TabContent>
				)}

				{/* Zoom tab */}
				{activeTab === "zoom" && (
					<TabContent>
						<TabHeader
							title={tSettings("zoom.level")}
							description="Choose magnification level for zoom regions"
							badge={
								zoomEnabled && selectedZoomDepth
									? ZOOM_DEPTH_OPTIONS.find((o) => o.depth === selectedZoomDepth)?.label
									: undefined
							}
						/>

						<SettingsSection
							title="Zoom Depth"
							description="Select how much to magnify the zoomed area"
						>
							<div className="grid grid-cols-2 gap-1.5">
								{(
									[
										{ value: "static", label: "Static" },
										{ value: "cursor-follow", label: "Cursor Follow" },
									] as const
								).map((option) => {
									const isActive = selectedZoomMode === option.value;
									return (
										<Button
											key={option.value}
											type="button"
											disabled={!zoomEnabled}
											onClick={() => onZoomModeChange?.(option.value)}
											className={cn(
												"h-10 rounded-xl border shadow-sm transition-all justify-center",
												"duration-200 ease-out",
												zoomEnabled
													? "opacity-100 cursor-pointer"
													: "opacity-40 cursor-not-allowed",
												isActive
													? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-slate-200",
											)}
										>
											<span className="text-xs font-semibold">{option.label}</span>
										</Button>
									);
								})}
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
												"h-10 rounded-xl border shadow-sm transition-all justify-center",
												"duration-200 ease-out",
												zoomEnabled
													? "opacity-100 cursor-pointer"
													: "opacity-40 cursor-not-allowed",
												isActive
													? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-slate-200",
											)}
										>
											<span className="text-xs font-semibold">{option.label}</span>
										</Button>
									);
								})}
							</div>
							{!zoomEnabled && (
								<div className="flex items-center justify-center py-3 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08]">
									<p className="text-[10px] text-slate-500 text-center">
										{tSettings("zoom.selectRegion")}
									</p>
								</div>
							)}
							{zoomEnabled && (
								<Button
									onClick={handleDeleteClick}
									variant="destructive"
									size="sm"
									className="w-full gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 h-9 text-xs rounded-xl"
								>
									<Trash2 className="w-3.5 h-3.5" />
									{tSettings("zoom.deleteZoom")}
								</Button>
							)}
						</SettingsSection>

						{trimEnabled && (
							<SettingsSection
								title="Trim Region"
								description="Remove the selected trim region from the timeline"
								accentColor="red"
							>
								<Button
									onClick={handleTrimDeleteClick}
									variant="destructive"
									size="sm"
									className="w-full gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 h-9 text-xs rounded-xl"
								>
									<Trash2 className="w-3.5 h-3.5" />
									{tSettings("trim.deleteRegion")}
								</Button>
							</SettingsSection>
						)}
					</TabContent>
				)}

				{/* Speed tab */}
				{activeTab === "speed" && (
					<TabContent>
						<TabHeader
							title={tSettings("speed.playbackSpeed")}
							description="Adjust playback speed for selected timeline regions"
							badge={
								selectedSpeedId && selectedSpeedValue
									? (SPEED_OPTIONS.find((o) => o.speed === selectedSpeedValue)?.label ??
										`${selectedSpeedValue}×`)
									: undefined
							}
							badgeColor="amber"
						/>

						<SettingsSection
							title="Speed Presets"
							description="Choose a speed multiplier for the selected region"
							accentColor="amber"
						>
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
												"h-10 rounded-xl border shadow-sm transition-all justify-center",
												"duration-200 ease-out",
												selectedSpeedId
													? "opacity-100 cursor-pointer"
													: "opacity-40 cursor-not-allowed",
												isActive
													? "border-[#d97706] bg-gradient-to-br from-[#d97706] to-[#b45309] text-white shadow-lg shadow-[#d97706]/25"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-slate-200",
											)}
										>
											<span className="text-xs font-semibold">{option.label}</span>
										</Button>
									);
								})}
							</div>
							{!selectedSpeedId && (
								<div className="flex items-center justify-center py-3 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08]">
									<p className="text-[10px] text-slate-500 text-center">
										{tSettings("speed.selectRegion")}
									</p>
								</div>
							)}
							{selectedSpeedId && (
								<Button
									onClick={() => selectedSpeedId && onSpeedDelete?.(selectedSpeedId)}
									variant="destructive"
									size="sm"
									className="w-full gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 h-9 text-xs rounded-xl"
								>
									<Trash2 className="w-3.5 h-3.5" />
									{tSettings("speed.deleteRegion")}
								</Button>
							)}
						</SettingsSection>
					</TabContent>
				)}

				{activeTab === "audio" && (
					<TabContent>
						<TabHeader
							title={tSettings("audio.title", "Background Audio")}
							description="Add background music to polish your recording"
							badge={tSettings("audio.subtleMix", "Subtle Mix")}
						/>

						<SettingsSection
							title="Audio Source"
							description="Upload your own track or browse the built-in library"
						>
							<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
										className="w-full gap-2 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all duration-200 rounded-xl"
									>
										<Upload className="h-3.5 w-3.5" />
										{tSettings("audio.upload", "Upload audio")}
									</Button>
								</div>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Built-in Library"
							description="Curated tracks organized by mood"
						>
							<div className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
								{Object.entries(builtInTracksByMood).map(([mood, tracks], moodIndex) => (
									<div
										key={mood}
										className={cn("p-2.5", moodIndex > 0 && "border-t border-white/[0.04]")}
									>
										<div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
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
															"w-full rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
															isSelected
																? "border-[#F59E0B]/40 bg-[#F59E0B]/10 shadow-sm shadow-[#F59E0B]/10"
																: "border-white/[0.06] bg-black/10 hover:bg-white/[0.04] hover:border-white/[0.1]",
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
																		"flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
																		playingBuiltInTrackId === track.id
																			? "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/20"
																			: "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100",
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
															<div className="text-[10px] text-slate-500 font-mono">
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
						</SettingsSection>

						<SettingsSection
							title="Selected Region"
							description="Adjust properties for the selected audio region"
							accentColor="amber"
						>
							{selectedAudio ? (
								<>
									<div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
										<div className="text-xs font-medium text-slate-200">
											{getAudioRegionDisplayName(selectedAudio)}
										</div>
										<div className="mt-0.5 text-[10px] text-slate-500">
											{selectedAudio.sourceType === "built-in"
												? tSettings("audio.builtIn", "Built-in")
												: tSettings("audio.uploaded", "Uploaded")}
										</div>
									</div>

									<div className="grid grid-cols-2 gap-1.5">
										<Button
											type="button"
											onClick={() => void handleReplaceBuiltInAudio()}
											disabled={!selectedBuiltInTrack}
											className="gap-1.5 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] rounded-xl text-[10px] transition-all duration-200"
										>
											<Music className="h-3 w-3" />
											{tSettings("audio.replaceBuiltIn", "Replace selected")}
										</Button>
										<Button
											type="button"
											onClick={() => void handleReplaceWithUploadedAudio()}
											className="gap-1.5 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] rounded-xl text-[10px] transition-all duration-200"
										>
											<Upload className="h-3 w-3" />
											{tSettings("audio.replaceUpload", "Replace with file")}
										</Button>
									</div>

									{missingAudioPath && (
										<div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-[11px] text-amber-100">
											<div className="font-semibold text-amber-50">
												{tSettings("audio.missingTitle", "Audio source missing")}
											</div>
											<div className="mt-1 truncate text-amber-100/80">{missingAudioPath}</div>
											<div className="mt-2 flex gap-2">
												<Button
													type="button"
													onClick={() => void onRelinkMissingAudio?.()}
													className="flex-1 bg-amber-300/20 text-amber-50 hover:bg-amber-300/30 rounded-xl"
												>
													{tSettings("audio.relink", "Relink audio")}
												</Button>
												<Button
													type="button"
													onClick={() => onRemoveMissingAudio?.()}
													className="flex-1 bg-white/7 text-slate-100 hover:bg-white/12 rounded-xl"
												>
													{tSettings("audio.remove", "Remove")}
												</Button>
											</div>
										</div>
									)}

									<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
										<div>
											<div className="text-xs font-medium text-slate-300">
												{tSettings("audio.loop", "Loop audio")}
											</div>
											<div className="text-[10px] text-slate-500 mt-0.5">
												Repeat audio when it ends
											</div>
										</div>
										<Switch
											checked={selectedAudio.loop}
											onCheckedChange={(checked) => onAudioLoopChange?.(selectedAudio.id, checked)}
											className="data-[state=checked]:bg-[#F59E0B] scale-90"
										/>
									</div>

									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
										className="w-full gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 h-9 text-xs rounded-xl"
									>
										<Trash2 className="h-3.5 w-3.5" />
										{tSettings("audio.deleteRegion", "Delete Audio Region")}
									</Button>
								</>
							) : (
								<div className="flex items-center justify-center py-4 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08]">
									<p className="text-[10px] text-slate-500 text-center">
										{tSettings(
											"audio.empty",
											"Choose a built-in track or upload your own file, then add it at the playhead.",
										)}
									</p>
								</div>
							)}
						</SettingsSection>
					</TabContent>
				)}

				{/* Annotation tab */}
				{activeTab === "annotation" && (
					<TabContent>
						{selectedAnnotation &&
						onAnnotationContentChange &&
						onAnnotationTypeChange &&
						onAnnotationStyleChange &&
						onAnnotationDelete ? (
							<>
								<TabHeader
									title="Annotation"
									description="Edit the selected annotation's content and style"
								/>
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
							</>
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
									<MessageSquare className="w-7 h-7 text-slate-600" />
								</div>
								<p className="text-sm font-medium text-slate-400">No Annotation Selected</p>
								<p className="text-[11px] text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
									Select an annotation on the timeline to edit its settings
								</p>
							</div>
						)}
					</TabContent>
				)}

				{/* Captions tab */}
				{activeTab === "captions" && captionSettings && (
					<TabContent>
						<TabHeader
							title={t("editor.captions.title", "Captions")}
							description="Generate and style captions from your recording audio"
							badge={
								captionRegions.length > 0
									? `${captionRegions.length} caption${captionRegions.length !== 1 ? "s" : ""}`
									: undefined
							}
						/>

						<SettingsSection title="Display" description="Toggle caption visibility in your export">
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{t("editor.captions.showCaptions", "Show Captions")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Overlay captions on the video
									</div>
								</div>
								<Switch
									checked={captionSettings.enabled}
									onCheckedChange={(enabled) => onCaptionSettingsChange?.({ enabled })}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Transcription"
							description="Generate captions from your recording audio"
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
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
										<div className="text-[10px] uppercase tracking-wider text-[#F59E0B]">
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
									className="w-full h-9 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 text-xs font-semibold"
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
										className="h-8 rounded-xl border border-white/[0.06] bg-white/[0.04] text-[10px] text-slate-300 hover:bg-white/[0.08] transition-colors duration-200"
									>
										{t("editor.captions.exportSrt", "Export SRT")}
									</Button>
									<Button
										type="button"
										onClick={() => onCaptionExport?.("vtt")}
										disabled={captionRegions.length === 0}
										className="h-8 rounded-xl border border-white/[0.06] bg-white/[0.04] text-[10px] text-slate-300 hover:bg-white/[0.08] transition-colors duration-200"
									>
										{t("editor.captions.exportVtt", "Export VTT")}
									</Button>
									<Button
										type="button"
										onClick={() => onCaptionExport?.("txt")}
										disabled={captionRegions.length === 0}
										className="h-8 rounded-xl border border-white/[0.06] bg-white/[0.04] text-[10px] text-slate-300 hover:bg-white/[0.08] transition-colors duration-200"
									>
										{t("editor.captions.exportTxt", "Export TXT")}
									</Button>
								</div>
							</div>
						</SettingsSection>

						<SettingsSection title="Styling" description="Customize caption appearance and layout">
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
												"h-8 rounded-lg border shadow-sm transition-all duration-200 justify-center",
												captionSettings.style.preset === preset
													? "border-[#F59E0B] bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
											)}
										>
											<span className="text-[10px] font-semibold capitalize">{preset}</span>
										</Button>
									))}
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{t("editor.captions.position", "Position")}
								</label>
								<div className="grid grid-cols-3 gap-1.5">
									{(["top", "center", "bottom"] as const).map((pos) => (
										<Button
											key={pos}
											type="button"
											onClick={() => onCaptionSettingsChange?.({ position: pos })}
											className={cn(
												"h-8 rounded-lg border shadow-sm transition-all duration-200 justify-center",
												captionSettings.position === pos
													? "border-[#F59E0B] bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
											)}
										>
											<span className="text-[10px] font-semibold capitalize">{pos}</span>
										</Button>
									))}
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{t("editor.captions.textColor", "Text Color")}
								</label>
								<ColorPicker
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
										"#F59E0B",
									]}
								/>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
						</SettingsSection>

						{/* Caption list */}
						{captionRegions.length > 0 && (
							<SettingsSection title="Caption List" description="Edit individual caption segments">
								<div className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
									<div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
										<label className="text-xs font-medium text-slate-300">
											{t("editor.captions.title", "Captions")} ({captionRegions.length})
										</label>
										<Button
											type="button"
											onClick={onDeleteAllCaptions}
											className="h-6 px-2 rounded-lg border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15 text-[10px] transition-colors duration-200"
										>
											<Trash2 className="w-3 h-3 mr-1" />
											{t("editor.captions.clearAll", "Clear All")}
										</Button>
									</div>
									<div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar p-1.5">
										{captionRegions.map((caption) => (
											<div
												key={caption.id}
												onClick={() => onSelectCaption?.(caption.id)}
												className={cn(
													"flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all duration-200",
													selectedCaptionId === caption.id
														? "border-[#F59E0B]/30 bg-[#F59E0B]/8 shadow-sm shadow-[#F59E0B]/10"
														: "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08]",
												)}
											>
												<div className="flex-1 min-w-0">
													<div className="text-[10px] text-slate-500 mb-1 font-mono">
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
															className="h-6 px-2 rounded-lg border border-white/[0.06] bg-white/[0.04] text-[10px] text-slate-300 hover:bg-white/[0.08] transition-colors duration-200"
														>
															{t("editor.captions.split", "Split")}
														</Button>
														<Button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																onCaptionMergeNext?.(caption.id);
															}}
															className="h-6 px-2 rounded-lg border border-white/[0.06] bg-white/[0.04] text-[10px] text-slate-300 hover:bg-white/[0.08] transition-colors duration-200"
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
													className="shrink-0 p-1 text-slate-500 hover:text-red-400 transition-colors duration-200 rounded-md hover:bg-red-500/10"
												>
													<X className="w-3 h-3" />
												</button>
											</div>
										))}
									</div>
								</div>
							</SettingsSection>
						)}
					</TabContent>
				)}

				{/* Webcam tab */}
				{activeTab === "webcam" && webcamPath && webcamRegion && (
					<TabContent>
						<TabHeader
							title={tSettings("webcam.title")}
							description="Configure your webcam overlay display"
							badge={selectedCameraLayout ? tSettings("webcam.layoutBadge") : undefined}
							badgeColor="blue"
							trailing={
								<Button
									type="button"
									onClick={() => setShowAdvancedWebcam((prev) => !prev)}
									className="h-7 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.08] transition-all duration-200"
								>
									{showAdvancedWebcam
										? tSettings("webcam.hideAdvanced")
										: tSettings("webcam.showAdvanced")}
								</Button>
							}
						/>

						{webcamMissing && (
							<div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100 mb-4">
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
											<div className="mt-2 truncate rounded-lg bg-black/20 px-2 py-1 font-mono text-[10px] text-amber-50/80">
												{missingWebcamPath}
											</div>
										)}
										<div className="mt-3 grid grid-cols-2 gap-2">
											<Button
												type="button"
												onClick={onRelinkMissingWebcam}
												className="h-8 rounded-xl border border-amber-300/30 bg-amber-300/15 text-[10px] font-semibold text-amber-50 hover:bg-amber-300/25 transition-colors duration-200"
											>
												{tSettings("webcam.relink")}
											</Button>
											<Button
												type="button"
												onClick={onRemoveMissingWebcam}
												className="h-8 rounded-xl border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors duration-200"
											>
												{tSettings("webcam.remove")}
											</Button>
										</div>
									</div>
								</div>
							</div>
						)}

						<SettingsSection
							title="Display"
							description="Show or hide your webcam overlay"
							accentColor="blue"
						>
							<div className="grid grid-cols-2 gap-1.5">
								<Button
									type="button"
									onClick={onResetRecommendedWebcam}
									className="h-8 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[10px] font-semibold text-[#9ff0c8] hover:bg-[#F59E0B]/18 transition-colors duration-200"
								>
									{tSettings("webcam.resetRecommended")}
								</Button>
								{selectedCameraLayout ? (
									<Button
										type="button"
										onClick={onResetSelectedCameraLayout}
										className="h-8 rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[10px] font-semibold text-[#a9c7ff] hover:bg-[#3b82f6]/18 transition-colors duration-200"
									>
										{tSettings("webcam.resetLayout")}
									</Button>
								) : (
									<div className="h-8 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 text-[10px] font-medium text-slate-500 flex items-center justify-center">
										{tSettings("webcam.recommendedDefaults")}
									</div>
								)}
							</div>

							{selectedCameraLayout && (
								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
									<label className="text-xs font-medium text-slate-300 mb-2 block">
										{tSettings("webcam.cameraLayout")}
									</label>
									<div className="grid grid-cols-3 gap-1.5">
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
													"h-9 rounded-lg border shadow-sm transition-all duration-200 justify-center",
													selectedCameraLayout.mode === mode
														? "border-[#3b82f6] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-sm shadow-[#3b82f6]/20"
														: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
												)}
											>
												<span className="text-xs font-semibold">{label}</span>
											</Button>
										))}
									</div>
								</div>
							)}

							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("webcam.showWebcam")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Display webcam in the export
									</div>
								</div>
								<Switch
									checked={showWebcam}
									onCheckedChange={onShowWebcamChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>

							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("webcam.mirrorCamera")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Horizontally flip the webcam feed
									</div>
								</div>
								<Switch
									checked={mirrorWebcam}
									onCheckedChange={onMirrorWebcamChange}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title="Position & Size"
							description="Place and resize your webcam on the canvas"
							accentColor="blue"
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<label className="text-xs font-medium text-slate-300 mb-2 block">
									{tSettings("webcam.position")}
								</label>
								<div className="grid grid-cols-2 gap-1.5">
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
												"h-8 rounded-lg border text-[10px] transition-all duration-200",
												webcamRegion.anchor === preset.anchor
													? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#fde68a] shadow-sm shadow-[#F59E0B]/10"
													: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
											)}
										>
											{preset.label}
										</Button>
									))}
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
						</SettingsSection>

						<SettingsSection
							title="Appearance"
							description="Customize border, shape, and style"
							accentColor="blue"
						>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
						</SettingsSection>

						{showAdvancedWebcam && (
							<SettingsSection
								title="Advanced"
								description="Fine-tune shape, opacity, and additional border settings"
								accentColor="blue"
								className="animate-in fade-in slide-in-from-top-2 duration-200"
							>
								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
									<label className="text-xs font-medium text-slate-300 mb-2 block">
										{tSettings("webcam.shape")}
									</label>
									<div className="grid grid-cols-3 gap-1.5">
										{(["circle", "square", "rectangle"] as const).map((shape) => (
											<Button
												key={shape}
												type="button"
												onClick={() => onWebcamRegionChange?.({ shape })}
												className={cn(
													"h-9 rounded-lg border shadow-sm transition-all duration-200 justify-center",
													webcamRegion.shape === shape
														? "border-[#3b82f6] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-sm shadow-[#3b82f6]/20"
														: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
												)}
											>
												<span className="text-xs font-semibold capitalize">{shape}</span>
											</Button>
										))}
									</div>
								</div>

								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
									<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
							</SettingsSection>
						)}
					</TabContent>
				)}
			</div>

			{showCropModal && cropRegion && onCropChange && (
				<>
					{/* Backdrop */}
					<div
						className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 opacity-100 duration-300 ease-out animate-in fade-in"
						onClick={handleCropCancel}
					/>

					{/* Dialog */}
					<div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
						<div className="pointer-events-auto w-[90vw] max-w-5xl max-h-[90vh] bg-[#0A0F0D] rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.08] overflow-hidden opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3">
							{/* Top accent line */}
							<div className="h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />

							<div className="p-8 overflow-auto max-h-[calc(90vh-2px)]">
								{/* Header */}
								<div className="flex items-center justify-between mb-6">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B]/20 to-[#d97706]/10 border border-[#F59E0B]/20 flex items-center justify-center">
											<Crop className="w-5 h-5 text-[#F59E0B]" />
										</div>
										<div>
											<h2 className="text-[15px] font-semibold text-white tracking-tight">
												{tSettings("crop.title")}
											</h2>
											<p className="text-[11px] text-slate-500 mt-0.5">
												{tSettings("crop.instruction")}
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={handleCropCancel}
										className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all duration-200 active:scale-95"
									>
										<X className="w-4 h-4" />
									</button>
								</div>

								{/* Crop area */}
								<div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/20">
									<CropControl
										videoElement={videoElement || null}
										cropRegion={cropRegion}
										baseCropRegion={baseCropRegion}
										onCropChange={onCropChange}
										aspectRatio={aspectRatio}
									/>
								</div>

								{/* Footer */}
								<div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mt-6 mb-5" />
								<div className="flex items-center justify-between">
									<Button
										variant="outline"
										onClick={handleCropCancel}
										className="h-10 px-5 text-xs font-medium bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 hover:border-white/[0.12] rounded-xl transition-all duration-200"
									>
										Cancel
									</Button>
									<Button
										onClick={() => setShowCropModal(false)}
										className="h-10 px-6 text-xs font-semibold bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white rounded-xl shadow-lg shadow-[#F59E0B]/20 hover:shadow-[#F59E0B]/30 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 border border-[#F59E0B]/30"
									>
										{t("common.actions.done")}
									</Button>
								</div>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
