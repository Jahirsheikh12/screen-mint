import { type Dispatch, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PostRecordingContext } from "@/lib/recording/postRecording";
import type { EditorSessionAction } from "./editorSession";
import {
	isPostRecordingAutoZoomPending,
	type PostRecordingAutoZoomBootstrapState,
} from "./postRecordingAutoZoomUtils";

type UsePostRecordingActionsOptions = {
	loading: boolean;
	error: string | null;
	videoPath: string | null;
	duration: number;
	postRecordingContext: PostRecordingContext | null;
	postRecordingAutoZoomBootstrap: PostRecordingAutoZoomBootstrapState | null;
	dispatchSession: Dispatch<EditorSessionAction>;
	handleOpenExportDialog: () => void;
	handleExportToClipboard: () => Promise<void>;
};

export function usePostRecordingActions({
	loading,
	error,
	videoPath,
	duration,
	postRecordingContext,
	postRecordingAutoZoomBootstrap,
	dispatchSession,
	handleOpenExportDialog,
	handleExportToClipboard,
}: UsePostRecordingActionsOptions) {
	const handledPostRecordingContextRef = useRef<string | null>(null);

	useEffect(() => {
		if (loading || error || !videoPath || !postRecordingContext) {
			return;
		}

		if (isPostRecordingAutoZoomPending(postRecordingAutoZoomBootstrap, videoPath)) {
			return;
		}

		if (
			(postRecordingContext.action === "export-save-file" ||
				postRecordingContext.action === "export-clipboard") &&
			duration <= 0
		) {
			return;
		}

		const contextKey = JSON.stringify(postRecordingContext);
		if (handledPostRecordingContextRef.current === contextKey) {
			return;
		}

		handledPostRecordingContextRef.current = contextKey;

		void (async () => {
			switch (postRecordingContext.action) {
				case "export-save-file":
					handleOpenExportDialog();
					break;
				case "export-clipboard":
					await handleExportToClipboard();
					break;
				case "export-share-link":
					dispatchSession({ type: "set-quick-share-open", value: true });
					toast.info("Share links are not available yet. Opening Quick Share instead.");
					break;
				case "create-project":
				default:
					if (postRecordingContext.openQuickShare) {
						dispatchSession({ type: "set-quick-share-open", value: true });
					}
					break;
			}

			await window.electronAPI.clearPostRecordingContext();
			dispatchSession({ type: "set-post-recording-context", context: null });
		})();
	}, [
		dispatchSession,
		duration,
		error,
		handleExportToClipboard,
		handleOpenExportDialog,
		loading,
		postRecordingAutoZoomBootstrap,
		postRecordingContext,
		videoPath,
	]);
}
