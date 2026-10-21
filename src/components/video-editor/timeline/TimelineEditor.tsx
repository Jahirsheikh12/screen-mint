import type { Range, Span } from "dnd-timeline";
import { useTimelineContext } from "dnd-timeline";
import {
	Camera,
	Captions,
	Check,
	ChevronDown,
	Clapperboard,
	Gauge,
	Layers,
	Maximize2,
	MessageSquare,
	Minimize2,
	Music,
	Pause,
	Play,
	Plus,
	Scissors,
	Search,
	SkipBack,
	SkipForward,
	Unlink,
	Volume2,
	VolumeOff,
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
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { formatBinding, matchesShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useWaveformData } from "@/lib/waveform/extractWaveform";
import {
	ASPECT_RATIOS,
	type AspectRatio,
	getAspectRatioLabel,
	isCustomAspectRatio,
} from "@/utils/aspectRatioUtils";
import { getAudioRegionDisplayName, loadAudioSelectionDurationMs } from "../audioRegionUtils";
import { loadEditorPreferences, saveEditorPreferences } from "../editorPreferences";
import type { AudioRegion, CameraLayoutRegion, SpeedRegion, ZoomRegion } from "../types";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
import Row from "./Row";
import TimelineWrapper from "./TimelineWrapper";
import { PlaybackCursor, TimelineAxis } from "./timelineOverlays";
import {
	calculateTimelineScale,
	createInitialRange,
	normalizeWheelDeltaToPixels,
} from "./timelineScale";
import {
	ADDITIONAL_LAYER_OPTIONS,
	AdditionalLayerType,
	ANNOTATION_ROW_ID,
	AUDIO_ROW_ID,
	CAMERA_ROW_ID,
	CAPTION_ROW_ID,
	CLIP_ROW_ID,
	ICON_SIDEBAR_WIDTH,
	SPEED_ROW_ID,
	type TimelineEditorProps,
	type TimelineProps,
	type TimelineRenderItem,
	ZOOM_ROW_ID,
} from "./timelineTypes";
import { buildAutoZoomSuggestions, normalizeCursorTelemetry } from "./zoomSuggestionUtils";

function formatPlaybackTime(ms: number) {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const fraction = Math.floor((ms % 1000) / 100);
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${fraction}`;
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
	selectedAnnotationId,
	selectedCameraLayoutId,
	selectedSpeedId,
	selectedAudioId,
	keyframes = [],
	onAddZoom,
	onAddAnnotation,
	onAddCameraLayout,
	onAddSpeed,
	onAddAudio,
	onAddCaption,
	onDeleteZoom,
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
	trimMode = false,
	onSplitClip,
	onDeleteSegment,
	waveformData,
	sourceDurationMs,
}: TimelineProps) {
	const { t } = useI18n();
	const { setTimelineRef, setSidebarRef, style, sidebarWidth, direction, range, pixelsToValue } =
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
			if (videoDurationMs <= 0) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;

			if (clickX < 0) return;

			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			if (trimMode && onSplitClip) {
				onSplitClip(absoluteMs);
				return;
			}

			onSelectZoom?.(null);
			onSelectTrim?.(null);
			onSelectAnnotation?.(null);
			onSelectCameraLayout?.(null);
			onSelectCaption?.(null);
			onSelectSpeed?.(null);
			onSelectAudio?.(null);
			onSelectClip?.(false);

			if (!onSeek) return;
			const timeInSeconds = absoluteMs / 1000;
			onSeek(timeInSeconds);
		},
		[
			onSeek,
			onSplitClip,
			trimMode,
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
	const annotationItems = items.filter((item) => item.rowId === ANNOTATION_ROW_ID);
	const cameraItems = items.filter((item) => item.rowId === CAMERA_ROW_ID);
	const speedItems = items.filter((item) => item.rowId === SPEED_ROW_ID);
	const audioItems = items.filter((item) => item.rowId === AUDIO_ROW_ID);
	const captionItems = items.filter((item) => item.rowId === CAPTION_ROW_ID);

	return (
		<div
			ref={setRefs}
			style={{
				...style,
				height: "auto",
				backgroundImage:
					"linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
				backgroundSize: "24px 24px",
				backgroundPosition: "0 0",
			}}
			className={`select-none bg-transparent min-h-[120px] relative group ${trimMode ? "cursor-crosshair" : "cursor-pointer"}`}
			onClick={handleTimelineClick}
			onMouseMove={handleTimelineMouseMove}
			onMouseLeave={handleTimelineMouseLeave}
		>
			<div
				ref={setSidebarRef}
				aria-hidden
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: ICON_SIDEBAR_WIDTH,
					height: 0,
					visibility: "hidden",
					pointerEvents: "none",
				}}
			/>
			<TimelineAxis videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
			<PlaybackCursor
				currentTimeMs={currentTimeMs}
				videoDurationMs={videoDurationMs}
				onSeek={onSeek}
				timelineRef={localTimelineRef}
				keyframes={keyframes}
			/>
			{ghostX !== null && (
				<div
					className="absolute top-0 bottom-0 z-40 pointer-events-none"
					style={{
						[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
					}}
				>
					<div
						className={`absolute top-0 bottom-0 w-[1px] ${trimMode ? "bg-danger/60" : "bg-fill-pressed"}`}
						style={{
							[sideProperty]: `${ghostX}px`,
						}}
					/>
					{trimMode && (
						<div className="absolute top-1 z-50" style={{ [sideProperty]: `${ghostX - 6}px` }}>
							<Scissors className="w-3 h-3 text-danger-fg/80" />
						</div>
					)}
				</div>
			)}

			<Row
				id={CLIP_ROW_ID}
				isEmpty={clipItems.length === 0}
				hint=""
				variant="clip"
				icon={Clapperboard}
			>
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectedClip}
						onSelect={() => onSelectClip?.(true)}
						onDelete={
							clipItems.length > 1 && item.sourceStart != null && item.sourceEnd != null
								? () => onDeleteSegment?.(item.sourceStart!, item.sourceEnd!)
								: undefined
						}
						variant="clip"
						clipDuration={item.clipDuration}
						clipSpeed={item.clipSpeed}
						waveformData={waveformData}
						sourceStartMs={item.sourceStart}
						sourceEndMs={item.sourceEnd}
						sourceDurationMs={sourceDurationMs}
					>
						{item.label}
					</Item>
				))}
			</Row>

			<Row
				id={ZOOM_ROW_ID}
				isEmpty={zoomItems.length === 0}
				hint={t("timeline.editor.clickOrDragTo", "Click or drag to add zoom on cursor")}
				onAddEffect={onAddZoom}
				addLabel={t("timeline.editor.zoom", "Zoom")}
				variant="zoom"
				icon={Search}
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

			{visibleLayers.has("annotation") && (
				<Row
					id={ANNOTATION_ROW_ID}
					isEmpty={annotationItems.length === 0}
					hint={t("timeline.editor.hoverToAddAnnotation", "Hover to add annotation")}
					onAddEffect={onAddAnnotation}
					addLabel={t("timeline.editor.annotation", "Annotation")}
					icon={MessageSquare}
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
					hint={t(
						"timeline.editor.addALayoutTo",
						"Add a layout to change camera position, size, or visibility over time",
					)}
					onAddEffect={onAddCameraLayout}
					addLabel={t("timeline.editor.layouts", "Layouts")}
					icon={Camera}
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
					hint={t("timeline.editor.hoverToAddSpeed", "Hover to add speed")}
					onAddEffect={onAddSpeed}
					addLabel={t("timeline.editor.speed", "Speed")}
					icon={Gauge}
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
					hint={t("timeline.editor.hoverToAddAudio", "Hover to add audio")}
					onAddEffect={onAddAudio}
					addLabel={t("timeline.editor.audio", "Audio")}
					icon={Music}
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
					hint={t("timeline.editor.hoverToAddCaption", "Hover to add caption")}
					onAddEffect={onAddCaption}
					addLabel={t("timeline.editor.caption", "Caption")}
					icon={Captions}
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
	cutPoints = [],
	onSplitClip,
	onDeleteSegment,
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
	videoPath,
	hasAudio = false,
	clipVolume = 1,
	onClipVolumeChange,
	onSeparateClipAudio,
	timelineExpanded = false,
	onToggleTimelineExpanded,
}: TimelineEditorProps) {
	const { t } = useI18n();
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const prevVolumeRef = useRef(clipVolume || 1);
	const totalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
	const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);
	const waveformData = useWaveformData(videoPath ?? null, hasAudio);

	const sortedTrimRegions = useMemo(
		() => [...trimRegions].sort((a, b) => a.startMs - b.startMs),
		[trimRegions],
	);

	const displayTotalMs = useMemo(() => {
		const trimmed = sortedTrimRegions.reduce((sum, tr) => sum + (tr.endMs - tr.startMs), 0);
		return Math.max(0, totalMs - trimmed);
	}, [totalMs, sortedTrimRegions]);

	const sourceToDisplay = useCallback(
		(sourceMs: number): number => {
			let offset = 0;
			for (const trim of sortedTrimRegions) {
				if (sourceMs <= trim.startMs) break;
				if (sourceMs >= trim.endMs) {
					offset += trim.endMs - trim.startMs;
				} else {
					return trim.startMs - offset;
				}
			}
			return sourceMs - offset;
		},
		[sortedTrimRegions],
	);

	const displayToSource = useCallback(
		(displayMs: number): number => {
			let sourceMs = displayMs;
			for (const trim of sortedTrimRegions) {
				if (sourceMs < trim.startMs) break;
				sourceMs += trim.endMs - trim.startMs;
			}
			return sourceMs;
		},
		[sortedTrimRegions],
	);

	const displayCurrentTimeMs = useMemo(
		() => sourceToDisplay(currentTimeMs),
		[sourceToDisplay, currentTimeMs],
	);

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
	const [trimMode, setTrimMode] = useState(false);
	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const { shortcuts: keyShortcuts, isMac } = useShortcuts();

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
				end: Math.min(displayTotalMs, center + halfSpan),
			};
		});
		setTimelineZoomLevel((prev) => Math.min(prev * 2, 32));
	}, [displayTotalMs]);

	const handleTimelineZoomOut = useCallback(() => {
		setRange((prev) => {
			const center = (prev.start + prev.end) / 2;
			const halfSpan = prev.end - prev.start;
			return {
				start: Math.max(0, center - halfSpan),
				end: Math.min(displayTotalMs, center + halfSpan),
			};
		});
		setTimelineZoomLevel((prev) => Math.max(prev / 2, 0.25));
	}, [displayTotalMs]);

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
			toast.error(
				t("timeline.editor.customAspectRatioMust", "Custom aspect ratio must be positive numbers."),
			);
			return;
		}
		onAspectRatioChange(`${width}:${height}` as AspectRatio);
	}, [customAspectHeight, customAspectWidth, onAspectRatioChange, t]);

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

	const addKeyframe = useCallback(() => {
		if (totalMs === 0) return;
		const time = Math.max(0, Math.min(currentTimeMs, totalMs));
		if (keyframes.some((kf) => Math.abs(kf.time - time) < 1)) return;
		setKeyframes((prev) => [...prev, { id: uuidv4(), time }]);
	}, [currentTimeMs, totalMs, keyframes]);

	const deleteSelectedKeyframe = useCallback(() => {
		if (!selectedKeyframeId) return;
		setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedKeyframeId));
		setSelectedKeyframeId(null);
	}, [selectedKeyframeId]);

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

	const deleteSelectedZoom = useCallback(() => {
		if (!selectedZoomId) return;
		onZoomDelete(selectedZoomId);
		onSelectZoom(null);
	}, [selectedZoomId, onZoomDelete, onSelectZoom]);

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
		setRange(createInitialRange(displayTotalMs));
	}, [displayTotalMs]);

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
	}, [
		totalMs,
		safeMinDurationMs,
		onZoomSpanChange,
		onCameraLayoutSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onCaptionSpanChange,
	]);

	const hasOverlap = useCallback(
		(newSpan: Span, excludeId?: string): boolean => {
			const isZoomItem = zoomRegions.some((r) => r.id === excludeId);
			const isAnnotationItem = annotationRegions.some((r) => r.id === excludeId);
			const isCameraItem = cameraLayouts.some((r) => r.id === excludeId);
			const isSpeedItem = speedRegions.some((r) => r.id === excludeId);
			const isAudioItem = audioRegions.some((r) => r.id === excludeId);
			const isCaptionItem = captionRegions.some((r) => r.id === excludeId);

			if (isAnnotationItem || isCaptionItem) {
				return false;
			}

			const checkOverlap = (
				regions: (ZoomRegion | SpeedRegion | AudioRegion | CameraLayoutRegion)[],
			) => {
				return regions.some((region) => {
					if (region.id === excludeId) return false;
					return newSpan.end > region.startMs && newSpan.start < region.endMs;
				});
			};

			if (isZoomItem) {
				return checkOverlap(zoomRegions);
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
		[zoomRegions, annotationRegions, cameraLayouts, speedRegions, audioRegions, captionRegions],
	);

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

			const startPos = Math.max(
				0,
				Math.min(clickTimeMs != null ? Math.round(clickTimeMs) : currentTimeMs, totalMs),
			);
			const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error(t("timeline.editor.cannotPlaceZoomHere", "Cannot place zoom here"), {
					description: t(
						"timeline.editor.zoomAlreadyExistsAt",
						"Zoom already exists at this location or not enough space available.",
					),
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onZoomAdded({ start: startPos, end: startPos + actualDuration });
		},
		[videoDuration, totalMs, currentTimeMs, zoomRegions, onZoomAdded, defaultRegionDurationMs, t],
	);

	const handleSuggestZooms = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0) {
			return;
		}

		if (!onZoomSuggested) {
			toast.error(
				t(
					"timeline.editor.zoomSuggestionHandlerUnavailable",
					"Zoom suggestion handler unavailable",
				),
			);
			return;
		}

		if (cursorTelemetry.length < 2) {
			toast.info(t("timeline.editor.noCursorTelemetryAvailable", "No cursor telemetry available"), {
				description: t(
					"timeline.editor.recordAScreencastFirst",
					"Record a screencast first to generate cursor-based suggestions.",
				),
			});
			return;
		}

		const reservedSpans = [...zoomRegions]
			.map((region) => ({ start: region.startMs, end: region.endMs }))
			.sort((a, b) => a.start - b.start);

		const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);

		if (normalizedSamples.length < 2) {
			toast.info(t("timeline.editor.noUsableCursorTelemetry", "No usable cursor telemetry"), {
				description: t(
					"timeline.editor.theRecordingDoesNot",
					"The recording does not include enough cursor movement data.",
				),
			});
			return;
		}

		const suggestionResult = buildAutoZoomSuggestions(normalizedSamples, totalMs, reservedSpans);

		if (suggestionResult.status === "no-candidates") {
			toast.info(
				t("timeline.editor.noClearInteractionMoments", "No clear interaction moments found"),
				{
					description: t(
						"timeline.editor.tryARecordingWith",
						"Try a recording with pauses or clicks around important actions.",
					),
				},
			);
			return;
		}

		let addedCount = 0;

		for (const suggestion of suggestionResult.suggestions) {
			onZoomSuggested(
				{ start: suggestion.startMs, end: suggestion.endMs },
				suggestion.focus,
				suggestion.mode,
			);
			addedCount += 1;
		}

		if (addedCount === 0) {
			toast.info(t("timeline.editor.noAutoZoomSlots", "No auto-zoom slots available"), {
				description: t(
					"timeline.editor.detectedDwellPointsOverlap",
					"Detected dwell points overlap existing zoom regions.",
				),
			});
			return;
		}

		toast.success(
			`Added ${addedCount} interaction-based zoom suggestion${addedCount === 1 ? "" : "s"}`,
		);
	}, [videoDuration, totalMs, zoomRegions, onZoomSuggested, cursorTelemetry, t]);

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
				toast.error(t("timeline.editor.cannotPlaceSpeedHere", "Cannot place speed here"), {
					description: t(
						"timeline.editor.speedRegionAlreadyExists",
						"Speed region already exists at this location or not enough space available.",
					),
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onSpeedAdded({ start: startPos, end: startPos + actualDuration });
		},
		[videoDuration, totalMs, currentTimeMs, speedRegions, onSpeedAdded, defaultRegionDurationMs, t],
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
				toast.error(t("timeline.editor.couldNotReadAudio", "Could not read audio file"), {
					description: t(
						"timeline.editor.theSelectedFileMay",
						"The selected file may be corrupted or in an unsupported format.",
					),
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
		[videoDuration, totalMs, onAudioAdded, t],
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
				toast.error(
					t("timeline.editor.cannotPlaceCameraLayout", "Cannot place camera layout here"),
					{
						description: t(
							"timeline.editor.cameraLayoutAlreadyExists",
							"Camera layout already exists at this location or not enough space is available.",
						),
					},
				);
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
			t,
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

			if (e.key === "Escape") {
				setTrimMode(false);
			}
			if (matchesShortcut(e, keyShortcuts.addKeyframe, isMac)) {
				addKeyframe();
			}
			if (matchesShortcut(e, keyShortcuts.addZoom, isMac)) {
				handleAddZoom();
			}
			if (matchesShortcut(e, keyShortcuts.addTrim, isMac)) {
				setTrimMode((prev) => !prev);
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
		handleAddAnnotation,
		handleAddSpeed,
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		deleteSelectedAnnotation,
		deleteSelectedCameraLayout,
		deleteSelectedSpeed,
		deleteSelectedAudio,
		deleteSelectedCaption,
		selectedKeyframeId,
		selectedZoomId,
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
		if (displayTotalMs === 0) {
			return range;
		}

		return {
			start: Math.max(0, Math.min(range.start, displayTotalMs)),
			end: Math.min(range.end, displayTotalMs),
		};
	}, [range, displayTotalMs]);

	const clipDurationLabel = useMemo(() => {
		const s = displayTotalMs / 1000;
		if (s < 60) return `${Math.round(s * 10) / 10}s`;
		const min = Math.floor(s / 60);
		const sec = Math.round(s % 60);
		return `${min}m ${sec}s`;
	}, [displayTotalMs]);

	const clipSegments = useMemo(() => {
		if (totalMs <= 0) return [];

		const boundaries = new Set<number>([0, totalMs]);
		for (const cp of cutPoints) {
			if (cp > 0 && cp < totalMs) boundaries.add(cp);
		}
		for (const tr of trimRegions) {
			boundaries.add(Math.max(0, tr.startMs));
			boundaries.add(Math.min(totalMs, tr.endMs));
		}

		const sorted = [...boundaries].sort((a, b) => a - b);
		const segments: { id: string; startMs: number; endMs: number }[] = [];

		for (let i = 0; i < sorted.length - 1; i++) {
			const start = sorted[i];
			const end = sorted[i + 1];
			const isTrimmed = trimRegions.some((tr) => start >= tr.startMs && end <= tr.endMs);
			if (!isTrimmed && end > start) {
				segments.push({ id: `segment-${start}-${end}`, startMs: start, endMs: end });
			}
		}

		return segments;
	}, [totalMs, cutPoints, trimRegions]);

	const timelineItems = useMemo<TimelineRenderItem[]>(() => {
		const hasSplits = clipSegments.length > 1 || trimRegions.length > 0;
		const clip: TimelineRenderItem[] = clipSegments.map((seg, index) => ({
			id: seg.id,
			rowId: CLIP_ROW_ID,
			span: { start: sourceToDisplay(seg.startMs), end: sourceToDisplay(seg.endMs) },
			label: hasSplits ? `Part ${index + 1}` : t("timeline.editor.clip", "Clip"),
			variant: "clip",
			clipDuration: hasSplits ? undefined : clipDurationLabel,
			clipSpeed: hasSplits ? undefined : `${playbackSpeed}x`,
			sourceStart: seg.startMs,
			sourceEnd: seg.endMs,
		}));

		const zooms: TimelineRenderItem[] = zoomRegions
			.map((region, index) => ({
				id: region.id,
				rowId: ZOOM_ROW_ID,
				span: {
					start: sourceToDisplay(region.startMs),
					end: sourceToDisplay(region.endMs),
				},
				label: `Zoom ${index + 1}`,
				zoomDepth: region.depth,
				variant: "zoom" as const,
			}))
			.filter((item) => item.span.end > item.span.start);

		const annotations: TimelineRenderItem[] = annotationRegions
			.map((region) => {
				let label: string;

				if (region.type === "text") {
					const preview = region.content.trim() || t("timeline.editor.emptyText", "Empty text");
					label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
				} else if (region.type === "image") {
					label = t("timeline.editor.image", "Image");
				} else if (region.type === "blur") {
					label = t("timeline.editor.blur", "Blur");
				} else {
					label = t("timeline.editor.annotation", "Annotation");
				}

				return {
					id: region.id,
					rowId: ANNOTATION_ROW_ID,
					span: {
						start: sourceToDisplay(region.startMs),
						end: sourceToDisplay(region.endMs),
					},
					label,
					variant: "annotation" as const,
				};
			})
			.filter((item) => item.span.end > item.span.start);

		const cameras: TimelineRenderItem[] = cameraLayouts
			.map((layout, index) => ({
				id: layout.id,
				rowId: CAMERA_ROW_ID,
				span: {
					start: sourceToDisplay(layout.startMs),
					end: sourceToDisplay(layout.endMs),
				},
				label:
					layout.mode === "fullscreen"
						? t("timeline.editor.fullscreen", "Fullscreen")
						: layout.mode === "hidden"
							? t("timeline.editor.hidden", "Hidden")
							: t("timeline.editor.defaultLayout", "Default {{number}}", { number: index + 1 }),
				variant: "camera" as const,
			}))
			.filter((item) => item.span.end > item.span.start);

		const speeds: TimelineRenderItem[] = speedRegions
			.map((region, index) => ({
				id: region.id,
				rowId: SPEED_ROW_ID,
				span: {
					start: sourceToDisplay(region.startMs),
					end: sourceToDisplay(region.endMs),
				},
				label: `Speed ${index + 1}`,
				speedValue: region.speed,
				variant: "speed" as const,
			}))
			.filter((item) => item.span.end > item.span.start);

		const audios: TimelineRenderItem[] = audioRegions
			.map((region) => ({
				id: region.id,
				rowId: AUDIO_ROW_ID,
				span: {
					start: sourceToDisplay(region.startMs),
					end: sourceToDisplay(region.endMs),
				},
				label: getAudioRegionDisplayName(region),
				variant: "audio" as const,
			}))
			.filter((item) => item.span.end > item.span.start);

		const captions: TimelineRenderItem[] = captionRegions
			.map((region) => {
				const preview = region.text.trim() || t("timeline.editor.caption", "Caption");
				return {
					id: region.id,
					rowId: CAPTION_ROW_ID,
					span: {
						start: sourceToDisplay(region.startMs),
						end: sourceToDisplay(region.endMs),
					},
					label: preview,
					variant: "caption" as const,
				};
			})
			.filter((item) => item.span.end > item.span.start);

		return [...clip, ...zooms, ...annotations, ...cameras, ...speeds, ...audios, ...captions];
	}, [
		clipSegments,
		clipDurationLabel,
		playbackSpeed,
		sourceToDisplay,
		zoomRegions,
		trimRegions,
		annotationRegions,
		cameraLayouts,
		speedRegions,
		audioRegions,
		captionRegions,
		t,
	]);

	const allRegionSpans = useMemo(() => {
		const zooms = zoomRegions.map((r) => ({
			id: r.id,
			start: sourceToDisplay(r.startMs),
			end: sourceToDisplay(r.endMs),
		}));
		const speeds = speedRegions.map((r) => ({
			id: r.id,
			start: sourceToDisplay(r.startMs),
			end: sourceToDisplay(r.endMs),
		}));
		const cameras = cameraLayouts.map((r) => ({
			id: r.id,
			start: sourceToDisplay(r.startMs),
			end: sourceToDisplay(r.endMs),
		}));
		const audios = audioRegions.map((r) => ({
			id: r.id,
			start: sourceToDisplay(r.startMs),
			end: sourceToDisplay(r.endMs),
		}));
		return [...zooms, ...cameras, ...speeds, ...audios];
	}, [zoomRegions, cameraLayouts, speedRegions, audioRegions, sourceToDisplay]);

	const handleItemSpanChange = useCallback(
		(id: string, displaySpan: Span) => {
			const span = {
				start: displayToSource(displaySpan.start),
				end: displayToSource(displaySpan.end),
			};
			if (zoomRegions.some((r) => r.id === id)) {
				onZoomSpanChange(id, span);
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
			displayToSource,
			zoomRegions,
			cameraLayouts,
			speedRegions,
			annotationRegions,
			audioRegions,
			captionRegions,
			onZoomSpanChange,
			onCameraLayoutSpanChange,
			onSpeedSpanChange,
			onAnnotationSpanChange,
			onAudioSpanChange,
			onCaptionSpanChange,
		],
	);

	const displayTimeHasOverlap = useCallback(
		(displaySpan: Span, excludeId?: string): boolean => {
			const sourceSpan = {
				start: displayToSource(displaySpan.start),
				end: displayToSource(displaySpan.end),
			};
			return hasOverlap(sourceSpan, excludeId);
		},
		[hasOverlap, displayToSource],
	);

	const wrappedOnSeek = useCallback(
		(timeInSeconds: number) => {
			if (!onSeek) return;
			const displayMs = timeInSeconds * 1000;
			const sourceMs = displayToSource(displayMs);
			onSeek(sourceMs / 1000);
		},
		[onSeek, displayToSource],
	);

	const wrappedOnSplitClip = useCallback(
		(displayTimeMs: number) => {
			if (!onSplitClip) return;
			onSplitClip(displayToSource(displayTimeMs));
		},
		[onSplitClip, displayToSource],
	);

	const wrappedHandleAddZoom = useCallback(
		(clickTimeMs?: number) => {
			handleAddZoom(clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined);
		},
		[handleAddZoom, displayToSource],
	);

	const wrappedHandleAddAnnotation = useCallback(
		(clickTimeMs?: number) => {
			handleAddAnnotation(
				clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined,
			);
		},
		[handleAddAnnotation, displayToSource],
	);

	const wrappedHandleAddCameraLayout = useCallback(
		(clickTimeMs?: number) => {
			handleAddCameraLayout(
				clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined,
			);
		},
		[handleAddCameraLayout, displayToSource],
	);

	const wrappedHandleAddSpeed = useCallback(
		(clickTimeMs?: number) => {
			handleAddSpeed(clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined);
		},
		[handleAddSpeed, displayToSource],
	);

	const wrappedHandleAddAudio = useCallback(
		async (clickTimeMs?: number) => {
			await handleAddAudio(
				clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined,
			);
		},
		[handleAddAudio, displayToSource],
	);

	const wrappedHandleAddCaption = useCallback(
		(clickTimeMs?: number) => {
			handleAddCaption(clickTimeMs != null ? displayToSource(Math.round(clickTimeMs)) : undefined);
		},
		[handleAddCaption, displayToSource],
	);

	const panTimelineRange = useCallback(
		(deltaMs: number) => {
			if (!Number.isFinite(deltaMs) || deltaMs === 0 || displayTotalMs <= 0) {
				return;
			}

			setRange((previous) => {
				const visibleSpan = Math.max(1, previous.end - previous.start);
				const maxStart = Math.max(0, displayTotalMs - visibleSpan);
				const nextStart = Math.max(0, Math.min(previous.start + deltaMs, maxStart));

				return {
					start: nextStart,
					end: nextStart + visibleSpan,
				};
			});
		},
		[displayTotalMs],
	);

	const handleTimelineWheel = useCallback(
		(event: WheelEvent<HTMLDivElement>) => {
			if (event.ctrlKey || event.metaKey || displayTotalMs <= 0) {
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
		[clampedRange.end, clampedRange.start, panTimelineRange, displayTotalMs],
	);

	if (!videoDuration || videoDuration === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-canvas gap-3">
				<div className="w-12 h-12 rounded-full bg-fill-subtle flex items-center justify-center">
					<Plus className="w-6 h-6 text-fg-disabled" />
				</div>
				<div className="text-center">
					<p className="text-body font-medium text-fg-muted">
						{t("timeline.editor.noVideoLoaded", "No Video Loaded")}
					</p>
					<p className="text-label text-fg-subtle mt-1">
						{t("timeline.editor.dragAndDropA", "Drag and drop a video to start editing")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 flex flex-col bg-surface overflow-hidden">
			{/* Transport Controls Bar */}
			<div className="relative flex items-center gap-1 px-3 py-1.5 bg-transparent z-20">
				{/* Left: Layer visibility */}
				<div className="flex shrink-0 items-center z-10">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2.5 text-label text-fg-muted hover:text-fg hover:bg-fill-hover transition-all gap-1.5"
							>
								<Layers className="w-3.5 h-3.5" />
								<span className="hidden font-medium lg:inline">
									{visibleLayerCount === 1
										? t("timeline.toolbar.visibleOne", "1 visible timeline")
										: t("timeline.toolbar.visibleMany", "{{count}} visible timelines", {
												count: visibleLayerCount,
											})}
								</span>
								<ChevronDown className="w-3 h-3 text-fg-subtle" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="bg-raised border-line-strong min-w-[180px]"
						>
							<DropdownMenuItem disabled className="text-fg-subtle text-label">
								<Check className="w-3 h-3 mr-1.5" /> {t("timeline.editor.clip", "Clip")}
							</DropdownMenuItem>
							<DropdownMenuItem disabled className="text-fg-subtle text-label">
								<Check className="w-3 h-3 mr-1.5" /> {t("timeline.editor.zoom", "Zoom")}
							</DropdownMenuItem>
							<DropdownMenuSeparator className="bg-fill-hover" />
							{ADDITIONAL_LAYER_OPTIONS.map((opt) => (
								<DropdownMenuItem
									key={opt.type}
									onClick={() => toggleLayer(opt.type)}
									className="text-fg-muted hover:text-fg hover:bg-fill-hover cursor-pointer flex items-center gap-1.5"
								>
									{visibleLayers.has(opt.type) ? (
										<Check className="w-3 h-3 text-accent-fg" />
									) : (
										<Plus className="w-3 h-3 text-fg-subtle" />
									)}
									<opt.icon className="w-3.5 h-3.5" />
									{opt.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Volume control - only when video has audio */}
				{hasAudio && (
					<div className="flex shrink-0 items-center gap-1 z-10 ml-1 group/vol">
						<Tooltip
							content={
								clipVolume === 0
									? t("timeline.editor.unmute", "Unmute")
									: t("timeline.editor.mute", "Mute")
							}
							side="bottom"
						>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
								onClick={() => {
									if (clipVolume === 0) {
										onClipVolumeChange?.(prevVolumeRef.current > 0 ? prevVolumeRef.current : 1);
									} else {
										prevVolumeRef.current = clipVolume;
										onClipVolumeChange?.(0);
									}
								}}
							>
								{clipVolume === 0 ? (
									<VolumeOff className="w-3.5 h-3.5" />
								) : (
									<Volume2 className="w-3.5 h-3.5" />
								)}
							</Button>
						</Tooltip>
						<Tooltip content={`Volume: ${Math.round(clipVolume * 100)}%`} side="bottom">
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={clipVolume}
								onChange={(e) => onClipVolumeChange?.(Number.parseFloat(e.target.value))}
								className="hidden w-16 h-1 accent-amber-500 cursor-pointer opacity-60 group-hover/vol:opacity-100 transition-opacity lg:block"
							/>
						</Tooltip>
						{onSeparateClipAudio && (
							<Tooltip
								content={t("timeline.editor.separateClipFromAudio", "Separate clip from audio")}
								side="bottom"
							>
								<Button
									variant="ghost"
									size="icon"
									aria-label={t(
										"timeline.editor.separateClipFromAudio",
										"Separate clip from audio",
									)}
									className="h-7 w-7 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
									onClick={onSeparateClipAudio}
								>
									<Unlink className="w-3.5 h-3.5" />
								</Button>
							</Tooltip>
						)}
					</div>
				)}

				{/* Time Display */}
				<div className="flex shrink-0 items-center gap-1.5 ml-2 bg-fill-subtle hover:bg-fill-hover transition-colors px-2.5 py-1 rounded-md border border-line z-10 tabular-nums text-caption cursor-default whitespace-nowrap">
					<span className="text-fg font-medium">{formatPlaybackTime(displayCurrentTimeMs)}</span>
					<span className="text-fg-subtle font-medium">/</span>
					<span className="text-fg-subtle font-medium">{formatPlaybackTime(displayTotalMs)}</span>
				</div>

				{/* Center: play controls, centred in the space between the side groups */}
				<div className="flex min-w-0 flex-1 items-center justify-center">
					<div className="flex shrink-0 items-center gap-0.5">
						<Tooltip
							content={t("timeline.editor.skipBack", "Skip Back")}
							shortcut="5s"
							side="bottom"
						>
							<Button
								onClick={onSkipBack}
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
							>
								<SkipBack className="w-4 h-4" />
							</Button>
						</Tooltip>
						<Tooltip
							content={
								isPlaying ? t("timeline.editor.pause", "Pause") : t("timeline.editor.play", "Play")
							}
							shortcut={formatBinding(keyShortcuts.playPause, isMac)}
							side="bottom"
						>
							<Button
								onClick={onTogglePlayPause}
								variant="ghost"
								size="icon"
								className={cn(
									"h-8 w-8 transition-all",
									isPlaying
										? "text-fg hover:text-fg-muted hover:bg-fill-hover"
										: "text-fg-muted hover:text-fg hover:bg-fill-hover",
								)}
							>
								{isPlaying ? (
									<Pause className="w-4 h-4 fill-current" />
								) : (
									<Play className="w-4 h-4 fill-current" />
								)}
							</Button>
						</Tooltip>
						<Tooltip
							content={t("timeline.editor.skipForward", "Skip Forward")}
							shortcut="5s"
							side="bottom"
						>
							<Button
								onClick={onSkipForward}
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
							>
								<SkipForward className="w-4 h-4" />
							</Button>
						</Tooltip>
					</div>
				</div>

				{/* Right: Cut, Zoom, Speed, Zoom slider, Aspect ratio */}
				<div className="flex shrink-0 items-center gap-0.5 z-10">
					<Tooltip content={t("timeline.editor.autoZoom", "Auto Zoom")} side="bottom">
						<Button
							onClick={handleSuggestZooms}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-accent-fg/80 hover:text-accent-fg hover:bg-accent/10 transition-all"
						>
							<WandSparkles className="w-4 h-4" />
						</Button>
					</Tooltip>

					<Tooltip
						content={
							trimMode
								? t("timeline.editor.disableTrimMode", "Disable Trim Mode")
								: t("timeline.editor.trimMode", "Trim Mode")
						}
						shortcut={formatBinding(keyShortcuts.addTrim, isMac)}
						side="bottom"
					>
						<Button
							onClick={() => setTrimMode((prev) => !prev)}
							variant="ghost"
							size="icon"
							className={cn(
								"h-8 w-8 transition-all",
								trimMode
									? "text-danger-fg bg-danger/15 hover:text-danger-fg hover:bg-danger/25 ring-1 ring-danger/30"
									: "text-fg-muted hover:text-fg hover:bg-fill-hover",
							)}
						>
							<Scissors className="w-4 h-4" />
						</Button>
					</Tooltip>

					<div className="w-[1px] h-5 bg-fill-hover mx-1" />

					<Tooltip
						content={t("timeline.editor.zoomIn", "Zoom In")}
						shortcut={isMac ? "⌘ + Scroll" : t("timeline.editor.ctrlScroll", "Ctrl + Scroll")}
						side="bottom"
					>
						<Button
							onClick={handleTimelineZoomIn}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
						>
							<ZoomIn className="w-4 h-4" />
						</Button>
					</Tooltip>
					<Tooltip content={t("timeline.editor.zoomOut", "Zoom Out")} side="bottom">
						<Button
							onClick={handleTimelineZoomOut}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
						>
							<ZoomOut className="w-4 h-4" />
						</Button>
					</Tooltip>
					{onToggleTimelineExpanded && (
						<Tooltip
							content={
								timelineExpanded
									? t("timeline.editor.collapseTimeline", "Collapse Timeline")
									: t("timeline.editor.expandTimeline", "Expand Timeline")
							}
							side="bottom"
						>
							<Button
								onClick={onToggleTimelineExpanded}
								variant="ghost"
								size="icon"
								aria-label={
									timelineExpanded
										? t("timeline.editor.collapseTimeline2", "Collapse timeline")
										: t("timeline.editor.expandTimeline2", "Expand timeline")
								}
								className="h-8 w-8 text-fg-muted hover:text-fg hover:bg-fill-hover transition-all"
							>
								{timelineExpanded ? (
									<Minimize2 className="w-4 h-4" />
								) : (
									<Maximize2 className="w-4 h-4" />
								)}
							</Button>
						</Tooltip>
					)}

					<div className="w-[1px] h-5 bg-fill-hover mx-1" />

					<Tooltip content={t("timeline.editor.playbackSpeed", "Playback Speed")} side="bottom">
						<span className="text-caption text-fg-muted font-medium tabular-nums px-1">
							{playbackSpeed}x
						</span>
					</Tooltip>

					<div className="w-[1px] h-5 bg-fill-hover mx-1" />

					<Tooltip content={t("timeline.editor.timelineZoom", "Timeline Zoom")} side="bottom">
						<input
							aria-label={t("timeline.editor.timelineZoom", "Timeline Zoom")}
							type="range"
							min="0.25"
							max="8"
							step="0.25"
							value={timelineZoomLevel}
							onChange={(e) => {
								const newZoom = Number.parseFloat(e.target.value);
								const center = (range.start + range.end) / 2;
								const newHalfSpan = displayTotalMs / newZoom / 2;
								setRange({
									start: Math.max(0, center - newHalfSpan),
									end: Math.min(displayTotalMs, center + newHalfSpan),
								});
								setTimelineZoomLevel(newZoom);
							}}
							className="hidden w-20 h-1 accent-white/60 cursor-pointer lg:block"
						/>
					</Tooltip>

					<div className="w-[1px] h-5 bg-fill-hover mx-1" />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-label text-fg-muted hover:text-fg hover:bg-fill-hover transition-all gap-1"
							>
								<span className="font-medium">{getAspectRatioLabel(aspectRatio)}</span>
								<ChevronDown className="w-3 h-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="bg-raised border-line-strong">
							{ASPECT_RATIOS.map((ratio) => (
								<DropdownMenuItem
									key={ratio}
									onClick={() => onAspectRatioChange(ratio)}
									className="text-fg-muted hover:text-fg hover:bg-fill-hover cursor-pointer flex items-center justify-between gap-3"
								>
									<span>{getAspectRatioLabel(ratio)}</span>
									{aspectRatio === ratio && <Check className="w-3 h-3 text-accent-fg" />}
								</DropdownMenuItem>
							))}
							<div className="mx-1 my-1 h-px bg-fill-hover" />
							<div className="px-2 py-1.5 flex items-center gap-2 text-fg-muted">
								<span className="text-body">{t("timeline.editor.custom", "Custom")}</span>
								<input
									type="text"
									inputMode="numeric"
									value={customAspectWidth}
									onChange={(event) => setCustomAspectWidth(event.target.value.replace(/\D/g, ""))}
									onKeyDown={handleCustomAspectRatioKeyDown}
									className="w-12 h-7 rounded border border-line-strong bg-sunken px-1.5 text-body text-fg focus:outline-none focus:ring-1 focus:ring-accent"
									aria-label={t("timeline.editor.customAspectWidth", "Custom aspect width")}
								/>
								<span className="text-fg-subtle">:</span>
								<input
									type="text"
									inputMode="numeric"
									value={customAspectHeight}
									onChange={(event) => setCustomAspectHeight(event.target.value.replace(/\D/g, ""))}
									onKeyDown={handleCustomAspectRatioKeyDown}
									className="w-12 h-7 rounded border border-line-strong bg-sunken px-1.5 text-body text-fg focus:outline-none focus:ring-1 focus:ring-accent"
									aria-label={t("timeline.editor.customAspectHeight", "Custom aspect height")}
								/>
								<Button
									variant="ghost"
									size="sm"
									onClick={applyCustomAspectRatio}
									className="h-7 px-2 text-label text-fg-muted hover:text-fg hover:bg-fill-hover"
								>
									{t("timeline.editor.set", "Set")}
								</Button>
								{isCustomAspectRatio(aspectRatio) && (
									<Check className="w-3 h-3 text-accent-fg ml-auto" />
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Timeline Area */}
			<div
				ref={timelineContainerRef}
				className="flex-1 min-h-0 overflow-auto bg-surface relative timeline-scrollbar"
				onClick={() => setSelectedKeyframeId(null)}
				onWheel={handleTimelineWheel}
			>
				<TimelineWrapper
					range={clampedRange}
					videoDuration={displayTotalMs / 1000}
					hasOverlap={displayTimeHasOverlap}
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
						videoDurationMs={displayTotalMs}
						timelineRef={timelineContainerRef}
					/>
					<Timeline
						items={timelineItems}
						videoDurationMs={displayTotalMs}
						currentTimeMs={displayCurrentTimeMs}
						onSeek={wrappedOnSeek}
						onSelectZoom={onSelectZoom}
						onSelectTrim={onSelectTrim}
						onSelectAnnotation={onSelectAnnotation}
						onSelectCameraLayout={onSelectCameraLayout}
						onSelectSpeed={onSelectSpeed}
						onSelectAudio={onSelectAudio}
						onSelectCaption={onSelectCaption}
						selectedZoomId={selectedZoomId}
						selectedAnnotationId={selectedAnnotationId}
						selectedCameraLayoutId={selectedCameraLayoutId}
						selectedSpeedId={selectedSpeedId}
						selectedAudioId={selectedAudioId}
						selectedCaptionId={selectedCaptionId}
						keyframes={keyframes}
						onAddZoom={wrappedHandleAddZoom}
						onAddAnnotation={wrappedHandleAddAnnotation}
						onAddCameraLayout={wrappedHandleAddCameraLayout}
						onAddSpeed={wrappedHandleAddSpeed}
						onAddAudio={wrappedHandleAddAudio}
						onAddCaption={wrappedHandleAddCaption}
						onDeleteZoom={onZoomDelete}
						onDeleteAnnotation={onAnnotationDelete}
						onDeleteCameraLayout={onCameraLayoutDelete}
						onDeleteSpeed={onSpeedDelete}
						onDeleteAudio={onAudioDelete}
						onDeleteCaption={onCaptionDelete}
						visibleLayers={visibleLayers}
						selectedClip={selectedClip}
						onSelectClip={setSelectedClip}
						trimMode={trimMode}
						onSplitClip={wrappedOnSplitClip}
						onDeleteSegment={onDeleteSegment}
						waveformData={waveformData}
						sourceDurationMs={totalMs}
					/>
				</TimelineWrapper>
			</div>
		</div>
	);
}
