#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const docsToCheck = ["docs/ASSET_PROVENANCE.md", "THIRD_PARTY_NOTICES.md", "LICENSE-UPSTREAM"];

const unresolvedPatterns = [
	/needs provenance review/i,
	/must be verified/i,
	/verify upstream license/i,
	/confirm redistribution/i,
	/license confirmation/i,
	/before beta release/i,
];

async function main() {
	const findings = [];

	for (const relativePath of docsToCheck) {
		const filePath = path.join(projectRoot, relativePath);
		const content = await fs.readFile(filePath, "utf-8");
		const lines = content.split(/\r?\n/);

		lines.forEach((line, index) => {
			if (unresolvedPatterns.some((pattern) => pattern.test(line))) {
				findings.push(`${relativePath}:${index + 1}: ${line.trim()}`);
			}
		});
	}

	if (findings.length > 0) {
		throw new Error(
			[
				"Asset provenance is not release-ready.",
				"Every bundled asset group must have documented source, license, redistribution status, and proof location before publishing.",
				...findings.map((finding) => `- ${finding}`),
			].join("\n"),
		);
	}

	console.log("Asset provenance is release-ready.");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
