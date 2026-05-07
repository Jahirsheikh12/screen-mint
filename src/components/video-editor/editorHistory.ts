import { useCallback, useEffect, useRef } from "react";
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

	const handleUndo = useCallback(() => {
		if (historyPastRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneEditorHistorySnapshot(buildSnapshot());
		const previous = historyPastRef.current.pop();
		if (!previous) return;

		historyFutureRef.current.push(cloneEditorHistorySnapshot(current));
		historyCurrentRef.current = cloneEditorHistorySnapshot(previous);
		applyingHistoryRef.current = true;
		applySnapshot(previous);
	}, [applySnapshot, buildSnapshot]);

	const handleRedo = useCallback(() => {
		if (historyFutureRef.current.length === 0) return;

		const current = historyCurrentRef.current ?? cloneEditorHistorySnapshot(buildSnapshot());
		const next = historyFutureRef.current.pop();
		if (!next) return;

		historyPastRef.current.push(cloneEditorHistorySnapshot(current));
		historyCurrentRef.current = cloneEditorHistorySnapshot(next);
		applyingHistoryRef.current = true;
		applySnapshot(next);
	}, [applySnapshot, buildSnapshot]);

	useEffect(() => {
		const snapshot = cloneEditorHistorySnapshot(buildSnapshot());

		if (!historyCurrentRef.current) {
			historyCurrentRef.current = snapshot;
			return;
		}

		if (applyingHistoryRef.current) {
			historyCurrentRef.current = snapshot;
			applyingHistoryRef.current = false;
			return;
		}

		const currentSerialized = JSON.stringify(historyCurrentRef.current);
		const nextSerialized = JSON.stringify(snapshot);
		if (currentSerialized === nextSerialized) {
			return;
		}

		historyPastRef.current.push(cloneEditorHistorySnapshot(historyCurrentRef.current));
		if (historyPastRef.current.length > maxHistory) {
			historyPastRef.current.shift();
		}
		historyCurrentRef.current = snapshot;
		historyFutureRef.current = [];
	}, [buildSnapshot, maxHistory]);

	return {
		historyPastRef,
		historyFutureRef,
		handleUndo,
		handleRedo,
	};
}
