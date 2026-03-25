import Block from "@uiw/react-color-block";
import {
	AlertTriangle,
	Camera,
	Captions,
	Crop,
	Gauge,
	Loader2,
	MessageSquare,
	MousePointer2,
	Palette,
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
import { cn } from "@/lib/utils";
import { BUILT_IN_WALLPAPERS, WALLPAPER_PATHS, WALLPAPER_RELATIVE_PATHS } from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { useI18n, useScopedT } from "../../contexts/I18nContext";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import { CropControl } from "./CropControl";
import { loadEditorPreferences, saveEditorPreferences } from "./editorPreferences";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { SliderControl } from "./SliderControl";
import type {
	AnnotationRegion,
	AnnotationType,
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
	CursorStyle,
	FigureData,
	PlaybackSpeed,
	WebcamRegion,
	ZoomDepth,
} from "./types";
import {
	CAMERA_ZOOM_SCALE_DISABLED,
	CAPTION_STYLE_PRESETS,
	CURSOR_STYLE_OPTIONS,
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
	DEFAULT_ZOOM_MOTION_BLUR,
	SPEED_OPTIONS,
} from "./types";
import { fromCursorSwaySliderValue, toCursorSwaySliderValue } from "./videoPlayback/cursorSway";

const GRADIENTS = [
	"linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
	"linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
	"radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
	"linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
	"linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
	"linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
	"radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
	"linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
	"linear-gradient(135deg, #FBC8B4, #2447B1)",
	"linear-gradient(109.6deg, #F635A6, #36D860)",
	"linear-gradient(90deg, #FF0101, #4DFF01)",
	"linear-gradient(315deg, #EC0101, #5044A9)",
	"linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
	"linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
	"linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
	"linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
	"linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
	"linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
	"linear-gradient(to right, #fa709a 0%, #fee140 100%)",
	"linear-gradient(to top, #30cfd0 0%, #330867 100%)",
	"linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
	"linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
	"linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
	"linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

type BackgroundTab = "image" | "color" | "gradient";

function isHexWallpaper(value: string): boolean {
	return /^#(?:[0-9a-f]{3}){1,2}$/i.test(value);
}

function getBackgroundTabForWallpaper(value: string): BackgroundTab {
	if (GRADIENTS.includes(value)) {
		return "gradient";
	}

	if (isHexWallpaper(value)) {
		return "color";
	}

	return "image";
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

export default SettingsPanel;

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

export function SettingsPanel({
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
	borderRadius = 12.5,
	onBorderRadiusChange,
	padding = 50,
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
		"effects" | "cursor" | "background" | "zoom" | "speed" | "annotation" | "webcam" | "captions"
	>("effects");
	const cropSnapshotRef = useRef<CropRegion | null>(null);

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

		// Validate file type - only allow JPG/JPEG
		const validTypes = ["image/jpeg", "image/jpg"];
		if (!validTypes.includes(file.type)) {
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
		if (cameraSelected || selectedCameraLayout) {
			setActiveTab("webcam");
		}
	}, [cameraSelected, selectedCameraLayout]);

	const sidebarTabs = [
		{ id: "effects" as const, icon: Sparkles, label: tSettings("effects.title") },
		{ id: "cursor" as const, icon: MousePointer2, label: "Cursor" },
		{ id: "background" as const, icon: Palette, label: tSettings("background.title") },
		{ id: "zoom" as const, icon: ZoomIn, label: tSettings("zoom.level") },
		{ id: "speed" as const, icon: Gauge, label: tSettings("speed.playbackSpeed") },
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
									defaultValue={50}
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
							<span className="text-sm font-medium text-slate-200">Cursor</span>
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
										accept=".jpg,.jpeg,image/jpeg"
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
