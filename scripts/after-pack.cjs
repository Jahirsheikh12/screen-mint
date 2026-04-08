const fs = require("node:fs/promises");
const path = require("node:path");

const MB = 1024 * 1024;
const allowedMacLocaleDirs = new Set(["en.lproj", "en_GB.lproj", "es.lproj", "es_419.lproj"]);
const allowedDesktopLocaleFiles = new Set(["en-US.pak", "en-GB.pak", "es.pak", "es-419.pak"]);
const uiohookPlatformPrefixes = {
	darwin: "darwin-",
	linux: "linux-",
	win32: "win32-",
};

async function exists(targetPath) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function getFileSizeBytes(filePath) {
	try {
		return (await fs.stat(filePath)).size;
	} catch {
		return 0;
	}
}

async function getDirectorySizeBytes(dirPath) {
	const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
	let total = 0;

	for (const entry of entries) {
		const entryPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			total += await getDirectorySizeBytes(entryPath);
			continue;
		}

		if (entry.isFile()) {
			total += (await fs.stat(entryPath)).size;
		}
	}

	return total;
}

function formatBytes(bytes) {
	return `${(bytes / MB).toFixed(1)} MB`;
}

async function resolvePackagedAppRoot(appOutDir, platformName) {
	if (platformName !== "darwin" || appOutDir.endsWith(".app")) {
		return appOutDir;
	}

	const entries = await fs.readdir(appOutDir, { withFileTypes: true }).catch(() => []);
	const appBundle = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
	return appBundle ? path.join(appOutDir, appBundle.name) : appOutDir;
}

async function pruneMacLocales(resourcesDir) {
	const entries = await fs.readdir(resourcesDir, { withFileTypes: true }).catch(() => []);

	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.endsWith(".lproj")) {
			continue;
		}

		if (!allowedMacLocaleDirs.has(entry.name)) {
			await fs.rm(path.join(resourcesDir, entry.name), {
				recursive: true,
				force: true,
			});
		}
	}

	let localeBytes = 0;
	for (const localeDir of allowedMacLocaleDirs) {
		localeBytes += await getDirectorySizeBytes(path.join(resourcesDir, localeDir));
	}

	return localeBytes;
}

async function pruneDesktopLocales(resourcesDir) {
	const localesDir = path.join(resourcesDir, "locales");
	const entries = await fs.readdir(localesDir, { withFileTypes: true }).catch(() => []);

	for (const entry of entries) {
		if (!entry.isFile()) {
			continue;
		}

		if (!allowedDesktopLocaleFiles.has(entry.name)) {
			await fs.rm(path.join(localesDir, entry.name), { force: true });
		}
	}

	return getDirectorySizeBytes(localesDir);
}

async function pruneUiohookPrebuilds(resourcesDir, platformName) {
	const keepPrefix = uiohookPlatformPrefixes[platformName];
	if (!keepPrefix) {
		return;
	}

	const prebuildsDir = path.join(
		resourcesDir,
		"app.asar.unpacked",
		"node_modules",
		"uiohook-napi",
		"prebuilds",
	);

	const entries = await fs.readdir(prebuildsDir, { withFileTypes: true }).catch(() => []);

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		if (!entry.name.startsWith(keepPrefix)) {
			await fs.rm(path.join(prebuildsDir, entry.name), { recursive: true, force: true });
		}
	}
}

module.exports = async function afterPack(context) {
	const platformName =
		context.electronPlatformName || context.packager?.platform?.nodeName || process.platform;
	const packagedAppDir = await resolvePackagedAppRoot(context.appOutDir, platformName);
	const projectDir = context.packager.projectDir;
	const resourcesDir =
		platformName === "darwin"
			? path.join(packagedAppDir, "Contents", "Resources")
			: path.join(packagedAppDir, "resources");

	await pruneUiohookPrebuilds(resourcesDir, platformName);

	const localeBytes =
		platformName === "darwin"
			? await pruneMacLocales(resourcesDir)
			: await pruneDesktopLocales(resourcesDir);

	const report = {
		platform: platformName,
		appOutDir: packagedAppDir,
		distBytes: await getDirectorySizeBytes(path.join(projectDir, "dist")),
		appAsarBytes: await getFileSizeBytes(path.join(resourcesDir, "app.asar")),
		extraResourcesBytes: await getDirectorySizeBytes(path.join(resourcesDir, "assets")),
		wallpaperPackBytes: await getDirectorySizeBytes(
			path.join(resourcesDir, "assets", "wallpapers"),
		),
		backgroundMusicPackBytes: await getDirectorySizeBytes(
			path.join(resourcesDir, "assets", "background-music"),
		),
		localeBytes,
		totalUncompressedAppBytes: await getDirectorySizeBytes(packagedAppDir),
	};

	const failures = [];
	if (report.distBytes > 80 * MB) {
		failures.push(`dist exceeds 80 MB (${formatBytes(report.distBytes)})`);
	}

	if (report.appAsarBytes > 275 * MB) {
		failures.push(`app.asar exceeds 275 MB (${formatBytes(report.appAsarBytes)})`);
	}

	if (report.localeBytes > 6 * MB) {
		failures.push(`locale payload exceeds 6 MB (${formatBytes(report.localeBytes)})`);
	}

	if (platformName === "darwin" && report.totalUncompressedAppBytes > 800 * MB) {
		failures.push(
			`macOS uncompressed app footprint exceeds 800 MB (${formatBytes(
				report.totalUncompressedAppBytes,
			)})`,
		);
	}

	await fs.mkdir(path.join(projectDir, "release"), { recursive: true });
	const reportName = `size-audit-${platformName}-${path.basename(path.dirname(packagedAppDir))}.json`;
	await fs.writeFile(
		path.join(projectDir, "release", reportName),
		JSON.stringify(report, null, 2),
		"utf8",
	);

	console.log("[after-pack] Size audit", {
		platform: report.platform,
		dist: formatBytes(report.distBytes),
		appAsar: formatBytes(report.appAsarBytes),
		extraResources: formatBytes(report.extraResourcesBytes),
		wallpapers: formatBytes(report.wallpaperPackBytes),
		backgroundMusic: formatBytes(report.backgroundMusicPackBytes),
		locales: formatBytes(report.localeBytes),
		total: formatBytes(report.totalUncompressedAppBytes),
	});

	if (failures.length > 0) {
		throw new Error(failures.join("; "));
	}

	if (!(await exists(path.join(resourcesDir, "assets")))) {
		throw new Error("Generated packaged assets are missing from the app bundle.");
	}
};
