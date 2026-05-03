import { type BrowserWindow, ipcMain, shell } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";

type RegisterAppShellIpcHandlersOptions = {
	createEditorWindow: () => void;
	createSourceSelectorWindow: () => BrowserWindow;
	createHudOverlay: () => BrowserWindow;
	getSourceSelectorWindow: () => BrowserWindow | null;
};

export function registerAppShellIpcHandlers({
	createEditorWindow,
	createSourceSelectorWindow,
	createHudOverlay,
	getSourceSelectorWindow,
}: RegisterAppShellIpcHandlersOptions) {
	ipcMain.handle(IPC_CHANNELS.windows.openSourceSelector, () => {
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.focus();
			return;
		}
		createSourceSelectorWindow();
	});

	ipcMain.handle(IPC_CHANNELS.windows.switchToEditor, () => {
		createEditorWindow();
	});

	ipcMain.handle(IPC_CHANNELS.windows.switchToHud, () => {
		createHudOverlay();
	});

	ipcMain.handle(IPC_CHANNELS.files.openExternalUrl, async (_, url: string) => {
		try {
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			console.error("Failed to open URL:", error);
			return { success: false, error: String(error) };
		}
	});
}
