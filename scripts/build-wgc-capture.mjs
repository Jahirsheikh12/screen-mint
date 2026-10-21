import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { configureVisualStudio, findCmake } from "./windows-cmake.mjs";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "electron", "native", "wgc-capture");
const buildDir = path.join(sourceDir, "build");

if (process.platform !== "win32") {
	console.log("[build-wgc-capture] Skipping: host platform is not Windows.");
	process.exit(0);
}

if (!existsSync(path.join(sourceDir, "CMakeLists.txt"))) {
	console.error("[build-wgc-capture] CMakeLists.txt not found at", sourceDir);
	process.exit(1);
}

const cmake = findCmake();
if (!cmake) {
	console.error(
		"[build-wgc-capture] CMake not found. Install Visual Studio with C++ CMake tools or standalone CMake.",
	);
	process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

if (!configureVisualStudio(cmake, buildDir, "build-wgc-capture")) {
	console.error("[build-wgc-capture] CMake configure failed: no usable Visual Studio generator.");
	process.exit(1);
}

console.log("[build-wgc-capture] Building...");
try {
	execSync(`${cmake} --build . --config Release`, {
		cwd: buildDir,
		stdio: "inherit",
		timeout: 300000,
	});
} catch (error) {
	console.error("[build-wgc-capture] Build failed:", error.message);
	process.exit(1);
}

const exePath = path.join(buildDir, "Release", "wgc-capture.exe");
if (existsSync(exePath)) {
	console.log(`[build-wgc-capture] Built successfully: ${exePath}`);
} else {
	console.error("[build-wgc-capture] Expected exe not found at", exePath);
	process.exit(1);
}
