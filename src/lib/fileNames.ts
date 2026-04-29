const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const DEFAULT_FILE_NAME_BASE = "Untitled";
const MAX_FILE_NAME_BASE_LENGTH = 180;

export function normalizeVideoDisplayName(candidate: unknown): string {
	if (typeof candidate !== "string") {
		return DEFAULT_FILE_NAME_BASE;
	}

	const normalized = candidate.replace(/\s+/g, " ").trim();
	return normalized.length > 0 ? normalized : DEFAULT_FILE_NAME_BASE;
}

export function deriveVideoNameFromPath(filePath: string | null | undefined): string {
	if (!filePath) {
		return DEFAULT_FILE_NAME_BASE;
	}

	const fileName = filePath.split(/[\\/]/).pop() ?? "";
	const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
	return normalizeVideoDisplayName(nameWithoutExtension);
}

export function sanitizeFileNameBase(
	candidate: unknown,
	fallback = DEFAULT_FILE_NAME_BASE,
): string {
	const fallbackBase = normalizeVideoDisplayName(fallback);
	if (typeof candidate !== "string") {
		return fallbackBase;
	}

	const sanitized = candidate
		.replace(INVALID_FILE_NAME_CHARS, "_")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[. ]+$/g, "")
		.slice(0, MAX_FILE_NAME_BASE_LENGTH)
		.trim();

	if (!sanitized || sanitized === "." || sanitized === "..") {
		return fallbackBase;
	}

	if (RESERVED_WINDOWS_NAMES.test(sanitized)) {
		return `${sanitized}_`;
	}

	return sanitized;
}

export function ensureFileExtension(fileNameOrBase: string, extension: string): string {
	const normalizedExtension = extension.replace(/^\./, "").toLowerCase();
	const expectedExtension = `.${normalizedExtension}`;
	const sanitizedBase = sanitizeFileNameBase(
		fileNameOrBase.replace(new RegExp(`\\.${normalizedExtension}$`, "i"), ""),
	);
	return `${sanitizedBase}${expectedExtension}`;
}

export function buildCollisionFileName(fileName: string, collisionIndex: number): string {
	if (collisionIndex <= 0) {
		return fileName;
	}

	const extensionMatch = fileName.match(/(\.[^.]+)$/);
	const extension = extensionMatch?.[1] ?? "";
	const base = extension ? fileName.slice(0, -extension.length) : fileName;
	return `${base}-${collisionIndex + 1}${extension}`;
}
