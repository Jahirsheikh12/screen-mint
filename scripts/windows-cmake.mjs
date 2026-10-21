import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

// Newest first. `null` lets CMake pick the newest Visual Studio it finds, so a new runner image
// keeps working without a script change.
const VISUAL_STUDIO_GENERATORS = [
	null,
	"Visual Studio 18 2026",
	"Visual Studio 17 2022",
	"Visual Studio 16 2019",
];
const VISUAL_STUDIO_INSTALL_DIRS = ["18", "2022"];
const VISUAL_STUDIO_EDITIONS = ["Community", "Professional", "Enterprise", "BuildTools"];

/** CMake from PATH, or the copy bundled with Visual Studio. */
export function findCmake() {
	try {
		execSync("cmake --version", { stdio: "pipe" });
		return "cmake";
	} catch {
		// not on PATH
	}

	for (const version of VISUAL_STUDIO_INSTALL_DIRS) {
		for (const edition of VISUAL_STUDIO_EDITIONS) {
			const cmakePath = path.join(
				"C:",
				"Program Files",
				"Microsoft Visual Studio",
				version,
				edition,
				"Common7",
				"IDE",
				"CommonExtensions",
				"Microsoft",
				"CMake",
				"CMake",
				"bin",
				"cmake.exe",
			);
			if (existsSync(cmakePath)) {
				return `"${cmakePath}"`;
			}
		}
	}

	return null;
}

/**
 * Configures `buildDir` for x64 with the first Visual Studio generator that works.
 * Returns false when none does. A failed attempt leaves a cache naming its generator,
 * which CMake refuses to switch from, so the cache is cleared before every try.
 */
export function configureVisualStudio(cmake, buildDir, label) {
	for (const generator of VISUAL_STUDIO_GENERATORS) {
		rmSync(path.join(buildDir, "CMakeCache.txt"), { force: true });
		rmSync(path.join(buildDir, "CMakeFiles"), { recursive: true, force: true });
		const generatorArg = generator ? ` -G "${generator}"` : "";
		console.log(`[${label}] Configuring CMake (${generator ?? "default generator"})...`);
		try {
			execSync(`${cmake} ..${generatorArg} -A x64`, {
				cwd: buildDir,
				stdio: "inherit",
				timeout: 120000,
			});
			return true;
		} catch {
			// try the next generator
		}
	}
	return false;
}
