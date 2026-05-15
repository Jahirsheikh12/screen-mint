import type { WebcamSessionMetadata } from "@/components/video-editor/types";
import type {
	ExportV2Progress,
	ExportV2StartRequest,
	ExportV2StartResult,
} from "@/lib/exporter/exportV2";
import type { SelectedArea } from "@/lib/recording/session";

export type IpcSelectedSource = {
	id?: string;
	name: string;
	display_id?: string;
	sourceType?: "screen" | "window";
	appName?: string;
	windowTitle?: string;
	[key: string]: unknown;
};

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
	windows: {
		openSourceSelector: "open-source-selector",
		switchToEditor: "switch-to-editor",
		switchToHud: "switch-to-hud",
	},
	recording: {
		startNative: "start-native-screen-recording",
		stopNative: "stop-native-screen-recording",
		startFfmpeg: "start-ffmpeg-recording",
		stopFfmpeg: "stop-ffmpeg-recording",
		storeVideo: "store-recorded-video",
		getRecordedVideoPath: "get-recorded-video-path",
		startChunkSession: "start-media-recorder-chunk-session",
		appendChunk: "append-media-recorder-chunk",
		finishChunkSession: "finish-media-recorder-chunk-session",
		discardChunkSession: "discard-media-recorder-chunk-session",
		finalizeSession: "finalize-recording-session",
		triggerFinalizeSession: "trigger-finalize-recording-session",
		awaitFinalized: "await-recording-finalized",
		discardArtifacts: "discard-recording-artifacts",
		setState: "set-recording-state",
		isWgcAvailable: "is-wgc-available",
		muxWgcRecording: "mux-wgc-recording",
	},
	telemetry: {
		setCursorScale: "set-cursor-scale",
		getCursor: "get-cursor-telemetry",
		getKeyboard: "get-keyboard-telemetry",
		getSystemCursorAssets: "get-system-cursor-assets",
	},
	permissions: {
		getAccessibilityStatus: "get-accessibility-permission-status",
		requestAccessibility: "request-accessibility-permission",
		getCaptureState: "get-capture-permission-state",
		requestMicrophone: "request-microphone-access",
		getScreenRecordingStatus: "get-screen-recording-permission-status",
		openScreenRecordingPreferences: "open-screen-recording-preferences",
		openAccessibilityPreferences: "open-accessibility-preferences",
		probeCaptureSources: "probe-capture-sources",
		getCaptureDiagnostics: "get-capture-diagnostics",
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
	exportFiles: {
		showSaveDialog: "show-export-save-dialog",
		saveVideo: "save-exported-video",
		writeVideoToPath: "write-exported-video-to-path",
		saveVideoToRecordings: "save-exported-video-to-recordings",
	},
	files: {
		openExternalUrl: "open-external-url",
		openVideoPicker: "open-video-file-picker",
		openAudioPicker: "open-audio-file-picker",
		openImagePicker: "open-image-file-picker",
		revealInFolder: "reveal-in-folder",
		openRecordingsFolder: "open-recordings-folder",
		copyTextToClipboard: "copy-text-to-clipboard",
		copyExportedToClipboard: "copy-exported-to-clipboard",
		checkFileAvailable: "check-file-available",
	},
	projects: {
		saveFile: "save-project-file",
		loadFile: "load-project-file",
		loadCurrentFile: "load-current-project-file",
		deleteAndMedia: "delete-project-and-media",
	},
	currentMedia: {
		setVideoPath: "set-current-video-path",
		getVideoPath: "get-current-video-path",
		clearVideoPath: "clear-current-video-path",
		setWebcamPath: "set-current-webcam-path",
		getWebcamPath: "get-current-webcam-path",
		clearWebcamPath: "clear-current-webcam-path",
	},
	postRecording: {
		getContext: "get-post-recording-context",
		setContext: "set-post-recording-context",
		clearContext: "clear-post-recording-context",
	},
	recordingDirectory: {
		get: "get-recordings-directory",
		choose: "choose-recordings-directory",
	},
	captions: {
		getModelStatus: "get-caption-model-status",
		generate: "generate-captions",
		cancelGeneration: "cancel-caption-generation",
		exportTranscript: "export-captions-transcript",
	},
	system: {
		getPlatform: "get-platform",
		getAppVersion: "get-app-version",
		hideCursor: "hide-cursor",
		getDisplayInfo: "get-display-info",
		hideDesktopIcons: "hide-desktop-icons",
		showDesktopIcons: "show-desktop-icons",
		hideDockIcon: "hide-dock-icon",
		showDockIcon: "show-dock-icon",
	},
	updater: {
		getState: "get-updater-state",
		checkForUpdates: "check-for-updates",
		downloadUpdate: "download-update",
		installAndRestart: "install-update-and-restart",
		dismissUpdate: "dismiss-update",
		updateLaterForSession: "update-later-for-session",
		dismissWhatsNew: "dismiss-whats-new",
		setBusyState: "set-updater-busy-state",
	},
	shortcuts: {
		get: "get-shortcuts",
		save: "save-shortcuts",
	},
	countdown: {
		getDelay: "get-countdown-delay",
		setDelay: "set-countdown-delay",
		start: "start-countdown",
		cancel: "cancel-countdown",
	},
	hud: {
		getSettings: "get-hud-settings",
		setSettings: "set-hud-settings",
	},
	hudOverlay: {
		getCaptureProtection: "get-hud-overlay-capture-protection",
		setCaptureProtection: "set-hud-overlay-capture-protection",
	},
	hudWindow: {
		resize: "resize-hud-window",
		syncCompactLayout: "sync-hud-compact-layout",
		setDropdownExpanded: "hud-set-dropdown-expanded",
		setMousePassthrough: "hud-set-mouse-passthrough",
		recenterOnCursor: "hud-recenter-on-cursor",
	},
	mobileCapture: {
		startPairing: "mobile-capture:start-pairing",
		stopPairing: "mobile-capture:stop-pairing",
		getPairingState: "mobile-capture:get-pairing-state",
		setDesktopOffer: "mobile-capture:set-desktop-offer",
		addDesktopIceCandidate: "mobile-capture:add-desktop-ice-candidate",
		getPhoneAnswer: "mobile-capture:get-phone-answer",
		getPhoneIceCandidates: "mobile-capture:get-phone-ice-candidates",
	},
	speakerNotes: {
		open: "open-speaker-notes-window",
		update: "update-speaker-notes-window",
		close: "close-speaker-notes-window",
	},
	areaOverlay: {
		create: "create-area-overlay",
		close: "close-area-overlay",
		lock: "lock-area-overlay",
		unlock: "unlock-area-overlay",
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

export type CaptureSourceRequest = {
	types?: Array<"screen" | "window">;
	thumbnailSize?: { width: number; height: number };
	fetchWindowIcons?: boolean;
};

export type CaptureSourceResult = IpcResult<{
	sources?: IpcSelectedSource[];
	source?: IpcSelectedSource | null;
}>;

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

export type MobileCaptureStatus =
	| "idle"
	| "pairing"
	| "phone-opened"
	| "connected"
	| "disconnected"
	| "expired"
	| "error";

export type MobileCapturePairingState = {
	status: MobileCaptureStatus;
	sessionId: string | null;
	pairingUrl: string | null;
	qrSvg: string | null;
	expiresAt: number | null;
	lanAddress: string | null;
	error?: string;
};

export type MobileCaptureSignalPayload = {
	type: RTCSdpType;
	sdp: string;
};

export type MobileCaptureIceCandidatePayload = {
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;
	usernameFragment?: string | null;
};

export type MobileCapturePairingResult = IpcResult<{
	state: MobileCapturePairingState;
}>;

export type ExportV2Bridge = {
	start: (request: ExportV2StartRequest) => Promise<ExportV2StartResult>;
	cancel: (jobId: string) => Promise<{ success: boolean }>;
	workerProgress: (progress: ExportV2Progress) => Promise<{ success: boolean }>;
	workerComplete: (result: ExportV2StartResult) => Promise<{ success: boolean }>;
};
