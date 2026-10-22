import fs from "node:fs/promises";
import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";

interface CurrentMediaIpcState {
	getVideoPath: () => string | null;
	setVideoPath: (path: string | null) => void;
	setProjectPath: (path: string | null) => void;
	getWebcamPath: () => string | null;
	setWebcamPath: (path: string | null) => void;
	setMicrophoneAudioPath: (path: string | null) => void;
	normalizeVideoSourcePath: (videoPath?: string | null) => string | null;
}

export function registerCurrentMediaIpcHandlers({
	getVideoPath,
	setVideoPath,
	setProjectPath,
	getWebcamPath,
	setWebcamPath,
	setMicrophoneAudioPath,
	normalizeVideoSourcePath,
}: CurrentMediaIpcState) {
	ipcMain.handle(IPC_CHANNELS.currentMedia.setVideoPath, (_, path: string) => {
		const normalizedPath = normalizeVideoSourcePath(path) ?? path;
		const isSameVideoPath = getVideoPath() === normalizedPath;
		setVideoPath(normalizedPath);
		setProjectPath(null);
		if (!isSameVideoPath) {
			setMicrophoneAudioPath(null);
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.currentMedia.getVideoPath, () => {
		const currentVideoPath = getVideoPath();
		return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
	});

	ipcMain.handle(IPC_CHANNELS.currentMedia.setWebcamPath, (_, path: string) => {
		setWebcamPath(path);
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.currentMedia.getWebcamPath, () => {
		const currentWebcamPath = getWebcamPath();
		return currentWebcamPath ? { success: true, path: currentWebcamPath } : { success: false };
	});

	ipcMain.handle(IPC_CHANNELS.currentMedia.clearWebcamPath, () => {
		setWebcamPath(null);
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.files.checkFileAvailable, async (_, filePath: string) => {
		try {
			const normalizedPath = normalizeVideoSourcePath(filePath);
			if (!normalizedPath) {
				return { success: true, exists: false };
			}

			await fs.access(normalizedPath);
			return { success: true, exists: true, path: normalizedPath };
		} catch (error) {
			return {
				success: true,
				exists: false,
				error: String(error),
			};
		}
	});
}
