import type { CSSProperties } from "react";
import type {
	KeyboardPlatform,
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	KeyboardTelemetrySample,
} from "./types";

const MODIFIER_KEYS = new Set(["shift", "ctrl", "alt", "meta"]);
const CANVAS_REFERENCE_WIDTH = 1920;
const SHORTCUT_FADE_IN_MS = 120;
const SHORTCUT_FADE_OUT_MS = 180;
const SHORTCUT_REPEAT_MERGE_GAP_MS = 220;
const SHORTCUT_STACK_GAP = 14;
const SHORTCUT_SIDE_MARGIN = 36;
const SHORTCUT_VERTICAL_MARGIN = 36;
const SHORTCUT_FONT_FAMILY =
	'"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export interface KeyboardShortcutRenderState {
	callout: KeyboardShortcutCallout;
	opacity: number;
	translateY: number;
	scale: number;
}

export interface KeyboardShortcutThemeColors {
	panelFill: string;
	panelBorder: string;
	panelShadow: string;
	panelBackdropBlur?: number;
	keyFill: string;
	keyBorder: string;
	keyText: string;
	joinerText: string;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
	return clamp(value, 0, 1);
}

function arraysEqual(left: string[], right: string[]) {
	return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function normalizeKey(rawKey: unknown): string | null {
	if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
		return null;
	}

	return rawKey.trim().toLowerCase();
}

export function normalizeKeyboardPlatform(rawPlatform: unknown): KeyboardPlatform {
	return rawPlatform === "darwin" || rawPlatform === "win32" || rawPlatform === "linux"
		? rawPlatform
		: "win32";
}

export function normalizeKeyboardTelemetry(
	samples: KeyboardTelemetrySample[],
): KeyboardTelemetrySample[] {
	return samples
		.filter((sample): sample is KeyboardTelemetrySample =>
			Boolean(sample && typeof sample === "object"),
		)
		.map((sample): KeyboardTelemetrySample => {
			const key = normalizeKey(sample.key) ?? "unknown";
			return {
				timeMs:
					typeof sample.timeMs === "number" && Number.isFinite(sample.timeMs)
						? Math.max(0, sample.timeMs)
						: 0,
				type: sample.type === "keyup" ? "keyup" : "keydown",
				key,
				keycode:
					typeof sample.keycode === "number" && Number.isFinite(sample.keycode)
						? Math.round(sample.keycode)
						: 0,
				altKey: Boolean(sample.altKey),
				ctrlKey: Boolean(sample.ctrlKey),
				metaKey: Boolean(sample.metaKey),
				shiftKey: Boolean(sample.shiftKey),
			};
		})
		.sort((left, right) => left.timeMs - right.timeMs);
}

export function isModifierKey(key: string) {
	return MODIFIER_KEYS.has(key);
}

function getOrderedShortcutKeys(
	sample: Pick<KeyboardTelemetrySample, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "key">,
	platform: KeyboardPlatform,
) {
	const modifierOrder =
		platform === "darwin" ? ["meta", "ctrl", "alt", "shift"] : ["ctrl", "alt", "shift", "meta"];
	const keys = modifierOrder.filter((modifier) => {
		if (modifier === "ctrl") return sample.ctrlKey;
		if (modifier === "alt") return sample.altKey;
		if (modifier === "meta") return sample.metaKey;
		if (modifier === "shift") return sample.shiftKey;
		return false;
	});

	keys.push(sample.key);
	return keys;
}

export function formatKeyboardShortcutKeyLabel(key: string, platform: KeyboardPlatform): string {
	switch (key) {
		case "meta":
			return platform === "darwin" ? "⌘" : "Meta";
		case "ctrl":
			return platform === "darwin" ? "⌃" : "Ctrl";
		case "alt":
			return platform === "darwin" ? "⌥" : "Alt";
		case "shift":
			return platform === "darwin" ? "⇧" : "Shift";
		case "space":
			return "Space";
		case "escape":
			return "Esc";
		case "backspace":
			return "⌫";
		case "delete":
			return platform === "darwin" ? "Delete" : "Del";
		case "enter":
			return platform === "darwin" ? "Return" : "Enter";
		case "tab":
			return "Tab";
		case "arrowup":
			return "↑";
		case "arrowdown":
			return "↓";
		case "arrowleft":
			return "←";
		case "arrowright":
			return "→";
		case "pageup":
			return "PgUp";
		case "pagedown":
			return "PgDn";
		case "home":
			return "Home";
		case "end":
			return "End";
		case "insert":
			return "Ins";
		default:
			if (/^f\d{1,2}$/.test(key)) {
				return key.toUpperCase();
			}
			if (key.length === 1) {
				return key.toUpperCase();
			}
			return key
				.split(/[-_\s]+/)
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(" ");
	}
}

export function deriveKeyboardShortcutCallouts(
	samples: KeyboardTelemetrySample[],
	platform: KeyboardPlatform,
	displayMs: number,
): KeyboardShortcutCallout[] {
	const normalized = normalizeKeyboardTelemetry(samples);
	const heldKeys = new Set<string>();
	const callouts: KeyboardShortcutCallout[] = [];
	const safeDisplayMs = Math.max(250, Math.round(displayMs));

	for (const sample of normalized) {
		if (sample.type === "keyup") {
			heldKeys.delete(sample.key);
			continue;
		}

		const wasHeld = heldKeys.has(sample.key);
		heldKeys.add(sample.key);
		if (wasHeld) {
			continue;
		}

		if (isModifierKey(sample.key)) {
			continue;
		}

		if (!sample.ctrlKey && !sample.altKey && !sample.metaKey && !sample.shiftKey) {
			continue;
		}

		const keys = getOrderedShortcutKeys(sample, platform);
		const labels = keys.map((key) => formatKeyboardShortcutKeyLabel(key, platform));
		const startMs = Math.round(sample.timeMs);
		const endMs = startMs + safeDisplayMs;
		const previous = callouts[callouts.length - 1];

		if (
			previous &&
			arraysEqual(previous.keys, keys) &&
			startMs <= previous.endMs + SHORTCUT_REPEAT_MERGE_GAP_MS
		) {
			previous.endMs = Math.max(previous.endMs, endMs);
			continue;
		}

		callouts.push({
			id: `keyboard-shortcut-${callouts.length + 1}`,
			startMs,
			endMs,
			keys,
			labels,
			platform,
		});
	}

	return callouts;
}

export function getVisibleKeyboardShortcutCallouts(
	callouts: KeyboardShortcutCallout[],
	timeMs: number,
	maxVisible: number,
) {
	const visible = callouts
		.filter((callout) => timeMs >= callout.startMs && timeMs <= callout.endMs)
		.sort((left, right) => left.startMs - right.startMs);

	if (visible.length <= maxVisible) {
		return visible;
	}

	return visible.slice(-Math.max(1, Math.round(maxVisible)));
}

export function getKeyboardShortcutRenderStates(
	callouts: KeyboardShortcutCallout[],
	timeMs: number,
	maxVisible: number,
): KeyboardShortcutRenderState[] {
	return getVisibleKeyboardShortcutCallouts(callouts, timeMs, maxVisible).map((callout) => {
		const introProgress = clamp01((timeMs - callout.startMs) / SHORTCUT_FADE_IN_MS);
		const outroProgress = clamp01((callout.endMs - timeMs) / SHORTCUT_FADE_OUT_MS);
		const opacity = clamp01(Math.min(introProgress, outroProgress));

		return {
			callout,
			opacity,
			translateY: (1 - opacity) * 12,
			scale: 0.96 + opacity * 0.04,
		};
	});
}

export function getKeyboardShortcutPositionStyle(
	position: KeyboardShortcutPosition,
): CSSProperties {
	switch (position) {
		case "top-left":
			return { top: 0, left: 0, alignItems: "flex-start" };
		case "top-center":
			return { top: 0, left: "50%", transform: "translateX(-50%)", alignItems: "center" };
		case "top-right":
			return { top: 0, right: 0, alignItems: "flex-end" };
		case "bottom-left":
			return { bottom: 0, left: 0, alignItems: "flex-start" };
		case "bottom-right":
			return { bottom: 0, right: 0, alignItems: "flex-end" };
		case "bottom-center":
		default:
			return { bottom: 0, left: "50%", transform: "translateX(-50%)", alignItems: "center" };
	}
}

export function getKeyboardShortcutThemeColors(
	theme: KeyboardShortcutTheme,
	baseOpacity = 1,
): KeyboardShortcutThemeColors {
	const opacity = clamp(baseOpacity, 0.05, 1);

	if (theme === "light") {
		return {
			panelFill: `rgba(255, 255, 255, ${0.95 * opacity})`,
			panelBorder: `rgba(15, 23, 42, ${0.12 * opacity})`,
			panelShadow: `rgba(15, 23, 42, ${0.14 * opacity})`,
			keyFill: `rgba(248, 250, 252, ${0.95 * opacity})`,
			keyBorder: `rgba(148, 163, 184, ${0.35 * opacity})`,
			keyText: `rgba(15, 23, 42, ${opacity})`,
			joinerText: `rgba(71, 85, 105, ${0.72 * opacity})`,
		};
	}

	if (theme === "glass") {
		return {
			panelFill: `rgba(15, 23, 42, ${0.46 * opacity})`,
			panelBorder: `rgba(255, 255, 255, ${0.24 * opacity})`,
			panelShadow: `rgba(15, 23, 42, ${0.2 * opacity})`,
			panelBackdropBlur: 18,
			keyFill: `rgba(255, 255, 255, ${0.18 * opacity})`,
			keyBorder: `rgba(255, 255, 255, ${0.24 * opacity})`,
			keyText: `rgba(255, 255, 255, ${opacity})`,
			joinerText: `rgba(226, 232, 240, ${0.82 * opacity})`,
		};
	}

	return {
		panelFill: `rgba(15, 23, 42, ${0.9 * opacity})`,
		panelBorder: `rgba(255, 255, 255, ${0.08 * opacity})`,
		panelShadow: `rgba(15, 23, 42, ${0.22 * opacity})`,
		keyFill: `rgba(255, 255, 255, ${0.08 * opacity})`,
		keyBorder: `rgba(255, 255, 255, ${0.1 * opacity})`,
		keyText: `rgba(248, 250, 252, ${opacity})`,
		joinerText: `rgba(226, 232, 240, ${0.72 * opacity})`,
	};
}

interface MeasuredKeyboardShortcut {
	width: number;
	height: number;
	keyMetrics: Array<{ label: string; width: number; height: number }>;
}

function getCanvasScale(containerWidth: number, scale: number) {
	const baseScale = containerWidth / CANVAS_REFERENCE_WIDTH;
	return Math.max(0.75, baseScale) * clamp(scale, 0.5, 2);
}

function measureKeyboardShortcutCallout(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	containerWidth: number,
	scale: number,
): MeasuredKeyboardShortcut {
	const canvasScale = getCanvasScale(containerWidth, scale);
	const fontSize = 18 * canvasScale;
	const keyPaddingX = 14 * canvasScale;
	const keyPaddingY = 10 * canvasScale;
	const joinerWidth = 14 * canvasScale;
	const keySpacing = 8 * canvasScale;

	ctx.font = `600 ${fontSize}px ${SHORTCUT_FONT_FAMILY}`;

	const keyMetrics = labels.map((label) => {
		const textWidth = Math.max(fontSize * 0.85, ctx.measureText(label).width);
		return {
			label,
			width: textWidth + keyPaddingX * 2,
			height: fontSize + keyPaddingY * 2,
		};
	});

	const keysWidth = keyMetrics.reduce((sum, metric) => sum + metric.width, 0);
	const joinersWidth = Math.max(0, labels.length - 1) * (joinerWidth + keySpacing * 2);
	const bubblePaddingX = 14 * canvasScale;
	const bubblePaddingY = 14 * canvasScale;
	const height =
		Math.max(...keyMetrics.map((metric) => metric.height), fontSize + keyPaddingY * 2) +
		bubblePaddingY * 2;

	return {
		width: keysWidth + joinersWidth + bubblePaddingX * 2,
		height,
		keyMetrics,
	};
}

export function renderKeyboardShortcutCalloutsCanvas(
	ctx: CanvasRenderingContext2D,
	callouts: KeyboardShortcutCallout[],
	timeMs: number,
	containerWidth: number,
	containerHeight: number,
	options: {
		position: KeyboardShortcutPosition;
		theme: KeyboardShortcutTheme;
		scale: number;
		opacity: number;
		maxVisible: number;
	},
) {
	const renderStates = getKeyboardShortcutRenderStates(callouts, timeMs, options.maxVisible);
	if (renderStates.length === 0) {
		return;
	}

	const theme = getKeyboardShortcutThemeColors(options.theme, options.opacity);
	const canvasScale = getCanvasScale(containerWidth, options.scale);
	const fontSize = 18 * canvasScale;
	const joinerWidth = 14 * canvasScale;
	const bubbleRadius = 18 * canvasScale;
	const bubblePaddingX = 14 * canvasScale;
	const bubblePaddingY = 14 * canvasScale;
	const keyRadius = 12 * canvasScale;
	const keySpacing = 8 * canvasScale;
	const stackGap = SHORTCUT_STACK_GAP * canvasScale;
	const sideMargin = SHORTCUT_SIDE_MARGIN * canvasScale;
	const verticalMargin = SHORTCUT_VERTICAL_MARGIN * canvasScale;

	ctx.save();

	const measured = renderStates.map((state) => ({
		state,
		metrics: measureKeyboardShortcutCallout(
			ctx,
			state.callout.labels,
			containerWidth,
			options.scale,
		),
	}));
	const totalHeight =
		measured.reduce((sum, entry) => sum + entry.metrics.height, 0) +
		Math.max(0, measured.length - 1) * stackGap;
	const isBottomAligned = options.position.startsWith("bottom");
	let currentY = isBottomAligned ? containerHeight - verticalMargin - totalHeight : verticalMargin;

	for (const { state, metrics } of measured) {
		let x = sideMargin;
		if (options.position.endsWith("center")) {
			x = (containerWidth - metrics.width) / 2;
		} else if (options.position.endsWith("right")) {
			x = containerWidth - sideMargin - metrics.width;
		}

		const y = currentY + state.translateY;
		ctx.save();
		ctx.globalAlpha = state.opacity;
		ctx.translate(x + metrics.width / 2, y + metrics.height / 2);
		ctx.scale(state.scale, state.scale);
		ctx.translate(-(x + metrics.width / 2), -(y + metrics.height / 2));

		ctx.fillStyle = theme.panelFill;
		ctx.strokeStyle = theme.panelBorder;
		ctx.lineWidth = Math.max(1, canvasScale);
		ctx.shadowColor = theme.panelShadow;
		ctx.shadowBlur = 18 * canvasScale;
		ctx.shadowOffsetY = 10 * canvasScale;
		ctx.beginPath();
		ctx.roundRect(x, y, metrics.width, metrics.height, bubbleRadius);
		ctx.fill();
		ctx.stroke();

		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
		ctx.font = `600 ${fontSize}px ${SHORTCUT_FONT_FAMILY}`;
		ctx.textBaseline = "middle";
		ctx.textAlign = "center";

		let cursorX = x + bubblePaddingX;
		for (const [index, key] of metrics.keyMetrics.entries()) {
			const keyY = y + bubblePaddingY;
			ctx.fillStyle = theme.keyFill;
			ctx.strokeStyle = theme.keyBorder;
			ctx.lineWidth = Math.max(1, 0.9 * canvasScale);
			ctx.beginPath();
			ctx.roundRect(cursorX, keyY, key.width, key.height, keyRadius);
			ctx.fill();
			ctx.stroke();

			ctx.fillStyle = theme.keyText;
			ctx.fillText(key.label, cursorX + key.width / 2, keyY + key.height / 2 + 0.5 * canvasScale);
			cursorX += key.width;

			if (index < metrics.keyMetrics.length - 1) {
				cursorX += keySpacing;
				ctx.fillStyle = theme.joinerText;
				ctx.fillText("+", cursorX + joinerWidth / 2, y + metrics.height / 2 + 0.5 * canvasScale);
				cursorX += joinerWidth;
				cursorX += keySpacing;
			}
		}

		ctx.restore();
		currentY += metrics.height + stackGap;
	}

	ctx.restore();
}
