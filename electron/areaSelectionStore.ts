import fs from "node:fs/promises";
import type { RecordingBounds, SelectedArea } from "../src/lib/recording/session";

type StoredAreas = Record<string, SelectedArea>;

function sameBounds(left: RecordingBounds, right: RecordingBounds): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	);
}

function isSelectedArea(value: unknown): value is SelectedArea {
	const area = value as SelectedArea | null;
	return Boolean(
		area &&
			typeof area.displayId === "number" &&
			area.bounds &&
			area.displayBounds &&
			area.normalizedBounds &&
			[area.bounds, area.displayBounds, area.normalizedBounds].every((rect) =>
				["x", "y", "width", "height"].every((key) =>
					Number.isFinite((rect as unknown as Record<string, number>)[key]),
				),
			),
	);
}

/** The remembered area for a display, only if that display still has the same bounds. */
export function pickRememberedArea(
	stored: StoredAreas,
	displayId: number,
	displayBounds: RecordingBounds,
): SelectedArea | null {
	const area = stored[String(displayId)];
	return area && sameBounds(area.displayBounds, displayBounds) ? area : null;
}

/** Last area per display, kept in userData so it survives restarts. */
export function createAreaSelectionStore(filePath: string) {
	let cache: StoredAreas | null = null;
	let writeChain: Promise<void> = Promise.resolve();

	async function load(): Promise<StoredAreas> {
		if (cache) return cache;
		try {
			const raw = JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
			cache = Object.fromEntries(
				Object.entries(raw).filter(([, value]) => isSelectedArea(value)),
			) as StoredAreas;
		} catch {
			cache = {};
		}
		return cache;
	}

	return {
		async get(displayId: number, displayBounds: RecordingBounds) {
			return pickRememberedArea(await load(), displayId, displayBounds);
		},
		remember(area: SelectedArea): Promise<void> {
			writeChain = writeChain.then(async () => {
				const stored = await load();
				stored[String(area.displayId)] = area;
				const tempPath = `${filePath}.${process.pid}.tmp`;
				try {
					await fs.writeFile(tempPath, JSON.stringify(stored), "utf-8");
					await fs.rename(tempPath, filePath);
				} catch (error) {
					await fs.rm(tempPath, { force: true }).catch(() => undefined);
					console.error("Failed to remember area selection:", error);
				}
			});
			return writeChain;
		},
	};
}
