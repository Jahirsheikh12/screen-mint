import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

/**
 * Crash recovery for recordings. A marker is written when recording starts and removed when it
 * stops. If the app dies mid-recording, the marker survives and the next launch can offer the
 * video files written to the recordings folder since then.
 */
interface RecordingMarker {
	startedAt: number;
	recordingsDir: string;
}

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv"]);

function getMarkerPath() {
	return path.join(app.getPath("userData"), "recording-in-progress.json");
}

export async function markRecordingStarted(recordingsDir: string) {
	const marker: RecordingMarker = { startedAt: Date.now(), recordingsDir };
	await fs.writeFile(getMarkerPath(), JSON.stringify(marker)).catch(() => undefined);
}

export async function markRecordingStopped() {
	await fs.rm(getMarkerPath(), { force: true }).catch(() => undefined);
}

/** Video files modified after the recording started, largest first. */
export function pickRecoveredRecordings(
	entries: Array<{ path: string; size: number; mtimeMs: number }>,
	startedAt: number,
): string[] {
	return entries
		.filter(
			(entry) =>
				entry.size > 0 &&
				entry.mtimeMs >= startedAt - 1000 &&
				VIDEO_EXTENSIONS.has(path.extname(entry.path).toLowerCase()),
		)
		.sort((a, b) => b.size - a.size)
		.map((entry) => entry.path);
}

/** Returns files from an interrupted recording (if any) and clears the marker. */
export async function takeInterruptedRecordings(): Promise<string[]> {
	let marker: RecordingMarker;
	try {
		marker = JSON.parse(await fs.readFile(getMarkerPath(), "utf8")) as RecordingMarker;
	} catch {
		return [];
	}
	await markRecordingStopped();
	if (typeof marker.startedAt !== "number" || typeof marker.recordingsDir !== "string") {
		return [];
	}
	const names = await fs.readdir(marker.recordingsDir).catch(() => [] as string[]);
	const entries = await Promise.all(
		names.map(async (name) => {
			const filePath = path.join(marker.recordingsDir, name);
			const stat = await fs.stat(filePath).catch(() => null);
			return stat?.isFile() ? { path: filePath, size: stat.size, mtimeMs: stat.mtimeMs } : null;
		}),
	);
	return pickRecoveredRecordings(
		entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
		marker.startedAt,
	);
}
