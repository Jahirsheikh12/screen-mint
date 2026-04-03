export const PREVIEW_READY_STATE_CURRENT_DATA = 2;
const DEFAULT_PREVIEW_RECOVERY_TIMEOUT_MS = 5_000;

export interface PreviewRecoveryVideo {
	src: string;
	currentSrc: string;
	currentTime: number;
	readyState: number;
	paused: boolean;
	ended: boolean;
	error: MediaError | null;
	load: () => void;
	play: () => Promise<void>;
	pause: () => void;
	addEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: AddEventListenerOptions | boolean,
	) => void;
	removeEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: EventListenerOptions | boolean,
	) => void;
}

export interface RestorePreviewFrameOptions {
	fallbackTime?: number;
	forceReload?: boolean;
	resumePlayback?: boolean;
	timeoutMs?: number;
	prepareForReload?: () => void | Promise<void>;
	redrawFrame: () => Promise<void>;
	syncPreviewLayer?: () => Promise<void>;
}

export interface RestorePreviewFrameResult {
	mode: "redraw" | "reload";
	recovered: boolean;
	restoreTime: number;
}

function getPreviewSource(video: PreviewRecoveryVideo): string {
	return video.currentSrc || video.src || "";
}

function getRestoreTime(video: PreviewRecoveryVideo, fallbackTime?: number): number {
	if (Number.isFinite(video.currentTime) && video.currentTime >= 0) {
		return video.currentTime;
	}

	if (Number.isFinite(fallbackTime) && (fallbackTime ?? 0) >= 0) {
		return fallbackTime ?? 0;
	}

	return 0;
}

export function hasRenderablePreviewFrame(video: PreviewRecoveryVideo): boolean {
	return (
		Boolean(getPreviewSource(video)) &&
		video.readyState >= PREVIEW_READY_STATE_CURRENT_DATA &&
		video.error == null
	);
}

function waitForVideoEvent(
	video: PreviewRecoveryVideo,
	eventName: string,
	timeoutMs: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const cleanup = () => {
			video.removeEventListener(eventName, handleSuccess);
			video.removeEventListener("error", handleError);
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};

		const handleSuccess = () => {
			cleanup();
			resolve();
		};

		const handleError = () => {
			cleanup();
			reject(new Error(`Preview recovery failed while waiting for ${eventName}.`));
		};

		timeoutId = setTimeout(() => {
			cleanup();
			reject(new Error(`Preview recovery timed out waiting for ${eventName}.`));
		}, timeoutMs);

		video.addEventListener(eventName, handleSuccess, { once: true });
		video.addEventListener("error", handleError, { once: true });
	});
}

function waitForRenderableVideoData(video: PreviewRecoveryVideo, timeoutMs: number): Promise<void> {
	if (hasRenderablePreviewFrame(video)) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let pollId: ReturnType<typeof setInterval> | null = null;

		const successEvents = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "seeked"];

		const cleanup = () => {
			for (const eventName of successEvents) {
				video.removeEventListener(eventName, handleSuccess);
			}
			video.removeEventListener("error", handleError);
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (pollId) {
				clearInterval(pollId);
			}
		};

		const handleSuccess = () => {
			if (!hasRenderablePreviewFrame(video)) {
				return;
			}
			cleanup();
			resolve();
		};

		const handleError = () => {
			cleanup();
			reject(new Error("Preview recovery failed while reloading the video."));
		};

		for (const eventName of successEvents) {
			video.addEventListener(eventName, handleSuccess);
		}
		video.addEventListener("error", handleError, { once: true });

		timeoutId = setTimeout(() => {
			cleanup();
			reject(
				new Error("Preview recovery timed out while waiting for the video to become renderable."),
			);
		}, timeoutMs);

		pollId = setInterval(handleSuccess, 50);
		handleSuccess();
	});
}

async function ensureVideoReady(video: PreviewRecoveryVideo, timeoutMs: number): Promise<void> {
	if (hasRenderablePreviewFrame(video)) {
		return;
	}

	await waitForRenderableVideoData(video, timeoutMs);

	if (!hasRenderablePreviewFrame(video)) {
		throw new Error("Preview recovery failed because the video did not become renderable.");
	}
}

async function seekVideoToTime(
	video: PreviewRecoveryVideo,
	time: number,
	timeoutMs: number,
): Promise<void> {
	if (Number.isNaN(time) || Math.abs(video.currentTime - time) < 0.0001) {
		return;
	}

	const seekPromise = waitForVideoEvent(video, "seeked", timeoutMs);
	video.currentTime = time;
	await seekPromise;
}

async function runRecoveryPass(
	video: PreviewRecoveryVideo,
	mode: "redraw" | "reload",
	restoreTime: number,
	options: RestorePreviewFrameOptions,
): Promise<RestorePreviewFrameResult> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_PREVIEW_RECOVERY_TIMEOUT_MS;
	if (mode === "reload") {
		const source = getPreviewSource(video);
		if (!source) {
			throw new Error("Preview recovery failed because the video source is missing.");
		}

		await options.prepareForReload?.();
		video.pause();
		if (video.src !== source) {
			video.src = source;
		}
		video.load();
		await ensureVideoReady(video, timeoutMs);
	}

	await seekVideoToTime(video, restoreTime, timeoutMs);
	await options.redrawFrame();
	await options.syncPreviewLayer?.();

	if (options.resumePlayback && !video.ended) {
		try {
			await video.play();
		} catch {
			// Playback resumption can fail transiently after focus returns; the preview is still restored.
		}
	} else {
		video.pause();
	}

	return {
		mode,
		recovered: true,
		restoreTime,
	};
}

export async function restorePreviewFrame(
	video: PreviewRecoveryVideo,
	options: RestorePreviewFrameOptions,
): Promise<RestorePreviewFrameResult> {
	const source = getPreviewSource(video);
	if (!source) {
		throw new Error("Preview recovery failed because the video source is missing.");
	}

	const restoreTime = getRestoreTime(video, options.fallbackTime);
	const preferredMode =
		options.forceReload || !hasRenderablePreviewFrame(video) ? "reload" : "redraw";

	try {
		return await runRecoveryPass(video, preferredMode, restoreTime, options);
	} catch (error) {
		if (preferredMode === "reload") {
			throw error;
		}

		return runRecoveryPass(video, "reload", restoreTime, options);
	}
}
