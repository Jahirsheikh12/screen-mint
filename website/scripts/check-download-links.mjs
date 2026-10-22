import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(websiteRoot, "..");

const linksFile = readFileSync(path.join(websiteRoot, "src", "lib", "links.ts"), "utf8");
const downloadFile = readFileSync(
	path.join(websiteRoot, "src", "components", "Download.tsx"),
	"utf8",
);
const releaseWorkflowFile = readFileSync(
	path.join(repoRoot, ".github", "workflows", "release.yml"),
	"utf8",
);

const repoUrlMatch = linksFile.match(/REPO_URL = "([^"]+)"/);
if (!repoUrlMatch) {
	throw new Error("Could not find REPO_URL in website/src/lib/links.ts");
}

const repoUrl = repoUrlMatch[1];
if (repoUrl !== "https://github.com/Jahirsheikh12/screen-mint") {
	throw new Error(`Unexpected REPO_URL: ${repoUrl}`);
}

const linkFileNames = [...linksFile.matchAll(/ScreenMint[-\w.]+\b/g)].map((match) => match[0]);
const websiteArtifacts = new Set(linkFileNames);

const releaseArtifactSelectors = [...releaseWorkflowFile.matchAll(/release-assets\/([^\s]+)/g)].map(
	(match) => match[1],
);

const expectedArtifacts = [
	"ScreenMint-arm64.dmg",
	"ScreenMint-x64.dmg",
	"ScreenMint-windows-x64.exe",
	"ScreenMint-linux-x64.AppImage",
];

function selectorMatchesArtifact(selector, artifact) {
	const pattern = selector
		.replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&")
		.split("*")
		.join(".*");
	return new RegExp(`^${pattern}$`).test(artifact);
}

for (const artifact of expectedArtifacts) {
	if (!websiteArtifacts.has(artifact)) {
		throw new Error(`Website downloads are missing ${artifact}`);
	}
	if (!releaseArtifactSelectors.some((selector) => selectorMatchesArtifact(selector, artifact))) {
		throw new Error(`Release workflow is missing ${artifact}`);
	}
}

if (websiteArtifacts.size !== expectedArtifacts.length) {
	throw new Error(
		`Website download link set drifted. Expected ${expectedArtifacts.length} artifacts, found ${websiteArtifacts.size}.`,
	);
}

// The download section must offer every validated link, so no platform silently drops off the page.
for (const key of ["macAppleSilicon", "macIntel", "windows", "linux"]) {
	if (!downloadFile.includes(`DOWNLOAD_LINKS.${key}`)) {
		throw new Error(`Download section is missing DOWNLOAD_LINKS.${key}`);
	}
}

console.log("Website download links match the published release artifacts.");
