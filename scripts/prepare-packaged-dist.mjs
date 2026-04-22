#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const duplicateWallpaperDir = path.join(distDir, "wallpapers");
const duplicateMediapipeDir = path.join(distDir, "mediapipe");
const duplicateModelsDir = path.join(distDir, "models");

async function getDirectorySizeBytes(dirPath) {
	const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
	let total = 0;

	for (const entry of entries) {
		const entryPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			total += await getDirectorySizeBytes(entryPath);
			continue;
		}

		if (entry.isFile()) {
			total += (await stat(entryPath)).size;
		}
	}

	return total;
}

function formatBytes(bytes) {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${bytes} B`;
}

async function main() {
	await rm(duplicateWallpaperDir, { recursive: true, force: true });
	await rm(duplicateMediapipeDir, { recursive: true, force: true });
	await rm(duplicateModelsDir, { recursive: true, force: true });

	const distSizeBytes = await getDirectorySizeBytes(distDir);
	console.log(
		`[prepare-packaged-dist] Removed duplicate packaged assets from dist (wallpapers, mediapipe, models). Final dist size: ${formatBytes(
			distSizeBytes,
		)}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
