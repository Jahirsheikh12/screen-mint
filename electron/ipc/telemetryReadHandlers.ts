import fs from "node:fs/promises";
import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";

type WindowBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type CursorInteractionType =
	| "move"
	| "mousedown"
	| "drag-start"
	| "drag"
	| "drag-end"
	| "click"
	| "double-click"
	| "right-click"
	| "middle-click"
	| "mouseup";

type CursorVisualType =
	| "arrow"
	| "text"
	| "pointer"
	| "crosshair"
	| "open-hand"
	| "closed-hand"
	| "resize-ew"
	| "resize-ns"
	| "resize-nesw"
	| "not-allowed"
	| "copy"
	| "help"
	| "move"
	| "zoom-in"
	| "zoom-out"
	| "screenshot-selection"
	| "unknown";

type KeyboardTelemetryEventType = "keydown" | "keyup";
type KeyboardTelemetryPlatform = "darwin" | "win32" | "linux";
type CursorCapturePlatform = "darwin" | "win32" | "linux";
type CursorTelemetryGeometrySource =
	| "electron-display"
	| "selected-area"
	| "win32-window"
	| "x11-window"
	| "macos-window"
	| "fallback-display";

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	interactionType?: CursorInteractionType;
	cursorType?: CursorVisualType;
	rawX?: number;
	rawY?: number;
	origin?: "hook" | "poll" | "native-monitor";
	confidence?: "high" | "medium" | "low";
	sourceBounds?: WindowBounds;
	displayBounds?: WindowBounds;
	sourceDisplayId?: number;
	displayScaleFactor?: number;
	captureMode?: "display" | "window" | "area";
	capturePlatform?: CursorCapturePlatform;
	geometrySource?: CursorTelemetryGeometrySource;
	projectionConfidence?: "high" | "medium" | "low";
}

interface KeyboardTelemetryPoint {
	timeMs: number;
	type: KeyboardTelemetryEventType;
	key: string;
	keycode: number;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

type RegisterTelemetryReadHandlersOptions = {
	getSystemCursorAssets: () => Promise<Record<string, unknown>>;
	getCurrentVideoPath: () => string | null;
	getTelemetryPathForVideo: (videoPath: string) => string;
	getKeyboardTelemetryPathForVideo: (videoPath: string) => string;
	normalizeVideoSourcePath: (videoPath?: string | null) => string | null;
	isCursorVisualType: (value: string) => value is CursorVisualType;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalizeKeyboardPlatform(rawPlatform: unknown): KeyboardTelemetryPlatform {
	if (rawPlatform === "darwin" || rawPlatform === "linux") {
		return rawPlatform;
	}

	return "win32";
}

function sanitizeTelemetryBounds(value: unknown): WindowBounds | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const candidate = value as Partial<WindowBounds>;
	if (
		typeof candidate.x !== "number" ||
		!Number.isFinite(candidate.x) ||
		typeof candidate.y !== "number" ||
		!Number.isFinite(candidate.y) ||
		typeof candidate.width !== "number" ||
		!Number.isFinite(candidate.width) ||
		typeof candidate.height !== "number" ||
		!Number.isFinite(candidate.height) ||
		candidate.width <= 0 ||
		candidate.height <= 0
	) {
		return undefined;
	}

	return {
		x: candidate.x,
		y: candidate.y,
		width: candidate.width,
		height: candidate.height,
	};
}

export function registerTelemetryReadIpcHandlers(options: RegisterTelemetryReadHandlersOptions) {
	ipcMain.handle(IPC_CHANNELS.telemetry.getSystemCursorAssets, async () => {
		try {
			return { success: true, cursors: await options.getSystemCursorAssets() };
		} catch (error) {
			console.error("Failed to load system cursor assets:", error);
			return { success: false, cursors: {}, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.telemetry.getCursor, async (_, videoPath?: string) => {
		const targetVideoPath = options.normalizeVideoSourcePath(
			videoPath ?? options.getCurrentVideoPath(),
		);
		if (!targetVideoPath) {
			return { success: true, samples: [] };
		}

		const telemetryPath = options.getTelemetryPathForVideo(targetVideoPath);
		try {
			const content = await fs.readFile(telemetryPath, "utf-8");
			const parsed = JSON.parse(content);
			const rawSamples = Array.isArray(parsed)
				? parsed
				: Array.isArray(parsed?.samples)
					? parsed.samples
					: [];

			const samples: CursorTelemetryPoint[] = rawSamples
				.filter((sample: unknown) => Boolean(sample && typeof sample === "object"))
				.map((sample: unknown) => {
					const point = sample as Partial<CursorTelemetryPoint>;
					return {
						timeMs:
							typeof point.timeMs === "number" && Number.isFinite(point.timeMs)
								? Math.max(0, point.timeMs)
								: 0,
						cx:
							typeof point.cx === "number" && Number.isFinite(point.cx)
								? clamp(point.cx, 0, 1)
								: 0.5,
						cy:
							typeof point.cy === "number" && Number.isFinite(point.cy)
								? clamp(point.cy, 0, 1)
								: 0.5,
						interactionType:
							point.interactionType === "mousedown" ||
							point.interactionType === "drag-start" ||
							point.interactionType === "drag" ||
							point.interactionType === "drag-end" ||
							point.interactionType === "click" ||
							point.interactionType === "double-click" ||
							point.interactionType === "right-click" ||
							point.interactionType === "middle-click" ||
							point.interactionType === "move" ||
							point.interactionType === "mouseup"
								? point.interactionType
								: undefined,
						cursorType:
							typeof point.cursorType === "string" && options.isCursorVisualType(point.cursorType)
								? point.cursorType
								: undefined,
						rawX:
							typeof point.rawX === "number" && Number.isFinite(point.rawX)
								? point.rawX
								: undefined,
						rawY:
							typeof point.rawY === "number" && Number.isFinite(point.rawY)
								? point.rawY
								: undefined,
						origin:
							point.origin === "hook" ||
							point.origin === "poll" ||
							point.origin === "native-monitor"
								? point.origin
								: undefined,
						confidence:
							point.confidence === "high" ||
							point.confidence === "medium" ||
							point.confidence === "low"
								? point.confidence
								: undefined,
						sourceBounds: sanitizeTelemetryBounds(point.sourceBounds),
						displayBounds: sanitizeTelemetryBounds(point.displayBounds),
						sourceDisplayId:
							typeof point.sourceDisplayId === "number" && Number.isFinite(point.sourceDisplayId)
								? point.sourceDisplayId
								: undefined,
						displayScaleFactor:
							typeof point.displayScaleFactor === "number" &&
							Number.isFinite(point.displayScaleFactor) &&
							point.displayScaleFactor > 0
								? point.displayScaleFactor
								: undefined,
						captureMode:
							point.captureMode === "display" ||
							point.captureMode === "window" ||
							point.captureMode === "area"
								? point.captureMode
								: undefined,
						capturePlatform:
							point.capturePlatform === "darwin" ||
							point.capturePlatform === "win32" ||
							point.capturePlatform === "linux"
								? point.capturePlatform
								: undefined,
						geometrySource:
							point.geometrySource === "electron-display" ||
							point.geometrySource === "selected-area" ||
							point.geometrySource === "win32-window" ||
							point.geometrySource === "x11-window" ||
							point.geometrySource === "macos-window" ||
							point.geometrySource === "fallback-display"
								? point.geometrySource
								: undefined,
						projectionConfidence:
							point.projectionConfidence === "high" ||
							point.projectionConfidence === "medium" ||
							point.projectionConfidence === "low"
								? point.projectionConfidence
								: undefined,
					};
				})
				.sort((a: CursorTelemetryPoint, b: CursorTelemetryPoint) => a.timeMs - b.timeMs);

			return { success: true, samples };
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				return { success: true, samples: [] };
			}
			console.error("Failed to load cursor telemetry:", error);
			return {
				success: false,
				message: "Failed to load cursor telemetry",
				error: String(error),
				samples: [],
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.telemetry.getKeyboard, async (_, videoPath?: string) => {
		const targetVideoPath = options.normalizeVideoSourcePath(
			videoPath ?? options.getCurrentVideoPath(),
		);
		if (!targetVideoPath) {
			return {
				success: true,
				platform: normalizeKeyboardPlatform(process.platform),
				samples: [],
			};
		}

		const telemetryPath = options.getKeyboardTelemetryPathForVideo(targetVideoPath);
		try {
			const content = await fs.readFile(telemetryPath, "utf-8");
			const parsed = JSON.parse(content);
			const rawSamples = Array.isArray(parsed?.samples) ? parsed.samples : [];

			const samples: KeyboardTelemetryPoint[] = rawSamples
				.filter((sample: unknown) => Boolean(sample && typeof sample === "object"))
				.map((sample: unknown) => {
					const point = sample as Partial<KeyboardTelemetryPoint>;
					return {
						timeMs:
							typeof point.timeMs === "number" && Number.isFinite(point.timeMs)
								? Math.max(0, point.timeMs)
								: 0,
						type: point.type === "keyup" ? "keyup" : "keydown",
						key: typeof point.key === "string" ? point.key.trim().toLowerCase() : "unknown",
						keycode:
							typeof point.keycode === "number" && Number.isFinite(point.keycode)
								? Math.round(point.keycode)
								: 0,
						altKey: Boolean(point.altKey),
						ctrlKey: Boolean(point.ctrlKey),
						metaKey: Boolean(point.metaKey),
						shiftKey: Boolean(point.shiftKey),
					};
				})
				.sort((a: KeyboardTelemetryPoint, b: KeyboardTelemetryPoint) => a.timeMs - b.timeMs);

			return {
				success: true,
				platform: normalizeKeyboardPlatform(parsed?.platform),
				samples,
			};
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				return {
					success: true,
					platform: normalizeKeyboardPlatform(process.platform),
					samples: [],
				};
			}

			console.error("Failed to load keyboard telemetry:", error);
			return {
				success: false,
				message: "Failed to load keyboard telemetry",
				error: String(error),
				platform: normalizeKeyboardPlatform(process.platform),
				samples: [],
			};
		}
	});
}
