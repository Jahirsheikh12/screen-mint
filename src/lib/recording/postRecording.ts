export type AfterRecordingAction =
	| "create-project"
	| "export-clipboard"
	| "export-share-link"
	| "export-save-file";

export interface PostRecordingContext {
	action: AfterRecordingAction;
	openQuickShare: boolean;
	autoCreateZooms: boolean;
	recordingPath?: string | null;
	webcamPath?: string | null;
	projectPath?: string | null;
}
