/// <reference types="vite-plugin-electron/electron-env" />
import type {
	CaptionGenerationProgress,
	CaptionModelStatus,
	CaptionTrack,
} from "../src/components/video-editor/types";
import type { SelectedArea } from "../src/lib/recording/session";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/**
			 * The built directory structure
			 *
			 * ```tree
			 * ├─┬─┬ dist
			 * │ │ └── index.html
			 * │ │
			 * │ ├─┬ dist-electron
			 * │ │ ├── main.js
			 * │ │ └── preload.js
			 * │
			 * ```
			 */
			APP_ROOT: string;
			/** /dist/ or /public/ */
			VITE_PUBLIC: string;
		}
	}

	// Used in Renderer process, expose in `preload.ts`
	interface Window {
		electronAPI: {
			getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>;
			switchToEditor: () => Promise<void>;
			openSourceSelector: () => Promise<void>;
			selectSource: (source: SelectedCaptureSource) => Promise<SelectedCaptureSource>;
			getSelectedSource: () => Promise<SelectedCaptureSource | null>;
			setSelectedArea: (
				area: SelectedArea | null,
			) => Promise<{ success: boolean; area?: SelectedArea | null }>;
			getSelectedArea: () => Promise<{ success: boolean; area?: SelectedArea | null }>;
			clearSelectedArea: () => Promise<{ success: boolean }>;
			onSelectedAreaChanged: (
				callback: (state: { area: SelectedArea | null }) => void,
			) => () => void;
			startNativeScreenRecording: (
				source: SelectedCaptureSource,
				options?: {
					capturesSystemAudio?: boolean;
					capturesMicrophone?: boolean;
					microphoneDeviceId?: string;
					microphoneLabel?: string;
					selectedArea?: SelectedArea;
				},
			) => Promise<{
				success: boolean;
				path?: string;
				message?: string;
				error?: string;
				microphonePath?: string;
			}>;
			stopNativeScreenRecording: () => Promise<{
				success: boolean;
				path?: string;
				message?: string;
				error?: string;
				microphonePath?: string;
			}>;
			startFfmpegRecording: (
				source: SelectedCaptureSource,
			) => Promise<{ success: boolean; path?: string; message?: string; error?: string }>;
			stopFfmpegRecording: () => Promise<{
				success: boolean;
				path?: string;
				message?: string;
				error?: string;
			}>;
			storeRecordedVideo: (
				videoData: ArrayBuffer,
				fileName: string,
			) => Promise<{ success: boolean; path?: string; message?: string }>;
			storeRecordedVideoSegment: (
				videoData: ArrayBuffer,
				fileName: string,
			) => Promise<{ success: boolean; path?: string; message?: string }>;
			getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; message?: string }>;
			finalizeRecordingSession: (payload: {
				videoSegments: Array<{ path: string; durationMs: number }>;
				webcamSegments?: Array<{ path: string; durationMs: number }>;
				microphoneSegments?: Array<{ path: string; durationMs: number }>;
				selectedArea?: SelectedArea | null;
			}) => Promise<{ success: boolean; path?: string; message?: string; error?: string }>;
			discardRecordingArtifacts: (payload: {
				paths: string[];
				clearCurrentVideo?: boolean;
				clearCurrentWebcam?: boolean;
			}) => Promise<{ success: boolean }>;
			readLocalFile: (
				filePath: string,
			) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
			setRecordingState: (recording: boolean) => Promise<void>;
			getCursorTelemetry: (videoPath?: string) => Promise<{
				success: boolean;
				samples: CursorTelemetryPoint[];
				message?: string;
				error?: string;
			}>;
			getSystemCursorAssets: () => Promise<{
				success: boolean;
				cursors: Record<string, SystemCursorAsset>;
				error?: string;
			}>;
			onStopRecordingFromTray: (callback: () => void) => () => void;
			onRecordingStateChanged: (
				callback: (state: { recording: boolean; sourceName: string }) => void,
			) => () => void;
			onRecordingInterrupted: (
				callback: (state: { reason: string; message: string }) => void,
			) => () => void;
			onCursorStateChanged: (
				callback: (state: { cursorType: CursorTelemetryPoint["cursorType"] }) => void,
			) => () => void;
			openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
			getAccessibilityPermissionStatus: () => Promise<{
				success: boolean;
				trusted: boolean;
				prompted: boolean;
				error?: string;
			}>;
			requestAccessibilityPermission: () => Promise<{
				success: boolean;
				trusted: boolean;
				prompted: boolean;
				error?: string;
			}>;
			getScreenRecordingPermissionStatus: () => Promise<{
				success: boolean;
				status: string;
				error?: string;
			}>;
			openDisplayCapturePreferences: () => Promise<{ success: boolean; error?: string }>;
			openAccessibilityPreferences: () => Promise<{ success: boolean; error?: string }>;
			saveExportedVideo: (
				videoData: ArrayBuffer,
				fileName: string,
			) => Promise<{ success: boolean; path?: string; message?: string; canceled?: boolean }>;
			openVideoFilePicker: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
			openAudioFilePicker: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
			setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>;
			getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>;
			clearCurrentVideoPath: () => Promise<{ success: boolean }>;
			setCurrentWebcamPath: (path: string) => Promise<{ success: boolean }>;
			getCurrentWebcamPath: () => Promise<{ success: boolean; path?: string }>;
			clearCurrentWebcamPath: () => Promise<{ success: boolean }>;
			checkFileAvailable: (
				filePath: string,
			) => Promise<{ success: boolean; exists: boolean; path?: string; error?: string }>;
			getCaptionModelStatus: (videoPath?: string) => Promise<{
				success: boolean;
				status?: CaptionModelStatus;
				message?: string;
				error?: string;
			}>;
			generateCaptions: (request: {
				videoPath?: string;
				preferredBackend: "auto" | "whisper.cpp" | "apple-speech";
				model: "base" | "small" | "medium";
				language: string;
				prompt: string;
				preferredSourceAudio: "microphone" | "mixed";
			}) => Promise<{
				success: boolean;
				track?: CaptionTrack;
				canceled?: boolean;
				message?: string;
				error?: string;
			}>;
			cancelCaptionGeneration: () => Promise<{ success: boolean }>;
			exportCaptionsTranscript: (payload: {
				videoPath?: string;
				format: "srt" | "vtt" | "txt";
				track: CaptionTrack;
			}) => Promise<{
				success: boolean;
				path?: string;
				canceled?: boolean;
				message?: string;
				error?: string;
			}>;
			onCaptionGenerationProgress: (
				callback: (progress: CaptionGenerationProgress) => void,
			) => () => void;
			saveProjectFile: (
				projectData: unknown,
				suggestedName?: string,
				existingProjectPath?: string,
			) => Promise<{
				success: boolean;
				path?: string;
				message?: string;
				canceled?: boolean;
				error?: string;
			}>;
			loadProjectFile: () => Promise<{
				success: boolean;
				path?: string;
				project?: unknown;
				message?: string;
				canceled?: boolean;
				error?: string;
			}>;
			loadCurrentProjectFile: () => Promise<{
				success: boolean;
				path?: string;
				project?: unknown;
				message?: string;
				canceled?: boolean;
				error?: string;
			}>;
			onMenuLoadProject: (callback: () => void) => () => void;
			onMenuSaveProject: (callback: () => void) => () => void;
			onMenuSaveProjectAs: (callback: () => void) => () => void;
			getPlatform: () => Promise<string>;
			revealInFolder: (
				filePath: string,
			) => Promise<{ success: boolean; error?: string; message?: string }>;
			openRecordingsFolder: () => Promise<{ success: boolean; error?: string; message?: string }>;
			getRecordingsDirectory: () => Promise<{
				success: boolean;
				path: string;
				isDefault: boolean;
				error?: string;
			}>;
			chooseRecordingsDirectory: () => Promise<{
				success: boolean;
				canceled?: boolean;
				path?: string;
				isDefault?: boolean;
				message?: string;
				error?: string;
			}>;
			getShortcuts: () => Promise<Record<string, unknown> | null>;
			saveShortcuts: (shortcuts: unknown) => Promise<{ success: boolean; error?: string }>;
			hudOverlayHide: () => void;
			hudOverlayClose: () => void;
			getHudOverlayCaptureProtection: () => Promise<{ success: boolean; enabled: boolean }>;
			setHudOverlayCaptureProtection: (
				enabled: boolean,
			) => Promise<{ success: boolean; enabled: boolean }>;
			setHasUnsavedChanges: (hasChanges: boolean) => void;
			onRequestSaveBeforeClose: (callback: () => Promise<void>) => () => void;
			isWgcAvailable: () => Promise<{ available: boolean }>;
			muxWgcRecording: () => Promise<{
				success: boolean;
				path?: string;
				message?: string;
				error?: string;
				microphonePath?: string;
			}>;
			/** Hide the OS cursor before browser capture starts. */
			hideOsCursor: () => Promise<{ success: boolean }>;
			/** Countdown timer before recording */
			getCountdownDelay: () => Promise<{ success: boolean; delay: number }>;
			setCountdownDelay: (delay: number) => Promise<{ success: boolean; error?: string }>;
			startCountdown: (seconds: number) => Promise<{ success: boolean; cancelled?: boolean }>;
			cancelCountdown: () => Promise<{ success: boolean }>;
			onCountdownTick: (callback: (seconds: number) => void) => () => void;
			/** HUD settings */
			getHudSettings: () => Promise<{
				success: boolean;
				settings: Record<string, unknown> | null;
			}>;
			setHudSettings: (
				settings: Record<string, unknown>,
			) => Promise<{ success: boolean; error?: string }>;
			/** Display info */
			getDisplayInfo: () => Promise<{
				success: boolean;
				displays: Array<{
					id: number;
					label: string;
					x: number;
					y: number;
					width: number;
					height: number;
					refreshRate: number;
				}>;
			}>;
			/** Area overlay */
			createAreaOverlay: (displayId?: number) => Promise<{ success: boolean }>;
			closeAreaOverlay: () => Promise<{ success: boolean }>;
			/** Desktop icons (macOS) */
			hideDesktopIcons: () => Promise<{ success: boolean; error?: string }>;
			showDesktopIcons: () => Promise<{ success: boolean; error?: string }>;
			/** Dock icon (macOS) */
			hideDockIcon: () => Promise<{ success: boolean }>;
			showDockIcon: () => Promise<{ success: boolean }>;
			/** Highlight overlay */
			createHighlightOverlay: (rect: {
				x: number;
				y: number;
				width: number;
				height: number;
			}) => Promise<{ success: boolean }>;
			closeHighlightOverlay: () => Promise<{ success: boolean }>;
			/** Resize HUD window */
			resizeHudWindow: (contentVisible: boolean) => Promise<void>;
		};
	}

	interface ProcessedDesktopSource {
		id: string;
		name: string;
		display_id: string;
		thumbnail: string | null;
		appIcon: string | null;
		originalName?: string;
		sourceType?: "screen" | "window";
		appName?: string;
		windowTitle?: string;
	}

	type SelectedCaptureSource = Pick<ProcessedDesktopSource, "id" | "name" | "display_id"> &
		Partial<ProcessedDesktopSource>;

	interface CursorTelemetryPoint {
		timeMs: number;
		cx: number;
		cy: number;
		interactionType?:
			| "move"
			| "click"
			| "double-click"
			| "right-click"
			| "middle-click"
			| "mouseup";
		cursorType?:
			| "arrow"
			| "text"
			| "pointer"
			| "crosshair"
			| "open-hand"
			| "closed-hand"
			| "resize-ew"
			| "resize-ns"
			| "not-allowed";
	}

	interface SystemCursorAsset {
		dataUrl: string;
		hotspotX: number;
		hotspotY: number;
		width: number;
		height: number;
	}
}

export {};
