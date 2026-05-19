export type CaptureMode = "display" | "window" | "area";

export type PendingRecordingAction = "stop" | "retake" | "delete" | null;

export type RecordingPhase = "idle" | "recording" | "paused";

export interface RecordingBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface SelectedArea {
	displayId: number;
	displayBounds: RecordingBounds;
	bounds: RecordingBounds;
	normalizedBounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

export interface RecordingSessionState {
	phase: RecordingPhase;
	pendingAction: PendingRecordingAction;
	captureMode: CaptureMode;
	selectedSourceId: string | null;
	selectedArea: SelectedArea | null;
	segmentCount: number;
}

export type RecordingSessionEvent =
	| {
			type: "start";
			captureMode: CaptureMode;
			selectedSourceId: string | null;
			selectedArea: SelectedArea | null;
	  }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "queue-stop" }
	| { type: "queue-retake" }
	| { type: "queue-delete" }
	| { type: "segment-stored" }
	| { type: "clear-pending-action" }
	| { type: "reset" }
	| { type: "set-area"; selectedArea: SelectedArea | null };

export const INITIAL_RECORDING_SESSION_STATE: RecordingSessionState = {
	phase: "idle",
	pendingAction: null,
	captureMode: "display",
	selectedSourceId: null,
	selectedArea: null,
	segmentCount: 0,
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function normalizeSelectedArea(
	bounds: RecordingBounds,
	displayBounds: RecordingBounds,
	displayId: number,
): SelectedArea {
	const maxWidth = Math.max(1, displayBounds.width);
	const maxHeight = Math.max(1, displayBounds.height);
	const x = clamp(bounds.x, displayBounds.x, displayBounds.x + displayBounds.width - 1);
	const y = clamp(bounds.y, displayBounds.y, displayBounds.y + displayBounds.height - 1);
	const width = clamp(bounds.width, 1, displayBounds.x + displayBounds.width - x);
	const height = clamp(bounds.height, 1, displayBounds.y + displayBounds.height - y);

	return {
		displayId,
		displayBounds: { ...displayBounds },
		bounds: { x, y, width, height },
		normalizedBounds: {
			x: clamp((x - displayBounds.x) / maxWidth, 0, 1),
			y: clamp((y - displayBounds.y) / maxHeight, 0, 1),
			width: clamp(width / maxWidth, 1 / maxWidth, 1),
			height: clamp(height / maxHeight, 1 / maxHeight, 1),
		},
	};
}

export function recordingSessionReducer(
	state: RecordingSessionState,
	event: RecordingSessionEvent,
): RecordingSessionState {
	switch (event.type) {
		case "start":
			return {
				phase: "recording",
				pendingAction: null,
				captureMode: event.captureMode,
				selectedSourceId: event.selectedSourceId,
				selectedArea: event.selectedArea,
				segmentCount: 0,
			};
		case "pause":
			if (state.phase !== "recording") {
				return state;
			}
			return { ...state, phase: "paused" };
		case "resume":
			if (state.phase !== "paused") {
				return state;
			}
			return { ...state, phase: "recording" };
		case "queue-stop":
			if (state.phase === "idle") {
				return state;
			}
			return { ...state, pendingAction: "stop" };
		case "queue-retake":
			if (state.phase === "idle") {
				return state;
			}
			return { ...state, pendingAction: "retake" };
		case "queue-delete":
			if (state.phase === "idle") {
				return state;
			}
			return { ...state, pendingAction: "delete" };
		case "segment-stored":
			return { ...state, segmentCount: state.segmentCount + 1 };
		case "clear-pending-action":
			return { ...state, pendingAction: null };
		case "set-area":
			return { ...state, selectedArea: event.selectedArea };
		case "reset":
			return {
				...INITIAL_RECORDING_SESSION_STATE,
				captureMode: state.captureMode,
				selectedSourceId: state.selectedSourceId,
				selectedArea: state.selectedArea,
			};
		default:
			return state;
	}
}

export type CursorTelemetrySample = {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: string;
	cursorType?: string;
	rawX?: number;
	rawY?: number;
	origin?: string;
	confidence?: string;
	sourceBounds?: RecordingBounds;
	displayBounds?: RecordingBounds;
	sourceDisplayId?: number;
	displayScaleFactor?: number;
	captureMode?: CaptureMode;
	capturePlatform?: "darwin" | "win32" | "linux";
	geometrySource?:
		| "electron-display"
		| "selected-area"
		| "win32-window"
		| "x11-window"
		| "macos-window"
		| "fallback-display";
	projectionConfidence?: "high" | "medium" | "low";
	velocityX?: number;
	velocityY?: number;
	heading?: number;
};

export function offsetCursorTelemetry(
	segments: Array<{ durationMs: number; samples: CursorTelemetrySample[] }>,
): CursorTelemetrySample[] {
	let offsetMs = 0;

	return segments.flatMap((segment) => {
		const adjusted = segment.samples.map((sample) => ({
			...sample,
			timeMs: Math.max(0, sample.timeMs + offsetMs),
		}));
		offsetMs += Math.max(0, segment.durationMs);
		return adjusted;
	});
}
