import { type Dispatch, type SetStateAction, useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import type { EditorPreset, EditorWorkspaceLayout } from "./editorPreferences";
import type { ConfirmDialogState, EditorSessionAction, EditorSessionState } from "./editorSession";
import { normalizeProjectEditor } from "./projectPersistence";

type UseVideoEditorProjectActionsOptions = {
	currentProjectPath: string | null;
	videoSourcePath: string | null;
	webcamPath: string | null;
	customPresets: EditorPreset[];
	setCustomPresets: Dispatch<SetStateAction<EditorPreset[]>>;
	setWorkspaceLayout: Dispatch<SetStateAction<EditorWorkspaceLayout>>;
	sessionState: EditorSessionState;
	dispatchSession: Dispatch<EditorSessionAction>;
	buildCurrentPresetControls: () => EditorPreset["controls"];
	applyEditorControls: (controls: ReturnType<typeof normalizeProjectEditor>) => void;
	handleOpenExportDialog: () => void;
};

export function useVideoEditorProjectActions({
	currentProjectPath,
	videoSourcePath,
	webcamPath,
	customPresets,
	setCustomPresets,
	setWorkspaceLayout,
	sessionState,
	dispatchSession,
	buildCurrentPresetControls,
	applyEditorControls,
	handleOpenExportDialog,
}: UseVideoEditorProjectActionsOptions) {
	const { t } = useI18n();
	const handleQuickShareSave = useCallback(() => {
		dispatchSession({ type: "set-quick-share-open", value: false });
		handleOpenExportDialog();
	}, [dispatchSession, handleOpenExportDialog]);

	const handleQuickShareEdit = useCallback(() => {
		dispatchSession({ type: "set-quick-share-open", value: false });
	}, [dispatchSession]);

	const cycleWorkspaceLayout = useCallback(() => {
		setWorkspaceLayout((current) => {
			if (current === "default") return "preview-focus";
			if (current === "preview-focus") return "timeline-focus";
			return "default";
		});
	}, [setWorkspaceLayout]);

	const applyPreset = useCallback(
		(preset: EditorPreset) => {
			applyEditorControls(normalizeProjectEditor(preset.controls));
			toast.success(
				t("editor.shell.presetApplied", "Applied {{name}} preset.", { name: preset.name }),
			);
		},
		[applyEditorControls, t],
	);

	const handleSavePreset = useCallback(() => {
		dispatchSession({
			type: "open-preset-dialog",
			name: t("dialogs.editor.myPreset", "My preset"),
		});
	}, [dispatchSession, t]);

	const handleConfirmSavePreset = useCallback(() => {
		const name = sessionState.modals.presetDialog.name.trim();
		if (!name) {
			return;
		}

		const preset: EditorPreset = {
			id: `preset-${Date.now()}`,
			name,
			controls: buildCurrentPresetControls(),
		};

		setCustomPresets((prev) => [...prev, preset]);
		dispatchSession({ type: "close-preset-dialog" });
		toast.success(t("editor.shell.presetSaved", "Saved {{name}} preset.", { name }));
	}, [
		buildCurrentPresetControls,
		dispatchSession,
		sessionState.modals.presetDialog.name,
		setCustomPresets,
		t,
	]);

	const handleDeletePreset = useCallback(
		(presetId: string) => {
			const target = customPresets.find((preset) => preset.id === presetId);
			if (!target) {
				return;
			}

			dispatchSession({
				type: "open-confirm-dialog",
				dialog: {
					kind: "delete-preset",
					title: t("dialogs.editor.deletePresetTitle", "Delete preset?"),
					description: t(
						"dialogs.editor.deletePresetDescription",
						'Delete the preset "{{name}}"?',
						{
							name: target.name,
						},
					),
					confirmLabel: t("dialogs.editor.deletePresetConfirm", "Delete preset"),
					payload: presetId,
					tone: "danger",
				},
			});
		},
		[customPresets, dispatchSession, t],
	);

	const handleDeleteProject = useCallback(async () => {
		const dialog: ConfirmDialogState = {
			kind: "delete-project",
			title: t("dialogs.editor.deleteProjectTitle", "Delete project?"),
			description: t(
				"dialogs.editor.deleteProjectDescription",
				"Delete this ScreenMint project and any managed recording media?\n\nImported files outside the ScreenMint recordings folder will be kept.",
			),
			confirmLabel: t("dialogs.editor.deleteProjectConfirm", "Delete project"),
			tone: "danger",
		};
		dispatchSession({ type: "open-confirm-dialog", dialog });
	}, [dispatchSession, t]);

	const confirmDeleteProject = useCallback(async () => {
		dispatchSession({ type: "close-confirm-dialog" });

		const result = await window.electronAPI.deleteProjectAndMedia({
			projectPath: currentProjectPath,
			videoPath: videoSourcePath,
			webcamPath,
		});

		if (!result.success) {
			toast.error(t("editor.shell.projectDeleteFailed", "Failed to delete the project."), {
				description: result.message || result.error,
			});
			return;
		}

		const deletedCount = result.deletedPaths?.length ?? 0;
		const skippedCount = result.skippedPaths?.length ?? 0;
		const keptMessage =
			skippedCount > 0
				? t("editor.shell.externalFilesKept", "External files kept: {{count}}.", {
						count: skippedCount,
					})
				: "";
		toast.success(
			deletedCount > 0
				? [
						t("editor.shell.filesDeleted", "Files deleted: {{count}}.", { count: deletedCount }),
						keptMessage,
					]
						.filter(Boolean)
						.join(" ")
				: skippedCount > 0
					? `${t("editor.shell.recordingRemovedFromEditor", "Removed this recording from the editor.")} ${keptMessage}`
					: t("editor.shell.projectRemoved", "Project removed."),
		);

		await window.electronAPI.switchToHud();
	}, [currentProjectPath, dispatchSession, videoSourcePath, webcamPath, t]);

	const handleConfirmDialogAction = useCallback(async () => {
		const dialog = sessionState.modals.confirmDialog;
		if (!dialog) {
			return;
		}

		if (dialog.kind === "delete-preset" && dialog.payload) {
			const target = customPresets.find((preset) => preset.id === dialog.payload);
			setCustomPresets((prev) => prev.filter((preset) => preset.id !== dialog.payload));
			dispatchSession({ type: "close-confirm-dialog" });
			if (target) {
				toast.success(
					t("editor.shell.presetDeleted", "Deleted {{name}} preset.", { name: target.name }),
				);
			}
			return;
		}

		if (dialog.kind === "delete-project") {
			await confirmDeleteProject();
		}
	}, [
		confirmDeleteProject,
		customPresets,
		dispatchSession,
		sessionState.modals.confirmDialog,
		setCustomPresets,
		t,
	]);

	return {
		handleQuickShareSave,
		handleQuickShareEdit,
		cycleWorkspaceLayout,
		applyPreset,
		handleSavePreset,
		handleConfirmSavePreset,
		handleDeletePreset,
		handleDeleteProject,
		handleConfirmDialogAction,
	};
}
