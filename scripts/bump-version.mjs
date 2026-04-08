#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

const packageTargets = [
	{
		name: "app",
		packageJsonPath: path.join(projectRoot, "package.json"),
		lockfilePath: path.join(projectRoot, "package-lock.json"),
	},
	{
		name: "website",
		packageJsonPath: path.join(projectRoot, "website", "package.json"),
		lockfilePath: path.join(projectRoot, "website", "package-lock.json"),
	},
];

function printUsage() {
	console.log(`Usage:
  npm run version:show
  npm run version:patch
  npm run version:minor
  npm run version:major
  npm run version:set -- <version>

Options:
  --dry-run   Show the next version without writing files
  --show      Print the current synced version and exit`);
}

function parseSemver(version) {
	const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
	if (!match) {
		throw new Error(`Invalid semantic version: ${version}`);
	}

	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease: match[4] ?? null,
	};
}

function formatSemver({ major, minor, patch, prerelease }) {
	return prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`;
}

function bumpVersion(version, releaseType) {
	const parsed = parseSemver(version);

	switch (releaseType) {
		case "patch":
			return formatSemver({
				major: parsed.major,
				minor: parsed.minor,
				patch: parsed.patch + 1,
				prerelease: null,
			});
		case "minor":
			return formatSemver({
				major: parsed.major,
				minor: parsed.minor + 1,
				patch: 0,
				prerelease: null,
			});
		case "major":
			return formatSemver({
				major: parsed.major + 1,
				minor: 0,
				patch: 0,
				prerelease: null,
			});
		default:
			return formatSemver(parseSemver(releaseType));
	}
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

async function updateLockfileVersion(lockfilePath, version) {
	const lockfile = await readJson(lockfilePath);
	lockfile.version = version;
	if (lockfile.packages?.[""]) {
		lockfile.packages[""].version = version;
	}
	await writeJson(lockfilePath, lockfile);
}

async function main() {
	const rawArgs = process.argv.slice(2);
	const dryRun = rawArgs.includes("--dry-run");
	const showOnly = rawArgs.includes("--show");
	const args = rawArgs.filter((arg) => arg !== "--dry-run" && arg !== "--show");

	const currentVersions = await Promise.all(
		packageTargets.map(async (target) => ({
			...target,
			packageJson: await readJson(target.packageJsonPath),
		})),
	);

	const uniqueVersions = [...new Set(currentVersions.map((target) => target.packageJson.version))];
	const currentVersion = currentVersions[0]?.packageJson.version;

	if (!currentVersion) {
		throw new Error("Could not determine the current project version.");
	}

	if (showOnly) {
		console.log(currentVersion);
		if (uniqueVersions.length > 1) {
			console.warn(`Warning: package versions are out of sync (${uniqueVersions.join(", ")}).`);
		}
		return;
	}

	if (args.length !== 1) {
		printUsage();
		process.exit(args.length === 0 ? 0 : 1);
	}

	const requestedVersion = args[0];
	const nextVersion = bumpVersion(currentVersion, requestedVersion);

	if (dryRun) {
		console.log(
			JSON.stringify(
				{
					currentVersion,
					nextVersion,
					packageTargets: packageTargets.map((target) =>
						path.relative(projectRoot, target.packageJsonPath),
					),
				},
				null,
				2,
			),
		);
		return;
	}

	for (const target of currentVersions) {
		target.packageJson.version = nextVersion;
		await writeJson(target.packageJsonPath, target.packageJson);
		await updateLockfileVersion(target.lockfilePath, nextVersion);
	}

	console.log(
		`Updated project version ${currentVersion} -> ${nextVersion} in ${packageTargets.length} package manifests.`,
	);
	console.log("Updated files:");
	for (const target of packageTargets) {
		console.log(`- ${path.relative(projectRoot, target.packageJsonPath)}`);
		console.log(`- ${path.relative(projectRoot, target.lockfilePath)}`);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
