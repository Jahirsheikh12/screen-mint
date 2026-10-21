import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

/** User-supplied Whisper files that replace the downloaded model / self-built CLI. */
export type CustomWhisperSettings = {
	modelPath: string | null;
	executablePath: string | null;
};

export type CustomWhisperKind = "model" | "executable";

export type CustomWhisperValidationError = "not-found" | "not-ggml-model" | "not-executable";

const EMPTY_SETTINGS: CustomWhisperSettings = { modelPath: null, executablePath: null };
// whisper.cpp models start with the uint32 0x67676d6c ("ggml"), written little-endian.
const GGML_MAGIC = 0x67676d6c;
const WHISPER_CLI_NAMES =
	process.platform === "win32"
		? ["whisper-cli.exe", "whisper-cpp.exe"]
		: ["whisper-cli", "whisper-cpp"];
// GUI apps on macOS don't inherit the shell PATH, so look where package managers install.
const EXTRA_BIN_DIRS = process.platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin"] : [];

function getSettingsPath() {
	return path.join(app.getPath("userData"), "captions", "custom-whisper.json");
}

export async function readCustomWhisperSettings(): Promise<CustomWhisperSettings> {
	try {
		const raw = JSON.parse(await fs.readFile(getSettingsPath(), "utf-8")) as Record<
			string,
			unknown
		>;
		return {
			modelPath: typeof raw.modelPath === "string" ? raw.modelPath : null,
			executablePath: typeof raw.executablePath === "string" ? raw.executablePath : null,
		};
	} catch {
		return { ...EMPTY_SETTINGS };
	}
}

async function writeCustomWhisperSettings(settings: CustomWhisperSettings) {
	const filePath = getSettingsPath();
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${process.pid}.tmp`;
	await fs.writeFile(tempPath, JSON.stringify(settings), "utf-8");
	await fs.rename(tempPath, filePath);
}

export async function validateGgmlModel(
	filePath: string,
): Promise<CustomWhisperValidationError | null> {
	let handle: fs.FileHandle | null = null;
	try {
		handle = await fs.open(filePath, "r");
		const header = Buffer.alloc(4);
		const { bytesRead } = await handle.read(header, 0, 4, 0);
		return bytesRead === 4 && header.readUInt32LE(0) === GGML_MAGIC ? null : "not-ggml-model";
	} catch {
		return "not-found";
	} finally {
		await handle?.close();
	}
}

export async function validateExecutable(
	filePath: string,
): Promise<CustomWhisperValidationError | null> {
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile()) return "not-executable";
		if (process.platform === "win32") {
			return /\.(exe|cmd|bat)$/i.test(filePath) ? null : "not-executable";
		}
		await fs.access(filePath, fsConstants.X_OK);
		return null;
	} catch (error) {
		return (error as NodeJS.ErrnoException)?.code === "ENOENT" ? "not-found" : "not-executable";
	}
}

/** Validates and stores (or clears, with `null`) one custom Whisper file. */
export async function setCustomWhisperPath(
	kind: CustomWhisperKind,
	filePath: string | null,
): Promise<{ settings: CustomWhisperSettings; error: CustomWhisperValidationError | null }> {
	const settings = await readCustomWhisperSettings();
	if (filePath) {
		const error =
			kind === "model" ? await validateGgmlModel(filePath) : await validateExecutable(filePath);
		if (error) return { settings, error };
	}
	const next = {
		...settings,
		[kind === "model" ? "modelPath" : "executablePath"]: filePath,
	};
	await writeCustomWhisperSettings(next);
	return { settings: next, error: null };
}

/** The stored files that still exist and pass validation; stale entries are ignored. */
export async function resolveCustomWhisperFiles(): Promise<CustomWhisperSettings> {
	const settings = await readCustomWhisperSettings();
	return {
		modelPath:
			settings.modelPath && !(await validateGgmlModel(settings.modelPath))
				? settings.modelPath
				: null,
		executablePath:
			settings.executablePath && !(await validateExecutable(settings.executablePath))
				? settings.executablePath
				: null,
	};
}

/** A whisper.cpp CLI already installed on the system (e.g. via a package manager). */
export async function findSystemWhisperCli(): Promise<string | null> {
	const dirs = [...(process.env.PATH ?? "").split(path.delimiter), ...EXTRA_BIN_DIRS].filter(
		Boolean,
	);
	for (const dir of new Set(dirs)) {
		for (const name of WHISPER_CLI_NAMES) {
			const candidate = path.join(dir, name);
			if (!(await validateExecutable(candidate))) return candidate;
		}
	}
	return null;
}
