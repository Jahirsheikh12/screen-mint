import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";

function resolveAssetBasePath() {
	try {
		if (app.isPackaged) {
			const assetPath = path.join(process.resourcesPath, "assets");
			return pathToFileURL(`${assetPath}${path.sep}`).toString();
		}

		const assetPath = path.join(app.getAppPath(), "public");
		return pathToFileURL(`${assetPath}${path.sep}`).toString();
	} catch (error) {
		console.error("Failed to resolve asset base path:", error);
		return null;
	}
}

// The renderer reads media through this handler; anything else (keys, documents) is refused.
const READABLE_MEDIA_EXTENSIONS = new Set([
	...[".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi"],
	...[".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".opus"],
	...[".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".svg"],
]);

export function registerAssetIpcHandlers() {
	ipcMain.handle(IPC_CHANNELS.assets.getBasePath, () => {
		return resolveAssetBasePath();
	});

	ipcMain.on(IPC_CHANNELS.assets.getBasePathSync, (event) => {
		event.returnValue = resolveAssetBasePath();
	});

	ipcMain.handle(IPC_CHANNELS.assets.readLocalFile, async (_, filePath: string) => {
		try {
			if (!READABLE_MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
				throw new Error("Only media files can be read.");
			}
			const data = await fs.readFile(filePath);
			return { success: true, data };
		} catch (error) {
			console.error("Failed to read local file:", error);
			return { success: false, error: String(error) };
		}
	});
}
