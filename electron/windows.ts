import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../src/electron-ipc/contracts";
import {
	computeHudCompactBounds,
	DEFAULT_HUD_COMPACT_LAYOUT,
	type HudCompactLayout,
	type RectLike,
	reserveHudCompactWindowHeight,
} from "./hudCompactBounds";
import { shouldEnableHudMousePassthrough } from "./hudMousePassthrough";

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
let speakerNotesWindow: BrowserWindow | null = null;
let exportWorkerWindow: BrowserWindow | null = null;
let hudCompactLayout: HudCompactLayout = DEFAULT_HUD_COMPACT_LAYOUT;
let hudContentVisible = false;
let hudDropdownExpanded = false;
let hudMousePassthroughRequested = false;
let hudMousePassthroughApplied = false;
let hudPositionManuallyMoved = false;
let hudDragState: {
	startPointer: { x: number; y: number };
	startBounds: { x: number; y: number; width: number; height: number };
} | null = null;

const HUD_COMPACT_WINDOW_MIN_HEIGHT = 640;

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

function getCursorDisplayWorkArea() {
	try {
		const cursor = getScreen().getCursorScreenPoint();
		return getScreen().getDisplayNearestPoint(cursor).workArea;
	} catch {
		return getScreen().getPrimaryDisplay().workArea;
	}
}

function getHudOverlayWorkArea() {
	if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
		return getScreen().getDisplayMatching(hudOverlayWindow.getBounds()).workArea;
	}

	return getCursorDisplayWorkArea();
}

function clampBoundsToWorkArea(bounds: RectLike, workArea: RectLike): RectLike {
	const maxX = Math.max(workArea.x, workArea.x + workArea.width - bounds.width);
	const maxY = Math.max(workArea.y, workArea.y + workArea.height - bounds.height);

	return {
		x: Math.min(Math.max(Math.round(bounds.x), workArea.x), maxX),
		y: Math.min(Math.max(Math.round(bounds.y), workArea.y), maxY),
		width: bounds.width,
		height: bounds.height,
	};
}

function getHudBoundsPreservingBottom(width: number, height: number, workArea: RectLike): RectLike {
	const currentBounds = hudOverlayWindow?.getBounds();
	const bottom = currentBounds
		? currentBounds.y + currentBounds.height
		: workArea.y + workArea.height;

	return clampBoundsToWorkArea(
		{
			x: currentBounds?.x ?? workArea.x + Math.floor((workArea.width - width) / 2),
			y: bottom - height,
			width,
			height,
		},
		workArea,
	);
}

function getHudCompactWindowLayout(): HudCompactLayout {
	return reserveHudCompactWindowHeight(hudCompactLayout, HUD_COMPACT_WINDOW_MIN_HEIGHT);
}

function applyHudCompactBounds(): void {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}

	const workArea = getHudOverlayWorkArea();
	const computedBounds = computeHudCompactBounds(workArea, getHudCompactWindowLayout());
	const bounds = hudPositionManuallyMoved
		? getHudBoundsPreservingBottom(computedBounds.width, computedBounds.height, workArea)
		: computedBounds;
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

function applyHudMousePassthrough(): void {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) {
		return;
	}

	const enabled = shouldEnableHudMousePassthrough({
		dragActive: hudDragState !== null,
		contentVisible: hudContentVisible,
		dropdownExpanded: hudDropdownExpanded,
		passthroughRequested: hudMousePassthroughRequested,
	});
	if (enabled === hudMousePassthroughApplied) {
		return;
	}

	hudMousePassthroughApplied = enabled;
	hudOverlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
}

function coerceScreenPoint(point: unknown): { x: number; y: number } | null {
	if (!point || typeof point !== "object") {
		return null;
	}

	const maybePoint = point as { screenX?: unknown; screenY?: unknown };
	const x = Number(maybePoint.screenX);
	const y = Number(maybePoint.screenY);
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}

	return { x, y };
}

function clampHudBoundsToPointDisplay(
	x: number,
	y: number,
	width: number,
	height: number,
	pointer: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
	const workArea = getScreen().getDisplayNearestPoint(pointer).workArea;
	const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
	const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);
	const clampedX = Math.min(Math.max(Math.round(x), workArea.x), maxX);
	const clampedY = Math.min(Math.max(Math.round(y), workArea.y), maxY);

	return {
		x: clampedX,
		y: clampedY,
		width,
		height,
	};
}

function pinOverlayWindow(win: BrowserWindow, allowFullscreenVisibility = true): void {
	win.setAlwaysOnTop(true, "screen-saver");
	win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: allowFullscreenVisibility });
	win.moveTop();
}

ipcMain.on("hud-overlay-hide", () => {
	const win = hudOverlayWindow;
	if (!win || win.isDestroyed()) {
		return;
	}

	const duration = 140;
	const startTime = Date.now();
	const startOpacity = win.getOpacity();
	const interval = setInterval(() => {
		if (!win || win.isDestroyed()) {
			clearInterval(interval);
			return;
		}
		const elapsed = Date.now() - startTime;
		const progress = Math.min(1, elapsed / duration);
		const eased = progress * progress;
		win.setOpacity(startOpacity * (1 - eased));
		if (progress >= 1) {
			clearInterval(interval);
			if (!win.isDestroyed()) {
				win.minimize();
				win.setOpacity(startOpacity);
			}
		}
	}, 16);
});

ipcMain.handle(IPC_CHANNELS.hudOverlay.getCaptureProtection, () => {
	const enabled = loadHudOverlayCaptureProtectionSetting();

	return {
		success: true,
		enabled,
	};
});

ipcMain.handle(IPC_CHANNELS.hudOverlay.setCaptureProtection, (_event, enabled: boolean) => {
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
	IPC_CHANNELS.hudWindow.syncCompactLayout,
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
		if (hudContentVisible) {
			return;
		}
		applyHudCompactBounds();
	},
);

export function createHudOverlayWindow(): BrowserWindow {
	loadHudOverlayCaptureProtectionSetting();
	bindDisplayChangeListeners();

	const compactBounds = computeHudCompactBounds(
		getCursorDisplayWorkArea(),
		getHudCompactWindowLayout(),
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

	win.on("restore", () => {
		moveHudToCursorDisplay();
	});

	win.on("show", () => {
		moveHudToCursorDisplay();
	});

	win.on("closed", () => {
		if (hudOverlayWindow === win) {
			hudOverlayWindow = null;
			hudMousePassthroughApplied = false;
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

export function createExportWorkerWindow(): BrowserWindow {
	if (exportWorkerWindow && !exportWorkerWindow.isDestroyed()) {
		return exportWorkerWindow;
	}

	const win = new BrowserWindow({
		width: 640,
		height: 360,
		show: false,
		frame: false,
		transparent: false,
		resizable: false,
		skipTaskbar: true,
		backgroundColor: "#000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: false,
		},
	});

	exportWorkerWindow = win;
	win.on("closed", () => {
		if (exportWorkerWindow === win) {
			exportWorkerWindow = null;
		}
	});

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL + "?windowType=export-worker");
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"), {
			query: { windowType: "export-worker" },
		});
	}

	return win;
}

export function closeExportWorkerWindow(): void {
	if (exportWorkerWindow && !exportWorkerWindow.isDestroyed()) {
		exportWorkerWindow.close();
	}
	exportWorkerWindow = null;
}

export function createSourceSelectorWindow(): BrowserWindow {
	const cursorWorkArea = getCursorDisplayWorkArea();
	const winWidth = Math.min(820, Math.max(720, Math.round(cursorWorkArea.width * 0.6)));
	const winHeight = Math.min(680, Math.max(580, Math.round(cursorWorkArea.height * 0.72)));

	const win = new BrowserWindow({
		width: winWidth,
		height: winHeight,
		minWidth: 640,
		minHeight: 540,
		maxWidth: 1040,
		maxHeight: 820,
		x: Math.round(cursorWorkArea.x + (cursorWorkArea.width - winWidth) / 2),
		y: Math.round(cursorWorkArea.y + (cursorWorkArea.height - winHeight) / 2),
		frame: false,
		resizable: true,
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
	const cursor = getScreen().getCursorScreenPoint();
	const targetDisplay = getScreen().getDisplayNearestPoint(cursor);
	const { width, height, x: workX, y: workY } = targetDisplay.workArea;

	const windowSize = Math.max(240, Math.min(420, Math.round(Math.min(width, height) * 0.2)));
	const x = Math.floor(workX + (width - windowSize) / 2);
	const y = Math.floor(workY + (height - windowSize) / 2);

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

export function fadeOutAndDestroyWindow(win: BrowserWindow | null, duration = 160): Promise<void> {
	return new Promise((resolve) => {
		if (!win || win.isDestroyed()) {
			resolve();
			return;
		}
		try {
			win.setIgnoreMouseEvents(true);
		} catch {
			// Some window types may not support this; ignore.
		}
		const startTime = Date.now();
		const startOpacity = win.getOpacity();
		const interval = setInterval(() => {
			if (win.isDestroyed()) {
				clearInterval(interval);
				resolve();
				return;
			}
			const elapsed = Date.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			const eased = progress * progress;
			win.setOpacity(startOpacity * (1 - eased));
			if (progress >= 1) {
				clearInterval(interval);
				if (!win.isDestroyed()) {
					win.destroy();
				}
				resolve();
			}
		}, 16);
	});
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
			unlockAreaOverlayWindow();
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
	// Exclude the area overlay from screen capture so the amber border is visible
	// on-screen but never baked into the recorded video.
	if (isHudOverlayCaptureProtectionSupported()) {
		win.setContentProtection(true);
	}

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

export function lockAreaOverlayWindow(): void {
	if (!areaOverlayWindow || areaOverlayWindow.isDestroyed()) return;
	areaOverlayWindow.setIgnoreMouseEvents(true, { forward: true });
	areaOverlayWindow.setFocusable(false);
	areaOverlayWindow.webContents.send("area-overlay-phase", "locked");
}

export function unlockAreaOverlayWindow(): void {
	if (!areaOverlayWindow || areaOverlayWindow.isDestroyed()) return;
	areaOverlayWindow.setIgnoreMouseEvents(false);
	areaOverlayWindow.setFocusable(true);
	areaOverlayWindow.focus();
	areaOverlayWindow.webContents.send("area-overlay-phase", "selecting");
}

// Resize HUD window — toggle between slim toolbar and fullscreen overlay

let displayChangeListenersBound = false;

function refreshOverlaysForDisplayChange(): void {
	moveHudToCursorDisplay();

	if (areaOverlayWindow && !areaOverlayWindow.isDestroyed()) {
		const display = getScreen().getDisplayMatching(areaOverlayWindow.getBounds());
		areaOverlayWindow.setBounds({
			x: display.bounds.x,
			y: display.bounds.y,
			width: display.bounds.width,
			height: display.bounds.height,
		});
		areaOverlayWindow.webContents.send("display-metrics-changed");
	}

	if (countdownWindow && !countdownWindow.isDestroyed()) {
		const display = getScreen().getDisplayMatching(countdownWindow.getBounds());
		const { width: waw, height: wah, x: wax, y: way } = display.workArea;
		const size = Math.max(240, Math.min(420, Math.round(Math.min(waw, wah) * 0.2)));
		countdownWindow.setBounds({
			width: size,
			height: size,
			x: Math.floor(wax + (waw - size) / 2),
			y: Math.floor(way + (wah - size) / 2),
		});
	}
}

function bindDisplayChangeListeners(): void {
	if (displayChangeListenersBound) return;
	displayChangeListenersBound = true;
	const screen = getScreen();
	screen.on("display-metrics-changed", refreshOverlaysForDisplayChange);
	screen.on("display-added", refreshOverlaysForDisplayChange);
	screen.on("display-removed", refreshOverlaysForDisplayChange);
}

function moveHudToCursorDisplay(): void {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) return;
	if (hudContentVisible) return;

	const workArea = getCursorDisplayWorkArea();
	hudPositionManuallyMoved = false;
	const bounds = computeHudCompactBounds(workArea, getHudCompactWindowLayout());
	hudOverlayWindow.setBounds(bounds);
}

ipcMain.handle(IPC_CHANNELS.hudWindow.recenterOnCursor, () => {
	moveHudToCursorDisplay();
});

ipcMain.handle(IPC_CHANNELS.hudWindow.setDropdownExpanded, (_event, expanded: boolean) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) return;

	const next = Boolean(expanded);
	if (next === hudDropdownExpanded) return;
	hudDropdownExpanded = next;
	applyHudMousePassthrough();

	// Don't fight the fullscreen content overlay — it owns the bounds while open.
	if (hudContentVisible) return;
});

ipcMain.handle(IPC_CHANNELS.hudWindow.setMousePassthrough, (_event, enabled: boolean) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) return;

	hudMousePassthroughRequested = Boolean(enabled);
	applyHudMousePassthrough();
});

ipcMain.on(IPC_CHANNELS.hudWindow.startDrag, (_event, point: unknown) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed() || hudContentVisible) return;

	const startPointer = coerceScreenPoint(point);
	if (!startPointer) return;

	hudDragState = {
		startPointer,
		startBounds: hudOverlayWindow.getBounds(),
	};
	hudPositionManuallyMoved = true;
	applyHudMousePassthrough();
});

ipcMain.on(IPC_CHANNELS.hudWindow.moveDrag, (_event, point: unknown) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed() || !hudDragState) return;

	const pointer = coerceScreenPoint(point);
	if (!pointer) return;

	const dx = pointer.x - hudDragState.startPointer.x;
	const dy = pointer.y - hudDragState.startPointer.y;
	const { startBounds } = hudDragState;
	hudOverlayWindow.setBounds(
		clampHudBoundsToPointDisplay(
			startBounds.x + dx,
			startBounds.y + dy,
			startBounds.width,
			startBounds.height,
			pointer,
		),
	);
});

ipcMain.on(IPC_CHANNELS.hudWindow.endDrag, () => {
	if (!hudDragState) return;

	hudDragState = null;
	applyHudMousePassthrough();
});

ipcMain.handle(IPC_CHANNELS.hudWindow.resize, (_event, contentVisible: boolean) => {
	if (!hudOverlayWindow || hudOverlayWindow.isDestroyed()) return;

	// Skip if already in the desired state — prevents redundant setBounds flicker
	if (contentVisible === hudContentVisible) return;
	hudContentVisible = contentVisible;
	applyHudMousePassthrough();

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
