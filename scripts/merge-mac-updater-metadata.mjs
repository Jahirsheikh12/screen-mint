#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function normalizeYamlValue(rawValue) {
	return rawValue.trim().replace(/^['"]|['"]$/g, "");
}

function parseMetadata(content) {
	const metadata = {
		version: "",
		files: [],
		path: "",
		sha512: "",
		releaseDate: "",
	};

	let currentFile = null;
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const fileEntryMatch = line.match(/^- url:\s*(.+)$/);
		if (fileEntryMatch) {
			currentFile = {
				url: normalizeYamlValue(fileEntryMatch[1]),
				sha512: "",
				size: 0,
			};
			metadata.files.push(currentFile);
			continue;
		}

		if (currentFile) {
			const shaMatch = line.match(/^sha512:\s*(.+)$/);
			if (shaMatch) {
				currentFile.sha512 = normalizeYamlValue(shaMatch[1]);
				continue;
			}

			const sizeMatch = line.match(/^size:\s*(.+)$/);
			if (sizeMatch) {
				currentFile.size = Number(normalizeYamlValue(sizeMatch[1]));
				continue;
			}
		}

		const versionMatch = line.match(/^version:\s*(.+)$/);
		if (versionMatch) {
			metadata.version = normalizeYamlValue(versionMatch[1]);
			currentFile = null;
			continue;
		}

		const pathMatch = line.match(/^path:\s*(.+)$/);
		if (pathMatch) {
			metadata.path = normalizeYamlValue(pathMatch[1]);
			currentFile = null;
			continue;
		}

		const rootShaMatch = line.match(/^sha512:\s*(.+)$/);
		if (rootShaMatch) {
			metadata.sha512 = normalizeYamlValue(rootShaMatch[1]);
			currentFile = null;
			continue;
		}

		const releaseDateMatch = line.match(/^releaseDate:\s*(.+)$/);
		if (releaseDateMatch) {
			metadata.releaseDate = normalizeYamlValue(releaseDateMatch[1]);
			currentFile = null;
		}
	}

	return metadata;
}

function formatMetadata(metadata) {
	const lines = [`version: ${metadata.version}`, "files:"];
	for (const file of metadata.files) {
		lines.push(`  - url: ${file.url}`);
		lines.push(`    sha512: ${file.sha512}`);
		lines.push(`    size: ${file.size}`);
	}
	lines.push(`path: ${metadata.path}`);
	lines.push(`sha512: ${metadata.sha512}`);
	lines.push(`releaseDate: '${metadata.releaseDate}'`);
	return `${lines.join("\n")}\n`;
}

async function readMetadataFile(filePath) {
	const content = await fs.readFile(filePath, "utf-8");
	return parseMetadata(content);
}

async function main() {
	const [x64MetadataPath, arm64MetadataPath, outputPath] = process.argv.slice(2);
	if (!x64MetadataPath || !arm64MetadataPath || !outputPath) {
		throw new Error(
			"Usage: node scripts/merge-mac-updater-metadata.mjs <x64-metadata> <arm64-metadata> <output>",
		);
	}

	const [x64Metadata, arm64Metadata] = await Promise.all([
		readMetadataFile(path.resolve(x64MetadataPath)),
		readMetadataFile(path.resolve(arm64MetadataPath)),
	]);

	if (!x64Metadata.version || x64Metadata.version !== arm64Metadata.version) {
		throw new Error("macOS updater metadata versions do not match between x64 and arm64 builds");
	}

	const mergedFiles = new Map();
	for (const file of [...x64Metadata.files, ...arm64Metadata.files]) {
		mergedFiles.set(file.url, file);
	}

	const mergedMetadata = {
		version: x64Metadata.version,
		files: [...mergedFiles.values()],
		path: x64Metadata.path,
		sha512: x64Metadata.sha512,
		releaseDate: arm64Metadata.releaseDate || x64Metadata.releaseDate,
	};

	await fs.writeFile(path.resolve(outputPath), formatMetadata(mergedMetadata), "utf-8");
	console.log("Merged macOS updater metadata into", outputPath);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
