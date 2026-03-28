import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const brandDir = path.join(rootDir, "branding", "source-assets");
const markSvg = path.join(brandDir, "ScreenMint-Mark.svg");
const lockupSvg = path.join(brandDir, "ScreenMint.svg");
const tempDir = path.join(rootDir, ".tmp", "brand-icons");

const appIconSizes = [16, 32, 64, 128, 256, 512, 1024];
const builderSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

function ensureDir(filePath) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function renderPng(size, outputPath) {
	ensureDir(outputPath);
	execFileSync("sips", ["-z", String(size), String(size), renderedMasterPng, "--out", outputPath], {
		stdio: "inherit",
	});
}

function copyFile(from, to) {
	ensureDir(to);
	fs.copyFileSync(from, to);
}

function rmrf(targetPath) {
	fs.rmSync(targetPath, { recursive: true, force: true });
}

rmrf(tempDir);
fs.mkdirSync(tempDir, { recursive: true });

const renderedMasterPng = path.join(tempDir, "screenmint-master.png");
execFileSync("sips", ["-s", "format", "png", markSvg, "--out", renderedMasterPng], {
	stdio: "inherit",
});

for (const size of appIconSizes) {
	renderPng(size, path.join(brandDir, `${size}-mac.png`));
	renderPng(size, path.join(rootDir, "public", "app-icons", `screenmint-${size}.png`));
}

for (const size of builderSizes) {
	renderPng(size, path.join(rootDir, "icons", "icons", "png", `${size}x${size}.png`));
}

renderPng(32, path.join(rootDir, "website", "public", "images", "screenmint-32.png"));
copyFile(lockupSvg, path.join(rootDir, "website", "public", "images", "screenmint-logo.svg"));

execFileSync(
	"npx",
	[
		"icon-gen",
		"-i",
		markSvg,
		"-o",
		tempDir,
		"--ico",
		"--ico-name",
		"icon",
		"--ico-sizes",
		builderSizes.join(","),
		"--icns",
		"--icns-name",
		"icon",
		"--icns-sizes",
		[16, 32, 64, 128, 256, 512, 1024].join(","),
	],
	{ stdio: "inherit" },
);

copyFile(path.join(tempDir, "icon.ico"), path.join(rootDir, "icons", "icons", "win", "icon.ico"));
copyFile(path.join(tempDir, "icon.icns"), path.join(rootDir, "icons", "icons", "mac", "icon.icns"));

console.log("ScreenMint brand assets regenerated.");
