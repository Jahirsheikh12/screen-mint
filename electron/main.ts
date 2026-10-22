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
import { sweepStaleExportTempFiles } from "./exportTemp";
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
			return "Checking for updates…";
		case "available":
			return `Version ${latestVersion} is available. Use Check for Updates to open the update window.`;
		case "downloading":
			return `Downloading version ${latestVersion}${typeof state.progress === "number" ? ` (${Math.round(state.progress)}%)` : ""}.`;
		case "downloaded":
			return state.installMode === "external-installer"
				? `Version ${latestVersion} has been downloaded. Open the update window to continue.`
				: `Version ${latestVersion} has been downloaded and is ready to install from the update window.`;
		case "no-update":
			return `You’re up to date on version ${state.currentVersion}.`;
		case "manual-download-required":
			return `Version ${latestVersion} is available to download manually from GitHub Releases.`;
		case "error":
			return state.error ?? "Unable to check for updates right now.";
		default:
			return "Automatic updates are available in packaged builds.";
	}
}

async function showAboutScreenMintDialog() {
	const updater = getScreenMintUpdater();
	const buttons = ["Close", "Check for Updates…"];

	const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
	const dialogOptions: Electron.MessageBoxOptions = {
		type: "info",
		buttons,
		defaultId: buttons.length - 1,
		cancelId: buttons.indexOf("Close"),
		title: "About ScreenMint",
		message: `ScreenMint ${app.getVersion()}`,
		detail: getUpdateStatusDetail(),
		noLink: true,
	};
	const response = targetWindow
		? await dialog.showMessageBox(targetWindow, dialogOptions)
		: await dialog.showMessageBox(dialogOptions);

	const selectedButton = buttons[response.response];
	if (selectedButton === "Check for Updates…") {
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
			label: "File",
			submenu: [
				{
					label: "Load Project…",
					accelerator: "CmdOrCtrl+O",
					click: () => sendEditorMenuAction("menu-load-project"),
				},
				{
					label: "Save Project…",
					accelerator: "CmdOrCtrl+S",
					click: () => sendEditorMenuAction("menu-save-project"),
				},
				{
					label: "Save Project As…",
					accelerator: "CmdOrCtrl+Shift+S",
					click: () => sendEditorMenuAction("menu-save-project-as"),
				},
				...(isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const }]),
			],
		},
		{
			label: "Edit",
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
			label: "View",
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
			label: "Window",
			submenu: isMac
				? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }]
				: [{ role: "minimize" }, { role: "close" }],
		},
		{
			label: "Help",
			submenu: [
				{
					label: "About ScreenMint",
					click: () => {
						void showAboutScreenMintDialog();
					},
				},
				{
					label: "Check for Updates…",
					click: () => {
						void getScreenMintUpdater().checkForUpdates("manual");
					},
				},
				{ type: "separator" },
				{
					label: "Report an Issue…",
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

function updateTrayMenu(recording: boolean = false) {
	if (!tray) return;
	const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
	const trayToolTip = recording ? `Recording: ${selectedSourceName}` : "ScreenMint";
	const menuTemplate = recording
		? [
				{
					label: "Stop Recording",
					click: () => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.webContents.send("stop-recording-from-tray");
						}
					},
				},
			]
		: [
				{
					label: "Open",
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
					label: "Quit",
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
		buttons: ["Open in Editor", "Show in Folder", "Not Now"],
		defaultId: 0,
		cancelId: 2,
		message: "ScreenMint closed while recording",
		detail: `Your last recording stopped unexpectedly. The part that was saved is here:\n${files[0]}`,
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
			buttons: ["Save & Close", "Discard & Close", "Cancel"],
			defaultId: 0,
			cancelId: 2,
			title: "Unsaved Changes",
			message: "You have unsaved changes.",
			detail: "Do you want to save your project before closing?",
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
		buttons: ["Move to Applications", "Keep Current Location"],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
		title: "Move ScreenMint to Applications",
		message: "Move ScreenMint to /Applications for more stable macOS capture permissions.",
		detail:
			"Unsigned macOS builds keep Screen Recording permissions more reliably when ScreenMint stays installed at /Applications/ScreenMint.app. Running from Downloads, Desktop, or a mounted DMG can cause repeated prompts and blank source lists.",
	});

	if (response.response !== 0) {
		return;
	}

	try {
		const moved = app.moveToApplicationsFolder?.();
		if (!moved) {
			await dialog.showMessageBox({
				type: "info",
				buttons: ["OK"],
				defaultId: 0,
				noLink: true,
				title: "Move ScreenMint Manually",
				message: "Move ScreenMint to /Applications before using screen capture.",
				detail:
					"macOS did not move the app automatically. Drag ScreenMint.app into /Applications, then relaunch it from there.",
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
