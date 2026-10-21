import type { ZoomFocus, ZoomRegion, ZoomTimingSettings } from "../types";
import { DEFAULT_ZOOM_TIMING, ZOOM_DEPTH_SCALES } from "../types";
import { clampFocusToScale } from "./focusUtils";
import { applyZoomEasing, clamp01 } from "./mathUtils";

type DominantRegionOptions = {
	connectZooms?: boolean;
	zoomTiming?: Partial<ZoomTimingSettings>;
};

function resolveTiming(timing?: Partial<ZoomTimingSettings>): ZoomTimingSettings {
	return timing ? { ...DEFAULT_ZOOM_TIMING, ...timing } : DEFAULT_ZOOM_TIMING;
}

type ConnectedRegionPair = {
	currentRegion: ZoomRegion;
	nextRegion: ZoomRegion;
	transitionStart: number;
	transitionEnd: number;
};

type ConnectedPanTransition = {
	progress: number;
	startFocus: ZoomFocus;
	endFocus: ZoomFocus;
	startScale: number;
	endScale: number;
};

function lerp(start: number, end: number, amount: number) {
	return start + (end - start) * amount;
}

export function computeRegionStrength(
	region: ZoomRegion,
	timeMs: number,
	timing: ZoomTimingSettings = DEFAULT_ZOOM_TIMING,
) {
	const zoomInDuration = Math.max(1, timing.zoomInDurationMs);
	const zoomOutDuration = Math.max(1, timing.zoomOutDurationMs);
	const zoomInEnd = region.startMs + Math.max(0, timing.zoomInOverlapMs);
	const leadInStart = zoomInEnd - zoomInDuration;
	const leadOutEnd = region.endMs + zoomOutDuration;

	if (timeMs < leadInStart || timeMs > leadOutEnd) {
		return 0;
	}

	if (timeMs < zoomInEnd) {
		const progress = clamp01((timeMs - leadInStart) / zoomInDuration);
		return applyZoomEasing(timing.zoomInEasing, progress);
	}

	if (timeMs <= region.endMs) {
		return 1;
	}

	const progress = clamp01((timeMs - region.endMs) / zoomOutDuration);
	return 1 - applyZoomEasing(timing.zoomOutEasing, progress);
}

function getLinearFocus(start: ZoomFocus, end: ZoomFocus, amount: number): ZoomFocus {
	return {
		cx: lerp(start.cx, end.cx, amount),
		cy: lerp(start.cy, end.cy, amount),
	};
}

function getResolvedFocus(region: ZoomRegion, zoomScale: number): ZoomFocus {
	return clampFocusToScale(region.focus, zoomScale);
}

function getConnectedRegionPairs(regions: ZoomRegion[], timing: ZoomTimingSettings) {
	const sortedRegions = [...regions].sort((a, b) => a.startMs - b.startMs);
	const pairs: ConnectedRegionPair[] = [];

	for (let index = 0; index < sortedRegions.length - 1; index += 1) {
		const currentRegion = sortedRegions[index];
		const nextRegion = sortedRegions[index + 1];
		const gapMs = nextRegion.startMs - currentRegion.endMs;

		if (gapMs > timing.connectedZoomGapMs) {
			continue;
		}

		pairs.push({
			currentRegion,
			nextRegion,
			transitionStart: currentRegion.endMs,
			transitionEnd: currentRegion.endMs + Math.max(1, timing.connectedZoomDurationMs),
		});
	}

	return pairs;
}

function getActiveRegion(
	regions: ZoomRegion[],
	timeMs: number,
	connectedPairs: ConnectedRegionPair[],
	timing: ZoomTimingSettings,
) {
	const activeRegions = regions
		.map((region) => {
			const outgoingPair = connectedPairs.find((pair) => pair.currentRegion.id === region.id);
			if (outgoingPair && timeMs > outgoingPair.currentRegion.endMs) {
				return { region, strength: 0 };
			}

			const incomingPair = connectedPairs.find((pair) => pair.nextRegion.id === region.id);
			if (incomingPair && timeMs < incomingPair.transitionEnd) {
				return { region, strength: 0 };
			}

			return { region, strength: computeRegionStrength(region, timeMs, timing) };
		})
		.filter((entry) => entry.strength > 0)
		.sort((left, right) => {
			if (right.strength !== left.strength) {
				return right.strength - left.strength;
			}

			return right.region.startMs - left.region.startMs;
		});

	if (activeRegions.length === 0) {
		return null;
	}

	const activeRegion = activeRegions[0].region;
	const activeScale = ZOOM_DEPTH_SCALES[activeRegion.depth];

	return {
		region: {
			...activeRegion,
			focus: getResolvedFocus(activeRegion, activeScale),
		},
		strength: activeRegions[0].strength,
		blendedScale: null,
	};
}

function getConnectedRegionHold(timeMs: number, connectedPairs: ConnectedRegionPair[]) {
	for (const pair of connectedPairs) {
		if (timeMs > pair.transitionEnd && timeMs < pair.nextRegion.startMs) {
			const nextScale = ZOOM_DEPTH_SCALES[pair.nextRegion.depth];
			return {
				region: {
					...pair.nextRegion,
					focus: getResolvedFocus(pair.nextRegion, nextScale),
				},
				strength: 1,
				blendedScale: null,
			};
		}
	}

	return null;
}

function getConnectedRegionTransition(
	connectedPairs: ConnectedRegionPair[],
	timeMs: number,
	timing: ZoomTimingSettings,
) {
	for (const pair of connectedPairs) {
		const { currentRegion, nextRegion, transitionStart, transitionEnd } = pair;

		if (timeMs < transitionStart || timeMs > transitionEnd) {
			continue;
		}

		const transitionProgress = applyZoomEasing(
			timing.connectedZoomEasing,
			clamp01((timeMs - transitionStart) / Math.max(1, transitionEnd - transitionStart)),
		);
		const currentScale = ZOOM_DEPTH_SCALES[currentRegion.depth];
		const nextScale = ZOOM_DEPTH_SCALES[nextRegion.depth];
		const transitionScale = lerp(currentScale, nextScale, transitionProgress);
		const currentFocus = getResolvedFocus(currentRegion, currentScale);
		const nextFocus = getResolvedFocus(nextRegion, nextScale);
		const transitionFocus = getLinearFocus(currentFocus, nextFocus, transitionProgress);

		return {
			region: {
				...nextRegion,
				focus: transitionFocus,
			},
			strength: 1,
			blendedScale: transitionScale,
			transition: {
				progress: transitionProgress,
				startFocus: currentFocus,
				endFocus: nextFocus,
				startScale: currentScale,
				endScale: nextScale,
			},
		};
	}

	return null;
}

export function findDominantRegion(
	regions: ZoomRegion[],
	timeMs: number,
	options: DominantRegionOptions = {},
): {
	region: ZoomRegion | null;
	strength: number;
	blendedScale: number | null;
	transition: ConnectedPanTransition | null;
} {
	const timing = resolveTiming(options.zoomTiming);
	const connectedPairs = options.connectZooms ? getConnectedRegionPairs(regions, timing) : [];

	if (options.connectZooms) {
		const connectedTransition = getConnectedRegionTransition(connectedPairs, timeMs, timing);
		if (connectedTransition) {
			return connectedTransition;
		}

		const connectedHold = getConnectedRegionHold(timeMs, connectedPairs);
		if (connectedHold) {
			return { ...connectedHold, transition: null };
		}
	}

	const activeRegion = getActiveRegion(regions, timeMs, connectedPairs, timing);
	return activeRegion
		? { ...activeRegion, transition: null }
		: { region: null, strength: 0, blendedScale: null, transition: null };
}
