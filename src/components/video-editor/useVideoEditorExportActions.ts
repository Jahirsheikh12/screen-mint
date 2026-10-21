import { type Dispatch, type MutableRefObject, useCallback } from "react";
import { toast } from "sonner";
import { VideoExporter } from "@/lib/exporter/videoExporter";
import type { EditorSessionAction } from "./editorSession";

/** A finished render waiting for a save location; kept so "Save Again" doesn't re-render. */
export type PendingExportSave = {
	fileName: string;
	blob?: Blob;
	tempPath?: string;
	captionSidecar?: { srt?: string; vtt?: string };
};

type Translate = (key: string, fallback?: string, vars?: Record<string, string | number>) => string;

type UseVideoEditorExportActionsOptions = {
	exportV2JobIdRef: MutableRefObject<string | null>;
	exporterRef: MutableRefObject<VideoExporter | null>;
	pendingExportSaveRef: MutableRefObject<PendingExportSave | null>;
	dispatchSession: Dispatch<EditorSessionAction>;
	t: Translate;
};

export function useVideoEditorExportActions({
	exportV2JobIdRef,
	exporterRef,
	pendingExportSaveRef,
	dispatchSession,
	t,
}: UseVideoEditorExportActionsOptions) {
	const showExportSuccessToast = useCallback(
		(filePath: string) => {
			toast.success(t("export.savedTo", "Exported to {{path}}", { path: filePath }), {
				action: {
					label: t("export.showInFolder", "Show in Folder"),
					onClick: async () => {
						try {
							const result = await window.electronAPI.revealInFolder(filePath);
							if (!result.success) {
								const errorMessage =
									result.error ||
									result.message ||
									t("export.revealFailed", "Failed to show the file in its folder.");
								toast.error(errorMessage);
							}
						} catch (err) {
							toast.error(`Error revealing in folder: ${String(err)}`);
						}
					},
				},
			});
		},
		[t],
	);

	const discardPendingSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		dispatchSession({ type: "set-pending-export-save", value: false });
		if (pending?.tempPath) {
			void window.electronAPI.discardExportedTemp(pending.tempPath);
		}
	}, [dispatchSession, pendingExportSaveRef]);

	const handleCancelExport = useCallback(() => {
		if (exportV2JobIdRef.current) {
			void window.electronAPI.exportV2Cancel(exportV2JobIdRef.current);
			exportV2JobIdRef.current = null;
			toast.info(t("export.canceled", "Export canceled"));
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
			toast.info(t("export.canceled", "Export canceled"));
			dispatchSession({ type: "set-export-dialog-open", value: false });
			dispatchSession({ type: "set-exporting", value: false });
			dispatchSession({ type: "set-export-status", status: "idle" });
			dispatchSession({ type: "set-export-progress", progress: null });
			dispatchSession({ type: "set-export-error", error: null });
			dispatchSession({ type: "set-exported-file-path", path: undefined });
		}
	}, [dispatchSession, exportV2JobIdRef, exporterRef, t]);

	const handleExportDialogClose = useCallback(() => {
		discardPendingSave();
		dispatchSession({ type: "set-export-dialog-open", value: false });
		dispatchSession({ type: "set-exported-file-path", path: undefined });
		dispatchSession({ type: "set-export-error", error: null });
		dispatchSession({ type: "set-export-status", status: "idle" });
	}, [discardPendingSave, dispatchSession]);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		dispatchSession({ type: "set-export-error", error: null });
		dispatchSession({ type: "set-export-status", status: "awaiting-save-path" });
		const fail = (message: string) => {
			dispatchSession({ type: "set-export-error", error: message });
			dispatchSession({ type: "set-export-status", status: "failed" });
			toast.error(message);
		};
		try {
			let result: { success: boolean; path?: string; canceled?: boolean; message?: string };
			if (pendingSave.tempPath) {
				result = await window.electronAPI.finalizeExportedTemp({
					tempPath: pendingSave.tempPath,
					fileName: pendingSave.fileName,
					captionSidecar: pendingSave.captionSidecar,
				});
			} else if (pendingSave.blob) {
				const savePathResult = await window.electronAPI.showExportSaveDialog(pendingSave.fileName);
				if (!savePathResult.success || !savePathResult.path) {
					result = savePathResult;
				} else {
					dispatchSession({ type: "set-export-status", status: "saving" });
					result = await window.electronAPI.writeExportedVideoToPath(
						await pendingSave.blob.arrayBuffer(),
						savePathResult.path,
						pendingSave.captionSidecar,
					);
				}
			} else {
				return;
			}

			if (result.canceled) {
				dispatchSession({
					type: "set-export-error",
					error: t(
						"export.saveCanceled",
						"Save canceled. Click Save Again to save without rendering again.",
					),
				});
				dispatchSession({ type: "set-export-status", status: "canceled" });
				return;
			}

			if (result.success && result.path) {
				pendingExportSaveRef.current = null;
				dispatchSession({ type: "set-pending-export-save", value: false });
				dispatchSession({ type: "set-export-error", error: null });
				dispatchSession({ type: "set-exported-file-path", path: result.path });
				dispatchSession({ type: "set-export-status", status: "saved" });
				showExportSuccessToast(result.path);
				return;
			}

			fail(result.message || t("export.saveFailed", "Failed to save the export"));
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	}, [dispatchSession, pendingExportSaveRef, showExportSuccessToast, t]);

	const openRecordingsFolder = useCallback(async () => {
		try {
			const result = await window.electronAPI.openRecordingsFolder();
			if (!result.success) {
				toast.error(
					result.message ||
						result.error ||
						t("export.openFolderFailed", "Failed to open the recordings folder."),
				);
			}
		} catch (error) {
			toast.error(
				`${t("export.openFolderFailed", "Failed to open the recordings folder.")} ${String(error)}`,
			);
		}
	}, [t]);

	return {
		showExportSuccessToast,
		handleCancelExport,
		handleExportDialogClose,
		handleRetrySaveExport,
		discardPendingSave,
		openRecordingsFolder,
	};
}
