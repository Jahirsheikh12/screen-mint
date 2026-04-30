#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static");

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, ".tmp", "packaged-assets");
const outputAssetsRoot = path.join(outputRoot, "assets");
const wallpaperSourceDir = path.join(projectRoot, "public", "wallpapers");
const wallpaperOutputDir = path.join(outputAssetsRoot, "wallpapers");
const wallpaperThumbSourceDir = path.join(wallpaperSourceDir, "thumbs");
const wallpaperThumbOutputDir = path.join(wallpaperOutputDir, "thumbs");
const mediapipeSourceDir = path.join(projectRoot, "public", "mediapipe");
const mediapipeOutputDir = path.join(outputAssetsRoot, "mediapipe");
const modelsSourceDir = path.join(projectRoot, "public", "models");
const modelsOutputDir = path.join(outputAssetsRoot, "models");
const backgroundMusicSourceDir = path.join(projectRoot, "src", "assets", "audio");
const backgroundMusicOutputDir = path.join(outputAssetsRoot, "background-music");

const wallpaperExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const audioExtensions = new Set([".mp3"]);
const packagedBackgroundMusicFiles = new Set([
	"mixkit-driving-ambition-32.mp3",
	"mixkit-serene-view-443.mp3",
	"mixkit-beautiful-dream-493.mp3",
	"mixkit-cbpd-400.mp3",
	"mixkit-tech-house-vibes-130.mp3",
	"mixkit-hazy-after-hours-132.mp3",
	"mixkit-cant-get-you-off-my-mind-1210.mp3",
	"mixkit-hip-hop-02-738.mp3",
]);
const maxWallpaperEdge = 2560;
const jpegQuality = 78;
const webpQuality = 78;
const audioBitrate = "128k";

function formatBytes(bytes) {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${bytes} B`;
}

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

function runCommand(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		let stdout = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}

			reject(new Error(stderr.trim() || stdout.trim() || `Command failed with code ${code}`));
		});
	});
}

async function writeSmallerFile(originalPath, generatedBuffer, outputPath) {
	const originalBuffer = await readFile(originalPath);
	await mkdir(path.dirname(outputPath), { recursive: true });

	if (generatedBuffer.length >= originalBuffer.length) {
		await writeFile(outputPath, originalBuffer);
		return {
			originalBytes: originalBuffer.length,
			outputBytes: originalBuffer.length,
			usedOriginal: true,
		};
	}

	await writeFile(outputPath, generatedBuffer);
	return {
		originalBytes: originalBuffer.length,
		outputBytes: generatedBuffer.length,
		usedOriginal: false,
	};
}

async function optimizeWallpaper(inputPath, outputPath) {
	const extension = path.extname(inputPath).toLowerCase();
	const transformer = sharp(inputPath, { limitInputPixels: false }).rotate().resize({
		width: maxWallpaperEdge,
		height: maxWallpaperEdge,
		fit: "inside",
		withoutEnlargement: true,
	});

	let outputBuffer;
	switch (extension) {
		case ".jpg":
		case ".jpeg":
			outputBuffer = await transformer
				.jpeg({
					quality: jpegQuality,
					mozjpeg: true,
					chromaSubsampling: "4:2:0",
				})
				.toBuffer();
			break;
		case ".png":
			outputBuffer = await transformer
				.png({
					compressionLevel: 9,
					effort: 10,
					palette: true,
				})
				.toBuffer();
			break;
		case ".webp":
			outputBuffer = await transformer
				.webp({
					quality: webpQuality,
					effort: 6,
				})
				.toBuffer();
			break;
		default: {
			await mkdir(path.dirname(outputPath), { recursive: true });
			await cp(inputPath, outputPath);
			const originalBytes = (await stat(inputPath)).size;
			return { originalBytes, outputBytes: originalBytes, usedOriginal: true };
		}
	}

	return writeSmallerFile(inputPath, outputBuffer, outputPath);
}

async function optimizeBackgroundMusic(inputPath, outputPath) {
	const extension = path.extname(inputPath).toLowerCase();
	await mkdir(path.dirname(outputPath), { recursive: true });

	if (!ffmpegStatic || extension !== ".mp3") {
		await cp(inputPath, outputPath);
		const originalBytes = (await stat(inputPath)).size;
		return { originalBytes, outputBytes: originalBytes, usedOriginal: true };
	}

	const tempOutputPath = `${outputPath}.tmp${extension}`;
	await rm(tempOutputPath, { force: true });

	try {
		await runCommand(ffmpegStatic, [
			"-hide_banner",
			"-loglevel",
			"error",
			"-y",
			"-i",
			inputPath,
			"-vn",
			"-codec:a",
			"libmp3lame",
			"-b:a",
			audioBitrate,
			"-map_metadata",
			"-1",
			tempOutputPath,
		]);

		const [originalStats, generatedStats] = await Promise.all([
			stat(inputPath),
			stat(tempOutputPath),
		]);

		if (generatedStats.size >= originalStats.size) {
			await cp(inputPath, outputPath);
			return {
				originalBytes: originalStats.size,
				outputBytes: originalStats.size,
				usedOriginal: true,
			};
		}

		await cp(tempOutputPath, outputPath);
		return {
			originalBytes: originalStats.size,
			outputBytes: generatedStats.size,
			usedOriginal: false,
		};
	} finally {
		await rm(tempOutputPath, { force: true });
	}
}

async function optimizeDirectory(sourceDir, outputDir, extensions, optimizeFile, includeFile) {
	const entries = await readdir(sourceDir, { withFileTypes: true });
	let originalBytes = 0;
	let outputBytes = 0;
	let usedOriginalCount = 0;
	let processedCount = 0;

	for (const entry of entries) {
		if (!entry.isFile()) {
			continue;
		}

		const extension = path.extname(entry.name).toLowerCase();
		if (!extensions.has(extension)) {
			continue;
		}

		if (includeFile && !includeFile(entry.name)) {
			continue;
		}

		processedCount += 1;
		const inputPath = path.join(sourceDir, entry.name);
		const outputPath = path.join(outputDir, entry.name);
		const result = await optimizeFile(inputPath, outputPath);

		originalBytes += result.originalBytes;
		outputBytes += result.outputBytes;
		if (result.usedOriginal) {
			usedOriginalCount += 1;
		}
	}

	return { originalBytes, outputBytes, processedCount, usedOriginalCount };
}

async function copyDirectory(sourceDir, outputDir) {
	if (!(await stat(sourceDir).catch(() => null))) {
		return 0;
	}

	await rm(outputDir, { recursive: true, force: true });
	await mkdir(path.dirname(outputDir), { recursive: true });
	await cp(sourceDir, outputDir, { recursive: true });
	return getDirectorySizeBytes(outputDir);
}

async function copyWallpaperThumbs() {
	// Thumbs are already tiny WebPs (~3 KB each) generated by
	// scripts/generate-wallpaper-thumbs.mjs. Copy them through as-is; there is
	// no benefit to re-optimizing them, and they must live next to the full
	// wallpapers so the SettingsPanel preview grid can resolve them.
	if (!(await stat(wallpaperThumbSourceDir).catch(() => null))) {
		return { processedCount: 0, outputBytes: 0, usedOriginalCount: 0, originalBytes: 0 };
	}

	await mkdir(wallpaperThumbOutputDir, { recursive: true });
	const entries = await readdir(wallpaperThumbSourceDir, { withFileTypes: true });
	let processedCount = 0;
	let outputBytes = 0;

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const sourcePath = path.join(wallpaperThumbSourceDir, entry.name);
		const destPath = path.join(wallpaperThumbOutputDir, entry.name);
		await cp(sourcePath, destPath);
		outputBytes += (await stat(destPath)).size;
		processedCount += 1;
	}

	return {
		processedCount,
		outputBytes,
		usedOriginalCount: processedCount,
		originalBytes: outputBytes,
	};
}

async function main() {
	await rm(outputRoot, { recursive: true, force: true });
	await mkdir(wallpaperOutputDir, { recursive: true });
	await mkdir(backgroundMusicOutputDir, { recursive: true });

	const [wallpaperStats, backgroundMusicStats, wallpaperThumbStats, mediapipeBytes, modelsBytes] =
		await Promise.all([
			optimizeDirectory(
				wallpaperSourceDir,
				wallpaperOutputDir,
				wallpaperExtensions,
				optimizeWallpaper,
			),
			optimizeDirectory(
				backgroundMusicSourceDir,
				backgroundMusicOutputDir,
				audioExtensions,
				optimizeBackgroundMusic,
				(fileName) => packagedBackgroundMusicFiles.has(fileName),
			),
			copyWallpaperThumbs(),
			copyDirectory(mediapipeSourceDir, mediapipeOutputDir),
			copyDirectory(modelsSourceDir, modelsOutputDir),
		]);

	const manifest = {
		generatedAt: new Date().toISOString(),
		wallpapers: wallpaperStats,
		wallpaperThumbs: wallpaperThumbStats,
		backgroundMusic: backgroundMusicStats,
		mediapipeBytes,
		modelsBytes,
		totalBytes: await getDirectorySizeBytes(outputAssetsRoot),
	};

	await writeFile(
		path.join(outputRoot, "manifest.json"),
		JSON.stringify(manifest, null, 2),
		"utf8",
	);

	console.log(
		`[build-packaged-assets] Wallpapers: ${wallpaperStats.processedCount} files, ${formatBytes(
			wallpaperStats.originalBytes,
		)} -> ${formatBytes(wallpaperStats.outputBytes)} (${wallpaperStats.usedOriginalCount} kept original)`,
	);
	console.log(
		`[build-packaged-assets] Wallpaper thumbs: ${wallpaperThumbStats.processedCount} files, ` +
			`${formatBytes(wallpaperThumbStats.outputBytes)} copied`,
	);
	console.log(
		`[build-packaged-assets] Background music: ${backgroundMusicStats.processedCount} files, ${formatBytes(
			backgroundMusicStats.originalBytes,
		)} -> ${formatBytes(backgroundMusicStats.outputBytes)} (${backgroundMusicStats.usedOriginalCount} kept original)`,
	);
	console.log(`[build-packaged-assets] MediaPipe runtime: ${formatBytes(mediapipeBytes)} copied`);
	console.log(`[build-packaged-assets] Webcam models: ${formatBytes(modelsBytes)} copied`);
	console.log(
		`[build-packaged-assets] Output ready at ${outputAssetsRoot} (${formatBytes(manifest.totalBytes)})`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
