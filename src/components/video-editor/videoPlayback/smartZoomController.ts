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
const FOLLOW_SAFE_BOX_VISIBLE_RATIO = 0.62;
const FOLLOW_SAFE_BOX_EDGE_TOLERANCE = 0.006;

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
	tracking: CursorFollowTracking,
): {
	targetFocus: ZoomFocus;
	hold: boolean;
	smoothTimeFactor: number;
} {
	const lookAheadScale = tracking.lookAheadMs / 1000;
	const canUseLookAhead =
		cursor.intent === "targeting" ||
		cursor.intent === "dragging" ||
		cursor.intent === "selecting" ||
		cursor.intent === "precision";
	const shouldLead =
		canUseLookAhead &&
		cursor.confidence !== "low" &&
		!cursor.isDiscontinuous &&
		cursor.speed >= PREDICTION_SPEED_THRESHOLD;
	const predictedFocus = {
		cx: shouldLead ? cursor.cx + cursor.velocityX * lookAheadScale : cursor.cx,
		cy: shouldLead ? cursor.cy + cursor.velocityY * lookAheadScale : cursor.cy,
	};

	let targetFocus = predictedFocus;
	let hold = false;
	let smoothTimeFactor = 1.0;

	switch (cursor.intent) {
		case "typing":
			hold = true;
			smoothTimeFactor = 1.0;
			break;
		case "reading":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			smoothTimeFactor = 3.2;
			break;
		case "dropdown":
			targetFocus = predictedFocus;
			smoothTimeFactor = 2.0;
			break;
		case "dragging":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			smoothTimeFactor = 1.8;
			break;
		case "selecting":
			targetFocus = { cx: cursor.cx, cy: cursor.cy };
			smoothTimeFactor = 2.5;
			break;
		case "precision":
			targetFocus = predictedFocus;
			smoothTimeFactor = 0.7;
			break;
		case "targeting":
			targetFocus = predictedFocus;
			smoothTimeFactor = 0.6;
			break;
		case "idle":
		default:
			break;
	}

	return {
		targetFocus,
		hold,
		smoothTimeFactor,
	};
}

export function resolveViewportContainedFocus(args: {
	currentFocus: ZoomFocus;
	cursorFocus: ZoomFocus;
	zoomScale: number;
	visibleSafeRatio?: number;
	edgeTolerance?: number;
}): ZoomFocus {
	const {
		cursorFocus,
		zoomScale,
		visibleSafeRatio = FOLLOW_SAFE_BOX_VISIBLE_RATIO,
		edgeTolerance = FOLLOW_SAFE_BOX_EDGE_TOLERANCE,
	} = args;
	const currentFocus = clampFocusToScale(args.currentFocus, zoomScale);
	const halfWidth = 1 / (2 * zoomScale);
	const halfHeight = 1 / (2 * zoomScale);
	const safeRatio = clamp(visibleSafeRatio, 0.2, 0.95);
	const safeInsetX = halfWidth * (1 - safeRatio);
	const safeInsetY = halfHeight * (1 - safeRatio);
	const safeLeft = currentFocus.cx - halfWidth + safeInsetX;
	const safeRight = currentFocus.cx + halfWidth - safeInsetX;
	const safeTop = currentFocus.cy - halfHeight + safeInsetY;
	const safeBottom = currentFocus.cy + halfHeight - safeInsetY;
	let nextFocus = currentFocus;

	if (cursorFocus.cx < safeLeft - edgeTolerance) {
		nextFocus = {
			...nextFocus,
			cx: cursorFocus.cx + halfWidth - safeInsetX,
		};
	} else if (cursorFocus.cx > safeRight + edgeTolerance) {
		nextFocus = {
			...nextFocus,
			cx: cursorFocus.cx - halfWidth + safeInsetX,
		};
	}

	if (cursorFocus.cy < safeTop - edgeTolerance) {
		nextFocus = {
			...nextFocus,
			cy: cursorFocus.cy + halfHeight - safeInsetY,
		};
	} else if (cursorFocus.cy > safeBottom + edgeTolerance) {
		nextFocus = {
			...nextFocus,
			cy: cursorFocus.cy - halfHeight + safeInsetY,
		};
	}

	return softenFocusToScale(nextFocus, zoomScale);
}

export function resolveZoomRegionFocus(
	region: ZoomRegion,
	cursor: CursorMotionSnapshot | null,
	currentFocus: ZoomFocus,
	_deltaSeconds: number,
): ZoomRegionFocusResult {
	const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
	const staticFocus = softenFocusToScale(region.focus, zoomScale);
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

	const intentAdjusted = deriveIntentAwareTargetFocus(cursor, tracking);
	if (intentAdjusted.hold || cursor.confidence === "low") {
		return {
			focus: softenFocusToScale(currentFocus, zoomScale),
			smoothTimeFactor: intentAdjusted.smoothTimeFactor,
		};
	}

	return {
		focus: resolveViewportContainedFocus({
			currentFocus,
			cursorFocus: intentAdjusted.targetFocus,
			zoomScale,
		}),
		smoothTimeFactor: intentAdjusted.smoothTimeFactor,
	};
}
