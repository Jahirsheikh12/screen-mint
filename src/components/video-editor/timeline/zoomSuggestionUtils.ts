import type { CursorInteractionType, CursorTelemetryPoint, ZoomFocus, ZoomMode } from "../types";
import { projectCursorSample } from "../videoPlayback/cursorProjection";

export const MIN_DWELL_DURATION_MS = 450;
export const MAX_DWELL_DURATION_MS = 2600;
export const DWELL_MOVE_THRESHOLD = 0.02;
export const AUTO_ZOOM_REGION_DURATION_MS = 1800;
export const AUTO_ZOOM_SUGGESTION_SPACING_MS = 2400;
const AUTO_ZOOM_MIN_REGION_DURATION_MS = 1200;
const AUTO_ZOOM_MAX_REGION_DURATION_MS = 9000;
const AUTO_ZOOM_LEAD_IN_MS = 420;
const AUTO_ZOOM_LEAD_OUT_MS = 760;
const AUTO_ZOOM_CLUSTER_GAP_MS = 900;
const STATIC_LOCK_SPEED_THRESHOLD = 0.05;
const ACTIVE_FOLLOW_DISTANCE_THRESHOLD = 0.04;

export interface ZoomDwellCandidate {
	centerTimeMs: number;
	focus: ZoomFocus;
	strength: number;
	startMs?: number;
	endMs?: number;
}

export interface CursorInteractionCandidate extends ZoomDwellCandidate {
	kind:
		| "dwell"
		| "click-like"
		| "double-click-like"
		| "text-focus-like"
		| "dropdown-open"
		| "text-selection"
		| "text-field-click";
}

export interface AutoZoomSuggestion {
	startMs: number;
	endMs: number;
	focus: ZoomFocus;
	mode?: ZoomMode;
	confidence?: "high" | "medium" | "low";
	kind?: CursorInteractionCandidate["kind"];
}

export interface AutoZoomSuggestionResult {
	suggestions: AutoZoomSuggestion[];
	status: "ok" | "insufficient-telemetry" | "no-candidates" | "no-slots";
}

function applyCursorTypeInRange(
	samples: CursorTelemetryPoint[],
	startMs: number,
	endMs: number,
	cursorType: NonNullable<CursorTelemetryPoint["cursorType"]>,
) {
	for (const sample of samples) {
		if (sample.timeMs < startMs || sample.timeMs > endMs) continue;
		if (!sample.cursorType) {
			sample.cursorType = cursorType;
		}
	}
}

function dedupeCursorSamples(samples: CursorTelemetryPoint[]) {
	if (samples.length <= 1) {
		return samples;
	}

	const deduped: CursorTelemetryPoint[] = [];
	for (const sample of samples) {
		const previous = deduped[deduped.length - 1];
		if (!previous || previous.timeMs !== sample.timeMs) {
			deduped.push(sample);
			continue;
		}

		deduped[deduped.length - 1] = {
			...previous,
			...sample,
			timeMs: previous.timeMs,
		};
	}

	return deduped;
}

function annotateCursorMotion(samples: CursorTelemetryPoint[]) {
	let previous: CursorTelemetryPoint | null = null;

	return samples.map((sample) => {
		if (!previous) {
			previous = sample;
			return {
				...sample,
				origin: sample.origin ?? "normalized",
				confidence: sample.confidence ?? "high",
				velocityX: 0,
				velocityY: 0,
				heading: 0,
			};
		}

		const deltaSeconds = Math.max(1 / 240, (sample.timeMs - previous.timeMs) / 1000);
		const velocityX = (sample.cx - previous.cx) / deltaSeconds;
		const velocityY = (sample.cy - previous.cy) / deltaSeconds;
		const heading = Math.atan2(velocityY, velocityX);
		previous = sample;

		return {
			...sample,
			origin: sample.origin ?? "normalized",
			confidence: sample.confidence ?? "high",
			velocityX,
			velocityY,
			heading: Number.isFinite(heading) ? heading : 0,
		};
	});
}

export function normalizeCursorTelemetry(
	telemetry: CursorTelemetryPoint[],
	totalMs: number,
): CursorTelemetryPoint[] {
	const normalized = dedupeCursorSamples(
		[...telemetry]
			.filter(
				(sample) =>
					Number.isFinite(sample.timeMs) &&
					Number.isFinite(sample.cx) &&
					Number.isFinite(sample.cy),
			)
			.sort((a, b) => a.timeMs - b.timeMs)
			.map((sample) => projectCursorSample(sample, { totalMs })),
	);

	const interactions = detectInteractionCandidates(normalized);
	for (const candidate of interactions) {
		if (candidate.kind === "text-selection") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 140,
				candidate.centerTimeMs + 1200,
				"text",
			);
			continue;
		}

		if (candidate.kind === "text-field-click" || candidate.kind === "text-focus-like") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 100,
				candidate.centerTimeMs + 900,
				"text",
			);
			continue;
		}
	}

	for (const sample of normalized) {
		if (sample.interactionType !== "click" && sample.interactionType !== "double-click") {
			continue;
		}

		const mouseUp = normalized.find(
			(candidate) => candidate.timeMs > sample.timeMs && candidate.interactionType === "mouseup",
		);
		if (!mouseUp) {
			continue;
		}

		const dragDuration = mouseUp.timeMs - sample.timeMs;
		const dragDistance = Math.hypot(mouseUp.cx - sample.cx, mouseUp.cy - sample.cy);
		if (dragDuration >= 160 && dragDistance > 0.015) {
			const isTextDrag = Math.abs(mouseUp.cx - sample.cx) > Math.abs(mouseUp.cy - sample.cy) * 1.8;
			applyCursorTypeInRange(
				normalized,
				sample.timeMs,
				mouseUp.timeMs,
				isTextDrag ? "text" : "closed-hand",
			);
		}
	}

	return annotateCursorMotion(normalized);
}

export function detectZoomDwellCandidates(samples: CursorTelemetryPoint[]): ZoomDwellCandidate[] {
	if (samples.length < 2) {
		return [];
	}

	const dwellCandidates: ZoomDwellCandidate[] = [];
	let runStart = 0;

	const pushRunIfDwell = (startIndex: number, endIndexExclusive: number) => {
		if (endIndexExclusive - startIndex < 2) {
			return;
		}

		const start = samples[startIndex];
		const end = samples[endIndexExclusive - 1];
		const runDuration = end.timeMs - start.timeMs;
		if (runDuration < MIN_DWELL_DURATION_MS) {
			return;
		}

		const runSamples = samples.slice(startIndex, endIndexExclusive);
		const avgCx = runSamples.reduce((sum, sample) => sum + sample.cx, 0) / runSamples.length;
		const avgCy = runSamples.reduce((sum, sample) => sum + sample.cy, 0) / runSamples.length;

		dwellCandidates.push({
			centerTimeMs: Math.round((start.timeMs + end.timeMs) / 2),
			focus: { cx: avgCx, cy: avgCy },
			strength: Math.min(runDuration, MAX_DWELL_DURATION_MS),
			startMs: start.timeMs,
			endMs: end.timeMs,
		});
	};

	for (let index = 1; index < samples.length; index += 1) {
		const prev = samples[index - 1];
		const curr = samples[index];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);

		if (distance > DWELL_MOVE_THRESHOLD) {
			pushRunIfDwell(runStart, index);
			runStart = index;
		}
	}
	pushRunIfDwell(runStart, samples.length);

	return dwellCandidates;
}

export function detectInteractionCandidates(
	samples: CursorTelemetryPoint[],
): CursorInteractionCandidate[] {
	// --- Phase 1: Explicit interaction events (from uiohook telemetry) ---
	const clickEvents = samples.filter(
		(s) => s.interactionType && s.interactionType !== "move" && s.interactionType !== "mouseup",
	);

	const explicitInteractionCandidates: CursorInteractionCandidate[] = [];

	for (const clickSample of clickEvents) {
		// Classify what happened AFTER this click by analyzing cursor trajectory
		const kind = classifyPostClickBehavior(samples, clickSample);

		const baseStrength =
			kind === "double-click-like"
				? 1500
				: kind === "dropdown-open"
					? 1200
					: kind === "text-selection"
						? 1300
						: kind === "text-field-click"
							? 1100
							: 900;

		explicitInteractionCandidates.push({
			centerTimeMs: Math.round(clickSample.timeMs),
			focus: { cx: clickSample.cx, cy: clickSample.cy },
			strength: baseStrength,
			kind,
		});
	}

	// --- Phase 2: Dwell-based heuristic candidates ---
	const dwellCandidates = detectZoomDwellCandidates(samples).map<CursorInteractionCandidate>(
		(candidate) => {
			if (candidate.strength >= 1100) {
				return { ...candidate, kind: "text-focus-like" };
			}
			if (candidate.strength <= 800) {
				return { ...candidate, kind: "click-like" };
			}
			return { ...candidate, kind: "dwell" };
		},
	);

	// --- Phase 3: Synthetic double-click detection from dwell pairs ---
	const doubleClickCandidates: CursorInteractionCandidate[] = [];
	const sortedByTime = [...dwellCandidates].sort((a, b) => a.centerTimeMs - b.centerTimeMs);

	for (let index = 1; index < sortedByTime.length; index += 1) {
		const prev = sortedByTime[index - 1];
		const curr = sortedByTime[index];
		const timeGap = curr.centerTimeMs - prev.centerTimeMs;
		const spatialGap = Math.hypot(curr.focus.cx - prev.focus.cx, curr.focus.cy - prev.focus.cy);
		const bothShort = prev.strength <= 900 && curr.strength <= 900;

		if (bothShort && timeGap <= 450 && spatialGap <= 0.035) {
			doubleClickCandidates.push({
				centerTimeMs: Math.round((prev.centerTimeMs + curr.centerTimeMs) / 2),
				focus: {
					cx: (prev.focus.cx + curr.focus.cx) / 2,
					cy: (prev.focus.cy + curr.focus.cy) / 2,
				},
				strength: prev.strength + curr.strength + 500,
				kind: "double-click-like",
			});
		}
	}

	return [...explicitInteractionCandidates, ...dwellCandidates, ...doubleClickCandidates];
}

export function buildAutoZoomSuggestions(
	samples: CursorTelemetryPoint[],
	totalMs: number,
	reservedSpans: Array<{ start: number; end: number }> = [],
): AutoZoomSuggestionResult {
	if (samples.length < 2 || totalMs <= 0) {
		return { suggestions: [], status: "insufficient-telemetry" };
	}

	const candidates = detectInteractionCandidates(samples);
	if (candidates.length === 0) {
		return { suggestions: [], status: "no-candidates" };
	}

	const blockedSpans = [...reservedSpans];
	const acceptedCenters: number[] = [];
	const suggestions: AutoZoomSuggestion[] = [];
	const sortedCandidates = mergeInteractionClusters(samples, candidates).sort(
		(a, b) => b.strength - a.strength,
	);

	for (const candidate of sortedCandidates) {
		const tooCloseToAccepted = acceptedCenters.some(
			(center) => Math.abs(center - candidate.centerTimeMs) < AUTO_ZOOM_SUGGESTION_SPACING_MS,
		);
		if (tooCloseToAccepted) {
			continue;
		}

		const desiredDuration = Math.min(
			totalMs,
			Math.max(
				AUTO_ZOOM_MIN_REGION_DURATION_MS,
				Math.min(AUTO_ZOOM_MAX_REGION_DURATION_MS, candidate.endMs - candidate.startMs),
			),
		);
		const centeredStart = Math.round(candidate.centerTimeMs - desiredDuration * 0.45);
		const startMs = Math.max(0, Math.min(centeredStart, Math.max(0, totalMs - desiredDuration)));
		const endMs = Math.min(totalMs, startMs + desiredDuration);
		const hasOverlap = blockedSpans.some((span) => endMs > span.start && startMs < span.end);

		if (hasOverlap) {
			continue;
		}

		suggestions.push({
			startMs,
			endMs,
			focus: candidate.focus,
			mode: candidate.mode,
			confidence: candidate.confidence,
			kind: candidate.kind,
		});
		blockedSpans.push({ start: startMs, end: endMs });
		acceptedCenters.push(candidate.centerTimeMs);
	}

	return {
		suggestions,
		status: suggestions.length > 0 ? "ok" : "no-slots",
	};
}

/**
 * Analyzes cursor movement after a click to classify the interaction pattern.
 *
 * - **dropdown-open**: click followed by slow downward cursor movement (browsing items)
 * - **text-selection**: click followed by primarily horizontal drag movement
 * - **text-field-click**: click followed by cursor staying mostly still (dwell)
 * - **double-click-like**: explicit double-click interaction type
 * - **click-like**: generic click with no recognizable post-click pattern
 */
function classifyPostClickBehavior(
	samples: CursorTelemetryPoint[],
	clickSample: CursorTelemetryPoint,
): CursorInteractionCandidate["kind"] {
	// Explicit double-click from uiohook
	if (clickSample.interactionType === "double-click") {
		return "double-click-like";
	}

	const clickTime = clickSample.timeMs;

	// Check for mouseup shortly after (drag detection)
	const mouseUpAfter = samples.find(
		(s) => s.interactionType === "mouseup" && s.timeMs > clickTime && s.timeMs - clickTime < 3000,
	);

	if (mouseUpAfter) {
		const dragDx = Math.abs(mouseUpAfter.cx - clickSample.cx);
		const dragDy = Math.abs(mouseUpAfter.cy - clickSample.cy);
		const dragDuration = mouseUpAfter.timeMs - clickTime;

		// Text selection: horizontal drag > 3% of screen, mostly horizontal, duration 200ms+
		if (dragDuration >= 200 && dragDx > 0.03 && dragDx > dragDy * 1.8) {
			return "text-selection";
		}
	}

	// Analyze trajectory in the 400ms-2000ms window after click
	const moveSamples = samples.filter(
		(s) =>
			s.timeMs > clickTime + 100 &&
			s.timeMs <= clickTime + 2000 &&
			(s.interactionType === "move" || !s.interactionType),
	);

	if (moveSamples.length < 3) {
		// Very few move samples after click = cursor stayed still = text field click
		return "text-field-click";
	}

	// Compute displacement from click position
	let maxDist = 0;
	let totalAbsDy = 0;
	let totalAbsDx = 0;
	for (const s of moveSamples) {
		const dist = Math.hypot(s.cx - clickSample.cx, s.cy - clickSample.cy);
		maxDist = Math.max(maxDist, dist);
		totalAbsDx += Math.abs(s.cx - clickSample.cx);
		totalAbsDy += Math.abs(s.cy - clickSample.cy);
	}

	// Cursor barely moved after click: text field click (dwell)
	if (maxDist < 0.02) {
		return "text-field-click";
	}

	// Primarily downward movement after click: dropdown open
	const lastMoveSample = moveSamples[moveSamples.length - 1];
	const netDy = lastMoveSample.cy - clickSample.cy;

	if (netDy > 0.03 && totalAbsDy > totalAbsDx * 1.5) {
		return "dropdown-open";
	}

	// Primarily horizontal movement: text selection (fallback if no mouseup)
	if (totalAbsDx > 0.03 && totalAbsDx > totalAbsDy * 1.8) {
		return "text-selection";
	}

	return "click-like";
}

interface AutoZoomCluster {
	startMs: number;
	endMs: number;
	centerTimeMs: number;
	focus: ZoomFocus;
	strength: number;
	kind: CursorInteractionCandidate["kind"];
	mode: ZoomMode;
	confidence: "high" | "medium" | "low";
}

function isExplicitInteraction(type: CursorInteractionType | undefined) {
	return Boolean(type && type !== "move" && type !== "mouseup");
}

function getSamplesInRange(samples: CursorTelemetryPoint[], startMs: number, endMs: number) {
	return samples.filter((sample) => sample.timeMs >= startMs && sample.timeMs <= endMs);
}

function getClusterWindow(
	samples: CursorTelemetryPoint[],
	candidate: CursorInteractionCandidate,
): { startMs: number; endMs: number } {
	const baseStart = Math.max(0, candidate.centerTimeMs - AUTO_ZOOM_LEAD_IN_MS);
	const baseEnd = candidate.centerTimeMs + AUTO_ZOOM_LEAD_OUT_MS;

	if (candidate.kind === "text-selection") {
		const dragEnd = samples.find(
			(sample) =>
				sample.timeMs >= candidate.centerTimeMs &&
				(sample.interactionType === "drag-end" || sample.interactionType === "mouseup"),
		);
		return {
			startMs: baseStart,
			endMs: Math.max(baseEnd, (dragEnd?.timeMs ?? candidate.centerTimeMs) + 900),
		};
	}

	if (candidate.kind === "dropdown-open") {
		return { startMs: baseStart, endMs: candidate.centerTimeMs + 1800 };
	}

	if (
		candidate.kind === "text-field-click" ||
		candidate.kind === "text-focus-like" ||
		candidate.kind === "double-click-like"
	) {
		if (
			candidate.kind === "text-focus-like" &&
			candidate.startMs !== undefined &&
			candidate.endMs !== undefined
		) {
			return {
				startMs: Math.max(0, candidate.startMs - AUTO_ZOOM_LEAD_IN_MS),
				endMs: candidate.endMs + AUTO_ZOOM_LEAD_OUT_MS,
			};
		}
		return { startMs: baseStart, endMs: candidate.centerTimeMs + 1500 };
	}

	return { startMs: baseStart, endMs: baseEnd };
}

function getWeightedFocus(
	samples: CursorTelemetryPoint[],
	candidate: CursorInteractionCandidate,
	startMs: number,
	endMs: number,
): ZoomFocus {
	const windowSamples = getSamplesInRange(samples, startMs, endMs);
	const meaningful = windowSamples.filter(
		(sample) => sample.confidence !== "low" || isExplicitInteraction(sample.interactionType),
	);
	const source = meaningful.length > 0 ? meaningful : windowSamples;

	if (source.length === 0) {
		return candidate.focus;
	}

	let totalWeight = 0;
	let x = 0;
	let y = 0;
	for (const sample of source) {
		const age = Math.abs(sample.timeMs - candidate.centerTimeMs);
		const proximityWeight = Math.max(0.25, 1 - age / Math.max(1, endMs - startMs));
		const interactionWeight = isExplicitInteraction(sample.interactionType) ? 2.2 : 1;
		const confidenceWeight =
			sample.confidence === "low" ? 0.4 : sample.confidence === "medium" ? 0.8 : 1;
		const weight = proximityWeight * interactionWeight * confidenceWeight;
		totalWeight += weight;
		x += sample.cx * weight;
		y += sample.cy * weight;
	}

	return totalWeight > 0 ? { cx: x / totalWeight, cy: y / totalWeight } : candidate.focus;
}

function shouldUseCursorFollow(
	samples: CursorTelemetryPoint[],
	startMs: number,
	endMs: number,
	kind: CursorInteractionCandidate["kind"],
) {
	if (
		kind === "text-field-click" ||
		kind === "text-focus-like" ||
		kind === "text-selection" ||
		kind === "double-click-like"
	) {
		return false;
	}

	const windowSamples = getSamplesInRange(samples, startMs, endMs).filter(
		(sample) => sample.confidence !== "low",
	);
	if (windowSamples.length < 2) {
		return false;
	}

	let maxDistance = 0;
	let maxSpeed = 0;
	const first = windowSamples[0];
	for (let index = 1; index < windowSamples.length; index += 1) {
		const current = windowSamples[index];
		maxDistance = Math.max(maxDistance, Math.hypot(current.cx - first.cx, current.cy - first.cy));
		maxSpeed = Math.max(maxSpeed, Math.hypot(current.velocityX ?? 0, current.velocityY ?? 0));
	}

	return maxDistance >= ACTIVE_FOLLOW_DISTANCE_THRESHOLD || maxSpeed >= STATIC_LOCK_SPEED_THRESHOLD;
}

function getClusterConfidence(samples: CursorTelemetryPoint[], startMs: number, endMs: number) {
	const windowSamples = getSamplesInRange(samples, startMs, endMs);
	if (windowSamples.length === 0) {
		return "low" as const;
	}

	const lowCount = windowSamples.filter((sample) => sample.confidence === "low").length;
	if (lowCount / windowSamples.length > 0.45) {
		return "low" as const;
	}
	return lowCount > 0 ? ("medium" as const) : ("high" as const);
}

function mergeInteractionClusters(
	samples: CursorTelemetryPoint[],
	candidates: CursorInteractionCandidate[],
): AutoZoomCluster[] {
	const sorted = [...candidates].sort((a, b) => a.centerTimeMs - b.centerTimeMs);
	const clusters: AutoZoomCluster[] = [];

	for (const candidate of sorted) {
		const window = getClusterWindow(samples, candidate);
		const focus = getWeightedFocus(samples, candidate, window.startMs, window.endMs);
		const mode = shouldUseCursorFollow(samples, window.startMs, window.endMs, candidate.kind)
			? "cursor-follow"
			: "static";
		const cluster: AutoZoomCluster = {
			startMs: window.startMs,
			endMs: window.endMs,
			centerTimeMs: candidate.centerTimeMs,
			focus,
			strength: candidate.strength,
			kind: candidate.kind,
			mode,
			confidence: getClusterConfidence(samples, window.startMs, window.endMs),
		};

		const previous = clusters[clusters.length - 1];
		const shouldMerge =
			previous &&
			cluster.startMs - previous.endMs <= AUTO_ZOOM_CLUSTER_GAP_MS &&
			Math.hypot(cluster.focus.cx - previous.focus.cx, cluster.focus.cy - previous.focus.cy) <=
				0.18;

		if (!shouldMerge || !previous) {
			clusters.push(cluster);
			continue;
		}

		const totalStrength = previous.strength + cluster.strength;
		previous.startMs = Math.min(previous.startMs, cluster.startMs);
		previous.endMs = Math.max(previous.endMs, cluster.endMs);
		previous.centerTimeMs = Math.round(
			(previous.centerTimeMs * previous.strength + cluster.centerTimeMs * cluster.strength) /
				totalStrength,
		);
		previous.focus = {
			cx:
				(previous.focus.cx * previous.strength + cluster.focus.cx * cluster.strength) /
				totalStrength,
			cy:
				(previous.focus.cy * previous.strength + cluster.focus.cy * cluster.strength) /
				totalStrength,
		};
		previous.strength = totalStrength + 300;
		previous.mode =
			previous.mode === "cursor-follow" || cluster.mode === "cursor-follow"
				? "cursor-follow"
				: "static";
		previous.confidence =
			previous.confidence === "low" || cluster.confidence === "low"
				? "low"
				: previous.confidence === "medium" || cluster.confidence === "medium"
					? "medium"
					: "high";
		if (
			cluster.kind === "double-click-like" ||
			cluster.kind === "text-selection" ||
			cluster.kind === "text-focus-like"
		) {
			previous.kind = cluster.kind;
		}
	}

	return clusters;
}
