import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getVersion: () => "1.0.0",
		getPath: () => os.tmpdir(),
		isPackaged: true,
		quit: vi.fn(),
	},
	BrowserWindow: {
		getAllWindows: () => [],
	},
	shell: {
		openPath: vi.fn(async () => ""),
	},
}));

vi.mock("electron-updater", () => ({
	autoUpdater: {},
}));

import { ScreenMintUpdater } from "../../../electron/updater";

class FakeUpdaterBackend extends EventEmitter {
	autoDownload = false;
	autoInstallOnAppQuit = false;
	allowPrerelease = false;
	fullChangelog = false;
	checkForUpdates = vi.fn(async () => undefined);
	downloadUpdate = vi.fn(async () => undefined);
}

const originalPlatform = process.platform;
const originalAppImage = process.env.APPIMAGE;
const originalDevServerUrl = process.env.VITE_DEV_SERVER_URL;

function setPlatform(platform: NodeJS.Platform) {
	Object.defineProperty(process, "platform", {
		value: platform,
		configurable: true,
	});
}

async function waitFor(
	condition: () => boolean,
	options: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
	const attempts = options.attempts ?? 20;
	const delayMs = options.delayMs ?? 10;

	for (let index = 0; index < attempts; index += 1) {
		if (condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	throw new Error("Condition was not met in time.");
}

describe("ScreenMintUpdater", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "screenmint-updater-"));
		delete process.env.VITE_DEV_SERVER_URL;
		delete process.env.APPIMAGE;
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(async () => {
		setPlatform(originalPlatform);
		process.env.APPIMAGE = originalAppImage;
		process.env.VITE_DEV_SERVER_URL = originalDevServerUrl;
		await fs.rm(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	function createUpdater(
		platform: NodeJS.Platform,
		backend: FakeUpdaterBackend,
		options: { version?: string } = {},
	) {
		setPlatform(platform);
		const quit = vi.fn();
		const openPath = vi.fn(async () => "");
		const version = options.version ?? "1.0.0";
		const updater = new ScreenMintUpdater({
			appAdapter: {
				getVersion: () => version,
				getPath: () => tempDir,
				isPackaged: true,
				openPath,
				quit,
			},
			updaterBackend: backend,
			windowProvider: () => [],
			initialCheckDelayMs: 60_000,
			checkIntervalMs: 60_000,
		});

		return { updater, quit, openPath };
	}

	it("moves to no-update when no newer version is available", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-not-available", { version: "1.0.0" });
		});

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("manual");

		expect(updater.getState().status).toBe("no-update");
		expect(updater.getState().latestVersion).toBe("1.0.0");
		expect(updater.getState().checkSource).toBe("manual");
	});

	it("shows the update prompt without downloading until the user chooses Update now", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", {
				version: "1.1.0",
				releaseName: "ScreenMint 1.1.0",
			});
		});

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("manual");

		expect(backend.downloadUpdate).not.toHaveBeenCalled();
		expect(updater.getState().status).toBe("available");
		expect(updater.getState().latestVersion).toBe("1.1.0");
		expect(updater.getState().showUpdatePrompt).toBe(true);
	});

	it("downloads on Windows after the user chooses Update now", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", {
				version: "1.1.0",
				releaseName: "ScreenMint 1.1.0",
			});
		});
		backend.downloadUpdate.mockImplementation(async () => {
			backend.emit("download-progress", { percent: 10 });
			backend.emit("update-downloaded", { version: "1.1.0" });
		});

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");

		expect(backend.downloadUpdate).toHaveBeenCalledTimes(1);
		expect(updater.getState().status).toBe("downloaded");
	});

	it("does not prompt again for a skipped version on automatic checks", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", { version: "1.1.0" });
		});

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.skipVersion();
		await updater.checkForUpdates("automatic");

		expect(updater.getState().showUpdatePrompt).toBe(false);
	});

	it("persists the experimental channel and enables pre-releases", async () => {
		const backend = new FakeUpdaterBackend();
		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.setExperimentalUpdates(true);

		expect(backend.allowPrerelease).toBe(true);
		expect(updater.getState().experimentalUpdatesEnabled).toBe(true);

		const reloadedBackend = new FakeUpdaterBackend();
		const { updater: reloaded } = createUpdater("win32", reloadedBackend);
		await reloaded.init();
		expect(reloadedBackend.allowPrerelease).toBe(true);
	});

	it("defers the update prompt for the current session only", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", { version: "1.1.0" });
		});

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("automatic");

		expect(updater.getState().showUpdatePrompt).toBe(true);

		await updater.updateLaterForSession();

		expect(updater.getState().showUpdatePrompt).toBe(false);
		expect(updater.getState().sessionDeferredVersion).toBe("1.1.0");

		await updater.checkForUpdates("automatic");

		expect(updater.getState().status).toBe("available");
		expect(updater.getState().showUpdatePrompt).toBe(false);

		await updater.checkForUpdates("manual");

		expect(updater.getState().showUpdatePrompt).toBe(true);
		expect(updater.getState().sessionDeferredVersion).toBeNull();
	});

	const macArch = process.arch === "arm64" ? "arm64" : "x64";
	const sha512Base64 = (text: string) => createHash("sha512").update(text).digest("base64");
	const macRelease = (sha512?: string) => ({
		version: "1.2.0",
		files: [{ url: `ScreenMint-${macArch}.dmg`, sha512, size: 8 }],
	});

	it("refuses a macOS installer whose checksum does not match", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("update-available", macRelease(sha512Base64("other-bytes")));
		});
		vi.mocked(fetch).mockResolvedValue(new Response("fake-dmg", { status: 200 }));

		const { updater } = createUpdater("darwin", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");
		await waitFor(() => updater.getState().status === "manual-download-required");

		expect(updater.getState().error).toContain("checksum");
		expect(updater.getState().downloadedFilePath).toBeNull();
		await expect(fs.readdir(path.join(tempDir, "updates"))).resolves.not.toContain(
			`ScreenMint-1.2.0-${macArch}.dmg`,
		);
	});

	it("replaces a cached macOS installer that fails its checksum", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("update-available", macRelease(sha512Base64("fake-dmg")));
		});
		vi.mocked(fetch).mockResolvedValue(new Response("fake-dmg", { status: 200 }));
		const cachedPath = path.join(tempDir, "updates", `ScreenMint-1.2.0-${macArch}.dmg`);
		await fs.mkdir(path.dirname(cachedPath), { recursive: true });
		await fs.writeFile(cachedPath, "tampered");

		const { updater } = createUpdater("darwin", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");
		await waitFor(() => updater.getState().status === "downloaded");

		expect(fetch).toHaveBeenCalled();
		await expect(fs.readFile(cachedPath, "utf8")).resolves.toBe("fake-dmg");
	});

	it("refuses a macOS update whose release lists no checksum", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("update-available", macRelease(undefined));
		});

		const { updater } = createUpdater("darwin", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");

		expect(updater.getState().status).toBe("manual-download-required");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("downloads a macOS installer artifact for unsigned builds", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", macRelease(sha512Base64("fake-dmg")));
		});
		vi.mocked(fetch).mockResolvedValue(
			new Response("fake-dmg", {
				status: 200,
				headers: { "content-length": "8" },
			}),
		);

		const { updater } = createUpdater("darwin", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");
		await waitFor(() => updater.getState().status === "downloaded");
		const expectedArch = process.arch === "arm64" ? "arm64" : "x64";

		expect(backend.downloadUpdate).not.toHaveBeenCalled();
		expect(updater.getState().status).toBe("downloaded");
		expect(updater.getState().installMode).toBe("external-installer");
		expect(updater.getState().manualDownloadUrl).toContain(
			`/releases/download/v1.2.0/ScreenMint-${expectedArch}.dmg`,
		);
		expect(updater.getState().downloadedFilePath).toContain(`ScreenMint-1.2.0-${expectedArch}.dmg`);
	});

	it("falls back to manual download on Linux when not running from AppImage", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", { version: "1.3.0" });
		});

		const { updater } = createUpdater("linux", backend);
		await updater.init();
		await updater.checkForUpdates("manual");

		expect(updater.getState().status).toBe("manual-download-required");
		expect(updater.getState().canDownload).toBe(false);
	});

	it("surfaces updater errors without crashing the state machine", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockRejectedValue(new Error("network down"));

		const { updater } = createUpdater("win32", backend);
		await updater.init();
		await updater.checkForUpdates("manual");

		expect(updater.getState().status).toBe("error");
		expect(updater.getState().error).toContain("network down");
	});

	it("requests application quit instead of bypassing the normal close flow", async () => {
		process.env.APPIMAGE = "/tmp/ScreenMint.AppImage";
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", { version: "1.4.0" });
		});
		backend.downloadUpdate.mockImplementation(async () => {
			backend.emit("download-progress", { percent: 100 });
			backend.emit("update-downloaded", { version: "1.4.0" });
		});

		const { updater, quit } = createUpdater("linux", backend);
		await updater.init();
		await updater.checkForUpdates("manual");
		await updater.downloadUpdate("manual");

		const result = await updater.installUpdateAndRestart();

		expect(result).toEqual({ success: true });
		expect(quit).toHaveBeenCalledTimes(1);
	});

	it("shows What's New once after launching the newly installed version", async () => {
		const backend = new FakeUpdaterBackend();
		backend.checkForUpdates.mockImplementation(async () => {
			backend.emit("checking-for-update");
			backend.emit("update-available", {
				version: "1.1.0",
				releaseName: "ScreenMint 1.1.0",
				releaseNotes: "- Added unified update dialogs",
			});
		});
		backend.downloadUpdate.mockImplementation(async () => {
			backend.emit("download-progress", { percent: 100 });
			backend.emit("update-downloaded", {
				version: "1.1.0",
				releaseName: "ScreenMint 1.1.0",
				releaseNotes: "- Added unified update dialogs",
			});
		});

		const firstLaunch = createUpdater("win32", backend, { version: "1.0.0" });
		await firstLaunch.updater.init();
		await firstLaunch.updater.checkForUpdates("manual");
		await firstLaunch.updater.downloadUpdate("manual");
		await firstLaunch.updater.installUpdateAndRestart();

		const secondLaunch = createUpdater("win32", new FakeUpdaterBackend(), { version: "1.1.0" });
		await secondLaunch.updater.init();

		expect(secondLaunch.updater.getState().showWhatsNew).toBe(true);
		expect(secondLaunch.updater.getState().whatsNewVersion).toBe("1.1.0");
		expect(secondLaunch.updater.getState().whatsNewReleaseNotes).toContain(
			"Added unified update dialogs",
		);

		await secondLaunch.updater.dismissWhatsNew();

		expect(secondLaunch.updater.getState().showWhatsNew).toBe(false);

		const thirdLaunch = createUpdater("win32", new FakeUpdaterBackend(), { version: "1.1.0" });
		await thirdLaunch.updater.init();

		expect(thirdLaunch.updater.getState().showWhatsNew).toBe(false);
	});
});
