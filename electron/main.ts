import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	desktopCapturer,
	dialog,
	ipcMain,
	Menu,
	nativeImage,
	session,
	shell,
	Tray,
} from "electron";
import { IPC_CHANNELS } from "../src/electron-ipc/contracts";
import { sweepStaleExportTempFiles } from "./exportTemp";
import { loadStoredLocale, saveLocale, setMainLocale, tMain } from "./i18n";
import {
	adoptRecoveredRecording,
	getSelectedSourceId,
	killWgcCaptureProcess,
	registerIpcHandlers,
	stopNativeCaptureOnQuit,
} from "./ipc/handlers";
import { takeInterruptedRecordings } from "./recordingRecovery";
import { getScreenMintUpdater } from "./updater";
import {
	closeUpdateToastWindow,
	createEditorWindow,
	createHudOverlayWindow,
	createSourceSelectorWindow,
	fadeOutAndDestroyWindow,
	showUpdateToastWindow,
} from "./windows";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform === "darwin") {
	app.commandLine.appendSwitch("disable-features", "MacCatapLoopbackAudioForScreenShare");
}

export const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");

async function ensureRecordingsDir() {
	try {
		await fs.mkdir(RECORDINGS_DIR, { recursive: true });
		console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
		console.log("User Data Path:", app.getPath("userData"));
	} catch (error) {
		console.error("Failed to create recordings directory:", error);
	}
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
	? path.join(process.env.APP_ROOT, "public")
	: RENDERER_DIST;

// Window references
let mainWindow: BrowserWindow | null = null;
let sourceSelectorWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let selectedSourceName = "";
let editorHasUnsavedChanges = false;
let isForceClosing = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
	app.quit();
}

function closeEditorWindowBypassingUnsavedPrompt(window: BrowserWindow | null) {
	if (!window || window.isDestroyed()) {
		return;
	}

	isForceClosing = true;
	editorHasUnsavedChanges = false;
	window.close();
}

// Tray Icons
const defaultTrayIcon = getTrayIcon("app-icons/screenmint-32.png");
const recordingTrayIcon = getTrayIcon("rec-button.png");

ipcMain.on("set-has-unsaved-changes", (_event, hasChanges: boolean) => {
	editorHasUnsavedChanges = hasChanges;
});

function createWindow() {
	createHudOverlayWindowWrapper();
}

function createHudOverlayWindowWrapper() {
	if (mainWindow && !mainWindow.isDestroyed()) {
		closeEditorWindowBypassingUnsavedPrompt(mainWindow);
	}
	mainWindow = null;
	editorHasUnsavedChanges = false;
	mainWindow = createHudOverlayWindow();

	mainWindow.on("closed", () => {
		if (mainWindow?.isDestroyed()) {
			mainWindow = null;
		}
	});

	return mainWindow;
}

function focusOrCreateMainWindow() {
	// The update toast is a notification, not an app window, so it shouldn't stop the HUD reopening.
	const hasAppWindow = BrowserWindow.getAllWindows().some(
		(window) => !window.webContents.getURL().includes("windowType=update-toast"),
	);
	if (!hasAppWindow) {
		createWindow();
		return;
	}

	if (mainWindow && !mainWindow.isDestroyed()) {
		// On Linux/Wayland, focus() often doesn't take effect (compositor ignores it). Apps like Telegram
		// work because they receive an XDG activation token via StatusNotifierItem.ProvideXdgActivationToken;
		// Electron's tray doesn't handle that yet. Workaround: destroy and recreate the HUD so the new
		// window gets focus (creation path works). Only for HUD, not editor.
		if (process.platform === "linux" && !mainWindow.isFocused() && !isEditorWindow(mainWindow)) {
			const win = mainWindow;
			mainWindow = null;
			win.once("closed", () => createWindow());
			win.destroy();
			return;
		}
		mainWindow.show();
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.moveTop();
		mainWindow.focus();
	}
}

function isEditorWindow(window: BrowserWindow) {
	return window.webContents.getURL().includes("windowType=editor");
}

function sendEditorMenuAction(
	channel: "menu-load-project" | "menu-save-project" | "menu-save-project-as",
) {
	let targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;

	if (!targetWindow || targetWindow.isDestroyed() || !isEditorWindow(targetWindow)) {
		createEditorWindowWrapper();
		targetWindow = mainWindow;
		if (!targetWindow || targetWindow.isDestroyed()) return;

		targetWindow.webContents.once("did-finish-load", () => {
			if (!targetWindow || targetWindow.isDestroyed()) return;
			targetWindow.webContents.send(channel);
		});
		return;
	}

	targetWindow.webContents.send(channel);
}

function getUpdateStatusDetail() {
	const updater = getScreenMintUpdater();
	const state = updater.getState();
	const latestVersion = state.latestVersion ?? state.currentVersion;

	switch (state.status) {
		case "checking":
			return tMain("about.status.checking");
		case "available":
			return tMain("about.status.available", { version: latestVersion });
		case "downloading":
			return typeof state.progress === "number"
				? tMain("about.status.downloadingProgress", {
						version: latestVersion,
						percent: Math.round(state.progress),
					})
				: tMain("about.status.downloading", { version: latestVersion });
		case "downloaded":
			return state.installMode === "external-installer"
				? tMain("about.status.downloadedInstaller", { version: latestVersion })
				: tMain("about.status.downloadedReady", { version: latestVersion });
		case "no-update":
			return tMain("about.status.upToDate", { version: state.currentVersion });
		case "manual-download-required":
			return tMain("about.status.manual", { version: latestVersion });
		case "error":
			return state.error ?? tMain("about.status.error");
		default:
			return tMain("about.status.unsupported");
	}
}

async function showAboutScreenMintDialog() {
	const updater = getScreenMintUpdater();
	const buttons = [tMain("about.close"), tMain("menu.checkForUpdates")];

	const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
	const dialogOptions: Electron.MessageBoxOptions = {
		type: "info",
		buttons,
		defaultId: 1,
		cancelId: 0,
		title: tMain("menu.about"),
		message: `ScreenMint ${app.getVersion()}`,
		detail: getUpdateStatusDetail(),
		noLink: true,
	};
	const response = targetWindow
		? await dialog.showMessageBox(targetWindow, dialogOptions)
		: await dialog.showMessageBox(dialogOptions);

	if (response.response === 1) {
		void updater.checkForUpdates("manual");
	}
}

function setupApplicationMenu() {
	const isMac = process.platform === "darwin";
	const template: Electron.MenuItemConstructorOptions[] = [];

	if (isMac) {
		template.push({
			label: app.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" },
			],
		});
	}

	template.push(
		{
			label: tMain("menu.file"),
			submenu: [
				{
					label: tMain("menu.loadProject"),
					accelerator: "CmdOrCtrl+O",
					click: () => sendEditorMenuAction("menu-load-project"),
				},
				{
					label: tMain("menu.saveProject"),
					accelerator: "CmdOrCtrl+S",
					click: () => sendEditorMenuAction("menu-save-project"),
				},
				{
					label: tMain("menu.saveProjectAs"),
					accelerator: "CmdOrCtrl+Shift+S",
					click: () => sendEditorMenuAction("menu-save-project-as"),
				},
				...(isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const }]),
			],
		},
		{
			label: tMain("menu.edit"),
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: tMain("menu.view"),
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: tMain("menu.window"),
			submenu: isMac
				? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }]
				: [{ role: "minimize" }, { role: "close" }],
		},
		{
			label: tMain("menu.help"),
			submenu: [
				{
					label: tMain("menu.about"),
					click: () => {
						void showAboutScreenMintDialog();
					},
				},
				{
					label: tMain("menu.checkForUpdates"),
					click: () => {
						void getScreenMintUpdater().checkForUpdates("manual");
					},
				},
				{ type: "separator" },
				{
					label: tMain("menu.reportIssue"),
					click: () => {
						void shell.openExternal("https://github.com/Jahirsheikh12/screen-mint/issues/new");
					},
				},
			],
		},
	);

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

function createTray() {
	tray = new Tray(defaultTrayIcon);
	tray.on("click", () => focusOrCreateMainWindow());
}

function getPublicAssetPath(filename: string) {
	return path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename);
}

function getAppImage(filename: string) {
	return nativeImage.createFromPath(getPublicAssetPath(filename));
}

function getTrayIcon(filename: string) {
	return getAppImage(filename).resize({
		width: 24,
		height: 24,
		quality: "best",
	});
}

function syncDockIcon() {
	if (process.platform !== "darwin" || !app.dock) {
		return;
	}

	const dockIcon = getAppImage("app-icons/screenmint-512.png");
	if (!dockIcon.isEmpty()) {
		app.dock.setIcon(dockIcon);
	}
}

let trayShowsRecording = false;

function updateTrayMenu(recording: boolean = trayShowsRecording) {
	trayShowsRecording = recording;
	if (!tray) return;
	const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
	const trayToolTip = recording
		? tMain("tray.recording", { source: selectedSourceName })
		: "ScreenMint";
	const menuTemplate = recording
		? [
				{
					label: tMain("tray.stopRecording"),
					click: () => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.webContents.send("stop-recording-from-tray");
						}
					},
				},
			]
		: [
				{
					label: tMain("tray.open"),
					click: () => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							if (mainWindow.isMinimized()) mainWindow.restore();
							mainWindow.show();
							mainWindow.focus();
							mainWindow.moveTop();
						} else {
							createWindow();
						}
					},
				},
				{
					label: tMain("tray.quit"),
					click: () => {
						app.quit();
					},
				},
			];
	tray.setImage(trayIcon);
	tray.setToolTip(trayToolTip);
	tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

/** If the last session crashed mid-recording, offer the partial video. */
async function offerInterruptedRecordingRecovery() {
	const files = await takeInterruptedRecordings();
	if (files.length === 0) return;
	const { response } = await dialog.showMessageBox({
		type: "warning",
		buttons: [
			tMain("recovery.openInEditor"),
			tMain("recovery.showInFolder"),
			tMain("recovery.notNow"),
		],
		defaultId: 0,
		cancelId: 2,
		message: tMain("recovery.message"),
		detail: tMain("recovery.detail", { path: files[0] }),
	});
	if (response === 0) {
		adoptRecoveredRecording(files[0]);
		createEditorWindowWrapper();
	} else if (response === 1) {
		shell.showItemInFolder(files[0]);
	}
}

function createEditorWindowWrapper() {
	if (mainWindow && !mainWindow.isDestroyed()) {
		const outgoing = mainWindow;
		if (!isEditorWindow(outgoing)) {
			// HUD → Editor transition: fade the HUD out smoothly in parallel
			// with the editor's fade-in. Avoids macOS's shrink-to-dock animation.
			void fadeOutAndDestroyWindow(outgoing, 160);
		} else {
			closeEditorWindowBypassingUnsavedPrompt(outgoing);
		}
	}
	const editorWindow = createEditorWindow();
	mainWindow = editorWindow;
	editorHasUnsavedChanges = false;

	editorWindow.on("closed", () => {
		isForceClosing = false;
		// A replaced editor closes after its successor opened; leave the new window's state alone.
		if (mainWindow !== editorWindow) return;
		mainWindow = null;
		editorHasUnsavedChanges = false;
	});

	// The editor's beforeunload blocks unloads while there are unsaved changes. Once the user
	// has chosen Save & Close or Discard & Close here, that choice wins.
	editorWindow.webContents.on("will-prevent-unload", (event) => {
		if (isForceClosing) {
			event.preventDefault();
		}
	});

	editorWindow.on("close", (event) => {
		if (isForceClosing || !editorHasUnsavedChanges) {
			return;
		}

		event.preventDefault();

		const choice = dialog.showMessageBoxSync(editorWindow, {
			type: "warning",
			buttons: [
				tMain("unsavedChanges.saveAndClose"),
				tMain("unsavedChanges.discardAndClose"),
				tMain("unsavedChanges.cancel"),
			],
			defaultId: 0,
			cancelId: 2,
			title: tMain("unsavedChanges.title"),
			message: tMain("unsavedChanges.message"),
			detail: tMain("unsavedChanges.detail"),
		});

		if (choice === 0) {
			// Only one save-and-close can be pending; a repeated close replaces it.
			ipcMain.removeAllListeners("save-before-close-done");
			ipcMain.once("save-before-close-done", (_event, saved: boolean) => {
				if (saved) {
					closeEditorWindowBypassingUnsavedPrompt(editorWindow);
				}
			});
			editorWindow.webContents.send("request-save-before-close");
		} else if (choice === 1) {
			closeEditorWindowBypassingUnsavedPrompt(editorWindow);
		}
	});
}

function createSourceSelectorWindowWrapper() {
	sourceSelectorWindow = createSourceSelectorWindow();
	sourceSelectorWindow.on("closed", () => {
		sourceSelectorWindow = null;
	});
	return sourceSelectorWindow;
}

async function promptToMoveAppToApplications() {
	if (process.platform !== "darwin" || !app.isPackaged) {
		return;
	}

	const expectedBundlePath = path.join("/Applications", `${app.getName()}.app`);
	const currentBundlePath = path.resolve(process.execPath, "../../..");

	if (currentBundlePath === expectedBundlePath) {
		return;
	}

	const response = await dialog.showMessageBox({
		type: "warning",
		buttons: [tMain("moveToApplications.move"), tMain("moveToApplications.keep")],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
		title: tMain("moveToApplications.title"),
		message: tMain("moveToApplications.message"),
		detail: tMain("moveToApplications.detail"),
	});

	if (response.response !== 0) {
		return;
	}

	try {
		const moved = app.moveToApplicationsFolder?.();
		if (!moved) {
			await dialog.showMessageBox({
				type: "info",
				buttons: [tMain("moveToApplications.ok")],
				defaultId: 0,
				noLink: true,
				title: tMain("moveToApplications.manualTitle"),
				message: tMain("moveToApplications.manualMessage"),
				detail: tMain("moveToApplications.manualDetail"),
			});
		}
	} catch (error) {
		console.error("Failed to move ScreenMint to /Applications:", error);
	}
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on("before-quit", () => {
	killWgcCaptureProcess();
	stopNativeCaptureOnQuit();
});

app.on("window-all-closed", () => {
	// Keep app running (macOS behavior)
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	focusOrCreateMainWindow();
});

app.on("second-instance", () => {
	focusOrCreateMainWindow();
});

// Register all IPC handlers when app is ready
// Windows load only the app's own pages: links that try to open a window go to the system
// browser, and navigating to another origin is blocked.
app.on("web-contents-created", (_event, contents) => {
	contents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("https://") || url.startsWith("http://")) {
			void shell.openExternal(url);
		}
		return { action: "deny" };
	});
	contents.on("will-navigate", (event, url) => {
		const current = contents.getURL();
		if (current && new URL(url).origin !== new URL(current).origin) {
			event.preventDefault();
		}
	});
});

app.whenReady().then(async () => {
	// A second launch only hands focus to the running app (see "second-instance"); quit() is
	// asynchronous, so stop here before it builds a tray, windows or dialogs of its own.
	if (!hasSingleInstanceLock) return;
	loadStoredLocale(app.getPath("userData"));
	// The renderer owns the language choice; menus, tray and dialogs follow it.
	ipcMain.on(IPC_CHANNELS.system.setLocale, (_event, locale: unknown) => {
		if (!setMainLocale(locale)) return;
		saveLocale(app.getPath("userData"));
		setupApplicationMenu();
		updateTrayMenu();
	});
	const updater = getScreenMintUpdater();

	session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
		const allowed = ["media", "audioCapture", "microphone"];
		return allowed.includes(permission);
	});

	session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
		const allowed = ["media", "audioCapture", "microphone"];
		callback(allowed.includes(permission));
	});

	ipcMain.on("hud-overlay-close", () => {
		app.quit();
	});
	await promptToMoveAppToApplications();
	syncDockIcon();
	createTray();
	updateTrayMenu();
	setupApplicationMenu();
	// Ensure recordings directory exists
	await ensureRecordingsDir();
	await updater.init();
	const syncUpdateToast = (state: ReturnType<typeof updater.getState>) => {
		if (state.showUpdatePrompt && !state.showWhatsNew && !state.busy.recording) {
			showUpdateToastWindow();
		} else {
			closeUpdateToastWindow();
		}
	};
	updater.onStateChange(syncUpdateToast);
	syncUpdateToast(updater.getState());

	registerIpcHandlers(
		createEditorWindowWrapper,
		createSourceSelectorWindowWrapper,
		createHudOverlayWindowWrapper,
		() => mainWindow,
		() => sourceSelectorWindow,
		(recording: boolean, sourceName: string) => {
			selectedSourceName = sourceName;
			if (!tray) createTray();
			updateTrayMenu(recording);
			if (!recording) {
				if (mainWindow) mainWindow.restore();
			}
		},
	);
	void offerInterruptedRecordingRecovery();
	void sweepStaleExportTempFiles(app.getPath("temp"));

	// Register the display media handler so that renderer's getDisplayMedia()
	// calls land on the pre-selected source without showing a system picker.
	//
	// IMPORTANT: The callback must receive a plain { id, name } Video object.
	// Passing the full DesktopCapturerSource (with thumbnail, appIcon, etc.)
	// via an unsafe cast breaks Electron's internal cursor-constraint
	// propagation and causes cursor: 'never' from the renderer to be silently
	// ignored by the native capture pipeline.
	session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
		try {
			const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
			const sourceId = getSelectedSourceId();
			// A picked source that has since closed must fail, not silently record another screen.
			const source = sourceId ? sources.find((s) => s.id === sourceId) : sources[0];
			if (source) {
				callback({
					video: { id: source.id, name: source.name },
				});
			} else {
				callback({});
			}
		} catch (error) {
			console.error("setDisplayMediaRequestHandler error:", error);
			callback({});
		}
	});

	createWindow();
});
