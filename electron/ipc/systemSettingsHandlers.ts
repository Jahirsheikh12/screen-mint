import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { getScreenMintUpdater } from "../updater";
import {
	closeAreaOverlayWindow,
	closeCountdownWindow,
	closeSpeakerNotesWindow,
	createAreaOverlayWindow,
	createCountdownWindow,
	createSpeakerNotesWindow,
	getCountdownWindow,
	lockAreaOverlayWindow,
	updateSpeakerNotesWindow,
} from "../windows";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const SHORTCUTS_FILE = path.join(app.getPath("userData"), "shortcuts.json");
const COUNTDOWN_SETTINGS_FILE = path.join(app.getPath("userData"), "countdown-settings.json");
const HUD_SETTINGS_FILE = path.join(app.getPath("userData"), "hud-overlay-settings-full.json");
// Present only while the app has hidden the desktop icons, so a crash mid-recording
// still restores them on the next launch, and icons the user hid themselves are left alone.
const DESKTOP_ICONS_MARKER_FILE = path.join(app.getPath("userData"), "desktop-icons-hidden");
let dockHiddenByApp = false;

async function setFinderDesktopVisible(visible: boolean) {
	await execFileAsync("defaults", [
		"write",
		"com.apple.finder",
		"CreateDesktop",
		"-bool",
		visible ? "true" : "false",
	]);
	await execFileAsync("killall", ["Finder"]);
}

async function isFinderDesktopVisible(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync("defaults", [
			"read",
			"com.apple.finder",
			"CreateDesktop",
		]);
		return !/^(0|false|no)$/i.test(stdout.trim());
	} catch {
		// Key not set: Finder shows desktop icons by default.
		return true;
	}
}

type CountdownResult = { success: boolean; cancelled?: boolean };

let countdownTimer: ReturnType<typeof setInterval> | null = null;
// Set while a countdown runs; every way it can end (finish, cancel, window closed) goes through it.
let finishCountdown: ((result: CountdownResult) => void) | null = null;

function getScreen() {
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

export function registerSystemSettingsIpcHandlers() {
	ipcMain.handle(IPC_CHANNELS.system.getPlatform, () => {
		return process.platform;
	});

	ipcMain.handle(IPC_CHANNELS.updater.getState, () => {
		return getScreenMintUpdater().getState();
	});

	ipcMain.handle(IPC_CHANNELS.updater.downloadUpdate, async () => {
		return await getScreenMintUpdater().downloadUpdate("manual");
	});

	ipcMain.handle(IPC_CHANNELS.updater.installAndRestart, async () => {
		return await getScreenMintUpdater().installUpdateAndRestart();
	});

	ipcMain.handle(IPC_CHANNELS.updater.updateLaterForSession, async () => {
		return await getScreenMintUpdater().updateLaterForSession();
	});

	ipcMain.handle(IPC_CHANNELS.updater.setExperimentalUpdates, async (_, enabled: unknown) => {
		return await getScreenMintUpdater().setExperimentalUpdates(enabled === true);
	});

	ipcMain.handle(IPC_CHANNELS.updater.skipVersion, async () => {
		return await getScreenMintUpdater().skipVersion();
	});

	ipcMain.handle(IPC_CHANNELS.updater.dismissWhatsNew, async () => {
		return await getScreenMintUpdater().dismissWhatsNew();
	});

	ipcMain.handle(IPC_CHANNELS.updater.setBusyState, async (_, update: Record<string, unknown>) => {
		return await getScreenMintUpdater().setBusyState({
			exporting: typeof update.exporting === "boolean" ? update.exporting : undefined,
			transcribing: typeof update.transcribing === "boolean" ? update.transcribing : undefined,
			recording: typeof update.recording === "boolean" ? update.recording : undefined,
		});
	});

	ipcMain.handle(IPC_CHANNELS.system.hideCursor, () => {
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.shortcuts.get, async () => {
		try {
			const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
			return JSON.parse(data);
		} catch {
			return null;
		}
	});

	ipcMain.handle(IPC_CHANNELS.shortcuts.save, async (_, shortcuts: unknown) => {
		try {
			await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save shortcuts:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.countdown.getDelay, async () => {
		try {
			const content = await fs.readFile(COUNTDOWN_SETTINGS_FILE, "utf-8");
			const parsed = JSON.parse(content) as { delay?: number };
			return { success: true, delay: parsed.delay ?? 3 };
		} catch {
			return { success: true, delay: 3 };
		}
	});

	ipcMain.handle(IPC_CHANNELS.countdown.setDelay, async (_, delay: number) => {
		try {
			await fs.writeFile(COUNTDOWN_SETTINGS_FILE, JSON.stringify({ delay }, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save countdown delay:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.countdown.start, async (_, seconds: number, displayId?: number) => {
		if (finishCountdown) {
			return { success: false, error: "Countdown already in progress" };
		}

		return new Promise<CountdownResult>((resolve) => {
			const countdownWin = createCountdownWindow(
				typeof displayId === "number" && Number.isFinite(displayId) ? displayId : undefined,
			);

			finishCountdown = (result) => {
				finishCountdown = null;
				if (countdownTimer) {
					clearInterval(countdownTimer);
					countdownTimer = null;
				}
				closeCountdownWindow();
				resolve(result);
			};

			countdownWin.once("closed", () => finishCountdown?.({ success: false, cancelled: true }));
			countdownWin.webContents.once("did-finish-load", () => {
				if (!finishCountdown) return;
				let remaining = seconds;
				countdownWin.webContents.send("countdown-tick", remaining);

				countdownTimer = setInterval(() => {
					remaining--;
					if (remaining <= 0) {
						finishCountdown?.({ success: true });
						return;
					}

					const win = getCountdownWindow();
					if (win && !win.isDestroyed()) {
						win.webContents.send("countdown-tick", remaining);
					}
				}, 1000);
			});
		});
	});

	ipcMain.handle(IPC_CHANNELS.countdown.cancel, () => {
		finishCountdown?.({ success: false, cancelled: true });
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.hud.getSettings, async () => {
		try {
			const content = await fs.readFile(HUD_SETTINGS_FILE, "utf-8");
			const parsed = JSON.parse(content) as Record<string, unknown>;
			return { success: true, settings: parsed };
		} catch {
			return { success: true, settings: null };
		}
	});

	ipcMain.handle(IPC_CHANNELS.hud.setSettings, async (_, settings: Record<string, unknown>) => {
		try {
			await fs.writeFile(HUD_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save HUD settings:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.speakerNotes.open, async (_, payload: { text: string }) => {
		try {
			createSpeakerNotesWindow(payload.text ?? "");
			return { success: true };
		} catch (error) {
			console.error("Failed to open speaker notes window:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.speakerNotes.update, async (_, payload: { text: string }) => {
		try {
			updateSpeakerNotesWindow(payload.text ?? "");
			return { success: true };
		} catch (error) {
			console.error("Failed to update speaker notes window:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.speakerNotes.close, () => {
		closeSpeakerNotesWindow();
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.system.getDisplayInfo, () => {
		const displays = getScreen().getAllDisplays();
		return {
			success: true,
			displays: displays.map((display) => ({
				id: display.id,
				label: display.label || `Display ${display.id}`,
				x: display.bounds.x,
				y: display.bounds.y,
				width: display.size.width,
				height: display.size.height,
				refreshRate: display.displayFrequency || 60,
			})),
		};
	});

	ipcMain.handle(IPC_CHANNELS.areaOverlay.create, (_, displayId?: number) => {
		createAreaOverlayWindow(displayId);
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.areaOverlay.close, () => {
		closeAreaOverlayWindow();
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.system.hideDesktopIcons, async () => {
		if (process.platform !== "darwin") {
			return { success: false, error: "Only supported on macOS" };
		}
		try {
			if (!(await isFinderDesktopVisible())) {
				return { success: true };
			}
			await fs.writeFile(DESKTOP_ICONS_MARKER_FILE, "1");
			await setFinderDesktopVisible(false);
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.system.showDesktopIcons, async () => {
		if (process.platform !== "darwin") {
			return { success: false, error: "Only supported on macOS" };
		}
		try {
			// Only undo what this app did; never restart Finder otherwise.
			const hiddenByApp = await fs
				.access(DESKTOP_ICONS_MARKER_FILE)
				.then(() => true)
				.catch(() => false);
			if (!hiddenByApp) {
				return { success: true };
			}
			await setFinderDesktopVisible(true);
			await fs.rm(DESKTOP_ICONS_MARKER_FILE, { force: true });
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.system.hideDockIcon, () => {
		if (process.platform === "darwin" && app.dock?.isVisible?.()) {
			app.dock.hide();
			dockHiddenByApp = true;
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.system.showDockIcon, () => {
		if (process.platform === "darwin" && dockHiddenByApp) {
			void app.dock?.show?.();
			dockHiddenByApp = false;
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.areaOverlay.lock, () => {
		lockAreaOverlayWindow();
		return { success: true };
	});
}
