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
	seekEpsilon?: number;
}

export interface WebcamPreviewSyncDecision {
	playbackRate: number | null;
	shouldPlay: boolean;
	shouldPause: boolean;
	seekTarget: number | null;
}

export const DEFAULT_WEBCAM_PREVIEW_DRIFT_THRESHOLD = 0.034;
export const DEFAULT_WEBCAM_PREVIEW_SEEK_EPSILON = 0.001;

export function resolveWebcamPreviewSyncDecision(
	input: WebcamPreviewSyncDecisionInput,
): WebcamPreviewSyncDecision {
	const driftThreshold = input.driftThreshold ?? DEFAULT_WEBCAM_PREVIEW_DRIFT_THRESHOLD;
	const seekEpsilon = input.seekEpsilon ?? DEFAULT_WEBCAM_PREVIEW_SEEK_EPSILON;
	const shouldBePlaying = input.isPlaying && !input.isHeld;
	const rate =
		Number.isFinite(input.playbackRate) && input.playbackRate > 0 ? input.playbackRate : 1;
	const shouldUpdatePlaybackRate =
		Math.abs(input.currentPlaybackRate - rate) > DEFAULT_WEBCAM_PREVIEW_SEEK_EPSILON;

	if (!input.isReady) {
		return {
			playbackRate: shouldUpdatePlaybackRate ? rate : null,
			shouldPlay: false,
			shouldPause: !shouldBePlaying && !input.isPaused,
			seekTarget: null,
		};
	}

	if (shouldBePlaying) {
		const hasDrift = Math.abs(input.mediaTime - input.targetTime) > driftThreshold;
		return {
			playbackRate: shouldUpdatePlaybackRate ? rate : null,
			shouldPlay: !hasDrift && input.isPaused,
			shouldPause: false,
			seekTarget: hasDrift && !input.hasPendingSeek ? input.targetTime : null,
		};
	}

	const needsSeek =
		!input.hasPendingSeek && Math.abs(input.mediaTime - input.targetTime) > seekEpsilon;

	return {
		playbackRate: shouldUpdatePlaybackRate ? rate : null,
		shouldPlay: false,
		shouldPause: !input.isPaused,
		seekTarget: needsSeek ? input.targetTime : null,
	};
}
