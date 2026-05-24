import fs from "node:fs/promises";
import path from "node:path";
import { clipboard, desktopCapturer, ipcMain, nativeImage } from "electron";
import {
	IPC_CHANNELS,
	type IpcSelectedSource,
	type ScreenshotCaptureRequest,
	type ScreenshotCaptureResult,
} from "../../src/electron-ipc/contracts";
import { ensureFileExtension } from "../../src/lib/fileNames";
import type { SelectedArea } from "../../src/lib/recording/session";

interface ScreenshotIpcHandlersContext {
	getRecordingsDir: () => Promise<string>;
	getSelectedSource: () => IpcSelectedSource | null;
	getSelectedArea: () => SelectedArea | null;
	getScreen: () => typeof import("electron").screen;
	writeBufferToUniqueFile: (directory: string, fileName: string, buffer: Buffer) => Promise<string>;
	isEnabled?: () => boolean;
}

type ScreenshotCopyRequest = {
	pngData?: Uint8Array;
	path?: string;
};

function createScreenshotFileName(source: IpcSelectedSource | null, requestedName?: string) {
	if (requestedName?.trim()) {
		return path.basename(ensureFileExtension(requestedName.trim(), "png"));
	}

	const sourceName = source?.name?.trim() || "capture";
	const safeSourceName = sourceName
		.replace(/\.[^.]+$/, "")
		.replace(/[^a-z0-9-_]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return `screenshot-${safeSourceName || "capture"}-${Date.now()}.png`;
}

function getSourceKind(source: IpcSelectedSource | null) {
	return source?.id?.startsWith("window:") ? "window" : "screen";
}

function getThumbnailSize(
	source: IpcSelectedSource | null,
	selectedArea: SelectedArea | null,
	getScreen: ScreenshotIpcHandlersContext["getScreen"],
) {
	if (selectedArea) {
		return {
			width: Math.max(1, Math.round(selectedArea.displayBounds.width)),
			height: Math.max(1, Math.round(selectedArea.displayBounds.height)),
		};
	}

	if (source?.id?.startsWith("screen:")) {
		const displayId = Number(source.display_id);
		const display = getScreen()
			.getAllDisplays()
			.find((candidate) => candidate.id === displayId);
		if (display) {
			return {
				width: Math.max(1, Math.round(display.size.width)),
				height: Math.max(1, Math.round(display.size.height)),
			};
		}
	}

	const width = typeof source?.width === "number" ? source.width : 1920;
	const height = typeof source?.height === "number" ? source.height : 1080;
	return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

function cropSelectedAreaImage(image: Electron.NativeImage, selectedArea: SelectedArea | null) {
	if (!selectedArea) {
		return image;
	}

	const size = image.getSize();
	const crop = {
		x: Math.round(selectedArea.normalizedBounds.x * size.width),
		y: Math.round(selectedArea.normalizedBounds.y * size.height),
		width: Math.round(selectedArea.normalizedBounds.width * size.width),
		height: Math.round(selectedArea.normalizedBounds.height * size.height),
	};

	return image.crop({
		x: Math.min(Math.max(0, crop.x), Math.max(0, size.width - 1)),
		y: Math.min(Math.max(0, crop.y), Math.max(0, size.height - 1)),
		width: Math.max(1, Math.min(crop.width, size.width - crop.x)),
		height: Math.max(1, Math.min(crop.height, size.height - crop.y)),
	});
}

async function copyPngToClipboard(payload: ScreenshotCopyRequest) {
	const image = payload.path
		? nativeImage.createFromPath(payload.path)
		: payload.pngData
			? nativeImage.createFromBuffer(Buffer.from(payload.pngData))
			: null;

	if (!image || image.isEmpty()) {
		return { success: false, message: "No screenshot image was available to copy." };
	}

	clipboard.writeImage(image);
	return { success: true };
}

export function registerScreenshotIpcHandlers({
	getRecordingsDir,
	getSelectedSource,
	getSelectedArea,
	getScreen,
	writeBufferToUniqueFile,
	isEnabled = () => false,
}: ScreenshotIpcHandlersContext) {
	ipcMain.handle(
		IPC_CHANNELS.screenshot.capture,
		async (_, request: ScreenshotCaptureRequest = {}): Promise<ScreenshotCaptureResult> => {
			try {
				if (!isEnabled()) {
					return {
						success: false,
						message: "Screenshot capture is disabled in this build.",
					};
				}

				const source = request.source ?? getSelectedSource();
				if (!source?.id) {
					return {
						success: false,
						message: "No capture source is selected.",
					};
				}

				const selectedArea = source.id.startsWith("screen:")
					? (request.selectedArea ?? getSelectedArea())
					: null;
				const thumbnailSize = getThumbnailSize(source, selectedArea, getScreen);
				const sources = await desktopCapturer.getSources({
					types: [getSourceKind(source)],
					thumbnailSize,
					fetchWindowIcons: false,
				});
				const matchedSource = sources.find((candidate) => candidate.id === source.id);
				if (!matchedSource || matchedSource.thumbnail.isEmpty()) {
					return {
						success: false,
						message: "Could not capture the selected source.",
					};
				}

				const image = cropSelectedAreaImage(matchedSource.thumbnail, selectedArea);
				const pngBuffer = image.toPNG();
				const imageSize = image.getSize();
				let savedPath: string | undefined;

				if (request.saveToRecordings !== false) {
					const recordingsDir = await getRecordingsDir();
					savedPath = await writeBufferToUniqueFile(
						recordingsDir,
						createScreenshotFileName(source, request.fileName),
						pngBuffer,
					);
				}

				if (request.copyToClipboard) {
					clipboard.writeImage(image);
				}

				return {
					success: true,
					screenshot: {
						path: savedPath,
						width: imageSize.width,
						height: imageSize.height,
						capturedAt: new Date().toISOString(),
						source,
						selectedArea,
					},
					pngData: new Uint8Array(pngBuffer),
				};
			} catch (error) {
				console.error("Failed to capture screenshot:", error);
				return {
					success: false,
					message: "Failed to capture screenshot",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		IPC_CHANNELS.screenshot.copyToClipboard,
		async (_, payload: ScreenshotCopyRequest) => {
			try {
				if (!isEnabled()) {
					return {
						success: false,
						message: "Screenshot capture is disabled in this build.",
					};
				}

				if (payload.path) {
					await fs.access(payload.path);
				}
				return await copyPngToClipboard(payload);
			} catch (error) {
				return {
					success: false,
					message: "Failed to copy screenshot to clipboard",
					error: String(error),
				};
			}
		},
	);
}
