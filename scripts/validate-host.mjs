#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();

const CHECKLIST = {
	darwin: [
		"display recording",
		"window recording",
		"area recording",
		"microphone audio",
		"system audio",
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
	],
	win32: [
		"display recording",
		"window recording",
		"area recording",
		"microphone audio",
		"system audio",
		"mixed audio",
		"WGC helper",
		"cursor telemetry",
		"webcam",
		"captions",
		"audio regions",
		"project save/reopen",
		"MP4 export",
		"GIF export",
		"export cancel",
		"recordings-folder export",
	],
	linux: [
		"display recording",
		"window recording",
		"area recording",
		"microphone audio",
		"cursor telemetry limitation",
		"webcam",
		"captions",
		"audio regions",
		"project save/reopen",
		"MP4 export",
		"GIF export",
		"export cancel",
		"recordings-folder export",
	],
};

function exists(relativePath) {
	return fs.existsSync(path.join(projectRoot, relativePath));
}

function collectHelperStatus(platform, arch) {
	if (platform === "darwin") {
		const archTag = arch === "arm64" ? "darwin-arm64" : "darwin-x64";
		return {
			screenCaptureKit: exists(`electron/native/bin/${archTag}/screenmint-screencapturekit-helper`),
			windowList: exists(`electron/native/bin/${archTag}/screenmint-window-list`),
			cursorMonitor: exists(`electron/native/bin/${archTag}/screenmint-native-cursor-monitor`),
		};
	}
	if (platform === "win32") {
		return {
			wgcSource: exists("electron/native/wgc-capture/CMakeLists.txt"),
			cursorMonitorSource: exists("electron/native/cursor-monitor/CMakeLists.txt"),
		};
	}
	return {
		chromiumCaptureFallback: true,
		nativeWindowLayerCapture: false,
	};
}

const platform = process.platform;
const arch = process.arch;
const report = {
	generatedAt: new Date().toISOString(),
	platform,
	arch,
	osRelease: os.release(),
	node: process.version,
	hostname: os.hostname(),
	helpers: collectHelperStatus(platform, arch),
	checklist: (CHECKLIST[platform] ?? CHECKLIST.linux).map((name) => ({
		name,
		status: "PENDING",
		notes: "",
	})),
	knownLimitations:
		platform === "linux"
			? [
					"Linux window layers remain best-effort unless native independent window capture is added.",
					"Cursor hiding/telemetry behavior depends on compositor and Chromium capture support.",
				]
			: [],
};

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && process.argv[outIndex + 1]) {
	const outputPath = path.resolve(projectRoot, process.argv[outIndex + 1]);
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
