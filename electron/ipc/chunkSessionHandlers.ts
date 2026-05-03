import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { MediaRecorderChunkStore } from "./mediaRecorderChunkStore";

type ChunkSessionHandlerOptions = {
	getRecordingsDir: () => Promise<string>;
	remuxMediaRecorderSegment: (segmentPath: string) => Promise<string>;
	persistCapturedTelemetryForVideo: (videoPath: string) => Promise<unknown>;
};

export function registerChunkSessionIpcHandlers({
	getRecordingsDir,
	remuxMediaRecorderSegment,
	persistCapturedTelemetryForVideo,
}: ChunkSessionHandlerOptions) {
	const mediaRecorderChunkStore = new MediaRecorderChunkStore(getRecordingsDir);

	ipcMain.handle(IPC_CHANNELS.recording.startChunkSession, async (_, fileName: string) => {
		try {
			const session = await mediaRecorderChunkStore.start(fileName);
			return { success: true, ...session };
		} catch (error) {
			console.error("Failed to start MediaRecorder chunk session:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.appendChunk,
		async (_, sessionId: string, chunkData: ArrayBuffer) => {
			try {
				await mediaRecorderChunkStore.append(sessionId, chunkData);
				return { success: true };
			} catch (error) {
				console.error("Failed to append MediaRecorder chunk:", error);
				return { success: false, error: String(error) };
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.finishChunkSession, async (_, sessionId: string) => {
		try {
			const result = await mediaRecorderChunkStore.finish(sessionId);
			const segmentPath = await remuxMediaRecorderSegment(result.path);
			await persistCapturedTelemetryForVideo(segmentPath);
			return { success: true, path: segmentPath, bytesWritten: result.bytesWritten };
		} catch (error) {
			console.error("Failed to finish MediaRecorder chunk session:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.recording.discardChunkSession, async (_, sessionId: string) => {
		try {
			await mediaRecorderChunkStore.discard(sessionId);
			return { success: true };
		} catch (error) {
			console.error("Failed to discard MediaRecorder chunk session:", error);
			return { success: false, error: String(error) };
		}
	});
}
