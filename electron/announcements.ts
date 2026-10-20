import fs from "node:fs/promises";
import path from "node:path";

// Feed lives at the repo root: { "announcements": [{ id, title, body?, url? (https), expiresAt? (ISO) }] }.
// Each id is shown once per install until dismissed, so never reuse an id.
export const ANNOUNCEMENTS_URL =
	"https://raw.githubusercontent.com/Jahirsheikh12/screen-mint/main/announcements.json";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_FEED_CHARS = 64 * 1024;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 600;

export type Announcement = {
	id: string;
	title: string;
	body: string;
	url?: string;
};

function isHttpsUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Validates a raw feed and returns the announcements that should be shown:
 * well-formed, not expired, not dismissed. Anything malformed is dropped.
 */
export function parseAnnouncementFeed(
	raw: unknown,
	dismissedIds: ReadonlySet<string>,
	now: Date,
): Announcement[] {
	const items =
		raw && typeof raw === "object" ? (raw as { announcements?: unknown }).announcements : null;
	if (!Array.isArray(items)) return [];

	const result: Announcement[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		const { id, title, body, url, expiresAt } = item as Record<string, unknown>;
		if (typeof id !== "string" || !id.trim() || seen.has(id) || dismissedIds.has(id)) continue;
		if (typeof title !== "string" || !title.trim()) continue;
		if (expiresAt !== undefined) {
			const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
			if (!Number.isFinite(expiry) || expiry <= now.getTime()) continue;
		}
		seen.add(id);
		result.push({
			id,
			title: title.trim().slice(0, MAX_TITLE_LENGTH),
			body: typeof body === "string" ? body.trim().slice(0, MAX_BODY_LENGTH) : "",
			...(isHttpsUrl(url) ? { url } : {}),
		});
	}
	return result;
}

export function createAnnouncementService(userDataPath: string, feedUrl = ANNOUNCEMENTS_URL) {
	const statePath = path.join(userDataPath, "announcements-state.json");
	let saveChain: Promise<void> = Promise.resolve();

	async function readDismissed(): Promise<Set<string>> {
		try {
			const parsed = JSON.parse(await fs.readFile(statePath, "utf-8")) as { dismissed?: unknown };
			return new Set(
				Array.isArray(parsed.dismissed)
					? parsed.dismissed.filter((id): id is string => typeof id === "string")
					: [],
			);
		} catch {
			return new Set();
		}
	}

	return {
		async getAnnouncements(): Promise<Announcement[]> {
			try {
				const response = await fetch(feedUrl, {
					cache: "no-store",
					signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				});
				if (!response.ok) return [];
				const text = await response.text();
				if (text.length > MAX_FEED_CHARS) return [];
				return parseAnnouncementFeed(JSON.parse(text), await readDismissed(), new Date());
			} catch {
				// Offline or bad feed: announcements are optional, never surface an error.
				return [];
			}
		},
		dismiss(id: string): Promise<void> {
			saveChain = saveChain.then(async () => {
				const dismissed = await readDismissed();
				if (dismissed.has(id)) return;
				dismissed.add(id);
				const tempPath = `${statePath}.${process.pid}.tmp`;
				try {
					await fs.writeFile(tempPath, JSON.stringify({ dismissed: [...dismissed] }), "utf-8");
					await fs.rename(tempPath, statePath);
				} catch (error) {
					await fs.rm(tempPath, { force: true }).catch(() => undefined);
					console.error("Failed to save dismissed announcement:", error);
				}
			});
			return saveChain;
		},
	};
}
