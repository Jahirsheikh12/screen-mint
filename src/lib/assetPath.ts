function encodeRelativeAssetPath(relativePath: string): string {
	return relativePath
		.replace(/^\/+/, "")
		.split("/")
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function ensureTrailingSlash(value: string): string {
	return value.endsWith("/") ? value : `${value}/`;
}

type AssetWindow = Window &
	typeof globalThis & {
		electronAPI?: {
			getAssetBasePath?: () => Promise<string | null>;
			getAssetBasePathSync?: () => string | null;
			readLocalFile?: (
				filePath: string,
			) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
		};
	};

let assetBasePathPromise: Promise<string | null> | null = null;
let assetBasePathSyncCache: string | null | undefined;

function getAssetWindow() {
	return typeof window !== "undefined" ? (window as AssetWindow) : undefined;
}

function getCachedAssetBasePathSync(): string | null {
	if (assetBasePathSyncCache !== undefined) {
		return assetBasePathSyncCache;
	}

	try {
		const assetWindow = getAssetWindow();
		if (
			assetWindow?.electronAPI &&
			typeof assetWindow.electronAPI.getAssetBasePathSync === "function"
		) {
			assetBasePathSyncCache = assetWindow.electronAPI.getAssetBasePathSync();
			return assetBasePathSyncCache;
		}
	} catch {
		// ignore and use fallback
	}

	assetBasePathSyncCache = null;
	return assetBasePathSyncCache;
}

async function getCachedAssetBasePath(): Promise<string | null> {
	const syncBasePath = getCachedAssetBasePathSync();
	if (syncBasePath) {
		return syncBasePath;
	}

	if (assetBasePathPromise) {
		return assetBasePathPromise;
	}

	assetBasePathPromise = (async () => {
		try {
			const assetWindow = getAssetWindow();
			if (
				assetWindow?.electronAPI &&
				typeof assetWindow.electronAPI.getAssetBasePath === "function"
			) {
				const resolvedBasePath = await assetWindow.electronAPI.getAssetBasePath();
				if (resolvedBasePath) {
					assetBasePathSyncCache = resolvedBasePath;
				}
				return resolvedBasePath;
			}
		} catch {
			// ignore and use fallback
		}

		return null;
	})();

	return assetBasePathPromise;
}

export function getAssetPathSync(relativePath: string): string {
	const encodedRelativePath = encodeRelativeAssetPath(relativePath);

	try {
		const assetWindow = getAssetWindow();
		if (
			assetWindow?.location &&
			assetWindow.location.protocol &&
			assetWindow.location.protocol.startsWith("http")
		) {
			return `/${encodedRelativePath}`;
		}

		const base = getCachedAssetBasePathSync();
		if (base) {
			return new URL(encodedRelativePath, ensureTrailingSlash(base)).toString();
		}
	} catch (_err) {
		// ignore and use fallback
	}

	return `/${encodedRelativePath}`;
}

export async function getAssetPath(relativePath: string): Promise<string> {
	const encodedRelativePath = encodeRelativeAssetPath(relativePath);

	try {
		if (typeof window !== "undefined") {
			// If running in a dev server (http/https), prefer the web-served path
			if (
				window.location &&
				window.location.protocol &&
				window.location.protocol.startsWith("http")
			) {
				return `/${encodedRelativePath}`;
			}

			const base = await getCachedAssetBasePath();
			if (base) {
				return new URL(encodedRelativePath, ensureTrailingSlash(base)).toString();
			}
		}
	} catch (_err) {
		// ignore and use fallback
	}

	// Fallback for web/dev server: public/wallpapers are served at '/wallpapers/...'
	return `/${encodedRelativePath}`;
}

const BASE64_CHUNK_SIZE = 0x8000;
const localFileDataUrlCache = new Map<string, string>();

function toLocalFilePath(resourceUrl: string) {
	if (!resourceUrl.startsWith("file://")) {
		return null;
	}

	const decodedPath = decodeURIComponent(resourceUrl.replace(/^file:\/\//, ""));
	if (/^\/[A-Za-z]:/.test(decodedPath)) {
		return decodedPath.slice(1);
	}

	return decodedPath;
}

function getMimeTypeForAsset(resourceUrl: string) {
	const normalized = resourceUrl.split("?")[0].toLowerCase();

	if (normalized.endsWith(".png")) return "image/png";
	if (normalized.endsWith(".webp")) return "image/webp";
	if (normalized.endsWith(".gif")) return "image/gif";
	if (normalized.endsWith(".svg")) return "image/svg+xml";
	if (normalized.endsWith(".avif")) return "image/avif";
	return "image/jpeg";
}

function toBase64(bytes: Uint8Array) {
	let binary = "";

	for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
		const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

export function getDisplayAssetUrlSync(asset: string): string {
	if (
		!asset ||
		asset.startsWith("data:") ||
		asset.startsWith("http") ||
		asset.startsWith("file://") ||
		asset.startsWith("#") ||
		asset.startsWith("linear-gradient") ||
		asset.startsWith("radial-gradient")
	) {
		return asset;
	}

	return getAssetPathSync(asset.replace(/^\/+/, ""));
}

export async function getDisplayAssetUrl(asset: string): Promise<string> {
	if (
		!asset ||
		asset.startsWith("data:") ||
		asset.startsWith("http") ||
		asset.startsWith("file://") ||
		asset.startsWith("#") ||
		asset.startsWith("linear-gradient") ||
		asset.startsWith("radial-gradient")
	) {
		return asset;
	}

	const syncResolvedAsset = getDisplayAssetUrlSync(asset);
	if (syncResolvedAsset.startsWith("file://")) {
		return syncResolvedAsset;
	}

	return getAssetPath(asset.replace(/^\/+/, ""));
}

export async function getRenderableAssetUrl(asset: string): Promise<string> {
	if (
		!asset ||
		asset.startsWith("data:") ||
		asset.startsWith("http") ||
		asset.startsWith("#") ||
		asset.startsWith("linear-gradient") ||
		asset.startsWith("radial-gradient")
	) {
		return asset;
	}

	const resolvedAsset = await getDisplayAssetUrl(asset);

	const localFilePath = toLocalFilePath(resolvedAsset);
	if (!localFilePath || typeof window === "undefined" || !window.electronAPI?.readLocalFile) {
		return resolvedAsset;
	}

	const cached = localFileDataUrlCache.get(resolvedAsset);
	if (cached) {
		return cached;
	}

	try {
		const result = await window.electronAPI.readLocalFile(localFilePath);
		if (!result.success || !result.data) {
			return resolvedAsset;
		}

		const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
		const dataUrl = `data:${getMimeTypeForAsset(localFilePath)};base64,${toBase64(bytes)}`;
		localFileDataUrlCache.set(resolvedAsset, dataUrl);
		return dataUrl;
	} catch {
		return resolvedAsset;
	}
}

export default getAssetPath;
