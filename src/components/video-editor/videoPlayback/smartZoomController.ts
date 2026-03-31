import {
	type CursorFollowTracking,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	ZOOM_DEPTH_SCALES,
	type ZoomFocus,
	type ZoomRegion,
} from "../types";
import type { CursorEvaluation } from "./cursorSimulation";
import { clampFocusToScale } from "./focusUtils";

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, progress: number) {
	return start + (end - start) * progress;
}

function mergeTrackingConfig(tracking?: Partial<CursorFollowTracking>): CursorFollowTracking {
	return {
		deadzone: clamp(tracking?.deadzone ?? DEFAULT_CURSOR_FOLLOW_TRACKING.deadzone, 0, 0.2),
		lookAheadMs: clamp(
			Math.round(tracking?.lookAheadMs ?? DEFAULT_CURSOR_FOLLOW_TRACKING.lookAheadMs),
			0,
			300,
		),
		maxPanPerSecond: clamp(
			tracking?.maxPanPerSecond ?? DEFAULT_CURSOR_FOLLOW_TRACKING.maxPanPerSecond,
			0.2,
			3,
		),
		dwellHoldMs: clamp(
			Math.round(tracking?.dwellHoldMs ?? DEFAULT_CURSOR_FOLLOW_TRACKING.dwellHoldMs),
			0,
			1000,
		),
		textHoldMs: clamp(
			Math.round(tracking?.textHoldMs ?? DEFAULT_CURSOR_FOLLOW_TRACKING.textHoldMs),
			0,
			1500,
		),
	};
}

function deriveIntentAwareTargetFocus(
	cursor: CursorEvaluation,
	currentFocus: ZoomFocus,
	tracking: CursorFollowTracking,
): {
	targetFocus: ZoomFocus;
	deadzone: number;
	maxPanPerSecond: number;
	hysteresisMultiplier: number;
	hold: boolean;
} {
	const lookAheadScale = tracking.lookAheadMs / 1000;
	const predictedFocus = {
		cx: cursor.cx + cursor.velocityX * lookAheadScale,
		cy: cursor.cy + cursor.velocityY * lookAheadScale,
	};

	let targetFocus = predictedFocus;
	let deadzone = tracking.deadzone;
	let maxPanPerSecond = tracking.maxPanPerSecond;
	let hysteresisMultiplier = cursor.isDwell ? 1.75 : 1;
	let hold = false;

	switch (cursor.intent) {
		case "typing":
			hold = true;
			break;
		case "reading":
			targetFocus = {
				cx: lerp(currentFocus.cx, cursor.cx, 0.18),
				cy: lerp(currentFocus.cy, cursor.cy, 0.18),
			};
			deadzone *= 2.1;
			maxPanPerSecond *= 0.5;
			hysteresisMultiplier = 2.6;
			break;
		case "dropdown":
			targetFocus = {
				cx: lerp(currentFocus.cx, predictedFocus.cx, 0.42),
				cy: lerp(currentFocus.cy, predictedFocus.cy, 0.72),
			};
			deadzone *= 1.55;
			maxPanPerSecond *= 0.62;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 2.2);
			break;
		case "dragging":
			targetFocus = {
				cx: lerp(currentFocus.cx, cursor.cx, 0.38),
				cy: lerp(currentFocus.cy, cursor.cy, 0.38),
			};
			deadzone *= 1.2;
			maxPanPerSecond *= 0.7;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 1.9);
			break;
		case "selecting":
			targetFocus = {
				cx: lerp(currentFocus.cx, cursor.cx, 0.28),
				cy: lerp(currentFocus.cy, cursor.cy, 0.28),
			};
			deadzone *= 1.7;
			maxPanPerSecond *= 0.45;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 2.4);
			break;
		case "precision":
			targetFocus = {
				cx: lerp(currentFocus.cx, predictedFocus.cx, 0.55),
				cy: lerp(currentFocus.cy, predictedFocus.cy, 0.55),
			};
			deadzone *= 0.58;
			maxPanPerSecond *= 0.82;
			break;
		case "targeting":
			targetFocus = {
				cx: lerp(cursor.cx, predictedFocus.cx, 0.72),
				cy: lerp(cursor.cy, predictedFocus.cy, 0.72),
			};
			deadzone *= 0.68;
			maxPanPerSecond *= 1.18;
			break;
		case "idle":
		default:
			break;
	}

	return {
		targetFocus,
		deadzone,
		maxPanPerSecond,
		hysteresisMultiplier,
		hold,
	};
}

export function resolveZoomRegionFocus(
	region: ZoomRegion,
	cursor: CursorEvaluation | null,
	currentFocus: ZoomFocus,
	deltaSeconds: number,
): ZoomFocus {
	const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
	const staticFocus = clampFocusToScale(region.focus, zoomScale);
	if (region.mode !== "cursor-follow" || !cursor) {
		return staticFocus;
	}

	const tracking = mergeTrackingConfig(region.tracking);
	const holdForRecentInteraction =
		cursor.latestInteractionAgeMs <= tracking.dwellHoldMs &&
		(cursor.latestInteractionType === "click" ||
			cursor.latestInteractionType === "double-click" ||
			cursor.latestInteractionType === "right-click" ||
			cursor.latestInteractionType === "middle-click");
	const holdForText =
		(cursor.intent === "typing" || cursor.isTextInput) &&
		cursor.latestInteractionAgeMs <= tracking.textHoldMs;
	const intentAdjusted = deriveIntentAwareTargetFocus(cursor, currentFocus, tracking);
	if (
		holdForRecentInteraction ||
		holdForText ||
		intentAdjusted.hold ||
		cursor.confidence === "low"
	) {
		return clampFocusToScale(currentFocus, zoomScale);
	}

	const predictedFocus = clampFocusToScale(intentAdjusted.targetFocus, zoomScale);
	const deltaX = predictedFocus.cx - currentFocus.cx;
	const deltaY = predictedFocus.cy - currentFocus.cy;
	const distance = Math.hypot(deltaX, deltaY);
	if (
		distance <= intentAdjusted.deadzone ||
		(cursor.isDwell && distance <= intentAdjusted.deadzone * intentAdjusted.hysteresisMultiplier)
	) {
		return clampFocusToScale(currentFocus, zoomScale);
	}

	if (deltaSeconds <= 0) {
		return predictedFocus;
	}

	const maxStep = intentAdjusted.maxPanPerSecond * deltaSeconds;
	if (distance <= maxStep) {
		return predictedFocus;
	}

	const ratio = maxStep / distance;
	return clampFocusToScale(
		{
			cx: currentFocus.cx + deltaX * ratio,
			cy: currentFocus.cy + deltaY * ratio,
		},
		zoomScale,
	);
}
