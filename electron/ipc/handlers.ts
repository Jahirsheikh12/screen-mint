import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { execFile, spawn, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
	app,
	BrowserWindow,
	clipboard,
	desktopCapturer,
	dialog,
	ipcMain,
	shell,
	systemPreferences,
} from "electron";
import type {
	CaptureDiagnostics,
	CapturePermissionState,
	CaptureSourceProbeResult,
	HelperBinaryDiagnostics,
} from "../../src/lib/recording/capturePermissionState";
import type { PostRecordingContext } from "../../src/lib/recording/postRecording";
import type {
	SelectedArea,
	CursorTelemetrySample as SessionCursorTelemetrySample,
} from "../../src/lib/recording/session";
import {
	cancelCaptionGeneration,
	exportCaptionTranscript,
	generateCaptions,
	getCaptionModelStatus,
	isCaptionGenerationCancelled,
} from "../captions/transcriptionOrchestrator";
import { RECORDINGS_DIR } from "../main";
import { getScreenMintUpdater } from "../updater";
import {
	closeAreaOverlayWindow,
	closeCountdownWindow,
	closeSpeakerNotesWindow,
	createAreaOverlayWindow,
	createCountdownWindow,
	createSpeakerNotesWindow,
	getCountdownWindow,
	lockAreaOverlayWindow,
	unlockAreaOverlayWindow,
	updateSpeakerNotesWindow,
} from "../windows";
import {
	type CursorMoveSampleCandidate,
	shouldRecordCursorMoveSample,
} from "./cursorTelemetryUtils";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const BRAND_NAME = "ScreenMint";
const APP_BUNDLE_ID = "com.jahirsheikh.screenmint";
const PROJECT_FILE_EXTENSION = "screenmint";
const PROJECT_FILE_EXTENSIONS = [PROJECT_FILE_EXTENSION];
const APP_NAME_ALIASES = ["screenmint"];
const SHORTCUTS_FILE = path.join(app.getPath("userData"), "shortcuts.json");
const RECORDINGS_SETTINGS_FILE = path.join(app.getPath("userData"), "recordings-settings.json");
const COUNTDOWN_SETTINGS_FILE = path.join(app.getPath("userData"), "countdown-settings.json");
const HUD_SETTINGS_FILE = path.join(app.getPath("userData"), "hud-overlay-settings-full.json");
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
let customRecordingsDir: string | null = null;
let recordingsDirLoaded = false;
let cachedSystemCursorAssets: Record<string, SystemCursorAsset> | null = null;
let cachedSystemCursorAssetsSourceMtimeMs: number | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let countdownCancelled = false;
let countdownInProgress = false;

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

function hasUsableSourceThumbnail(
	thumbnail:
		| {
				isEmpty: () => boolean;
				getSize: () => { width: number; height: number };
		  }
		| null
		| undefined,
) {
	if (!thumbnail || thumbnail.isEmpty()) {
		return false;
	}

	const size = thumbnail.getSize();
	return size.width > 1 && size.height > 1;
}

function getMacPrivacySettingsUrl(pane: "screen" | "accessibility") {
	return pane === "screen"
		? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
		: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
}

async function pathExists(targetPath: string) {
	try {
		await fs.access(targetPath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
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

function getScreenRecordingStatus() {
	if (process.platform !== "darwin") {
		return "granted";
	}

	try {
		return systemPreferences.getMediaAccessStatus("screen");
	} catch {
		return "unknown";
	}
}

function getMicrophonePermissionStatus() {
	if (process.platform !== "darwin") {
		return "granted";
	}

	try {
		return systemPreferences.getMediaAccessStatus("microphone");
	} catch {
		return "unknown";
	}
}

function buildCapturePermissionState(): CapturePermissionState {
	const bundlePath = getAppBundlePath();
	const expectedBundlePath = getExpectedApplicationsBundlePath();
	const installPathMatchesExpected =
		process.platform !== "darwin" ||
		!app.isPackaged ||
		(bundlePath !== null && expectedBundlePath !== null && bundlePath === expectedBundlePath);

	return {
		platform: process.platform,
		isPackaged: app.isPackaged,
		appPath: process.execPath,
		bundlePath,
		expectedBundlePath,
		bundleId: process.platform === "darwin" ? APP_BUNDLE_ID : null,
		inApplicationsFolder: installPathMatchesExpected,
		installPathMatchesExpected,
		screenStatus: getScreenRecordingStatus(),
		microphoneStatus: getMicrophonePermissionStatus(),
		accessibilityTrusted:
			process.platform !== "darwin" ? true : systemPreferences.isTrustedAccessibilityClient(false),
	};
}

async function buildHelperBinaryDiagnostics(
	name: string,
	sourcePath: string,
	userDataPath: string,
	prebundledBinaryName?: string,
): Promise<HelperBinaryDiagnostics> {
	const prebundledPath = prebundledBinaryName
		? getPrebundledNativeHelperPath(prebundledBinaryName)
		: null;
	const prebundledExists = prebundledPath ? await pathExists(prebundledPath) : false;
	const userDataExists = await pathExists(userDataPath);
	const resolvedPath =
		prebundledPath && (prebundledExists || app.isPackaged) ? prebundledPath : userDataPath;

	return {
		name,
		resolvedPath,
		sourcePath,
		prebundledPath,
		userDataPath,
		prebundledExists,
		userDataExists,
	};
}

async function probeCaptureSources(): Promise<CaptureSourceProbeResult> {
	let screenCount = 0;
	let windowCount = 0;
	let nativeWindowCount = 0;
	let desktopError: string | undefined;
	let nativeWindowError: string | undefined;

	try {
		const sources = await desktopCapturer.getSources({
			types: ["screen", "window"],
			thumbnailSize: { width: 1, height: 1 },
			fetchWindowIcons: false,
		});
		screenCount = sources.filter((source) => source.id.startsWith("screen:")).length;
		windowCount = sources.filter((source) => source.id.startsWith("window:")).length;
	} catch (error) {
		desktopError = String(error);
	}

	if (process.platform === "darwin") {
		try {
			nativeWindowCount = (await getNativeMacWindowSources({ maxAgeMs: 0 })).length;
		} catch (error) {
			nativeWindowError = String(error);
		}
	}

	return {
		success: !desktopError && !nativeWindowError,
		screenCount,
		windowCount,
		nativeWindowCount,
		desktopError,
		nativeWindowError,
	};
}

async function getCaptureDiagnostics(): Promise<CaptureDiagnostics> {
	const permissionState = buildCapturePermissionState();

	return {
		permissionState,
		userDataPath: app.getPath("userData"),
		helperPaths: await Promise.all([
			buildHelperBinaryDiagnostics(
				"screen capture",
				getNativeCaptureHelperSourcePath(),
				getNativeCaptureHelperBinaryPath(),
				"screenmint-screencapturekit-helper",
			),
			buildHelperBinaryDiagnostics(
				"window list",
				getNativeWindowListSourcePath(),
				getNativeWindowListBinaryPath(),
				"screenmint-window-list",
			),
			buildHelperBinaryDiagnostics(
				"window bounds monitor",
				getNativeWindowBoundsMonitorSourcePath(),
				getNativeWindowBoundsMonitorBinaryPath(),
				"screenmint-window-bounds-monitor",
			),
			buildHelperBinaryDiagnostics(
				"cursor assets",
				getSystemCursorHelperSourcePath(),
				getSystemCursorHelperBinaryPath(),
				"screenmint-system-cursors",
			),
			buildHelperBinaryDiagnostics(
				"cursor monitor",
				getNativeCursorMonitorSourcePath(),
				getNativeCursorMonitorBinaryPath(),
				"screenmint-native-cursor-monitor",
			),
		]),
		sourceProbe: await probeCaptureSources(),
	};
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

async function buildFfmpegCaptureArgs(source: SelectedSource, outputPath: string) {
	const commonOutputArgs = [
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-pix_fmt",
		"yuv420p",
		"-movflags",
		"+faststart",
		outputPath,
	];

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
				"60",
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
			"60",
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
				"60",
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
			"60",
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
			"60",
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

function emitCaptionGenerationProgress(progress: {
	stage: string;
	percentage: number;
	message: string;
}) {
	BrowserWindow.getAllWindows().forEach((window) => {
		if (!window.isDestroyed()) {
			window.webContents.send("caption-generation-progress", progress);
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
	const webcamOutputPath =
		webcamSegmentPaths.length === 1
			? webcamSegmentPaths[0]
			: path.join(recordingsDir, `webcam-${Date.now()}-merged.webm`);

	const microphoneSegmentPaths =
		payload.microphoneSegments
			?.filter((segment) => typeof segment.path === "string" && segment.path.trim().length > 0)
			.map((segment) => segment.path) ?? [];
	const microphoneOutputPath = path.join(recordingsDir, `recording-${Date.now()}-mic.m4a`);

	// Run independent muxes and cursor reads in parallel.
	const [mergedVideoPath, finalWebcamPath, finalMicrophonePath, mergedCursorSamples] =
		await Promise.all([
			concatenateMediaSegments(videoSegmentPaths, finalVideoPathBase, ["-c", "copy"]),
			webcamSegmentPaths.length > 0
				? concatenateMediaSegments(webcamSegmentPaths, webcamOutputPath, ["-c", "copy"])
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
		...microphoneSegmentPaths.filter((segmentPath) => segmentPath !== currentMicrophoneAudioPath),
	];
	await discardRecordingArtifacts(filesToDiscard);

	const stored = await finalizeStoredVideo(finalVideoPath);
	return {
		...stored,
		webcamPath: currentWebcamPath,
		microphonePath: currentMicrophoneAudioPath,
	};
}

const CURSOR_TELEMETRY_VERSION = 4;
const KEYBOARD_TELEMETRY_VERSION = 1;
const CURSOR_SAMPLE_INTERVAL_MS = 1000 / 60;
const CURSOR_DRAG_SAMPLE_INTERVAL_MS = 16;
const CURSOR_MOVE_SAMPLE_INTERVAL_MS = 8;
const CURSOR_MOVE_MIN_DISTANCE = 0.0015;
const CURSOR_POLL_HEARTBEAT_INTERVAL_MS = 120;
const CURSOR_POLL_STALE_AFTER_MS = 40;
const WINDOW_BOUNDS_CAPTURE_INTERVAL_MS = 1000 / 30;
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

	if (process.platform === "darwin") {
		bounds = await resolveMacWindowBounds(selectedSource);
	} else if (process.platform === "linux") {
		bounds = await resolveLinuxWindowBounds(selectedSource);
	}

	selectedWindowBounds = bounds;
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
		!["darwin", "linux"].includes(process.platform) ||
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
			};
		}

		const fallbackDisplay = getScreen().getDisplayNearestPoint(cursor);
		return {
			displayBounds: cloneWindowBounds(fallbackDisplay.bounds),
			sourceDisplayId: fallbackDisplay.id,
			displayScaleFactor: fallbackDisplay.scaleFactor,
			captureMode: "window" as const,
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

	return { x: rawX, y: rawY };
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
		confidence: options?.confidence,
		sourceBounds: cloneWindowBounds(options?.sourceBounds),
		displayBounds: cloneWindowBounds(options?.displayBounds),
		sourceDisplayId: options?.sourceDisplayId,
		displayScaleFactor: options?.displayScaleFactor,
		captureMode: options?.captureMode,
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
	getMainWindow: () => BrowserWindow | null,
	getSourceSelectorWindow: () => BrowserWindow | null,
	onRecordingStateChange?: (recording: boolean, sourceName: string) => void,
) {
	ipcMain.handle("get-sources", async (_, opts) => {
		const includeScreens = Array.isArray(opts?.types) ? opts.types.includes("screen") : true;
		const includeWindows = Array.isArray(opts?.types) ? opts.types.includes("window") : true;
		const electronTypes = [
			...(includeScreens ? ["screen" as const] : []),
			...(includeWindows ? ["window" as const] : []),
		];
		const electronSources =
			electronTypes.length > 0
				? await desktopCapturer.getSources({
						...opts,
						types: electronTypes,
					})
				: [];
		const ownWindowNames = new Set(
			[
				app.getName(),
				BRAND_NAME,
				...BrowserWindow.getAllWindows().flatMap((win) => {
					const title = win.getTitle().trim();
					return title ? [title] : [];
				}),
			]
				.map((name) => normalizeDesktopSourceName(name))
				.filter(Boolean),
		);
		const ownAppName = normalizeDesktopSourceName(app.getName());

		const allDisplays = getScreen().getAllDisplays();
		const primaryDisplayId = getScreen().getPrimaryDisplay().id;
		const displayInfoMap = new Map(allDisplays.map((d) => [String(d.id), d]));

		const screenSources = electronSources
			.filter((source) => source.id.startsWith("screen:"))
			.map((source) => {
				const info = displayInfoMap.get(String(source.display_id));
				return {
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
					width: info?.size.width,
					height: info?.size.height,
					scaleFactor: info?.scaleFactor,
					isPrimary: info ? info.id === primaryDisplayId : undefined,
					isInternal: info?.internal,
				};
			});

		if (process.platform !== "darwin" || !includeWindows) {
			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (
						ALLOW_OWN_WINDOW_CAPTURE &&
						APP_NAME_ALIASES.some((alias) => normalizedName.includes(alias))
					) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
				}));

			return [...screenSources, ...windowSources];
		}

		try {
			const nativeWindowSources = await getNativeMacWindowSources();
			const electronWindowSourceMap = new Map(
				electronSources
					.filter((source) => source.id.startsWith("window:"))
					.map((source) => [source.id, source] as const),
			);

			const mergedWindowSources = nativeWindowSources
				.filter((source) => {
					const normalizedWindowName = normalizeDesktopSourceName(
						source.windowTitle ?? source.name,
					);
					const normalizedAppName = normalizeDesktopSourceName(source.appName ?? "");

					if (!ALLOW_OWN_WINDOW_CAPTURE && normalizedAppName && normalizedAppName === ownAppName) {
						return false;
					}

					if (
						ALLOW_OWN_WINDOW_CAPTURE &&
						(APP_NAME_ALIASES.includes(normalizedAppName) ||
							APP_NAME_ALIASES.some((alias) => normalizedWindowName?.includes(alias)))
					) {
						return true;
					}

					if (!normalizedWindowName) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedWindowName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => {
					const electronWindowSource = electronWindowSourceMap.get(source.id);
					return {
						id: source.id,
						name: source.name,
						display_id: source.display_id ?? electronWindowSource?.display_id ?? "",
						thumbnail: electronWindowSource?.thumbnail
							? electronWindowSource.thumbnail.toDataURL()
							: null,
						appIcon:
							source.appIcon ??
							(electronWindowSource?.appIcon ? electronWindowSource.appIcon.toDataURL() : null),
						appName: source.appName,
						windowTitle: source.windowTitle,
					};
				})
				.filter((source) => Boolean(source.thumbnail));

			return [...screenSources, ...mergedWindowSources];
		} catch (error) {
			console.warn("Falling back to Electron window enumeration on macOS:", error);

			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (
						ALLOW_OWN_WINDOW_CAPTURE &&
						APP_NAME_ALIASES.some((alias) => normalizedName.includes(alias))
					) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (
							normalizedName === ownName ||
							normalizedName.includes(ownName) ||
							ownName.includes(normalizedName)
						) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
				}));

			return [...screenSources, ...windowSources];
		}
	});

	ipcMain.handle("select-source", (_, source: SelectedSource) => {
		selectedSource = source;
		userExplicitlySelectedSource = true;
		if (!getSelectedAreaForSource(source)) {
			selectedArea = null;
		}
		notifySelectedAreaChanged();
		stopWindowBoundsCapture();
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.close();
		}
		return selectedSource;
	});

	ipcMain.handle("auto-select-cursor-display", async () => {
		if (userExplicitlySelectedSource && selectedSource) {
			return { success: true, source: selectedSource };
		}
		try {
			const cursor = getScreen().getCursorScreenPoint();
			const targetDisplay = getScreen().getDisplayNearestPoint(cursor);
			const sources = await desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: { width: 1, height: 1 },
				fetchWindowIcons: false,
			});
			const match = sources.find((s) => Number(s.display_id) === targetDisplay.id) ?? sources[0];
			if (!match) {
				return { success: false };
			}
			selectedSource = {
				id: match.id,
				name: match.name,
				display_id: String(targetDisplay.id),
			} as SelectedSource;
			selectedArea = null;
			notifySelectedAreaChanged();
			return { success: true, source: selectedSource };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("get-selected-source", () => {
		return selectedSource;
	});

	ipcMain.handle("set-selected-area", (_, area: SelectedArea | null) => {
		selectedArea = area;
		notifySelectedAreaChanged();
		return { success: true, area: selectedArea };
	});

	ipcMain.handle("get-selected-area", () => {
		return { success: true, area: selectedArea };
	});

	ipcMain.handle("clear-selected-area", () => {
		selectedArea = null;
		notifySelectedAreaChanged();
		return { success: true };
	});

	ipcMain.handle("open-source-selector", () => {
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.focus();
			return;
		}
		createSourceSelectorWindow();
	});

	ipcMain.handle("switch-to-editor", () => {
		const mainWin = getMainWindow();
		if (mainWin) {
			mainWin.close();
		}
		createEditorWindow();
	});

	ipcMain.handle("switch-to-hud", () => {
		createHudOverlay();
	});

	ipcMain.handle(
		"start-native-screen-recording",
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
						fps: Math.max(30, options?.recordingFps ?? 60),
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
					fps: Math.max(30, options?.recordingFps ?? 60),
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

	ipcMain.handle("stop-native-screen-recording", async () => {
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

	ipcMain.handle("get-system-cursor-assets", async () => {
		try {
			return { success: true, cursors: await getSystemCursorAssets() };
		} catch (error) {
			console.error("Failed to load system cursor assets:", error);
			return { success: false, cursors: {}, error: String(error) };
		}
	});

	ipcMain.handle("is-wgc-available", async () => {
		return { available: await isWgcCaptureAvailable() };
	});

	ipcMain.handle("mux-wgc-recording", async () => {
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

	ipcMain.handle("start-ffmpeg-recording", async (_, source: SelectedSource) => {
		if (ffmpegCaptureProcess) {
			return { success: false, message: "An FFmpeg recording is already active." };
		}

		try {
			const recordingsDir = await getRecordingsDir();
			const ffmpegPath = getFfmpegBinaryPath();
			const outputPath = path.join(recordingsDir, `recording-${Date.now()}.mp4`);
			const args = await buildFfmpegCaptureArgs(source, outputPath);

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
	});

	ipcMain.handle("stop-ffmpeg-recording", async () => {
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
		"store-recorded-video",
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

	ipcMain.handle("get-recorded-video-path", async () => {
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
		"finalize-recording-session",
		async (
			_,
			payload: {
				videoSegments: RecordingSegmentPayload[];
				webcamSegments?: RecordingSegmentPayload[];
				microphoneSegments?: RecordingSegmentPayload[];
				selectedArea?: SelectedArea | null;
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
		"trigger-finalize-recording-session",
		(
			_,
			payload: {
				videoSegments: RecordingSegmentPayload[];
				webcamSegments?: RecordingSegmentPayload[];
				microphoneSegments?: RecordingSegmentPayload[];
				selectedArea?: SelectedArea | null;
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
						microphonePath: result.microphonePath ?? null,
						message: result.message,
					};
					if (postRecordingContext) {
						postRecordingContext = {
							...postRecordingContext,
							recordingPath: result.path ?? postRecordingContext.recordingPath ?? null,
							webcamPath: result.webcamPath ?? postRecordingContext.webcamPath ?? null,
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

	ipcMain.handle("await-recording-finalized", async () => {
		if (pendingFinalizationPromise) {
			return await pendingFinalizationPromise;
		}
		if (lastFinalizationResult) {
			return lastFinalizationResult;
		}
		return { success: false, error: "No pending finalization" } satisfies FinalizeResult;
	});

	ipcMain.handle(
		"discard-recording-artifacts",
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

	ipcMain.handle("set-recording-state", (_, recording: boolean) => {
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

	ipcMain.handle("get-cursor-telemetry", async (_, videoPath?: string) => {
		const targetVideoPath = normalizeVideoSourcePath(videoPath ?? currentVideoPath);
		if (!targetVideoPath) {
			return { success: true, samples: [] };
		}

		const telemetryPath = getTelemetryPathForVideo(targetVideoPath);
		try {
			const content = await fs.readFile(telemetryPath, "utf-8");
			const parsed = JSON.parse(content);
			const rawSamples = Array.isArray(parsed)
				? parsed
				: Array.isArray(parsed?.samples)
					? parsed.samples
					: [];

			const samples: CursorTelemetryPoint[] = rawSamples
				.filter((sample: unknown) => Boolean(sample && typeof sample === "object"))
				.map((sample: unknown) => {
					const point = sample as Partial<CursorTelemetryPoint>;
					return {
						timeMs:
							typeof point.timeMs === "number" && Number.isFinite(point.timeMs)
								? Math.max(0, point.timeMs)
								: 0,
						cx:
							typeof point.cx === "number" && Number.isFinite(point.cx)
								? clamp(point.cx, 0, 1)
								: 0.5,
						cy:
							typeof point.cy === "number" && Number.isFinite(point.cy)
								? clamp(point.cy, 0, 1)
								: 0.5,
						interactionType:
							point.interactionType === "mousedown" ||
							point.interactionType === "drag-start" ||
							point.interactionType === "drag" ||
							point.interactionType === "drag-end" ||
							point.interactionType === "click" ||
							point.interactionType === "double-click" ||
							point.interactionType === "right-click" ||
							point.interactionType === "middle-click" ||
							point.interactionType === "move" ||
							point.interactionType === "mouseup"
								? point.interactionType
								: undefined,
						cursorType:
							typeof point.cursorType === "string" && isCursorVisualType(point.cursorType)
								? point.cursorType
								: undefined,
						rawX:
							typeof point.rawX === "number" && Number.isFinite(point.rawX)
								? point.rawX
								: undefined,
						rawY:
							typeof point.rawY === "number" && Number.isFinite(point.rawY)
								? point.rawY
								: undefined,
						origin:
							point.origin === "hook" ||
							point.origin === "poll" ||
							point.origin === "native-monitor"
								? point.origin
								: undefined,
						confidence:
							point.confidence === "high" ||
							point.confidence === "medium" ||
							point.confidence === "low"
								? point.confidence
								: undefined,
						sourceBounds: sanitizeTelemetryBounds(point.sourceBounds),
						displayBounds: sanitizeTelemetryBounds(point.displayBounds),
						sourceDisplayId:
							typeof point.sourceDisplayId === "number" && Number.isFinite(point.sourceDisplayId)
								? point.sourceDisplayId
								: undefined,
						displayScaleFactor:
							typeof point.displayScaleFactor === "number" &&
							Number.isFinite(point.displayScaleFactor) &&
							point.displayScaleFactor > 0
								? point.displayScaleFactor
								: undefined,
						captureMode:
							point.captureMode === "display" ||
							point.captureMode === "window" ||
							point.captureMode === "area"
								? point.captureMode
								: undefined,
					};
				})
				.sort((a: CursorTelemetryPoint, b: CursorTelemetryPoint) => a.timeMs - b.timeMs);

			return { success: true, samples };
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				return { success: true, samples: [] };
			}
			console.error("Failed to load cursor telemetry:", error);
			return {
				success: false,
				message: "Failed to load cursor telemetry",
				error: String(error),
				samples: [],
			};
		}
	});

	ipcMain.handle("get-keyboard-telemetry", async (_, videoPath?: string) => {
		const targetVideoPath = normalizeVideoSourcePath(videoPath ?? currentVideoPath);
		if (!targetVideoPath) {
			return {
				success: true,
				platform: normalizeKeyboardPlatform(process.platform),
				samples: [],
			};
		}

		const telemetryPath = getKeyboardTelemetryPathForVideo(targetVideoPath);
		try {
			const content = await fs.readFile(telemetryPath, "utf-8");
			const parsed = JSON.parse(content);
			const rawSamples = Array.isArray(parsed?.samples) ? parsed.samples : [];

			const samples: KeyboardTelemetryPoint[] = rawSamples
				.filter((sample: unknown) => Boolean(sample && typeof sample === "object"))
				.map((sample: unknown) => {
					const point = sample as Partial<KeyboardTelemetryPoint>;
					return {
						timeMs:
							typeof point.timeMs === "number" && Number.isFinite(point.timeMs)
								? Math.max(0, point.timeMs)
								: 0,
						type: point.type === "keyup" ? "keyup" : "keydown",
						key: typeof point.key === "string" ? point.key.trim().toLowerCase() : "unknown",
						keycode:
							typeof point.keycode === "number" && Number.isFinite(point.keycode)
								? Math.round(point.keycode)
								: 0,
						altKey: Boolean(point.altKey),
						ctrlKey: Boolean(point.ctrlKey),
						metaKey: Boolean(point.metaKey),
						shiftKey: Boolean(point.shiftKey),
					};
				})
				.sort((a: KeyboardTelemetryPoint, b: KeyboardTelemetryPoint) => a.timeMs - b.timeMs);

			return {
				success: true,
				platform: normalizeKeyboardPlatform(parsed?.platform),
				samples,
			};
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				return {
					success: true,
					platform: normalizeKeyboardPlatform(process.platform),
					samples: [],
				};
			}

			console.error("Failed to load keyboard telemetry:", error);
			return {
				success: false,
				message: "Failed to load keyboard telemetry",
				error: String(error),
				platform: normalizeKeyboardPlatform(process.platform),
				samples: [],
			};
		}
	});

	ipcMain.handle("open-external-url", async (_, url: string) => {
		try {
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			console.error("Failed to open URL:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("get-accessibility-permission-status", () => {
		if (process.platform !== "darwin") {
			return { success: true, trusted: true, prompted: false };
		}

		return {
			success: true,
			trusted: systemPreferences.isTrustedAccessibilityClient(false),
			prompted: false,
		};
	});

	ipcMain.handle("request-accessibility-permission", () => {
		if (process.platform !== "darwin") {
			return { success: true, trusted: true, prompted: false };
		}

		return {
			success: true,
			trusted: systemPreferences.isTrustedAccessibilityClient(true),
			prompted: true,
		};
	});

	ipcMain.handle("get-capture-permission-state", async () => {
		return {
			success: true,
			state: buildCapturePermissionState(),
		};
	});

	ipcMain.handle("request-microphone-access", async () => {
		if (process.platform !== "darwin") {
			return { success: true, granted: true, status: "granted" };
		}

		try {
			const granted = await systemPreferences.askForMediaAccess("microphone");
			return {
				success: true,
				granted,
				status: getMicrophonePermissionStatus(),
			};
		} catch (error) {
			return {
				success: false,
				granted: false,
				status: getMicrophonePermissionStatus(),
				error: String(error),
			};
		}
	});

	ipcMain.handle("get-screen-recording-permission-status", () => {
		if (process.platform !== "darwin") {
			return { success: true, status: "granted" };
		}

		try {
			return {
				success: true,
				status: getScreenRecordingStatus(),
			};
		} catch (error) {
			console.error("Failed to get screen recording permission status:", error);
			return { success: false, status: "unknown", error: String(error) };
		}
	});

	ipcMain.handle("open-screen-recording-preferences", async () => {
		if (process.platform !== "darwin") {
			return { success: true };
		}

		try {
			await shell.openExternal(getMacPrivacySettingsUrl("screen"));
			return { success: true };
		} catch (error) {
			console.error("Failed to open Screen Recording preferences:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("open-accessibility-preferences", async () => {
		if (process.platform !== "darwin") {
			return { success: true };
		}

		try {
			await shell.openExternal(getMacPrivacySettingsUrl("accessibility"));
			return { success: true };
		} catch (error) {
			console.error("Failed to open Accessibility preferences:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("probe-capture-sources", async () => {
		try {
			return {
				success: true,
				probe: await probeCaptureSources(),
			};
		} catch (error) {
			return {
				success: false,
				probe: {
					success: false,
					screenCount: 0,
					windowCount: 0,
					nativeWindowCount: 0,
				},
				error: String(error),
			};
		}
	});

	ipcMain.handle("get-capture-diagnostics", async () => {
		try {
			return {
				success: true,
				diagnostics: await getCaptureDiagnostics(),
			};
		} catch (error) {
			return {
				success: false,
				error: String(error),
			};
		}
	});

	const resolveAssetBasePath = () => {
		try {
			if (app.isPackaged) {
				const assetPath = path.join(process.resourcesPath, "assets");
				return pathToFileURL(`${assetPath}${path.sep}`).toString();
			}
			const assetPath = path.join(app.getAppPath(), "public");
			return pathToFileURL(`${assetPath}${path.sep}`).toString();
		} catch (err) {
			console.error("Failed to resolve asset base path:", err);
			return null;
		}
	};

	// Return base path for assets so renderer can resolve file:// paths in production
	ipcMain.handle("get-asset-base-path", () => {
		return resolveAssetBasePath();
	});

	ipcMain.on("get-asset-base-path-sync", (event) => {
		event.returnValue = resolveAssetBasePath();
	});

	ipcMain.handle("read-local-file", async (_, filePath: string) => {
		try {
			const data = await fs.readFile(filePath);
			return { success: true, data };
		} catch (error) {
			console.error("Failed to read local file:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("save-exported-video", async (_, videoData: ArrayBuffer, fileName: string) => {
		try {
			// Determine file type from extension
			const isGif = fileName.toLowerCase().endsWith(".gif");
			const filters = isGif
				? [{ name: "GIF Image", extensions: ["gif"] }]
				: [{ name: "MP4 Video", extensions: ["mp4"] }];

			const result = await dialog.showSaveDialog({
				title: isGif ? "Save Exported GIF" : "Save Exported Video",
				defaultPath: path.join(app.getPath("downloads"), fileName),
				filters,
				properties: ["createDirectory", "showOverwriteConfirmation"],
			});

			if (result.canceled || !result.filePath) {
				return {
					success: false,
					canceled: true,
					message: "Export canceled",
				};
			}

			await fs.writeFile(result.filePath, Buffer.from(videoData));

			return {
				success: true,
				path: result.filePath,
				message: "Video exported successfully",
			};
		} catch (error) {
			console.error("Failed to save exported video:", error);
			return {
				success: false,
				message: "Failed to save exported video",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		"save-exported-video-to-recordings",
		async (_, videoData: ArrayBuffer, fileName: string) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
				const targetPath = path.join(recordingsDir, `${Date.now()}-${safeName}`);
				await fs.writeFile(targetPath, Buffer.from(videoData));
				return {
					success: true,
					path: targetPath,
					message: "Video saved to recordings folder",
				};
			} catch (error) {
				console.error("Failed to save exported video to recordings:", error);
				return {
					success: false,
					message: "Failed to save exported video to recordings",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("open-video-file-picker", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: "Select Video File",
				defaultPath: recordingsDir,
				filters: [
					{ name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			currentProjectPath = null;
			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open file picker:", error);
			return {
				success: false,
				message: "Failed to open file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle("open-audio-file-picker", async () => {
		try {
			const result = await dialog.showOpenDialog({
				title: "Select Audio File",
				filters: [
					{ name: "Audio Files", extensions: ["mp3", "wav", "aac", "m4a", "flac", "ogg"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open audio file picker:", error);
			return {
				success: false,
				message: "Failed to open audio file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle("reveal-in-folder", async (_, filePath: string) => {
		try {
			// shell.showItemInFolder doesn't return a value, it throws on error
			shell.showItemInFolder(filePath);
			return { success: true };
		} catch (error) {
			console.error(`Error revealing item in folder: ${filePath}`, error);
			// Fallback to open the directory if revealing the item fails
			// This might happen if the file was moved or deleted after export,
			// or if the path is somehow invalid for showItemInFolder
			try {
				const openPathResult = await shell.openPath(path.dirname(filePath));
				if (openPathResult) {
					// openPath returned an error message
					return { success: false, error: openPathResult };
				}
				return { success: true, message: "Could not reveal item, but opened directory." };
			} catch (openError) {
				console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
				return { success: false, error: String(error) };
			}
		}
	});

	ipcMain.handle("open-recordings-folder", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const openPathResult = await shell.openPath(recordingsDir);
			if (openPathResult) {
				return {
					success: false,
					error: openPathResult,
					message: "Failed to open recordings folder.",
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Failed to open recordings folder:", error);
			return { success: false, error: String(error), message: "Failed to open recordings folder." };
		}
	});

	ipcMain.handle("copy-text-to-clipboard", async (_, text: string) => {
		try {
			clipboard.writeText(text);
			return { success: true, message: "Copied to clipboard" };
		} catch (error) {
			console.error("Failed to copy text to clipboard:", error);
			return {
				success: false,
				message: "Failed to copy text to clipboard",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		"copy-exported-to-clipboard",
		async (_, videoData: ArrayBuffer, fileName: string) => {
			try {
				const ext = fileName.toLowerCase().endsWith(".gif") ? "gif" : "mp4";
				const tmpPath = path.join(app.getPath("temp"), `screenmint-clipboard-${Date.now()}.${ext}`);
				await fs.writeFile(tmpPath, Buffer.from(videoData));

				if (process.platform === "darwin") {
					const plistContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${tmpPath}</string></array></plist>`;
					clipboard.writeBuffer("NSFilenamesPboardType", Buffer.from(plistContent, "utf8"));
				} else {
					clipboard.writeText(tmpPath);
				}

				return { success: true, path: tmpPath };
			} catch (error) {
				console.error("Failed to copy exported file to clipboard:", error);
				return { success: false, error: String(error) };
			}
		},
	);

	ipcMain.handle(
		"delete-project-and-media",
		async (
			_,
			payload: {
				projectPath?: string | null;
				videoPath?: string | null;
				webcamPath?: string | null;
			},
		) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const deletedPaths: string[] = [];
				const skippedPaths: string[] = [];
				const candidates = [
					payload.projectPath ?? null,
					normalizeVideoSourcePath(payload.videoPath) ?? payload.videoPath ?? null,
					payload.webcamPath ?? null,
				].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

				for (const candidate of new Set(candidates)) {
					const normalizedCandidate = path.resolve(candidate);
					const isProject =
						currentProjectPath != null &&
						normalizePath(normalizedCandidate) === normalizePath(currentProjectPath);
					const canDelete = isProject || isPathInsideDirectory(normalizedCandidate, recordingsDir);

					if (!canDelete) {
						skippedPaths.push(normalizedCandidate);
						continue;
					}

					const deleted = await deletePathIfExists(normalizedCandidate);
					if (!deleted) {
						continue;
					}

					await Promise.all([
						fs.rm(getTelemetryPathForVideo(normalizedCandidate), { force: true }),
						fs.rm(getKeyboardTelemetryPathForVideo(normalizedCandidate), { force: true }),
					]);
					deletedPaths.push(normalizedCandidate);
					if (
						currentProjectPath &&
						normalizePath(currentProjectPath) === normalizePath(normalizedCandidate)
					) {
						currentProjectPath = null;
					}
					if (
						currentVideoPath &&
						normalizePath(currentVideoPath) === normalizePath(normalizedCandidate)
					) {
						currentVideoPath = null;
					}
					if (
						currentWebcamPath &&
						normalizePath(currentWebcamPath) === normalizePath(normalizedCandidate)
					) {
						currentWebcamPath = null;
					}
				}

				return {
					success: true,
					deletedPaths,
					skippedPaths,
					message: deletedPaths.length > 0 ? "Deleted project assets" : "Nothing was deleted",
				};
			} catch (error) {
				console.error("Failed to delete project and media:", error);
				return {
					success: false,
					message: "Failed to delete project and media",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("get-recordings-directory", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			return {
				success: true,
				path: recordingsDir,
				isDefault: recordingsDir === RECORDINGS_DIR,
			};
		} catch (error) {
			return {
				success: false,
				path: RECORDINGS_DIR,
				isDefault: true,
				error: String(error),
			};
		}
	});

	ipcMain.handle("choose-recordings-directory", async () => {
		try {
			const current = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: "Choose recordings folder",
				defaultPath: current,
				properties: ["openDirectory", "createDirectory", "promptToCreate"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, path: current };
			}

			const selectedPath = path.resolve(result.filePaths[0]);
			await fs.mkdir(selectedPath, { recursive: true });
			await fs.access(selectedPath, fsConstants.W_OK);
			await persistRecordingsDirectorySetting(selectedPath);

			return { success: true, path: selectedPath, isDefault: selectedPath === RECORDINGS_DIR };
		} catch (error) {
			return { success: false, error: String(error), message: "Failed to set recordings folder" };
		}
	});

	ipcMain.handle(
		"save-project-file",
		async (_, projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const trustedExistingProjectPath = isTrustedProjectPath(existingProjectPath)
					? existingProjectPath
					: null;

				if (trustedExistingProjectPath) {
					await fs.writeFile(
						trustedExistingProjectPath,
						JSON.stringify(projectData, null, 2),
						"utf-8",
					);
					currentProjectPath = trustedExistingProjectPath;
					return {
						success: true,
						path: trustedExistingProjectPath,
						message: "Project saved successfully",
					};
				}

				const safeName = (suggestedName || `project-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, "_");
				const defaultName = safeName.endsWith(`.${PROJECT_FILE_EXTENSION}`)
					? safeName
					: `${safeName}.${PROJECT_FILE_EXTENSION}`;

				const result = await dialog.showSaveDialog({
					title: `Save ${BRAND_NAME} Project`,
					defaultPath: path.join(recordingsDir, defaultName),
					filters: [
						{ name: `${BRAND_NAME} Project`, extensions: [PROJECT_FILE_EXTENSION] },
						{ name: "JSON", extensions: ["json"] },
					],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return {
						success: false,
						canceled: true,
						message: "Save project canceled",
					};
				}

				await fs.writeFile(result.filePath, JSON.stringify(projectData, null, 2), "utf-8");
				currentProjectPath = result.filePath;

				return {
					success: true,
					path: result.filePath,
					message: "Project saved successfully",
				};
			} catch (error) {
				console.error("Failed to save project file:", error);
				return {
					success: false,
					message: "Failed to save project file",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("load-project-file", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: `Open ${BRAND_NAME} Project`,
				defaultPath: recordingsDir,
				filters: [
					{ name: `${BRAND_NAME} Project`, extensions: PROJECT_FILE_EXTENSIONS },
					{ name: "JSON", extensions: ["json"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, message: "Open project canceled" };
			}

			const filePath = result.filePaths[0];
			const content = await fs.readFile(filePath, "utf-8");
			const project = JSON.parse(content);
			currentProjectPath = filePath;
			currentMicrophoneAudioPath = null;
			if (project && typeof project === "object" && typeof project.videoPath === "string") {
				currentVideoPath = normalizeVideoSourcePath(project.videoPath) ?? project.videoPath;
			}

			return {
				success: true,
				path: filePath,
				project,
			};
		} catch (error) {
			console.error("Failed to load project file:", error);
			return {
				success: false,
				message: "Failed to load project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("load-current-project-file", async () => {
		try {
			if (!currentProjectPath) {
				return { success: false, message: "No active project" };
			}

			const content = await fs.readFile(currentProjectPath, "utf-8");
			const project = JSON.parse(content);
			currentMicrophoneAudioPath = null;
			if (project && typeof project === "object" && typeof project.videoPath === "string") {
				currentVideoPath = normalizeVideoSourcePath(project.videoPath) ?? project.videoPath;
			}
			return {
				success: true,
				path: currentProjectPath,
				project,
			};
		} catch (error) {
			console.error("Failed to load current project file:", error);
			return {
				success: false,
				message: "Failed to load current project file",
				error: String(error),
			};
		}
	});
	ipcMain.handle("get-post-recording-context", () => {
		return {
			success: true,
			context: postRecordingContext,
		};
	});

	ipcMain.handle("set-post-recording-context", (_, context: PostRecordingContext | null) => {
		postRecordingContext = context;
		return { success: true };
	});

	ipcMain.handle("clear-post-recording-context", () => {
		postRecordingContext = null;
		return { success: true };
	});
	ipcMain.handle("set-current-video-path", (_, path: string) => {
		const normalizedPath = normalizeVideoSourcePath(path) ?? path;
		const isSameVideoPath = currentVideoPath === normalizedPath;
		currentVideoPath = normalizedPath;
		currentProjectPath = null;
		if (!isSameVideoPath) {
			currentMicrophoneAudioPath = null;
		}
		return { success: true };
	});

	ipcMain.handle("get-current-video-path", () => {
		return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
	});

	ipcMain.handle("clear-current-video-path", () => {
		currentVideoPath = null;
		currentMicrophoneAudioPath = null;
		return { success: true };
	});

	ipcMain.handle("set-current-webcam-path", (_, path: string) => {
		currentWebcamPath = path;
		return { success: true };
	});

	ipcMain.handle("get-current-webcam-path", () => {
		return currentWebcamPath ? { success: true, path: currentWebcamPath } : { success: false };
	});

	ipcMain.handle("clear-current-webcam-path", () => {
		currentWebcamPath = null;
		return { success: true };
	});

	ipcMain.handle("check-file-available", async (_, filePath: string) => {
		try {
			const normalizedPath = normalizeVideoSourcePath(filePath);
			if (!normalizedPath) {
				return { success: true, exists: false };
			}

			await fs.access(normalizedPath);
			return { success: true, exists: true, path: normalizedPath };
		} catch (error) {
			return {
				success: true,
				exists: false,
				error: String(error),
			};
		}
	});

	ipcMain.handle("get-caption-model-status", async (_, videoPath?: string) => {
		try {
			const targetVideoPath = normalizeVideoSourcePath(videoPath ?? currentVideoPath);
			if (!targetVideoPath) {
				return { success: false, message: "No video available for captions." };
			}

			const status = await getCaptionModelStatus(
				targetVideoPath,
				currentMicrophoneAudioPath,
				getFfmpegBinaryPath(),
			);
			return { success: true, status };
		} catch (error) {
			console.error("Failed to get caption model status:", error);
			return {
				success: false,
				message: "Failed to get caption model status",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		"generate-captions",
		async (
			_,
			request: {
				videoPath?: string;
				preferredBackend: "auto" | "whisper.cpp" | "apple-speech";
				model: "base" | "small" | "medium";
				language: string;
				prompt: string;
				preferredSourceAudio: "microphone" | "mixed";
			},
		) => {
			try {
				const targetVideoPath = normalizeVideoSourcePath(request.videoPath ?? currentVideoPath);
				if (!targetVideoPath) {
					return { success: false, message: "No video available for transcription." };
				}

				const track = await generateCaptions(
					{
						videoPath: targetVideoPath,
						preferredBackend: request.preferredBackend,
						model: request.model,
						language: request.language,
						prompt: request.prompt,
						preferredSourceAudio: request.preferredSourceAudio,
						microphoneAudioPath: currentMicrophoneAudioPath,
						ffmpegPath: getFfmpegBinaryPath(),
					},
					(progress) => {
						emitCaptionGenerationProgress(progress);
					},
				);

				return { success: true, track };
			} catch (error) {
				if (isCaptionGenerationCancelled(error)) {
					return {
						success: false,
						canceled: true,
						message: "Caption generation cancelled",
					};
				}

				console.error("Failed to generate captions:", error);
				return {
					success: false,
					message: "Failed to generate captions",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("cancel-caption-generation", async () => {
		cancelCaptionGeneration();
		return { success: true };
	});

	ipcMain.handle(
		"export-captions-transcript",
		async (
			_,
			payload: {
				videoPath?: string;
				format: "srt" | "vtt" | "txt";
				track: import("../../src/components/video-editor/types").CaptionTrack;
			},
		) => {
			try {
				const targetVideoPath = normalizeVideoSourcePath(payload.videoPath ?? currentVideoPath);
				if (!targetVideoPath) {
					return { success: false, message: "No video available for transcript export." };
				}

				const transcript = await exportCaptionTranscript(
					targetVideoPath,
					payload.track,
					payload.format,
				);
				const result = await dialog.showSaveDialog({
					title: "Export Transcript",
					defaultPath: path.join(app.getPath("downloads"), transcript.defaultFileName),
					filters: [{ name: "Transcript", extensions: [payload.format] }],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return { success: false, canceled: true, message: "Transcript export canceled" };
				}

				await fs.writeFile(result.filePath, transcript.content, "utf-8");
				return { success: true, path: result.filePath };
			} catch (error) {
				console.error("Failed to export transcript:", error);
				return {
					success: false,
					message: "Failed to export transcript",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("get-platform", () => {
		return process.platform;
	});

	ipcMain.handle("get-app-version", () => {
		return getScreenMintUpdater().getAppVersion();
	});

	ipcMain.handle("get-updater-state", () => {
		return getScreenMintUpdater().getState();
	});

	ipcMain.handle("check-for-updates", async () => {
		return await getScreenMintUpdater().checkForUpdates("manual");
	});

	ipcMain.handle("download-update", async () => {
		return await getScreenMintUpdater().downloadUpdate("manual");
	});

	ipcMain.handle("install-update-and-restart", async () => {
		return await getScreenMintUpdater().installUpdateAndRestart();
	});

	ipcMain.handle("dismiss-update", async () => {
		return await getScreenMintUpdater().dismissUpdate();
	});

	ipcMain.handle("update-later-for-session", async () => {
		return await getScreenMintUpdater().updateLaterForSession();
	});

	ipcMain.handle("dismiss-whats-new", async () => {
		return await getScreenMintUpdater().dismissWhatsNew();
	});

	ipcMain.handle("set-updater-busy-state", async (_, update: Record<string, unknown>) => {
		return await getScreenMintUpdater().setBusyState({
			exporting: typeof update.exporting === "boolean" ? update.exporting : undefined,
			transcribing: typeof update.transcribing === "boolean" ? update.transcribing : undefined,
			recording: typeof update.recording === "boolean" ? update.recording : undefined,
		});
	});

	// ---------------------------------------------------------------------------
	// Cursor hiding for the browser-capture fallback.
	// The IPC promise resolves only after the cursor hide attempt completes.
	// ---------------------------------------------------------------------------
	ipcMain.handle("hide-cursor", () => {
		// No-op: macOS excludes the cursor at the ScreenCaptureKit capture level.
		// Windows excludes the cursor via IsCursorCaptureEnabled(false) in wgc_session.cpp.
		// Linux uses Electron desktopCapturer which does not support cursor hiding;
		// if WGC is unavailable on Windows the call also falls back to browser capture
		// where cursor hiding is unsupported — those users may see the real cursor.
		return { success: true };
	});

	ipcMain.handle("get-shortcuts", async () => {
		try {
			const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
			return JSON.parse(data);
		} catch {
			return null;
		}
	});

	ipcMain.handle("save-shortcuts", async (_, shortcuts: unknown) => {
		try {
			await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save shortcuts:", error);
			return { success: false, error: String(error) };
		}
	});

	// ---------------------------------------------------------------------------
	// Countdown timer before recording
	// ---------------------------------------------------------------------------
	ipcMain.handle("get-countdown-delay", async () => {
		try {
			const content = await fs.readFile(COUNTDOWN_SETTINGS_FILE, "utf-8");
			const parsed = JSON.parse(content) as { delay?: number };
			return { success: true, delay: parsed.delay ?? 3 };
		} catch {
			return { success: true, delay: 3 };
		}
	});

	ipcMain.handle("set-countdown-delay", async (_, delay: number) => {
		try {
			await fs.writeFile(COUNTDOWN_SETTINGS_FILE, JSON.stringify({ delay }, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save countdown delay:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("start-countdown", async (_, seconds: number) => {
		if (countdownInProgress) {
			return { success: false, error: "Countdown already in progress" };
		}

		countdownInProgress = true;
		countdownCancelled = false;

		const countdownWin = createCountdownWindow();

		await new Promise<void>((resolve) => {
			countdownWin.webContents.once("did-finish-load", () => {
				resolve();
			});
		});

		return new Promise<{ success: boolean; cancelled?: boolean }>((resolve) => {
			let remaining = seconds;

			countdownWin.webContents.send("countdown-tick", remaining);

			countdownTimer = setInterval(() => {
				if (countdownCancelled) {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					closeCountdownWindow();
					countdownInProgress = false;
					resolve({ success: false, cancelled: true });
					return;
				}

				remaining--;

				if (remaining <= 0) {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					closeCountdownWindow();
					countdownInProgress = false;
					resolve({ success: true });
				} else {
					const win = getCountdownWindow();
					if (win && !win.isDestroyed()) {
						win.webContents.send("countdown-tick", remaining);
					}
				}
			}, 1000);
		});
	});

	ipcMain.handle("cancel-countdown", () => {
		countdownCancelled = true;
		countdownInProgress = false;
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		closeCountdownWindow();
		return { success: true };
	});

	// ---------------------------------------------------------------------------
	// HUD settings (full settings object)
	// ---------------------------------------------------------------------------
	ipcMain.handle("get-hud-settings", async () => {
		try {
			const content = await fs.readFile(HUD_SETTINGS_FILE, "utf-8");
			const parsed = JSON.parse(content) as Record<string, unknown>;
			return { success: true, settings: parsed };
		} catch {
			return { success: true, settings: null };
		}
	});

	ipcMain.handle("set-hud-settings", async (_, settings: Record<string, unknown>) => {
		try {
			await fs.writeFile(HUD_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save HUD settings:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("open-speaker-notes-window", async (_, payload: { text: string }) => {
		try {
			createSpeakerNotesWindow(payload.text ?? "");
			return { success: true };
		} catch (error) {
			console.error("Failed to open speaker notes window:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("update-speaker-notes-window", async (_, payload: { text: string }) => {
		try {
			updateSpeakerNotesWindow(payload.text ?? "");
			return { success: true };
		} catch (error) {
			console.error("Failed to update speaker notes window:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("close-speaker-notes-window", () => {
		closeSpeakerNotesWindow();
		return { success: true };
	});

	// ---------------------------------------------------------------------------
	// Display info
	// ---------------------------------------------------------------------------
	ipcMain.handle("get-display-info", () => {
		const electronScreen = nodeRequire("electron").screen as typeof import("electron").screen;
		const displays = electronScreen.getAllDisplays();
		return {
			success: true,
			displays: displays.map((d) => ({
				id: d.id,
				label: d.label || `Display ${d.id}`,
				x: d.bounds.x,
				y: d.bounds.y,
				width: d.size.width,
				height: d.size.height,
				refreshRate: d.displayFrequency || 60,
			})),
		};
	});

	// ---------------------------------------------------------------------------
	// Area overlay
	// ---------------------------------------------------------------------------
	ipcMain.handle("create-area-overlay", (_, displayId?: number) => {
		createAreaOverlayWindow(displayId);
		return { success: true };
	});

	ipcMain.handle("close-area-overlay", () => {
		closeAreaOverlayWindow();
		return { success: true };
	});

	// ---------------------------------------------------------------------------
	// Desktop icons (macOS only)
	// ---------------------------------------------------------------------------
	ipcMain.handle("hide-desktop-icons", async () => {
		if (process.platform !== "darwin") {
			return { success: false, error: "Only supported on macOS" };
		}
		try {
			await execFileAsync("defaults", [
				"write",
				"com.apple.finder",
				"CreateDesktop",
				"-bool",
				"false",
			]);
			await execFileAsync("killall", ["Finder"]);
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("show-desktop-icons", async () => {
		if (process.platform !== "darwin") {
			return { success: false, error: "Only supported on macOS" };
		}
		try {
			await execFileAsync("defaults", [
				"write",
				"com.apple.finder",
				"CreateDesktop",
				"-bool",
				"true",
			]);
			await execFileAsync("killall", ["Finder"]);
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	// ---------------------------------------------------------------------------
	// Dock icon (macOS only)
	// ---------------------------------------------------------------------------
	ipcMain.handle("hide-dock-icon", () => {
		if (process.platform === "darwin") {
			app.dock?.hide?.();
		}
		return { success: true };
	});

	ipcMain.handle("show-dock-icon", () => {
		if (process.platform === "darwin") {
			void app.dock?.show?.();
		}
		return { success: true };
	});

	// ---------------------------------------------------------------------------
	// Area overlay lock state (locked = click-through preview during recording)
	// ---------------------------------------------------------------------------
	ipcMain.handle("lock-area-overlay", () => {
		lockAreaOverlayWindow();
		return { success: true };
	});

	ipcMain.handle("unlock-area-overlay", () => {
		unlockAreaOverlayWindow();
		return { success: true };
	});
}
