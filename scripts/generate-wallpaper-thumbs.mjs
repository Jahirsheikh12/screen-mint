#!/usr/bin/env node

// Generates tiny WebP thumbnails for every built-in wallpaper under
// public/wallpapers/*. The SettingsPanel background picker renders preview
// tiles at ~36×36 px; using these thumbnails instead of the full-resolution
// source images (often 5–12 MB each) avoids the multi-second hitch when
// opening the Background tab.
//
// Run manually with `npm run thumbs:wallpapers`, or it is invoked automatically
// via build-packaged-assets.mjs before a production build.

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "public", "wallpapers");
const outputDir = path.join(sourceDir, "thumbs");

const THUMB_EDGE = 192; // 3× the 64 px tile cap — crisp on retina.
const WEBP_QUALITY = 70;
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function formatBytes(bytes) {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${bytes} B`;
}

async function fileExists(filePath) {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

async function isUpToDate(sourcePath, thumbPath) {
	try {
		const [sourceStat, thumbStat] = await Promise.all([stat(sourcePath), stat(thumbPath)]);
		return thumbStat.mtimeMs >= sourceStat.mtimeMs;
	} catch {
		return false;
	}
}

async function generateThumb(sourcePath, thumbPath) {
	const buffer = await sharp(sourcePath, { limitInputPixels: false })
		.rotate()
		.resize({
			width: THUMB_EDGE,
			height: THUMB_EDGE,
			fit: "cover",
			position: "center",
			withoutEnlargement: false,
		})
		.webp({ quality: WEBP_QUALITY, effort: 5 })
		.toBuffer();

	await writeFile(thumbPath, buffer);
	return buffer.length;
}

async function main() {
	if (!(await fileExists(sourceDir))) {
		console.error(`[generate-wallpaper-thumbs] Source directory missing: ${sourceDir}`);
		process.exit(1);
	}

	await mkdir(outputDir, { recursive: true });

	const entries = await readdir(sourceDir, { withFileTypes: true });
	const wallpaperFiles = entries
		.filter((entry) => entry.isFile())
		.filter((entry) => SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));

	let generated = 0;
	let skipped = 0;
	let totalSourceBytes = 0;
	let totalThumbBytes = 0;

	for (const entry of wallpaperFiles) {
		const sourcePath = path.join(sourceDir, entry.name);
		const thumbName = `${path.parse(entry.name).name}.webp`;
		const thumbPath = path.join(outputDir, thumbName);

		const sourceBytes = (await stat(sourcePath)).size;
		totalSourceBytes += sourceBytes;

		if (await isUpToDate(sourcePath, thumbPath)) {
			totalThumbBytes += (await stat(thumbPath)).size;
			skipped += 1;
			continue;
		}

		const thumbBytes = await generateThumb(sourcePath, thumbPath);
		totalThumbBytes += thumbBytes;
		generated += 1;
	}

	console.log(
		`[generate-wallpaper-thumbs] ${generated} generated, ${skipped} up-to-date. ` +
			`${formatBytes(totalSourceBytes)} → ${formatBytes(totalThumbBytes)}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
