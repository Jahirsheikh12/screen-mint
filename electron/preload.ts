import { contextBridge, ipcRenderer } from "electron";
import type { WebcamSessionMetadata } from "../src/components/video-editor/types";
import {
	IPC_CHANNELS,
	type MobileCaptureIceCandidatePayload,
	type MobileCapturePairingState,
	type MobileCaptureSignalPayload,
} from "../src/electron-ipc/contracts";
import type { SelectedArea } from "../src/lib/recording/session";
import type { UpdaterState } from "../src/lib/updater/types";

const assetBasePathSync = (() => {
	try {
		return ipcRenderer.sendSync(IPC_CHANNELS.assets.getBasePathSync) as string | null;
	} catch {
		return null;
	}
})();

contextBridge.exposeInMainWorld("electronAPI", {
	hudOverlayHide: () => {
		ipcRenderer.send("hud-overlay-hide");
	},
	hudOverlayClose: () => {
		ipcRenderer.send("hud-overlay-close");
	},
	getHudOverlayCaptureProtection: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.hudOverlay.getCaptureProtection);
	},
	setHudOverlayCaptureProtection: (enabled: boolean) => {
		return ipcRenderer.invoke(IPC_CHANNELS.hudOverlay.setCaptureProtection, enabled);
	},
	getAssetBasePath: async () => {
		return assetBasePathSync ?? (await ipcRenderer.invoke(IPC_CHANNELS.assets.getBasePath));
	},
	getAssetBasePathSync: () => {
		return assetBasePathSync;
	},
	readLocalFile: (filePath: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.assets.readLocalFile, filePath);
	},
	getSources: async (opts: Electron.SourcesOptions) => {
		return await ipcRenderer.invoke(IPC_CHANNELS.capture.getSources, opts);
	},
	switchToEditor: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.windows.switchToEditor);
	},
	switchToHud: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.windows.switchToHud);
	},
	openSourceSelector: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.windows.openSourceSelector);
	},
	selectSource: (source: SelectedCaptureSource) => {
		return ipcRenderer.invoke(IPC_CHANNELS.capture.selectSource, source);
	},
	getSelectedSource: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.capture.getSelectedSource);
	},
	setSelectedArea: (area: SelectedArea | null) => {
		return ipcRenderer.invoke(IPC_CHANNELS.capture.setSelectedArea, area);
	},
	getSelectedArea: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.capture.getSelectedArea);
	},
	clearSelectedArea: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.capture.clearSelectedArea);
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
		return ipcRenderer.invoke(IPC_CHANNELS.recording.startNative, source, options);
	},
	stopNativeScreenRecording: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.stopNative);
	},
	startFfmpegRecording: (
		source: SelectedCaptureSource,
		options?: {
			recordingFps?: number;
			recordingWidth?: number;
			recordingHeight?: number;
			videoBitsPerSecond?: number;
		},
	) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.startFfmpeg, source, options);
	},
	stopFfmpegRecording: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.stopFfmpeg);
	},
	storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.storeVideo, videoData, fileName);
	},
	storeRecordedVideoSegment: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.storeVideo, videoData, fileName, false);
	},
	startMediaRecorderChunkSession: (fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.startChunkSession, fileName);
	},
	appendMediaRecorderChunk: (sessionId: string, chunkData: ArrayBuffer) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.appendChunk, sessionId, chunkData);
	},
	finishMediaRecorderChunkSession: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.finishChunkSession, sessionId);
	},
	discardMediaRecorderChunkSession: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.discardChunkSession, sessionId);
	},
	getRecordedVideoPath: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.getRecordedVideoPath);
	},
	finalizeRecordingSession: (payload: {
		videoSegments: Array<{ path: string; durationMs: number }>;
		webcamSegments?: Array<{ path: string; durationMs: number }>;
		microphoneSegments?: Array<{ path: string; durationMs: number }>;
		selectedArea?: unknown;
		webcamSessionMetadata?: WebcamSessionMetadata | null;
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.finalizeSession, payload);
	},
	triggerFinalizeRecordingSession: (payload: {
		videoSegments: Array<{ path: string; durationMs: number }>;
		webcamSegments?: Array<{ path: string; durationMs: number }>;
		microphoneSegments?: Array<{ path: string; durationMs: number }>;
		selectedArea?: unknown;
		webcamSessionMetadata?: WebcamSessionMetadata | null;
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.triggerFinalizeSession, payload);
	},
	awaitRecordingFinalized: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.awaitFinalized);
	},
	discardRecordingArtifacts: (payload: {
		paths: string[];
		clearCurrentVideo?: boolean;
		clearCurrentWebcam?: boolean;
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.discardArtifacts, payload);
	},
	setRecordingState: (recording: boolean) => {
		return ipcRenderer.invoke(IPC_CHANNELS.recording.setState, recording);
	},
	setCursorScale: (scale: number) => {
		return ipcRenderer.invoke(IPC_CHANNELS.telemetry.setCursorScale, scale);
	},
	getCursorTelemetry: (videoPath?: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.telemetry.getCursor, videoPath);
	},
	getKeyboardTelemetry: (videoPath?: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.telemetry.getKeyboard, videoPath);
	},
	getSystemCursorAssets: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.telemetry.getSystemCursorAssets);
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
	startMobileCapturePairing: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.startPairing);
	},
	stopMobileCapturePairing: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.stopPairing);
	},
	getMobileCapturePairingState: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.getPairingState);
	},
	setMobileCaptureDesktopOffer: (sessionId: string, offer: MobileCaptureSignalPayload) => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.setDesktopOffer, sessionId, offer);
	},
	addMobileCaptureDesktopIceCandidate: (
		sessionId: string,
		candidate: MobileCaptureIceCandidatePayload,
	) => {
		return ipcRenderer.invoke(
			IPC_CHANNELS.mobileCapture.addDesktopIceCandidate,
			sessionId,
			candidate,
		);
	},
	getMobileCapturePhoneAnswer: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.getPhoneAnswer, sessionId);
	},
	getMobileCapturePhoneIceCandidates: (sessionId: string, after: number) => {
		return ipcRenderer.invoke(IPC_CHANNELS.mobileCapture.getPhoneIceCandidates, sessionId, after);
	},
	onMobileCapturePairingStateChanged: (callback: (state: MobileCapturePairingState) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: MobileCapturePairingState) =>
			callback(payload);
		ipcRenderer.on("mobile-capture-state-changed", listener);
		return () => ipcRenderer.removeListener("mobile-capture-state-changed", listener);
	},
	openExternalUrl: (url: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.openExternalUrl, url);
	},
	getAccessibilityPermissionStatus: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.getAccessibilityStatus);
	},
	requestAccessibilityPermission: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.requestAccessibility);
	},
	getCapturePermissionState: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.getCaptureState);
	},
	requestMicrophoneAccess: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.requestMicrophone);
	},
	getScreenRecordingPermissionStatus: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.getScreenRecordingStatus);
	},
	openDisplayCapturePreferences: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.openScreenRecordingPreferences);
	},
	openAccessibilityPreferences: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.openAccessibilityPreferences);
	},
	probeCaptureSources: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.probeCaptureSources);
	},
	getCaptureDiagnostics: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.permissions.getCaptureDiagnostics);
	},
	saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportFiles.saveVideo, videoData, fileName);
	},
	showExportSaveDialog: (fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportFiles.showSaveDialog, fileName);
	},
	writeExportedVideoToPath: (videoData: ArrayBuffer, filePath: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportFiles.writeVideoToPath, videoData, filePath);
	},
	saveExportedVideoToRecordings: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportFiles.saveVideoToRecordings, videoData, fileName);
	},
	exportV2Probe: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.probe);
	},
	exportV2Start: (request: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.start, request);
	},
	exportV2CreateWorker: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.createWorker);
	},
	exportV2Cancel: (jobId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.cancel, jobId);
	},
	exportV2StreamStart: (filePath: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.streamStart, filePath);
	},
	exportV2StreamAppend: (sessionId: string, chunk: ArrayBuffer, position: number) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.streamAppend, sessionId, chunk, position);
	},
	exportV2StreamFinish: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.streamFinish, sessionId);
	},
	exportV2StreamDiscard: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.streamDiscard, sessionId);
	},
	exportV2GifPipeStart: (request: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.gifPipeStart, request);
	},
	exportV2GifPipeAppend: (sessionId: string, chunk: ArrayBuffer) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.gifPipeAppend, sessionId, chunk);
	},
	exportV2GifPipeFinish: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.gifPipeFinish, sessionId);
	},
	exportV2GifPipeDiscard: (sessionId: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.gifPipeDiscard, sessionId);
	},
	onExportV2Progress: (callback: (progress: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
		ipcRenderer.on("exportV2:progress", listener);
		return () => ipcRenderer.removeListener("exportV2:progress", listener);
	},
	onExportV2WorkerStart: (callback: (request: unknown) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, request: unknown) => callback(request);
		ipcRenderer.on("exportV2:worker-start", listener);
		return () => ipcRenderer.removeListener("exportV2:worker-start", listener);
	},
	exportV2WorkerProgress: (progress: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.workerProgress, progress);
	},
	exportV2WorkerComplete: (result: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.exportV2.workerComplete, result);
	},
	openVideoFilePicker: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.openVideoPicker);
	},
	openAudioFilePicker: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.openAudioPicker);
	},
	openImageFilePicker: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.openImagePicker);
	},
	setCurrentVideoPath: (path: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.setVideoPath, path);
	},
	getCurrentVideoPath: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.getVideoPath);
	},
	clearCurrentVideoPath: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.clearVideoPath);
	},
	setCurrentWebcamPath: (path: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.setWebcamPath, path);
	},
	getCurrentWebcamPath: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.getWebcamPath);
	},
	clearCurrentWebcamPath: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.currentMedia.clearWebcamPath);
	},
	checkFileAvailable: (filePath: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.checkFileAvailable, filePath);
	},
	getCaptionModelStatus: (videoPath?: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.captions.getModelStatus, videoPath);
	},
	generateCaptions: (request: {
		videoPath?: string;
		preferredBackend: "auto" | "whisper.cpp" | "apple-speech";
		model: "base" | "small" | "medium";
		language: string;
		prompt: string;
		preferredSourceAudio: "microphone" | "mixed";
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.captions.generate, request);
	},
	cancelCaptionGeneration: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.captions.cancelGeneration);
	},
	exportCaptionsTranscript: (payload: {
		videoPath?: string;
		format: "srt" | "vtt" | "txt";
		track: unknown;
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.captions.exportTranscript, payload);
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
		return ipcRenderer.invoke(
			IPC_CHANNELS.projects.saveFile,
			projectData,
			suggestedName,
			existingProjectPath,
		);
	},
	loadProjectFile: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.projects.loadFile);
	},
	loadCurrentProjectFile: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.projects.loadCurrentFile);
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
		return ipcRenderer.invoke(IPC_CHANNELS.system.getPlatform);
	},
	getAppVersion: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.system.getAppVersion);
	},
	getUpdaterState: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.getState);
	},
	checkForUpdates: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.checkForUpdates);
	},
	downloadUpdate: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.downloadUpdate);
	},
	installUpdateAndRestart: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.installAndRestart);
	},
	dismissUpdate: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.dismissUpdate);
	},
	updateLaterForSession: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.updateLaterForSession);
	},
	dismissWhatsNew: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.updater.dismissWhatsNew);
	},
	setUpdaterBusyState: (update: {
		recording?: boolean;
		exporting?: boolean;
		transcribing?: boolean;
	}) => ipcRenderer.invoke(IPC_CHANNELS.updater.setBusyState, update),
	onUpdaterStateChanged: (callback: (state: UpdaterState) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, state: UpdaterState) => callback(state);
		ipcRenderer.on("updater-state-changed", listener);
		return () => ipcRenderer.removeListener("updater-state-changed", listener);
	},
	revealInFolder: (filePath: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.revealInFolder, filePath);
	},
	openRecordingsFolder: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.openRecordingsFolder);
	},
	copyTextToClipboard: (text: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.copyTextToClipboard, text);
	},
	copyExportedToClipboard: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke(IPC_CHANNELS.files.copyExportedToClipboard, videoData, fileName);
	},
	deleteProjectAndMedia: (payload: {
		projectPath?: string | null;
		videoPath?: string | null;
		webcamPath?: string | null;
	}) => {
		return ipcRenderer.invoke(IPC_CHANNELS.projects.deleteAndMedia, payload);
	},
	getPostRecordingContext: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.postRecording.getContext);
	},
	setPostRecordingContext: (context: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.postRecording.setContext, context);
	},
	clearPostRecordingContext: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.postRecording.clearContext);
	},
	getRecordingsDirectory: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recordingDirectory.get);
	},
	chooseRecordingsDirectory: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.recordingDirectory.choose);
	},
	getShortcuts: () => {
		return ipcRenderer.invoke(IPC_CHANNELS.shortcuts.get);
	},
	saveShortcuts: (shortcuts: unknown) => {
		return ipcRenderer.invoke(IPC_CHANNELS.shortcuts.save, shortcuts);
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
	isWgcAvailable: () => ipcRenderer.invoke(IPC_CHANNELS.recording.isWgcAvailable),
	muxWgcRecording: () => ipcRenderer.invoke(IPC_CHANNELS.recording.muxWgcRecording),
	hideOsCursor: () => ipcRenderer.invoke(IPC_CHANNELS.system.hideCursor),
	getCountdownDelay: () => ipcRenderer.invoke(IPC_CHANNELS.countdown.getDelay),
	setCountdownDelay: (delay: number) => ipcRenderer.invoke(IPC_CHANNELS.countdown.setDelay, delay),
	startCountdown: (seconds: number) => ipcRenderer.invoke(IPC_CHANNELS.countdown.start, seconds),
	cancelCountdown: () => ipcRenderer.invoke(IPC_CHANNELS.countdown.cancel),
	onCountdownTick: (callback: (seconds: number) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, seconds: number) => callback(seconds);
		ipcRenderer.on("countdown-tick", listener);
		return () => ipcRenderer.removeListener("countdown-tick", listener);
	},
	// HUD settings
	getHudSettings: () => ipcRenderer.invoke(IPC_CHANNELS.hud.getSettings),
	setHudSettings: (settings: Record<string, unknown>) =>
		ipcRenderer.invoke(IPC_CHANNELS.hud.setSettings, settings),
	openSpeakerNotesWindow: (payload: { text: string }) =>
		ipcRenderer.invoke(IPC_CHANNELS.speakerNotes.open, payload),
	updateSpeakerNotesWindow: (payload: { text: string }) =>
		ipcRenderer.invoke(IPC_CHANNELS.speakerNotes.update, payload),
	closeSpeakerNotesWindow: () => ipcRenderer.invoke(IPC_CHANNELS.speakerNotes.close),
	onSpeakerNotesUpdated: (callback: (payload: { text: string }) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: { text: string }) =>
			callback(payload);
		ipcRenderer.on("speaker-notes-updated", listener);
		return () => ipcRenderer.removeListener("speaker-notes-updated", listener);
	},
	// Display info
	getDisplayInfo: () => ipcRenderer.invoke(IPC_CHANNELS.system.getDisplayInfo),
	// Area overlay
	createAreaOverlay: (displayId?: number) =>
		ipcRenderer.invoke(IPC_CHANNELS.areaOverlay.create, displayId),
	closeAreaOverlay: () => ipcRenderer.invoke(IPC_CHANNELS.areaOverlay.close),
	lockAreaOverlay: () => ipcRenderer.invoke(IPC_CHANNELS.areaOverlay.lock),
	unlockAreaOverlay: () => ipcRenderer.invoke(IPC_CHANNELS.areaOverlay.unlock),
	onAreaOverlayPhase: (callback: (phase: "selecting" | "locked") => void) => {
		const listener = (_event: Electron.IpcRendererEvent, phase: "selecting" | "locked") =>
			callback(phase);
		ipcRenderer.on("area-overlay-phase", listener);
		return () => ipcRenderer.removeListener("area-overlay-phase", listener);
	},
	// Desktop icons (macOS)
	hideDesktopIcons: () => ipcRenderer.invoke(IPC_CHANNELS.system.hideDesktopIcons),
	showDesktopIcons: () => ipcRenderer.invoke(IPC_CHANNELS.system.showDesktopIcons),
	// Dock icon (macOS)
	hideDockIcon: () => ipcRenderer.invoke(IPC_CHANNELS.system.hideDockIcon),
	showDockIcon: () => ipcRenderer.invoke(IPC_CHANNELS.system.showDockIcon),
	// Resize HUD
	resizeHudWindow: (contentVisible: boolean) =>
		ipcRenderer.invoke(IPC_CHANNELS.hudWindow.resize, contentVisible),
	syncHudCompactLayout: (layout: { width: number; height: number }) =>
		ipcRenderer.invoke(IPC_CHANNELS.hudWindow.syncCompactLayout, layout),
	setHudDropdownExpanded: (expanded: boolean) =>
		ipcRenderer.invoke(IPC_CHANNELS.hudWindow.setDropdownExpanded, expanded),
	setHudMousePassthrough: (enabled: boolean) =>
		ipcRenderer.invoke(IPC_CHANNELS.hudWindow.setMousePassthrough, enabled),
	startHudDrag: (point: { screenX: number; screenY: number }) =>
		ipcRenderer.send(IPC_CHANNELS.hudWindow.startDrag, point),
	moveHudDrag: (point: { screenX: number; screenY: number }) =>
		ipcRenderer.send(IPC_CHANNELS.hudWindow.moveDrag, point),
	endHudDrag: () => ipcRenderer.send(IPC_CHANNELS.hudWindow.endDrag),
	recenterHudOnCursor: () => ipcRenderer.invoke(IPC_CHANNELS.hudWindow.recenterOnCursor),
	autoSelectCursorDisplay: () => ipcRenderer.invoke(IPC_CHANNELS.capture.autoSelectCursorDisplay),
});
