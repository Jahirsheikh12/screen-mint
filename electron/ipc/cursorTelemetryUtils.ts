export interface CursorTelemetryBoundsLike {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type CursorCapturePlatform = "darwin" | "win32" | "linux";
export type CursorTelemetryGeometrySource =
	| "electron-display"
	| "selected-area"
	| "win32-window"
	| "x11-window"
	| "macos-window"
	| "fallback-display";
export type CursorProjectionConfidence = "high" | "medium" | "low";

export interface CursorTelemetryDisplayLike {
	id: number;
	bounds: CursorTelemetryBoundsLike;
	scaleFactor: number;
}

export interface CursorTelemetryPointLike {
	x: number;
	y: number;
}

export interface CursorMoveSampleCandidate {
	timeMs: number;
	cx: number;
	cy: number;
	rawX?: number;
	rawY?: number;
	sourceBounds?: CursorTelemetryBoundsLike;
	displayBounds?: CursorTelemetryBoundsLike;
	sourceDisplayId?: number;
	displayScaleFactor?: number;
	captureMode?: "display" | "window" | "area";
	capturePlatform?: CursorCapturePlatform;
	geometrySource?: CursorTelemetryGeometrySource;
	projectionConfidence?: CursorProjectionConfidence;
}

export interface CursorMoveSamplePolicy {
	minIntervalMs: number;
	minDistance: number;
	heartbeatIntervalMs?: number;
}

function boundsEqual(left?: CursorTelemetryBoundsLike, right?: CursorTelemetryBoundsLike) {
	if (!left && !right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	);
}

export function hasCursorGeometryChange(
	previous: CursorMoveSampleCandidate | null | undefined,
	next: CursorMoveSampleCandidate,
) {
	if (!previous) {
		return true;
	}

	return (
		!boundsEqual(previous.sourceBounds, next.sourceBounds) ||
		!boundsEqual(previous.displayBounds, next.displayBounds) ||
		previous.sourceDisplayId !== next.sourceDisplayId ||
		previous.displayScaleFactor !== next.displayScaleFactor ||
		previous.captureMode !== next.captureMode ||
		previous.capturePlatform !== next.capturePlatform ||
		previous.geometrySource !== next.geometrySource ||
		previous.projectionConfidence !== next.projectionConfidence
	);
}

export function shouldRecordCursorMoveSample(
	previous: CursorMoveSampleCandidate | null | undefined,
	next: CursorMoveSampleCandidate,
	policy: CursorMoveSamplePolicy,
) {
	if (!previous) {
		return true;
	}

	if (next.timeMs < previous.timeMs) {
		return true;
	}

	if (hasCursorGeometryChange(previous, next)) {
		return true;
	}

	const distance = Math.hypot(next.cx - previous.cx, next.cy - previous.cy);
	if (distance >= policy.minDistance) {
		return true;
	}

	const elapsedMs = next.timeMs - previous.timeMs;
	if (typeof policy.heartbeatIntervalMs === "number" && policy.heartbeatIntervalMs > 0) {
		return elapsedMs >= policy.heartbeatIntervalMs;
	}

	return elapsedMs >= policy.minIntervalMs;
}

function getDisplayPhysicalBounds(display: CursorTelemetryDisplayLike) {
	const scaleFactor =
		Number.isFinite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : 1;

	return {
		x: display.bounds.x * scaleFactor,
		y: display.bounds.y * scaleFactor,
		width: display.bounds.width * scaleFactor,
		height: display.bounds.height * scaleFactor,
		scaleFactor,
	};
}

function containsPoint(bounds: CursorTelemetryBoundsLike, point: CursorTelemetryPointLike) {
	return (
		point.x >= bounds.x &&
		point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y <= bounds.y + bounds.height
	);
}

function squaredDistanceToBoundsCenter(
	bounds: CursorTelemetryBoundsLike,
	point: CursorTelemetryPointLike,
) {
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	return (centerX - point.x) ** 2 + (centerY - point.y) ** 2;
}

function findDisplayForPhysicalPoint(
	displays: CursorTelemetryDisplayLike[],
	point: CursorTelemetryPointLike,
) {
	const withPhysicalBounds = displays.map((display) => ({
		display,
		physicalBounds: getDisplayPhysicalBounds(display),
	}));
	return (
		withPhysicalBounds.find((entry) => containsPoint(entry.physicalBounds, point)) ??
		withPhysicalBounds.sort(
			(left, right) =>
				squaredDistanceToBoundsCenter(left.physicalBounds, point) -
				squaredDistanceToBoundsCenter(right.physicalBounds, point),
		)[0] ??
		null
	);
}

export function physicalPointToDip(
	point: CursorTelemetryPointLike,
	displays: CursorTelemetryDisplayLike[],
): CursorTelemetryPointLike {
	const match = findDisplayForPhysicalPoint(displays, point);
	if (!match) {
		return point;
	}

	const { display, physicalBounds } = match;
	return {
		x: display.bounds.x + (point.x - physicalBounds.x) / physicalBounds.scaleFactor,
		y: display.bounds.y + (point.y - physicalBounds.y) / physicalBounds.scaleFactor,
	};
}

export function physicalBoundsToDip(
	bounds: CursorTelemetryBoundsLike,
	displays: CursorTelemetryDisplayLike[],
): CursorTelemetryBoundsLike {
	const center = {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2,
	};
	const match = findDisplayForPhysicalPoint(displays, center);
	if (!match) {
		return bounds;
	}

	const { display, physicalBounds } = match;
	return {
		x: display.bounds.x + (bounds.x - physicalBounds.x) / physicalBounds.scaleFactor,
		y: display.bounds.y + (bounds.y - physicalBounds.y) / physicalBounds.scaleFactor,
		width: bounds.width / physicalBounds.scaleFactor,
		height: bounds.height / physicalBounds.scaleFactor,
	};
}
