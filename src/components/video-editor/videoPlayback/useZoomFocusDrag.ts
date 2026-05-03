import type React from "react";
import { type MutableRefObject, type RefObject, useCallback } from "react";
import type { ZoomDepth, ZoomFocus, ZoomRegion } from "../types";
import { clamp01 } from "./mathUtils";

interface UseZoomFocusDragParams {
	overlayRef: RefObject<HTMLDivElement>;
	isPlayingRef: MutableRefObject<boolean>;
	isDraggingFocusRef: MutableRefObject<boolean>;
	selectedZoomIdRef: MutableRefObject<string | null>;
	zoomRegionsRef: MutableRefObject<ZoomRegion[]>;
	stageSizeRef: MutableRefObject<{ width: number; height: number }>;
	baseMaskRef: MutableRefObject<{ x: number; y: number; width: number; height: number }>;
	clampFocusToStage: (focus: ZoomFocus, depth: ZoomDepth) => ZoomFocus;
	onSelectZoom: (id: string | null) => void;
	onZoomFocusChange: (id: string, focus: ZoomFocus) => void;
	updateOverlayForRegion: (region: ZoomRegion, focus?: ZoomFocus) => void;
}

export function useZoomFocusDrag({
	overlayRef,
	isPlayingRef,
	isDraggingFocusRef,
	selectedZoomIdRef,
	zoomRegionsRef,
	stageSizeRef,
	baseMaskRef,
	clampFocusToStage,
	onSelectZoom,
	onZoomFocusChange,
	updateOverlayForRegion,
}: UseZoomFocusDragParams) {
	const updateFocusFromClientPoint = useCallback(
		(clientX: number, clientY: number) => {
			const overlayEl = overlayRef.current;
			if (!overlayEl) return;

			const regionId = selectedZoomIdRef.current;
			if (!regionId) return;

			const region = zoomRegionsRef.current.find((candidate) => candidate.id === regionId);
			if (!region) return;

			const rect = overlayEl.getBoundingClientRect();
			const stageWidth = rect.width;
			const stageHeight = rect.height;
			if (!stageWidth || !stageHeight) return;

			stageSizeRef.current = { width: stageWidth, height: stageHeight };

			const localX = clientX - rect.left;
			const localY = clientY - rect.top;
			const baseMask = baseMaskRef.current;
			const unclampedFocus: ZoomFocus = {
				cx: clamp01((localX - baseMask.x) / Math.max(1, baseMask.width)),
				cy: clamp01((localY - baseMask.y) / Math.max(1, baseMask.height)),
			};
			const clampedFocus = clampFocusToStage(unclampedFocus, region.depth);

			onZoomFocusChange(region.id, clampedFocus);
			updateOverlayForRegion({ ...region, focus: clampedFocus }, clampedFocus);
		},
		[
			baseMaskRef,
			clampFocusToStage,
			onZoomFocusChange,
			overlayRef,
			selectedZoomIdRef,
			stageSizeRef,
			updateOverlayForRegion,
			zoomRegionsRef,
		],
	);

	const endFocusDrag = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!isDraggingFocusRef.current) return;
			isDraggingFocusRef.current = false;
			try {
				event.currentTarget.releasePointerCapture(event.pointerId);
			} catch {
				// Pointer capture may already be released if the interaction was interrupted.
			}
		},
		[isDraggingFocusRef],
	);

	return {
		handleOverlayPointerDown: useCallback(
			(event: React.PointerEvent<HTMLDivElement>) => {
				if (isPlayingRef.current) return;
				const regionId = selectedZoomIdRef.current;
				if (!regionId) return;
				const region = zoomRegionsRef.current.find((candidate) => candidate.id === regionId);
				if (!region) return;
				onSelectZoom(region.id);
				event.preventDefault();
				isDraggingFocusRef.current = true;
				event.currentTarget.setPointerCapture(event.pointerId);
				updateFocusFromClientPoint(event.clientX, event.clientY);
			},
			[
				isDraggingFocusRef,
				isPlayingRef,
				onSelectZoom,
				selectedZoomIdRef,
				updateFocusFromClientPoint,
				zoomRegionsRef,
			],
		),
		handleOverlayPointerMove: useCallback(
			(event: React.PointerEvent<HTMLDivElement>) => {
				if (!isDraggingFocusRef.current) return;
				event.preventDefault();
				updateFocusFromClientPoint(event.clientX, event.clientY);
			},
			[isDraggingFocusRef, updateFocusFromClientPoint],
		),
		handleOverlayPointerUp: endFocusDrag,
		handleOverlayPointerLeave: endFocusDrag,
	};
}
