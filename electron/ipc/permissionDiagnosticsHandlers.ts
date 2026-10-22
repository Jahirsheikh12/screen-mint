import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { app, desktopCapturer, ipcMain, shell, systemPreferences } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import type {
	CaptureDiagnostics,
	CapturePermissionState,
	CaptureSourceProbeResult,
	HelperBinaryDiagnostics,
} from "../../src/lib/recording/capturePermissionState";
import type { NativeMacWindowSource } from "./captureSourceHandlers";

type PermissionDiagnosticsOptions = {
	appBundleId: string;
	getAppBundlePath: () => string | null;
	getExpectedApplicationsBundlePath: () => string | null;
	getPrebundledNativeHelperPath: (binaryName: string) => string | null;
	getNativeCaptureHelperSourcePath: () => string;
	getNativeCaptureHelperBinaryPath: () => string;
	getNativeWindowListSourcePath: () => string;
	getNativeWindowListBinaryPath: () => string;
	getNativeWindowBoundsMonitorSourcePath: () => string;
	getNativeWindowBoundsMonitorBinaryPath: () => string;
	getSystemCursorHelperSourcePath: () => string;
	getSystemCursorHelperBinaryPath: () => string;
	getNativeCursorMonitorSourcePath: () => string;
	getNativeCursorMonitorBinaryPath: () => string;
	getNativeMacWindowSources: (options?: { maxAgeMs?: number }) => Promise<NativeMacWindowSource[]>;
};

function getMacPrivacySettingsUrl(pane: "screen" | "accessibility") {
	return pane === "screen"
		? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
		: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
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

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function buildCapturePermissionState(
	options: PermissionDiagnosticsOptions,
): CapturePermissionState {
	const bundlePath = options.getAppBundlePath();
	const expectedBundlePath = options.getExpectedApplicationsBundlePath();
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
		bundleId: process.platform === "darwin" ? options.appBundleId : null,
		inApplicationsFolder: installPathMatchesExpected,
		installPathMatchesExpected,
		screenStatus: getScreenRecordingStatus(),
		microphoneStatus: getMicrophonePermissionStatus(),
		accessibilityTrusted:
			process.platform !== "darwin" ? true : systemPreferences.isTrustedAccessibilityClient(false),
	};
}

async function buildHelperBinaryDiagnostics(
	options: PermissionDiagnosticsOptions,
	name: string,
	sourcePath: string,
	userDataPath: string,
	prebundledBinaryName?: string,
): Promise<HelperBinaryDiagnostics> {
	const prebundledPath = prebundledBinaryName
		? options.getPrebundledNativeHelperPath(prebundledBinaryName)
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

async function probeCaptureSources(
	options: PermissionDiagnosticsOptions,
): Promise<CaptureSourceProbeResult> {
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
			nativeWindowCount = (await options.getNativeMacWindowSources({ maxAgeMs: 0 })).length;
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

async function getCaptureDiagnostics(
	options: PermissionDiagnosticsOptions,
): Promise<CaptureDiagnostics> {
	return {
		permissionState: buildCapturePermissionState(options),
		userDataPath: app.getPath("userData"),
		helperPaths: await Promise.all([
			buildHelperBinaryDiagnostics(
				options,
				"screen capture",
				options.getNativeCaptureHelperSourcePath(),
				options.getNativeCaptureHelperBinaryPath(),
				"screenmint-screencapturekit-helper",
			),
			buildHelperBinaryDiagnostics(
				options,
				"window list",
				options.getNativeWindowListSourcePath(),
				options.getNativeWindowListBinaryPath(),
				"screenmint-window-list",
			),
			buildHelperBinaryDiagnostics(
				options,
				"window bounds monitor",
				options.getNativeWindowBoundsMonitorSourcePath(),
				options.getNativeWindowBoundsMonitorBinaryPath(),
				"screenmint-window-bounds-monitor",
			),
			buildHelperBinaryDiagnostics(
				options,
				"cursor assets",
				options.getSystemCursorHelperSourcePath(),
				options.getSystemCursorHelperBinaryPath(),
				"screenmint-system-cursors",
			),
			buildHelperBinaryDiagnostics(
				options,
				"cursor monitor",
				options.getNativeCursorMonitorSourcePath(),
				options.getNativeCursorMonitorBinaryPath(),
				"screenmint-native-cursor-monitor",
			),
		]),
		sourceProbe: await probeCaptureSources(options),
	};
}

export function registerPermissionDiagnosticsIpcHandlers(options: PermissionDiagnosticsOptions) {
	ipcMain.handle(IPC_CHANNELS.permissions.requestAccessibility, () => {
		if (process.platform !== "darwin") {
			return { success: true, trusted: true, prompted: false };
		}

		return {
			success: true,
			trusted: systemPreferences.isTrustedAccessibilityClient(true),
			prompted: true,
		};
	});

	ipcMain.handle(IPC_CHANNELS.permissions.getCaptureState, async () => {
		return {
			success: true,
			state: buildCapturePermissionState(options),
		};
	});

	ipcMain.handle(IPC_CHANNELS.permissions.requestMicrophone, async () => {
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

	ipcMain.handle(IPC_CHANNELS.permissions.openScreenRecordingPreferences, async () => {
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

	ipcMain.handle(IPC_CHANNELS.permissions.openAccessibilityPreferences, async () => {
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

	ipcMain.handle(IPC_CHANNELS.permissions.getCaptureDiagnostics, async () => {
		try {
			return {
				success: true,
				diagnostics: await getCaptureDiagnostics(options),
			};
		} catch (error) {
			return {
				success: false,
				error: String(error),
			};
		}
	});
}
