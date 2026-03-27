import type { Range, Span } from "dnd-timeline";
import { useTimelineContext } from "dnd-timeline";
import {
	Camera,
	Check,
	ChevronDown,
	Gauge,
	Layers,
	MessageSquare,
	Music,
	Pause,
	Play,
	Plus,
	Scissors,
	SkipBack,
	SkipForward,
	WandSparkles,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { matchesShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
	ASPECT_RATIOS,
	type AspectRatio,
	getAspectRatioLabel,
	isCustomAspectRatio,
} from "@/utils/aspectRatioUtils";
import { getAudioRegionDisplayName, loadAudioSelectionDurationMs } from "../audioRegionUtils";
import { loadEditorPreferences, saveEditorPreferences } from "../editorPreferences";
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
	ZoomRegion,
} from "../types";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
import Row from "./Row";
import TimelineWrapper from "./TimelineWrapper";
import { detectInteractionCandidates, normalizeCursorTelemetry } from "./zoomSuggestionUtils";

const CLIP_ROW_ID = "row-clip";
const ZOOM_ROW_ID = "row-zoom";
const TRIM_ROW_ID = "row-trim";
const ANNOTATION_ROW_ID = "row-annotation";
const SPEED_ROW_ID = "row-speed";
const AUDIO_ROW_ID = "row-audio";
const CAMERA_ROW_ID = "row-camera";
const CAPTION_ROW_ID = "row-caption";
const FALLBACK_RANGE_MS = 1000;

type AdditionalLayerType = "annotation" | "camera" | "speed" | "audio" | "caption";

const ADDITIONAL_LAYER_OPTIONS: {
	type: AdditionalLayerType;
	label: string;
	icon: typeof Camera;
}[] = [
	{ type: "annotation", label: "Annotation", icon: MessageSquare },
	{ type: "camera", label: "Camera", icon: Camera },
	{ type: "speed", label: "Speed", icon: Gauge },
	{ type: "audio", label: "Audio", icon: Music },
	{ type: "caption", label: "Caption", icon: MessageSquare },
];
const TARGET_MARKER_COUNT = 12;
const SUGGESTION_SPACING_MS = 1800;

interface TimelineEditorProps {
	videoDuration: number;
	currentTime: number;
	onSeek?: (time: number) => void;
	cursorTelemetry?: CursorTelemetryPoint[];
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions?: TrimRegion[];
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
	aspectRatio: AspectRatio;
	onAspectRatioChange: (aspectRatio: AspectRatio) => void;
	isPlaying?: boolean;
	onTogglePlayPause?: () => void;
	onSkipForward?: () => void;
	onSkipBack?: () => void;
	playbackSpeed?: number;
}

interface TimelineScaleConfig {
	minItemDurationMs: number;
	defaultItemDurationMs: number;
	minVisibleRangeMs: number;
}

interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	label: string;
	zoomDepth?: number;
	speedValue?: number;
	variant: "zoom" | "trim" | "annotation" | "speed" | "audio" | "camera" | "caption" | "clip";
	clipDuration?: string;
	clipSpeed?: string;
}

const SCALE_CANDIDATES = [
	{ intervalSeconds: 0.05, gridSeconds: 0.01 },
	{ intervalSeconds: 0.1, gridSeconds: 0.02 },
	{ intervalSeconds: 0.25, gridSeconds: 0.05 },
	{ intervalSeconds: 0.5, gridSeconds: 0.1 },
	{ intervalSeconds: 1, gridSeconds: 0.25 },
	{ intervalSeconds: 2, gridSeconds: 0.5 },
	{ intervalSeconds: 5, gridSeconds: 1 },
	{ intervalSeconds: 10, gridSeconds: 2 },
	{ intervalSeconds: 15, gridSeconds: 3 },
	{ intervalSeconds: 30, gridSeconds: 5 },
	{ intervalSeconds: 60, gridSeconds: 10 },
	{ intervalSeconds: 120, gridSeconds: 20 },
	{ intervalSeconds: 300, gridSeconds: 30 },
	{ intervalSeconds: 600, gridSeconds: 60 },
	{ intervalSeconds: 900, gridSeconds: 120 },
	{ intervalSeconds: 1800, gridSeconds: 180 },
	{ intervalSeconds: 3600, gridSeconds: 300 },
];

function calculateAxisScale(visibleRangeMs: number): { intervalMs: number; gridMs: number } {
	const visibleSeconds = visibleRangeMs / 1000;
	const candidate =
		SCALE_CANDIDATES.find((scaleCandidate) => {
			if (visibleSeconds <= 0) {
				return true;
			}
			return visibleSeconds / scaleCandidate.intervalSeconds <= TARGET_MARKER_COUNT;
		}) ?? SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1];

	return {
		intervalMs: Math.round(candidate.intervalSeconds * 1000),
		gridMs: Math.round(candidate.gridSeconds * 1000),
	};
}

function calculateTimelineScale(durationSeconds: number): TimelineScaleConfig {
	const totalMs = Math.max(0, Math.round(durationSeconds * 1000));

	const minItemDurationMs = 100;

	const defaultItemDurationMs =
		totalMs > 0
			? Math.max(minItemDurationMs, Math.min(Math.round(totalMs * 0.05), 30000))
			: Math.max(minItemDurationMs, 1000);

	const minVisibleRangeMs = 300;

	return {
		minItemDurationMs,
		defaultItemDurationMs,
		minVisibleRangeMs,
	};
}

function createInitialRange(totalMs: number): Range {
	if (totalMs > 0) {
		return { start: 0, end: totalMs };
	}

	return { start: 0, end: FALLBACK_RANGE_MS };
}

function normalizeWheelDeltaToPixels(delta: number, deltaMode: number) {
	if (deltaMode === 1) {
		return delta * 16;
	}

	if (deltaMode === 2) {
		return delta * 240;
	}

	return delta;
}

function formatTimeLabel(milliseconds: number, intervalMs: number) {
	const totalSeconds = milliseconds / 1000;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const fractionalDigits = intervalMs < 250 ? 2 : intervalMs < 1000 ? 1 : 0;

	if (hours > 0) {
		const minutesString = minutes.toString().padStart(2, "0");
		const secondsString = Math.floor(seconds).toString().padStart(2, "0");
		return `${hours}:${minutesString}:${secondsString}`;
	}

	if (fractionalDigits > 0) {
		const secondsWithFraction = seconds.toFixed(fractionalDigits);
		const [wholeSeconds, fraction] = secondsWithFraction.split(".");
		return `${minutes}:${wholeSeconds.padStart(2, "0")}.${fraction}`;
	}

	return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

function formatPlayheadTime(ms: number): string {
	const s = ms / 1000;
	const min = Math.floor(s / 60);
	const sec = s % 60;
	if (min > 0) return `${min}:${sec.toFixed(1).padStart(4, "0")}`;
	return `${sec.toFixed(1)}s`;
}

function PlaybackCursor({
	currentTimeMs,
	videoDurationMs,
	onSeek,
	timelineRef,
	keyframes = [],
}: {
	currentTimeMs: number;
	videoDurationMs: number;
	onSeek?: (time: number) => void;
	timelineRef: React.RefObject<HTMLDivElement>;
	keyframes?: { id: string; time: number }[];
}) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current || !onSeek) return;

			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;

			// Allow dragging outside to 0 or max, but clamp the value
			const relativeMs = pixelsToValue(clickX);
			let absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			// Snap to nearby keyframe if within threshold (150ms)
			const snapThresholdMs = 150;
			const nearbyKeyframe = keyframes.find(
				(kf) =>
					Math.abs(kf.time - absoluteMs) <= snapThresholdMs &&
					kf.time >= range.start &&
					kf.time <= range.end,
			);

			if (nearbyKeyframe) {
				absoluteMs = nearbyKeyframe.time;
			}

			onSeek(absoluteMs / 1000);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [
		isDragging,
		onSeek,
		timelineRef,
		sidebarWidth,
		range.start,
		range.end,
		videoDurationMs,
		pixelsToValue,
		keyframes,
	]);

	if (videoDurationMs <= 0 || currentTimeMs < 0) {
		return null;
	}

	const clampedTime = Math.min(currentTimeMs, videoDurationMs);

	if (clampedTime < range.start || clampedTime > range.end) {
		return null;
	}

	const offset = valueToPixels(clampedTime - range.start);

	return (
		<div
			className="absolute top-0 bottom-0 z-50 group/cursor"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px`,
				pointerEvents: "none",
			}}
		>
			<div
				className="absolute top-0 bottom-0 w-[1.5px] bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)] cursor-ew-resize pointer-events-auto hover:shadow-[0_0_12px_rgba(16,185,129,0.6)] transition-shadow"
				style={{
					[sideProperty]: `${offset}px`,
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					setIsDragging(true);
				}}
			>
				{/* Blue circle head */}
				<div
					className="absolute -top-1.5 left-1/2 -translate-x-1/2 hover:scale-125 transition-transform"
					style={{ width: "14px", height: "14px" }}
				>
					<div className="w-3 h-3 mx-auto mt-[1px] bg-[#10b981] rounded-full shadow-lg border-2 border-[#34d399]" />
				</div>
				{isDragging && (
					<div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white/90 font-medium tabular-nums whitespace-nowrap border border-white/10 shadow-lg pointer-events-none">
						{formatPlayheadTime(clampedTime)}
					</div>
				)}
			</div>
		</div>
	);
}

function TimelineAxis({
	videoDurationMs,
	currentTimeMs,
}: {
	videoDurationMs: number;
	currentTimeMs: number;
}) {
	const { sidebarWidth, direction, range, valueToPixels } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";

	const { intervalMs } = useMemo(
		() => calculateAxisScale(range.end - range.start),
		[range.end, range.start],
	);

	const markers = useMemo(() => {
		if (intervalMs <= 0) {
			return { markers: [], minorTicks: [] };
		}

		const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
		const visibleStart = Math.max(0, Math.min(range.start, maxTime));
		const visibleEnd = Math.min(range.end, maxTime);
		const markerTimes = new Set<number>();

		const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;

		for (let time = firstMarker; time <= maxTime; time += intervalMs) {
			if (time >= visibleStart && time <= visibleEnd) {
				markerTimes.add(Math.round(time));
			}
		}

		if (visibleStart <= maxTime) {
			markerTimes.add(Math.round(visibleStart));
		}

		if (videoDurationMs > 0) {
			markerTimes.add(Math.round(videoDurationMs));
		}

		const sorted = Array.from(markerTimes)
			.filter((time) => time <= maxTime)
			.sort((a, b) => a - b);

		// Generate minor ticks (4 ticks between major intervals)
		const minorTicks = [];
		const minorInterval = intervalMs / 5;

		for (let time = firstMarker; time <= maxTime; time += minorInterval) {
			if (time >= visibleStart && time <= visibleEnd) {
				// Skip if it's close to a major marker
				const isMajor = Math.abs(time % intervalMs) < 1;
				if (!isMajor) {
					minorTicks.push(time);
				}
			}
		}

		return {
			markers: sorted.map((time) => ({
				time,
				label: formatTimeLabel(time, intervalMs),
			})),
			minorTicks,
		};
	}, [intervalMs, range.end, range.start, videoDurationMs]);

	return (
		<div
			className="h-8 bg-[#0c0c0f] border-b border-white/5 relative overflow-hidden select-none"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
			}}
		>
			{/* Minor Ticks */}
			{markers.minorTicks.map((time) => {
				const offset = valueToPixels(time - range.start);
				return (
					<div
						key={`minor-${time}`}
						className="absolute bottom-0 h-1 w-[1px] bg-white/5"
						style={{ [sideProperty]: `${offset}px` }}
					/>
				);
			})}

			{/* Major Markers */}
			{markers.markers.map((marker) => {
				const offset = valueToPixels(marker.time - range.start);
				const markerStyle: React.CSSProperties = {
					position: "absolute",
					bottom: 0,
					height: "100%",
					display: "flex",
					flexDirection: "row",
					alignItems: "flex-end",
					[sideProperty]: `${offset}px`,
				};

				return (
					<div key={marker.time} style={markerStyle}>
						<div className="flex flex-col items-center pb-1">
							<div className="h-2 w-[1px] bg-white/20 mb-1" />
							<span
								className={cn(
									"text-[10px] font-medium tabular-nums tracking-tight",
									marker.time === currentTimeMs ? "text-[#34d399]" : "text-slate-500",
								)}
							>
								{marker.label}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function Timeline({
	items,
	videoDurationMs,
	currentTimeMs,
	onSeek,
	onSelectZoom,
	onSelectTrim,
	onSelectAnnotation,
	onSelectCameraLayout,
	onSelectSpeed,
	onSelectAudio,
	selectedZoomId,
	selectedTrimId,
	selectedAnnotationId,
	selectedCameraLayoutId,
	selectedSpeedId,
	selectedAudioId,
	keyframes = [],
	onAddZoom,
	onAddTrim,
	onAddAnnotation,
	onAddCameraLayout,
	onAddSpeed,
	onAddAudio,
	onAddCaption,
	onDeleteZoom,
	onDeleteTrim,
	onDeleteAnnotation,
	onDeleteCameraLayout,
	onDeleteSpeed,
	onDeleteAudio,
	onDeleteCaption,
	selectedCaptionId,
	onSelectCaption,
	visibleLayers,
	selectedClip,
	onSelectClip,
}: {
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
	selectedTrimId?: string | null;
	selectedAnnotationId?: string | null;
	selectedCameraLayoutId?: string | null;
	selectedSpeedId?: string | null;
	selectedAudioId?: string | null;
	selectedCaptionId?: string | null;
	keyframes?: { id: string; time: number }[];
	onAddZoom?: (clickTimeMs?: number) => void;
	onAddTrim?: (clickTimeMs?: number) => void;
	onAddAnnotation?: (clickTimeMs?: number) => void;
	onAddCameraLayout?: (clickTimeMs?: number) => void;
	onAddSpeed?: (clickTimeMs?: number) => void;
	onAddAudio?: (clickTimeMs?: number) => void;
	onAddCaption?: (clickTimeMs?: number) => void;
	onDeleteZoom?: (id: string) => void;
	onDeleteTrim?: (id: string) => void;
	onDeleteAnnotation?: (id: string) => void;
	onDeleteCameraLayout?: (id: string) => void;
	onDeleteSpeed?: (id: string) => void;
	onDeleteAudio?: (id: string) => void;
	onDeleteCaption?: (id: string) => void;
	visibleLayers: Set<AdditionalLayerType>;
	selectedClip: boolean;
	onSelectClip?: (selected: boolean) => void;
}) {
	const { setTimelineRef, style, sidebarWidth, direction, range, pixelsToValue } =
		useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const localTimelineRef = useRef<HTMLDivElement | null>(null);
	const [ghostX, setGhostX] = useState<number | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			setTimelineRef(node);
			localTimelineRef.current = node;
		},
		[setTimelineRef],
	);

	const handleTimelineMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!localTimelineRef.current) return;
			const rect = localTimelineRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left - sidebarWidth;
			if (x >= 0) {
				setGhostX(x);
			} else {
				setGhostX(null);
			}
		},
		[sidebarWidth],
	);

	const handleTimelineMouseLeave = useCallback(() => {
		setGhostX(null);
	}, []);

	const handleTimelineClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!onSeek || videoDurationMs <= 0) return;

			onSelectZoom?.(null);
			onSelectTrim?.(null);
			onSelectAnnotation?.(null);
			onSelectCameraLayout?.(null);
			onSelectCaption?.(null);
			onSelectSpeed?.(null);
			onSelectAudio?.(null);
			onSelectClip?.(false);

			const rect = e.currentTarget.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;

			if (clickX < 0) return;

			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
			const timeInSeconds = absoluteMs / 1000;

			onSeek(timeInSeconds);
		},
		[
			onSeek,
			onSelectZoom,
			onSelectTrim,
			onSelectAnnotation,
			onSelectCameraLayout,
			onSelectCaption,
			onSelectSpeed,
			onSelectAudio,
			onSelectClip,
			videoDurationMs,
			sidebarWidth,
			range.start,
			pixelsToValue,
		],
	);

	const clipItems = items.filter((item) => item.rowId === CLIP_ROW_ID);
	const zoomItems = items.filter((item) => item.rowId === ZOOM_ROW_ID);
	const trimItems = items.filter((item) => item.rowId === TRIM_ROW_ID);
	const annotationItems = items.filter((item) => item.rowId === ANNOTATION_ROW_ID);
	const cameraItems = items.filter((item) => item.rowId === CAMERA_ROW_ID);
	const speedItems = items.filter((item) => item.rowId === SPEED_ROW_ID);
	const audioItems = items.filter((item) => item.rowId === AUDIO_ROW_ID);
	const captionItems = items.filter((item) => item.rowId === CAPTION_ROW_ID);

	return (
		<div
			ref={setRefs}
			style={{ ...style, height: "auto" }}
			className="select-none bg-[#0c0c0f] min-h-[120px] relative cursor-pointer group"
			onClick={handleTimelineClick}
			onMouseMove={handleTimelineMouseMove}
			onMouseLeave={handleTimelineMouseLeave}
		>
			<TimelineAxis videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
			<PlaybackCursor
				currentTimeMs={currentTimeMs}
				videoDurationMs={videoDurationMs}
				onSeek={onSeek}
				timelineRef={localTimelineRef}
				keyframes={keyframes}
			/>
			{/* Ghost playhead - follows cursor */}
			{ghostX !== null && (
				<div
					className="absolute top-0 bottom-0 z-40 pointer-events-none"
					style={{
						[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
					}}
				>
					<div
						className="absolute top-0 bottom-0 w-[1px] bg-white/15"
						style={{
							[sideProperty]: `${ghostX}px`,
						}}
					/>
				</div>
			)}

			{/* Clip Layer - always visible */}
			<Row id={CLIP_ROW_ID} isEmpty={clipItems.length === 0} hint="" variant="clip">
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectedClip}
						onSelect={() => onSelectClip?.(true)}
						variant="clip"
						clipDuration={item.clipDuration}
						clipSpeed={item.clipSpeed}
					>
						{item.label}
					</Item>
				))}
			</Row>

			{/* Zoom Layer - always visible */}
			<Row
				id={ZOOM_ROW_ID}
				isEmpty={zoomItems.length === 0}
				hint="Click or drag to add zoom on cursor"
				onAddEffect={onAddZoom}
				addLabel="Zoom"
				variant="zoom"
			>
				{zoomItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={item.id === selectedZoomId}
						onSelect={() => onSelectZoom?.(item.id)}
						onDelete={() => onDeleteZoom?.(item.id)}
						zoomDepth={item.zoomDepth}
						variant="zoom"
					>
						{item.label}
					</Item>
				))}
			</Row>

			{/* Trim Layer - shown if has items (backward compat) */}
			{trimItems.length > 0 && (
				<Row
					id={TRIM_ROW_ID}
					isEmpty={trimItems.length === 0}
					hint="Hover to add trim"
					onAddEffect={onAddTrim}
					addLabel="Trim"
				>
					{trimItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedTrimId}
							onSelect={() => onSelectTrim?.(item.id)}
							onDelete={() => onDeleteTrim?.(item.id)}
							variant="trim"
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{/* Additional layers - only shown when added */}
			{visibleLayers.has("annotation") && (
				<Row
					id={ANNOTATION_ROW_ID}
					isEmpty={annotationItems.length === 0}
					hint="Hover to add annotation"
					onAddEffect={onAddAnnotation}
					addLabel="Annotation"
				>
					{annotationItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedAnnotationId}
							onSelect={() => onSelectAnnotation?.(item.id)}
							onDelete={() => onDeleteAnnotation?.(item.id)}
							variant="annotation"
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{visibleLayers.has("camera") && (
				<Row
					id={CAMERA_ROW_ID}
					isEmpty={cameraItems.length === 0}
					hint="Hover to add camera layout"
					onAddEffect={onAddCameraLayout}
					addLabel="Camera"
				>
					{cameraItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedCameraLayoutId}
							onSelect={() => onSelectCameraLayout?.(item.id)}
							onDelete={() => onDeleteCameraLayout?.(item.id)}
							variant="camera"
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{visibleLayers.has("speed") && (
				<Row
					id={SPEED_ROW_ID}
					isEmpty={speedItems.length === 0}
					hint="Hover to add speed"
					onAddEffect={onAddSpeed}
					addLabel="Speed"
				>
					{speedItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedSpeedId}
							onSelect={() => onSelectSpeed?.(item.id)}
							onDelete={() => onDeleteSpeed?.(item.id)}
							variant="speed"
							speedValue={item.speedValue}
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{visibleLayers.has("audio") && (
				<Row
					id={AUDIO_ROW_ID}
					isEmpty={audioItems.length === 0}
					hint="Hover to add audio"
					onAddEffect={onAddAudio}
					addLabel="Audio"
				>
					{audioItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedAudioId}
							onSelect={() => onSelectAudio?.(item.id)}
							onDelete={() => onDeleteAudio?.(item.id)}
							variant="audio"
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{visibleLayers.has("caption") && (
				<Row
					id={CAPTION_ROW_ID}
					isEmpty={captionItems.length === 0}
					hint="Hover to add caption"
					onAddEffect={onAddCaption}
					addLabel="Caption"
				>
					{captionItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={item.id === selectedCaptionId}
							onSelect={() => onSelectCaption?.(item.id)}
							onDelete={() => onDeleteCaption?.(item.id)}
							variant="caption"
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}
		</div>
	);
}

export default function TimelineEditor({
	videoDuration,
	currentTime,
	onSeek,
	cursorTelemetry = [],
	zoomRegions,
	onZoomAdded,
	onZoomSuggested,
	onZoomSpanChange,
	onZoomDelete,
	selectedZoomId,
	onSelectZoom,
	trimRegions = [],
	onTrimAdded,
	onTrimSpanChange,
	onTrimDelete,
	selectedTrimId,
	onSelectTrim,
	annotationRegions = [],
	onAnnotationAdded,
	onAnnotationSpanChange,
	onAnnotationDelete,
	selectedAnnotationId,
	onSelectAnnotation,
	cameraLayouts = [],
	onCameraLayoutAdded,
	onCameraLayoutSpanChange,
	onCameraLayoutDelete,
	selectedCameraLayoutId,
	onSelectCameraLayout,
	captionRegions = [],
	onCaptionAdded,
	onCaptionSpanChange,
	onCaptionDelete,
	selectedCaptionId,
	onSelectCaption,
	speedRegions = [],
	onSpeedAdded,
	onSpeedSpanChange,
	onSpeedDelete,
	selectedSpeedId,
	onSelectSpeed,
	audioRegions = [],
	onAudioAdded,
	onAudioSpanChange,
	onAudioDelete,
	selectedAudioId,
	onSelectAudio,
	aspectRatio,
	onAspectRatioChange,
	isPlaying = false,
	onTogglePlayPause,
	onSkipForward,
	onSkipBack,
	playbackSpeed = 1,
}: TimelineEditorProps) {
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const totalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
	const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);
	const timelineScale = useMemo(() => calculateTimelineScale(videoDuration), [videoDuration]);
	const safeMinDurationMs = useMemo(
		() =>
			totalMs > 0
				? Math.min(timelineScale.minItemDurationMs, totalMs)
				: timelineScale.minItemDurationMs,
		[timelineScale.minItemDurationMs, totalMs],
	);

	const [range, setRange] = useState<Range>(() => createInitialRange(totalMs));
	const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
	const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
	const [customAspectWidth, setCustomAspectWidth] = useState(
		initialEditorPreferences.customAspectWidth,
	);
	const [customAspectHeight, setCustomAspectHeight] = useState(
		initialEditorPreferences.customAspectHeight,
	);
	const [visibleLayers, setVisibleLayers] = useState<Set<AdditionalLayerType>>(new Set());
	const [selectedClip, setSelectedClip] = useState(false);
	const [timelineZoomLevel, setTimelineZoomLevel] = useState(1);
	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const { shortcuts: keyShortcuts, isMac } = useShortcuts();

	// Auto-show layers when they have items
	useEffect(() => {
		setVisibleLayers((prev) => {
			const next = new Set(prev);
			if (annotationRegions.length > 0) next.add("annotation");
			if (cameraLayouts.length > 0) next.add("camera");
			if (speedRegions.length > 0) next.add("speed");
			if (audioRegions.length > 0) next.add("audio");
			if (captionRegions.length > 0) next.add("caption");
			return next;
		});
	}, [
		annotationRegions.length,
		cameraLayouts.length,
		speedRegions.length,
		audioRegions.length,
		captionRegions.length,
	]);

	const toggleLayer = useCallback((layer: AdditionalLayerType) => {
		setVisibleLayers((prev) => {
			const next = new Set(prev);
			if (next.has(layer)) {
				next.delete(layer);
			} else {
				next.add(layer);
			}
			return next;
		});
	}, []);

	const visibleLayerCount = 2 + visibleLayers.size + (trimRegions.length > 0 ? 1 : 0);

	const handleTimelineZoomIn = useCallback(() => {
		setRange((prev) => {
			const center = (prev.start + prev.end) / 2;
			const halfSpan = (prev.end - prev.start) / 4;
			return {
				start: Math.max(0, center - halfSpan),
				end: Math.min(totalMs, center + halfSpan),
			};
		});
		setTimelineZoomLevel((prev) => Math.min(prev * 2, 32));
	}, [totalMs]);

	const handleTimelineZoomOut = useCallback(() => {
		setRange((prev) => {
			const center = (prev.start + prev.end) / 2;
			const halfSpan = prev.end - prev.start;
			return {
				start: Math.max(0, center - halfSpan),
				end: Math.min(totalMs, center + halfSpan),
			};
		});
		setTimelineZoomLevel((prev) => Math.max(prev / 2, 0.25));
	}, [totalMs]);

	useEffect(() => {
		if (aspectRatio === "native") {
			return;
		}
		const [width, height] = aspectRatio.split(":");
		if (width && height) {
			setCustomAspectWidth(width);
			setCustomAspectHeight(height);
		}
	}, [aspectRatio]);

	useEffect(() => {
		saveEditorPreferences({
			customAspectWidth,
			customAspectHeight,
		});
	}, [customAspectHeight, customAspectWidth]);

	const applyCustomAspectRatio = useCallback(() => {
		const width = Number.parseInt(customAspectWidth, 10);
		const height = Number.parseInt(customAspectHeight, 10);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			toast.error("Custom aspect ratio must be positive numbers.");
			return;
		}
		onAspectRatioChange(`${width}:${height}` as AspectRatio);
	}, [customAspectHeight, customAspectWidth, onAspectRatioChange]);

	const handleCustomAspectRatioKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			// Prevent Radix DropdownMenu typeahead from selecting preset items while typing.
			event.stopPropagation();
			if (event.key === "Enter") {
				event.preventDefault();
				applyCustomAspectRatio();
			}
		},
		[applyCustomAspectRatio],
	);

	// Add keyframe at current playhead position
	const addKeyframe = useCallback(() => {
		if (totalMs === 0) return;
		const time = Math.max(0, Math.min(currentTimeMs, totalMs));
		if (keyframes.some((kf) => Math.abs(kf.time - time) < 1)) return;
		setKeyframes((prev) => [...prev, { id: uuidv4(), time }]);
	}, [currentTimeMs, totalMs, keyframes]);

	// Delete selected keyframe
	const deleteSelectedKeyframe = useCallback(() => {
		if (!selectedKeyframeId) return;
		setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedKeyframeId));
		setSelectedKeyframeId(null);
	}, [selectedKeyframeId]);

	// Move keyframe to new time position
	const handleKeyframeMove = useCallback(
		(id: string, newTime: number) => {
			setKeyframes((prev) =>
				prev.map((kf) =>
					kf.id === id ? { ...kf, time: Math.max(0, Math.min(newTime, totalMs)) } : kf,
				),
			);
		},
		[totalMs],
	);

	// Delete selected zoom item
	const deleteSelectedZoom = useCallback(() => {
		if (!selectedZoomId) return;
		onZoomDelete(selectedZoomId);
		onSelectZoom(null);
	}, [selectedZoomId, onZoomDelete, onSelectZoom]);

	// Delete selected trim item
	const deleteSelectedTrim = useCallback(() => {
		if (!selectedTrimId || !onTrimDelete || !onSelectTrim) return;
		onTrimDelete(selectedTrimId);
		onSelectTrim(null);
	}, [selectedTrimId, onTrimDelete, onSelectTrim]);

	const deleteSelectedAnnotation = useCallback(() => {
		if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
		onAnnotationDelete(selectedAnnotationId);
		onSelectAnnotation(null);
	}, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);

	const deleteSelectedCameraLayout = useCallback(() => {
		if (!selectedCameraLayoutId || !onCameraLayoutDelete || !onSelectCameraLayout) return;
		onCameraLayoutDelete(selectedCameraLayoutId);
		onSelectCameraLayout(null);
	}, [selectedCameraLayoutId, onCameraLayoutDelete, onSelectCameraLayout]);

	const deleteSelectedSpeed = useCallback(() => {
		if (!selectedSpeedId || !onSpeedDelete || !onSelectSpeed) return;
		onSpeedDelete(selectedSpeedId);
		onSelectSpeed(null);
	}, [selectedSpeedId, onSpeedDelete, onSelectSpeed]);

	const deleteSelectedAudio = useCallback(() => {
		if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
		onAudioDelete(selectedAudioId);
		onSelectAudio(null);
	}, [selectedAudioId, onAudioDelete, onSelectAudio]);

	const deleteSelectedCaption = useCallback(() => {
		if (!selectedCaptionId || !onCaptionDelete || !onSelectCaption) return;
		onCaptionDelete(selectedCaptionId);
		onSelectCaption(null);
	}, [selectedCaptionId, onCaptionDelete, onSelectCaption]);

	useEffect(() => {
		setRange(createInitialRange(totalMs));
	}, [totalMs]);

	// Normalize regions only when timeline bounds change (not on every region edit).
	// Using refs to read current regions avoids a dependency-loop that re-fires
	// this effect on every drag/resize and races with dnd-timeline's internal state.
	const zoomRegionsRef = useRef(zoomRegions);
	const trimRegionsRef = useRef(trimRegions);
	const speedRegionsRef = useRef(speedRegions);
	const audioRegionsRef = useRef(audioRegions);
	const cameraLayoutsRef = useRef(cameraLayouts);
	const captionRegionsRef = useRef(captionRegions);
	zoomRegionsRef.current = zoomRegions;
	trimRegionsRef.current = trimRegions;
	speedRegionsRef.current = speedRegions;
	audioRegionsRef.current = audioRegions;
	cameraLayoutsRef.current = cameraLayouts;
	captionRegionsRef.current = captionRegions;

	useEffect(() => {
		if (totalMs === 0 || safeMinDurationMs <= 0) {
			return;
		}

		zoomRegionsRef.current.forEach((region) => {
			const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
				onZoomSpanChange(region.id, { start: normalizedStart, end: normalizedEnd });
			}
		});

		trimRegionsRef.current.forEach((region) => {
			const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
				onTrimSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
			}
		});

		speedRegionsRef.current.forEach((region) => {
			const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
				onSpeedSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
			}
		});

		audioRegionsRef.current.forEach((region) => {
			const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
				onAudioSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
			}
		});

		cameraLayoutsRef.current.forEach((layout) => {
			const clampedStart = Math.max(0, Math.min(layout.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, layout.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== layout.startMs || normalizedEnd !== layout.endMs) {
				onCameraLayoutSpanChange?.(layout.id, {
					start: normalizedStart,
					end: normalizedEnd,
				});
			}
		});
		captionRegionsRef.current.forEach((region) => {
			const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
			const minEnd = clampedStart + safeMinDurationMs;
			const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
			const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
			const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

			if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
				onCaptionSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
			}
		});
		// Only re-run when the timeline scale changes, not on every region edit
	}, [
		totalMs,
		safeMinDurationMs,
		onZoomSpanChange,
		onTrimSpanChange,
		onCameraLayoutSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onCaptionSpanChange,
	]);

	const hasOverlap = useCallback(
		(newSpan: Span, excludeId?: string): boolean => {
			// Determine which row the item belongs to
			const isZoomItem = zoomRegions.some((r) => r.id === excludeId);
			const isTrimItem = trimRegions.some((r) => r.id === excludeId);
			const isAnnotationItem = annotationRegions.some((r) => r.id === excludeId);
			const isCameraItem = cameraLayouts.some((r) => r.id === excludeId);
			const isSpeedItem = speedRegions.some((r) => r.id === excludeId);
			const isAudioItem = audioRegions.some((r) => r.id === excludeId);
			const isCaptionItem = captionRegions.some((r) => r.id === excludeId);

			if (isAnnotationItem || isCaptionItem) {
				return false;
			}

			// Helper to check overlap against a specific set of regions
			const checkOverlap = (regions: (ZoomRegion | TrimRegion | SpeedRegion | AudioRegion)[]) => {
				return regions.some((region) => {
					if (region.id === excludeId) return false;
					// True overlap: regions actually intersect (not just adjacent)
					return newSpan.end > region.startMs && newSpan.start < region.endMs;
				});
			};

			if (isZoomItem) {
				return checkOverlap(zoomRegions);
			}

			if (isTrimItem) {
				return checkOverlap(trimRegions);
			}

			if (isSpeedItem) {
				return checkOverlap(speedRegions);
			}

			if (isCameraItem) {
				return checkOverlap(cameraLayouts);
			}

			if (isAudioItem) {
				return checkOverlap(audioRegions);
			}

			return false;
		},
		[
			zoomRegions,
			trimRegions,
			annotationRegions,
			cameraLayouts,
			speedRegions,
			audioRegions,
			captionRegions,
		],
	);

	// Keep newly added timeline regions at the original short default instead of
	// scaling them with the full recording length.
	const defaultRegionDurationMs = useMemo(() => Math.min(1000, totalMs), [totalMs]);

	const handleAddZoom = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Place zoom at click position if provided, otherwise at playhead
			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			// Find the next zoom region after the position
			const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if position is inside any zoom region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place zoom here", {
					description: "Zoom already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onZoomAdded({ start: startPos, end: startPos + actualDuration });
		},
		[videoDuration, totalMs, currentTimeMs, zoomRegions, onZoomAdded, defaultRegionDurationMs],
	);

	const handleSuggestZooms = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0) {
			return;
		}

		if (!onZoomSuggested) {
			toast.error("Zoom suggestion handler unavailable");
			return;
		}

		if (cursorTelemetry.length < 2) {
			toast.info("No cursor telemetry available", {
				description: "Record a screencast first to generate cursor-based suggestions.",
			});
			return;
		}

		const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
		if (defaultDuration <= 0) {
			return;
		}

		const reservedSpans = [...zoomRegions]
			.map((region) => ({ start: region.startMs, end: region.endMs }))
			.sort((a, b) => a.start - b.start);

		const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);

		if (normalizedSamples.length < 2) {
			toast.info("No usable cursor telemetry", {
				description: "The recording does not include enough cursor movement data.",
			});
			return;
		}

		const dwellCandidates = detectInteractionCandidates(normalizedSamples);

		if (dwellCandidates.length === 0) {
			toast.info("No clear interaction moments found", {
				description: "Try a recording with pauses or clicks around important actions.",
			});
			return;
		}

		const sortedCandidates = [...dwellCandidates].sort((a, b) => b.strength - a.strength);
		const acceptedCenters: number[] = [];

		let addedCount = 0;

		for (const candidate of sortedCandidates) {
			const tooCloseToAccepted = acceptedCenters.some(
				(center) => Math.abs(center - candidate.centerTimeMs) < SUGGESTION_SPACING_MS,
			);

			if (tooCloseToAccepted) {
				continue;
			}

			const centeredStart = Math.round(candidate.centerTimeMs - defaultDuration / 2);
			const candidateStart = Math.max(0, Math.min(centeredStart, totalMs - defaultDuration));
			const candidateEnd = candidateStart + defaultDuration;
			const hasOverlap = reservedSpans.some(
				(span) => candidateEnd > span.start && candidateStart < span.end,
			);

			if (hasOverlap) {
				continue;
			}

			reservedSpans.push({ start: candidateStart, end: candidateEnd });
			acceptedCenters.push(candidate.centerTimeMs);
			onZoomSuggested({ start: candidateStart, end: candidateEnd }, candidate.focus);
			addedCount += 1;
		}

		if (addedCount === 0) {
			toast.info("No auto-zoom slots available", {
				description: "Detected dwell points overlap existing zoom regions.",
			});
			return;
		}

		toast.success(
			`Added ${addedCount} interaction-based zoom suggestion${addedCount === 1 ? "" : "s"}`,
		);
	}, [
		videoDuration,
		totalMs,
		defaultRegionDurationMs,
		zoomRegions,
		onZoomSuggested,
		cursorTelemetry,
	]);

	const handleAddTrim = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onTrimAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Place trim at click position if provided, otherwise at playhead
			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			// Find the next trim region after the position
			const sorted = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if position is inside any trim region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place trim here", {
					description: "Trim already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onTrimAdded({ start: startPos, end: startPos + actualDuration });
		},
		[videoDuration, totalMs, currentTimeMs, trimRegions, onTrimAdded, defaultRegionDurationMs],
	);

	const handleAddSpeed = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onSpeedAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Place speed region at click position if provided, otherwise at playhead
			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			// Find the next speed region after the position
			const sorted = [...speedRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if position is inside any speed region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place speed here", {
					description:
						"Speed region already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onSpeedAdded({ start: startPos, end: startPos + actualDuration });
		},
		[videoDuration, totalMs, currentTimeMs, speedRegions, onSpeedAdded, defaultRegionDurationMs],
	);

	const handleAddAudio = useCallback(
		async (clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAudioAdded) {
				return;
			}

			const result = await window.electronAPI.openAudioFilePicker();
			if (!result?.success || !result.path) {
				return;
			}

			const audioDurationMs = await loadAudioSelectionDurationMs({
				sourceType: "file",
				audioPath: result.path,
			});

			if (audioDurationMs <= 0) {
				toast.error("Could not read audio file", {
					description: "The selected file may be corrupted or in an unsupported format.",
				});
				return;
			}

			await onAudioAdded(
				{
					sourceType: "file",
					audioPath: result.path,
					durationMs: audioDurationMs,
				},
				clickTimeMs,
			);
		},
		[videoDuration, totalMs, onAudioAdded],
	);

	const handleAddAnnotation = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Multiple annotations can exist at the same timestamp
			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			const endPos = Math.min(startPos + defaultDuration, totalMs);

			onAnnotationAdded({ start: startPos, end: endPos });
		},
		[videoDuration, totalMs, currentTimeMs, onAnnotationAdded, defaultRegionDurationMs],
	);

	const handleAddCameraLayout = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onCameraLayoutAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			const sorted = [...cameraLayouts].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);

			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place camera layout here", {
					description:
						"Camera layout already exists at this location or not enough space is available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onCameraLayoutAdded({ start: startPos, end: startPos + actualDuration });
		},
		[
			videoDuration,
			totalMs,
			onCameraLayoutAdded,
			defaultRegionDurationMs,
			currentTimeMs,
			cameraLayouts,
		],
	);

	const handleAddCaption = useCallback(
		(clickTimeMs?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onCaptionAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Multiple captions can exist at the same timestamp (like annotations)
			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			const endPos = Math.min(startPos + defaultDuration, totalMs);

			onCaptionAdded({ start: startPos, end: endPos });
		},
		[videoDuration, totalMs, currentTimeMs, onCaptionAdded, defaultRegionDurationMs],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (matchesShortcut(e, keyShortcuts.addKeyframe, isMac)) {
				addKeyframe();
			}
			if (matchesShortcut(e, keyShortcuts.addZoom, isMac)) {
				handleAddZoom();
			}
			if (matchesShortcut(e, keyShortcuts.addTrim, isMac)) {
				handleAddTrim();
			}
			if (matchesShortcut(e, keyShortcuts.addAnnotation, isMac)) {
				handleAddAnnotation();
			}
			if (matchesShortcut(e, keyShortcuts.addSpeed, isMac)) {
				handleAddSpeed();
			}

			// Tab: Cycle through overlapping annotations at current time
			if (e.key === "Tab" && annotationRegions.length > 0) {
				const currentTimeMs = Math.round(currentTime * 1000);
				const overlapping = annotationRegions
					.filter((a) => currentTimeMs >= a.startMs && currentTimeMs <= a.endMs)
					.sort((a, b) => a.zIndex - b.zIndex); // Sort by z-index

				if (overlapping.length > 0) {
					e.preventDefault();

					if (!selectedAnnotationId || !overlapping.some((a) => a.id === selectedAnnotationId)) {
						onSelectAnnotation?.(overlapping[0].id);
					} else {
						// Cycle to next annotation
						const currentIndex = overlapping.findIndex((a) => a.id === selectedAnnotationId);
						const nextIndex = e.shiftKey
							? (currentIndex - 1 + overlapping.length) % overlapping.length // Shift+Tab = backward
							: (currentIndex + 1) % overlapping.length; // Tab = forward
						onSelectAnnotation?.(overlapping[nextIndex].id);
					}
				}
			}
			// Delete key or Ctrl+D / Cmd+D
			if (
				e.key === "Delete" ||
				e.key === "Backspace" ||
				matchesShortcut(e, keyShortcuts.deleteSelected, isMac)
			) {
				if (selectedKeyframeId) {
					deleteSelectedKeyframe();
				} else if (selectedZoomId) {
					deleteSelectedZoom();
				} else if (selectedTrimId) {
					deleteSelectedTrim();
				} else if (selectedAnnotationId) {
					deleteSelectedAnnotation();
				} else if (selectedCameraLayoutId) {
					deleteSelectedCameraLayout();
				} else if (selectedSpeedId) {
					deleteSelectedSpeed();
				} else if (selectedAudioId) {
					deleteSelectedAudio();
				} else if (selectedCaptionId) {
					deleteSelectedCaption();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		addKeyframe,
		handleAddZoom,
		handleAddTrim,
		handleAddAnnotation,
		handleAddSpeed,
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		deleteSelectedTrim,
		deleteSelectedAnnotation,
		deleteSelectedCameraLayout,
		deleteSelectedSpeed,
		deleteSelectedAudio,
		deleteSelectedCaption,
		selectedKeyframeId,
		selectedZoomId,
		selectedTrimId,
		selectedAnnotationId,
		selectedCameraLayoutId,
		selectedCaptionId,
		selectedSpeedId,
		selectedAudioId,
		annotationRegions,
		currentTime,
		onSelectAnnotation,
		keyShortcuts,
		isMac,
	]);

	const clampedRange = useMemo<Range>(() => {
		if (totalMs === 0) {
			return range;
		}

		return {
			start: Math.max(0, Math.min(range.start, totalMs)),
			end: Math.min(range.end, totalMs),
		};
	}, [range, totalMs]);

	const clipDurationLabel = useMemo(() => {
		const s = totalMs / 1000;
		if (s < 60) return `${Math.round(s * 10) / 10}s`;
		const min = Math.floor(s / 60);
		const sec = Math.round(s % 60);
		return `${min}m ${sec}s`;
	}, [totalMs]);

	const timelineItems = useMemo<TimelineRenderItem[]>(() => {
		// Clip item - represents the entire video
		const clip: TimelineRenderItem[] =
			totalMs > 0
				? [
						{
							id: "clip-main",
							rowId: CLIP_ROW_ID,
							span: { start: 0, end: totalMs },
							label: "Clip",
							variant: "clip",
							clipDuration: clipDurationLabel,
							clipSpeed: `${playbackSpeed}x`,
						},
					]
				: [];

		const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
			id: region.id,
			rowId: ZOOM_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			label: `Zoom ${index + 1}`,
			zoomDepth: region.depth,
			variant: "zoom",
		}));

		const trims: TimelineRenderItem[] = trimRegions.map((region, index) => ({
			id: region.id,
			rowId: TRIM_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			label: `Trim ${index + 1}`,
			variant: "trim",
		}));

		const annotations: TimelineRenderItem[] = annotationRegions.map((region) => {
			let label: string;

			if (region.type === "text") {
				// Show text preview
				const preview = region.content.trim() || "Empty text";
				label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
			} else if (region.type === "image") {
				label = "Image";
			} else if (region.type === "blur") {
				label = "Blur";
			} else {
				label = "Annotation";
			}

			return {
				id: region.id,
				rowId: ANNOTATION_ROW_ID,
				span: { start: region.startMs, end: region.endMs },
				label,
				variant: "annotation",
			};
		});

		const cameras: TimelineRenderItem[] = cameraLayouts.map((layout, index) => ({
			id: layout.id,
			rowId: CAMERA_ROW_ID,
			span: { start: layout.startMs, end: layout.endMs },
			label:
				layout.mode === "fullscreen"
					? "Fullscreen"
					: layout.mode === "hidden"
						? "Hidden"
						: `Default ${index + 1}`,
			variant: "camera",
		}));

		const speeds: TimelineRenderItem[] = speedRegions.map((region, index) => ({
			id: region.id,
			rowId: SPEED_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			label: `Speed ${index + 1}`,
			speedValue: region.speed,
			variant: "speed",
		}));

		const audios: TimelineRenderItem[] = audioRegions.map((region) => {
			return {
				id: region.id,
				rowId: AUDIO_ROW_ID,
				span: { start: region.startMs, end: region.endMs },
				label: getAudioRegionDisplayName(region),
				variant: "audio",
			};
		});

		const captions: TimelineRenderItem[] = captionRegions.map((region) => {
			const preview = region.text.trim() || "Caption";
			const label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
			return {
				id: region.id,
				rowId: CAPTION_ROW_ID,
				span: { start: region.startMs, end: region.endMs },
				label,
				variant: "caption",
			};
		});

		return [
			...clip,
			...zooms,
			...trims,
			...annotations,
			...cameras,
			...speeds,
			...audios,
			...captions,
		];
	}, [
		totalMs,
		clipDurationLabel,
		playbackSpeed,
		zoomRegions,
		trimRegions,
		annotationRegions,
		cameraLayouts,
		speedRegions,
		audioRegions,
		captionRegions,
	]);

	// Flat list of all non-annotation region spans for neighbour-clamping during drag/resize
	const allRegionSpans = useMemo(() => {
		const zooms = zoomRegions.map((r) => ({ id: r.id, start: r.startMs, end: r.endMs }));
		const trims = trimRegions.map((r) => ({ id: r.id, start: r.startMs, end: r.endMs }));
		const speeds = speedRegions.map((r) => ({ id: r.id, start: r.startMs, end: r.endMs }));
		const cameras = cameraLayouts.map((r) => ({ id: r.id, start: r.startMs, end: r.endMs }));
		const audios = audioRegions.map((r) => ({ id: r.id, start: r.startMs, end: r.endMs }));
		return [...zooms, ...trims, ...cameras, ...speeds, ...audios];
	}, [zoomRegions, trimRegions, cameraLayouts, speedRegions, audioRegions]);

	const handleItemSpanChange = useCallback(
		(id: string, span: Span) => {
			// Check if it's a zoom, trim, speed, or annotation item
			if (zoomRegions.some((r) => r.id === id)) {
				onZoomSpanChange(id, span);
			} else if (trimRegions.some((r) => r.id === id)) {
				onTrimSpanChange?.(id, span);
			} else if (cameraLayouts.some((r) => r.id === id)) {
				onCameraLayoutSpanChange?.(id, span);
			} else if (speedRegions.some((r) => r.id === id)) {
				onSpeedSpanChange?.(id, span);
			} else if (annotationRegions.some((r) => r.id === id)) {
				onAnnotationSpanChange?.(id, span);
			} else if (audioRegions.some((r) => r.id === id)) {
				onAudioSpanChange?.(id, span);
			} else if (captionRegions.some((r) => r.id === id)) {
				onCaptionSpanChange?.(id, span);
			}
		},
		[
			zoomRegions,
			trimRegions,
			cameraLayouts,
			speedRegions,
			annotationRegions,
			audioRegions,
			captionRegions,
			onZoomSpanChange,
			onTrimSpanChange,
			onCameraLayoutSpanChange,
			onSpeedSpanChange,
			onAnnotationSpanChange,
			onAudioSpanChange,
			onCaptionSpanChange,
		],
	);

	const panTimelineRange = useCallback(
		(deltaMs: number) => {
			if (!Number.isFinite(deltaMs) || deltaMs === 0 || totalMs <= 0) {
				return;
			}

			setRange((previous) => {
				const visibleSpan = Math.max(1, previous.end - previous.start);
				const maxStart = Math.max(0, totalMs - visibleSpan);
				const nextStart = Math.max(0, Math.min(previous.start + deltaMs, maxStart));

				return {
					start: nextStart,
					end: nextStart + visibleSpan,
				};
			});
		},
		[totalMs],
	);

	const handleTimelineWheel = useCallback(
		(event: WheelEvent<HTMLDivElement>) => {
			if (event.ctrlKey || event.metaKey || totalMs <= 0) {
				return;
			}

			// Accept horizontal scroll, shift+vertical scroll, OR plain vertical scroll as horizontal pan
			const rawHorizontalDelta =
				Math.abs(event.deltaX) > 0 ? event.deltaX : Math.abs(event.deltaY) > 0 ? event.deltaY : 0;

			if (rawHorizontalDelta === 0) {
				return;
			}

			const containerWidth = timelineContainerRef.current?.clientWidth ?? 0;
			const visibleRangeMs = clampedRange.end - clampedRange.start;

			if (containerWidth <= 0 || visibleRangeMs <= 0) {
				return;
			}

			event.preventDefault();

			const horizontalDeltaPx = normalizeWheelDeltaToPixels(rawHorizontalDelta, event.deltaMode);
			const deltaMs = (horizontalDeltaPx / containerWidth) * visibleRangeMs;

			panTimelineRange(deltaMs);
		},
		[clampedRange.end, clampedRange.start, panTimelineRange, totalMs],
	);

	if (!videoDuration || videoDuration === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-[#0A0F0D] gap-3">
				<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
					<Plus className="w-6 h-6 text-slate-600" />
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-slate-300">No Video Loaded</p>
					<p className="text-xs text-slate-500 mt-1">Drag and drop a video to start editing</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 flex flex-col bg-[#0c0c0f] overflow-auto">
			{/* Transport Controls Bar */}
			<div className="relative flex items-center px-3 py-1.5 border-b border-white/5 bg-[#111114]">
				{/* Left: Layer visibility */}
				<div className="flex items-center z-10">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all gap-1.5"
							>
								<Layers className="w-3.5 h-3.5" />
								<span className="font-medium">
									{visibleLayerCount} visible timeline{visibleLayerCount !== 1 ? "s" : ""}
								</span>
								<ChevronDown className="w-3 h-3 text-slate-500" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="bg-[#1a1a1a] border-white/10 min-w-[180px]"
						>
							<DropdownMenuItem disabled className="text-slate-500 text-xs">
								<Check className="w-3 h-3 mr-1.5" /> Clip
							</DropdownMenuItem>
							<DropdownMenuItem disabled className="text-slate-500 text-xs">
								<Check className="w-3 h-3 mr-1.5" /> Zoom
							</DropdownMenuItem>
							<DropdownMenuSeparator className="bg-white/10" />
							{ADDITIONAL_LAYER_OPTIONS.map((opt) => (
								<DropdownMenuItem
									key={opt.type}
									onClick={() => toggleLayer(opt.type)}
									className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
								>
									{visibleLayers.has(opt.type) ? (
										<Check className="w-3 h-3 text-[#10B981]" />
									) : (
										<Plus className="w-3 h-3 text-slate-500" />
									)}
									<opt.icon className="w-3.5 h-3.5" />
									{opt.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Center: Play controls only - absolutely centered */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="flex items-center gap-0.5 pointer-events-auto">
						<Button
							onClick={onSkipBack}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
							title="Skip Back"
						>
							<SkipBack className="w-4 h-4" />
						</Button>
						<Button
							onClick={onTogglePlayPause}
							variant="ghost"
							size="icon"
							className={cn(
								"h-8 w-8 transition-all",
								isPlaying
									? "text-white hover:text-white/80 hover:bg-white/10"
									: "text-slate-400 hover:text-white hover:bg-white/10",
							)}
							title={isPlaying ? "Pause" : "Play"}
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 fill-current" />
							) : (
								<Play className="w-4 h-4 fill-current" />
							)}
						</Button>
						<Button
							onClick={onSkipForward}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
							title="Skip Forward"
						>
							<SkipForward className="w-4 h-4" />
						</Button>
					</div>
				</div>

				{/* Right: Cut, Zoom, Speed, Zoom slider, Aspect ratio */}
				<div className="ml-auto flex items-center gap-0.5 z-10">
					<Button
						onClick={handleSuggestZooms}
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10 transition-all"
						title="Auto Zoom (suggest zooms from cursor telemetry)"
					>
						<WandSparkles className="w-4 h-4" />
					</Button>

					<Button
						onClick={() => handleAddTrim()}
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
						title="Cut / Trim"
					>
						<Scissors className="w-4 h-4" />
					</Button>

					<div className="w-[1px] h-5 bg-white/10 mx-1" />

					<Button
						onClick={handleTimelineZoomIn}
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
						title="Zoom In Timeline"
					>
						<ZoomIn className="w-4 h-4" />
					</Button>
					<Button
						onClick={handleTimelineZoomOut}
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
						title="Zoom Out Timeline"
					>
						<ZoomOut className="w-4 h-4" />
					</Button>

					<div className="w-[1px] h-5 bg-white/10 mx-1" />

					<span className="text-[11px] text-slate-400 font-medium tabular-nums px-1">
						{playbackSpeed}x
					</span>

					<div className="w-[1px] h-5 bg-white/10 mx-1" />

					<input
						type="range"
						min="0.25"
						max="8"
						step="0.25"
						value={timelineZoomLevel}
						onChange={(e) => {
							const newZoom = Number.parseFloat(e.target.value);
							const center = (range.start + range.end) / 2;
							const newHalfSpan = totalMs / newZoom / 2;
							setRange({
								start: Math.max(0, center - newHalfSpan),
								end: Math.min(totalMs, center + newHalfSpan),
							});
							setTimelineZoomLevel(newZoom);
						}}
						className="w-20 h-1 accent-white/60 cursor-pointer"
						title="Timeline Zoom"
					/>

					<div className="w-[1px] h-5 bg-white/10 mx-1" />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all gap-1"
							>
								<span className="font-medium">{getAspectRatioLabel(aspectRatio)}</span>
								<ChevronDown className="w-3 h-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
							{ASPECT_RATIOS.map((ratio) => (
								<DropdownMenuItem
									key={ratio}
									onClick={() => onAspectRatioChange(ratio)}
									className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center justify-between gap-3"
								>
									<span>{getAspectRatioLabel(ratio)}</span>
									{aspectRatio === ratio && <Check className="w-3 h-3 text-[#10B981]" />}
								</DropdownMenuItem>
							))}
							<div className="mx-1 my-1 h-px bg-white/10" />
							<div className="px-2 py-1.5 flex items-center gap-2 text-slate-300">
								<span className="text-sm">Custom</span>
								<input
									type="text"
									inputMode="numeric"
									value={customAspectWidth}
									onChange={(event) => setCustomAspectWidth(event.target.value.replace(/\D/g, ""))}
									onKeyDown={handleCustomAspectRatioKeyDown}
									className="w-12 h-7 rounded border border-white/15 bg-black/20 px-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
									aria-label="Custom aspect width"
								/>
								<span className="text-slate-500">:</span>
								<input
									type="text"
									inputMode="numeric"
									value={customAspectHeight}
									onChange={(event) => setCustomAspectHeight(event.target.value.replace(/\D/g, ""))}
									onKeyDown={handleCustomAspectRatioKeyDown}
									className="w-12 h-7 rounded border border-white/15 bg-black/20 px-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
									aria-label="Custom aspect height"
								/>
								<Button
									variant="ghost"
									size="sm"
									onClick={applyCustomAspectRatio}
									className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/10"
								>
									Set
								</Button>
								{isCustomAspectRatio(aspectRatio) && (
									<Check className="w-3 h-3 text-[#10B981] ml-auto" />
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Timeline Area */}
			<div
				ref={timelineContainerRef}
				className="flex-1 min-h-0 overflow-auto bg-[#0c0c0f] relative timeline-scrollbar"
				onClick={() => setSelectedKeyframeId(null)}
				onWheel={handleTimelineWheel}
			>
				<TimelineWrapper
					range={clampedRange}
					videoDuration={videoDuration}
					hasOverlap={hasOverlap}
					onRangeChange={setRange}
					minItemDurationMs={timelineScale.minItemDurationMs}
					minVisibleRangeMs={timelineScale.minVisibleRangeMs}
					onItemSpanChange={handleItemSpanChange}
					allRegionSpans={allRegionSpans}
				>
					<KeyframeMarkers
						keyframes={keyframes}
						selectedKeyframeId={selectedKeyframeId}
						setSelectedKeyframeId={setSelectedKeyframeId}
						onKeyframeMove={handleKeyframeMove}
						videoDurationMs={totalMs}
						timelineRef={timelineContainerRef}
					/>
					<Timeline
						items={timelineItems}
						videoDurationMs={totalMs}
						currentTimeMs={currentTimeMs}
						onSeek={onSeek}
						onSelectZoom={onSelectZoom}
						onSelectTrim={onSelectTrim}
						onSelectAnnotation={onSelectAnnotation}
						onSelectCameraLayout={onSelectCameraLayout}
						onSelectSpeed={onSelectSpeed}
						onSelectAudio={onSelectAudio}
						onSelectCaption={onSelectCaption}
						selectedZoomId={selectedZoomId}
						selectedTrimId={selectedTrimId}
						selectedAnnotationId={selectedAnnotationId}
						selectedCameraLayoutId={selectedCameraLayoutId}
						selectedSpeedId={selectedSpeedId}
						selectedAudioId={selectedAudioId}
						selectedCaptionId={selectedCaptionId}
						keyframes={keyframes}
						onAddZoom={handleAddZoom}
						onAddTrim={handleAddTrim}
						onAddAnnotation={handleAddAnnotation}
						onAddCameraLayout={handleAddCameraLayout}
						onAddSpeed={handleAddSpeed}
						onAddAudio={handleAddAudio}
						onAddCaption={handleAddCaption}
						onDeleteZoom={onZoomDelete}
						onDeleteTrim={onTrimDelete}
						onDeleteAnnotation={onAnnotationDelete}
						onDeleteCameraLayout={onCameraLayoutDelete}
						onDeleteSpeed={onSpeedDelete}
						onDeleteAudio={onAudioDelete}
						onDeleteCaption={onCaptionDelete}
						visibleLayers={visibleLayers}
						selectedClip={selectedClip}
						onSelectClip={setSelectedClip}
					/>
				</TimelineWrapper>
			</div>

			{/* Add Layer Button */}
			<div className="flex items-center px-3 py-1 border-t border-white/5 bg-[#111114]">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2.5 text-[11px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all gap-1"
						>
							<Plus className="w-3 h-3" />
							Add Layer
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="bg-[#1a1a1a] border-white/10 min-w-[160px]">
						{ADDITIONAL_LAYER_OPTIONS.map((opt) => (
							<DropdownMenuItem
								key={opt.type}
								onClick={() => {
									toggleLayer(opt.type);
									// Auto-add an item when showing the layer
									if (!visibleLayers.has(opt.type)) {
										if (opt.type === "annotation") handleAddAnnotation();
										else if (opt.type === "camera") handleAddCameraLayout();
										else if (opt.type === "speed") handleAddSpeed();
										else if (opt.type === "audio") handleAddAudio();
										else if (opt.type === "caption") handleAddCaption();
									}
								}}
								className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center gap-2"
							>
								<opt.icon className="w-3.5 h-3.5" />
								{opt.label}
								{visibleLayers.has(opt.type) && (
									<Check className="w-3 h-3 text-[#10B981] ml-auto" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<div className="flex-1" />
				<span className="text-[10px] text-slate-600 font-medium">Scroll to pan</span>
			</div>
		</div>
	);
}
