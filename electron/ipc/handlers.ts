import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { execFile, spawn, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";

import fs, { type FileHandle } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { app, BrowserWindow, clipboard, dialog, ipcMain, type SaveDialogOptions } from "electron";
import {
	WEBCAM_RENDER_PIPELINE_VERSION,
	type WebcamCaptureProfile,
	type WebcamSessionMetadata,
} from "../../src/components/video-editor/types";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import type {
	ExportV2Capabilities,
	ExportV2EncoderCandidate,
	ExportV2GifPipeStartRequest,
	ExportV2Progress,
	ExportV2StartRequest,
	ExportV2StartResult,
	ExportV2TrimRegion,
} from "../../src/lib/exporter/exportV2";
import {
	buildGifPaletteFilter,
	buildGifRawPipeFfmpegArgs,
	resolveGifFfmpegLoop,
} from "../../src/lib/exporter/gifFfmpeg";
import { compileNativeComposedExport } from "../../src/lib/exporter/nativeComposed";
import { isFeatureEnabled } from "../../src/lib/featureFlags";
import { buildCollisionFileName, ensureFileExtension } from "../../src/lib/fileNames";
import type { PostRecordingContext } from "../../src/lib/recording/postRecording";
import type {
	SelectedArea,
	CursorTelemetrySample as SessionCursorTelemetrySample,
} from "../../src/lib/recording/session";
import { createExportTempPath } from "../exportTemp";
import { RECORDINGS_DIR } from "../main";
import { markRecordingStarted, markRecordingStopped } from "../recordingRecovery";
import { getScreenMintUpdater } from "../updater";
import { createExportWorkerWindow } from "../windows";
import { registerAppShellIpcHandlers } from "./appShellHandlers";
import { registerAssetIpcHandlers } from "./assetHandlers";
import { registerCaptionIpcHandlers } from "./captionHandlers";
import { registerCaptureSourceIpcHandlers } from "./captureSourceHandlers";
import { registerChunkSessionIpcHandlers } from "./chunkSessionHandlers";
import { registerCurrentMediaIpcHandlers } from "./currentMediaHandlers";
import {
	type CursorCapturePlatform,
	type CursorMoveSampleCandidate,
	type CursorProjectionConfidence,
	type CursorTelemetryGeometrySource,
	physicalBoundsToDip,
	physicalPointToDip,
	shouldRecordCursorMoveSample,
} from "./cursorTelemetryUtils";
import { registerExportFileIpcHandlers } from "./exportFileHandlers";
import { registerExportV2StreamIpcHandlers } from "./exportV2StreamHandlers";
import { registerHostValidationIpcHandlers } from "./hostValidationHandlers";
import { registerLayeredCaptureIpcHandlers } from "./layeredCaptureHandlers";
import { registerMobileCaptureIpcHandlers } from "./mobileCaptureHandlers";
import { registerPermissionDiagnosticsIpcHandlers } from "./permissionDiagnosticsHandlers";
import { registerPostRecordingIpcHandlers } from "./postRecordingHandlers";
import { registerProjectFileIpcHandlers } from "./projectFileHandlers";
import { registerScreenshotIpcHandlers } from "./screenshotHandlers";
import { registerSystemSettingsIpcHandlers } from "./systemSettingsHandlers";
import { registerTelemetryReadIpcHandlers } from "./telemetryReadHandlers";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const BRAND_NAME = "ScreenMint";
const APP_BUNDLE_ID = "com.jahirsheikh.screenmint";
const PROJECT_FILE_EXTENSION = "screenmint";
const PROJECT_FILE_EXTENSIONS = [PROJECT_FILE_EXTENSION];
const APP_NAME_ALIASES = ["screenmint"];
const RECORDINGS_SETTINGS_FILE = path.join(app.getPath("userData"), "recordings-settings.json");
const AUTO_RECORDING_PREFIX = "recording-";
const AUTO_RECORDING_RETENTION_COUNT = 20;
const AUTO_RECORDING_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const ALLOW_OWN_WINDOW_CAPTURE = Boolean(process.env["VITE_DEV_SERVER_URL"]);

function getScreen() {
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

type SelectedSource = {
	id?: string;
	name: string;
	display_id?: string;
	sourceType?: "screen" | "window";
	appName?: string;
	windowTitle?: string;
	[key: string]: unknown;
};

type NativeMacRecordingOptions = {
	capturesSystemAudio?: boolean;
	capturesMicrophone?: boolean;
	microphoneDeviceId?: string;
	microphoneLabel?: string;
	selectedArea?: SelectedArea;
	recordingFps?: number;
	recordingWidth?: number;
	recordingHeight?: number;
	videoBitsPerSecond?: number;
	hardwareAcceleration?: boolean;
};

type WindowBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

let selectedSource: SelectedSource | null = null;
let userExplicitlySelectedSource = false;
let selectedArea: SelectedArea | null = null;

function notifySelectedAreaChanged(): void {
	const payload = { area: selectedArea };

	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send("selected-area-changed", payload);
		}
	}
}
let currentProjectPath: string | null = null;
let postRecordingContext: PostRecordingContext | null = null;
type FinalizeResult = {
	success: boolean;
	path?: string;
	webcamPath?: string | null;
	webcamSessionMetadata?: WebcamSessionMetadata | null;
	microphonePath?: string | null;
	message?: string;
	error?: string;
};
let pendingFinalizationPromise: Promise<FinalizeResult> | null = null;
let lastFinalizationResult: FinalizeResult | null = null;
let nativeScreenRecordingActive = false;
let currentVideoPath: string | null = null;
let currentWebcamPath: string | null = null;
let currentMicrophoneAudioPath: string | null = null;
let nativeCaptureProcess: ChildProcessWithoutNullStreams | null = null;
let nativeCaptureOutputBuffer = "";
let nativeCaptureTargetPath: string | null = null;
let nativeCaptureStopRequested = false;
let nativeCaptureMicrophonePath: string | null = null;
let nativeCursorMonitorProcess: ChildProcessWithoutNullStreams | null = null;
let nativeCursorMonitorOutputBuffer = "";
let nativeWindowBoundsMonitorProcess: ChildProcessWithoutNullStreams | null = null;
let nativeWindowBoundsMonitorOutputBuffer = "";
let wgcCaptureProcess: ChildProcessWithoutNullStreams | null = null;
let wgcCaptureOutputBuffer = "";
let wgcCaptureTargetPath: string | null = null;
let wgcScreenRecordingActive = false;
let wgcCaptureStopRequested = false;
let wgcSystemAudioPath: string | null = null;
let wgcMicAudioPath: string | null = null;
let wgcPendingVideoPath: string | null = null;
let ffmpegScreenRecordingActive = false;
let ffmpegCaptureProcess: ChildProcessWithoutNullStreams | null = null;
let ffmpegCaptureOutputBuffer = "";
let ffmpegCaptureTargetPath: string | null = null;
const exportV2Jobs = new Map<
	string,
	{
		process: ChildProcessWithoutNullStreams;
		outputPath: string;
		startedAtMs: number;
		engine: ExportV2FfmpegEngine;
	}
>();
const exportV2CanceledJobs = new Set<string>();
const exportV2WorkerResolvers = new Map<string, (result: ExportV2StartResult) => void>();
const exportV2WorkerOwners = new Map<string, Electron.WebContents>();
const exportV2WorkerWindows = new Map<string, BrowserWindow>();
type ExportV2StreamSession = {
	id: string;
	path: string;
	handle: FileHandle;
	pending: Promise<void>;
	bytesWritten: number;
	closed: boolean;
};
const exportV2StreamSessions = new Map<string, ExportV2StreamSession>();
type ExportV2GifPipeSession = {
	id: string;
	jobId?: string;
	path: string;
	process: ChildProcessWithoutNullStreams;
	pending: Promise<void>;
	closePromise: Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }>;
	frameBytes: number;
	framesWritten: number;
	stderr: string;
	closed: boolean;
};
const exportV2GifPipeSessions = new Map<string, ExportV2GifPipeSession>();
let customRecordingsDir: string | null = null;
let recordingsDirLoaded = false;
let cachedSystemCursorAssets: Record<string, SystemCursorAsset> | null = null;
let cachedSystemCursorAssetsSourceMtimeMs: number | null = null;

type ExportV2FfmpegEngine = "direct-native" | "native-composed";

type ExportV2FfmpegAttempt = {
	args: string[];
	encoder: ExportV2EncoderCandidate;
	nativeComposedFallbackReason?: string;
	nativeComposedFeatures?: string[];
};

type SystemCursorAsset = {
	dataUrl: string;
	hotspotX: number;
	hotspotY: number;
	width: number;
	height: number;
};

type RecordingSegmentPayload = {
	path: string;
	durationMs: number;
};

type ProbedVideoSegmentProfile = {
	path: string;
	codec: string | null;
	pixelFormat: string | null;
	width: number | null;
	height: number | null;
	frameRate: number | null;
	captureProfile: WebcamCaptureProfile | null;
};

type WebcamConcatTargetProfile = {
	codec: "vp8" | "vp9";
	pixelFormat: "yuv420p";
	width: number;
	height: number;
	frameRate: number;
	captureProfile: WebcamCaptureProfile;
};

type CursorVisualType =
	| "arrow"
	| "text"
	| "pointer"
	| "crosshair"
	| "open-hand"
	| "closed-hand"
	| "resize-ew"
	| "resize-ns"
	| "resize-nesw"
	| "not-allowed"
	| "copy"
	| "help"
	| "move"
	| "zoom-in"
	| "zoom-out"
	| "screenshot-selection"
	| "unknown";

const CURSOR_VISUAL_TYPES: CursorVisualType[] = [
	"arrow",
	"text",
	"pointer",
	"crosshair",
	"open-hand",
	"closed-hand",
	"resize-ew",
	"resize-ns",
	"resize-nesw",
	"not-allowed",
	"copy",
	"help",
	"move",
	"zoom-in",
	"zoom-out",
	"screenshot-selection",
	"unknown",
];

function isCursorVisualType(value: string): value is CursorVisualType {
	return CURSOR_VISUAL_TYPES.includes(value as CursorVisualType);
}

let currentCursorVisualType: CursorVisualType | undefined = undefined;

/** Returns the currently selected source ID for setDisplayMediaRequestHandler */
export function getSelectedSourceId(): string | null {
	return (selectedSource?.id as string | null) ?? null;
}

export function killWgcCaptureProcess() {
	if (wgcCaptureProcess) {
		try {
			wgcCaptureProcess.kill();
		} catch {
			/* ignore */
		}
		wgcCaptureProcess = null;
		wgcCaptureTargetPath = null;
		wgcScreenRecordingActive = false;
		nativeScreenRecordingActive = false;
		wgcCaptureStopRequested = false;
		wgcSystemAudioPath = null;
		wgcMicAudioPath = null;
		wgcPendingVideoPath = null;
		currentMicrophoneAudioPath = null;
	}
}

function normalizePath(filePath: string) {
	return path.resolve(filePath);
}

function normalizeDesktopSourceName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getAppBundlePath() {
	if (process.platform !== "darwin" || !app.isPackaged) {
		return null;
	}

	return path.resolve(process.execPath, "../../..");
}

function getExpectedApplicationsBundlePath() {
	if (process.platform !== "darwin") {
		return null;
	}

	return path.join("/Applications", `${app.getName()}.app`);
}

function isAutoRecordingPath(filePath: string) {
	return path.basename(filePath).startsWith(AUTO_RECORDING_PREFIX);
}

function getTelemetryPathForVideo(videoPath: string) {
	return `${videoPath}.cursor.json`;
}

function getKeyboardTelemetryPathForVideo(videoPath: string) {
	return `${videoPath}.keyboard.json`;
}

async function loadRecordingsDirectorySetting() {
	if (recordingsDirLoaded) {
		return;
	}

	recordingsDirLoaded = true;

	try {
		const content = await fs.readFile(RECORDINGS_SETTINGS_FILE, "utf-8");
		const parsed = JSON.parse(content) as { recordingsDir?: unknown };
		if (typeof parsed.recordingsDir === "string" && parsed.recordingsDir.trim()) {
			customRecordingsDir = path.resolve(parsed.recordingsDir);
		}
	} catch {
		customRecordingsDir = null;
	}
}

/** Makes a recovered recording the current editor video. */
export function adoptRecoveredRecording(videoPath: string) {
	currentVideoPath = videoPath;
	currentProjectPath = null;
}

async function getRecordingsDir() {
	await loadRecordingsDirectorySetting();
	const targetDir = customRecordingsDir ?? RECORDINGS_DIR;
	await fs.mkdir(targetDir, { recursive: true });
	return targetDir;
}

async function persistRecordingsDirectorySetting(nextDir: string) {
	customRecordingsDir = path.resolve(nextDir);
	recordingsDirLoaded = true;
	await fs.writeFile(
		RECORDINGS_SETTINGS_FILE,
		JSON.stringify({ recordingsDir: customRecordingsDir }, null, 2),
		"utf-8",
	);
}

function normalizeVideoSourcePath(videoPath?: string | null): string | null {
	if (typeof videoPath !== "string") {
		return null;
	}

	const trimmed = videoPath.trim();
	if (!trimmed) {
		return null;
	}

	if (/^file:\/\//i.test(trimmed)) {
		try {
			return fileURLToPath(trimmed);
		} catch {
			// Fall through and keep best-effort string path below.
		}
	}

	return trimmed;
}

function isPathInsideDirectory(candidatePath: string, directoryPath: string): boolean {
	const normalizedCandidate = path.resolve(candidatePath);
	const normalizedDirectory = path.resolve(directoryPath);
	return (
		normalizedCandidate === normalizedDirectory ||
		normalizedCandidate.startsWith(`${normalizedDirectory}${path.sep}`)
	);
}

async function deletePathIfExists(targetPath: string): Promise<boolean> {
	try {
		await fs.unlink(targetPath);
		return true;
	} catch (error) {
		const code =
			error && typeof error === "object" && "code" in error
				? String((error as { code?: unknown }).code)
				: "";
		if (code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

async function hasSiblingProjectFile(videoPath: string) {
	const baseName = path.basename(videoPath, path.extname(videoPath));
	const candidateExtensions = PROJECT_FILE_EXTENSIONS;

	for (const extension of candidateExtensions) {
		const projectPath = path.join(path.dirname(videoPath), `${baseName}.${extension}`);

		try {
			await fs.access(projectPath);
			return true;
		} catch {
			continue;
		}
	}

	return false;
}

async function pruneAutoRecordings(exemptPaths: string[] = []) {
	const recordingsDir = await getRecordingsDir();
	const exempt = new Set(
		[currentVideoPath, ...exemptPaths]
			.filter((value): value is string => Boolean(value))
			.map((value) => normalizePath(value)),
	);

	const entries = await fs.readdir(recordingsDir, { withFileTypes: true });
	const autoRecordingStats = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && /^recording-.*\.(mp4|mov|webm)$/i.test(entry.name))
			.map(async (entry) => {
				const filePath = path.join(recordingsDir, entry.name);
				const stats = await fs.stat(filePath);
				return { filePath, stats };
			}),
	);

	const sorted = autoRecordingStats.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);
	const now = Date.now();

	for (const [index, entry] of sorted.entries()) {
		const normalizedFilePath = normalizePath(entry.filePath);
		if (exempt.has(normalizedFilePath)) {
			continue;
		}

		if (await hasSiblingProjectFile(entry.filePath)) {
			continue;
		}

		const tooOld = now - entry.stats.mtimeMs > AUTO_RECORDING_MAX_AGE_MS;
		const overLimit = index >= AUTO_RECORDING_RETENTION_COUNT;
		if (!tooOld && !overLimit) {
			continue;
		}

		try {
			await fs.rm(entry.filePath, { force: true });
			await Promise.all([
				fs.rm(getTelemetryPathForVideo(entry.filePath), { force: true }),
				fs.rm(getKeyboardTelemetryPathForVideo(entry.filePath), { force: true }),
			]);
		} catch (error) {
			console.warn("Failed to prune old auto recording:", entry.filePath, error);
		}
	}
}

/**
 * Resolve a path within the app bundle, handling asar unpacking in production.
 * Files listed in asarUnpack are extracted to app.asar.unpacked/ and must be
 * accessed via that path instead of the asar virtual filesystem.
 */
function resolveUnpackedAppPath(...segments: string[]) {
	const base = app.getAppPath();
	const resolved = path.join(base, ...segments);
	if (app.isPackaged) {
		return resolved.replace(/\.asar([/\\])/, ".asar.unpacked$1");
	}
	return resolved;
}

function getNativeCaptureHelperSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "ScreenCaptureKitRecorder.swift");
}

function getNativeArchTag() {
	return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
}

function getPrebundledNativeHelperPath(binaryName: string) {
	return resolveUnpackedAppPath("electron", "native", "bin", getNativeArchTag(), binaryName);
}

function getNativeCaptureHelperBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-screencapturekit-helper");
}

function getSystemCursorHelperSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "SystemCursorAssets.swift");
}

function getSystemCursorHelperBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-system-cursors");
}

function getNativeCursorMonitorSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "NativeCursorMonitor.swift");
}

function getNativeCursorMonitorBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-native-cursor-monitor");
}

function getNativeWindowListSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "ScreenCaptureKitWindowList.swift");
}

function getNativeWindowListBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-window-list");
}

function getNativeWindowBoundsMonitorSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "NativeWindowBoundsMonitor.swift");
}

function getNativeWindowBoundsMonitorBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-window-bounds-monitor");
}

type NativeMacWindowSource = {
	id: string;
	name: string;
	display_id?: string;
	appName?: string;
	windowTitle?: string;
	bundleId?: string;
	appIcon?: string | null;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};

let cachedNativeMacWindowSources: NativeMacWindowSource[] | null = null;
let cachedNativeMacWindowSourcesAtMs = 0;

async function ensureSwiftHelperBinary(
	sourcePath: string,
	binaryPath: string,
	label: string,
	prebundledBinaryName?: string,
) {
	if (prebundledBinaryName) {
		const prebundledPath = getPrebundledNativeHelperPath(prebundledBinaryName);
		try {
			await fs.access(prebundledPath, fsConstants.X_OK);
			return prebundledPath;
		} catch {
			if (app.isPackaged) {
				throw new Error(
					`${label} is missing from this app build (${prebundledPath}). Reinstall or update the app.`,
				);
			}
		}
	}

	const helperDir = path.dirname(binaryPath);

	await fs.mkdir(helperDir, { recursive: true });

	let shouldCompile = false;
	try {
		const [sourceStat, binaryStat] = await Promise.all([
			fs.stat(sourcePath),
			fs.stat(binaryPath).catch(() => null),
		]);
		shouldCompile = !binaryStat || sourceStat.mtimeMs > binaryStat.mtimeMs;
	} catch (error) {
		throw new Error(`${label} source is unavailable: ${String(error)}`);
	}

	if (!shouldCompile) {
		return binaryPath;
	}

	const result = spawnSync("swiftc", ["-O", sourcePath, "-o", binaryPath], {
		encoding: "utf8",
		timeout: 120000,
	});

	if (result.status !== 0) {
		const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
		throw new Error(details || `Failed to compile ${label}`);
	}

	return binaryPath;
}

async function ensureNativeCaptureHelperBinary() {
	return ensureSwiftHelperBinary(
		getNativeCaptureHelperSourcePath(),
		getNativeCaptureHelperBinaryPath(),
		"native ScreenCaptureKit helper",
		"screenmint-screencapturekit-helper",
	);
}

async function ensureNativeWindowListBinary() {
	return ensureSwiftHelperBinary(
		getNativeWindowListSourcePath(),
		getNativeWindowListBinaryPath(),
		"native ScreenCaptureKit window list helper",
		"screenmint-window-list",
	);
}

async function ensureNativeWindowBoundsMonitorBinary() {
	return ensureSwiftHelperBinary(
		getNativeWindowBoundsMonitorSourcePath(),
		getNativeWindowBoundsMonitorBinaryPath(),
		"native window bounds monitor helper",
		"screenmint-window-bounds-monitor",
	);
}

async function getNativeMacWindowSources(options?: { maxAgeMs?: number }) {
	if (process.platform !== "darwin") {
		return [] as NativeMacWindowSource[];
	}

	const maxAgeMs = options?.maxAgeMs ?? 5000;
	const now = Date.now();
	if (cachedNativeMacWindowSources && now - cachedNativeMacWindowSourcesAtMs < maxAgeMs) {
		return cachedNativeMacWindowSources;
	}

	const binaryPath = await ensureNativeWindowListBinary();
	const { stdout } = await execFileAsync(binaryPath, [], {
		timeout: 30000,
		maxBuffer: 10 * 1024 * 1024,
	});

	const parsed = JSON.parse(stdout);
	if (!Array.isArray(parsed)) {
		return [] as NativeMacWindowSource[];
	}

	const entries = parsed.filter((entry: unknown): entry is NativeMacWindowSource => {
		if (!entry || typeof entry !== "object") {
			return false;
		}

		const candidate = entry as Partial<NativeMacWindowSource>;
		return typeof candidate.id === "string" && typeof candidate.name === "string";
	});

	cachedNativeMacWindowSources = entries;
	cachedNativeMacWindowSourcesAtMs = now;
	return entries;
}

async function getSystemCursorAssets() {
	if (process.platform !== "darwin") {
		cachedSystemCursorAssets = {};
		cachedSystemCursorAssetsSourceMtimeMs = null;
		return cachedSystemCursorAssets;
	}

	const sourcePath = getSystemCursorHelperSourcePath();
	const sourceStat = await fs.stat(sourcePath);
	if (cachedSystemCursorAssets && cachedSystemCursorAssetsSourceMtimeMs === sourceStat.mtimeMs) {
		return cachedSystemCursorAssets;
	}

	const binaryPath = await ensureSwiftHelperBinary(
		sourcePath,
		getSystemCursorHelperBinaryPath(),
		"system cursor helper",
		"screenmint-system-cursors",
	);

	const { stdout } = await execFileAsync(binaryPath, [], {
		timeout: 15000,
		maxBuffer: 20 * 1024 * 1024,
	});
	const parsed = JSON.parse(stdout) as Record<string, Partial<SystemCursorAsset>>;
	cachedSystemCursorAssets = Object.fromEntries(
		Object.entries(parsed).filter(
			([, asset]) =>
				typeof asset?.dataUrl === "string" &&
				typeof asset?.hotspotX === "number" &&
				typeof asset?.hotspotY === "number" &&
				typeof asset?.width === "number" &&
				typeof asset?.height === "number",
		),
	) as Record<string, SystemCursorAsset>;
	cachedSystemCursorAssetsSourceMtimeMs = sourceStat.mtimeMs;

	return cachedSystemCursorAssets;
}

function parseWindowId(sourceId?: string) {
	if (!sourceId) return null;
	const match = sourceId.match(/^window:(\d+)/);
	return match ? Number.parseInt(match[1], 10) : null;
}

function loadFfmpegStatic() {
	const moduleExports = nodeRequire("ffmpeg-static");
	if (typeof moduleExports === "string") {
		return moduleExports;
	}

	if (typeof moduleExports?.default === "string") {
		return moduleExports.default as string;
	}

	return null;
}

function loadUiohookModule(): UiohookModule | null {
	const moduleExports = nodeRequire("uiohook-napi") as {
		uIOhook?: UiohookModule;
		uiohook?: UiohookModule;
		Uiohook?: UiohookModule;
		default?: { uIOhook?: UiohookModule; uiohook?: UiohookModule } | UiohookModule;
	};
	if (moduleExports.uIOhook) return moduleExports.uIOhook;
	if (moduleExports.uiohook) return moduleExports.uiohook;
	if (moduleExports.Uiohook) return moduleExports.Uiohook;

	if (typeof moduleExports.default === "object" && moduleExports.default !== null) {
		const defaultExport = moduleExports.default as
			| { uIOhook?: UiohookModule; uiohook?: UiohookModule }
			| UiohookModule;
		if ("uIOhook" in defaultExport && defaultExport.uIOhook) {
			return defaultExport.uIOhook;
		}
		if ("uiohook" in defaultExport && defaultExport.uiohook) {
			return defaultExport.uiohook;
		}
		if ("on" in defaultExport && typeof defaultExport.on === "function") {
			return defaultExport;
		}
	}

	return null;
}

function getFfmpegBinaryPath() {
	const ffmpegStatic = loadFfmpegStatic();
	if (!ffmpegStatic || typeof ffmpegStatic !== "string") {
		throw new Error("FFmpeg binary is unavailable. Install ffmpeg-static for this platform.");
	}

	if (app.isPackaged) {
		return ffmpegStatic.replace(/\.asar([/\\])/, ".asar.unpacked$1");
	}

	return ffmpegStatic;
}

function isExportV2Enabled() {
	return (
		process.env["SCREENMINT_EXPORT_V2"] === "1" || process.env["SCREENMINT_EXPORT_V2"] === "true"
	);
}

function getExportV2EncoderPriority(platform: NodeJS.Platform): ExportV2EncoderCandidate[] {
	const software: ExportV2EncoderCandidate = {
		name: "libx264",
		label: "x264 H.264",
		hardwareAcceleration: "software",
		available: false,
	};

	switch (platform) {
		case "darwin":
			return [
				{
					name: "h264_videotoolbox",
					label: "VideoToolbox H.264",
					hardwareAcceleration: "hardware",
					available: false,
				},
				software,
			];
		case "win32":
			return [
				{
					name: "h264_nvenc",
					label: "NVIDIA NVENC H.264",
					hardwareAcceleration: "hardware",
					available: false,
				},
				{
					name: "h264_qsv",
					label: "Intel Quick Sync H.264",
					hardwareAcceleration: "hardware",
					available: false,
				},
				{
					name: "h264_amf",
					label: "AMD AMF H.264",
					hardwareAcceleration: "hardware",
					available: false,
				},
				software,
			];
		case "linux":
			return [
				{
					name: "h264_vaapi",
					label: "VAAPI H.264",
					hardwareAcceleration: "hardware",
					available: false,
				},
				software,
			];
		default:
			return [software];
	}
}

let cachedExportV2Capabilities: ExportV2Capabilities | null = null;

function probeExportV2Capabilities(): ExportV2Capabilities {
	const warnings: string[] = [];
	let ffmpegPath: string | undefined;
	let encoderOutput = "";
	let filterOutput = "";

	try {
		ffmpegPath = getFfmpegBinaryPath();
		const encoderProbe = spawnSync(ffmpegPath, ["-hide_banner", "-encoders"], {
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		});
		encoderOutput = `${encoderProbe.stdout ?? ""}\n${encoderProbe.stderr ?? ""}`;
		const filterProbe = spawnSync(ffmpegPath, ["-hide_banner", "-filters"], {
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		});
		filterOutput = `${filterProbe.stdout ?? ""}\n${filterProbe.stderr ?? ""}`;
	} catch (error) {
		warnings.push(`FFmpeg probe failed: ${String(error)}`);
	}

	const videoEncoders = getExportV2EncoderPriority(process.platform).map((candidate) => ({
		...candidate,
		available: new RegExp(`\\b${candidate.name}\\b`).test(encoderOutput),
	}));
	const gifPalettePipeline =
		/\bpalettegen\b/.test(filterOutput) && /\bpaletteuse\b/.test(filterOutput);
	if (!videoEncoders.some((encoder) => encoder.available)) {
		warnings.push("No H.264 encoder was detected for export v2.");
	}
	if (!gifPalettePipeline) {
		warnings.push("FFmpeg GIF palette filters are unavailable.");
	}

	return {
		enabled: isExportV2Enabled(),
		platform: process.platform,
		ffmpegPath,
		videoEncoders,
		gif: {
			ffmpegPalettePipeline: gifPalettePipeline,
		},
		warnings,
	};
}

function getCachedExportV2Capabilities() {
	cachedExportV2Capabilities ??= probeExportV2Capabilities();
	return cachedExportV2Capabilities;
}

function getExportSaveDialogOptions(fileName: string): SaveDialogOptions {
	const isGif = fileName.toLowerCase().endsWith(".gif");
	const safeFileName = ensureFileExtension(fileName, isGif ? "gif" : "mp4");
	const filters = isGif
		? [{ name: "GIF Image", extensions: ["gif"] }]
		: [{ name: "MP4 Video", extensions: ["mp4"] }];

	return {
		title: isGif ? "Save Exported GIF" : "Save Exported Video",
		defaultPath: path.join(app.getPath("downloads"), safeFileName),
		filters,
		properties: ["createDirectory", "showOverwriteConfirmation"],
	};
}

async function findAvailableFilePath(directoryPath: string, fileName: string) {
	for (let collisionIndex = 0; collisionIndex < 1000; collisionIndex += 1) {
		const candidatePath = path.join(
			directoryPath,
			buildCollisionFileName(fileName, collisionIndex),
		);

		try {
			await fs.access(candidatePath);
		} catch (error) {
			const code =
				error && typeof error === "object" && "code" in error
					? String((error as { code?: unknown }).code)
					: "";
			if (code === "ENOENT") {
				return candidatePath;
			}
			throw error;
		}
	}

	throw new Error(`Unable to find an available filename for ${fileName}`);
}

async function writeBufferToUniqueFile(directoryPath: string, fileName: string, data: Buffer) {
	for (let collisionIndex = 0; collisionIndex < 1000; collisionIndex += 1) {
		const candidatePath = path.join(
			directoryPath,
			buildCollisionFileName(fileName, collisionIndex),
		);

		try {
			await fs.writeFile(candidatePath, data, { flag: "wx" });
			return candidatePath;
		} catch (error) {
			const code =
				error && typeof error === "object" && "code" in error
					? String((error as { code?: unknown }).code)
					: "";
			if (code === "EEXIST") {
				continue;
			}
			throw error;
		}
	}

	throw new Error(`Unable to save ${fileName}; too many files with similar names exist.`);
}

function normalizeExportV2SourcePath(sourcePath: string) {
	if (sourcePath.startsWith("file://")) {
		return fileURLToPath(sourcePath);
	}
	return sourcePath;
}

function buildTrimSelectExpression(trimRegions: ExportV2TrimRegion[] = []) {
	const validTrims = trimRegions
		.filter((region) => region.endMs > region.startMs)
		.map((region) => ({
			startSec: Math.max(0, region.startMs / 1000),
			endSec: Math.max(0, region.endMs / 1000),
		}));

	if (validTrims.length === 0) {
		return null;
	}

	const removedRanges = validTrims
		.map((region) => `between(t\\,${region.startSec.toFixed(3)}\\,${region.endSec.toFixed(3)})`)
		.join("+");
	return `not(${removedRanges})`;
}

async function resolveExportV2OutputPath(request: ExportV2StartRequest) {
	const extension = request.format === "gif" ? "gif" : "mp4";
	const fileName = ensureFileExtension(request.fileName, extension);

	if (request.outputPath) {
		return { path: request.outputPath, canceled: false };
	}

	if (request.destination === "clipboard") {
		return {
			path: path.join(app.getPath("temp"), `screenmint-export-v2-${Date.now()}.${extension}`),
			canceled: false,
		};
	}

	if (request.destination === "temp") {
		const tempPath = createExportTempPath(app.getPath("temp"), extension);
		await fs.mkdir(path.dirname(tempPath), { recursive: true });
		return { path: tempPath, canceled: false };
	}

	if (request.destination === "file") {
		const result = await dialog.showSaveDialog(getExportSaveDialogOptions(fileName));
		return { path: result.filePath, canceled: result.canceled || !result.filePath };
	}

	const recordingsDir = await getRecordingsDir();
	return {
		path: await findAvailableFilePath(recordingsDir, fileName),
		canceled: false,
	};
}

async function startExportV2StreamSession(filePath: string) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	const id = `export-stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const handle = await fs.open(filePath, "w");
	const session: ExportV2StreamSession = {
		id,
		path: filePath,
		handle,
		pending: Promise.resolve(),
		bytesWritten: 0,
		closed: false,
	};
	exportV2StreamSessions.set(id, session);
	return { id, path: filePath };
}

function getExportV2StreamSession(id: string) {
	const session = exportV2StreamSessions.get(id);
	if (!session || session.closed) {
		throw new Error("Export stream session is not available.");
	}
	return session;
}

async function appendExportV2StreamSession(
	id: string,
	chunk: ArrayBuffer | Uint8Array,
	position: number,
) {
	const session = getExportV2StreamSession(id);
	const buffer = Buffer.from(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
	if (buffer.byteLength === 0) {
		return { success: true, bytesWritten: session.bytesWritten };
	}

	session.pending = session.pending.then(async () => {
		await session.handle.write(buffer, 0, buffer.byteLength, position);
		session.bytesWritten = Math.max(session.bytesWritten, position + buffer.byteLength);
	});
	await session.pending;
	return { success: true, bytesWritten: session.bytesWritten };
}

async function finishExportV2StreamSession(id: string) {
	const session = getExportV2StreamSession(id);
	session.closed = true;
	await session.pending;
	await session.handle.close();
	exportV2StreamSessions.delete(id);
	return { path: session.path, bytesWritten: session.bytesWritten };
}

async function discardExportV2StreamSession(id: string) {
	const session = exportV2StreamSessions.get(id);
	if (!session) {
		return;
	}

	session.closed = true;
	exportV2StreamSessions.delete(id);
	await session.pending.catch(() => undefined);
	await session.handle.close().catch(() => undefined);
	await fs.rm(session.path, { force: true }).catch(() => undefined);
}

async function startExportV2GifPipeSession(request: ExportV2GifPipeStartRequest) {
	if (request.width <= 0 || request.height <= 0 || request.frameRate <= 0) {
		throw new Error("Invalid GIF pipe dimensions or frame rate.");
	}

	await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
	await fs.rm(request.outputPath, { force: true }).catch(() => undefined);
	const id = `export-gif-pipe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const ffmpegPath = getFfmpegBinaryPath();
	const child = spawn(
		ffmpegPath,
		buildGifRawPipeFfmpegArgs({
			width: request.width,
			height: request.height,
			frameRate: request.frameRate,
			outputPath: request.outputPath,
			settings: request.gif,
		}),
		{
			windowsHide: true,
		},
	);
	const closePromise = new Promise<{
		code: number | null;
		signal: NodeJS.Signals | null;
		error?: Error;
	}>((resolve) => {
		child.once("error", (error) => resolve({ code: 1, signal: null, error }));
		child.once("close", (code, signal) => resolve({ code, signal }));
	});
	const session: ExportV2GifPipeSession = {
		id,
		jobId: request.jobId,
		path: request.outputPath,
		process: child,
		pending: Promise.resolve(),
		closePromise,
		frameBytes: request.width * request.height * 4,
		framesWritten: 0,
		stderr: "",
		closed: false,
	};

	child.stderr.on("data", (chunk: Buffer) => {
		session.stderr = `${session.stderr}${chunk.toString()}`.slice(-16 * 1024);
	});

	child.on("error", (error) => {
		session.stderr = `${session.stderr}\n${error.message}`.slice(-16 * 1024);
	});

	exportV2GifPipeSessions.set(id, session);
	return { id, path: request.outputPath };
}

function getExportV2GifPipeSession(id: string) {
	const session = exportV2GifPipeSessions.get(id);
	if (!session || session.closed) {
		throw new Error("GIF pipe session is not available.");
	}
	return session;
}

function writeExportV2GifPipeChunk(session: ExportV2GifPipeSession, buffer: Buffer) {
	return new Promise<void>((resolve, reject) => {
		if (session.process.stdin.destroyed || session.process.killed) {
			reject(new Error("GIF encoder process is no longer accepting frames."));
			return;
		}

		session.process.stdin.write(buffer, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

async function appendExportV2GifPipeSession(id: string, chunk: ArrayBuffer | Uint8Array) {
	const session = getExportV2GifPipeSession(id);
	const buffer = Buffer.from(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
	if (buffer.byteLength !== session.frameBytes) {
		throw new Error(
			`GIF pipe frame size mismatch: expected ${session.frameBytes} bytes, received ${buffer.byteLength}.`,
		);
	}

	session.pending = session.pending.then(async () => {
		await writeExportV2GifPipeChunk(session, buffer);
		session.framesWritten++;
	});
	await session.pending;
	return { success: true, framesWritten: session.framesWritten };
}

async function finishExportV2GifPipeSession(id: string) {
	const session = getExportV2GifPipeSession(id);
	session.closed = true;
	await session.pending;

	session.process.stdin.end();
	const closeResult = await session.closePromise;

	exportV2GifPipeSessions.delete(id);
	if (closeResult.error || closeResult.code !== 0) {
		await fs.rm(session.path, { force: true }).catch(() => undefined);
		const stderr = session.stderr.trim();
		throw new Error(
			stderr ||
				closeResult.error?.message ||
				`FFmpeg GIF encoder failed with code ${closeResult.code ?? closeResult.signal ?? "unknown"}.`,
		);
	}

	const stat = await fs.stat(session.path);
	return { path: session.path, bytesWritten: stat.size };
}

async function discardExportV2GifPipeSession(id: string) {
	const session = exportV2GifPipeSessions.get(id);
	if (!session) {
		return;
	}

	session.closed = true;
	exportV2GifPipeSessions.delete(id);
	await session.pending.catch(() => undefined);
	session.process.stdin.destroy();
	session.process.kill("SIGTERM");
	await session.closePromise.catch(() => undefined);
	await fs.rm(session.path, { force: true }).catch(() => undefined);
}

async function discardExportV2GifPipeSessionsForJob(jobId: string) {
	const matchingSessions = [...exportV2GifPipeSessions.values()].filter(
		(session) => session.jobId === jobId,
	);
	await Promise.all(matchingSessions.map((session) => discardExportV2GifPipeSession(session.id)));
}

function getAvailableExportV2VideoEncoders(capabilities: ExportV2Capabilities) {
	return capabilities.videoEncoders.filter((encoder) => encoder.available);
}

function buildExportV2VideoArgs(
	request: ExportV2StartRequest,
	outputPath: string,
	encoder: ExportV2EncoderCandidate,
): ExportV2FfmpegAttempt {
	const filters: string[] = [];
	const trimExpression = buildTrimSelectExpression(request.trimRegions);
	if (trimExpression) {
		filters.push(`select='${trimExpression}',setpts=N/FRAME_RATE/TB`);
	}
	filters.push(`fps=${request.frameRate}`);
	filters.push(`scale=${request.width}:${request.height}:flags=lanczos`);
	filters.push("format=yuv420p");

	const audioFilters: string[] = [];
	if (trimExpression) {
		audioFilters.push(`aselect='${trimExpression}',asetpts=N/SR/TB`);
	}

	const args = [
		"-y",
		"-hide_banner",
		"-nostats",
		"-progress",
		"pipe:2",
		"-i",
		normalizeExportV2SourcePath(request.sourcePath),
	];
	if (filters.length > 0) {
		args.push("-vf", filters.join(","));
	}
	if (audioFilters.length > 0) {
		args.push("-af", audioFilters.join(","));
	}

	args.push("-c:v", encoder.name);
	if (encoder.name === "libx264") {
		args.push("-preset", "veryfast", "-profile:v", "high", "-crf", resolveExportV2Crf(request));
	} else if (encoder.name === "h264_videotoolbox") {
		args.push("-allow_sw", "1");
		if (request.bitrate) {
			args.push("-b:v", String(request.bitrate));
		}
	} else if (request.bitrate) {
		args.push("-b:v", String(request.bitrate));
	}

	args.push(
		"-g",
		String(Math.max(1, Math.round(request.frameRate * 2))),
		"-pix_fmt",
		"yuv420p",
		"-colorspace",
		"bt709",
		"-color_primaries",
		"bt709",
		"-color_trc",
		"bt709",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-movflags",
		"+faststart",
		outputPath,
	);

	return { args, encoder };
}

function resolveExportV2Crf(request: ExportV2StartRequest) {
	switch (request.bitrateMode) {
		case "archive":
			return "14";
		case "very-high":
			return "16";
		case "high":
			return "18";
		default:
			return "20";
	}
}

function buildExportV2GifArgs(
	request: ExportV2StartRequest,
	outputPath: string,
): ExportV2FfmpegAttempt {
	const fps = request.frameRate;
	const trimExpression = buildTrimSelectExpression(request.trimRegions);
	const gifSettings = {
		colorCount: request.gif?.colorCount ?? 128,
		ditherMode: request.gif?.ditherMode ?? "bayer",
		motionSensitivity: request.gif?.motionSensitivity ?? "balanced",
		loop: request.gif?.loop ?? true,
		dedupeFrames: request.gif?.dedupeFrames ?? true,
	} as const;
	const filter = buildGifPaletteFilter({
		width: request.width,
		height: request.height,
		frameRate: fps,
		trimSelectExpression: trimExpression,
		settings: gifSettings,
	});
	const args = [
		"-y",
		"-hide_banner",
		"-nostats",
		"-progress",
		"pipe:2",
		"-i",
		normalizeExportV2SourcePath(request.sourcePath),
		"-filter_complex",
		filter,
		"-map",
		"[gif]",
		"-an",
		"-loop",
		resolveGifFfmpegLoop(gifSettings.loop),
		"-f",
		"gif",
		outputPath,
	];

	return {
		args,
		encoder: {
			name: "ffmpeg-palette",
			label: "FFmpeg palette GIF",
			hardwareAcceleration: "software" as const,
			available: true,
		},
	};
}

function getExportV2AttemptPath(outputPath: string, attemptIndex: number) {
	const extension = path.extname(outputPath);
	const base = extension ? outputPath.slice(0, -extension.length) : outputPath;
	return `${base}.attempt-${attemptIndex + 1}${extension || ".tmp"}`;
}

function parseFfmpegProgressSeconds(output: string) {
	const outTimeMsMatches = [...output.matchAll(/out_time_ms=(\d+)/g)];
	const latestOutTimeMs = outTimeMsMatches[outTimeMsMatches.length - 1];
	if (latestOutTimeMs) {
		return Number(latestOutTimeMs[1]) / 1_000_000;
	}

	const outTimeMatches = [...output.matchAll(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
	const latestOutTime = outTimeMatches[outTimeMatches.length - 1];
	if (latestOutTime) {
		return (
			Number(latestOutTime[1]) * 3600 + Number(latestOutTime[2]) * 60 + Number(latestOutTime[3])
		);
	}

	const timeMatches = [...output.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
	const latest = timeMatches[timeMatches.length - 1];
	if (!latest) {
		return 0;
	}

	return Number(latest[1]) * 3600 + Number(latest[2]) * 60 + Number(latest[3]);
}

function writeExportV2ClipboardPath(filePath: string) {
	if (process.platform === "darwin") {
		const escapedPath = filePath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		const plistContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${escapedPath}</string></array></plist>`;
		clipboard.writeBuffer("NSFilenamesPboardType", Buffer.from(plistContent, "utf8"));
		return;
	}

	clipboard.writeText(filePath);
}

function emitExportV2Progress(window: Electron.WebContents, progress: ExportV2Progress) {
	window.send("exportV2:progress", progress);
}

async function validateExportV2Output({
	ffmpegPath,
	filePath,
	format,
	expectAudio,
	policy,
}: {
	ffmpegPath: string;
	filePath: string;
	format: "mp4" | "gif";
	expectAudio: boolean;
	policy: "strict" | "warn";
}) {
	const warnings: string[] = [];
	const stat = await fs.stat(filePath);
	if (stat.size <= 0) {
		throw new Error("Export validation failed: output file is empty.");
	}

	let probeOutput = "";
	try {
		await execFileAsync(ffmpegPath, ["-hide_banner", "-i", filePath], {
			timeout: 15000,
			maxBuffer: 8 * 1024 * 1024,
		});
	} catch (error) {
		const probeError = error as { stderr?: Buffer | string; stdout?: Buffer | string };
		probeOutput = `${probeError.stdout ?? ""}\n${probeError.stderr ?? ""}`;
	}

	const hasVideo = /Video:/i.test(probeOutput);
	const hasAudio = /Audio:/i.test(probeOutput);
	const formatMatches =
		format === "gif" ? /gif/i.test(probeOutput) : /(mov,mp4|mp4|isom|avc1|h264)/i.test(probeOutput);

	if (!hasVideo) {
		warnings.push("No video stream was detected in the exported file.");
	}
	if (!formatMatches) {
		warnings.push(
			`The exported file did not probe as an expected ${format.toUpperCase()} container.`,
		);
	}
	if (expectAudio && format === "mp4" && !hasAudio) {
		warnings.push(
			"The source was expected to contain audio, but no exported audio stream was detected.",
		);
	}
	if (policy === "strict" && warnings.length > 0) {
		throw new Error(`Export validation failed: ${warnings.join(" ")}`);
	}

	return {
		video: hasVideo,
		audio: hasAudio,
		warnings,
	};
}

async function runExportV2WorkerJob(
	request: ExportV2StartRequest,
	owner: Electron.WebContents,
): Promise<ExportV2StartResult> {
	const jobId = request.jobId ?? `export-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const worker = createExportWorkerWindow();
	const workerReady = worker.webContents.isLoading()
		? new Promise<void>((resolve) => {
				worker.webContents.once("did-finish-load", () => resolve());
			})
		: Promise.resolve();

	await workerReady;

	return await new Promise<ExportV2StartResult>((resolve) => {
		const timeout = setTimeout(
			() => {
				exportV2WorkerResolvers.delete(jobId);
				resolve({
					success: false,
					fallbackToLegacy: true,
					jobId,
					error: "Export worker timed out.",
				});
			},
			30 * 60 * 1000,
		);

		exportV2WorkerResolvers.set(jobId, (result) => {
			clearTimeout(timeout);
			exportV2WorkerResolvers.delete(jobId);
			exportV2WorkerOwners.delete(jobId);
			exportV2WorkerWindows.delete(jobId);
			resolve(result);
		});
		exportV2WorkerOwners.set(jobId, owner);
		exportV2WorkerWindows.set(jobId, worker);

		worker.webContents.send("exportV2:worker-start", {
			...request,
			jobId,
		});
	});
}

function waitForFfmpegCaptureStart(process: ChildProcessWithoutNullStreams) {
	return new Promise<void>((resolve, reject) => {
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onExit = (code: number | null) => {
			cleanup();
			reject(
				new Error(
					ffmpegCaptureOutputBuffer.trim() ||
						`FFmpeg exited before recording started (code ${code ?? "unknown"})`,
				),
			);
		};

		const timer = setTimeout(() => {
			cleanup();
			resolve();
		}, 900);

		const cleanup = () => {
			clearTimeout(timer);
			process.off("error", onError);
			process.off("exit", onExit);
		};

		process.once("error", onError);
		process.once("exit", onExit);
	});
}

function waitForFfmpegCaptureStop(process: ChildProcessWithoutNullStreams, outputPath: string) {
	return new Promise<string>((resolve, reject) => {
		const onClose = async (code: number | null) => {
			cleanup();

			try {
				await fs.access(outputPath);
				if (code === 0 || code === null) {
					resolve(outputPath);
					return;
				}

				if (ffmpegCaptureOutputBuffer.includes("Exiting normally")) {
					resolve(outputPath);
					return;
				}
			} catch {
				// handled below
			}

			reject(
				new Error(
					ffmpegCaptureOutputBuffer.trim() || `FFmpeg exited with code ${code ?? "unknown"}`,
				),
			);
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const cleanup = () => {
			process.off("close", onClose);
			process.off("error", onError);
		};

		process.once("close", onClose);
		process.once("error", onError);
	});
}

function getDisplayBoundsForSource(source: SelectedSource) {
	const sourceDisplayId = Number(source?.display_id);
	if (Number.isFinite(sourceDisplayId)) {
		const matched = getScreen()
			.getAllDisplays()
			.find((display) => display.id === sourceDisplayId);
		if (matched) {
			return matched.bounds;
		}
	}

	return getScreen().getPrimaryDisplay().bounds;
}

function getSelectedAreaForSource(source?: SelectedSource | null): SelectedArea | null {
	if (!source?.id?.startsWith("screen:") || !selectedArea) {
		return null;
	}

	const sourceDisplayId = Number(source.display_id);
	if (!Number.isFinite(sourceDisplayId) || sourceDisplayId !== selectedArea.displayId) {
		return null;
	}

	return selectedArea;
}

function parseXwininfoBounds(stdout: string): WindowBounds | null {
	const absX = stdout.match(/Absolute upper-left X:\s+(-?\d+)/);
	const absY = stdout.match(/Absolute upper-left Y:\s+(-?\d+)/);
	const width = stdout.match(/Width:\s+(\d+)/);
	const height = stdout.match(/Height:\s+(\d+)/);

	if (!absX || !absY || !width || !height) {
		return null;
	}

	return {
		x: Number.parseInt(absX[1], 10),
		y: Number.parseInt(absY[1], 10),
		width: Number.parseInt(width[1], 10),
		height: Number.parseInt(height[1], 10),
	};
}

async function resolveLinuxWindowBounds(source: SelectedSource): Promise<WindowBounds | null> {
	const windowId = parseWindowId(source?.id);

	if (windowId) {
		try {
			const { stdout } = await execFileAsync("xwininfo", ["-id", String(windowId)], {
				timeout: 1500,
			});
			const bounds = parseXwininfoBounds(stdout);
			if (bounds && bounds.width > 0 && bounds.height > 0) {
				return bounds;
			}
		} catch {
			// fall back to title lookup below
		}
	}

	const windowTitle =
		typeof source.windowTitle === "string" ? source.windowTitle.trim() : source.name.trim();
	if (!windowTitle) {
		return null;
	}

	try {
		const { stdout } = await execFileAsync("xwininfo", ["-name", windowTitle], { timeout: 1500 });
		const bounds = parseXwininfoBounds(stdout);
		return bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null;
	} catch {
		return null;
	}
}

async function resolveWindowsWindowBounds(source: SelectedSource): Promise<WindowBounds | null> {
	const windowId = parseWindowId(source?.id);
	if (!windowId || process.platform !== "win32") {
		return null;
	}

	const script = `
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ScreenMintWin32Bounds {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT rect, int size);
}
"@
$hwnd = [IntPtr]([Int64]${Math.trunc(windowId)})
if (-not [ScreenMintWin32Bounds]::IsWindow($hwnd)) { exit 2 }
$rect = New-Object ScreenMintWin32Bounds+RECT
$size = [Runtime.InteropServices.Marshal]::SizeOf([type][ScreenMintWin32Bounds+RECT])
$ok = ([ScreenMintWin32Bounds]::DwmGetWindowAttribute($hwnd, 9, [ref]$rect, $size) -eq 0)
if (-not $ok) { $ok = [ScreenMintWin32Bounds]::GetWindowRect($hwnd, [ref]$rect) }
if (-not $ok) { exit 3 }
[pscustomobject]@{
  x = $rect.Left
  y = $rect.Top
  width = [Math]::Max(0, $rect.Right - $rect.Left)
  height = [Math]::Max(0, $rect.Bottom - $rect.Top)
} | ConvertTo-Json -Compress
`;

	try {
		const { stdout } = await execFileAsync(
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
			{
				timeout: 1500,
			},
		);
		const parsed = JSON.parse(stdout) as Partial<WindowBounds>;
		const physicalBounds = sanitizeTelemetryBounds(parsed);
		if (!physicalBounds) {
			return null;
		}

		return physicalBoundsToDip(physicalBounds, getTelemetryDisplays());
	} catch {
		return null;
	}
}

function clampCaptureFps(value: number | undefined) {
	if (!Number.isFinite(value)) {
		return 30;
	}
	return Math.min(60, Math.max(15, Math.round(value ?? 30)));
}

function buildFfmpegOutputArgs(outputPath: string, options?: NativeMacRecordingOptions) {
	const outputArgs = [
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		...(options?.videoBitsPerSecond ? ["-b:v", String(options.videoBitsPerSecond)] : []),
		...(options?.recordingWidth && options?.recordingHeight
			? [
					"-vf",
					`scale='min(${options.recordingWidth},iw)':'min(${options.recordingHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
				]
			: []),
		"-pix_fmt",
		"yuv420p",
		"-movflags",
		"+faststart",
		outputPath,
	];
	return outputArgs;
}

async function buildFfmpegCaptureArgs(
	source: SelectedSource,
	outputPath: string,
	options?: NativeMacRecordingOptions,
) {
	const fps = String(clampCaptureFps(options?.recordingFps));
	const commonOutputArgs = buildFfmpegOutputArgs(outputPath, options);

	if (process.platform === "win32") {
		if (source?.id?.startsWith("window:")) {
			const windowTitle =
				typeof source.windowTitle === "string" ? source.windowTitle.trim() : source.name.trim();
			if (!windowTitle) {
				throw new Error("Missing window title for FFmpeg window capture");
			}

			return [
				"-y",
				"-f",
				"gdigrab",
				"-framerate",
				fps,
				"-draw_mouse",
				"0",
				"-i",
				`title=${windowTitle}`,
				...commonOutputArgs,
			];
		}

		return [
			"-y",
			"-f",
			"gdigrab",
			"-framerate",
			fps,
			"-draw_mouse",
			"0",
			"-i",
			"desktop",
			...commonOutputArgs,
		];
	}

	if (process.platform === "linux") {
		const displayEnv = process.env.DISPLAY || ":0.0";
		if (source?.id?.startsWith("window:")) {
			const bounds = await resolveLinuxWindowBounds(source);
			if (!bounds) {
				throw new Error("Unable to resolve Linux window bounds for FFmpeg capture");
			}

			return [
				"-y",
				"-f",
				"x11grab",
				"-framerate",
				fps,
				"-draw_mouse",
				"0",
				"-video_size",
				`${Math.max(2, bounds.width)}x${Math.max(2, bounds.height)}`,
				"-i",
				`${displayEnv}+${Math.round(bounds.x)},${Math.round(bounds.y)}`,
				...commonOutputArgs,
			];
		}

		const bounds = getDisplayBoundsForSource(source);
		return [
			"-y",
			"-f",
			"x11grab",
			"-framerate",
			fps,
			"-draw_mouse",
			"0",
			"-video_size",
			`${Math.max(2, bounds.width)}x${Math.max(2, bounds.height)}`,
			"-i",
			`${displayEnv}+${Math.round(bounds.x)},${Math.round(bounds.y)}`,
			...commonOutputArgs,
		];
	}

	if (process.platform === "darwin") {
		return [
			"-y",
			"-f",
			"avfoundation",
			"-capture_cursor",
			"0",
			"-framerate",
			fps,
			"-i",
			"1:none",
			...commonOutputArgs,
		];
	}

	throw new Error(`FFmpeg capture is not supported on ${process.platform}`);
}

function getWgcCaptureExePath() {
	return resolveUnpackedAppPath(
		"electron",
		"native",
		"wgc-capture",
		"build",
		"Release",
		"wgc-capture.exe",
	);
}

function getCursorMonitorExePath() {
	return resolveUnpackedAppPath(
		"electron",
		"native",
		"cursor-monitor",
		"build",
		"Release",
		"cursor-monitor.exe",
	);
}

async function isWgcCaptureAvailable(): Promise<boolean> {
	if (process.platform !== "win32") return false;

	try {
		await fs.access(getWgcCaptureExePath(), fsConstants.X_OK);
	} catch {
		return false;
	}

	// Windows 10 2004 (Build 19041) minimum for IsCursorCaptureEnabled
	const os = await import("node:os");
	const [major, , build] = os.release().split(".").map(Number);
	return major >= 10 && build >= 19041;
}

function waitForWgcCaptureStart(proc: ChildProcessWithoutNullStreams) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for WGC capture to start"));
		}, 12000);

		const onStdout = (chunk: Buffer) => {
			const text = chunk.toString();
			if (text.includes("Recording started")) {
				cleanup();
				resolve();
			}
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onExit = (code: number | null) => {
			cleanup();
			reject(
				new Error(
					wgcCaptureOutputBuffer.trim() ||
						`WGC capture exited before recording started (code ${code ?? "unknown"})`,
				),
			);
		};

		const cleanup = () => {
			clearTimeout(timer);
			proc.stdout.off("data", onStdout);
			proc.off("error", onError);
			proc.off("exit", onExit);
		};

		proc.stdout.on("data", onStdout);
		proc.once("error", onError);
		proc.once("exit", onExit);
	});
}

function waitForWgcCaptureStop(proc: ChildProcessWithoutNullStreams) {
	return new Promise<string>((resolve, reject) => {
		const onClose = (code: number | null) => {
			cleanup();
			const match = wgcCaptureOutputBuffer.match(/Recording stopped\. Output path: (.+)/);
			if (match?.[1]) {
				resolve(match[1].trim());
				return;
			}
			if (code === 0 && wgcCaptureTargetPath) {
				resolve(wgcCaptureTargetPath);
				return;
			}
			reject(
				new Error(
					wgcCaptureOutputBuffer.trim() || `WGC capture exited with code ${code ?? "unknown"}`,
				),
			);
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const cleanup = () => {
			proc.off("close", onClose);
			proc.off("error", onError);
		};

		proc.once("close", onClose);
		proc.once("error", onError);
	});
}

function attachWgcCaptureLifecycle(proc: ChildProcessWithoutNullStreams) {
	proc.once("close", () => {
		const wasActive = wgcScreenRecordingActive;
		wgcCaptureProcess = null;

		if (!wasActive || wgcCaptureStopRequested) {
			return;
		}

		wgcScreenRecordingActive = false;
		wgcCaptureTargetPath = null;
		wgcCaptureStopRequested = false;

		const sourceName = selectedSource?.name ?? "Screen";
		BrowserWindow.getAllWindows().forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send("recording-state-changed", {
					recording: false,
					sourceName,
				});
			}
		});

		emitRecordingInterrupted("capture-stopped", "Recording stopped unexpectedly.");
	});
}

async function muxWgcVideoWithAudio(
	videoPath: string,
	systemAudioPath: string | null,
	micAudioPath: string | null,
) {
	const ffmpegPath = getFfmpegBinaryPath();
	const inputs: string[] = ["-i", videoPath];
	const audioInputs: string[] = [];

	if (systemAudioPath) {
		try {
			await fs.access(systemAudioPath);
			inputs.push("-i", systemAudioPath);
			audioInputs.push("system");
		} catch {
			// system audio file not available
		}
	}

	if (micAudioPath) {
		try {
			await fs.access(micAudioPath);
			inputs.push("-i", micAudioPath);
			audioInputs.push("mic");
		} catch {
			// mic audio file not available
		}
	}

	if (audioInputs.length === 0) return;

	const mixedOutputPath = `${videoPath}.muxed.mp4`;

	if (audioInputs.length === 2) {
		// Both system + mic audio: mix them
		await execFileAsync(
			ffmpegPath,
			[
				"-y",
				...inputs,
				"-filter_complex",
				"[2:a]atrim=start=0.10,asetpts=PTS-STARTPTS[m];[1:a][m]amix=inputs=2:duration=longest:normalize=0[aout]",
				"-map",
				"0:v:0",
				"-map",
				"[aout]",
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-shortest",
				mixedOutputPath,
			],
			{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
		);
	} else {
		// Single audio track
		await execFileAsync(
			ffmpegPath,
			[
				"-y",
				...inputs,
				"-map",
				"0:v:0",
				"-map",
				"1:a:0",
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-shortest",
				mixedOutputPath,
			],
			{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
		);
	}

	await moveFileWithOverwrite(mixedOutputPath, videoPath);

	// Clean up audio files
	for (const audioPath of [systemAudioPath]) {
		if (audioPath) {
			await fs.rm(audioPath, { force: true }).catch(() => {
				// Ignore cleanup failures for temporary audio artifacts.
			});
		}
	}
}

function waitForNativeCaptureStart(process: ChildProcessWithoutNullStreams) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error("Timed out waiting for ScreenCaptureKit recorder to start"));
		}, 12000);

		// Only check for the start pattern — the start handler already
		// appends stdout/stderr to nativeCaptureOutputBuffer
		const onStdout = (chunk: Buffer) => {
			const text = chunk.toString();
			if (text.includes("Recording started")) {
				cleanup();
				resolve();
			}
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const onExit = (code: number | null) => {
			cleanup();
			reject(
				new Error(
					nativeCaptureOutputBuffer.trim() ||
						`Native capture helper exited before recording started (code ${code ?? "unknown"})`,
				),
			);
		};

		const cleanup = () => {
			clearTimeout(timer);
			process.stdout.off("data", onStdout);
			process.off("error", onError);
			process.off("exit", onExit);
		};

		process.stdout.on("data", onStdout);
		process.once("error", onError);
		process.once("exit", onExit);
	});
}

function waitForNativeCaptureStop(process: ChildProcessWithoutNullStreams) {
	return new Promise<string>((resolve, reject) => {
		const onClose = (code: number | null) => {
			cleanup();
			const match = nativeCaptureOutputBuffer.match(/Recording stopped\. Output path: (.+)/);
			if (match?.[1]) {
				resolve(match[1].trim());
				return;
			}
			// Fallback: if exit code was 0 and we know the target path, try to use it
			if (code === 0 && nativeCaptureTargetPath) {
				resolve(nativeCaptureTargetPath);
				return;
			}
			reject(
				new Error(
					nativeCaptureOutputBuffer.trim() ||
						`Native capture helper exited with code ${code ?? "unknown"}`,
				),
			);
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		const cleanup = () => {
			process.off("close", onClose);
			process.off("error", onError);
		};

		process.once("close", onClose);
		process.once("error", onError);
	});
}

async function mixNativeMacAudioTracks(videoPath: string, microphonePath: string) {
	const ffmpegPath = getFfmpegBinaryPath();
	const mixedOutputPath = `${videoPath}.mixed.mp4`;

	await execFileAsync(
		ffmpegPath,
		[
			"-y",
			"-i",
			videoPath,
			"-i",
			microphonePath,
			"-filter_complex",
			"[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[aout]",
			"-map",
			"0:v:0",
			"-map",
			"[aout]",
			"-c:v",
			"copy",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-shortest",
			mixedOutputPath,
		],
		{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
	);

	await moveFileWithOverwrite(mixedOutputPath, videoPath);
}

function emitRecordingInterrupted(reason: string, message: string) {
	BrowserWindow.getAllWindows().forEach((window) => {
		if (!window.isDestroyed()) {
			window.webContents.send("recording-interrupted", { reason, message });
		}
	});
}

function emitCursorStateChanged(cursorType: CursorVisualType) {
	BrowserWindow.getAllWindows().forEach((window) => {
		if (!window.isDestroyed()) {
			window.webContents.send("cursor-state-changed", { cursorType });
		}
	});
}

function sampleCursorStateChange(cursorType: CursorVisualType) {
	if (!isCursorCaptureActive) {
		return;
	}

	const point = getNormalizedCursorPoint();
	if (!point) {
		return;
	}

	pushMoveCursorSample(point, getCursorCaptureElapsedMs(), {
		cursorType,
		origin: "native-monitor",
		confidence: cursorType === "unknown" ? "low" : "medium",
		force: true,
	});
}

function attachNativeCaptureLifecycle(process: ChildProcessWithoutNullStreams) {
	process.once("close", () => {
		const wasActive = nativeScreenRecordingActive;
		nativeCaptureProcess = null;

		if (!wasActive || nativeCaptureStopRequested) {
			return;
		}

		nativeScreenRecordingActive = false;
		nativeCaptureTargetPath = null;
		nativeCaptureStopRequested = false;

		const sourceName = selectedSource?.name ?? "Screen";
		BrowserWindow.getAllWindows().forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send("recording-state-changed", {
					recording: false,
					sourceName,
				});
			}
		});

		const reason = nativeCaptureOutputBuffer.includes("WINDOW_UNAVAILABLE")
			? "window-unavailable"
			: "capture-stopped";
		const message =
			reason === "window-unavailable"
				? "The selected window is no longer capturable. Please reselect a window."
				: "Recording stopped unexpectedly.";

		emitRecordingInterrupted(reason, message);
	});
}

async function ensureNativeCursorMonitorBinary() {
	return ensureSwiftHelperBinary(
		getNativeCursorMonitorSourcePath(),
		getNativeCursorMonitorBinaryPath(),
		"native cursor monitor helper",
		"screenmint-native-cursor-monitor",
	);
}

function handleCursorMonitorStdout(chunk: Buffer) {
	nativeCursorMonitorOutputBuffer += chunk.toString();
	const lines = nativeCursorMonitorOutputBuffer.split(/\r?\n/);
	nativeCursorMonitorOutputBuffer = lines.pop() ?? "";

	for (const line of lines) {
		const match = line.match(/^STATE:(.+)$/);
		if (!match) continue;
		const next = match[1].trim();
		if (isCursorVisualType(next)) {
			if (currentCursorVisualType !== next) {
				currentCursorVisualType = next;
				sampleCursorStateChange(next);
				emitCursorStateChanged(next);
			}
		}
	}
}

async function startNativeCursorMonitor() {
	stopNativeCursorMonitor();

	if (process.platform !== "darwin" && process.platform !== "win32") {
		currentCursorVisualType = "arrow";
		return;
	}

	try {
		let helperPath: string;
		if (process.platform === "win32") {
			helperPath = getCursorMonitorExePath();
			try {
				await fs.access(helperPath, fsConstants.X_OK);
			} catch {
				console.warn("Windows cursor monitor helper missing or not executable:", helperPath);
				currentCursorVisualType = "arrow";
				return;
			}
		} else {
			helperPath = await ensureNativeCursorMonitorBinary();
		}

		nativeCursorMonitorOutputBuffer = "";
		currentCursorVisualType = "arrow";
		nativeCursorMonitorProcess = spawn(helperPath, [], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		nativeCursorMonitorProcess.once("error", (error) => {
			console.warn("Native cursor monitor process error:", error);
			nativeCursorMonitorProcess = null;
			nativeCursorMonitorOutputBuffer = "";
			currentCursorVisualType = "arrow";
		});

		nativeCursorMonitorProcess.stdout.on("data", handleCursorMonitorStdout);

		nativeCursorMonitorProcess.once("close", () => {
			nativeCursorMonitorProcess = null;
			nativeCursorMonitorOutputBuffer = "";
			currentCursorVisualType = "arrow";
		});
	} catch (error) {
		console.warn("Failed to start native cursor monitor:", error);
		nativeCursorMonitorProcess = null;
		nativeCursorMonitorOutputBuffer = "";
		currentCursorVisualType = "arrow";
	}
}

function stopNativeCursorMonitor() {
	currentCursorVisualType = "arrow";

	if (!nativeCursorMonitorProcess) {
		return;
	}

	try {
		nativeCursorMonitorProcess.stdin.write("stop\n");
	} catch {
		// ignore stop signal issues
	}
	try {
		nativeCursorMonitorProcess.kill();
	} catch {
		// ignore kill issues
	}

	nativeCursorMonitorProcess = null;
	nativeCursorMonitorOutputBuffer = "";
}

async function moveFileWithOverwrite(sourcePath: string, destinationPath: string) {
	await fs.mkdir(path.dirname(destinationPath), { recursive: true });
	await fs.rm(destinationPath, { force: true });

	try {
		await fs.rename(sourcePath, destinationPath);
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code !== "EXDEV") {
			throw error;
		}

		await fs.copyFile(sourcePath, destinationPath);
		await fs.unlink(sourcePath);
	}
}

async function discardRecordingArtifacts(paths: Array<string | null | undefined>) {
	await Promise.all(
		paths
			.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
			.flatMap((filePath) => [
				fs.rm(filePath, { force: true }).catch(() => undefined),
				fs.rm(getTelemetryPathForVideo(filePath), { force: true }).catch(() => undefined),
				fs.rm(getKeyboardTelemetryPathForVideo(filePath), { force: true }).catch(() => undefined),
			]),
	);
}

async function concatenateMediaSegments(
	segmentPaths: string[],
	outputPath: string,
	extraArgs: string[] = [],
) {
	if (segmentPaths.length === 0) {
		throw new Error("No segment paths were provided");
	}

	if (segmentPaths.length === 1) {
		return segmentPaths[0];
	}

	const ffmpegPath = getFfmpegBinaryPath();
	const listPath = path.join(
		os.tmpdir(),
		`screenmint-concat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
	);
	await fs.writeFile(
		listPath,
		segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n"),
		"utf-8",
	);

	try {
		await execFileAsync(
			ffmpegPath,
			["-y", "-f", "concat", "-safe", "0", "-i", listPath, ...extraArgs, outputPath],
			{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
		);
		return outputPath;
	} finally {
		await fs.rm(listPath, { force: true }).catch(() => undefined);
	}
}

function parseFfmpegRate(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.includes("/")) {
		const [numeratorText, denominatorText] = trimmed.split("/", 2);
		const numerator = Number.parseFloat(numeratorText ?? "");
		const denominator = Number.parseFloat(denominatorText ?? "");
		if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
			return null;
		}
		return numerator / denominator;
	}

	const numeric = Number.parseFloat(trimmed);
	return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWebcamCaptureProfile(
	profile: WebcamCaptureProfile | null | undefined,
): WebcamCaptureProfile | null {
	if (
		!profile ||
		!Number.isFinite(profile.width) ||
		!Number.isFinite(profile.height) ||
		!Number.isFinite(profile.frameRate) ||
		profile.width <= 0 ||
		profile.height <= 0 ||
		profile.frameRate <= 0
	) {
		return null;
	}

	return {
		width: Math.round(profile.width),
		height: Math.round(profile.height),
		frameRate: Math.round(profile.frameRate),
		aspectRatio: profile.width / profile.height,
	};
}

async function probeVideoSegmentProfile(segmentPath: string): Promise<ProbedVideoSegmentProfile> {
	const ffmpegPath = getFfmpegBinaryPath();
	let probeOutput = "";

	try {
		await execFileAsync(ffmpegPath, ["-hide_banner", "-i", segmentPath], {
			timeout: 30000,
			maxBuffer: 10 * 1024 * 1024,
		});
	} catch (error) {
		const ffmpegError = error as {
			stderr?: string | Buffer;
			stdout?: string | Buffer;
			message?: string;
		};
		probeOutput = [
			ffmpegError.stderr?.toString(),
			ffmpegError.stdout?.toString(),
			ffmpegError.message,
		]
			.filter((value): value is string => Boolean(value))
			.join("\n");
	}

	const videoLine =
		probeOutput
			.split(/\r?\n/)
			.find((line) => /Stream #.*Video:/.test(line) && !/attached pic/i.test(line)) ?? "";
	const codec = videoLine.match(/Video:\s*([^,\s]+)/)?.[1] ?? null;
	const pixelFormat = videoLine.match(/Video:\s*[^,]+,\s*([^,\s]+)/)?.[1] ?? null;
	const dimensions = videoLine.match(/(\d{2,5})x(\d{2,5})/);
	const width = dimensions ? Number.parseInt(dimensions[1] ?? "", 10) : null;
	const height = dimensions ? Number.parseInt(dimensions[2] ?? "", 10) : null;
	const frameRate =
		parseFfmpegRate(videoLine.match(/,\s*([\d.]+(?:\/\d+)?)\s*fps/)?.[1]) ??
		parseFfmpegRate(videoLine.match(/,\s*([\d.]+(?:\/\d+)?)\s*tbr/)?.[1]);
	const captureProfile =
		width && height && frameRate
			? normalizeWebcamCaptureProfile({
					width,
					height,
					frameRate,
					aspectRatio: width / height,
				})
			: null;

	return {
		path: segmentPath,
		codec,
		pixelFormat,
		width,
		height,
		frameRate,
		captureProfile,
	};
}

function resolveWebcamConcatTargetProfile(params: {
	preferredProfile?: WebcamCaptureProfile | null;
	probes: ProbedVideoSegmentProfile[];
}): WebcamConcatTargetProfile | null {
	const preferredProfile = normalizeWebcamCaptureProfile(params.preferredProfile);
	const baselineProbe = params.probes.find((probe) => probe.captureProfile);
	const captureProfile = preferredProfile ?? baselineProbe?.captureProfile ?? null;
	if (!captureProfile) {
		return null;
	}

	const baselineCodec = baselineProbe?.codec?.toLowerCase();
	return {
		codec: baselineCodec === "vp8" ? "vp8" : "vp9",
		pixelFormat: "yuv420p",
		width: captureProfile.width,
		height: captureProfile.height,
		frameRate: captureProfile.frameRate,
		captureProfile,
	};
}

function isWebcamSegmentCompatibleForConcat(
	probe: ProbedVideoSegmentProfile,
	targetProfile: WebcamConcatTargetProfile,
): boolean {
	return (
		probe.codec?.toLowerCase() === targetProfile.codec &&
		(probe.pixelFormat?.toLowerCase() ?? null) === targetProfile.pixelFormat &&
		probe.width === targetProfile.width &&
		probe.height === targetProfile.height &&
		probe.frameRate != null &&
		Math.abs(probe.frameRate - targetProfile.frameRate) <= 0.5
	);
}

async function normalizeWebcamSegmentForConcat(params: {
	segmentPath: string;
	index: number;
	targetProfile: WebcamConcatTargetProfile;
}): Promise<string> {
	const ffmpegPath = getFfmpegBinaryPath();
	const normalizedPath = path.join(
		os.tmpdir(),
		`screenmint-webcam-normalized-${Date.now()}-${params.index}.webm`,
	);
	const encoderArgs =
		params.targetProfile.codec === "vp8"
			? ["-c:v", "libvpx", "-b:v", "4M", "-deadline", "realtime", "-cpu-used", "4"]
			: [
					"-c:v",
					"libvpx-vp9",
					"-b:v",
					"0",
					"-crf",
					"32",
					"-deadline",
					"realtime",
					"-cpu-used",
					"4",
					"-row-mt",
					"1",
				];
	const videoFilter = [
		`scale=${params.targetProfile.width}:${params.targetProfile.height}:flags=lanczos`,
		`fps=${params.targetProfile.frameRate}`,
	].join(",");

	await execFileAsync(
		ffmpegPath,
		[
			"-y",
			"-i",
			params.segmentPath,
			"-an",
			"-vf",
			videoFilter,
			...encoderArgs,
			"-pix_fmt",
			params.targetProfile.pixelFormat,
			normalizedPath,
		],
		{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
	);

	return normalizedPath;
}

async function persistMediaSegment(segmentPath: string, outputPath: string) {
	if (normalizePath(segmentPath) === normalizePath(outputPath)) {
		return segmentPath;
	}

	await fs.copyFile(segmentPath, outputPath);
	return outputPath;
}

function getMediaRecorderRemuxTargetPath(segmentPath: string, codec: string | null) {
	const extension = path.extname(segmentPath).toLowerCase();
	if (extension !== ".webm") {
		return null;
	}

	const normalizedCodec = codec?.toLowerCase() ?? null;
	if (!normalizedCodec) {
		return null;
	}

	if (["vp8", "vp9", "av1"].includes(normalizedCodec)) {
		return segmentPath;
	}

	if (["h264", "hevc", "mpeg4"].includes(normalizedCodec)) {
		return `${segmentPath.slice(0, -extension.length)}.mp4`;
	}

	return null;
}

async function remuxMediaRecorderSegment(segmentPath: string) {
	const probe = await probeVideoSegmentProfile(segmentPath);
	const targetPath = getMediaRecorderRemuxTargetPath(segmentPath, probe.codec);
	if (!targetPath) {
		return segmentPath;
	}

	const ffmpegPath = getFfmpegBinaryPath();
	const remuxedPath =
		normalizePath(targetPath) === normalizePath(segmentPath)
			? `${segmentPath}.remuxed${path.extname(segmentPath)}`
			: `${targetPath}.remuxed${path.extname(targetPath)}`;

	try {
		await execFileAsync(ffmpegPath, ["-y", "-i", segmentPath, "-c", "copy", remuxedPath], {
			timeout: 120000,
			maxBuffer: 10 * 1024 * 1024,
		});
		await moveFileWithOverwrite(remuxedPath, targetPath);
		if (normalizePath(targetPath) !== normalizePath(segmentPath)) {
			await fs.rm(segmentPath, { force: true }).catch(() => undefined);
		}
		return targetPath;
	} catch {
		await fs.rm(remuxedPath, { force: true }).catch(() => undefined);
		return segmentPath;
	}
}

async function prepareCompatibleWebcamSegments(params: {
	segmentPaths: string[];
	preferredProfile?: WebcamCaptureProfile | null;
}) {
	if (params.segmentPaths.length === 0) {
		return {
			segmentPaths: [] as string[],
			segmentProfiles: [] as Array<WebcamCaptureProfile | null>,
			sessionCaptureProfile: null as WebcamCaptureProfile | null,
			compatibilityMode: "copy" as const,
			tempPaths: [] as string[],
		};
	}

	const probes = await Promise.all(
		params.segmentPaths.map((segmentPath) => probeVideoSegmentProfile(segmentPath)),
	);
	const targetProfile = resolveWebcamConcatTargetProfile({
		preferredProfile: params.preferredProfile,
		probes,
	});
	if (!targetProfile) {
		return {
			segmentPaths: params.segmentPaths,
			segmentProfiles: probes.map((probe) => probe.captureProfile),
			sessionCaptureProfile: normalizeWebcamCaptureProfile(params.preferredProfile),
			compatibilityMode: "copy" as const,
			tempPaths: [] as string[],
		};
	}

	const tempPaths: string[] = [];
	const segmentPaths = await Promise.all(
		probes.map(async (probe, index) => {
			if (isWebcamSegmentCompatibleForConcat(probe, targetProfile)) {
				return probe.path;
			}

			const normalizedPath = await normalizeWebcamSegmentForConcat({
				segmentPath: probe.path,
				index,
				targetProfile,
			});
			tempPaths.push(normalizedPath);
			return normalizedPath;
		}),
	);

	return {
		segmentPaths,
		segmentProfiles: probes.map((probe) => probe.captureProfile),
		sessionCaptureProfile: targetProfile.captureProfile,
		compatibilityMode: tempPaths.length > 0 ? ("normalized" as const) : ("copy" as const),
		tempPaths,
	};
}

async function cropVideoToArea(videoPath: string, area: SelectedArea, outputPath: string) {
	const ffmpegPath = getFfmpegBinaryPath();
	const { x, y, width, height } = area.normalizedBounds;
	const cropFilter = `crop=iw*${width}:ih*${height}:iw*${x}:ih*${y}`;

	await execFileAsync(
		ffmpegPath,
		[
			"-y",
			"-i",
			videoPath,
			"-vf",
			cropFilter,
			"-c:v",
			"libx264",
			"-preset",
			"ultrafast",
			"-tune",
			"zerolatency",
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"copy",
			"-movflags",
			"+faststart",
			outputPath,
		],
		{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
	);

	return outputPath;
}

function isTrustedProjectPath(filePath?: string | null) {
	if (!filePath || !currentProjectPath) {
		return false;
	}
	return normalizePath(filePath) === normalizePath(currentProjectPath);
}

async function finalizeRecordingSession(payload: {
	videoSegments: RecordingSegmentPayload[];
	webcamSegments?: RecordingSegmentPayload[];
	microphoneSegments?: RecordingSegmentPayload[];
	selectedArea?: SelectedArea | null;
	webcamSessionMetadata?: WebcamSessionMetadata | null;
}) {
	const recordingsDir = await getRecordingsDir();
	const normalizedVideoSegments = payload.videoSegments.filter(
		(segment) => typeof segment.path === "string" && segment.path.trim().length > 0,
	);

	if (normalizedVideoSegments.length === 0) {
		throw new Error("No recording segments are available to finalize");
	}

	const videoSegmentPaths = normalizedVideoSegments.map((segment) => segment.path);
	const finalVideoPathBase =
		videoSegmentPaths.length === 1
			? videoSegmentPaths[0]
			: path.join(recordingsDir, `recording-${Date.now()}-merged.mp4`);

	const webcamSegmentPaths =
		payload.webcamSegments
			?.filter((segment) => typeof segment.path === "string" && segment.path.trim().length > 0)
			.map((segment) => segment.path) ?? [];
	const preparedWebcamSegments = await prepareCompatibleWebcamSegments({
		segmentPaths: webcamSegmentPaths,
		preferredProfile:
			payload.webcamSessionMetadata?.sessionCaptureProfile ??
			payload.webcamSessionMetadata?.captureProfile ??
			postRecordingContext?.webcamSessionMetadata?.sessionCaptureProfile ??
			postRecordingContext?.webcamSessionMetadata?.captureProfile ??
			null,
	});
	const shouldPersistNormalizedSingleWebcamSegment =
		preparedWebcamSegments.segmentPaths.length === 1 &&
		preparedWebcamSegments.tempPaths.includes(preparedWebcamSegments.segmentPaths[0] ?? "");
	const webcamOutputPath =
		preparedWebcamSegments.segmentPaths.length === 1 && !shouldPersistNormalizedSingleWebcamSegment
			? preparedWebcamSegments.segmentPaths[0]
			: path.join(
					recordingsDir,
					`webcam-${Date.now()}-${shouldPersistNormalizedSingleWebcamSegment ? "normalized" : "merged"}.webm`,
				);

	const microphoneSegmentPaths =
		payload.microphoneSegments
			?.filter((segment) => typeof segment.path === "string" && segment.path.trim().length > 0)
			.map((segment) => segment.path) ?? [];
	const microphoneOutputPath = path.join(recordingsDir, `recording-${Date.now()}-mic.m4a`);

	// Run independent muxes and cursor reads in parallel.
	const [mergedVideoPath, finalWebcamPath, finalMicrophonePath, mergedCursorSamples] =
		await Promise.all([
			concatenateMediaSegments(videoSegmentPaths, finalVideoPathBase, ["-c", "copy"]),
			preparedWebcamSegments.segmentPaths.length > 0
				? shouldPersistNormalizedSingleWebcamSegment
					? persistMediaSegment(preparedWebcamSegments.segmentPaths[0], webcamOutputPath)
					: concatenateMediaSegments(preparedWebcamSegments.segmentPaths, webcamOutputPath, [
							"-c",
							"copy",
						])
				: Promise.resolve<string | null>(null),
			microphoneSegmentPaths.length > 0
				? concatenateMediaSegments(microphoneSegmentPaths, microphoneOutputPath, ["-c:a", "aac"])
				: Promise.resolve<string | null>(null),
			(async () => {
				const perSegment = await Promise.all(
					normalizedVideoSegments.map(async (segment) => ({
						durationMs: segment.durationMs,
						samples: await readCursorTelemetrySamples(segment.path),
					})),
				);
				return perSegment.flatMap((entry, entryIndex, entries) => {
					const offsetMs = entries
						.slice(0, entryIndex)
						.reduce((total, candidate) => total + Math.max(0, candidate.durationMs), 0);
					return entry.samples.map((sample) => ({
						...sample,
						timeMs: Math.max(0, sample.timeMs + offsetMs),
					}));
				});
			})(),
		]);

	let finalVideoPath = mergedVideoPath;
	if (payload.selectedArea) {
		const croppedOutputPath = path.join(recordingsDir, `recording-${Date.now()}-area.mp4`);
		finalVideoPath = await cropVideoToArea(
			mergedVideoPath,
			payload.selectedArea,
			croppedOutputPath,
		);
		if (mergedVideoPath !== videoSegmentPaths[0]) {
			await fs.rm(mergedVideoPath, { force: true }).catch(() => undefined);
		}
	}

	await writeCursorTelemetrySamples(finalVideoPath, mergedCursorSamples);

	currentWebcamPath = finalWebcamPath;
	currentMicrophoneAudioPath = finalMicrophonePath;

	const filesToDiscard = [
		...videoSegmentPaths.filter((segmentPath) => segmentPath !== finalVideoPath),
		...webcamSegmentPaths.filter((segmentPath) => segmentPath !== currentWebcamPath),
		...preparedWebcamSegments.tempPaths.filter((segmentPath) => segmentPath !== currentWebcamPath),
		...microphoneSegmentPaths.filter((segmentPath) => segmentPath !== currentMicrophoneAudioPath),
	];
	await discardRecordingArtifacts(filesToDiscard);

	const stored = await finalizeStoredVideo(finalVideoPath);
	const webcamSessionMetadata: WebcamSessionMetadata | null =
		finalWebcamPath != null
			? {
					sessionCaptureProfile:
						preparedWebcamSegments.sessionCaptureProfile ??
						payload.webcamSessionMetadata?.sessionCaptureProfile ??
						payload.webcamSessionMetadata?.captureProfile ??
						postRecordingContext?.webcamSessionMetadata?.sessionCaptureProfile ??
						postRecordingContext?.webcamSessionMetadata?.captureProfile ??
						null,
					captureProfile:
						preparedWebcamSegments.sessionCaptureProfile ??
						payload.webcamSessionMetadata?.captureProfile ??
						postRecordingContext?.webcamSessionMetadata?.captureProfile ??
						null,
					segmentOffsetsMs: payload.webcamSegments
						?.filter(
							(segment) => typeof segment.path === "string" && segment.path.trim().length > 0,
						)
						.reduce<number[]>((offsets, _segment, index, segments) => {
							const previousOffset =
								index === 0
									? 0
									: offsets[index - 1] + Math.max(0, segments[index - 1]?.durationMs ?? 0);
							offsets.push(previousOffset);
							return offsets;
						}, []) ?? [0],
					segmentProfiles: preparedWebcamSegments.segmentProfiles,
					segmentCompatibilityMode: preparedWebcamSegments.compatibilityMode,
					renderPipelineVersion:
						payload.webcamSessionMetadata?.renderPipelineVersion ??
						postRecordingContext?.webcamSessionMetadata?.renderPipelineVersion ??
						WEBCAM_RENDER_PIPELINE_VERSION,
				}
			: null;
	return {
		...stored,
		webcamPath: currentWebcamPath,
		webcamSessionMetadata,
		microphonePath: currentMicrophoneAudioPath,
	};
}

const CURSOR_TELEMETRY_VERSION = 4;
const KEYBOARD_TELEMETRY_VERSION = 1;
const CURSOR_SAMPLE_INTERVAL_MS = 1000 / 30;
const CURSOR_DRAG_SAMPLE_INTERVAL_MS = 16;
const CURSOR_MOVE_SAMPLE_INTERVAL_MS = 16;
const CURSOR_MOVE_MIN_DISTANCE = 0.0015;
const CURSOR_POLL_HEARTBEAT_INTERVAL_MS = 120;
const CURSOR_POLL_STALE_AFTER_MS = 40;
const WINDOW_BOUNDS_CAPTURE_INTERVAL_MS = 1000 / 10;
const WINDOW_BOUNDS_FALLBACK_CAPTURE_INTERVAL_MS = 1000;
const MAX_CURSOR_SAMPLES = 60 * 60 * 120; // 1 hour @ 120Hz worth of mixed cursor events
const MAX_KEYBOARD_SAMPLES = 60 * 60 * 20; // 1 hour @ ~20 keyboard events/sec average

type CursorInteractionType =
	| "move"
	| "mousedown"
	| "drag-start"
	| "drag"
	| "drag-end"
	| "click"
	| "double-click"
	| "right-click"
	| "middle-click"
	| "mouseup";

type KeyboardTelemetryEventType = "keydown" | "keyup";
type KeyboardTelemetryPlatform = "darwin" | "win32" | "linux";

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: CursorInteractionType;
	cursorType?: CursorVisualType;
	rawX?: number;
	rawY?: number;
	origin?: "hook" | "poll" | "native-monitor";
	confidence?: "high" | "medium" | "low";
	sourceBounds?: WindowBounds;
	displayBounds?: WindowBounds;
	sourceDisplayId?: number;
	displayScaleFactor?: number;
	captureMode?: "display" | "window" | "area";
	capturePlatform?: CursorCapturePlatform;
	geometrySource?: CursorTelemetryGeometrySource;
	projectionConfidence?: CursorProjectionConfidence;
}

interface KeyboardTelemetryPoint {
	timeMs: number;
	type: KeyboardTelemetryEventType;
	key: string;
	keycode: number;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

function sanitizeTelemetryBounds(value: unknown): WindowBounds | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const candidate = value as Partial<WindowBounds>;
	if (
		typeof candidate.x !== "number" ||
		!Number.isFinite(candidate.x) ||
		typeof candidate.y !== "number" ||
		!Number.isFinite(candidate.y) ||
		typeof candidate.width !== "number" ||
		!Number.isFinite(candidate.width) ||
		typeof candidate.height !== "number" ||
		!Number.isFinite(candidate.height) ||
		candidate.width <= 0 ||
		candidate.height <= 0
	) {
		return undefined;
	}

	return {
		x: candidate.x,
		y: candidate.y,
		width: candidate.width,
		height: candidate.height,
	};
}

type HookMouseEvent = {
	button?: unknown;
	mouseButton?: unknown;
	x?: unknown;
	y?: unknown;
	screenX?: unknown;
	screenY?: unknown;
	data?: {
		button?: unknown;
		mouseButton?: unknown;
		x?: unknown;
		y?: unknown;
		screenX?: unknown;
		screenY?: unknown;
	};
};

type HookKeyboardEvent = {
	keycode?: unknown;
	rawcode?: unknown;
	altKey?: unknown;
	ctrlKey?: unknown;
	metaKey?: unknown;
	shiftKey?: unknown;
	data?: {
		keycode?: unknown;
		rawcode?: unknown;
		altKey?: unknown;
		ctrlKey?: unknown;
		metaKey?: unknown;
		shiftKey?: unknown;
	};
};

type UiohookEventMap = {
	mousedown: HookMouseEvent;
	mouseup: HookMouseEvent;
	mousemove: HookMouseEvent;
	keydown: HookKeyboardEvent;
	keyup: HookKeyboardEvent;
};

type UiohookModule = {
	on: <TEventName extends keyof UiohookEventMap>(
		eventName: TEventName,
		listener: (event: UiohookEventMap[TEventName]) => void,
	) => void;
	start: () => void;
	off?: <TEventName extends keyof UiohookEventMap>(
		eventName: TEventName,
		listener: (event: UiohookEventMap[TEventName]) => void,
	) => void;
	removeListener?: <TEventName extends keyof UiohookEventMap>(
		eventName: TEventName,
		listener: (event: UiohookEventMap[TEventName]) => void,
	) => void;
	stop?: () => void;
};

type UiohookKeyExports = Record<string, number>;

let cursorCaptureInterval: NodeJS.Timeout | null = null;
let cursorCaptureStartTimeMs = 0;
let cursorCaptureStartHrTimeNs = 0n;
let activeCursorSamples: CursorTelemetryPoint[] = [];
let pendingCursorSamples: CursorTelemetryPoint[] = [];
let activeKeyboardSamples: KeyboardTelemetryPoint[] = [];
let pendingKeyboardSamples: KeyboardTelemetryPoint[] = [];
let isCursorCaptureActive = false;
let interactionCaptureCleanup: (() => void) | null = null;
let hasLoggedInteractionHookFailure = false;
let lastLeftClick: { timeMs: number; cx: number; cy: number } | null = null;
let hookCursorScreenPoint: { x: number; y: number; updatedAt: number } | null = null;
let activePointerState: {
	button: 1 | 2 | 3;
	startCx: number;
	startCy: number;
	startTimeMs: number;
	lastDragSampleTimeMs: number;
	isDragging: boolean;
} | null = null;
let lastRecordedCursorPositionSample: CursorMoveSampleCandidate | null = null;
let selectedWindowBounds: WindowBounds | null = null;
let selectedWindowGeometrySource: CursorTelemetryGeometrySource | null = null;
let selectedWindowProjectionConfidence: CursorProjectionConfidence = "medium";
let windowBoundsCaptureInterval: NodeJS.Timeout | null = null;
let windowBoundsCaptureSessionId = 0;
let keyboardCapturePlatform: KeyboardTelemetryPlatform =
	process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "win32";
let uiohookKeyNameByCode: Map<number, string> | null = null;

function normalizeHookMouseButton(rawButton: unknown): 1 | 2 | 3 {
	if (typeof rawButton !== "number" || !Number.isFinite(rawButton)) {
		return 1;
	}

	// uiohook/libuiohook button codes are typically 1/2/3. Some wrappers may
	// expose alternate constants depending on platform/runtime.
	if (rawButton === 2 || rawButton === 39) {
		return 2;
	}

	if (rawButton === 3 || rawButton === 38) {
		return 3;
	}

	return 1;
}

function getHookMouseButton(event: HookMouseEvent | null | undefined): 1 | 2 | 3 {
	return normalizeHookMouseButton(
		event?.button ?? event?.mouseButton ?? event?.data?.button ?? event?.data?.mouseButton,
	);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalizeKeyboardPlatform(rawPlatform: unknown): KeyboardTelemetryPlatform {
	if (rawPlatform === "darwin" || rawPlatform === "linux") {
		return rawPlatform;
	}

	return "win32";
}

function loadUiohookKeyExports(): UiohookKeyExports | null {
	const moduleExports = nodeRequire("uiohook-napi") as {
		UiohookKey?: UiohookKeyExports;
		default?: unknown;
	};

	if (moduleExports.UiohookKey) {
		return moduleExports.UiohookKey;
	}

	if (typeof moduleExports.default === "object" && moduleExports.default !== null) {
		const wrappedExports = moduleExports.default as { UiohookKey?: unknown };
		if (typeof wrappedExports.UiohookKey === "object" && wrappedExports.UiohookKey !== null) {
			return wrappedExports.UiohookKey as UiohookKeyExports;
		}

		if (
			Object.values(moduleExports.default).every(
				(value) => typeof value === "number" && Number.isFinite(value),
			)
		) {
			return moduleExports.default as UiohookKeyExports;
		}
	}

	return null;
}

function normalizeCapturedKeyboardKeyName(name: string) {
	switch (name) {
		case "Ctrl":
		case "CtrlRight":
			return "ctrl";
		case "Alt":
		case "AltRight":
			return "alt";
		case "Shift":
		case "ShiftRight":
			return "shift";
		case "Meta":
		case "MetaRight":
			return "meta";
		case "ArrowLeft":
			return "arrowleft";
		case "ArrowRight":
			return "arrowright";
		case "ArrowUp":
			return "arrowup";
		case "ArrowDown":
			return "arrowdown";
		case "PageUp":
			return "pageup";
		case "PageDown":
			return "pagedown";
		case "Backspace":
			return "backspace";
		case "CapsLock":
			return "capslock";
		case "Escape":
			return "escape";
		case "Space":
			return "space";
		case "Enter":
			return "enter";
		case "Tab":
			return "tab";
		case "Delete":
			return "delete";
		case "Insert":
			return "insert";
		default:
			return name.trim().toLowerCase();
	}
}

function getUiohookKeyNameByCode() {
	if (uiohookKeyNameByCode) {
		return uiohookKeyNameByCode;
	}

	const keyExports = loadUiohookKeyExports();
	const nextMap = new Map<number, string>();

	if (keyExports) {
		for (const [name, value] of Object.entries(keyExports)) {
			if (/^\d+$/.test(name)) {
				continue;
			}

			if (typeof value === "number" && Number.isFinite(value)) {
				nextMap.set(value, normalizeCapturedKeyboardKeyName(name));
			}
		}
	}

	uiohookKeyNameByCode = nextMap;
	return nextMap;
}

function getHookKeyboardKeycode(event: HookKeyboardEvent | null | undefined) {
	const rawKeycode = event?.keycode ?? event?.data?.keycode;
	return typeof rawKeycode === "number" && Number.isFinite(rawKeycode)
		? Math.round(rawKeycode)
		: null;
}

function getHookKeyboardModifier(
	event: HookKeyboardEvent | null | undefined,
	modifier: "altKey" | "ctrlKey" | "metaKey" | "shiftKey",
) {
	return Boolean(event?.[modifier] ?? event?.data?.[modifier]);
}

function getHookKeyboardKey(event: HookKeyboardEvent | null | undefined) {
	const keycode = getHookKeyboardKeycode(event);
	if (keycode == null) {
		return null;
	}

	return getUiohookKeyNameByCode().get(keycode) ?? `keycode-${keycode}`;
}

function pushKeyboardSample(
	timeMs: number,
	type: KeyboardTelemetryEventType,
	key: string,
	keycode: number,
	modifiers: Pick<KeyboardTelemetryPoint, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
) {
	activeKeyboardSamples.push({
		timeMs: Math.max(0, timeMs),
		type,
		key,
		keycode,
		altKey: modifiers.altKey,
		ctrlKey: modifiers.ctrlKey,
		metaKey: modifiers.metaKey,
		shiftKey: modifiers.shiftKey,
	});

	if (activeKeyboardSamples.length > MAX_KEYBOARD_SAMPLES) {
		activeKeyboardSamples.shift();
	}
}

function stopCursorCapture() {
	if (cursorCaptureInterval) {
		clearInterval(cursorCaptureInterval);
		cursorCaptureInterval = null;
	}
}

function stopInteractionCapture() {
	if (interactionCaptureCleanup) {
		interactionCaptureCleanup();
		interactionCaptureCleanup = null;
	}
}

function stopWindowBoundsCapture() {
	windowBoundsCaptureSessionId += 1;
	if (windowBoundsCaptureInterval) {
		clearInterval(windowBoundsCaptureInterval);
		windowBoundsCaptureInterval = null;
	}
	stopNativeWindowBoundsMonitor();
	selectedWindowBounds = null;
	selectedWindowGeometrySource = null;
	selectedWindowProjectionConfidence = "medium";
}

function getWindowBoundsFromNativeSource(
	source?: NativeMacWindowSource | null,
): WindowBounds | null {
	if (!source) {
		return null;
	}

	const { x, y, width, height } = source;
	if (
		typeof x !== "number" ||
		!Number.isFinite(x) ||
		typeof y !== "number" ||
		!Number.isFinite(y) ||
		typeof width !== "number" ||
		!Number.isFinite(width) ||
		typeof height !== "number" ||
		!Number.isFinite(height)
	) {
		return null;
	}

	if (width <= 0 || height <= 0) {
		return null;
	}

	return { x, y, width, height };
}

function cloneWindowBounds(bounds: WindowBounds | null | undefined): WindowBounds | undefined {
	if (!bounds) {
		return undefined;
	}

	return {
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
	};
}

function getCursorCapturePlatform(): CursorCapturePlatform {
	return process.platform === "darwin"
		? "darwin"
		: process.platform === "linux"
			? "linux"
			: "win32";
}

function combineCursorConfidence(
	sampleConfidence?: CursorProjectionConfidence,
	projectionConfidence?: CursorProjectionConfidence,
): CursorProjectionConfidence | undefined {
	if (sampleConfidence === "low" || projectionConfidence === "low") {
		return "low";
	}

	if (sampleConfidence === "medium" || projectionConfidence === "medium") {
		return "medium";
	}

	return sampleConfidence ?? projectionConfidence;
}

function getTelemetryDisplays() {
	return getScreen()
		.getAllDisplays()
		.map((display) => ({
			id: display.id,
			bounds: cloneWindowBounds(display.bounds) ?? { x: 0, y: 0, width: 1, height: 1 },
			scaleFactor: display.scaleFactor,
		}));
}

function normalizeHookPointToDip(point: { x: number; y: number }) {
	if (process.platform !== "win32") {
		return point;
	}

	const electronPoint = getScreen().getCursorScreenPoint();
	const convertedPoint = physicalPointToDip(point, getTelemetryDisplays());
	const rawDistance = Math.hypot(point.x - electronPoint.x, point.y - electronPoint.y);
	const convertedDistance = Math.hypot(
		convertedPoint.x - electronPoint.x,
		convertedPoint.y - electronPoint.y,
	);

	return convertedDistance < rawDistance ? convertedPoint : point;
}

function getDisplayForBounds(bounds: WindowBounds): Electron.Display {
	const centerPoint = {
		x: Math.round(bounds.x + bounds.width / 2),
		y: Math.round(bounds.y + bounds.height / 2),
	};

	return getScreen().getDisplayNearestPoint(centerPoint);
}

async function resolveMacWindowBounds(source: SelectedSource): Promise<WindowBounds | null> {
	const windowId = parseWindowId(source.id);
	if (!windowId) {
		return null;
	}

	try {
		const nativeSources = await getNativeMacWindowSources({ maxAgeMs: 250 });
		const matchedSource = nativeSources.find((entry) => parseWindowId(entry.id) === windowId);
		return getWindowBoundsFromNativeSource(matchedSource);
	} catch {
		return null;
	}
}

async function refreshSelectedWindowBounds() {
	if (!selectedSource?.id?.startsWith("window:")) {
		selectedWindowBounds = null;
		return;
	}

	let bounds: WindowBounds | null = null;
	let geometrySource: CursorTelemetryGeometrySource | null = null;
	let projectionConfidence: CursorProjectionConfidence = "medium";

	if (process.platform === "darwin") {
		bounds = await resolveMacWindowBounds(selectedSource);
		geometrySource = bounds ? "macos-window" : null;
		projectionConfidence = bounds ? "high" : "medium";
	} else if (process.platform === "win32") {
		bounds = await resolveWindowsWindowBounds(selectedSource);
		geometrySource = bounds ? "win32-window" : null;
		projectionConfidence = bounds ? "high" : "medium";
	} else if (process.platform === "linux") {
		bounds = await resolveLinuxWindowBounds(selectedSource);
		geometrySource = bounds ? "x11-window" : null;
		projectionConfidence = bounds ? "high" : "medium";
	}

	selectedWindowBounds = bounds;
	selectedWindowGeometrySource = geometrySource;
	selectedWindowProjectionConfidence = projectionConfidence;
}

async function refreshWindowBoundsForSource(source: SelectedSource | null | undefined) {
	if (!source?.id?.startsWith("window:")) {
		selectedWindowBounds = null;
		selectedWindowGeometrySource = null;
		selectedWindowProjectionConfidence = "medium";
		return null;
	}

	const previousSource = selectedSource;
	selectedSource = source;
	try {
		await refreshSelectedWindowBounds();
		return selectedWindowBounds;
	} finally {
		selectedSource = previousSource;
	}
}

function handleNativeWindowBoundsMonitorStdout(chunk: Buffer) {
	nativeWindowBoundsMonitorOutputBuffer += chunk.toString();
	const lines = nativeWindowBoundsMonitorOutputBuffer.split(/\r?\n/);
	nativeWindowBoundsMonitorOutputBuffer = lines.pop() ?? "";

	for (const line of lines) {
		const match = line.match(/^BOUNDS:(.+)$/);
		if (!match) {
			continue;
		}

		try {
			const parsed = JSON.parse(match[1]) as Partial<WindowBounds>;
			const bounds = sanitizeTelemetryBounds(parsed);
			if (bounds) {
				selectedWindowBounds = bounds;
				selectedWindowGeometrySource = "macos-window";
				selectedWindowProjectionConfidence = "high";
			}
		} catch {
			// Ignore malformed monitor payloads and continue falling back to polling.
		}
	}
}

async function startNativeWindowBoundsMonitor(sourceId: string) {
	stopNativeWindowBoundsMonitor();

	if (
		process.platform !== "darwin" ||
		selectedSource?.id !== sourceId ||
		!sourceId.startsWith("window:")
	) {
		return false;
	}

	const windowId = parseWindowId(sourceId);
	if (!windowId) {
		return false;
	}

	try {
		const helperPath = await ensureNativeWindowBoundsMonitorBinary();
		if (selectedSource?.id !== sourceId) {
			return false;
		}
		nativeWindowBoundsMonitorOutputBuffer = "";
		nativeWindowBoundsMonitorProcess = spawn(helperPath, [String(windowId)], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		nativeWindowBoundsMonitorProcess.once("error", (error) => {
			console.warn("Native window bounds monitor process error:", error);
			nativeWindowBoundsMonitorProcess = null;
			nativeWindowBoundsMonitorOutputBuffer = "";
		});

		nativeWindowBoundsMonitorProcess.stdout.on("data", handleNativeWindowBoundsMonitorStdout);

		nativeWindowBoundsMonitorProcess.once("close", () => {
			nativeWindowBoundsMonitorProcess = null;
			nativeWindowBoundsMonitorOutputBuffer = "";
		});

		return true;
	} catch (error) {
		console.warn("Failed to start native window bounds monitor:", error);
		nativeWindowBoundsMonitorProcess = null;
		nativeWindowBoundsMonitorOutputBuffer = "";
		return false;
	}
}

function stopNativeWindowBoundsMonitor() {
	if (!nativeWindowBoundsMonitorProcess) {
		nativeWindowBoundsMonitorOutputBuffer = "";
		return;
	}

	try {
		nativeWindowBoundsMonitorProcess.stdin.write("stop\n");
	} catch {
		// ignore stop signal issues
	}

	try {
		nativeWindowBoundsMonitorProcess.kill();
	} catch {
		// ignore kill issues
	}

	nativeWindowBoundsMonitorProcess = null;
	nativeWindowBoundsMonitorOutputBuffer = "";
}

function startWindowBoundsCapture() {
	stopWindowBoundsCapture();
	const sessionId = windowBoundsCaptureSessionId;

	if (
		!["darwin", "win32", "linux"].includes(process.platform) ||
		!selectedSource?.id?.startsWith("window:")
	) {
		return;
	}

	void refreshSelectedWindowBounds();
	if (process.platform === "darwin") {
		const sourceId = selectedSource.id;
		void startNativeWindowBoundsMonitor(sourceId).then((started) => {
			if (
				sessionId !== windowBoundsCaptureSessionId ||
				!selectedSource?.id?.startsWith("window:")
			) {
				return;
			}
			const intervalMs = started
				? WINDOW_BOUNDS_FALLBACK_CAPTURE_INTERVAL_MS
				: WINDOW_BOUNDS_CAPTURE_INTERVAL_MS;
			windowBoundsCaptureInterval = setInterval(() => {
				void refreshSelectedWindowBounds();
			}, intervalMs);
		});
		return;
	}

	windowBoundsCaptureInterval = setInterval(() => {
		void refreshSelectedWindowBounds();
	}, WINDOW_BOUNDS_CAPTURE_INTERVAL_MS);
}

function getCursorCaptureElapsedMs() {
	if (!cursorCaptureStartHrTimeNs) {
		return cursorCaptureStartTimeMs > 0 ? Math.max(0, Date.now() - cursorCaptureStartTimeMs) : 0;
	}

	return Math.max(0, Number(process.hrtime.bigint() - cursorCaptureStartHrTimeNs) / 1_000_000);
}

function getCursorGeometrySnapshot(cursor: { x: number; y: number }) {
	const capturePlatform = getCursorCapturePlatform();
	const area = getSelectedAreaForSource(selectedSource);
	if (area) {
		const display =
			getScreen()
				.getAllDisplays()
				.find((candidate) => candidate.id === area.displayId) ??
			getDisplayForBounds(area.displayBounds);

		return {
			sourceBounds: cloneWindowBounds(area.bounds),
			displayBounds: cloneWindowBounds(area.displayBounds),
			sourceDisplayId: area.displayId,
			displayScaleFactor: display.scaleFactor,
			captureMode: "area" as const,
			capturePlatform,
			geometrySource: "selected-area" as const,
			projectionConfidence: "high" as const,
		};
	}

	if (selectedSource?.id?.startsWith("window:")) {
		if (selectedWindowBounds) {
			const display = getDisplayForBounds(selectedWindowBounds);
			return {
				sourceBounds: cloneWindowBounds(selectedWindowBounds),
				displayBounds: cloneWindowBounds(display.bounds),
				sourceDisplayId: display.id,
				displayScaleFactor: display.scaleFactor,
				captureMode: "window" as const,
				capturePlatform,
				geometrySource:
					selectedWindowGeometrySource ??
					(process.platform === "win32"
						? "win32-window"
						: process.platform === "linux"
							? "x11-window"
							: "macos-window"),
				projectionConfidence: selectedWindowProjectionConfidence,
			};
		}

		const fallbackDisplay = getScreen().getDisplayNearestPoint(cursor);
		return {
			displayBounds: cloneWindowBounds(fallbackDisplay.bounds),
			sourceDisplayId: fallbackDisplay.id,
			displayScaleFactor: fallbackDisplay.scaleFactor,
			captureMode: "window" as const,
			capturePlatform,
			geometrySource: "fallback-display" as const,
			projectionConfidence: "medium" as const,
		};
	}

	const sourceDisplayId = Number(selectedSource?.display_id);
	const sourceDisplay = Number.isFinite(sourceDisplayId)
		? (getScreen()
				.getAllDisplays()
				.find((display) => display.id === sourceDisplayId) ?? null)
		: null;
	const display = sourceDisplay ?? getScreen().getDisplayNearestPoint(cursor);
	return {
		sourceBounds: cloneWindowBounds(display.bounds),
		displayBounds: cloneWindowBounds(display.bounds),
		sourceDisplayId: display.id,
		displayScaleFactor: display.scaleFactor,
		captureMode: "display" as const,
		capturePlatform,
		geometrySource: "electron-display" as const,
		projectionConfidence: "high" as const,
	};
}

function getNormalizedCursorPoint(cursorOverride?: { x: number; y: number } | null) {
	const fallbackCursor = cursorOverride ?? getScreen().getCursorScreenPoint();
	const cachedHookPoint =
		hookCursorScreenPoint && Date.now() - hookCursorScreenPoint.updatedAt <= 1000
			? { x: hookCursorScreenPoint.x, y: hookCursorScreenPoint.y }
			: null;

	const cursor = cachedHookPoint ?? fallbackCursor;
	const geometry = getCursorGeometrySnapshot(cursor);

	if (geometry.captureMode === "area" && geometry.sourceBounds) {
		const width = Math.max(1, geometry.sourceBounds.width);
		const height = Math.max(1, geometry.sourceBounds.height);

		return {
			cx: clamp((cursor.x - geometry.sourceBounds.x) / width, 0, 1),
			cy: clamp((cursor.y - geometry.sourceBounds.y) / height, 0, 1),
			rawX: cursor.x,
			rawY: cursor.y,
			...geometry,
		};
	}

	if (geometry.captureMode === "window" && geometry.sourceBounds) {
		const width = Math.max(1, geometry.sourceBounds.width);
		const height = Math.max(1, geometry.sourceBounds.height);

		return {
			cx: clamp((cursor.x - geometry.sourceBounds.x) / width, 0, 1),
			cy: clamp((cursor.y - geometry.sourceBounds.y) / height, 0, 1),
			rawX: cursor.x,
			rawY: cursor.y,
			...geometry,
		};
	}

	const bounds =
		geometry.sourceBounds ??
		geometry.displayBounds ??
		getScreen().getDisplayNearestPoint(cursor).bounds;
	const width = Math.max(1, bounds.width);
	const height = Math.max(1, bounds.height);

	const cx = clamp((cursor.x - bounds.x) / width, 0, 1);
	const cy = clamp((cursor.y - bounds.y) / height, 0, 1);
	return { cx, cy, rawX: cursor.x, rawY: cursor.y, ...geometry };
}

function getHookCursorScreenPoint(
	event: HookMouseEvent | null | undefined,
): { x: number; y: number } | null {
	const rawX = event?.x ?? event?.data?.x ?? event?.screenX ?? event?.data?.screenX;
	const rawY = event?.y ?? event?.data?.y ?? event?.screenY ?? event?.data?.screenY;

	if (
		typeof rawX !== "number" ||
		!Number.isFinite(rawX) ||
		typeof rawY !== "number" ||
		!Number.isFinite(rawY)
	) {
		return null;
	}

	return normalizeHookPointToDip({ x: rawX, y: rawY });
}

function pushCursorSample(
	cx: number,
	cy: number,
	timeMs: number,
	interactionType: CursorInteractionType = "move",
	cursorType?: CursorVisualType,
	options?: {
		rawX?: number;
		rawY?: number;
		origin?: "hook" | "poll" | "native-monitor";
		confidence?: "high" | "medium" | "low";
		sourceBounds?: WindowBounds;
		displayBounds?: WindowBounds;
		sourceDisplayId?: number;
		displayScaleFactor?: number;
		captureMode?: "display" | "window" | "area";
		capturePlatform?: CursorCapturePlatform;
		geometrySource?: CursorTelemetryGeometrySource;
		projectionConfidence?: CursorProjectionConfidence;
	},
) {
	const sample: CursorTelemetryPoint = {
		timeMs: Math.max(0, timeMs),
		cx,
		cy,
		interactionType,
		cursorType: cursorType ?? currentCursorVisualType,
		rawX: options?.rawX,
		rawY: options?.rawY,
		origin: options?.origin,
		confidence: combineCursorConfidence(options?.confidence, options?.projectionConfidence),
		sourceBounds: cloneWindowBounds(options?.sourceBounds),
		displayBounds: cloneWindowBounds(options?.displayBounds),
		sourceDisplayId: options?.sourceDisplayId,
		displayScaleFactor: options?.displayScaleFactor,
		captureMode: options?.captureMode,
		capturePlatform: options?.capturePlatform,
		geometrySource: options?.geometrySource,
		projectionConfidence: options?.projectionConfidence,
	};

	activeCursorSamples.push(sample);

	lastRecordedCursorPositionSample = {
		timeMs: sample.timeMs,
		cx: sample.cx,
		cy: sample.cy,
		rawX: sample.rawX,
		rawY: sample.rawY,
		sourceBounds: sample.sourceBounds,
		displayBounds: sample.displayBounds,
		sourceDisplayId: sample.sourceDisplayId,
		displayScaleFactor: sample.displayScaleFactor,
		captureMode: sample.captureMode,
		capturePlatform: sample.capturePlatform,
		geometrySource: sample.geometrySource,
		projectionConfidence: sample.projectionConfidence,
	};

	if (activeCursorSamples.length > MAX_CURSOR_SAMPLES) {
		activeCursorSamples.shift();
	}
}

function pushMoveCursorSample(
	point: ReturnType<typeof getNormalizedCursorPoint>,
	timeMs: number,
	options: {
		cursorType?: CursorVisualType;
		origin: "hook" | "poll" | "native-monitor";
		confidence: "high" | "medium" | "low";
		heartbeatIntervalMs?: number;
		force?: boolean;
	},
) {
	const candidate: CursorMoveSampleCandidate = {
		timeMs,
		cx: point.cx,
		cy: point.cy,
		rawX: point.rawX,
		rawY: point.rawY,
		sourceBounds: point.sourceBounds,
		displayBounds: point.displayBounds,
		sourceDisplayId: point.sourceDisplayId,
		displayScaleFactor: point.displayScaleFactor,
		captureMode: point.captureMode,
		capturePlatform: point.capturePlatform,
		geometrySource: point.geometrySource,
		projectionConfidence: point.projectionConfidence,
	};

	if (
		!options.force &&
		!shouldRecordCursorMoveSample(lastRecordedCursorPositionSample, candidate, {
			minIntervalMs: CURSOR_MOVE_SAMPLE_INTERVAL_MS,
			minDistance: CURSOR_MOVE_MIN_DISTANCE,
			heartbeatIntervalMs: options.heartbeatIntervalMs,
		})
	) {
		return;
	}

	pushCursorSample(point.cx, point.cy, timeMs, "move", options.cursorType, {
		rawX: point.rawX,
		rawY: point.rawY,
		origin: options.origin,
		confidence: options.confidence,
		sourceBounds: point.sourceBounds,
		displayBounds: point.displayBounds,
		sourceDisplayId: point.sourceDisplayId,
		displayScaleFactor: point.displayScaleFactor,
		captureMode: point.captureMode,
		capturePlatform: point.capturePlatform,
		geometrySource: point.geometrySource,
		projectionConfidence: point.projectionConfidence,
	});
}

function sampleCursorPoint() {
	const hookIsFresh = Boolean(
		hookCursorScreenPoint &&
			Date.now() - hookCursorScreenPoint.updatedAt <= CURSOR_POLL_STALE_AFTER_MS,
	);
	if (hookIsFresh) {
		return;
	}

	const point = getNormalizedCursorPoint();
	if (!point) {
		return;
	}

	pushMoveCursorSample(point, getCursorCaptureElapsedMs(), {
		origin: "poll",
		confidence: "medium",
		heartbeatIntervalMs: CURSOR_POLL_HEARTBEAT_INTERVAL_MS,
	});
}

async function persistPendingCursorTelemetry(videoPath: string) {
	const telemetryPath = getTelemetryPathForVideo(videoPath);
	if (pendingCursorSamples.length > 0) {
		await fs.writeFile(
			telemetryPath,
			JSON.stringify({ version: CURSOR_TELEMETRY_VERSION, samples: pendingCursorSamples }, null, 2),
			"utf-8",
		);
	}
	pendingCursorSamples = [];
}

async function persistPendingKeyboardTelemetry(videoPath: string) {
	const telemetryPath = getKeyboardTelemetryPathForVideo(videoPath);
	if (pendingKeyboardSamples.length > 0) {
		await fs.writeFile(
			telemetryPath,
			JSON.stringify(
				{
					version: KEYBOARD_TELEMETRY_VERSION,
					platform: keyboardCapturePlatform,
					samples: pendingKeyboardSamples,
				},
				null,
				2,
			),
			"utf-8",
		);
	}
	pendingKeyboardSamples = [];
}

async function readCursorTelemetrySamples(
	videoPath: string,
): Promise<SessionCursorTelemetrySample[]> {
	try {
		const telemetryPath = getTelemetryPathForVideo(videoPath);
		const content = await fs.readFile(telemetryPath, "utf-8");
		const parsed = JSON.parse(content) as { samples?: SessionCursorTelemetrySample[] };
		return Array.isArray(parsed?.samples) ? parsed.samples : [];
	} catch {
		return [];
	}
}

async function writeCursorTelemetrySamples(
	videoPath: string,
	samples: SessionCursorTelemetrySample[],
) {
	const telemetryPath = getTelemetryPathForVideo(videoPath);
	if (samples.length === 0) {
		await fs.rm(telemetryPath, { force: true });
		return;
	}

	await fs.writeFile(
		telemetryPath,
		JSON.stringify({ version: CURSOR_TELEMETRY_VERSION, samples }, null, 2),
		"utf-8",
	);
}

function snapshotCursorTelemetryForPersistence() {
	if (activeCursorSamples.length === 0) {
		return;
	}

	if (pendingCursorSamples.length === 0) {
		pendingCursorSamples = [...activeCursorSamples];
		return;
	}

	const lastPendingTimeMs = pendingCursorSamples[pendingCursorSamples.length - 1]?.timeMs ?? -1;
	pendingCursorSamples = [
		...pendingCursorSamples,
		...activeCursorSamples.filter((sample) => sample.timeMs > lastPendingTimeMs),
	];
}

function snapshotKeyboardTelemetryForPersistence() {
	if (activeKeyboardSamples.length === 0) {
		return;
	}

	if (pendingKeyboardSamples.length === 0) {
		pendingKeyboardSamples = [...activeKeyboardSamples];
		return;
	}

	const lastPendingTimeMs = pendingKeyboardSamples[pendingKeyboardSamples.length - 1]?.timeMs ?? -1;
	pendingKeyboardSamples = [
		...pendingKeyboardSamples,
		...activeKeyboardSamples.filter((sample) => sample.timeMs > lastPendingTimeMs),
	];
}

async function persistCapturedTelemetryForVideo(videoPath: string) {
	snapshotCursorTelemetryForPersistence();
	snapshotKeyboardTelemetryForPersistence();
	await Promise.all([
		persistPendingCursorTelemetry(videoPath),
		persistPendingKeyboardTelemetry(videoPath),
	]);

	return {
		success: true,
		path: videoPath,
		message: "Video stored successfully",
	};
}

async function finalizeStoredVideo(videoPath: string) {
	currentVideoPath = videoPath;
	currentProjectPath = null;
	await persistCapturedTelemetryForVideo(videoPath);
	if (isAutoRecordingPath(videoPath)) {
		await pruneAutoRecordings([videoPath]);
	}

	return {
		success: true,
		path: videoPath,
		message: "Video stored successfully",
	};
}

async function startInteractionCapture() {
	if (!isCursorCaptureActive) {
		return;
	}

	if (!["darwin", "win32", "linux"].includes(process.platform)) {
		return;
	}

	try {
		const hook = loadUiohookModule();
		console.log(
			"[CursorTelemetry] hook loaded:",
			!!hook,
			"has.on:",
			typeof hook?.on,
			"has.start:",
			typeof hook?.start,
		);
		if (!isCursorCaptureActive) {
			return;
		}

		if (!hook || typeof hook.on !== "function" || typeof hook.start !== "function") {
			console.log("[CursorTelemetry] hook unusable — aborting interaction capture");
			return;
		}

		const onMouseDown = (event: HookMouseEvent) => {
			if (!isCursorCaptureActive) {
				return;
			}

			const screenPoint = getHookCursorScreenPoint(event);
			if (screenPoint) {
				hookCursorScreenPoint = { x: screenPoint.x, y: screenPoint.y, updatedAt: Date.now() };
			}

			const point = getNormalizedCursorPoint(screenPoint);
			if (!point) {
				return;
			}

			const timeMs = getCursorCaptureElapsedMs();
			const button = getHookMouseButton(event);
			activePointerState = {
				button,
				startCx: point.cx,
				startCy: point.cy,
				startTimeMs: timeMs,
				lastDragSampleTimeMs: timeMs,
				isDragging: false,
			};

			pushCursorSample(point.cx, point.cy, timeMs, "mousedown", undefined, {
				rawX: point.rawX,
				rawY: point.rawY,
				origin: "hook",
				confidence: "high",
				sourceBounds: point.sourceBounds,
				displayBounds: point.displayBounds,
				sourceDisplayId: point.sourceDisplayId,
				displayScaleFactor: point.displayScaleFactor,
				captureMode: point.captureMode,
				capturePlatform: point.capturePlatform,
				geometrySource: point.geometrySource,
				projectionConfidence: point.projectionConfidence,
			});
		};

		const onMouseUp = (event: HookMouseEvent) => {
			if (!isCursorCaptureActive) {
				return;
			}

			const screenPoint = getHookCursorScreenPoint(event);
			if (screenPoint) {
				hookCursorScreenPoint = { x: screenPoint.x, y: screenPoint.y, updatedAt: Date.now() };
			}

			const point = getNormalizedCursorPoint(screenPoint);
			if (!point) {
				return;
			}

			const timeMs = getCursorCaptureElapsedMs();
			const button = getHookMouseButton(event);
			const wasDragging = activePointerState?.isDragging ?? false;
			pushCursorSample(
				point.cx,
				point.cy,
				timeMs,
				wasDragging ? "drag-end" : "mouseup",
				undefined,
				{
					rawX: point.rawX,
					rawY: point.rawY,
					origin: "hook",
					confidence: "high",
					sourceBounds: point.sourceBounds,
					displayBounds: point.displayBounds,
					sourceDisplayId: point.sourceDisplayId,
					displayScaleFactor: point.displayScaleFactor,
					captureMode: point.captureMode,
					capturePlatform: point.capturePlatform,
					geometrySource: point.geometrySource,
					projectionConfidence: point.projectionConfidence,
				},
			);

			let interactionType: CursorInteractionType | null = null;
			if (!wasDragging) {
				if (button === 2) {
					interactionType = "right-click";
				} else if (button === 3) {
					interactionType = "middle-click";
				} else {
					const thresholdMs = 350;
					const distance = lastLeftClick
						? Math.hypot(point.cx - lastLeftClick.cx, point.cy - lastLeftClick.cy)
						: Number.POSITIVE_INFINITY;

					interactionType =
						lastLeftClick && timeMs - lastLeftClick.timeMs <= thresholdMs && distance <= 0.04
							? "double-click"
							: "click";
					lastLeftClick = { timeMs, cx: point.cx, cy: point.cy };
				}
			}

			if (interactionType) {
				pushCursorSample(point.cx, point.cy, timeMs, interactionType, undefined, {
					rawX: point.rawX,
					rawY: point.rawY,
					origin: "hook",
					confidence: "high",
					sourceBounds: point.sourceBounds,
					displayBounds: point.displayBounds,
					sourceDisplayId: point.sourceDisplayId,
					displayScaleFactor: point.displayScaleFactor,
					captureMode: point.captureMode,
					capturePlatform: point.capturePlatform,
					geometrySource: point.geometrySource,
					projectionConfidence: point.projectionConfidence,
				});
			}

			activePointerState = null;
		};

		const onMouseMove = (event: HookMouseEvent) => {
			if (!isCursorCaptureActive) {
				return;
			}

			const point = getHookCursorScreenPoint(event);
			if (!point) {
				return;
			}

			hookCursorScreenPoint = { x: point.x, y: point.y, updatedAt: Date.now() };
			const normalizedPoint = getNormalizedCursorPoint(point);
			if (!normalizedPoint) {
				return;
			}

			const timeMs = getCursorCaptureElapsedMs();
			pushMoveCursorSample(normalizedPoint, timeMs, {
				origin: "hook",
				confidence: "high",
			});

			if (!activePointerState) {
				return;
			}
			const distance = Math.hypot(
				normalizedPoint.cx - activePointerState.startCx,
				normalizedPoint.cy - activePointerState.startCy,
			);
			const shouldPromoteToDrag = distance > 0.012;
			const shouldSampleDrag =
				timeMs - activePointerState.lastDragSampleTimeMs >= CURSOR_DRAG_SAMPLE_INTERVAL_MS;

			if (shouldPromoteToDrag && !activePointerState.isDragging) {
				activePointerState.isDragging = true;
				activePointerState.lastDragSampleTimeMs = timeMs;
				pushCursorSample(normalizedPoint.cx, normalizedPoint.cy, timeMs, "drag-start", undefined, {
					rawX: normalizedPoint.rawX,
					rawY: normalizedPoint.rawY,
					origin: "hook",
					confidence: "high",
					sourceBounds: normalizedPoint.sourceBounds,
					displayBounds: normalizedPoint.displayBounds,
					sourceDisplayId: normalizedPoint.sourceDisplayId,
					displayScaleFactor: normalizedPoint.displayScaleFactor,
					captureMode: normalizedPoint.captureMode,
					capturePlatform: normalizedPoint.capturePlatform,
					geometrySource: normalizedPoint.geometrySource,
					projectionConfidence: normalizedPoint.projectionConfidence,
				});
				return;
			}

			if (activePointerState.isDragging && shouldSampleDrag) {
				activePointerState.lastDragSampleTimeMs = timeMs;
				pushCursorSample(normalizedPoint.cx, normalizedPoint.cy, timeMs, "drag", undefined, {
					rawX: normalizedPoint.rawX,
					rawY: normalizedPoint.rawY,
					origin: "hook",
					confidence: "high",
					sourceBounds: normalizedPoint.sourceBounds,
					displayBounds: normalizedPoint.displayBounds,
					sourceDisplayId: normalizedPoint.sourceDisplayId,
					displayScaleFactor: normalizedPoint.displayScaleFactor,
					captureMode: normalizedPoint.captureMode,
					capturePlatform: normalizedPoint.capturePlatform,
					geometrySource: normalizedPoint.geometrySource,
					projectionConfidence: normalizedPoint.projectionConfidence,
				});
			}
		};

		const onKeyDown = (event: HookKeyboardEvent) => {
			if (!isCursorCaptureActive) {
				return;
			}

			const keycode = getHookKeyboardKeycode(event);
			const key = getHookKeyboardKey(event);
			if (keycode == null || !key) {
				return;
			}

			const timeMs = getCursorCaptureElapsedMs();
			pushKeyboardSample(timeMs, "keydown", key, keycode, {
				altKey: getHookKeyboardModifier(event, "altKey"),
				ctrlKey: getHookKeyboardModifier(event, "ctrlKey"),
				metaKey: getHookKeyboardModifier(event, "metaKey"),
				shiftKey: getHookKeyboardModifier(event, "shiftKey"),
			});
		};

		const onKeyUp = (event: HookKeyboardEvent) => {
			if (!isCursorCaptureActive) {
				return;
			}

			const keycode = getHookKeyboardKeycode(event);
			const key = getHookKeyboardKey(event);
			if (keycode == null || !key) {
				return;
			}

			const timeMs = getCursorCaptureElapsedMs();
			pushKeyboardSample(timeMs, "keyup", key, keycode, {
				altKey: getHookKeyboardModifier(event, "altKey"),
				ctrlKey: getHookKeyboardModifier(event, "ctrlKey"),
				metaKey: getHookKeyboardModifier(event, "metaKey"),
				shiftKey: getHookKeyboardModifier(event, "shiftKey"),
			});
		};

		hook.on("mousedown", onMouseDown);
		hook.on("mouseup", onMouseUp);
		hook.on("mousemove", onMouseMove);
		hook.on("keydown", onKeyDown);
		hook.on("keyup", onKeyUp);

		hook.start();

		interactionCaptureCleanup = () => {
			try {
				if (typeof hook.off === "function") {
					hook.off("mousedown", onMouseDown);
					hook.off("mouseup", onMouseUp);
					hook.off("mousemove", onMouseMove);
					hook.off("keydown", onKeyDown);
					hook.off("keyup", onKeyUp);
				} else if (typeof hook.removeListener === "function") {
					hook.removeListener("mousedown", onMouseDown);
					hook.removeListener("mouseup", onMouseUp);
					hook.removeListener("mousemove", onMouseMove);
					hook.removeListener("keydown", onKeyDown);
					hook.removeListener("keyup", onKeyUp);
				}
			} catch {
				// ignore listener cleanup errors
			}

			try {
				if (typeof hook.stop === "function") {
					hook.stop();
				}
			} catch {
				// ignore hook shutdown errors
			}
		};
	} catch (error) {
		if (!hasLoggedInteractionHookFailure) {
			hasLoggedInteractionHookFailure = true;
			console.warn("[CursorTelemetry] Global interaction capture unavailable:", error);
		}
	}
}

export function registerIpcHandlers(
	createEditorWindow: () => void,
	createSourceSelectorWindow: () => BrowserWindow,
	createHudOverlay: () => BrowserWindow,
	_getMainWindow: () => BrowserWindow | null,
	getSourceSelectorWindow: () => BrowserWindow | null,
	onRecordingStateChange?: (recording: boolean, sourceName: string) => void,
) {
	registerAssetIpcHandlers();
	registerChunkSessionIpcHandlers({
		getRecordingsDir,
		remuxMediaRecorderSegment,
		persistCapturedTelemetryForVideo,
	});
	registerCaptureSourceIpcHandlers({
		brandName: BRAND_NAME,
		appNameAliases: APP_NAME_ALIASES,
		allowOwnWindowCapture: ALLOW_OWN_WINDOW_CAPTURE,
		getScreen,
		getSelectedSource: () => selectedSource,
		setSelectedSource: (source) => {
			selectedSource = source;
		},
		getUserExplicitlySelectedSource: () => userExplicitlySelectedSource,
		setUserExplicitlySelectedSource: (selected) => {
			userExplicitlySelectedSource = selected;
		},
		getSelectedArea: () => selectedArea,
		setSelectedArea: (area) => {
			selectedArea = area;
		},
		notifySelectedAreaChanged,
		getSelectedAreaForSource,
		stopWindowBoundsCapture,
		getSourceSelectorWindow,
		getNativeMacWindowSources,
	});
	registerScreenshotIpcHandlers({
		getRecordingsDir,
		getSelectedSource: () => selectedSource,
		getSelectedArea: () => selectedArea,
		getScreen,
		writeBufferToUniqueFile,
		isEnabled: () => isFeatureEnabled("screenshots"),
	});
	registerLayeredCaptureIpcHandlers();
	registerHostValidationIpcHandlers();
	registerPermissionDiagnosticsIpcHandlers({
		appBundleId: APP_BUNDLE_ID,
		getAppBundlePath,
		getExpectedApplicationsBundlePath,
		getPrebundledNativeHelperPath,
		getNativeCaptureHelperSourcePath,
		getNativeCaptureHelperBinaryPath,
		getNativeWindowListSourcePath,
		getNativeWindowListBinaryPath,
		getNativeWindowBoundsMonitorSourcePath,
		getNativeWindowBoundsMonitorBinaryPath,
		getSystemCursorHelperSourcePath,
		getSystemCursorHelperBinaryPath,
		getNativeCursorMonitorSourcePath,
		getNativeCursorMonitorBinaryPath,
		getNativeMacWindowSources,
	});
	registerSystemSettingsIpcHandlers();
	registerCaptionIpcHandlers({
		getCurrentVideoPath: () => currentVideoPath,
		getCurrentMicrophoneAudioPath: () => currentMicrophoneAudioPath,
		getFfmpegBinaryPath,
		normalizeVideoSourcePath,
	});
	registerCurrentMediaIpcHandlers({
		getVideoPath: () => currentVideoPath,
		setVideoPath: (path) => {
			currentVideoPath = path;
		},
		setProjectPath: (path) => {
			currentProjectPath = path;
		},
		getWebcamPath: () => currentWebcamPath,
		setWebcamPath: (path) => {
			currentWebcamPath = path;
		},
		setMicrophoneAudioPath: (path) => {
			currentMicrophoneAudioPath = path;
		},
		normalizeVideoSourcePath,
	});
	registerPostRecordingIpcHandlers({
		getPostRecordingContext: () => postRecordingContext,
		setPostRecordingContext: (context) => {
			postRecordingContext = context;
		},
	});
	registerExportFileIpcHandlers({
		getRecordingsDir,
		getExportSaveDialogOptions,
		setCurrentProjectPath: (path) => {
			currentProjectPath = path;
		},
		writeBufferToUniqueFile,
	});
	registerProjectFileIpcHandlers({
		brandName: BRAND_NAME,
		projectFileExtension: PROJECT_FILE_EXTENSION,
		projectFileExtensions: PROJECT_FILE_EXTENSIONS,
		defaultRecordingsDir: RECORDINGS_DIR,
		getRecordingsDir,
		persistRecordingsDirectorySetting,
		getCurrentProjectPath: () => currentProjectPath,
		setCurrentProjectPath: (projectPath) => {
			currentProjectPath = projectPath;
		},
		getCurrentVideoPath: () => currentVideoPath,
		setCurrentVideoPath: (videoPath) => {
			currentVideoPath = videoPath;
		},
		getCurrentWebcamPath: () => currentWebcamPath,
		setCurrentWebcamPath: (webcamPath) => {
			currentWebcamPath = webcamPath;
		},
		setCurrentMicrophoneAudioPath: (microphonePath) => {
			currentMicrophoneAudioPath = microphonePath;
		},
		normalizeVideoSourcePath,
		normalizePath,
		isPathInsideDirectory,
		deletePathIfExists,
		getTelemetryPathForVideo,
		getKeyboardTelemetryPathForVideo,
		isTrustedProjectPath,
	});
	registerTelemetryReadIpcHandlers({
		getSystemCursorAssets,
		getCurrentVideoPath: () => currentVideoPath,
		getTelemetryPathForVideo,
		getKeyboardTelemetryPathForVideo,
		normalizeVideoSourcePath,
		isCursorVisualType,
	});
	registerMobileCaptureIpcHandlers();
	registerAppShellIpcHandlers({
		createEditorWindow,
		createSourceSelectorWindow,
		createHudOverlay,
		getSourceSelectorWindow,
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.startNative,
		async (_, source: SelectedSource, options?: NativeMacRecordingOptions) => {
			// Windows WGC path
			if (process.platform === "win32") {
				const wgcAvailable = await isWgcCaptureAvailable();
				if (!wgcAvailable) {
					return { success: false, message: "WGC capture is not available on this system." };
				}

				if (wgcCaptureProcess && !wgcScreenRecordingActive) {
					try {
						wgcCaptureProcess.kill();
					} catch {
						/* ignore */
					}
					wgcCaptureProcess = null;
					wgcCaptureTargetPath = null;
					wgcCaptureStopRequested = false;
				}

				if (wgcCaptureProcess) {
					return { success: false, message: "A WGC screen recording is already active." };
				}

				try {
					const exePath = getWgcCaptureExePath();
					const recordingsDir = await getRecordingsDir();
					const timestamp = Date.now();
					const outputPath = path.join(recordingsDir, `recording-${timestamp}.mp4`);

					const config: Record<string, unknown> = {
						outputPath,
						fps: Math.max(30, options?.recordingFps ?? 30),
					};
					if (options?.recordingWidth) {
						config.width = options.recordingWidth;
					}
					if (options?.recordingHeight) {
						config.height = options.recordingHeight;
					}
					if (options?.videoBitsPerSecond) {
						config.bitrate = options.videoBitsPerSecond;
					}
					if (typeof options?.hardwareAcceleration === "boolean") {
						config.hardwareAcceleration = options.hardwareAcceleration;
					}
					if (options?.selectedArea) {
						config.area = options.selectedArea;
					}

					if (options?.capturesSystemAudio) {
						const audioPath = path.join(recordingsDir, `recording-${timestamp}.system.wav`);
						config.captureSystemAudio = true;
						config.audioOutputPath = audioPath;
						wgcSystemAudioPath = audioPath;
					}

					if (options?.capturesMicrophone) {
						const micPath = path.join(recordingsDir, `recording-${timestamp}.mic.wav`);
						config.captureMic = true;
						config.micOutputPath = micPath;
						if (options.microphoneLabel) {
							config.micDeviceName = options.microphoneLabel;
						}
						wgcMicAudioPath = micPath;
					}

					const windowId = parseWindowId(source?.id);
					if (windowId && source?.id?.startsWith("window:")) {
						await refreshWindowBoundsForSource(source);
						config.windowHandle = windowId;
					} else {
						const screenId = Number(source?.display_id);
						config.displayId =
							Number.isFinite(screenId) && screenId > 0
								? screenId
								: Number(getScreen().getPrimaryDisplay().id);
					}

					wgcCaptureOutputBuffer = "";
					wgcCaptureTargetPath = outputPath;
					wgcCaptureStopRequested = false;
					wgcCaptureProcess = spawn(exePath, [JSON.stringify(config)], {
						cwd: recordingsDir,
						stdio: ["pipe", "pipe", "pipe"],
					});
					attachWgcCaptureLifecycle(wgcCaptureProcess);

					wgcCaptureProcess.stdout.on("data", (chunk: Buffer) => {
						wgcCaptureOutputBuffer += chunk.toString();
					});
					wgcCaptureProcess.stderr.on("data", (chunk: Buffer) => {
						wgcCaptureOutputBuffer += chunk.toString();
					});

					await waitForWgcCaptureStart(wgcCaptureProcess);
					wgcScreenRecordingActive = true;
					nativeScreenRecordingActive = true;
					return { success: true };
				} catch (error) {
					console.error("Failed to start WGC capture:", error);
					try {
						wgcCaptureProcess?.kill();
					} catch {
						/* ignore */
					}
					wgcScreenRecordingActive = false;
					nativeScreenRecordingActive = false;
					wgcCaptureProcess = null;
					wgcCaptureTargetPath = null;
					wgcCaptureStopRequested = false;
					return {
						success: false,
						message: "Failed to start WGC capture",
						error: String(error),
					};
				}
			}

			if (process.platform !== "darwin") {
				return { success: false, message: "Native screen recording is only available on macOS." };
			}

			if (nativeCaptureProcess && !nativeScreenRecordingActive) {
				try {
					nativeCaptureProcess.kill();
				} catch {
					// ignore stale helper cleanup failures
				}
				nativeCaptureProcess = null;
				nativeCaptureTargetPath = null;
				nativeCaptureStopRequested = false;
			}

			if (nativeCaptureProcess) {
				return { success: false, message: "A native screen recording is already active." };
			}

			try {
				const recordingsDir = await getRecordingsDir();
				const appName = normalizeDesktopSourceName(String(source?.appName ?? ""));
				const ownAppName = normalizeDesktopSourceName(app.getName());
				if (
					!ALLOW_OWN_WINDOW_CAPTURE &&
					source?.id?.startsWith("window:") &&
					appName &&
					(appName === ownAppName || APP_NAME_ALIASES.includes(appName))
				) {
					return {
						success: false,
						message: `Cannot record ${BRAND_NAME} windows. Please select another app window.`,
					};
				}

				const helperPath = await ensureNativeCaptureHelperBinary();
				const outputPath = path.join(recordingsDir, `recording-${Date.now()}.mp4`);
				const capturesSystemAudio = Boolean(options?.capturesSystemAudio);
				const capturesMicrophone = Boolean(options?.capturesMicrophone);
				const microphoneOutputPath =
					capturesSystemAudio && capturesMicrophone
						? path.join(recordingsDir, `recording-${Date.now()}.mic.m4a`)
						: null;
				const config: Record<string, unknown> = {
					fps: Math.max(30, options?.recordingFps ?? 30),
					outputPath,
					capturesSystemAudio,
					capturesMicrophone,
				};
				if (options?.recordingWidth) {
					config.width = options.recordingWidth;
				}
				if (options?.recordingHeight) {
					config.height = options.recordingHeight;
				}
				if (options?.videoBitsPerSecond) {
					config.videoBitsPerSecond = options.videoBitsPerSecond;
				}
				if (typeof options?.hardwareAcceleration === "boolean") {
					config.hardwareAcceleration = options.hardwareAcceleration;
				}
				if (options?.selectedArea) {
					config.area = options.selectedArea;
				}

				if (options?.microphoneDeviceId) {
					config.microphoneDeviceId = options.microphoneDeviceId;
				}

				if (microphoneOutputPath) {
					config.microphoneOutputPath = microphoneOutputPath;
				}

				const windowId = parseWindowId(source?.id);
				const screenId = Number(source?.display_id);

				if (Number.isFinite(windowId) && windowId && source?.id?.startsWith("window:")) {
					config.windowId = windowId;
				} else if (Number.isFinite(screenId) && screenId > 0) {
					config.displayId = screenId;
				} else {
					config.displayId = Number(getScreen().getPrimaryDisplay().id);
				}

				nativeCaptureOutputBuffer = "";
				nativeCaptureTargetPath = outputPath;
				nativeCaptureMicrophonePath = microphoneOutputPath;
				nativeCaptureStopRequested = false;
				nativeCaptureProcess = spawn(helperPath, [JSON.stringify(config)], {
					cwd: recordingsDir,
					stdio: ["pipe", "pipe", "pipe"],
				});
				attachNativeCaptureLifecycle(nativeCaptureProcess);

				nativeCaptureProcess.stdout.on("data", (chunk: Buffer) => {
					nativeCaptureOutputBuffer += chunk.toString();
				});
				nativeCaptureProcess.stderr.on("data", (chunk: Buffer) => {
					nativeCaptureOutputBuffer += chunk.toString();
				});

				await waitForNativeCaptureStart(nativeCaptureProcess);
				nativeScreenRecordingActive = true;
				return { success: true };
			} catch (error) {
				console.error("Failed to start native ScreenCaptureKit recording:", error);
				try {
					nativeCaptureProcess?.kill();
				} catch {
					// ignore cleanup failures
				}
				nativeScreenRecordingActive = false;
				nativeCaptureProcess = null;
				nativeCaptureTargetPath = null;
				nativeCaptureMicrophonePath = null;
				nativeCaptureStopRequested = false;
				return {
					success: false,
					message: "Failed to start native ScreenCaptureKit recording",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.stopNative, async () => {
		// Windows WGC stop path
		if (process.platform === "win32" && wgcScreenRecordingActive) {
			try {
				if (!wgcCaptureProcess) {
					throw new Error("WGC capture process is not running");
				}

				const proc = wgcCaptureProcess;
				const preferredVideoPath = wgcCaptureTargetPath;
				wgcCaptureStopRequested = true;
				proc.stdin.write("stop\n");
				const tempVideoPath = await waitForWgcCaptureStop(proc);
				wgcCaptureProcess = null;
				wgcScreenRecordingActive = false;
				nativeScreenRecordingActive = false;
				wgcCaptureTargetPath = null;
				wgcCaptureStopRequested = false;

				const finalVideoPath = preferredVideoPath ?? tempVideoPath;
				if (tempVideoPath !== finalVideoPath) {
					await moveFileWithOverwrite(tempVideoPath, finalVideoPath);
				}

				wgcPendingVideoPath = finalVideoPath;
				return { success: true, path: finalVideoPath };
			} catch (error) {
				console.error("Failed to stop WGC capture:", error);
				const fallbackPath = wgcCaptureTargetPath;
				wgcScreenRecordingActive = false;
				nativeScreenRecordingActive = false;
				wgcCaptureProcess = null;
				wgcCaptureTargetPath = null;
				wgcCaptureStopRequested = false;
				wgcSystemAudioPath = null;
				wgcMicAudioPath = null;
				wgcPendingVideoPath = null;

				if (fallbackPath) {
					try {
						await fs.access(fallbackPath);
						wgcPendingVideoPath = fallbackPath;
						return { success: true, path: fallbackPath };
					} catch {
						// File doesn't exist
					}
				}

				return {
					success: false,
					message: "Failed to stop WGC capture",
					error: String(error),
				};
			}
		}

		if (process.platform !== "darwin") {
			return { success: false, message: "Native screen recording is only available on macOS." };
		}

		if (!nativeScreenRecordingActive) {
			return { success: false, message: "No native screen recording is active." };
		}

		try {
			if (!nativeCaptureProcess) {
				throw new Error("Native capture helper process is not running");
			}

			const process = nativeCaptureProcess;
			const preferredVideoPath = nativeCaptureTargetPath;
			const preferredMicrophonePath = nativeCaptureMicrophonePath;
			nativeCaptureStopRequested = true;
			process.stdin.write("stop\n");
			const tempVideoPath = await waitForNativeCaptureStop(process);
			nativeCaptureProcess = null;
			nativeScreenRecordingActive = false;
			nativeCaptureTargetPath = null;
			nativeCaptureMicrophonePath = null;
			nativeCaptureStopRequested = false;

			const finalVideoPath = preferredVideoPath ?? tempVideoPath;
			if (tempVideoPath !== finalVideoPath) {
				await moveFileWithOverwrite(tempVideoPath, finalVideoPath);
			}

			if (preferredMicrophonePath) {
				try {
					await fs.access(preferredMicrophonePath);
					await mixNativeMacAudioTracks(finalVideoPath, preferredMicrophonePath);
				} catch (error) {
					console.warn("Failed to mix native macOS microphone audio into capture:", error);
				}
			}

			await persistCapturedTelemetryForVideo(finalVideoPath);
			return {
				success: true,
				path: finalVideoPath,
				microphonePath: preferredMicrophonePath ?? undefined,
			};
		} catch (error) {
			console.error("Failed to stop native ScreenCaptureKit recording:", error);
			const fallbackPath = nativeCaptureTargetPath;
			nativeScreenRecordingActive = false;
			nativeCaptureProcess = null;
			nativeCaptureTargetPath = null;
			nativeCaptureMicrophonePath = null;
			nativeCaptureStopRequested = false;

			// Try to recover: if the target file exists on disk, finalize with it
			if (fallbackPath) {
				try {
					await fs.access(fallbackPath);
					console.log(
						"[stop-native-screen-recording] Recovering with fallback path:",
						fallbackPath,
					);
					await persistCapturedTelemetryForVideo(fallbackPath);
					return { success: true, path: fallbackPath };
				} catch {
					// File doesn't exist or isn't accessible
				}
			}

			return {
				success: false,
				message: "Failed to stop native ScreenCaptureKit recording",
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.recording.isWgcAvailable, async () => {
		return { available: await isWgcCaptureAvailable() };
	});

	ipcMain.handle(IPC_CHANNELS.recording.muxWgcRecording, async () => {
		const videoPath = wgcPendingVideoPath;
		wgcPendingVideoPath = null;

		if (!videoPath) {
			return { success: false, message: "No WGC video pending for mux" };
		}

		try {
			if (wgcSystemAudioPath || wgcMicAudioPath) {
				await muxWgcVideoWithAudio(videoPath, wgcSystemAudioPath, wgcMicAudioPath);
			}

			const microphonePath = wgcMicAudioPath ?? undefined;
			wgcSystemAudioPath = null;
			wgcMicAudioPath = null;
			await persistCapturedTelemetryForVideo(videoPath);
			return { success: true, path: videoPath, microphonePath };
		} catch (error) {
			console.error("Failed to mux WGC recording:", error);
			wgcSystemAudioPath = null;
			wgcMicAudioPath = null;
			try {
				await persistCapturedTelemetryForVideo(videoPath);
				return { success: true, path: videoPath };
			} catch {
				return { success: false, message: "Failed to mux WGC recording", error: String(error) };
			}
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.startFfmpeg,
		async (_, source: SelectedSource, options?: NativeMacRecordingOptions) => {
			if (ffmpegCaptureProcess) {
				return { success: false, message: "An FFmpeg recording is already active." };
			}

			try {
				const recordingsDir = await getRecordingsDir();
				const ffmpegPath = getFfmpegBinaryPath();
				const outputPath = path.join(recordingsDir, `recording-${Date.now()}.mp4`);
				const args = await buildFfmpegCaptureArgs(source, outputPath, options);
				if (source?.id?.startsWith("window:")) {
					await refreshWindowBoundsForSource(source);
				}

				ffmpegCaptureOutputBuffer = "";
				ffmpegCaptureTargetPath = outputPath;
				ffmpegCaptureProcess = spawn(ffmpegPath, args, {
					cwd: recordingsDir,
					stdio: ["pipe", "pipe", "pipe"],
				});

				ffmpegCaptureProcess.stdout.on("data", (chunk: Buffer) => {
					ffmpegCaptureOutputBuffer += chunk.toString();
				});
				ffmpegCaptureProcess.stderr.on("data", (chunk: Buffer) => {
					ffmpegCaptureOutputBuffer += chunk.toString();
				});

				await waitForFfmpegCaptureStart(ffmpegCaptureProcess);
				ffmpegScreenRecordingActive = true;
				return { success: true };
			} catch (error) {
				console.error("Failed to start FFmpeg recording:", error);
				ffmpegScreenRecordingActive = false;
				ffmpegCaptureProcess = null;
				ffmpegCaptureTargetPath = null;
				return {
					success: false,
					message: "Failed to start FFmpeg recording",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.stopFfmpeg, async () => {
		if (!ffmpegScreenRecordingActive) {
			return { success: false, message: "No FFmpeg recording is active." };
		}

		try {
			if (!ffmpegCaptureProcess || !ffmpegCaptureTargetPath) {
				throw new Error("FFmpeg process is not running");
			}

			const process = ffmpegCaptureProcess;
			const outputPath = ffmpegCaptureTargetPath;
			process.stdin.write("q\n");
			const finalVideoPath = await waitForFfmpegCaptureStop(process, outputPath);

			ffmpegCaptureProcess = null;
			ffmpegCaptureTargetPath = null;
			ffmpegScreenRecordingActive = false;

			return await finalizeStoredVideo(finalVideoPath);
		} catch (error) {
			console.error("Failed to stop FFmpeg recording:", error);
			ffmpegCaptureProcess = null;
			ffmpegCaptureTargetPath = null;
			ffmpegScreenRecordingActive = false;
			return {
				success: false,
				message: "Failed to stop FFmpeg recording",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.storeVideo,
		async (_, videoData: ArrayBuffer, fileName: string, finalize = true) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const videoPath = path.join(recordingsDir, fileName);
				await fs.writeFile(videoPath, Buffer.from(videoData));
				if (!finalize) {
					await persistCapturedTelemetryForVideo(videoPath);
					return { success: true, path: videoPath };
				}
				currentMicrophoneAudioPath = null;
				return await finalizeStoredVideo(videoPath);
			} catch (error) {
				console.error("Failed to store video:", error);
				return {
					success: false,
					message: "Failed to store video",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.getRecordedVideoPath, async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const files = await fs.readdir(recordingsDir);
			const videoFiles = files.filter((file) => /\.(webm|mov|mp4)$/i.test(file));

			if (videoFiles.length === 0) {
				return { success: false, message: "No recorded video found" };
			}

			const latestVideo = videoFiles.sort().reverse()[0];
			const videoPath = path.join(recordingsDir, latestVideo);

			return { success: true, path: videoPath };
		} catch (error) {
			console.error("Failed to get video path:", error);
			return { success: false, message: "Failed to get video path", error: String(error) };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.finalizeSession,
		async (
			_,
			payload: {
				videoSegments: RecordingSegmentPayload[];
				webcamSegments?: RecordingSegmentPayload[];
				microphoneSegments?: RecordingSegmentPayload[];
				selectedArea?: SelectedArea | null;
				webcamSessionMetadata?: WebcamSessionMetadata | null;
			},
		) => {
			try {
				return await finalizeRecordingSession(payload);
			} catch (error) {
				console.error("Failed to finalize recording session:", error);
				return {
					success: false,
					message: "Failed to finalize recording session",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		IPC_CHANNELS.recording.triggerFinalizeSession,
		(
			_,
			payload: {
				videoSegments: RecordingSegmentPayload[];
				webcamSegments?: RecordingSegmentPayload[];
				microphoneSegments?: RecordingSegmentPayload[];
				selectedArea?: SelectedArea | null;
				webcamSessionMetadata?: WebcamSessionMetadata | null;
			},
		) => {
			lastFinalizationResult = null;
			pendingFinalizationPromise = (async (): Promise<FinalizeResult> => {
				try {
					const result = await finalizeRecordingSession(payload);
					const finalized: FinalizeResult = {
						success: true,
						path: result.path,
						webcamPath: result.webcamPath ?? null,
						webcamSessionMetadata: result.webcamSessionMetadata ?? null,
						microphonePath: result.microphonePath ?? null,
						message: result.message,
					};
					if (postRecordingContext) {
						postRecordingContext = {
							...postRecordingContext,
							recordingPath: result.path ?? postRecordingContext.recordingPath ?? null,
							webcamPath: result.webcamPath ?? postRecordingContext.webcamPath ?? null,
							webcamSessionMetadata:
								result.webcamSessionMetadata ?? postRecordingContext.webcamSessionMetadata ?? null,
						};
					}
					lastFinalizationResult = finalized;
					return finalized;
				} catch (error) {
					console.error("Failed to finalize recording session:", error);
					const errResult: FinalizeResult = {
						success: false,
						message: "Failed to finalize recording session",
						error: String(error),
					};
					lastFinalizationResult = errResult;
					return errResult;
				}
			})();
			return { success: true };
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.awaitFinalized, async () => {
		if (pendingFinalizationPromise) {
			return await pendingFinalizationPromise;
		}
		if (lastFinalizationResult) {
			return lastFinalizationResult;
		}
		return { success: false, error: "No pending finalization" } satisfies FinalizeResult;
	});

	ipcMain.handle(
		IPC_CHANNELS.recording.discardArtifacts,
		async (
			_,
			payload: {
				paths: string[];
				clearCurrentVideo?: boolean;
				clearCurrentWebcam?: boolean;
			},
		) => {
			await discardRecordingArtifacts(payload.paths);
			if (payload.clearCurrentVideo) {
				currentVideoPath = null;
				currentMicrophoneAudioPath = null;
			}
			if (payload.clearCurrentWebcam) {
				currentWebcamPath = null;
			}
			return { success: true };
		},
	);

	ipcMain.handle(IPC_CHANNELS.recording.setState, (_, recording: boolean) => {
		if (recording) {
			void getRecordingsDir().then(markRecordingStarted);
		} else {
			void markRecordingStopped();
		}
		if (recording) {
			stopCursorCapture();
			stopInteractionCapture();
			startWindowBoundsCapture();
			void startNativeCursorMonitor();
			isCursorCaptureActive = true;
			activeCursorSamples = [];
			pendingCursorSamples = [];
			activeKeyboardSamples = [];
			pendingKeyboardSamples = [];
			keyboardCapturePlatform = normalizeKeyboardPlatform(process.platform);
			cursorCaptureStartTimeMs = Date.now();
			cursorCaptureStartHrTimeNs = process.hrtime.bigint();
			hookCursorScreenPoint = null;
			activePointerState = null;
			lastLeftClick = null;
			lastRecordedCursorPositionSample = null;
			sampleCursorPoint();
			cursorCaptureInterval = setInterval(sampleCursorPoint, CURSOR_SAMPLE_INTERVAL_MS);
			void startInteractionCapture();
		} else {
			isCursorCaptureActive = false;
			stopCursorCapture();
			stopInteractionCapture();
			stopWindowBoundsCapture();
			stopNativeCursorMonitor();
			hookCursorScreenPoint = null;
			activePointerState = null;
			lastRecordedCursorPositionSample = null;
			snapshotCursorTelemetryForPersistence();
			snapshotKeyboardTelemetryForPersistence();
			activeCursorSamples = [];
			activeKeyboardSamples = [];
		}

		const source = selectedSource || { name: "Screen" };
		BrowserWindow.getAllWindows().forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send("recording-state-changed", {
					recording,
					sourceName: source.name,
				});
			}
		});

		if (onRecordingStateChange) {
			onRecordingStateChange(recording, source.name);
		}

		void getScreenMintUpdater().setBusyState({ recording });
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.probe, async () => getCachedExportV2Capabilities());

	ipcMain.handle(IPC_CHANNELS.exportV2.createWorker, async () => {
		try {
			createExportWorkerWindow();
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.workerProgress, async (_, progress: ExportV2Progress) => {
		const owner = exportV2WorkerOwners.get(progress.jobId);
		if (owner && !owner.isDestroyed()) {
			emitExportV2Progress(owner, progress);
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.workerComplete, async (_, result: ExportV2StartResult) => {
		if (!result.jobId) {
			return { success: false, error: "Worker result is missing a job id." };
		}
		const resolver = exportV2WorkerResolvers.get(result.jobId);
		if (!resolver) {
			return { success: false, error: "Export worker job is no longer active." };
		}
		resolver(result);
		return { success: true };
	});

	registerExportV2StreamIpcHandlers({
		startExportV2StreamSession,
		appendExportV2StreamSession,
		finishExportV2StreamSession,
		discardExportV2StreamSession,
	});

	ipcMain.handle(
		IPC_CHANNELS.exportV2.gifPipeStart,
		async (_, request: ExportV2GifPipeStartRequest) => {
			try {
				const session = await startExportV2GifPipeSession(request);
				return { success: true, ...session };
			} catch (error) {
				return { success: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	);

	ipcMain.handle(
		IPC_CHANNELS.exportV2.gifPipeAppend,
		async (_, sessionId: string, chunk: ArrayBuffer) => {
			try {
				return await appendExportV2GifPipeSession(sessionId, chunk);
			} catch (error) {
				return { success: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.exportV2.gifPipeFinish, async (_, sessionId: string) => {
		try {
			const result = await finishExportV2GifPipeSession(sessionId);
			return { success: true, ...result };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.gifPipeDiscard, async (_, sessionId: string) => {
		try {
			await discardExportV2GifPipeSession(sessionId);
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.exportV2.cancel, async (_, jobId: string) => {
		const job = exportV2Jobs.get(jobId);
		if (!job) {
			const resolver = exportV2WorkerResolvers.get(jobId);
			const worker = exportV2WorkerWindows.get(jobId);
			if (resolver) {
				exportV2WorkerResolvers.delete(jobId);
				exportV2WorkerOwners.delete(jobId);
				exportV2WorkerWindows.delete(jobId);
				resolver({ success: false, canceled: true, jobId });
			}
			if (worker && !worker.isDestroyed()) {
				worker.close();
			}
			await discardExportV2GifPipeSessionsForJob(jobId);
			exportV2CanceledJobs.add(jobId);
			return { success: true };
		}

		exportV2CanceledJobs.add(jobId);
		job.process.kill("SIGTERM");
		await discardExportV2GifPipeSessionsForJob(jobId);
		await fs.rm(job.outputPath, { force: true }).catch(() => undefined);
		return { success: true };
	});

	ipcMain.handle(
		IPC_CHANNELS.exportV2.start,
		async (event, request: ExportV2StartRequest): Promise<ExportV2StartResult> => {
			const capabilities = getCachedExportV2Capabilities();
			const canUseGifPipeline = request.format === "gif" && capabilities.gif.ffmpegPalettePipeline;
			if (!capabilities.enabled && !canUseGifPipeline) {
				return {
					success: false,
					fallbackToLegacy: true,
					error: "Export v2 is disabled. Set SCREENMINT_EXPORT_V2=1 to enable it.",
				};
			}

			if (request.selection.engine === "composited-hardware") {
				const output = await resolveExportV2OutputPath(request);
				if (output.canceled || !output.path) {
					return { success: false, canceled: true };
				}
				const workerResult = await runExportV2WorkerJob(
					{
						...request,
						outputPath: output.path,
					},
					event.sender,
				);
				if (!workerResult.success || !workerResult.path) {
					return workerResult;
				}
				let validation: { video: boolean; audio: boolean; warnings: string[] };
				try {
					validation = await validateExportV2Output({
						ffmpegPath: capabilities.ffmpegPath ?? getFfmpegBinaryPath(),
						filePath: workerResult.path,
						format: request.format,
						expectAudio: request.audioPlan?.expectAudio === true,
						policy: request.validationPolicy ?? "warn",
					});
				} catch (error) {
					return {
						success: false,
						fallbackToLegacy: true,
						jobId: workerResult.jobId,
						error: error instanceof Error ? error.message : String(error),
					};
				}
				return {
					...workerResult,
					details: workerResult.details
						? {
								...workerResult.details,
								validation,
								warnings: [...(workerResult.details.warnings ?? []), ...validation.warnings],
							}
						: workerResult.details,
				};
			}

			if (
				request.selection.engine !== "direct-native" &&
				request.selection.engine !== "native-composed"
			) {
				return {
					success: false,
					fallbackToLegacy: true,
					error: request.selection.reason,
				};
			}

			if (request.selection.engine === "direct-native" && request.speedRegions?.length) {
				return {
					success: false,
					fallbackToLegacy: true,
					error: "Direct native export does not yet handle speed-edited timelines.",
				};
			}

			const availableVideoEncoders = getAvailableExportV2VideoEncoders(capabilities);
			if (request.format === "mp4" && availableVideoEncoders.length === 0) {
				return {
					success: false,
					fallbackToLegacy: true,
					error: "Export v2 could not find an available H.264 encoder.",
				};
			}
			if (request.format === "gif" && !capabilities.gif.ffmpegPalettePipeline) {
				return {
					success: false,
					fallbackToLegacy: true,
					error: "Export v2 could not find FFmpeg GIF palette filters.",
				};
			}

			const output = await resolveExportV2OutputPath(request);
			if (output.canceled || !output.path) {
				return { success: false, canceled: true };
			}

			if (request.selection.engine === "native-composed") {
				const firstEncoder = availableVideoEncoders[0];
				const compiled = compileNativeComposedExport(request, output.path, firstEncoder);
				if (!compiled.supported) {
					const fallbackResult = await runExportV2WorkerJob(
						{
							...request,
							outputPath: output.path,
							selection: {
								engine: "composited-hardware",
								reason: compiled.fallbackReason ?? "Native composition was not supported.",
							},
						},
						event.sender,
					);
					if (!fallbackResult.success || !fallbackResult.path) {
						return fallbackResult;
					}
					let validation: { video: boolean; audio: boolean; warnings: string[] };
					try {
						validation = await validateExportV2Output({
							ffmpegPath: capabilities.ffmpegPath ?? getFfmpegBinaryPath(),
							filePath: fallbackResult.path,
							format: request.format,
							expectAudio: request.audioPlan?.expectAudio === true,
							policy: request.validationPolicy ?? "warn",
						});
					} catch (error) {
						return {
							success: false,
							fallbackToLegacy: true,
							jobId: fallbackResult.jobId,
							error: error instanceof Error ? error.message : String(error),
						};
					}
					return {
						...fallbackResult,
						details: fallbackResult.details
							? {
									...fallbackResult.details,
									nativeComposedFallbackReason: compiled.fallbackReason,
									nativeComposedFeatures: compiled.featureReport,
									fallbackApplied: true,
									fallbackReason: fallbackResult.details.fallbackReason ?? compiled.fallbackReason,
									validation,
									warnings: [...(fallbackResult.details.warnings ?? []), ...validation.warnings],
								}
							: fallbackResult.details,
					};
				}
			}

			const jobId =
				request.jobId ?? `export-v2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
			const ffmpegEngine: ExportV2FfmpegEngine =
				request.selection.engine === "native-composed" ? "native-composed" : "direct-native";
			const startedAtMs = Date.now();
			const totalFrames = Math.max(
				1,
				Math.ceil(((request.durationMs ?? 0) / 1000) * request.frameRate),
			);
			const ffmpegPath = capabilities.ffmpegPath ?? getFfmpegBinaryPath();
			const attempts: ExportV2FfmpegAttempt[] =
				request.format === "gif"
					? [buildExportV2GifArgs(request, getExportV2AttemptPath(output.path, 0))]
					: availableVideoEncoders.map((encoder) => {
							const attemptPath = getExportV2AttemptPath(
								output.path!,
								availableVideoEncoders.indexOf(encoder),
							);
							if (ffmpegEngine === "native-composed") {
								const compiled = compileNativeComposedExport(request, attemptPath, encoder);
								if (!compiled.supported || !compiled.ffmpegArgs) {
									return {
										args: [],
										encoder,
										nativeComposedFallbackReason: compiled.fallbackReason,
										nativeComposedFeatures: compiled.featureReport,
									};
								}
								return {
									args: compiled.ffmpegArgs,
									encoder,
									nativeComposedFeatures: compiled.featureReport,
								};
							}
							return buildExportV2VideoArgs(request, attemptPath, encoder);
						});
			const runnableAttempts = attempts.filter((attempt) => attempt.args.length > 0);
			if (runnableAttempts.length === 0) {
				return {
					success: false,
					fallbackToLegacy: true,
					jobId,
					error:
						attempts[0]?.nativeComposedFallbackReason ??
						"Native composition could not produce FFmpeg arguments.",
				};
			}

			emitExportV2Progress(event.sender, {
				jobId,
				engine: ffmpegEngine,
				currentFrame: 0,
				totalFrames,
				percentage: 0,
				estimatedTimeRemaining: 0,
				etaSeconds: 0,
				throughputFps: 0,
				phase: "probing",
			});

			const failedAttempts: string[] = [];
			for (const [attemptIndex, attempt] of runnableAttempts.entries()) {
				const attemptPath = getExportV2AttemptPath(output.path, attemptIndex);
				const attemptStartedAtMs = Date.now();
				const attemptResult = await new Promise<{
					success: boolean;
					canceled?: boolean;
					error?: string;
				}>((resolve) => {
					let settled = false;
					let stderr = "";
					const child = spawn(ffmpegPath, attempt.args, {
						windowsHide: true,
					});
					exportV2Jobs.set(jobId, {
						process: child,
						outputPath: attemptPath,
						startedAtMs,
						engine: ffmpegEngine,
					});

					child.stderr.on("data", (chunk: Buffer) => {
						stderr += chunk.toString();
						const elapsedSec = parseFfmpegProgressSeconds(stderr);
						const currentFrame = Math.min(totalFrames, Math.round(elapsedSec * request.frameRate));
						const elapsedMs = Math.max(Date.now() - attemptStartedAtMs, 1);
						const throughputFps = currentFrame > 0 ? (currentFrame / elapsedMs) * 1000 : 0;
						const remainingFrames = Math.max(totalFrames - currentFrame, 0);
						const etaSeconds = throughputFps > 0 ? remainingFrames / throughputFps : 0;
						emitExportV2Progress(event.sender, {
							jobId,
							engine: ffmpegEngine,
							currentFrame,
							totalFrames,
							percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0,
							estimatedTimeRemaining: etaSeconds,
							etaSeconds,
							throughputFps,
							phase: "encoding",
						});
					});

					child.on("error", (error) => {
						if (settled) {
							return;
						}
						settled = true;
						exportV2Jobs.delete(jobId);
						resolve({ success: false, error: error.message });
					});

					child.on("close", (code) => {
						if (settled) {
							return;
						}
						settled = true;
						exportV2Jobs.delete(jobId);
						if (exportV2CanceledJobs.has(jobId)) {
							resolve({ success: false, canceled: true });
							return;
						}

						if (code !== 0) {
							resolve({
								success: false,
								error:
									stderr.split("\n").slice(-8).join("\n").trim() ||
									`FFmpeg export failed with code ${code ?? "unknown"}`,
							});
							return;
						}

						resolve({ success: true });
					});
				});

				if (exportV2CanceledJobs.delete(jobId) || attemptResult.canceled) {
					exportV2Jobs.delete(jobId);
					await fs.rm(attemptPath, { force: true }).catch(() => undefined);
					return { success: false, canceled: true, jobId };
				}

				if (!attemptResult.success) {
					failedAttempts.push(`${attempt.encoder.name}: ${attemptResult.error ?? "unknown error"}`);
					await fs.rm(attemptPath, { force: true }).catch(() => undefined);
					continue;
				}

				await fs.rm(output.path, { force: true }).catch(() => undefined);
				await fs.rename(attemptPath, output.path);
				let validation: { video: boolean; audio: boolean; warnings: string[] };
				try {
					validation = await validateExportV2Output({
						ffmpegPath,
						filePath: output.path,
						format: request.format,
						expectAudio: request.audioPlan?.expectAudio === true,
						policy: request.validationPolicy ?? "warn",
					});
				} catch (error) {
					failedAttempts.push(
						`${attempt.encoder.name}: ${error instanceof Error ? error.message : String(error)}`,
					);
					await fs.rm(output.path, { force: true }).catch(() => undefined);
					continue;
				}

				emitExportV2Progress(event.sender, {
					jobId,
					engine: ffmpegEngine,
					currentFrame: totalFrames,
					totalFrames,
					percentage: 100,
					estimatedTimeRemaining: 0,
					etaSeconds: 0,
					throughputFps:
						totalFrames > 0 ? (totalFrames / Math.max(Date.now() - startedAtMs, 1)) * 1000 : 0,
					phase: request.destination === "clipboard" ? "writing" : "finalizing",
				});

				if (request.destination === "clipboard") {
					writeExportV2ClipboardPath(output.path);
				}

				const stat = await fs.stat(output.path);
				const elapsedMs = Date.now() - startedAtMs;
				const throughputFps =
					totalFrames > 0 ? (totalFrames / Math.max(elapsedMs, 1)) * 1000 : undefined;
				return {
					success: true,
					jobId,
					path: output.path,
					copiedToClipboard: request.destination === "clipboard",
					details: {
						format: request.format,
						width: request.width,
						height: request.height,
						frameRate: request.frameRate,
						bitrate: request.bitrate,
						codec: request.format === "mp4" ? "avc1" : undefined,
						codecLabel: request.format === "mp4" ? "H.264" : undefined,
						colorCount: request.format === "gif" ? request.gif?.colorCount : undefined,
						ditherMode: request.format === "gif" ? request.gif?.ditherMode : undefined,
						motionSensitivity:
							request.format === "gif" ? request.gif?.motionSensitivity : undefined,
						loop: request.format === "gif" ? request.gif?.loop : undefined,
						dedupeFrames: request.format === "gif" ? request.gif?.dedupeFrames : undefined,
						paletteMode: request.format === "gif" ? "ffmpeg" : undefined,
						elapsedMs,
						fileSizeBytes: stat.size,
						fallbackApplied: failedAttempts.length > 0,
						fallbackReason: failedAttempts[0],
						fallbackSteps: failedAttempts.map((failure) => `Retried after ${failure}`),
						engine: ffmpegEngine,
						encoder: attempt.encoder.name,
						hardwareAcceleration: attempt.encoder.hardwareAcceleration,
						audioCodec: request.format === "mp4" ? "aac" : "none",
						validation,
						throughputFps,
						nativeComposedFeatures: attempt.nativeComposedFeatures,
						benchmarkThroughputFps: ffmpegEngine === "native-composed" ? throughputFps : undefined,
						warnings: [...capabilities.warnings, ...validation.warnings],
					},
				};
			}

			await fs.rm(output.path, { force: true }).catch(() => undefined);
			return {
				success: false,
				fallbackToLegacy: true,
				jobId,
				error:
					failedAttempts.length > 0
						? failedAttempts.join("\n")
						: "Export v2 failed before FFmpeg produced output.",
			};
		},
	);
}
