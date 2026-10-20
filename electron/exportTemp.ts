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
