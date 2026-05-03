import { type Dispatch, type SetStateAction, useCallback } from "react";
import { toast } from "sonner";
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
			toast.success(`Applied ${preset.name} preset.`);
		},
		[applyEditorControls],
	);

	const handleSavePreset = useCallback(() => {
		dispatchSession({ type: "open-preset-dialog", name: "My preset" });
	}, [dispatchSession]);

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
		toast.success(`Saved ${name} preset.`);
	}, [
		buildCurrentPresetControls,
		dispatchSession,
		sessionState.modals.presetDialog.name,
		setCustomPresets,
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
					title: "Delete preset?",
					description: `Delete the preset "${target.name}"?`,
					confirmLabel: "Delete preset",
					payload: presetId,
					tone: "danger",
				},
			});
		},
		[customPresets, dispatchSession],
	);

	const handleDeleteProject = useCallback(async () => {
		const dialog: ConfirmDialogState = {
			kind: "delete-project",
			title: "Delete project?",
			description: [
				"Delete this ScreenMint project and any managed recording media?",
				"",
				"Imported files outside the ScreenMint recordings folder will be kept.",
			].join("\n"),
			confirmLabel: "Delete project",
			tone: "danger",
		};
		dispatchSession({ type: "open-confirm-dialog", dialog });
	}, [dispatchSession]);

	const confirmDeleteProject = useCallback(async () => {
		dispatchSession({ type: "close-confirm-dialog" });

		const result = await window.electronAPI.deleteProjectAndMedia({
			projectPath: currentProjectPath,
			videoPath: videoSourcePath,
			webcamPath,
		});

		if (!result.success) {
			toast.error(result.message || result.error || "Failed to delete the project.");
			return;
		}

		const deletedCount = result.deletedPaths?.length ?? 0;
		const skippedCount = result.skippedPaths?.length ?? 0;
		toast.success(
			deletedCount > 0
				? `Deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"}.${
						skippedCount > 0
							? ` Kept ${skippedCount} external file${skippedCount === 1 ? "" : "s"}.`
							: ""
					}`
				: skippedCount > 0
					? `Removed this recording from the editor. Kept ${skippedCount} external file${
							skippedCount === 1 ? "" : "s"
						}.`
					: "Project removed.",
		);

		await window.electronAPI.switchToHud();
	}, [currentProjectPath, dispatchSession, videoSourcePath, webcamPath]);

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
				toast.success(`Deleted ${target.name} preset.`);
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
