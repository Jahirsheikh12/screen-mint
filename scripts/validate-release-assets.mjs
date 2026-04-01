#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const targetDir = path.resolve(process.argv[2] || "release-assets");
const requiredMetadataFiles = [
	"latest.yml",
	"latest-linux.yml",
	"latest-mac.yml",
	"latest-mac-arm64.yml",
];

function normalizeYamlValue(rawValue) {
	return rawValue.trim().replace(/^['"]|['"]$/g, "");
}

function extractReferencedFiles(content) {
	const references = new Set();
	const lines = content.split(/\r?\n/);

	for (const line of lines) {
		const match = line.match(/^\s*(?:path|url):\s*(.+)\s*$/);
		if (!match) {
			continue;
		}

		const normalized = normalizeYamlValue(match[1]);
		if (!normalized || normalized.startsWith("http://") || normalized.startsWith("https://")) {
			continue;
		}

		references.add(path.basename(normalized));
	}

	return [...references];
}

async function main() {
	const entries = await fs.readdir(targetDir);
	const entrySet = new Set(entries);

	for (const metadataFile of requiredMetadataFiles) {
		if (!entrySet.has(metadataFile)) {
			throw new Error(`Missing updater metadata file: ${metadataFile}`);
		}
	}

	for (const metadataFile of requiredMetadataFiles) {
		const metadataPath = path.join(targetDir, metadataFile);
		const content = await fs.readFile(metadataPath, "utf-8");
		const references = extractReferencedFiles(content);

		if (references.length === 0) {
			throw new Error(`No installer references found in ${metadataFile}`);
		}

		for (const reference of references) {
			if (!entrySet.has(reference)) {
				throw new Error(`${metadataFile} references missing asset: ${reference}`);
			}
		}
	}

	console.log("Validated release updater assets in", targetDir);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
