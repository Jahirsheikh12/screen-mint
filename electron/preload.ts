import { contextBridge, ipcRenderer } from "electron";
import type { SelectedArea } from "../src/lib/recording/session";

contextBridge.exposeInMainWorld("electronAPI", {
	hudOverlayHide: () => {
		ipcRenderer.send("hud-overlay-hide");
	},
	hudOverlayClose: () => {
		ipcRenderer.send("hud-overlay-close");
	},
	getHudOverlayCaptureProtection: () => {
		return ipcRenderer.invoke("get-hud-overlay-capture-protection");
	},
	setHudOverlayCaptureProtection: (enabled: boolean) => {
		return ipcRenderer.invoke("set-hud-overlay-capture-protection", enabled);
	},
	getAssetBasePath: async () => {
		return await ipcRenderer.invoke("get-asset-base-path");
	},
	readLocalFile: (filePath: string) => {
		return ipcRenderer.invoke("read-local-file", filePath);
	},
	getSources: async (opts: Electron.SourcesOptions) => {
		return await ipcRenderer.invoke("get-sources", opts);
	},
	switchToEditor: () => {
		return ipcRenderer.invoke("switch-to-editor");
	},
	openSourceSelector: () => {
		return ipcRenderer.invoke("open-source-selector");
	},
	selectSource: (source: SelectedCaptureSource) => {
		return ipcRenderer.invoke("select-source", source);
	},
	getSelectedSource: () => {
		return ipcRenderer.invoke("get-selected-source");
	},
	setSelectedArea: (area: SelectedArea | null) => {
		return ipcRenderer.invoke("set-selected-area", area);
	},
	getSelectedArea: () => {
		return ipcRenderer.invoke("get-selected-area");
	},
	clearSelectedArea: () => {
		return ipcRenderer.invoke("clear-selected-area");
	},
	startNativeScreenRecording: (
		source: SelectedCaptureSource,
		options?: {
			capturesSystemAudio?: boolean;
			capturesMicrophone?: boolean;
			microphoneDeviceId?: string;
			microphoneLabel?: string;
			selectedArea?: unknown;
		},
	) => {
		return ipcRenderer.invoke("start-native-screen-recording", source, options);
	},
	stopNativeScreenRecording: () => {
		return ipcRenderer.invoke("stop-native-screen-recording");
	},
	startFfmpegRecording: (source: SelectedCaptureSource) => {
		return ipcRenderer.invoke("start-ffmpeg-recording", source);
	},
	stopFfmpegRecording: () => {
		return ipcRenderer.invoke("stop-ffmpeg-recording");
	},
	storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("store-recorded-video", videoData, fileName);
	},
	storeRecordedVideoSegment: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("store-recorded-video", videoData, fileName, false);
	},
	getRecordedVideoPath: () => {
		return ipcRenderer.invoke("get-recorded-video-path");
	},
	finalizeRecordingSession: (payload: {
		videoSegments: Array<{ path: string; durationMs: number }>;
		webcamSegments?: Array<{ path: string; durationMs: number }>;
		microphoneSegments?: Array<{ path: string; durationMs: number }>;
		selectedArea?: unknown;
	}) => {
		return ipcRenderer.invoke("finalize-recording-session", payload);
	},
	discardRecordingArtifacts: (payload: {
		paths: string[];
		clearCurrentVideo?: boolean;
		clearCurrentWebcam?: boolean;
	}) => {
		return ipcRenderer.invoke("discard-recording-artifacts", payload);
	},
	setRecordingState: (recording: boolean) => {
		return ipcRenderer.invoke("set-recording-state", recording);
	},
	setCursorScale: (scale: number) => {
		return ipcRenderer.invoke("set-cursor-scale", scale);
	},
	getCursorTelemetry: (videoPath?: string) => {
		return ipcRenderer.invoke("get-cursor-telemetry", videoPath);
	},
	getSystemCursorAssets: () => {
		return ipcRenderer.invoke("get-system-cursor-assets");
	},
	onStopRecordingFromTray: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("stop-recording-from-tray", listener);
		return () => ipcRenderer.removeListener("stop-recording-from-tray", listener);
	},
	onRecordingStateChanged: (
		callback: (state: { recording: boolean; sourceName: string }) => void,
	) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			payload: { recording: boolean; sourceName: string },
		) => callback(payload);
		ipcRenderer.on("recording-state-changed", listener);
		return () => ipcRenderer.removeListener("recording-state-changed", listener);
	},
	onRecordingInterrupted: (callback: (state: { reason: string; message: string }) => void) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			payload: { reason: string; message: string },
		) => callback(payload);
		ipcRenderer.on("recording-interrupted", listener);
		return () => ipcRenderer.removeListener("recording-interrupted", listener);
	},
	onCursorStateChanged: (
		callback: (state: { cursorType: CursorTelemetryPoint["cursorType"] }) => void,
	) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			payload: { cursorType: CursorTelemetryPoint["cursorType"] },
		) => callback(payload);
		ipcRenderer.on("cursor-state-changed", listener);
		return () => ipcRenderer.removeListener("cursor-state-changed", listener);
	},
	onSelectedAreaChanged: (callback: (state: { area: SelectedArea | null }) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: { area: SelectedArea | null }) =>
			callback(payload);
		ipcRenderer.on("selected-area-changed", listener);
		return () => ipcRenderer.removeListener("selected-area-changed", listener);
	},
	openExternalUrl: (url: string) => {
		return ipcRenderer.invoke("open-external-url", url);
	},
	getAccessibilityPermissionStatus: () => {
		return ipcRenderer.invoke("get-accessibility-permission-status");
	},
	requestAccessibilityPermission: () => {
		return ipcRenderer.invoke("request-accessibility-permission");
	},
	getScreenRecordingPermissionStatus: () => {
		return ipcRenderer.invoke("get-screen-recording-permission-status");
	},
	openDisplayCapturePreferences: () => {
		return ipcRenderer.invoke("open-screen-recording-preferences");
	},
	openAccessibilityPreferences: () => {
		return ipcRenderer.invoke("open-accessibility-preferences");
	},
	saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("save-exported-video", videoData, fileName);
	},
	openVideoFilePicker: () => {
		return ipcRenderer.invoke("open-video-file-picker");
	},
	openAudioFilePicker: () => {
		return ipcRenderer.invoke("open-audio-file-picker");
	},
	setCurrentVideoPath: (path: string) => {
		return ipcRenderer.invoke("set-current-video-path", path);
	},
	getCurrentVideoPath: () => {
		return ipcRenderer.invoke("get-current-video-path");
	},
	clearCurrentVideoPath: () => {
		return ipcRenderer.invoke("clear-current-video-path");
	},
	setCurrentWebcamPath: (path: string) => {
		return ipcRenderer.invoke("set-current-webcam-path", path);
	},
	getCurrentWebcamPath: () => {
		return ipcRenderer.invoke("get-current-webcam-path");
	},
	clearCurrentWebcamPath: () => {
		return ipcRenderer.invoke("clear-current-webcam-path");
	},
	checkFileAvailable: (filePath: string) => {
		return ipcRenderer.invoke("check-file-available", filePath);
	},
	getCaptionModelStatus: (videoPath?: string) => {
		return ipcRenderer.invoke("get-caption-model-status", videoPath);
	},
	generateCaptions: (request: {
		videoPath?: string;
		preferredBackend: "auto" | "whisper.cpp" | "apple-speech";
		model: "base" | "small" | "medium";
		language: string;
		prompt: string;
		preferredSourceAudio: "microphone" | "mixed";
	}) => {
		return ipcRenderer.invoke("generate-captions", request);
	},
	cancelCaptionGeneration: () => {
		return ipcRenderer.invoke("cancel-caption-generation");
	},
	exportCaptionsTranscript: (payload: {
		videoPath?: string;
		format: "srt" | "vtt" | "txt";
		track: unknown;
	}) => {
		return ipcRenderer.invoke("export-captions-transcript", payload);
	},
	onCaptionGenerationProgress: (
		callback: (progress: { stage: string; percentage: number; message: string }) => void,
	) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: { stage: string; percentage: number; message: string },
		) => callback(progress);
		ipcRenderer.on("caption-generation-progress", listener);
		return () => ipcRenderer.removeListener("caption-generation-progress", listener);
	},
	saveProjectFile: (projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
		return ipcRenderer.invoke("save-project-file", projectData, suggestedName, existingProjectPath);
	},
	loadProjectFile: () => {
		return ipcRenderer.invoke("load-project-file");
	},
	loadCurrentProjectFile: () => {
		return ipcRenderer.invoke("load-current-project-file");
	},
	onMenuLoadProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-load-project", listener);
		return () => ipcRenderer.removeListener("menu-load-project", listener);
	},
	onMenuSaveProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project", listener);
		return () => ipcRenderer.removeListener("menu-save-project", listener);
	},
	onMenuSaveProjectAs: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project-as", listener);
		return () => ipcRenderer.removeListener("menu-save-project-as", listener);
	},
	getPlatform: () => {
		return ipcRenderer.invoke("get-platform");
	},
	revealInFolder: (filePath: string) => {
		return ipcRenderer.invoke("reveal-in-folder", filePath);
	},
	openRecordingsFolder: () => {
		return ipcRenderer.invoke("open-recordings-folder");
	},
	getRecordingsDirectory: () => {
		return ipcRenderer.invoke("get-recordings-directory");
	},
	chooseRecordingsDirectory: () => {
		return ipcRenderer.invoke("choose-recordings-directory");
	},
	getShortcuts: () => {
		return ipcRenderer.invoke("get-shortcuts");
	},
	saveShortcuts: (shortcuts: unknown) => {
		return ipcRenderer.invoke("save-shortcuts", shortcuts);
	},
	setHasUnsavedChanges: (hasChanges: boolean) => {
		ipcRenderer.send("set-has-unsaved-changes", hasChanges);
	},
	onRequestSaveBeforeClose: (callback: () => Promise<void>) => {
		const listener = async () => {
			await callback();
			ipcRenderer.send("save-before-close-done");
		};
		ipcRenderer.on("request-save-before-close", listener);
		return () => ipcRenderer.removeListener("request-save-before-close", listener);
	},
	isWgcAvailable: () => ipcRenderer.invoke("is-wgc-available"),
	muxWgcRecording: () => ipcRenderer.invoke("mux-wgc-recording"),
	hideOsCursor: () => ipcRenderer.invoke("hide-cursor"),
	getCountdownDelay: () => ipcRenderer.invoke("get-countdown-delay"),
	setCountdownDelay: (delay: number) => ipcRenderer.invoke("set-countdown-delay", delay),
	startCountdown: (seconds: number) => ipcRenderer.invoke("start-countdown", seconds),
	cancelCountdown: () => ipcRenderer.invoke("cancel-countdown"),
	onCountdownTick: (callback: (seconds: number) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, seconds: number) => callback(seconds);
		ipcRenderer.on("countdown-tick", listener);
		return () => ipcRenderer.removeListener("countdown-tick", listener);
	},
	// HUD settings
	getHudSettings: () => ipcRenderer.invoke("get-hud-settings"),
	setHudSettings: (settings: Record<string, unknown>) =>
		ipcRenderer.invoke("set-hud-settings", settings),
	// Display info
	getDisplayInfo: () => ipcRenderer.invoke("get-display-info"),
	// Area overlay
	createAreaOverlay: (displayId?: number) => ipcRenderer.invoke("create-area-overlay", displayId),
	closeAreaOverlay: () => ipcRenderer.invoke("close-area-overlay"),
	// Desktop icons (macOS)
	hideDesktopIcons: () => ipcRenderer.invoke("hide-desktop-icons"),
	showDesktopIcons: () => ipcRenderer.invoke("show-desktop-icons"),
	// Dock icon (macOS)
	hideDockIcon: () => ipcRenderer.invoke("hide-dock-icon"),
	showDockIcon: () => ipcRenderer.invoke("show-dock-icon"),
	// Highlight overlay
	createHighlightOverlay: (rect: { x: number; y: number; width: number; height: number }) =>
		ipcRenderer.invoke("create-highlight-overlay", rect),
	closeHighlightOverlay: () => ipcRenderer.invoke("close-highlight-overlay"),
	// Resize HUD
	resizeHudWindow: (contentVisible: boolean) =>
		ipcRenderer.invoke("resize-hud-window", contentVisible),
});
