import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectEditorState } from "./projectPersistence";

export type EditorHistorySnapshot = ProjectEditorState & {
	selectedCameraLayoutId: string | null;
	webcamSelected: boolean;
	selectedZoomId: string | null;
	selectedTrimId: string | null;
	selectedSpeedId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
	selectedCaptionId: string | null;
};

export function cloneEditorHistorySnapshot(snapshot: EditorHistorySnapshot): EditorHistorySnapshot {
	return JSON.parse(JSON.stringify(snapshot));
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

		const currentSerialized = JSON.stringify(historyCurrentRef.current);
		const nextSerialized = JSON.stringify(snapshot);
		if (currentSerialized === nextSerialized) {
			syncHistoryAvailability();
			return;
		}

		historyPastRef.current.push(cloneEditorHistorySnapshot(historyCurrentRef.current));
		if (historyPastRef.current.length > maxHistory) {
			historyPastRef.current.shift();
		}
		historyCurrentRef.current = snapshot;
		historyFutureRef.current = [];
		syncHistoryAvailability();
	}, [buildSnapshot, maxHistory, syncHistoryAvailability]);

	return {
		historyPastRef,
		historyFutureRef,
		canUndo,
		canRedo,
		handleUndo,
		handleRedo,
	};
}
