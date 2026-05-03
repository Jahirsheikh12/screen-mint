import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";

type RegisterExportV2StreamIpcHandlersOptions = {
	startExportV2StreamSession: (filePath: string) => Promise<{ id: string; path: string }>;
	appendExportV2StreamSession: (
		sessionId: string,
		chunk: ArrayBuffer,
		position: number,
	) => Promise<{ success: boolean; bytesWritten: number }>;
	finishExportV2StreamSession: (
		sessionId: string,
	) => Promise<{ path: string; bytesWritten: number }>;
	discardExportV2StreamSession: (sessionId: string) => Promise<void>;
};

export function registerExportV2StreamIpcHandlers({
	startExportV2StreamSession,
	appendExportV2StreamSession,
	finishExportV2StreamSession,
	discardExportV2StreamSession,
}: RegisterExportV2StreamIpcHandlersOptions) {
	ipcMain.handle(IPC_CHANNELS.exportV2.streamStart, async (_, filePath: string) => {
		try {
			const session = await startExportV2StreamSession(filePath);
			return { success: true, ...session };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.exportV2.streamAppend,
		async (_, sessionId: string, chunk: ArrayBuffer, position: number) => {
			try {
				return await appendExportV2StreamSession(sessionId, chunk, position);
			} catch (error) {
				return { success: false, error: String(error) };
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.exportV2.streamFinish, async (_, sessionId: string) => {
		try {
			const result = await finishExportV2StreamSession(sessionId);
			return { success: true, ...result };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.streamDiscard, async (_, sessionId: string) => {
		try {
			await discardExportV2StreamSession(sessionId);
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});
}
