import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

const appBundles = process.argv.slice(2);

if (appBundles.length === 0) {
	console.error(
		"[validate-mac-bundle] Provide one or more macOS .app bundle paths, for example release/mac/ScreenMint.app",
	);
	process.exit(1);
}

const helperNames = new Set([
	"screenmint-screencapturekit-helper",
	"screenmint-window-list",
	"screenmint-window-bounds-monitor",
	"screenmint-system-cursors",
	"screenmint-native-cursor-monitor",
	"screenmint-apple-speech-helper",
]);

async function pathExists(targetPath) {
	try {
		await access(targetPath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function runCodesignDetails(targetPath) {
	return spawnSync("codesign", ["-dv", "--verbose=4", targetPath], {
		encoding: "utf8",
	});
}

function assertSigned(targetPath, label) {
	const result = runCodesignDetails(targetPath);
	const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
	if (result.status !== 0 || output.includes("not signed at all")) {
		throw new Error(`[validate-mac-bundle] ${label} is unsigned: ${targetPath}\n${output}`.trim());
	}
}

async function validateAppBundle(appBundlePath) {
	const resolvedAppPath = path.resolve(appBundlePath);
	if (!(await pathExists(resolvedAppPath))) {
		throw new Error(`[validate-mac-bundle] App bundle not found: ${resolvedAppPath}`);
	}

	assertSigned(resolvedAppPath, "App bundle");

	const helpersRoot = path.join(
		resolvedAppPath,
		"Contents",
		"Resources",
		"app.asar.unpacked",
		"electron",
		"native",
		"bin",
	);

	if (!(await pathExists(helpersRoot))) {
		throw new Error(`[validate-mac-bundle] Embedded helper directory not found: ${helpersRoot}`);
	}

	const helperPaths = Array.from(helperNames).flatMap((helperName) => [
		path.join(helpersRoot, "darwin-arm64", helperName),
		path.join(helpersRoot, "darwin-x64", helperName),
	]);

	const existingHelpers = [];
	for (const helperPath of helperPaths) {
		if (await pathExists(helperPath)) {
			existingHelpers.push(helperPath);
		}
	}

	if (existingHelpers.length === 0) {
		throw new Error(
			`[validate-mac-bundle] No embedded ScreenMint helpers found in: ${helpersRoot}`,
		);
	}

	for (const helperPath of existingHelpers) {
		assertSigned(helperPath, "Embedded helper");
	}

	console.log(
		`[validate-mac-bundle] OK: ${resolvedAppPath} (${existingHelpers.length} signed helper binaries)`,
	);
}

for (const appBundle of appBundles) {
	await validateAppBundle(appBundle);
}
