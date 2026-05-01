import type { WebcamSessionMetadata } from "@/components/video-editor/types";
import type {
	ExportV2Progress,
	ExportV2StartRequest,
	ExportV2StartResult,
} from "@/lib/exporter/exportV2";
import type { SelectedArea } from "@/lib/recording/session";

export const IPC_CHANNELS = {
	assets: {
		getBasePath: "get-asset-base-path",
		getBasePathSync: "get-asset-base-path-sync",
		readLocalFile: "read-local-file",
	},
	capture: {
		getSources: "get-sources",
		selectSource: "select-source",
		getSelectedSource: "get-selected-source",
		setSelectedArea: "set-selected-area",
		getSelectedArea: "get-selected-area",
		clearSelectedArea: "clear-selected-area",
		autoSelectCursorDisplay: "auto-select-cursor-display",
	},
	recording: {
		startNative: "start-native-screen-recording",
		stopNative: "stop-native-screen-recording",
		startFfmpeg: "start-ffmpeg-recording",
		stopFfmpeg: "stop-ffmpeg-recording",
		storeVideo: "store-recorded-video",
		startChunkSession: "start-media-recorder-chunk-session",
		appendChunk: "append-media-recorder-chunk",
		finishChunkSession: "finish-media-recorder-chunk-session",
		discardChunkSession: "discard-media-recorder-chunk-session",
		finalizeSession: "finalize-recording-session",
		triggerFinalizeSession: "trigger-finalize-recording-session",
		awaitFinalized: "await-recording-finalized",
		discardArtifacts: "discard-recording-artifacts",
	},
	exportV2: {
		probe: "exportV2:probe",
		start: "exportV2:start",
		createWorker: "exportV2:createWorker",
		cancel: "exportV2:cancel",
		streamStart: "exportV2:streamStart",
		streamAppend: "exportV2:streamAppend",
		streamFinish: "exportV2:streamFinish",
		streamDiscard: "exportV2:streamDiscard",
		workerProgress: "exportV2:worker-progress",
		workerComplete: "exportV2:worker-complete",
	},
} as const;

export type IpcChannelGroup = keyof typeof IPC_CHANNELS;
export type IpcChannelName =
	(typeof IPC_CHANNELS)[IpcChannelGroup][keyof (typeof IPC_CHANNELS)[IpcChannelGroup]];

export type IpcSuccessResult<T extends object = Record<string, never>> = T & {
	success: true;
};

export type IpcFailureResult = {
	success: false;
	error?: string;
	message?: string;
};

export type IpcResult<T extends object = Record<string, never>> =
	| IpcSuccessResult<T>
	| IpcFailureResult;

export type RecordingSegment = {
	path: string;
	durationMs: number;
};

export type RecordingFinalizeRequest = {
	videoSegments: RecordingSegment[];
	webcamSegments?: RecordingSegment[];
	microphoneSegments?: RecordingSegment[];
	selectedArea?: SelectedArea | null;
	webcamSessionMetadata?: WebcamSessionMetadata | null;
};

export type RecordingFinalizeResult = IpcResult<{
	path?: string;
	webcamPath?: string | null;
	webcamSessionMetadata?: WebcamSessionMetadata | null;
	microphonePath?: string | null;
}>;

export type ExportV2Bridge = {
	start: (request: ExportV2StartRequest) => Promise<ExportV2StartResult>;
	cancel: (jobId: string) => Promise<{ success: boolean }>;
	workerProgress: (progress: ExportV2Progress) => Promise<{ success: boolean }>;
	workerComplete: (result: ExportV2StartResult) => Promise<{ success: boolean }>;
};
