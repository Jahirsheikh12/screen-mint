import { type RefObject, useEffect } from "react";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { matchesShortcut, type ShortcutsConfig } from "@/lib/shortcuts";
import type { VideoPlaybackRef } from "./videoPlayback/playbackTypes";

type UseVideoEditorKeyboardShortcutsOptions = {
	shortcuts: ShortcutsConfig;
	isMac: boolean;
	handleUndo: () => void;
	handleRedo: () => void;
	handleOpenExport: () => void;
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
};

export function useVideoEditorKeyboardShortcuts({
	shortcuts,
	isMac,
	handleUndo,
	handleRedo,
	handleOpenExport,
	videoPlaybackRef,
}: UseVideoEditorKeyboardShortcutsOptions) {
	const { isConfigOpen } = useShortcuts();
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// While a new binding is being recorded, the key press belongs to the dialog.
			if (isConfigOpen) return;
			const target = e.target as HTMLElement | null;
			const isEditableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			const usesPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();

			if (usesPrimaryModifier && !e.altKey && key === "z") {
				if (!isEditableTarget) {
					e.preventDefault();
					if (e.shiftKey) {
						handleRedo();
					} else {
						handleUndo();
					}
				}
				return;
			}

			if (usesPrimaryModifier && !e.altKey && !e.shiftKey && key === "e") {
				if (isEditableTarget) return;
				e.preventDefault();
				handleOpenExport();
				return;
			}

			if (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && key === "y") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleRedo();
				}
				return;
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [shortcuts, isMac, isConfigOpen, handleUndo, handleRedo, handleOpenExport, videoPlaybackRef]);
}
