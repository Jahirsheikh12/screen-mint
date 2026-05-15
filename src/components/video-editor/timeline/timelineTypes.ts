import type { Span } from "dnd-timeline";
import { Camera, Gauge, MessageSquare, Music } from "lucide-react";
import type {
	AnnotationRegion,
	AudioRegion,
	AudioTrackSelection,
	CameraLayoutRegion,
	CaptionRegion,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
} from "../types";

export type AdditionalLayerType = "annotation" | "camera" | "speed" | "audio" | "caption";

export const CLIP_ROW_ID = "row-clip";
export const ZOOM_ROW_ID = "row-zoom";
export const ANNOTATION_ROW_ID = "row-annotation";
export const SPEED_ROW_ID = "row-speed";
export const AUDIO_ROW_ID = "row-audio";
export const CAMERA_ROW_ID = "row-camera";
export const CAPTION_ROW_ID = "row-caption";
export const ICON_SIDEBAR_WIDTH = 48;

export const ADDITIONAL_LAYER_OPTIONS: {
	type: AdditionalLayerType;
	label: string;
	icon: typeof Camera;
}[] = [
	{ type: "annotation", label: "Annotation", icon: MessageSquare },
	{ type: "camera", label: "Layouts", icon: Camera },
	{ type: "speed", label: "Speed", icon: Gauge },
	{ type: "audio", label: "Audio", icon: Music },
	{ type: "caption", label: "Caption", icon: MessageSquare },
];

export interface TimelineEditorProps {
	videoDuration: number;
	currentTime: number;
	onSeek?: (time: number) => void;
	cursorTelemetry?: CursorTelemetryPoint[];
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus, mode?: ZoomMode) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions?: TrimRegion[];
	cutPoints?: number[];
	onSplitClip?: (timeMs: number) => void;
	onDeleteSegment?: (startMs: number, endMs: number) => void;
	onTrimAdded?: (span: Span) => void;
	onTrimSpanChange?: (id: string, span: Span) => void;
	onTrimDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onSelectTrim?: (id: string | null) => void;
	annotationRegions?: AnnotationRegion[];
	onAnnotationAdded?: (span: Span) => void;
	onAnnotationSpanChange?: (id: string, span: Span) => void;
	onAnnotationDelete?: (id: string) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	cameraLayouts?: CameraLayoutRegion[];
	onCameraLayoutAdded?: (span: Span) => void;
	onCameraLayoutSpanChange?: (id: string, span: Span) => void;
	onCameraLayoutDelete?: (id: string) => void;
	selectedCameraLayoutId?: string | null;
	onSelectCameraLayout?: (id: string | null) => void;
	captionRegions?: CaptionRegion[];
	onCaptionAdded?: (span: Span) => void;
	onCaptionSpanChange?: (id: string, span: Span) => void;
	onCaptionDelete?: (id: string) => void;
	selectedCaptionId?: string | null;
	onSelectCaption?: (id: string | null) => void;
	speedRegions?: SpeedRegion[];
	onSpeedAdded?: (span: Span) => void;
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onSpeedDelete?: (id: string) => void;
	selectedSpeedId?: string | null;
	onSelectSpeed?: (id: string | null) => void;
	audioRegions?: AudioRegion[];
	onAudioAdded?: (selection: AudioTrackSelection, clickTimeMs?: number) => void | Promise<void>;
	onAudioSpanChange?: (id: string, span: Span) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	aspectRatio: import("@/utils/aspectRatioUtils").AspectRatio;
	onAspectRatioChange: (aspectRatio: import("@/utils/aspectRatioUtils").AspectRatio) => void;
	isPlaying?: boolean;
	onTogglePlayPause?: () => void;
	onSkipForward?: () => void;
	onSkipBack?: () => void;
	playbackSpeed?: number;
	videoPath?: string | null;
	hasAudio?: boolean;
	clipVolume?: number;
	onClipVolumeChange?: (volume: number) => void;
}

export interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	label: string;
	zoomDepth?: number;
	speedValue?: number;
	variant: "zoom" | "trim" | "annotation" | "speed" | "audio" | "camera" | "caption" | "clip";
	clipDuration?: string;
	clipSpeed?: string;
	sourceStart?: number;
	sourceEnd?: number;
}

export interface TimelineProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	currentTimeMs: number;
	onSeek?: (time: number) => void;
	onSelectZoom?: (id: string | null) => void;
	onSelectTrim?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectCameraLayout?: (id: string | null) => void;
	onSelectSpeed?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onSelectCaption?: (id: string | null) => void;
	selectedZoomId: string | null;
	selectedAnnotationId?: string | null;
	selectedCameraLayoutId?: string | null;
	selectedSpeedId?: string | null;
	selectedAudioId?: string | null;
	selectedCaptionId?: string | null;
	keyframes?: { id: string; time: number }[];
	onAddZoom?: (clickTimeMs?: number) => void;
	onAddAnnotation?: (clickTimeMs?: number) => void;
	onAddCameraLayout?: (clickTimeMs?: number) => void;
	onAddSpeed?: (clickTimeMs?: number) => void;
	onAddAudio?: (clickTimeMs?: number) => void;
	onAddCaption?: (clickTimeMs?: number) => void;
	onDeleteZoom?: (id: string) => void;
	onDeleteAnnotation?: (id: string) => void;
	onDeleteCameraLayout?: (id: string) => void;
	onDeleteSpeed?: (id: string) => void;
	onDeleteAudio?: (id: string) => void;
	onDeleteCaption?: (id: string) => void;
	visibleLayers: Set<AdditionalLayerType>;
	selectedClip: boolean;
	onSelectClip?: (selected: boolean) => void;
	trimMode?: boolean;
	onSplitClip?: (timeMs: number) => void;
	onDeleteSegment?: (startMs: number, endMs: number) => void;
	waveformData?: Float32Array | null;
	sourceDurationMs?: number;
}
