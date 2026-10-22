import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectEditorState } from "./projectPersistence";

export type EditorHistorySnapshot = ProjectEditorState & {
	selectedCameraLayoutId: string | null;
	webcamSelected: boolean;
	selectedZoomId: string | null;
	selectedSpeedId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
	selectedCaptionId: string | null;
};

export function cloneEditorHistorySnapshot(snapshot: EditorHistorySnapshot): EditorHistorySnapshot {
	return JSON.parse(JSON.stringify(snapshot));
}

// Edits closer together than this (slider drags, typing) become one undo step.
const HISTORY_COALESCE_MS = 400;

/** Serializes only the edit state; selection travels with a snapshot but is not an edit. */
export function serializeEdits(snapshot: EditorHistorySnapshot): string {
	const {
		selectedCameraLayoutId: _camera,
		webcamSelected: _webcam,
		selectedZoomId: _zoom,
		selectedSpeedId: _speed,
		selectedAnnotationId: _annotation,
		selectedAudioId: _audio,
		selectedCaptionId: _caption,
		...edits
	} = snapshot;
	return JSON.stringify(edits);
}

interface UseEditorHistoryOptions {
	buildSnapshot: () => EditorHistorySnapshot;
	applySnapshot: (snapshot: EditorHistorySnapshot) => void;
	maxHistory?: number;
}

export function useEditorHistory({
	buildSnapshot,
	applySnapshot,
	maxHistory = 100,
}: UseEditorHistoryOptions) {
	const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
	const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
	const historyCurrentRef = useRef<EditorHistorySnapshot | null>(null);
	const applyingHistoryRef = useRef(false);
	const lastPushAtRef = useRef(0);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	const syncHistoryAvailability = useCallback(() => {
		setCanUndo(historyPastRef.current.length > 0);
		setCanRedo(historyFutureRef.current.length > 0);
	}, []);

	const handleUndo = useCallback(() => {
		if (historyPastRef.current.length === 0) {
			syncHistoryAvailability();
			return;
		}

		const current = historyCurrentRef.current ?? cloneEditorHistorySnapshot(buildSnapshot());
		const previous = historyPastRef.current.pop();
		if (!previous) {
			syncHistoryAvailability();
			return;
		}

		historyFutureRef.current.push(cloneEditorHistorySnapshot(current));
		historyCurrentRef.current = cloneEditorHistorySnapshot(previous);
		applyingHistoryRef.current = true;
		lastPushAtRef.current = 0;
		syncHistoryAvailability();
		applySnapshot(previous);
	}, [applySnapshot, buildSnapshot, syncHistoryAvailability]);

	const handleRedo = useCallback(() => {
		if (historyFutureRef.current.length === 0) {
			syncHistoryAvailability();
			return;
		}

		const current = historyCurrentRef.current ?? cloneEditorHistorySnapshot(buildSnapshot());
		const next = historyFutureRef.current.pop();
		if (!next) {
			syncHistoryAvailability();
			return;
		}

		historyPastRef.current.push(cloneEditorHistorySnapshot(current));
		historyCurrentRef.current = cloneEditorHistorySnapshot(next);
		applyingHistoryRef.current = true;
		lastPushAtRef.current = 0;
		syncHistoryAvailability();
		applySnapshot(next);
	}, [applySnapshot, buildSnapshot, syncHistoryAvailability]);

	useEffect(() => {
		const snapshot = cloneEditorHistorySnapshot(buildSnapshot());

		if (!historyCurrentRef.current) {
			historyCurrentRef.current = snapshot;
			syncHistoryAvailability();
			return;
		}

		if (applyingHistoryRef.current) {
			historyCurrentRef.current = snapshot;
			applyingHistoryRef.current = false;
			syncHistoryAvailability();
			return;
		}

		if (serializeEdits(historyCurrentRef.current) === serializeEdits(snapshot)) {
			// Selection-only change: remember it, but it is not an undo step.
			historyCurrentRef.current = snapshot;
			syncHistoryAvailability();
			return;
		}

		const now = Date.now();
		const continuesLastEdit =
			historyPastRef.current.length > 0 && now - lastPushAtRef.current < HISTORY_COALESCE_MS;
		lastPushAtRef.current = now;
		if (!continuesLastEdit) {
			historyPastRef.current.push(cloneEditorHistorySnapshot(historyCurrentRef.current));
			if (historyPastRef.current.length > maxHistory) {
				historyPastRef.current.shift();
			}
		}
		historyCurrentRef.current = snapshot;
		historyFutureRef.current = [];
		syncHistoryAvailability();
	}, [buildSnapshot, maxHistory, syncHistoryAvailability]);

	/** Starts history over, e.g. when a different project or recording is loaded. */
	const resetHistory = useCallback(() => {
		historyPastRef.current = [];
		historyFutureRef.current = [];
		historyCurrentRef.current = null;
		lastPushAtRef.current = 0;
		syncHistoryAvailability();
	}, [syncHistoryAvailability]);

	return {
		historyPastRef,
		historyFutureRef,
		canUndo,
		canRedo,
		handleUndo,
		handleRedo,
		resetHistory,
	};
}
