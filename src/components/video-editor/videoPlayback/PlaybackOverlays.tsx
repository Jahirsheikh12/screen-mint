import type React from "react";
import { AnnotationOverlay } from "../AnnotationOverlay";
import { CaptionOverlay } from "../CaptionOverlay";
import type { ResolvedWebcamRenderModel } from "../cameraLayouts";
import { KeyboardShortcutOverlay } from "../KeyboardShortcutOverlay";
import type {
	AnnotationRegion,
	CaptionPositionOverride,
	CaptionRegion,
	CaptionSettings,
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	WebcamEffects,
	WebcamHealthMetrics,
	WebcamPreviewMode,
} from "../types";
import { WebcamOverlay } from "../WebcamOverlay";
import type { WebcamPreviewRects } from "./playbackTypes";

interface PlaybackOverlaysProps {
	overlayRef: React.RefObject<HTMLDivElement>;
	focusIndicatorRef: React.RefObject<HTMLDivElement>;
	annotationRegions: AnnotationRegion[];
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	onAnnotationPositionChange?: (id: string, position: { x: number; y: number }) => void;
	onAnnotationSizeChange?: (id: string, size: { width: number; height: number }) => void;
	currentTime: number;
	webcamPath?: string | null;
	resolvedWebcamModel: ResolvedWebcamRenderModel | null;
	webcamPreviewRects: WebcamPreviewRects;
	webcamEffects: WebcamEffects;
	webcamPreviewMode: WebcamPreviewMode;
	isPlaying: boolean;
	isPreviewWebcamHeld: boolean;
	playbackRate: number;
	onWebcamHealthMetricsChange?: (metrics: WebcamHealthMetrics | null) => void;
	webcamSelected: boolean;
	selectedCameraLayoutId: string | null;
	onWebcamPositionChange?: (position: { x: number; y: number }) => void;
	onWebcamSizeChange?: (size: { width: number; height: number }) => void;
	onSelectWebcam?: () => void;
	captionRegions: CaptionRegion[];
	captionSettings?: CaptionSettings;
	isEditingCaptionPosition: boolean;
	onCaptionPositionOverrideChange?: (override: CaptionPositionOverride | null) => void;
	showKeyboardShortcuts: boolean;
	keyboardShortcutCallouts: KeyboardShortcutCallout[];
	keyboardShortcutPosition: KeyboardShortcutPosition;
	keyboardShortcutTheme: KeyboardShortcutTheme;
	keyboardShortcutScale: number;
	keyboardShortcutOpacity: number;
	keyboardShortcutMaxVisible: number;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
	onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
	onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function PlaybackOverlays({
	overlayRef,
	focusIndicatorRef,
	annotationRegions,
	selectedAnnotationId,
	onSelectAnnotation,
	onAnnotationPositionChange,
	onAnnotationSizeChange,
	currentTime,
	webcamPath,
	resolvedWebcamModel,
	webcamPreviewRects,
	webcamEffects,
	webcamPreviewMode,
	isPlaying,
	isPreviewWebcamHeld,
	playbackRate,
	onWebcamHealthMetricsChange,
	webcamSelected,
	selectedCameraLayoutId,
	onWebcamPositionChange,
	onWebcamSizeChange,
	onSelectWebcam,
	captionRegions,
	captionSettings,
	isEditingCaptionPosition,
	onCaptionPositionOverrideChange,
	showKeyboardShortcuts,
	keyboardShortcutCallouts,
	keyboardShortcutPosition,
	keyboardShortcutTheme,
	keyboardShortcutScale,
	keyboardShortcutOpacity,
	keyboardShortcutMaxVisible,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerLeave,
}: PlaybackOverlaysProps) {
	const overlayWidth = overlayRef.current?.clientWidth || 800;
	const overlayHeight = overlayRef.current?.clientHeight || 600;
	const timeMs = Math.round(currentTime * 1000);
	const visibleAnnotations = annotationRegions.filter((annotation) => {
		if (typeof annotation.startMs !== "number" || typeof annotation.endMs !== "number") {
			return false;
		}
		if (annotation.id === selectedAnnotationId) {
			return true;
		}
		return timeMs >= annotation.startMs && timeMs <= annotation.endMs;
	});
	const sortedAnnotations = [...visibleAnnotations].sort((a, b) => a.zIndex - b.zIndex);
	const handleAnnotationClick = (clickedId: string) => {
		if (!onSelectAnnotation) return;

		if (clickedId === selectedAnnotationId && sortedAnnotations.length > 1) {
			const currentIndex = sortedAnnotations.findIndex((annotation) => annotation.id === clickedId);
			const nextIndex = (currentIndex + 1) % sortedAnnotations.length;
			onSelectAnnotation(sortedAnnotations[nextIndex].id);
			return;
		}

		onSelectAnnotation(clickedId);
	};

	return (
		<div
			ref={overlayRef}
			className="absolute inset-0 select-none"
			style={{ pointerEvents: "none", zIndex: 4 }}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerLeave={onPointerLeave}
		>
			<div
				ref={focusIndicatorRef}
				className="absolute rounded-md border border-[#F59E0B]/80 bg-[#F59E0B]/20 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
				style={{ display: "none", pointerEvents: "none" }}
			/>
			{sortedAnnotations.map((annotation) => (
				<AnnotationOverlay
					key={annotation.id}
					annotation={annotation}
					isSelected={annotation.id === selectedAnnotationId}
					containerWidth={overlayWidth}
					containerHeight={overlayHeight}
					onPositionChange={(id, position) => onAnnotationPositionChange?.(id, position)}
					onSizeChange={(id, size) => onAnnotationSizeChange?.(id, size)}
					onClick={handleAnnotationClick}
					zIndex={annotation.zIndex}
					isSelectedBoost={annotation.id === selectedAnnotationId}
				/>
			))}
			{webcamPath && resolvedWebcamModel && resolvedWebcamModel.opacity > 0 && (
				<WebcamOverlay
					webcamPath={webcamPath}
					renderModel={resolvedWebcamModel}
					compositionRect={webcamPreviewRects.composition}
					webcamEffects={webcamEffects}
					webcamPreviewMode={webcamPreviewMode}
					currentTime={currentTime}
					isPlaying={isPlaying}
					isHeld={isPreviewWebcamHeld}
					playbackRate={playbackRate}
					onHealthMetricsChange={onWebcamHealthMetricsChange}
					isSelected={
						webcamSelected ||
						(selectedCameraLayoutId === resolvedWebcamModel.activeLayoutId &&
							resolvedWebcamModel.mode === "default")
					}
					onPositionChange={(position) => onWebcamPositionChange?.(position)}
					onSizeChange={(size) => onWebcamSizeChange?.(size)}
					onClick={() => onSelectWebcam?.()}
				/>
			)}
			{captionSettings && (
				<CaptionOverlay
					captionRegions={captionRegions}
					captionSettings={captionSettings}
					currentTimeMs={timeMs}
					containerWidth={overlayWidth}
					containerHeight={overlayHeight}
					isEditing={isEditingCaptionPosition}
					onPositionOverrideChange={onCaptionPositionOverrideChange}
				/>
			)}
			{showKeyboardShortcuts && (
				<KeyboardShortcutOverlay
					callouts={keyboardShortcutCallouts}
					position={keyboardShortcutPosition}
					theme={keyboardShortcutTheme}
					scale={keyboardShortcutScale}
					opacity={keyboardShortcutOpacity}
					maxVisible={keyboardShortcutMaxVisible}
					currentTimeMs={timeMs}
					containerWidth={overlayWidth}
				/>
			)}
		</div>
	);
}
