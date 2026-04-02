export interface CursorTelemetryBoundsLike {
	x: number;
	y: number;
	width: number;
	height: number;
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
}

export interface CursorMoveSamplePolicy {
	minIntervalMs: number;
	minDistance: number;
	heartbeatIntervalMs?: number;
}

function boundsEqual(
	left?: CursorTelemetryBoundsLike,
	right?: CursorTelemetryBoundsLike,
) {
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
		previous.captureMode !== next.captureMode
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
	if (
		typeof policy.heartbeatIntervalMs === "number" &&
		policy.heartbeatIntervalMs > 0
	) {
		return elapsedMs >= policy.heartbeatIntervalMs;
	}

	return elapsedMs >= policy.minIntervalMs;
}
