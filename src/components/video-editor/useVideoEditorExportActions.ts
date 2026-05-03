import { type Dispatch, type MutableRefObject, useCallback } from "react";
import { toast } from "sonner";
import { VideoExporter } from "@/lib/exporter/videoExporter";
import type { EditorSessionAction } from "./editorSession";

export type PendingExportSave = {
	fileName: string;
	blob: Blob;
};

type UseVideoEditorExportActionsOptions = {
	exportV2JobIdRef: MutableRefObject<string | null>;
	exporterRef: MutableRefObject<VideoExporter | null>;
	pendingExportSaveRef: MutableRefObject<PendingExportSave | null>;
	dispatchSession: Dispatch<EditorSessionAction>;
};

export function useVideoEditorExportActions({
	exportV2JobIdRef,
	exporterRef,
	pendingExportSaveRef,
	dispatchSession,
}: UseVideoEditorExportActionsOptions) {
	const showExportSuccessToast = useCallback((filePath: string) => {
		toast.success(`Exported successfully to ${filePath}`, {
			action: {
				label: "Show in Folder",
				onClick: async () => {
					try {
						const result = await window.electronAPI.revealInFolder(filePath);
						if (!result.success) {
							const errorMessage =
								result.error || result.message || "Failed to reveal item in folder.";
							toast.error(errorMessage);
						}
					} catch (err) {
						toast.error(`Error revealing in folder: ${String(err)}`);
					}
				},
			},
		});
	}, []);

	const handleCancelExport = useCallback(() => {
		if (exportV2JobIdRef.current) {
			void window.electronAPI.exportV2Cancel(exportV2JobIdRef.current);
			exportV2JobIdRef.current = null;
			toast.info("Export canceled");
			dispatchSession({ type: "set-export-dialog-open", value: false });
			dispatchSession({ type: "set-exporting", value: false });
			dispatchSession({ type: "set-export-status", status: "idle" });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
			return;
		}

		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			dispatchSession({ type: "set-export-dialog-open", value: false });
			dispatchSession({ type: "set-exporting", value: false });
			dispatchSession({ type: "set-export-status", status: "idle" });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
		}
	}, [dispatchSession, exportV2JobIdRef, exporterRef]);

	const handleExportDialogClose = useCallback(() => {
		dispatchSession({ type: "set-export-dialog-open", value: false });
		dispatchSession({ type: "set-exported-file-path", path: undefined });
		dispatchSession({ type: "set-export-error", error: null });
		dispatchSession({ type: "set-export-status", status: "idle" });
	}, [dispatchSession]);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		dispatchSession({ type: "set-export-error", error: null });
		dispatchSession({ type: "set-export-status", status: "awaiting-save-path" });
		try {
			const savePathResult = await window.electronAPI.showExportSaveDialog(pendingSave.fileName);

			if ("canceled" in savePathResult && savePathResult.canceled) {
				dispatchSession({
					type: "set-export-error",
					error: "Save dialog canceled. Click Save Again to save without re-rendering.",
				});
				dispatchSession({ type: "set-export-status", status: "canceled" });
				toast.info("Save canceled. You can try again.");
				return;
			}

			if (!savePathResult.success || !savePathResult.path) {
				const errorMessage = savePathResult.message || "Failed to open save dialog";
				dispatchSession({ type: "set-export-error", error: errorMessage });
				dispatchSession({ type: "set-export-status", status: "failed" });
				toast.error(errorMessage);
				return;
			}

			dispatchSession({ type: "set-export-status", status: "saving" });
			const arrayBuffer = await pendingSave.blob.arrayBuffer();
			const writeResult = await window.electronAPI.writeExportedVideoToPath(
				arrayBuffer,
				savePathResult.path,
			);

			if (writeResult.success && writeResult.path) {
				pendingExportSaveRef.current = null;
				dispatchSession({ type: "set-pending-export-save", value: false });
				dispatchSession({ type: "set-export-error", error: null });
				dispatchSession({ type: "set-exported-file-path", path: writeResult.path });
				dispatchSession({ type: "set-export-status", status: "saved" });
				dispatchSession({ type: "set-export-dialog-open", value: false });
				showExportSuccessToast(writeResult.path);
				return;
			}

			const errorMessage = writeResult.message || "Failed to save video";
			dispatchSession({ type: "set-export-error", error: errorMessage });
			dispatchSession({ type: "set-export-status", status: "failed" });
			toast.error(errorMessage);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			dispatchSession({ type: "set-export-error", error: errorMessage });
			dispatchSession({ type: "set-export-status", status: "failed" });
			toast.error(errorMessage);
		}
	}, [dispatchSession, pendingExportSaveRef, showExportSuccessToast]);

	const openRecordingsFolder = useCallback(async () => {
		try {
			const result = await window.electronAPI.openRecordingsFolder();
			if (!result.success) {
				toast.error(result.message || result.error || "Failed to open recordings folder.");
			}
		} catch (error) {
			toast.error(`Failed to open recordings folder: ${String(error)}`);
		}
	}, []);

	return {
		showExportSuccessToast,
		handleCancelExport,
		handleExportDialogClose,
		handleRetrySaveExport,
		openRecordingsFolder,
	};
}
