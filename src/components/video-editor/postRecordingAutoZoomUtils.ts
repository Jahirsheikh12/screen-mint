export interface PostRecordingAutoZoomBootstrapState {
	videoPath: string;
	enabled: boolean;
	settled: boolean;
}

export type PostRecordingAutoZoomDecision = "idle" | "wait" | "settle" | "apply";

interface ResolvePostRecordingAutoZoomDecisionArgs {
	bootstrap: PostRecordingAutoZoomBootstrapState | null;
	videoPath: string | null;
	durationSeconds: number;
	cursorTelemetryLoadSettled: boolean;
	normalizedCursorTelemetryLength: number;
	zoomRegionCount: number;
}

export function resolvePostRecordingAutoZoomDecision({
	bootstrap,
	videoPath,
	durationSeconds,
	cursorTelemetryLoadSettled,
	normalizedCursorTelemetryLength,
	zoomRegionCount,
}: ResolvePostRecordingAutoZoomDecisionArgs): PostRecordingAutoZoomDecision {
	if (!bootstrap || !videoPath || bootstrap.videoPath !== videoPath || bootstrap.settled) {
		return "idle";
	}

	if (!bootstrap.enabled) {
		return "settle";
	}

	if (durationSeconds <= 0 || !cursorTelemetryLoadSettled) {
		return "wait";
	}

	if (zoomRegionCount > 0 || normalizedCursorTelemetryLength < 2) {
		return "settle";
	}

	return "apply";
}

export function isPostRecordingAutoZoomPending(
	bootstrap: PostRecordingAutoZoomBootstrapState | null,
	videoPath: string | null,
): boolean {
	return Boolean(
		bootstrap &&
			videoPath &&
			bootstrap.videoPath === videoPath &&
			bootstrap.enabled &&
			!bootstrap.settled,
	);
}
