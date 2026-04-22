export interface WebcamPreviewSyncDecisionInput {
	mediaTime: number;
	targetTime: number;
	isPlaying: boolean;
	isHeld: boolean;
	isReady: boolean;
	isPaused: boolean;
	hasPendingSeek: boolean;
	playbackRate: number;
	currentPlaybackRate: number;
	driftThreshold?: number;
	hardSeekThreshold?: number;
	seekEpsilon?: number;
	maxPlaybackRateCorrection?: number;
}

export interface WebcamPreviewSyncDecision {
	playbackRate: number | null;
	shouldPlay: boolean;
	shouldPause: boolean;
	seekTarget: number | null;
}

export const DEFAULT_WEBCAM_PREVIEW_DRIFT_THRESHOLD = 0.034;
export const DEFAULT_WEBCAM_PREVIEW_HARD_SEEK_THRESHOLD = 0.16;
export const DEFAULT_WEBCAM_PREVIEW_SEEK_EPSILON = 0.001;
export const DEFAULT_WEBCAM_PREVIEW_MAX_RATE_CORRECTION = 0.12;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function resolveWebcamPreviewSyncDecision(
	input: WebcamPreviewSyncDecisionInput,
): WebcamPreviewSyncDecision {
	const driftThreshold = input.driftThreshold ?? DEFAULT_WEBCAM_PREVIEW_DRIFT_THRESHOLD;
	const hardSeekThreshold =
		input.hardSeekThreshold ??
		Math.max(DEFAULT_WEBCAM_PREVIEW_HARD_SEEK_THRESHOLD, driftThreshold * 2);
	const seekEpsilon = input.seekEpsilon ?? DEFAULT_WEBCAM_PREVIEW_SEEK_EPSILON;
	const maxPlaybackRateCorrection =
		input.maxPlaybackRateCorrection ?? DEFAULT_WEBCAM_PREVIEW_MAX_RATE_CORRECTION;
	const shouldBePlaying = input.isPlaying && !input.isHeld;
	const rate =
		Number.isFinite(input.playbackRate) && input.playbackRate > 0 ? input.playbackRate : 1;
	const drift = input.targetTime - input.mediaTime;
	const driftAbs = Math.abs(drift);

	if (!input.isReady) {
		const shouldUpdatePlaybackRate = Math.abs(input.currentPlaybackRate - rate) > seekEpsilon;
		return {
			playbackRate: shouldUpdatePlaybackRate ? rate : null,
			shouldPlay: false,
			shouldPause: !shouldBePlaying && !input.isPaused,
			seekTarget: null,
		};
	}

	if (shouldBePlaying) {
		if (driftAbs > hardSeekThreshold) {
			const shouldUpdatePlaybackRate = Math.abs(input.currentPlaybackRate - rate) > seekEpsilon;
			return {
				playbackRate: shouldUpdatePlaybackRate ? rate : null,
				shouldPlay: false,
				shouldPause: false,
				seekTarget: !input.hasPendingSeek ? input.targetTime : null,
			};
		}

		const correctionProgress = clamp(drift / Math.max(hardSeekThreshold, seekEpsilon), -1, 1);
		const correctedRate = clamp(
			rate + correctionProgress * maxPlaybackRateCorrection,
			Math.max(0.85, rate - maxPlaybackRateCorrection),
			rate + maxPlaybackRateCorrection,
		);
		const targetPlaybackRate = driftAbs > driftThreshold ? correctedRate : rate;
		const shouldUpdatePlaybackRate =
			Math.abs(input.currentPlaybackRate - targetPlaybackRate) > 0.01;
		return {
			playbackRate: shouldUpdatePlaybackRate ? targetPlaybackRate : null,
			shouldPlay: input.isPaused,
			shouldPause: false,
			seekTarget: null,
		};
	}

	const needsSeek = !input.hasPendingSeek && driftAbs > seekEpsilon;
	const shouldUpdatePlaybackRate = Math.abs(input.currentPlaybackRate - rate) > seekEpsilon;

	return {
		playbackRate: shouldUpdatePlaybackRate ? rate : null,
		shouldPlay: false,
		shouldPause: !input.isPaused,
		seekTarget: needsSeek ? input.targetTime : null,
	};
}
