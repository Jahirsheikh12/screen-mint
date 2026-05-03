import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import type { PostRecordingContext } from "../../src/lib/recording/postRecording";

interface PostRecordingIpcHandlersContext {
	getPostRecordingContext: () => PostRecordingContext | null;
	setPostRecordingContext: (context: PostRecordingContext | null) => void;
}

export function registerPostRecordingIpcHandlers({
	getPostRecordingContext,
	setPostRecordingContext,
}: PostRecordingIpcHandlersContext) {
	ipcMain.handle(IPC_CHANNELS.postRecording.getContext, () => {
		return {
			success: true,
			context: getPostRecordingContext(),
		};
	});

	ipcMain.handle(
		IPC_CHANNELS.postRecording.setContext,
		(_, context: PostRecordingContext | null) => {
			setPostRecordingContext(context);
			return { success: true };
		},
	);

	ipcMain.handle(IPC_CHANNELS.postRecording.clearContext, () => {
		setPostRecordingContext(null);
		return { success: true };
	});
}
