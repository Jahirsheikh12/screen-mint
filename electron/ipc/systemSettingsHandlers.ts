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
	unlockAreaOverlayWindow,
	updateSpeakerNotesWindow,
} from "../windows";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const SHORTCUTS_FILE = path.join(app.getPath("userData"), "shortcuts.json");
const COUNTDOWN_SETTINGS_FILE = path.join(app.getPath("userData"), "countdown-settings.json");
const HUD_SETTINGS_FILE = path.join(app.getPath("userData"), "hud-overlay-settings-full.json");

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let countdownCancelled = false;
let countdownInProgress = false;

function getScreen() {
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

export function registerSystemSettingsIpcHandlers() {
	ipcMain.handle(IPC_CHANNELS.system.getPlatform, () => {
		return process.platform;
	});

	ipcMain.handle(IPC_CHANNELS.system.getAppVersion, () => {
		return getScreenMintUpdater().getAppVersion();
	});

	ipcMain.handle(IPC_CHANNELS.updater.getState, () => {
		return getScreenMintUpdater().getState();
	});

	ipcMain.handle(IPC_CHANNELS.updater.checkForUpdates, async () => {
		return await getScreenMintUpdater().checkForUpdates("manual");
	});

	ipcMain.handle(IPC_CHANNELS.updater.downloadUpdate, async () => {
		return await getScreenMintUpdater().downloadUpdate("manual");
	});

	ipcMain.handle(IPC_CHANNELS.updater.installAndRestart, async () => {
		return await getScreenMintUpdater().installUpdateAndRestart();
	});

	ipcMain.handle(IPC_CHANNELS.updater.dismissUpdate, async () => {
		return await getScreenMintUpdater().dismissUpdate();
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

	ipcMain.handle(IPC_CHANNELS.countdown.start, async (_, seconds: number) => {
		if (countdownInProgress) {
			return { success: false, error: "Countdown already in progress" };
		}

		countdownInProgress = true;
		countdownCancelled = false;

		const countdownWin = createCountdownWindow();

		await new Promise<void>((resolve) => {
			countdownWin.webContents.once("did-finish-load", () => resolve());
		});

		return new Promise<{ success: boolean; cancelled?: boolean }>((resolve) => {
			let remaining = seconds;

			countdownWin.webContents.send("countdown-tick", remaining);

			countdownTimer = setInterval(() => {
				if (countdownCancelled) {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					closeCountdownWindow();
					countdownInProgress = false;
					resolve({ success: false, cancelled: true });
					return;
				}

				remaining--;

				if (remaining <= 0) {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					closeCountdownWindow();
					countdownInProgress = false;
					resolve({ success: true });
					return;
				}

				const win = getCountdownWindow();
				if (win && !win.isDestroyed()) {
					win.webContents.send("countdown-tick", remaining);
				}
			}, 1000);
		});
	});

	ipcMain.handle(IPC_CHANNELS.countdown.cancel, () => {
		countdownCancelled = true;
		countdownInProgress = false;
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		closeCountdownWindow();
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
			await execFileAsync("defaults", [
				"write",
				"com.apple.finder",
				"CreateDesktop",
				"-bool",
				"false",
			]);
			await execFileAsync("killall", ["Finder"]);
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
			await execFileAsync("defaults", [
				"write",
				"com.apple.finder",
				"CreateDesktop",
				"-bool",
				"true",
			]);
			await execFileAsync("killall", ["Finder"]);
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.system.hideDockIcon, () => {
		if (process.platform === "darwin") {
			app.dock?.hide?.();
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.system.showDockIcon, () => {
		if (process.platform === "darwin") {
			void app.dock?.show?.();
		}
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.areaOverlay.lock, () => {
		lockAreaOverlayWindow();
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.areaOverlay.unlock, () => {
		unlockAreaOverlayWindow();
		return { success: true };
	});
}
