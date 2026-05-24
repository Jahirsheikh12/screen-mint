import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, ipcMain } from "electron";
import { type HostValidationReport, IPC_CHANNELS } from "../../src/electron-ipc/contracts";

function helperExists(relativePath: string) {
	try {
		return fs.existsSync(path.join(app.getAppPath(), relativePath));
	} catch {
		return false;
	}
}

function collectHelpers(platform: NodeJS.Platform, arch: string): Record<string, boolean> {
	if (platform === "darwin") {
		const archTag = arch === "arm64" ? "darwin-arm64" : "darwin-x64";
		return {
			screenCaptureKit: helperExists(
				`electron/native/bin/${archTag}/screenmint-screencapturekit-helper`,
			),
			windowList: helperExists(`electron/native/bin/${archTag}/screenmint-window-list`),
			cursorMonitor: helperExists(
				`electron/native/bin/${archTag}/screenmint-native-cursor-monitor`,
			),
		};
	}
	if (platform === "win32") {
		return {
			wgcSource: helperExists("electron/native/wgc-capture/CMakeLists.txt"),
			cursorMonitorSource: helperExists("electron/native/cursor-monitor/CMakeLists.txt"),
		};
	}
	return {
		chromiumCaptureFallback: true,
		nativeWindowLayerCapture: false,
	};
}

export function registerHostValidationIpcHandlers() {
	ipcMain.handle(IPC_CHANNELS.hostValidation.getReport, (): HostValidationReport => {
		const platform = process.platform;
		return {
			generatedAt: new Date().toISOString(),
			platform,
			arch: process.arch,
			osRelease: os.release(),
			helpers: collectHelpers(platform, process.arch),
			checklist: [
				"display recording",
				"window recording",
				"area recording",
				"microphone audio",
				"mixed audio",
				"cursor telemetry",
				"webcam",
				"captions",
				"audio regions",
				"project save/reopen",
				"MP4 export",
				"GIF export",
				"export cancel",
				"recordings-folder export",
			].map((name) => ({ name, status: "PENDING" as const, notes: "" })),
			knownLimitations:
				platform === "linux"
					? ["Linux independent window layers are best-effort until native capture is added."]
					: [],
		};
	});
}
