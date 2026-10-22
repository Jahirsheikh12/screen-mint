import type { WebcamSessionMetadata } from "@/components/video-editor/types";

export type AfterRecordingAction = "create-project" | "export-clipboard" | "export-save-file";

export interface PostRecordingContext {
	action: AfterRecordingAction;
	openQuickShare: boolean;
	autoCreateZooms: boolean;
	recordingPath?: string | null;
	webcamPath?: string | null;
	webcamSessionMetadata?: WebcamSessionMetadata | null;
	projectPath?: string | null;
}
