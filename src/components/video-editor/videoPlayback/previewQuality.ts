import { DEFAULT_PREVIEW_QUALITY, type PreviewQuality } from "../types";

export const PREVIEW_QUALITY_RESOLUTION_MULTIPLIERS: Record<PreviewQuality, number> = {
	low: 0.5,
	medium: 0.75,
	high: 1,
};

export interface PreviewQualitySwitchState {
	activeQuality: PreviewQuality;
	lastStableQuality: PreviewQuality;
	inFlightQuality: PreviewQuality | null;
	queuedQuality: PreviewQuality | null;
}

export interface PreviewQualitySwitchRequest {
	state: PreviewQualitySwitchState;
	startQuality: PreviewQuality | null;
}

export interface PreviewQualitySwitchSuccess {
	state: PreviewQualitySwitchState;
	startQuality: PreviewQuality | null;
}

export interface PreviewQualitySwitchFailure {
	state: PreviewQualitySwitchState;
	fallbackQuality: PreviewQuality;
	startQuality: PreviewQuality;
}

export function getPreviewQualityMultiplier(quality: PreviewQuality): number {
	return PREVIEW_QUALITY_RESOLUTION_MULTIPLIERS[quality];
}

export function getEffectivePreviewResolution(
	devicePixelRatio: number,
	quality: PreviewQuality,
): number {
	const safeDevicePixelRatio =
		typeof devicePixelRatio === "number" &&
		Number.isFinite(devicePixelRatio) &&
		devicePixelRatio > 0
			? devicePixelRatio
			: 1;
	const rawResolution = safeDevicePixelRatio * getPreviewQualityMultiplier(quality);
	return Math.max(0.5, Math.round(rawResolution * 100) / 100);
}

export function createPreviewQualitySwitchState(
	initialQuality: PreviewQuality = DEFAULT_PREVIEW_QUALITY,
): PreviewQualitySwitchState {
	return {
		activeQuality: initialQuality,
		lastStableQuality: initialQuality,
		inFlightQuality: null,
		queuedQuality: null,
	};
}

export function requestPreviewQualitySwitch(
	state: PreviewQualitySwitchState,
	requestedQuality: PreviewQuality,
): PreviewQualitySwitchRequest {
	if (state.inFlightQuality) {
		return {
			state: {
				...state,
				queuedQuality: requestedQuality,
			},
			startQuality: null,
		};
	}

	if (requestedQuality === state.activeQuality) {
		return {
			state: {
				...state,
				queuedQuality: null,
			},
			startQuality: null,
		};
	}

	return {
		state: {
			...state,
			inFlightQuality: requestedQuality,
			queuedQuality: null,
		},
		startQuality: requestedQuality,
	};
}

export function commitPreviewQualitySwitch(
	state: PreviewQualitySwitchState,
): PreviewQualitySwitchSuccess {
	if (!state.inFlightQuality) {
		return {
			state,
			startQuality: null,
		};
	}

	const appliedQuality = state.inFlightQuality;
	if (state.queuedQuality && state.queuedQuality !== appliedQuality) {
		return {
			state: {
				activeQuality: appliedQuality,
				lastStableQuality: appliedQuality,
				inFlightQuality: state.queuedQuality,
				queuedQuality: null,
			},
			startQuality: state.queuedQuality,
		};
	}

	return {
		state: {
			activeQuality: appliedQuality,
			lastStableQuality: appliedQuality,
			inFlightQuality: null,
			queuedQuality: null,
		},
		startQuality: null,
	};
}

export function rollbackPreviewQualitySwitch(
	state: PreviewQualitySwitchState,
): PreviewQualitySwitchFailure {
	const fallbackQuality = state.lastStableQuality;
	const nextQuality =
		state.queuedQuality && state.queuedQuality !== fallbackQuality
			? state.queuedQuality
			: fallbackQuality;

	return {
		state: {
			activeQuality: fallbackQuality,
			lastStableQuality: fallbackQuality,
			inFlightQuality: nextQuality,
			queuedQuality: null,
		},
		fallbackQuality,
		startQuality: nextQuality,
	};
}
