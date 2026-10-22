import fs from "node:fs/promises";
import path from "node:path";
import { app, clipboard, dialog, ipcMain, type SaveDialogOptions, shell } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { ensureFileExtension } from "../../src/lib/fileNames";
import {
	type CaptionSidecarFiles,
	isExportTempPath,
	moveFile,
	writeCaptionSidecars,
} from "../exportTemp";

interface ExportFileIpcHandlersContext {
	getRecordingsDir: () => Promise<string>;
	getExportSaveDialogOptions: (fileName: string) => SaveDialogOptions;
	setCurrentProjectPath: (path: string | null) => void;
	writeBufferToUniqueFile: (directory: string, fileName: string, buffer: Buffer) => Promise<string>;
}

export function registerExportFileIpcHandlers({
	getRecordingsDir,
	getExportSaveDialogOptions,
	setCurrentProjectPath,
	writeBufferToUniqueFile,
}: ExportFileIpcHandlersContext) {
	ipcMain.handle(IPC_CHANNELS.exportFiles.showSaveDialog, async (_, fileName: string) => {
		try {
			const result = await dialog.showSaveDialog(getExportSaveDialogOptions(fileName));

			if (result.canceled || !result.filePath) {
				return {
					success: false,
					canceled: true,
					message: "Export canceled",
				};
			}

			return {
				success: true,
				path: result.filePath,
			};
		} catch (error) {
			console.error("Failed to show export save dialog:", error);
			return {
				success: false,
				message: "Failed to open save dialog",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.exportFiles.writeVideoToPath,
		async (_, videoData: ArrayBuffer, filePath: string, captionSidecar?: CaptionSidecarFiles) => {
			try {
				await fs.writeFile(filePath, Buffer.from(videoData));
				await writeCaptionSidecars(filePath, captionSidecar);

				return {
					success: true,
					path: filePath,
					message: "Video exported successfully",
				};
			} catch (error) {
				console.error("Failed to write exported video:", error);
				return {
					success: false,
					message: "Failed to save exported video",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		IPC_CHANNELS.exportFiles.finalizeTemp,
		async (
			_,
			payload: { tempPath: unknown; fileName: unknown; captionSidecar?: CaptionSidecarFiles },
		) => {
			const tempRoot = app.getPath("temp");
			if (!isExportTempPath(tempRoot, payload?.tempPath) || typeof payload.fileName !== "string") {
				return { success: false, message: "Invalid export to save" };
			}
			try {
				await fs.access(payload.tempPath);
			} catch {
				return { success: false, message: "The rendered export is no longer available" };
			}
			try {
				const result = await dialog.showSaveDialog(getExportSaveDialogOptions(payload.fileName));
				if (result.canceled || !result.filePath) {
					return { success: false, canceled: true, message: "Export canceled" };
				}
				await moveFile(payload.tempPath, result.filePath);
				await writeCaptionSidecars(result.filePath, payload.captionSidecar);
				return { success: true, path: result.filePath };
			} catch (error) {
				console.error("Failed to save rendered export:", error);
				return { success: false, message: "Failed to save exported file", error: String(error) };
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.exportFiles.discardTemp, async (_, tempPath: unknown) => {
		if (!isExportTempPath(app.getPath("temp"), tempPath)) {
			return { success: false };
		}
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		return { success: true };
	});

	ipcMain.handle(
		IPC_CHANNELS.exportFiles.saveVideoToRecordings,
		async (_, videoData: ArrayBuffer, fileName: string) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const extension = fileName.toLowerCase().endsWith(".gif") ? "gif" : "mp4";
				const safeName = ensureFileExtension(fileName, extension);
				const targetPath = await writeBufferToUniqueFile(
					recordingsDir,
					safeName,
					Buffer.from(videoData),
				);
				return {
					success: true,
					path: targetPath,
					message: "Video saved to recordings folder",
				};
			} catch (error) {
				console.error("Failed to save exported video to recordings:", error);
				return {
					success: false,
					message: "Failed to save exported video to recordings",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.files.openVideoPicker, async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: "Select Video File",
				defaultPath: recordingsDir,
				filters: [
					{ name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			setCurrentProjectPath(null);
			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open file picker:", error);
			return {
				success: false,
				message: "Failed to open file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.openAudioPicker, async () => {
		try {
			const result = await dialog.showOpenDialog({
				title: "Select Audio File",
				filters: [
					{ name: "Audio Files", extensions: ["mp3", "wav", "aac", "m4a", "flac", "ogg"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open audio file picker:", error);
			return {
				success: false,
				message: "Failed to open audio file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.openBackgroundVideoPicker, async () => {
		try {
			const result = await dialog.showOpenDialog({
				title: "Select Background Video",
				// Formats Chromium can decode in the preview and the export renderer.
				filters: [{ name: "Video Files", extensions: ["mp4", "m4v", "webm", "mov"] }],
				properties: ["openFile"],
			});
			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}
			return { success: true, path: result.filePaths[0] };
		} catch (error) {
			console.error("Failed to open background video picker:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.openImagePicker, async () => {
		try {
			const result = await dialog.showOpenDialog({
				title: "Select Image File",
				filters: [
					{
						name: "Image Files",
						extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"],
					},
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open image file picker:", error);
			return {
				success: false,
				message: "Failed to open image file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.revealInFolder, async (_, filePath: string) => {
		try {
			shell.showItemInFolder(filePath);
			return { success: true };
		} catch (error) {
			console.error(`Error revealing item in folder: ${filePath}`, error);
			try {
				const openPathResult = await shell.openPath(path.dirname(filePath));
				if (openPathResult) {
					return { success: false, error: openPathResult };
				}
				return { success: true, message: "Could not reveal item, but opened directory." };
			} catch (openError) {
				console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
				return { success: false, error: String(error) };
			}
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.openRecordingsFolder, async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const openPathResult = await shell.openPath(recordingsDir);
			if (openPathResult) {
				return {
					success: false,
					error: openPathResult,
					message: "Failed to open recordings folder.",
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Failed to open recordings folder:", error);
			return { success: false, error: String(error), message: "Failed to open recordings folder." };
		}
	});

	ipcMain.handle(IPC_CHANNELS.files.copyTextToClipboard, async (_, text: string) => {
		try {
			clipboard.writeText(text);
			return { success: true, message: "Copied to clipboard" };
		} catch (error) {
			console.error("Failed to copy text to clipboard:", error);
			return {
				success: false,
				message: "Failed to copy text to clipboard",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.files.copyExportedToClipboard,
		async (_, videoData: ArrayBuffer, fileName: string) => {
			try {
				const ext = fileName.toLowerCase().endsWith(".gif") ? "gif" : "mp4";
				const tmpPath = path.join(app.getPath("temp"), `screenmint-clipboard-${Date.now()}.${ext}`);
				await fs.writeFile(tmpPath, Buffer.from(videoData));

				if (process.platform === "darwin") {
					const plistContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${tmpPath}</string></array></plist>`;
					clipboard.writeBuffer("NSFilenamesPboardType", Buffer.from(plistContent, "utf8"));
				} else {
					clipboard.writeText(tmpPath);
				}

				return { success: true, path: tmpPath };
			} catch (error) {
				console.error("Failed to copy exported file to clipboard:", error);
				return { success: false, error: String(error) };
			}
		},
	);
}
