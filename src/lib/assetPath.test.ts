import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockWindow = {
	location?: {
		protocol?: string;
	};
	electronAPI?: {
		getAssetBasePath?: () => Promise<string | null>;
		getAssetBasePathSync?: () => string | null;
		readLocalFile?: (filePath: string) => Promise<{ success: boolean; data?: Uint8Array }>;
	};
};

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function setMockWindow(windowMock: MockWindow) {
	Object.defineProperty(globalThis, "window", {
		value: windowMock,
		configurable: true,
		writable: true,
	});
}

async function loadAssetPathModule() {
	vi.resetModules();
	return import("./assetPath");
}

describe("assetPath", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		if (originalWindowDescriptor) {
			Object.defineProperty(globalThis, "window", originalWindowDescriptor);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	});

	it("returns a display URL for packaged built-in assets without reading local files", async () => {
		const getAssetBasePath = vi.fn().mockResolvedValue("file:///packaged/assets/");
		const readLocalFile = vi.fn();
		setMockWindow({
			location: { protocol: "file:" },
			electronAPI: {
				getAssetBasePath,
				readLocalFile,
			},
		});

		const { getDisplayAssetUrl } = await loadAssetPathModule();
		const resolved = await getDisplayAssetUrl("wallpapers/green-blue-waves.jpg");

		expect(resolved).toBe("file:///packaged/assets/wallpapers/green-blue-waves.jpg");
		expect(getAssetBasePath).toHaveBeenCalledTimes(1);
		expect(readLocalFile).not.toHaveBeenCalled();
	});

	it("returns a synchronous display URL for packaged built-in assets on first render", async () => {
		const getAssetBasePathSync = vi.fn().mockReturnValue("file:///packaged/assets/");
		setMockWindow({
			location: { protocol: "file:" },
			electronAPI: {
				getAssetBasePathSync,
			},
		});

		const { getDisplayAssetUrlSync } = await loadAssetPathModule();
		const resolved = getDisplayAssetUrlSync("wallpapers/green-blue-waves.jpg");

		expect(resolved).toBe("file:///packaged/assets/wallpapers/green-blue-waves.jpg");
		expect(getAssetBasePathSync).toHaveBeenCalledTimes(1);
	});

	it("caches asset base path lookups across repeated asset path requests", async () => {
		const getAssetBasePath = vi.fn().mockResolvedValue("file:///packaged/assets/");
		setMockWindow({
			location: { protocol: "file:" },
			electronAPI: {
				getAssetBasePath,
			},
		});

		const { getAssetPath } = await loadAssetPathModule();

		await getAssetPath("wallpapers/green-blue-waves.jpg");
		await getAssetPath("wallpapers/black-liquid.jpg");

		expect(getAssetBasePath).toHaveBeenCalledTimes(1);
	});

	it("preserves directly renderable asset values", async () => {
		const { getRenderableAssetUrl } = await loadAssetPathModule();
		const passthroughAssets = [
			"data:image/png;base64,abc",
			"https://example.com/wallpaper.jpg",
			"#112233",
			"linear-gradient(to right, #000000, #ffffff)",
			"radial-gradient(circle, #ffffff, #000000)",
		];

		for (const asset of passthroughAssets) {
			await expect(getRenderableAssetUrl(asset)).resolves.toBe(asset);
		}
	});

	it("converts packaged local file assets into data URLs for renderable usage", async () => {
		const readLocalFile = vi.fn().mockResolvedValue({
			success: true,
			data: new Uint8Array([1, 2, 3]),
		});
		setMockWindow({
			location: { protocol: "file:" },
			electronAPI: {
				getAssetBasePath: vi.fn().mockResolvedValue("file:///packaged/assets/"),
				readLocalFile,
			},
		});

		const { getRenderableAssetUrl } = await loadAssetPathModule();
		const resolved = await getRenderableAssetUrl("file:///packaged/assets/wallpapers/test.jpg");

		expect(resolved).toBe("data:image/jpeg;base64,AQID");
		expect(readLocalFile).toHaveBeenCalledWith("/packaged/assets/wallpapers/test.jpg");
	});
});
