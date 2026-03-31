import type {
	CursorInteractionType,
	CursorTelemetryConfidence,
	CursorTelemetryPoint,
	CursorType,
} from "../types";

const SIMULATION_SAMPLE_MS = 1000 / 60;
const GAP_FILL_LIMIT_MS = 180;
const TELEPORT_DISTANCE_THRESHOLD = 0.55;
const TELEPORT_TIME_THRESHOLD_MS = 50;
const DWELL_SPEED_THRESHOLD = 0.35;
const RECENT_MOTION_WINDOW_MS = 420;
const TARGETING_HOLD_MS = 220;
const DROPDOWN_DETECTION_WINDOW_MS = 700;
const MIN_CUTOFF = 1.15;
const DERIVATIVE_CUTOFF = 1.4;
const FILTER_BETA = 0.24;

export type CursorIntent =
	| "idle"
	| "targeting"
	| "typing"
	| "reading"
	| "dropdown"
	| "dragging"
	| "selecting"
	| "precision";

export interface CursorSimulationFrame {
	timeMs: number;
	cx: number;
	cy: number;
	velocityX: number;
	velocityY: number;
	heading: number;
	confidence: CursorTelemetryConfidence;
}

export interface CursorSimulationPath {
	frames: CursorSimulationFrame[];
	samples: CursorTelemetryPoint[];
	durationMs: number;
}

export interface CursorEvaluation {
	timeMs: number;
	cx: number;
	cy: number;
	predictedCx: number;
	predictedCy: number;
	velocityX: number;
	velocityY: number;
	heading: number;
	cursorType: CursorType;
	latestInteractionType?: CursorInteractionType;
	latestInteractionAgeMs: number;
	isDragging: boolean;
	isDwell: boolean;
	isTextInput: boolean;
	intent: CursorIntent;
	confidence: CursorTelemetryConfidence;
}

type OneEuroAxisState = {
	filtered: number;
	filteredDerivative: number;
	raw: number;
	initialized: boolean;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
	return clamp(value, 0, 1);
}

function alpha(cutoff: number, deltaSeconds: number) {
	const tau = 1 / (2 * Math.PI * Math.max(0.0001, cutoff));
	return 1 / (1 + tau / Math.max(1 / 240, deltaSeconds));
}

function lowPass(previous: number, current: number, smoothing: number) {
	return smoothing * current + (1 - smoothing) * previous;
}

function stepOneEuroAxis(state: OneEuroAxisState, rawValue: number, deltaSeconds: number) {
	if (!state.initialized) {
		state.filtered = rawValue;
		state.filteredDerivative = 0;
		state.raw = rawValue;
		state.initialized = true;
		return rawValue;
	}

	const rawDerivative = (rawValue - state.raw) / Math.max(1 / 240, deltaSeconds);
	state.raw = rawValue;
	state.filteredDerivative = lowPass(
		state.filteredDerivative,
		rawDerivative,
		alpha(DERIVATIVE_CUTOFF, deltaSeconds),
	);
	const cutoff = MIN_CUTOFF + FILTER_BETA * Math.abs(state.filteredDerivative);
	state.filtered = lowPass(state.filtered, rawValue, alpha(cutoff, deltaSeconds));
	return state.filtered;
}

function mergeSamplesAtSameTimestamp(
	current: CursorTelemetryPoint,
	next: CursorTelemetryPoint,
): CursorTelemetryPoint {
	return {
		...current,
		...next,
		timeMs: current.timeMs,
		cx: next.cx,
		cy: next.cy,
		rawX: next.rawX ?? current.rawX,
		rawY: next.rawY ?? current.rawY,
		origin: next.origin ?? current.origin,
		confidence: next.confidence ?? current.confidence,
		sourceBounds: next.sourceBounds ?? current.sourceBounds,
		displayBounds: next.displayBounds ?? current.displayBounds,
		sourceDisplayId: next.sourceDisplayId ?? current.sourceDisplayId,
		displayScaleFactor: next.displayScaleFactor ?? current.displayScaleFactor,
		captureMode: next.captureMode ?? current.captureMode,
		velocityX: next.velocityX ?? current.velocityX,
		velocityY: next.velocityY ?? current.velocityY,
		heading: next.heading ?? current.heading,
	};
}

function hasTelemetryBounds(
	bounds: CursorTelemetryPoint["sourceBounds"] | CursorTelemetryPoint["displayBounds"],
) {
	return Boolean(
		bounds &&
			Number.isFinite(bounds.x) &&
			Number.isFinite(bounds.y) &&
			Number.isFinite(bounds.width) &&
			Number.isFinite(bounds.height) &&
			bounds.width > 0 &&
			bounds.height > 0,
	);
}

function reprojectTelemetrySample(sample: CursorTelemetryPoint): CursorTelemetryPoint {
	const bounds = sample.sourceBounds;
	if (
		!bounds ||
		typeof sample.rawX !== "number" ||
		!Number.isFinite(sample.rawX) ||
		typeof sample.rawY !== "number" ||
		!Number.isFinite(sample.rawY) ||
		!hasTelemetryBounds(bounds)
	) {
		return sample;
	}

	return {
		...sample,
		cx: (sample.rawX - bounds.x) / bounds.width,
		cy: (sample.rawY - bounds.y) / bounds.height,
	};
}

function normalizeSimulationSamples(samples: CursorTelemetryPoint[], durationMs: number) {
	const normalized = [...samples]
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) && Number.isFinite(sample.cx) && Number.isFinite(sample.cy),
		)
		.map((sample) => reprojectTelemetrySample(sample))
		.map((sample) => ({
			...sample,
			timeMs: clamp(Math.round(sample.timeMs), 0, durationMs),
			cx: clamp01(sample.cx),
			cy: clamp01(sample.cy),
		}))
		.sort((left, right) => left.timeMs - right.timeMs);

	if (normalized.length <= 1) {
		return normalized;
	}

	const deduped: CursorTelemetryPoint[] = [];
	for (const sample of normalized) {
		const previous = deduped[deduped.length - 1];
		if (previous && previous.timeMs === sample.timeMs) {
			deduped[deduped.length - 1] = mergeSamplesAtSameTimestamp(previous, sample);
			continue;
		}
		deduped.push(sample);
	}

	return deduped;
}

function interpolateRawCursorPosition(samples: CursorTelemetryPoint[], timeMs: number) {
	if (samples.length === 0) {
		return null;
	}

	if (timeMs <= samples[0].timeMs) {
		return { cx: samples[0].cx, cy: samples[0].cy, confidence: samples[0].confidence ?? "high" };
	}

	const lastSample = samples[samples.length - 1];
	if (timeMs >= lastSample.timeMs) {
		return {
			cx: lastSample.cx,
			cy: lastSample.cy,
			confidence: lastSample.confidence ?? "medium",
		};
	}

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi - 1) {
		const mid = (lo + hi) >> 1;
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	const start = samples[lo];
	const end = samples[hi];
	const span = Math.max(1, end.timeMs - start.timeMs);
	const distance = Math.hypot(end.cx - start.cx, end.cy - start.cy);

	if (
		(span > GAP_FILL_LIMIT_MS && timeMs < end.timeMs) ||
		(distance > TELEPORT_DISTANCE_THRESHOLD && span <= TELEPORT_TIME_THRESHOLD_MS)
	) {
		return {
			cx: start.cx,
			cy: start.cy,
			confidence: "low" as const,
		};
	}

	const progress = (timeMs - start.timeMs) / span;
	return {
		cx: start.cx + (end.cx - start.cx) * progress,
		cy: start.cy + (end.cy - start.cy) * progress,
		confidence:
			start.confidence === "low" || end.confidence === "low"
				? ("low" as const)
				: (end.confidence ?? start.confidence ?? "high"),
	};
}

function findLatestSample(samples: CursorTelemetryPoint[], timeMs: number) {
	if (samples.length === 0) {
		return null;
	}

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return samples[lo]?.timeMs <= timeMs ? samples[lo] : null;
}

export function findLatestInteractionSample(samples: CursorTelemetryPoint[], timeMs: number) {
	for (let index = samples.length - 1; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs || !sample.interactionType) {
			continue;
		}

		if (sample.interactionType === "move") {
			continue;
		}

		return sample;
	}

	return null;
}

export function findLatestStableCursorType(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): CursorType {
	for (let index = samples.length - 1; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs || !sample.cursorType) {
			continue;
		}

		if (
			sample.interactionType === "click" ||
			sample.interactionType === "double-click" ||
			sample.interactionType === "right-click" ||
			sample.interactionType === "middle-click"
		) {
			continue;
		}

		return sample.cursorType;
	}

	return findLatestSample(samples, timeMs)?.cursorType ?? "arrow";
}

function isDraggingAtTime(samples: CursorTelemetryPoint[], timeMs: number) {
	let dragging = false;
	for (const sample of samples) {
		if (sample.timeMs > timeMs) {
			break;
		}

		if (
			sample.interactionType === "mousedown" ||
			sample.interactionType === "drag-start" ||
			sample.interactionType === "drag"
		) {
			dragging = true;
			continue;
		}

		if (
			sample.interactionType === "mouseup" ||
			sample.interactionType === "drag-end" ||
			sample.interactionType === "click" ||
			sample.interactionType === "double-click" ||
			sample.interactionType === "right-click" ||
			sample.interactionType === "middle-click"
		) {
			dragging = false;
		}
	}

	return dragging;
}

function findFrameIndexAtOrBefore(frames: CursorSimulationFrame[], timeMs: number) {
	let lo = 0;
	let hi = frames.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (frames[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return frames[lo]?.timeMs <= timeMs ? lo : 0;
}

function getRecentMotionVector(frames: CursorSimulationFrame[], timeMs: number, windowMs: number) {
	if (frames.length === 0) {
		return { dx: 0, dy: 0 };
	}

	const endIndex = findFrameIndexAtOrBefore(frames, timeMs);
	const windowStartTime = Math.max(0, timeMs - windowMs);
	let startIndex = endIndex;

	while (startIndex > 0 && frames[startIndex - 1].timeMs >= windowStartTime) {
		startIndex -= 1;
	}

	return {
		dx: frames[endIndex].cx - frames[startIndex].cx,
		dy: frames[endIndex].cy - frames[startIndex].cy,
	};
}

function classifyCursorIntent(args: {
	frames: CursorSimulationFrame[];
	samples: CursorTelemetryPoint[];
	timeMs: number;
	cursorType: CursorType;
	isDragging: boolean;
	isDwell: boolean;
	latestInteractionType?: CursorInteractionType;
	latestInteractionAgeMs: number;
	confidence: CursorTelemetryConfidence;
}) {
	const {
		frames,
		samples,
		timeMs,
		cursorType,
		isDragging,
		isDwell,
		latestInteractionType,
		latestInteractionAgeMs,
		confidence,
	} = args;

	if (confidence === "low") {
		return "idle" as const;
	}

	if (cursorType === "crosshair" || cursorType === "resize-ew" || cursorType === "resize-ns") {
		return "precision" as const;
	}

	if (isDragging) {
		return cursorType === "text" ? ("selecting" as const) : ("dragging" as const);
	}

	const dropdownMotion = getRecentMotionVector(frames, timeMs, DROPDOWN_DETECTION_WINDOW_MS);
	const recentSample = findLatestSample(samples, timeMs);
	const recentVelocity = recentSample?.velocityY ?? 0;
	const hasRecentClick =
		latestInteractionAgeMs <= DROPDOWN_DETECTION_WINDOW_MS &&
		(latestInteractionType === "click" ||
			latestInteractionType === "double-click" ||
			latestInteractionType === "right-click");

	if (
		hasRecentClick &&
		dropdownMotion.dy > Math.abs(dropdownMotion.dx) * 1.2 &&
		(dropdownMotion.dy > 0.05 || recentVelocity > 0.18)
	) {
		return "dropdown" as const;
	}

	if (cursorType === "text") {
		if (
			isDwell ||
			(latestInteractionAgeMs <= 650 &&
				(latestInteractionType === "click" || latestInteractionType === "double-click"))
		) {
			return "typing" as const;
		}

		return "reading" as const;
	}

	if (
		latestInteractionAgeMs <= TARGETING_HOLD_MS &&
		(latestInteractionType === "click" ||
			latestInteractionType === "double-click" ||
			latestInteractionType === "right-click" ||
			latestInteractionType === "middle-click")
	) {
		return "targeting" as const;
	}

	const recentMotion = getRecentMotionVector(frames, timeMs, RECENT_MOTION_WINDOW_MS);
	if (isDwell && Math.hypot(recentMotion.dx, recentMotion.dy) < 0.015) {
		return "reading" as const;
	}

	return "idle" as const;
}

export function buildCursorSimulationPath(
	samples: CursorTelemetryPoint[],
	durationMs: number,
): CursorSimulationPath {
	const normalizedSamples = normalizeSimulationSamples(
		samples,
		Math.max(0, Math.round(durationMs)),
	);
	if (normalizedSamples.length === 0) {
		return { frames: [], samples: [], durationMs: Math.max(0, Math.round(durationMs)) };
	}

	const axisX: OneEuroAxisState = {
		filtered: normalizedSamples[0].cx,
		filteredDerivative: 0,
		raw: normalizedSamples[0].cx,
		initialized: false,
	};
	const axisY: OneEuroAxisState = {
		filtered: normalizedSamples[0].cy,
		filteredDerivative: 0,
		raw: normalizedSamples[0].cy,
		initialized: false,
	};

	const finalDurationMs = Math.max(
		Math.round(durationMs),
		normalizedSamples[normalizedSamples.length - 1]?.timeMs ?? 0,
	);
	const frames: CursorSimulationFrame[] = [];
	let previousFrame: CursorSimulationFrame | null = null;

	for (let timeMs = 0; timeMs <= finalDurationMs; timeMs += SIMULATION_SAMPLE_MS) {
		const rawPoint = interpolateRawCursorPosition(normalizedSamples, timeMs);
		if (!rawPoint) {
			continue;
		}

		const deltaSeconds = previousFrame
			? Math.max(1 / 240, (timeMs - previousFrame.timeMs) / 1000)
			: 1 / 60;
		const filteredX =
			rawPoint.confidence === "low" && previousFrame
				? previousFrame.cx
				: stepOneEuroAxis(axisX, rawPoint.cx, deltaSeconds);
		const filteredY =
			rawPoint.confidence === "low" && previousFrame
				? previousFrame.cy
				: stepOneEuroAxis(axisY, rawPoint.cy, deltaSeconds);
		const velocityX =
			rawPoint.confidence === "low"
				? 0
				: previousFrame
					? (filteredX - previousFrame.cx) / deltaSeconds
					: 0;
		const velocityY =
			rawPoint.confidence === "low"
				? 0
				: previousFrame
					? (filteredY - previousFrame.cy) / deltaSeconds
					: 0;
		const heading = Math.atan2(velocityY, velocityX);

		const frame: CursorSimulationFrame = {
			timeMs: Math.min(finalDurationMs, Math.round(timeMs * 1000) / 1000),
			cx: clamp01(filteredX),
			cy: clamp01(filteredY),
			velocityX,
			velocityY,
			heading: Number.isFinite(heading) ? heading : 0,
			confidence: rawPoint.confidence,
		};
		frames.push(frame);
		previousFrame = frame;
	}

	if (frames[frames.length - 1]?.timeMs !== finalDurationMs) {
		const lastRawPoint = interpolateRawCursorPosition(normalizedSamples, finalDurationMs) ?? {
			cx: normalizedSamples[normalizedSamples.length - 1].cx,
			cy: normalizedSamples[normalizedSamples.length - 1].cy,
			confidence: normalizedSamples[normalizedSamples.length - 1].confidence ?? ("medium" as const),
		};
		frames.push({
			timeMs: finalDurationMs,
			cx: clamp01(lastRawPoint.cx),
			cy: clamp01(lastRawPoint.cy),
			velocityX: previousFrame?.velocityX ?? 0,
			velocityY: previousFrame?.velocityY ?? 0,
			heading: previousFrame?.heading ?? 0,
			confidence: lastRawPoint.confidence,
		});
	}

	return {
		frames,
		samples: normalizedSamples,
		durationMs: finalDurationMs,
	};
}

function interpolateFrame(frames: CursorSimulationFrame[], timeMs: number) {
	if (frames.length === 0) {
		return null;
	}

	if (timeMs <= frames[0].timeMs) {
		return frames[0];
	}

	const lastFrame = frames[frames.length - 1];
	if (timeMs >= lastFrame.timeMs) {
		return lastFrame;
	}

	let lo = 0;
	let hi = frames.length - 1;
	while (lo < hi - 1) {
		const mid = (lo + hi) >> 1;
		if (frames[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	const start = frames[lo];
	const end = frames[hi];
	const span = Math.max(1, end.timeMs - start.timeMs);
	if (start.confidence === "low" || end.confidence === "low") {
		return timeMs < end.timeMs ? start : end;
	}
	const progress = (timeMs - start.timeMs) / span;
	return {
		timeMs,
		cx: start.cx + (end.cx - start.cx) * progress,
		cy: start.cy + (end.cy - start.cy) * progress,
		velocityX: start.velocityX + (end.velocityX - start.velocityX) * progress,
		velocityY: start.velocityY + (end.velocityY - start.velocityY) * progress,
		heading: start.heading + (end.heading - start.heading) * progress,
		confidence:
			start.confidence === "medium" || end.confidence === "medium"
				? ("medium" as const)
				: ("high" as const),
	};
}

export function evaluateCursorPath(
	path: CursorSimulationPath | null | undefined,
	timeMs: number,
	lookAheadMs = 90,
): CursorEvaluation | null {
	if (!path || path.frames.length === 0) {
		return null;
	}

	const frame = interpolateFrame(path.frames, clamp(timeMs, 0, path.durationMs));
	if (!frame) {
		return null;
	}

	const predictedCx = clamp01(frame.cx + frame.velocityX * (lookAheadMs / 1000));
	const predictedCy = clamp01(frame.cy + frame.velocityY * (lookAheadMs / 1000));
	const latestInteraction = findLatestInteractionSample(path.samples, timeMs);
	const latestInteractionAgeMs = latestInteraction
		? Math.max(0, timeMs - latestInteraction.timeMs)
		: Number.POSITIVE_INFINITY;
	const speed = Math.hypot(frame.velocityX, frame.velocityY);
	const cursorType = findLatestStableCursorType(path.samples, timeMs);
	const isDragging = isDraggingAtTime(path.samples, timeMs);
	const isDwell = speed <= DWELL_SPEED_THRESHOLD;
	const intent = classifyCursorIntent({
		frames: path.frames,
		samples: path.samples,
		timeMs,
		cursorType,
		isDragging,
		isDwell,
		latestInteractionType: latestInteraction?.interactionType,
		latestInteractionAgeMs,
		confidence: frame.confidence,
	});

	return {
		timeMs,
		cx: frame.cx,
		cy: frame.cy,
		predictedCx,
		predictedCy,
		velocityX: frame.velocityX,
		velocityY: frame.velocityY,
		heading: frame.heading,
		cursorType,
		latestInteractionType: latestInteraction?.interactionType,
		latestInteractionAgeMs,
		isDragging,
		isDwell,
		isTextInput: cursorType === "text",
		intent,
		confidence: frame.confidence,
	};
}
