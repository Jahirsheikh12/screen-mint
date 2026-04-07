import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import {
	computeHudCompactBounds,
	DEFAULT_HUD_COMPACT_LAYOUT,
	type HudCompactLayout,
} from "./hudCompactBounds";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

const APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(APP_ROOT, "dist");
const WINDOW_ICON_PATH = path.join(
	process.env.VITE_PUBLIC || RENDERER_DIST,
	"app-icons",
	"screenmint-512.png",
);

let hudOverlayWindow: BrowserWindow | null = null;
let hudOverlayHiddenFromCapture = true;
let hudOverlayCaptureProtectionLoaded = false;
let countdownWindow: BrowserWindow | null = null;
let areaOverlayWindow: BrowserWindow | null = null;
let highlightOverlayWindow: BrowserWindow | null = null;
let speakerNotesWindow: BrowserWindow | null = null;
let hudCompactLayout: HudCompactLayout = DEFAULT_HUD_COMPACT_LAYOUT;

const HUD_OVERLAY_SETTINGS_FILE = path.join(app.getPath("userData"), "hud-overlay-settings.json");

function isHudOverlayCaptureProtectionSupported(): boolean {
	return process.platform !== "linux";
}

function loadHudOverlayCaptureProtectionSetting(): boolean {
	if (hudOverlayCaptureProtectionLoaded) {
		return hudOverlayHiddenFromCapture;
	}

	hudOverlayCaptureProtectionLoaded = true;

	try {
		if (!fs.existsSync(HUD_OVERLAY_SETTINGS_FILE)) {
			return hudOverlayHiddenFromCapture;
		}

		const raw = fs.readFileSync(HUD_OVERLAY_SETTINGS_FILE, "utf-8");
		const parsed = JSON.parse(raw) as { hiddenFromCapture?: unknown };
		if (typeof parsed.hiddenFromCapture === "boolean") {
			hudOverlayHiddenFromCapture = parsed.hiddenFromCapture;
		}
	} catch {
		// Ignore settings read failures and fall back to defaults.
	}

	return hudOverlayHiddenFromCapture;
}

function persistHudOverlayCaptureProtectionSetting(enabled: boolean): void {
	try {
		fs.writeFileSync(
			HUD_OVERLAY_SETTINGS_FILE,
			JSON.stringify({ hiddenFromCapture: enabled }, null, 2),
			"utf-8",
		);
	} catch {
		// Ignore settings write failures and keep runtime state working.
	}
}

function getScreen() {
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

function getHudOverlayWorkArea() {
	if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
		return getScreen().getDisplayMatching(hudOverlayWindow.getBounds()).workArea;
	}

	return getScreen().getPrimaryDisplay().workArea;
}

function applyHudCompactBounds(): void {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}

	const bounds = computeHudCompactBounds(getHudOverlayWorkArea(), hudCompactLayout);
	const currentBounds = hudOverlayWindow.getBounds();
	if (
		currentBounds.x === bounds.x &&
		currentBounds.y === bounds.y &&
		currentBounds.width === bounds.width &&
		currentBounds.height === bounds.height
	) {
		return;
	}

	hudOverlayWindow.setBounds(bounds);
}

function pinOverlayWindow(win: BrowserWindow, allowFullscreenVisibility = true): void {
	win.setAlwaysOnTop(true, "screen-saver");
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: allowFullscreenVisibility });
	win.moveTop();
}

ipcMain.on("hud-overlay-hide", () => {
	if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
		hudOverlayWindow.minimize();
	}
});

ipcMain.handle("get-hud-overlay-capture-protection", () => {
	const enabled = loadHudOverlayCaptureProtectionSetting();

	return {
		success: true,
		enabled,
	};
});

ipcMain.handle("set-hud-overlay-capture-protection", (_event, enabled: boolean) => {
	loadHudOverlayCaptureProtectionSetting();
	hudOverlayHiddenFromCapture = Boolean(enabled);
	persistHudOverlayCaptureProtectionSetting(hudOverlayHiddenFromCapture);

	if (
		isHudOverlayCaptureProtectionSupported() &&
		hudOverlayWindow &&
		!hudOverlayWindow.isDestroyed()
	) {
		hudOverlayWindow.setContentProtection(hudOverlayHiddenFromCapture);
	}

	return {
		success: true,
		enabled: hudOverlayHiddenFromCapture,
	};
});

ipcMain.handle(
	"sync-hud-compact-layout",
	(_event, layout: { width: number; height: number } | null | undefined) => {
		if (!layout) {
			return;
		}

		const width = Math.round(layout.width);
		const height = Math.round(layout.height);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			return;
		}

		if (hudCompactLayout.width === width && hudCompactLayout.height === height) {
			return;
		}

		hudCompactLayout = { width, height };
		if (!hudContentVisible) {
			applyHudCompactBounds();
		}
	},
);

export function createHudOverlayWindow(): BrowserWindow {
	loadHudOverlayCaptureProtectionSetting();

	const compactBounds = computeHudCompactBounds(
		getScreen().getPrimaryDisplay().workArea,
		hudCompactLayout,
	);

	const win = new BrowserWindow({
		width: compactBounds.width,
		height: compactBounds.height,
		x: compactBounds.x,
		y: compactBounds.y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	pinOverlayWindow(win);

	if (isHudOverlayCaptureProtectionSupported()) {
		win.setContentProtection(hudOverlayHiddenFromCapture);
	}

	// Smooth fade-in on ready — prevents black/white flash on transparent window
	win.once("ready-to-show", () => {
		if (win.isDestroyed()) return;
		win.setOpacity(0);
		win.show();
		const startTime = Date.now();
		const duration = 150;
		const fadeIn = setInterval(() => {
			if (win.isDestroyed()) {
				clearInterval(fadeIn);
				return;
			}
			const elapsed = Date.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			const eased = 1 - (1 - progress) * (1 - progress);
			win.setOpacity(eased);
			if (progress >= 1) clearInterval(fadeIn);
		}, 16);
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	hudOverlayWindow = win;

	win.on("closed", () => {
		if (hudOverlayWindow === win) {
			hudOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=hud-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "hud-overlay" },
		});
	}

	return win;
}

export function createEditorWindow(): BrowserWindow {
	const isMac = process.platform === "darwin";

	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		...(process.platform !== "darwin" && {
			icon: WINDOW_ICON_PATH,
		}),
		...(isMac && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 12, y: 12 },
		}),
		transparent: false,
		resizable: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		title: "ScreenMint",
		show: false,
		backgroundColor: "#000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: false,
		},
	});

	win.once("ready-to-show", () => {
		win.setOpacity(0);
		win.show();
		win.maximize();
		// Smooth fade-in after maximize — fast ease-in curve
		const startTime = Date.now();
		const duration = 180; // ms
		const fadeIn = setInterval(() => {
			if (win.isDestroyed()) {
				clearInterval(fadeIn);
				return;
			}
			const elapsed = Date.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			// Ease-out curve for natural feel
			const eased = 1 - (1 - progress) * (1 - progress);
			win.setOpacity(eased);
			if (progress >= 1) clearInterval(fadeIn);
		}, 16);
	});

	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", new Date().toLocaleString());
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=editor");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "editor" },
		});
	}

	return win;
}

export function createSourceSelectorWindow(): BrowserWindow {
	const { width, height } = getScreen().getPrimaryDisplay().workAreaSize;

	const win = new BrowserWindow({
		width: 620,
		height: 420,
		minHeight: 350,
		maxHeight: 500,
		x: Math.round((width - 620) / 2),
		y: Math.round((height - 420) / 2),
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		transparent: true,
		show: false,
		...(process.platform !== "darwin" && {
			icon: WINDOW_ICON_PATH,
		}),
		backgroundColor: "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	win.once("ready-to-show", () => {
		if (!win.isDestroyed()) {
			win.show();
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=source-selector");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "source-selector" },
		});
	}

	return win;
}

export function createSpeakerNotesWindow(text: string): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { workArea } = primaryDisplay;

	if (speakerNotesWindow && !speakerNotesWindow.isDestroyed()) {
		speakerNotesWindow.webContents.send("speaker-notes-updated", { text });
		speakerNotesWindow.show();
		speakerNotesWindow.focus();
		return speakerNotesWindow;
	}

	const width = 360;
	const height = 320;
	const x = Math.floor(workArea.x + workArea.width - width - 20);
	const y = Math.floor(workArea.y + 20);

	const win = new BrowserWindow({
		width,
		height,
		x,
		y,
		frame: false,
		transparent: true,
		resizable: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			backgroundThrottling: false,
		},
	});

	pinOverlayWindow(win, true);
	if (isHudOverlayCaptureProtectionSupported()) {
		win.setContentProtection(true);
	}

	speakerNotesWindow = win;
	win.on("closed", () => {
		if (speakerNotesWindow === win) {
			speakerNotesWindow = null;
		}
	});

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.webContents.send("speaker-notes-updated", { text });
			win.show();
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=speaker-notes");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "speaker-notes" },
		});
	}

	return win;
}

export function updateSpeakerNotesWindow(text: string): void {
	if (speakerNotesWindow && !speakerNotesWindow.isDestroyed()) {
		speakerNotesWindow.webContents.send("speaker-notes-updated", { text });
	}
}

export function closeSpeakerNotesWindow(): void {
	if (speakerNotesWindow && !speakerNotesWindow.isDestroyed()) {
		speakerNotesWindow.close();
		speakerNotesWindow = null;
	}
}

export function createCountdownWindow(): BrowserWindow {
	const primaryDisplay = getScreen().getPrimaryDisplay();
	const { width, height } = primaryDisplay.workAreaSize;

	const windowSize = 300;
	const x = Math.floor((width - windowSize) / 2);
	const y = Math.floor((height - windowSize) / 2);

	const win = new BrowserWindow({
		width: windowSize,
		height: windowSize,
		x: x,
		y: y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	countdownWindow = win;
	pinOverlayWindow(win);

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.show();
		}
	});

	win.on("closed", () => {
		if (countdownWindow === win) {
			countdownWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=countdown");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "countdown" },
		});
	}

	return win;
}

export function getCountdownWindow(): BrowserWindow | null {
	return countdownWindow;
}

export function closeCountdownWindow(): void {
	if (countdownWindow && !countdownWindow.isDestroyed()) {
		countdownWindow.close();
		countdownWindow = null;
	}
}

export function getHudOverlayWindow(): BrowserWindow | null {
	return hudOverlayWindow;
}

export function createAreaOverlayWindow(displayId?: number): BrowserWindow {
	const targetDisplay =
		(typeof displayId === "number"
			? getScreen()
					.getAllDisplays()
					.find((display) => display.id === displayId)
			: null) ?? getScreen().getPrimaryDisplay();

	if (areaOverlayWindow && !areaOverlayWindow.isDestroyed()) {
		const bounds = areaOverlayWindow.getBounds();
		if (
			bounds.x === targetDisplay.bounds.x &&
			bounds.y === targetDisplay.bounds.y &&
			bounds.width === targetDisplay.bounds.width &&
			bounds.height === targetDisplay.bounds.height
		) {
			areaOverlayWindow.focus();
			return areaOverlayWindow;
		}

		areaOverlayWindow.close();
		areaOverlayWindow = null;
	}

	const { bounds } = targetDisplay;

	const win = new BrowserWindow({
		width: bounds.width,
		height: bounds.height,
		x: bounds.x,
		y: bounds.y,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	areaOverlayWindow = win;
	pinOverlayWindow(win);

	win.webContents.on("did-finish-load", () => {
		if (!win.isDestroyed()) {
			win.show();
		}
	});

	win.on("closed", () => {
		if (areaOverlayWindow === win) {
			areaOverlayWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=area-overlay");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "area-overlay" },
		});
	}

	return win;
}

export function closeAreaOverlayWindow(): void {
	if (areaOverlayWindow && !areaOverlayWindow.isDestroyed()) {
		areaOverlayWindow.close();
		areaOverlayWindow = null;
	}
}

export function createHighlightOverlayWindow(rect: {
	x: number;
	y: number;
	width: number;
	height: number;
}): BrowserWindow {
	closeHighlightOverlayWindow();

	const borderWidth = 3;
	const win = new BrowserWindow({
		x: rect.x - borderWidth,
		y: rect.y - borderWidth,
		width: rect.width + borderWidth * 2,
		height: rect.height + borderWidth * 2,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		hasShadow: false,
		focusable: false,
		show: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	win.setIgnoreMouseEvents(true);
	pinOverlayWindow(win);

	// Render a colored border using inline HTML
	win.loadURL(
		`data:text/html,<html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><div style="position:fixed;inset:0;border:${borderWidth}px solid rgba(245,158,11,0.6);border-radius:4px;pointer-events:none;"></div></body></html>`,
	);

	highlightOverlayWindow = win;

	win.on("closed", () => {
		if (highlightOverlayWindow === win) {
			highlightOverlayWindow = null;
		}
	});

	return win;
}

export function closeHighlightOverlayWindow(): void {
	if (highlightOverlayWindow && !highlightOverlayWindow.isDestroyed()) {
		highlightOverlayWindow.close();
		highlightOverlayWindow = null;
	}
}

// Resize HUD window — toggle between slim toolbar and fullscreen overlay
let hudContentVisible = false;

ipcMain.handle("resize-hud-window", (_event, contentVisible: boolean) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) return;

	// Skip if already in the desired state — prevents redundant setBounds flicker
	if (contentVisible === hudContentVisible) return;
	hudContentVisible = contentVisible;

	const primaryDisplay = getScreen().getPrimaryDisplay();
	const workArea =
		getScreen().getDisplayMatching(hudOverlayWindow.getBounds()).workArea ??
		primaryDisplay.workArea;

	if (contentVisible) {
		hudOverlayWindow.setBounds({
			x: workArea.x,
			y: workArea.y,
			width: workArea.width,
			height: workArea.height,
		});
	} else {
		applyHudCompactBounds();
	}
});
