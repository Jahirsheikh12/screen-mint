import fs from "node:fs/promises";
import path from "node:path";

/** Rendered exports wait here until the user picks a save location. */
export const EXPORT_TEMP_DIR_NAME = "screenmint-exports";

export interface CaptionSidecarFiles {
	srt?: string;
	vtt?: string;
}

export function getExportTempDir(tempRoot: string): string {
	return path.join(tempRoot, EXPORT_TEMP_DIR_NAME);
}

export function createExportTempPath(tempRoot: string, extension: "mp4" | "gif"): string {
	const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
	return path.join(getExportTempDir(tempRoot), `export-${id}.${extension}`);
}

// Output paths main itself chose (save dialogs, resolved export targets). Paths the renderer asks
// to write must be one of these, so a compromised renderer cannot write anywhere on disk.
const approvedExportPaths = new Set<string>();

export function approveExportPath<T extends string | undefined>(filePath: T): T {
	if (filePath) approvedExportPaths.add(path.resolve(filePath));
	return filePath;
}

export function isApprovedExportPath(candidate: unknown): candidate is string {
	return typeof candidate === "string" && approvedExportPaths.has(path.resolve(candidate));
}

/** Only files the app itself rendered into its export temp folder may be moved or deleted. */
export function isExportTempPath(tempRoot: string, candidate: unknown): candidate is string {
	if (typeof candidate !== "string" || candidate.length === 0) return false;
	const dir = getExportTempDir(tempRoot);
	const resolved = path.resolve(candidate);
	return (
		path.dirname(resolved) === dir && /^export-[0-9a-f-]+\.(mp4|gif)$/.test(path.basename(resolved))
	);
}

export async function moveFile(source: string, destination: string): Promise<void> {
	try {
		await fs.rename(source, destination);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
		// Different volume: copy, then remove the original.
		await fs.copyFile(source, destination);
		await fs.rm(source, { force: true });
	}
}

/** Writes `<video>.srt` / `<video>.vtt` next to an exported video. Returns the written paths. */
export async function writeCaptionSidecars(
	videoPath: string,
	sidecars: CaptionSidecarFiles | undefined,
): Promise<string[]> {
	if (!sidecars) return [];
	const base = videoPath.slice(0, videoPath.length - path.extname(videoPath).length);
	const written: string[] = [];
	for (const [extension, content] of Object.entries(sidecars)) {
		if ((extension !== "srt" && extension !== "vtt") || typeof content !== "string" || !content) {
			continue;
		}
		const target = `${base}.${extension}`;
		await fs.writeFile(target, content, "utf-8");
		written.push(target);
	}
	return written;
}

const CLIPBOARD_FILE_PREFIXES = ["screenmint-clipboard-", "screenmint-export-v2-"];
const CLIPBOARD_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Startup cleanup. Renders waiting for a save location belong to an editor session, so after a
 * restart they are all stale. Clipboard copies are file references the user may still paste, so
 * those are kept for a day.
 */
export async function sweepStaleExportTempFiles(tempRoot: string, now = Date.now()) {
	await fs.rm(getExportTempDir(tempRoot), { recursive: true, force: true }).catch(() => undefined);
	const names = await fs.readdir(tempRoot).catch(() => [] as string[]);
	await Promise.all(
		names
			.filter((name) => CLIPBOARD_FILE_PREFIXES.some((prefix) => name.startsWith(prefix)))
			.map(async (name) => {
				const filePath = path.join(tempRoot, name);
				const stat = await fs.stat(filePath).catch(() => null);
				if (stat?.isFile() && now - stat.mtimeMs > CLIPBOARD_FILE_MAX_AGE_MS) {
					await fs.rm(filePath, { force: true }).catch(() => undefined);
				}
			}),
	);
}
