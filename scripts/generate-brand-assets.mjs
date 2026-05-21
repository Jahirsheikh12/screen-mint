import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const brandDir = path.join(rootDir, "branding", "source-assets");
const markPng = path.join(brandDir, "ScreenMint-Mark.png");
const tempDir = path.join(rootDir, ".tmp", "brand-icons");
const iconPngDir = path.join(tempDir, "icon-png");
const windowsPngDir = path.join(tempDir, "win-png");

const appIconSizes = [16, 32, 64, 128, 256, 512, 1024];
const builderSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const websiteFaviconSizes = [16, 32, 48, 64, 180];
const windowsIconSizes = [16, 24, 32, 48, 64, 128, 256];

function ensureDir(filePath) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function renderPng(size, outputPath) {
	ensureDir(outputPath);
	await sharp(renderedMasterPng)
		.resize(size, size, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toFile(outputPath);
}

function rmrf(targetPath) {
	fs.rmSync(targetPath, { recursive: true, force: true });
}

async function getVisibleBounds(inputPath) {
	const { data, info } = await sharp(inputPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	let minX = info.width;
	let minY = info.height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const alpha = data[(y * info.width + x) * info.channels + 3];
			if (alpha === 0) {
				continue;
			}
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (maxX < minX || maxY < minY) {
		throw new Error(`Logo source has no visible pixels: ${inputPath}`);
	}

	return {
		left: minX,
		top: minY,
		width: maxX - minX + 1,
		height: maxY - minY + 1,
	};
}

async function createTrimmedMasterPng() {
	const bounds = await getVisibleBounds(markPng);
	const { width, height } = bounds;
	const square = Math.max(width, height);
	const left = Math.floor((square - width) / 2);
	const top = Math.floor((square - height) / 2);

	await sharp(markPng)
		.ensureAlpha()
		.extract(bounds)
		.extend({
			top,
			bottom: square - height - top,
			left,
			right: square - width - left,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.resize(1024, 1024, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toFile(renderedMasterPng);
}

async function renderTightWebsiteMark(outputPath) {
	ensureDir(outputPath);
	await sharp(markPng)
		.ensureAlpha()
		.extract(await getVisibleBounds(markPng))
		.resize({ height: 512 })
		.png()
		.toFile(outputPath);
}

async function renderWebsiteFavicon(size) {
	const outputPath = path.join(rootDir, "website", "public", "images", `screenmint-${size}.png`);
	ensureDir(outputPath);
	await sharp(markPng)
		.ensureAlpha()
		.extract(await getVisibleBounds(markPng))
		.resize(size, size, {
			fit: "cover",
			position: "center",
		})
		.sharpen({ sigma: size <= 32 ? 0.6 : 0.4 })
		.png()
		.toFile(outputPath);
}

async function main() {
	rmrf(tempDir);
	fs.mkdirSync(tempDir, { recursive: true });

	await createTrimmedMasterPng();

	for (const size of appIconSizes) {
		await renderPng(size, path.join(brandDir, `${size}-mac.png`));
		await renderPng(size, path.join(rootDir, "public", "app-icons", `screenmint-${size}.png`));
	}

	for (const size of builderSizes) {
		await renderPng(size, path.join(rootDir, "icons", "icons", "png", `${size}x${size}.png`));
		await renderPng(size, path.join(iconPngDir, `${size}.png`));
	}

	for (const size of windowsIconSizes) {
		await renderPng(size, path.join(windowsPngDir, `${size}.png`));
	}

	for (const size of websiteFaviconSizes) {
		await renderWebsiteFavicon(size);
	}

	await renderTightWebsiteMark(
		path.join(rootDir, "website", "public", "images", "screenmint-mark.png"),
	);

	execFileSync(
		"npx",
		[
			"icon-gen",
			"-i",
			iconPngDir,
			"-o",
			tempDir,
			"--icns",
			"--icns-name",
			"icon",
			"--icns-sizes",
			[16, 32, 64, 128, 256, 512, 1024].join(","),
		],
		{ stdio: "inherit" },
	);

	execFileSync(
		"npx",
		[
			"icon-gen",
			"-i",
			windowsPngDir,
			"-o",
			tempDir,
			"--ico",
			"--ico-name",
			"icon",
			"--ico-sizes",
			windowsIconSizes.join(","),
		],
		{ stdio: "inherit" },
	);

	fs.copyFileSync(
		path.join(tempDir, "icon.ico"),
		path.join(rootDir, "icons", "icons", "win", "icon.ico"),
	);
	fs.copyFileSync(
		path.join(tempDir, "icon.icns"),
		path.join(rootDir, "icons", "icons", "mac", "icon.icns"),
	);

	console.log("ScreenMint brand assets regenerated.");
}

const renderedMasterPng = path.join(tempDir, "screenmint-master.png");

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
