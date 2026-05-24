import { ipcMain } from "electron";
import {
	IPC_CHANNELS,
	type LayeredCaptureResult,
	type LayeredCaptureStartRequest,
} from "../../src/electron-ipc/contracts";
import {
	buildLayeredRecordingManifest,
	getLayerCapturePlatform,
	type LayerCaptureSource,
	type LayeredRecordingManifest,
	normalizeLayerCaptureSources,
} from "../../src/lib/recording/layeredCapture";

let activeManifest: LayeredRecordingManifest | null = null;
let plannedSources: LayerCaptureSource[] = [];

export function registerLayeredCaptureIpcHandlers() {
	ipcMain.handle(
		IPC_CHANNELS.layeredCapture.setSources,
		(_, request: LayeredCaptureStartRequest): LayeredCaptureResult => {
			const platform = getLayerCapturePlatform(process.platform);
			plannedSources = normalizeLayerCaptureSources(
				Array.isArray(request?.sources) ? request.sources : [],
				platform,
			);
			activeManifest = buildLayeredRecordingManifest({
				id: `layered-plan-${Date.now()}`,
				platform,
				startedAt: new Date().toISOString(),
				sources: plannedSources,
			});
			return { success: true, manifest: activeManifest };
		},
	);

	ipcMain.handle(IPC_CHANNELS.layeredCapture.getSources, (): LayeredCaptureResult => {
		const platform = getLayerCapturePlatform(process.platform);
		return {
			success: true,
			manifest: buildLayeredRecordingManifest({
				id: activeManifest?.id ?? `layered-plan-${Date.now()}`,
				platform,
				startedAt: activeManifest?.startedAt ?? new Date().toISOString(),
				sources: plannedSources,
			}),
		};
	});

	ipcMain.handle(IPC_CHANNELS.layeredCapture.clearSources, (): LayeredCaptureResult => {
		plannedSources = [];
		activeManifest = null;
		return { success: true, manifest: null };
	});

	ipcMain.handle(
		IPC_CHANNELS.layeredCapture.start,
		(_, request: LayeredCaptureStartRequest): LayeredCaptureResult => {
			const platform = getLayerCapturePlatform(process.platform);
			const requestSources = Array.isArray(request?.sources) ? request.sources : [];
			const sources = requestSources.length > 0 ? requestSources : plannedSources;
			activeManifest = buildLayeredRecordingManifest({
				id: `layered-${Date.now()}`,
				platform,
				startedAt: new Date().toISOString(),
				sources,
			});
			return { success: true, manifest: activeManifest };
		},
	);

	ipcMain.handle(IPC_CHANNELS.layeredCapture.status, (): LayeredCaptureResult => {
		return { success: true, manifest: activeManifest };
	});

	ipcMain.handle(IPC_CHANNELS.layeredCapture.stop, (): LayeredCaptureResult => {
		if (activeManifest) {
			activeManifest = { ...activeManifest, status: "completed" };
		}
		return { success: true, manifest: activeManifest };
	});
}
