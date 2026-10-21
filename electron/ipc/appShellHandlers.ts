import { app, type BrowserWindow, ipcMain, shell } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { createAnnouncementService } from "../announcements";

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

	const announcements = createAnnouncementService(app.getPath("userData"));
	ipcMain.handle(IPC_CHANNELS.announcements.get, () => announcements.getAnnouncements());
	ipcMain.handle(IPC_CHANNELS.announcements.dismiss, (_, id: unknown) =>
		typeof id === "string" && id ? announcements.dismiss(id) : undefined,
	);

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
