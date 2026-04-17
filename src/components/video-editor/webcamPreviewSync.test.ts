import { describe, expect, it } from "vitest";
import { resolveWebcamPreviewSyncDecision } from "./webcamPreviewSync";

describe("webcamPreviewSync", () => {
	it("does not seek repeatedly while playback remains within the drift threshold", () => {
		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: 10,
			targetTime: 10.02,
			isPlaying: true,
			isHeld: false,
			isReady: true,
			isPaused: false,
			hasPendingSeek: false,
			playbackRate: 1,
			currentPlaybackRate: 1,
		});

		expect(decision.seekTarget).toBeNull();
		expect(decision.shouldPlay).toBe(false);
		expect(decision.shouldPause).toBe(false);
	});

	it("seeks exactly while paused or scrubbed", () => {
		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: 4,
			targetTime: 4.5,
			isPlaying: false,
			isHeld: false,
			isReady: true,
			isPaused: true,
			hasPendingSeek: false,
			playbackRate: 1,
			currentPlaybackRate: 1,
		});

		expect(decision.seekTarget).toBe(4.5);
		expect(decision.shouldPause).toBe(false);
		expect(decision.shouldPlay).toBe(false);
	});

	it("only requests hard resync after the playback drift threshold is exceeded", () => {
		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: 7,
			targetTime: 7.08,
			isPlaying: true,
			isHeld: false,
			isReady: true,
			isPaused: false,
			hasPendingSeek: false,
			playbackRate: 1,
			currentPlaybackRate: 1,
		});

		expect(decision.seekTarget).toBe(7.08);
	});

	it("treats held preview states like paused playback", () => {
		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: 12,
			targetTime: 12.4,
			isPlaying: true,
			isHeld: true,
			isReady: true,
			isPaused: false,
			hasPendingSeek: false,
			playbackRate: 1,
			currentPlaybackRate: 1,
		});

		expect(decision.shouldPause).toBe(true);
		expect(decision.seekTarget).toBe(12.4);
	});
});
