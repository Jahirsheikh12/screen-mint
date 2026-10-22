import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { editorPreferencesService } from "./editorPreferencesService";

type UseVideoEditorProjectFileActionsOptions = {
	hasUnsavedChanges: boolean;
	isExporting: boolean;
	isTranscribing: boolean;
	saveProject: (forceSaveAs: boolean) => Promise<boolean>;
	applyLoadedProject: (candidate: unknown, path?: string | null) => Promise<boolean>;
};

export function useVideoEditorProjectFileActions({
	hasUnsavedChanges,
	isExporting,
	isTranscribing,
	saveProject,
	applyLoadedProject,
}: UseVideoEditorProjectFileActionsOptions) {
	const { t } = useI18n();
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			editorPreferencesService.flush();
			if (!hasUnsavedChanges) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		window.electronAPI.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		void window.electronAPI.setUpdaterBusyState({
			exporting: isExporting,
			transcribing: isTranscribing,
		});
	}, [isExporting, isTranscribing]);

	useEffect(() => {
		return () => {
			void window.electronAPI.setUpdaterBusyState({
				exporting: false,
				transcribing: false,
			});
		};
	}, []);

	useEffect(() => {
		const cleanup = window.electronAPI.onRequestSaveBeforeClose(() => saveProject(false));

		return () => cleanup?.();
	}, [saveProject]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		await saveProject(true);
	}, [saveProject]);

	const handleLoadProject = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();

		if (result.canceled) {
			return;
		}

		if (!result.success) {
			toast.error(t("editor.shell.failedToLoadProject", "Failed to load project"), {
				description: result.message,
			});
			return;
		}

		const restored = await applyLoadedProject(result.project, result.path ?? null);
		if (!restored) {
			toast.error(t("editor.shell.invalidProjectFile", "Invalid project file format"));
			return;
		}

		toast.success(
			t("editor.shell.projectLoadedFrom", "Project loaded from {{path}}", {
				path: result.path ?? "",
			}),
		);
	}, [applyLoadedProject, t]);

	const handleOpenProjectAtPath = useCallback(
		async (filePath: string) => {
			const result = await window.electronAPI.openProjectFileAtPath(filePath);
			if (!result.success) {
				toast.error(t("editor.shell.failedToOpenProject", "Failed to open project"), {
					description: result.message,
				});
				return false;
			}
			const restored = await applyLoadedProject(result.project, result.path ?? null);
			if (!restored) {
				toast.error(t("editor.shell.invalidProjectFile", "Invalid project file format"));
				return false;
			}
			return true;
		},
		[applyLoadedProject, t],
	);

	useEffect(() => {
		const removeLoadListener = window.electronAPI.onMenuLoadProject(handleLoadProject);
		const removeSaveListener = window.electronAPI.onMenuSaveProject(handleSaveProject);
		const removeSaveAsListener = window.electronAPI.onMenuSaveProjectAs(handleSaveProjectAs);

		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleLoadProject, handleSaveProject, handleSaveProjectAs]);

	return {
		handleSaveProject,
		handleSaveProjectAs,
		handleLoadProject,
		handleOpenProjectAtPath,
	};
}
