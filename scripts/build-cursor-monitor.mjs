import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { configureVisualStudio, findCmake } from "./windows-cmake.mjs";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "electron", "native", "cursor-monitor");
const buildDir = path.join(sourceDir, "build");

if (process.platform !== "win32") {
	console.log("[build-cursor-monitor] Skipping: host platform is not Windows.");
	process.exit(0);
}

if (!existsSync(path.join(sourceDir, "CMakeLists.txt"))) {
	console.error("[build-cursor-monitor] CMakeLists.txt not found at", sourceDir);
	process.exit(1);
}

const cmake = findCmake();
if (!cmake) {
	console.error(
		"[build-cursor-monitor] CMake not found. Install Visual Studio with C++ CMake tools or standalone CMake.",
	);
	process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

if (!configureVisualStudio(cmake, buildDir, "build-cursor-monitor")) {
	console.error(
		"[build-cursor-monitor] CMake configure failed: no usable Visual Studio generator.",
	);
	process.exit(1);
}

console.log("[build-cursor-monitor] Building...");
try {
	execSync(`${cmake} --build . --config Release`, {
		cwd: buildDir,
		stdio: "inherit",
		timeout: 300000,
	});
} catch (error) {
	console.error("[build-cursor-monitor] Build failed:", error.message);
	process.exit(1);
}

const exePath = path.join(buildDir, "Release", "cursor-monitor.exe");
if (existsSync(exePath)) {
	console.log(`[build-cursor-monitor] Built successfully: ${exePath}`);
} else {
	console.error("[build-cursor-monitor] Expected exe not found at", exePath);
	process.exit(1);
}
