import {
	type CursorFollowTracking,
	DEFAULT_CURSOR_FOLLOW_TRACKING,
	ZOOM_DEPTH_SCALES,
	type ZoomFocus,
	type ZoomRegion,
} from "../types";
import type { CursorMotionSnapshot } from "./cursorSimulation";
import { clampFocusToScale, softenFocusToScale } from "./focusUtils";

export interface ZoomRegionFocusResult {
	focus: ZoomFocus;
	smoothTimeFactor: number;
}

const PREDICTION_SPEED_THRESHOLD = 0.16;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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
	cursor: CursorMotionSnapshot,
	_currentFocus: ZoomFocus,
	tracking: CursorFollowTracking,
): {
	targetFocus: ZoomFocus;
	deadzone: number;
	hysteresisMultiplier: number;
	hold: boolean;
	smoothTimeFactor: number;
} {
	const lookAheadScale = tracking.lookAheadMs / 1000;
	const shouldLead =
		cursor.confidence !== "low" && !cursor.isDiscontinuous && cursor.speed >= PREDICTION_SPEED_THRESHOLD;
	const predictedFocus = {
		cx: shouldLead ? cursor.cx + cursor.velocityX * lookAheadScale : cursor.cx,
		cy: shouldLead ? cursor.cy + cursor.velocityY * lookAheadScale : cursor.cy,
	};

	let targetFocus = predictedFocus;
	let deadzone = tracking.deadzone;
	let hysteresisMultiplier = cursor.isDwell ? 1.75 : 1;
	let hold = false;
	let smoothTimeFactor = 1.0;

	switch (cursor.intent) {
		case "typing":
			hold = true;
			smoothTimeFactor = 1.0;
			break;
		case "reading":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			deadzone *= 2.1;
			hysteresisMultiplier = 2.6;
			smoothTimeFactor = 3.2;
			break;
		case "dropdown":
			targetFocus = predictedFocus;
			deadzone *= 1.55;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 2.2);
			smoothTimeFactor = 2.0;
			break;
		case "dragging":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			deadzone *= 1.2;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 1.9);
			smoothTimeFactor = 1.8;
			break;
		case "selecting":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			deadzone *= 1.7;
			hysteresisMultiplier = Math.max(hysteresisMultiplier, 2.4);
			smoothTimeFactor = 2.5;
			break;
		case "precision":
			targetFocus = predictedFocus;
			deadzone *= 0.44;
			smoothTimeFactor = 0.7;
			break;
		case "targeting":
			targetFocus = predictedFocus;
			deadzone *= 0.52;
			smoothTimeFactor = 0.6;
			break;
		case "idle":
		default:
			break;
	}

	return {
		targetFocus,
		deadzone,
		hysteresisMultiplier,
		hold,
		smoothTimeFactor,
	};
}

export function resolveZoomRegionFocus(
	region: ZoomRegion,
	cursor: CursorMotionSnapshot | null,
	currentFocus: ZoomFocus,
	_deltaSeconds: number,
): ZoomRegionFocusResult {
	const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
	const staticFocus = clampFocusToScale(region.focus, zoomScale);
	if (region.mode !== "cursor-follow" || !cursor) {
		return { focus: staticFocus, smoothTimeFactor: 1.0 };
	}

	const tracking = mergeTrackingConfig(region.tracking);
	if (cursor.isDiscontinuous) {
		return {
			focus: softenFocusToScale({ cx: cursor.cx, cy: cursor.cy }, zoomScale),
			smoothTimeFactor: 1.0,
		};
	}

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
		return {
			focus: softenFocusToScale(currentFocus, zoomScale),
			smoothTimeFactor: intentAdjusted.smoothTimeFactor,
		};
	}

	const targetFocus = softenFocusToScale(intentAdjusted.targetFocus, zoomScale);
	const deltaX = targetFocus.cx - currentFocus.cx;
	const deltaY = targetFocus.cy - currentFocus.cy;
	const distance = Math.hypot(deltaX, deltaY);
	if (
		distance <= intentAdjusted.deadzone ||
		(cursor.isDwell && distance <= intentAdjusted.deadzone * intentAdjusted.hysteresisMultiplier)
	) {
		return {
			focus: softenFocusToScale(currentFocus, zoomScale),
			smoothTimeFactor: intentAdjusted.smoothTimeFactor,
		};
	}

	return {
		focus: targetFocus,
		smoothTimeFactor: intentAdjusted.smoothTimeFactor,
	};
}
