import type { ExportDetails, ExportProgress } from "@/lib/exporter";
import type { PostRecordingContext } from "@/lib/recording/postRecording";

export type ExportStatus =
	| "idle"
	| "exporting"
	| "awaiting-save-path"
	| "saving"
	| "saved"
	| "canceled"
	| "failed";

export interface PresetDialogState {
	isOpen: boolean;
	name: string;
}

export interface ConfirmDialogState {
	kind: "delete-preset" | "delete-project";
	title: string;
	description: string;
	confirmLabel: string;
	payload?: string;
	tone?: "default" | "danger";
}

export interface EditorModalState {
	exportDialogOpen: boolean;
	exportSettingsOpen: boolean;
	quickShareOpen: boolean;
	presetDialog: PresetDialogState;
	confirmDialog: ConfirmDialogState | null;
}

export interface EditorSessionState {
	currentProjectPath: string | null;
	lastSavedSnapshot: string | null;
	isExporting: boolean;
	exportStatus: ExportStatus;
	exportProgress: ExportProgress | null;
	exportError: string | null;
	exportDetails: ExportDetails | null;
	exportedFilePath?: string;
	hasPendingExportSave: boolean;
	isTranscribing: boolean;
	postRecordingContext: PostRecordingContext | null;
	modals: EditorModalState;
}

export type EditorSessionAction =
	| { type: "set-current-project-path"; path: string | null }
	| { type: "set-last-saved-snapshot"; snapshot: string | null }
	| { type: "set-exporting"; value: boolean }
	| { type: "set-export-status"; status: ExportStatus }
	| { type: "set-export-progress"; progress: ExportProgress | null }
	| { type: "set-export-error"; error: string | null }
	| { type: "set-export-details"; details: ExportDetails | null }
	| { type: "set-exported-file-path"; path: string | undefined }
	| { type: "set-pending-export-save"; value: boolean }
	| { type: "set-transcribing"; value: boolean }
	| { type: "set-post-recording-context"; context: PostRecordingContext | null }
	| { type: "set-export-dialog-open"; value: boolean }
	| { type: "set-export-settings-open"; value: boolean }
	| { type: "set-quick-share-open"; value: boolean }
	| { type: "open-preset-dialog"; name?: string }
	| { type: "set-preset-dialog-name"; name: string }
	| { type: "close-preset-dialog" }
	| { type: "open-confirm-dialog"; dialog: ConfirmDialogState }
	| { type: "close-confirm-dialog" }
	| { type: "reset-export-feedback" };

export function createInitialEditorSessionState(): EditorSessionState {
	return {
		currentProjectPath: null,
		lastSavedSnapshot: null,
		isExporting: false,
		exportStatus: "idle",
		exportProgress: null,
		exportError: null,
		exportDetails: null,
		exportedFilePath: undefined,
		hasPendingExportSave: false,
		isTranscribing: false,
		postRecordingContext: null,
		modals: {
			exportDialogOpen: false,
			exportSettingsOpen: false,
			quickShareOpen: false,
			presetDialog: {
				isOpen: false,
				name: "",
			},
			confirmDialog: null,
		},
	};
}

export function editorSessionReducer(
	state: EditorSessionState,
	action: EditorSessionAction,
): EditorSessionState {
	switch (action.type) {
		case "set-current-project-path":
			return {
				...state,
				currentProjectPath: action.path,
			};
		case "set-last-saved-snapshot":
			return {
				...state,
				lastSavedSnapshot: action.snapshot,
			};
		case "set-exporting":
			return {
				...state,
				isExporting: action.value,
			};
		case "set-export-status":
			return {
				...state,
				exportStatus: action.status,
			};
		case "set-export-progress":
			return {
				...state,
				exportProgress: action.progress,
			};
		case "set-export-error":
			return {
				...state,
				exportError: action.error,
			};
		case "set-export-details":
			return {
				...state,
				exportDetails: action.details,
			};
		case "set-exported-file-path":
			return {
				...state,
				exportedFilePath: action.path,
			};
		case "set-pending-export-save":
			return {
				...state,
				hasPendingExportSave: action.value,
			};
		case "set-transcribing":
			return {
				...state,
				isTranscribing: action.value,
			};
		case "set-post-recording-context":
			return {
				...state,
				postRecordingContext: action.context,
			};
		case "set-export-dialog-open":
			return {
				...state,
				modals: {
					...state.modals,
					exportDialogOpen: action.value,
				},
			};
		case "set-export-settings-open":
			return {
				...state,
				modals: {
					...state.modals,
					exportSettingsOpen: action.value,
				},
			};
		case "set-quick-share-open":
			return {
				...state,
				modals: {
					...state.modals,
					quickShareOpen: action.value,
				},
			};
		case "open-preset-dialog":
			return {
				...state,
				modals: {
					...state.modals,
					presetDialog: {
						isOpen: true,
						name: action.name ?? "",
					},
				},
			};
		case "set-preset-dialog-name":
			return {
				...state,
				modals: {
					...state.modals,
					presetDialog: {
						...state.modals.presetDialog,
						name: action.name,
					},
				},
			};
		case "close-preset-dialog":
			return {
				...state,
				modals: {
					...state.modals,
					presetDialog: {
						isOpen: false,
						name: "",
					},
				},
			};
		case "open-confirm-dialog":
			return {
				...state,
				modals: {
					...state.modals,
					confirmDialog: action.dialog,
				},
			};
		case "close-confirm-dialog":
			return {
				...state,
				modals: {
					...state.modals,
					confirmDialog: null,
				},
			};
		case "reset-export-feedback":
			return {
				...state,
				exportProgress: null,
				exportError: null,
				exportDetails: null,
				exportedFilePath: undefined,
				hasPendingExportSave: false,
				exportStatus: "idle",
			};
	}
}
