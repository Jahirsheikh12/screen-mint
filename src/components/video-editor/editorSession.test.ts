import { describe, expect, it } from "vitest";
import { createInitialEditorSessionState, editorSessionReducer } from "./editorSession";

describe("editorSessionReducer", () => {
	it("opens and updates the preset dialog", () => {
		let state = createInitialEditorSessionState();
		state = editorSessionReducer(state, { type: "open-preset-dialog", name: "Demo" });
		state = editorSessionReducer(state, { type: "set-preset-dialog-name", name: "Launch Cut" });

		expect(state.modals.presetDialog.isOpen).toBe(true);
		expect(state.modals.presetDialog.name).toBe("Launch Cut");
	});

	it("tracks confirm dialogs and export feedback independently", () => {
		let state = createInitialEditorSessionState();
		state = editorSessionReducer(state, {
			type: "open-confirm-dialog",
			dialog: {
				kind: "delete-project",
				title: "Delete project?",
				description: "This cannot be undone.",
				confirmLabel: "Delete",
				tone: "danger",
			},
		});
		state = editorSessionReducer(state, { type: "set-export-error", error: "Save canceled" });
		state = editorSessionReducer(state, { type: "set-pending-export-save", value: true });
		state = editorSessionReducer(state, { type: "reset-export-feedback" });

		expect(state.modals.confirmDialog?.kind).toBe("delete-project");
		expect(state.exportError).toBeNull();
		expect(state.hasPendingExportSave).toBe(false);
	});

	it("tracks explicit export save states", () => {
		let state = createInitialEditorSessionState();

		state = editorSessionReducer(state, { type: "set-export-status", status: "exporting" });
		expect(state.exportStatus).toBe("exporting");

		state = editorSessionReducer(state, {
			type: "set-export-status",
			status: "awaiting-save-path",
		});
		expect(state.exportStatus).toBe("awaiting-save-path");

		state = editorSessionReducer(state, { type: "set-export-status", status: "saving" });
		expect(state.exportStatus).toBe("saving");

		state = editorSessionReducer(state, { type: "set-export-status", status: "saved" });
		expect(state.exportStatus).toBe("saved");
	});

	it("resets export feedback back to idle", () => {
		let state = createInitialEditorSessionState();
		state = editorSessionReducer(state, { type: "set-export-status", status: "failed" });
		state = editorSessionReducer(state, { type: "set-pending-export-save", value: true });

		state = editorSessionReducer(state, { type: "reset-export-feedback" });

		expect(state.exportStatus).toBe("idle");
		expect(state.hasPendingExportSave).toBe(false);
	});
});
