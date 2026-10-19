import { Assets, BlurFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { MotionBlurFilter } from "pixi-filters/motion-blur";
import {
	type CursorClickEffectStyle,
	type CursorClickStyleSettings,
	type CursorPack,
	type CursorStyle,
	type CursorTelemetryPoint,
	type CursorType,
	type CursorTypeMode,
	DEFAULT_CURSOR_CLICK_STYLE,
} from "../types";
import {
	CURSOR_ASSET_SAMPLE_SIZE,
	type CursorAssetDefinition,
	cursorAssetPacks,
	SUPPORTED_CURSOR_KEYS,
} from "./cursorAssetPacks";
import {
	buildCursorSimulationPath,
	type CursorMotionSnapshot,
	type CursorSimulationPath,
	evaluateCursorMotionSnapshot,
} from "./cursorSimulation";
import { computeCursorSwayRotation } from "./cursorSway";
import {
	getCursorTiltRotation,
	getCursorVisibilityOpacity,
	resolveCursorVisualMode,
} from "./cursorV2";
import {
	createSpringState,
	getCursorSpringConfig,
	resetSpringState,
	type SpringConfig,
	stepSpringValue,
} from "./motionSmoothing";

type CursorAssetKey = CursorType;

type LoadedCursorAsset = {
	texture: Texture;
	image: HTMLImageElement;
	aspectRatio: number;
	anchorX: number;
	anchorY: number;
};

type LoadedCursorAssets = {
	packs: Record<CursorPack, Partial<Record<CursorAssetKey, LoadedCursorAsset>>>;
	system: Partial<Record<CursorAssetKey, LoadedCursorAsset>>;
};

type ClickInteractionSample = Pick<CursorTelemetryPoint, "interactionType" | "timeMs">;

export type CursorVisualState = {
	cursorType: CursorType;
	clickBounceProgress: number;
	clickProgress: number;
};

export type ClickRingStyle = {
	alpha: number;
	radius: number;
	lineWidth: number;
	color: number;
};

export interface CursorViewportRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CursorRenderConfig {
	dotRadius: number;
	dotColor: number;
	dotAlpha: number;
	trailLength: number;
	trailOpacity: number;
	smoothingFactor: number;
	springConfig: SpringConfig | null;
	motionBlur: number;
	clickBounce: number;
	clickEffectsEnabled: boolean;
	clickHighlightColor: string;
	clickHighlightSize: number;
	clickHighlightOpacity: number;
	clickStyle: CursorClickStyleSettings;
	sway: number;
	cursorPack: CursorPack;
	cursorStyle: CursorStyle;
	cursorColor: string;
	cursorOpacity: number;
	cursorTypeMode: CursorTypeMode;
	cursorTilt: number;
	hideWhenIdle: boolean;
	idleHideDelayMs: number;
	preferSystemCursorAssets: boolean;
}

export const DEFAULT_CURSOR_CONFIG: CursorRenderConfig = {
	dotRadius: 28,
	dotColor: 0xffffff,
	dotAlpha: 0.95,
	trailLength: 0,
	trailOpacity: 0.3,
	smoothingFactor: 0.18,
	springConfig: null,
	motionBlur: 0,
	clickBounce: 1,
	clickEffectsEnabled: false,
	clickHighlightColor: "#f59e0b",
	clickHighlightSize: 1,
	clickHighlightOpacity: 0.5,
	clickStyle: DEFAULT_CURSOR_CLICK_STYLE,
	sway: 0,
	cursorPack: "classic",
	cursorStyle: "default",
	cursorColor: "#ffffff",
	cursorOpacity: 1,
	cursorTypeMode: "auto",
	cursorTilt: 0,
	hideWhenIdle: false,
	idleHideDelayMs: 1500,
	preferSystemCursorAssets: false,
};

const REFERENCE_WIDTH = 1920;
const MIN_CURSOR_VIEWPORT_SCALE = 0.55;
const CURSOR_MOTION_BLUR_BASE_MULTIPLIER = 0.08;
const CURSOR_TIME_DISCONTINUITY_MS = 100;
const CURSOR_SWAY_SMOOTHING_MULTIPLIER = 0.7;
const CURSOR_SWAY_SMOOTHING_OFFSET = 0.18;

function isClickInteraction(interactionType: CursorTelemetryPoint["interactionType"] | undefined) {
	return (
		interactionType === "click" ||
		interactionType === "double-click" ||
		interactionType === "right-click" ||
		interactionType === "middle-click"
	);
}
const CURSOR_SVG_DROP_SHADOW_FILTER = "drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.35))";
const CURSOR_SHADOW_COLOR = 0x000000;
const CURSOR_SHADOW_ALPHA = 0.35;
const CURSOR_SHADOW_OFFSET_X = 0;
const CURSOR_SHADOW_OFFSET_Y = 2;
const CURSOR_SHADOW_BLUR = 3;
const CURSOR_SHADOW_PADDING = 12;

let cursorAssetsPromise: Promise<void> | null = null;
function createEmptyPacksRecord(): Record<
	CursorPack,
	Partial<Record<CursorAssetKey, LoadedCursorAsset>>
> {
	const packs = {} as Record<CursorPack, Partial<Record<CursorAssetKey, LoadedCursorAsset>>>;
	for (const pack of Object.keys(cursorAssetPacks) as CursorPack[]) {
		packs[pack] = {};
	}
	return packs;
}

let loadedCursorAssets: LoadedCursorAssets = {
	packs: createEmptyPacksRecord(),
	system: {},
};

function loadImage(dataUrl: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error(`Failed to load cursor image: ${dataUrl.slice(0, 128)}`));
		image.src = dataUrl;
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function parseHexColorToNumber(value: string, fallback: number) {
	const normalized = value.trim();
	if (!/^#?[0-9a-f]{6}$/i.test(normalized)) {
		return fallback;
	}

	return Number.parseInt(normalized.replace(/^#/, ""), 16);
}

function getCursorColorNumber(config: CursorRenderConfig) {
	return parseHexColorToNumber(config.cursorColor, config.dotColor);
}

function getClickHighlightColorNumber(config: CursorRenderConfig) {
	return parseHexColorToNumber(config.clickHighlightColor, 0xf59e0b);
}

function getNormalizedAnchor(
	systemAsset: SystemCursorAsset | undefined,
	fallbackAnchor: { x: number; y: number },
) {
	if (!systemAsset || systemAsset.width <= 0 || systemAsset.height <= 0) {
		return fallbackAnchor;
	}

	return {
		x: clamp(systemAsset.hotspotX / systemAsset.width, 0, 1),
		y: clamp(systemAsset.hotspotY / systemAsset.height, 0, 1),
	};
}

async function rasterizeAndCropSvg(
	url: string,
	sampleSize: number,
	trimX: number,
	trimY: number,
	trimWidth: number,
	trimHeight: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
	const img = await loadImage(url);

	const srcCanvas = document.createElement("canvas");
	srcCanvas.width = sampleSize;
	srcCanvas.height = sampleSize;
	const srcCtx = srcCanvas.getContext("2d")!;
	srcCtx.drawImage(img, 0, 0, sampleSize, sampleSize);

	const dstCanvas = document.createElement("canvas");
	dstCanvas.width = trimWidth;
	dstCanvas.height = trimHeight;
	const dstCtx = dstCanvas.getContext("2d")!;
	dstCtx.drawImage(srcCanvas, trimX, trimY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);

	return {
		dataUrl: dstCanvas.toDataURL("image/png"),
		width: dstCanvas.width,
		height: dstCanvas.height,
	};
}

function getCursorPackOrder(cursorPack: CursorPack): CursorPack[] {
	return cursorPack === "classic" ? ["classic"] : [cursorPack, "classic"];
}

function getCursorAsset(
	key: CursorAssetKey,
	cursorPack: CursorPack = "classic",
	preferSystemCursorAssets = false,
): LoadedCursorAsset {
	if (preferSystemCursorAssets) {
		const systemAsset = loadedCursorAssets.system[key];
		if (systemAsset) {
			return systemAsset;
		}
	}

	for (const pack of getCursorPackOrder(cursorPack)) {
		const packAsset = loadedCursorAssets.packs[pack][key];
		if (packAsset) {
			return packAsset;
		}
	}

	const systemAsset = loadedCursorAssets.system[key];
	if (systemAsset) {
		return systemAsset;
	}

	for (const fallbackPack of getCursorPackOrder(cursorPack)) {
		const fallbackArrow = loadedCursorAssets.packs[fallbackPack].arrow;
		if (fallbackArrow) {
			return fallbackArrow;
		}
	}

	if (loadedCursorAssets.system.arrow) {
		return loadedCursorAssets.system.arrow;
	}

	throw new Error(`Missing cursor asset for ${key}`);
}

function getAvailableCursorKeys(
	cursorPack: CursorPack = "classic",
	preferSystemCursorAssets = false,
): CursorAssetKey[] {
	const loadedKeys = SUPPORTED_CURSOR_KEYS.filter((key) => {
		try {
			getCursorAsset(key, cursorPack, preferSystemCursorAssets);
			return true;
		} catch {
			return false;
		}
	});
	return loadedKeys.length > 0 ? loadedKeys : ["arrow"];
}

async function loadCursorAssetFromDefinition(
	definition: CursorAssetDefinition,
): Promise<LoadedCursorAsset> {
	let finalUrl: string;
	let width: number;
	let height: number;
	let normalizedAnchor: { x: number; y: number };

	if (definition.trim) {
		const { trim, fallbackAnchor } = definition;
		const rasterized = await rasterizeAndCropSvg(
			definition.url,
			CURSOR_ASSET_SAMPLE_SIZE,
			trim.x,
			trim.y,
			trim.width,
			trim.height,
		);
		finalUrl = rasterized.dataUrl;
		width = rasterized.width;
		height = rasterized.height;
		normalizedAnchor = {
			x: clamp((fallbackAnchor.x * trim.width) / width, 0, 1),
			y: clamp((fallbackAnchor.y * trim.height) / height, 0, 1),
		};
	} else {
		finalUrl = definition.url;
		const img = await loadImage(finalUrl);
		width = img.naturalWidth;
		height = img.naturalHeight;
		normalizedAnchor = definition.fallbackAnchor;
	}

	await Assets.load(finalUrl);
	const image = await loadImage(finalUrl);
	const texture = Texture.from(finalUrl);

	return {
		texture,
		image,
		aspectRatio: height > 0 ? width / height : 1,
		anchorX: normalizedAnchor.x,
		anchorY: normalizedAnchor.y,
	};
}

export async function preloadCursorAssets() {
	if (!cursorAssetsPromise) {
		cursorAssetsPromise = (async () => {
			let systemCursors: Record<string, SystemCursorAsset> = {};

			try {
				const result = await window.electronAPI.getSystemCursorAssets();
				if (result.success && result.cursors) {
					systemCursors = result.cursors;
				}
			} catch (error) {
				console.warn("[CursorRenderer] Failed to fetch system cursor assets:", error);
			}

			const nextLoadedAssets: LoadedCursorAssets = {
				packs: createEmptyPacksRecord(),
				system: {},
			};

			for (const pack of Object.keys(cursorAssetPacks) as CursorPack[]) {
				for (const key of SUPPORTED_CURSOR_KEYS) {
					const definition = cursorAssetPacks[pack][key];
					if (!definition) {
						continue;
					}

					try {
						nextLoadedAssets.packs[pack][key] = await loadCursorAssetFromDefinition(definition);
					} catch (error) {
						console.warn(`[CursorRenderer] Failed to load ${pack} cursor image for: ${key}`, error);
					}
				}
			}

			for (const key of SUPPORTED_CURSOR_KEYS) {
				const systemAsset = systemCursors[key];
				if (!systemAsset?.dataUrl) {
					continue;
				}

				try {
					await Assets.load(systemAsset.dataUrl);
					const image = await loadImage(systemAsset.dataUrl);
					const anchor = getNormalizedAnchor(systemAsset, { x: 0, y: 0 });
					nextLoadedAssets.system[key] = {
						texture: Texture.from(systemAsset.dataUrl),
						image,
						aspectRatio: image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1,
						anchorX: anchor.x,
						anchorY: anchor.y,
					};
				} catch (error) {
					console.warn(`[CursorRenderer] Failed to load system cursor image for: ${key}`, error);
				}
			}

			loadedCursorAssets = nextLoadedAssets;
			getCursorAsset("arrow", "classic");
		})();
	}

	return cursorAssetsPromise;
}

export function interpolateCursorPosition(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): { cx: number; cy: number } | null {
	if (!samples || samples.length === 0) return null;

	if (timeMs <= samples[0].timeMs) {
		return { cx: samples[0].cx, cy: samples[0].cy };
	}

	if (timeMs >= samples[samples.length - 1].timeMs) {
		return {
			cx: samples[samples.length - 1].cx,
			cy: samples[samples.length - 1].cy,
		};
	}

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi - 1) {
		const mid = (lo + hi) >> 1;
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	const a = samples[lo];
	const b = samples[hi];
	const span = b.timeMs - a.timeMs;
	if (span <= 0) return { cx: a.cx, cy: a.cy };

	const t = (timeMs - a.timeMs) / span;
	return {
		cx: a.cx + (b.cx - a.cx) * t,
		cy: a.cy + (b.cy - a.cy) * t,
	};
}

function findLatestSample(samples: CursorTelemetryPoint[], timeMs: number) {
	if (samples.length === 0) return null;

	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return samples[lo]?.timeMs <= timeMs ? samples[lo] : null;
}

function findLatestInteractionSample(
	samples: CursorTelemetryPoint[],
	timeMs: number,
	previewClickSample?: ClickInteractionSample | null,
) {
	let latestSample: ClickInteractionSample | null = null;

	if (
		previewClickSample &&
		previewClickSample.timeMs <= timeMs &&
		isClickInteraction(previewClickSample.interactionType)
	) {
		latestSample = previewClickSample;
	}

	for (let index = samples.length - 1; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs) {
			continue;
		}

		if (isClickInteraction(sample.interactionType)) {
			return latestSample && latestSample.timeMs > sample.timeMs ? latestSample : sample;
		}
	}

	return latestSample;
}

function findLatestStableCursorType(samples: CursorTelemetryPoint[], timeMs: number) {
	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (samples[mid].timeMs <= timeMs) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	for (let index = lo; index >= 0; index -= 1) {
		const sample = samples[index];
		if (sample.timeMs > timeMs) {
			continue;
		}

		if (!sample.cursorType) {
			continue;
		}

		if (
			sample.interactionType === "click" ||
			sample.interactionType === "double-click" ||
			sample.interactionType === "right-click" ||
			sample.interactionType === "middle-click"
		) {
			continue;
		}

		return sample.cursorType;
	}

	return findLatestSample(samples, timeMs)?.cursorType ?? "arrow";
}

function getCursorViewportScale(viewport: CursorViewportRect) {
	return Math.max(MIN_CURSOR_VIEWPORT_SCALE, viewport.width / REFERENCE_WIDTH);
}

function getCursorSwaySpringConfig(smoothingFactor: number) {
	const baseConfig = getCursorSpringConfig(
		Math.min(
			2,
			Math.max(
				0.15,
				smoothingFactor * CURSOR_SWAY_SMOOTHING_MULTIPLIER + CURSOR_SWAY_SMOOTHING_OFFSET,
			),
		),
	);

	return {
		...baseConfig,
		damping: baseConfig.damping * 0.9,
		mass: Math.max(0.55, baseConfig.mass * 0.8),
		restDelta: 0.0005,
		restSpeed: 0.02,
	};
}

export function getCursorVisualState(
	samples: CursorTelemetryPoint[],
	timeMs: number,
	previewClickSample?: ClickInteractionSample | null,
	clickStyle: Pick<
		CursorClickStyleSettings,
		"effectDurationMs" | "bounceDurationMs"
	> = DEFAULT_CURSOR_CLICK_STYLE,
): CursorVisualState {
	const bounceMs = Math.max(1, clickStyle.bounceDurationMs);
	const effectMs = Math.max(1, clickStyle.effectDurationMs);
	const latestClick = findLatestInteractionSample(samples, timeMs, previewClickSample);
	const interactionType = latestClick?.interactionType;
	const ageMs = latestClick ? Math.max(0, timeMs - latestClick.timeMs) : Number.POSITIVE_INFINITY;
	const isClickEvent = isClickInteraction(interactionType);
	const clickBounceProgress =
		latestClick && isClickEvent && ageMs <= bounceMs ? 1 - ageMs / bounceMs : 0;

	return {
		cursorType: findLatestStableCursorType(samples, timeMs),
		clickBounceProgress,
		clickProgress: latestClick && isClickEvent && ageMs <= effectMs ? 1 - ageMs / effectMs : 0,
	};
}

export function getClickBounceScale(clickBounceProgress: number, clickBounce: number) {
	return Math.max(0.72, 1 - Math.sin(clickBounceProgress * Math.PI) * (0.08 * clickBounce));
}

export function getClickRingStyle(
	h: number,
	progress: number,
	config: Pick<
		CursorRenderConfig,
		"clickHighlightColor" | "clickHighlightOpacity" | "clickHighlightSize"
	>,
): ClickRingStyle | null {
	if (progress <= 0 || config.clickHighlightOpacity <= 0 || config.clickHighlightSize <= 0) {
		return null;
	}

	return {
		color: getClickHighlightColorNumber({
			...DEFAULT_CURSOR_CONFIG,
			...config,
		}),
		alpha: clamp(progress * config.clickHighlightOpacity, 0, 1),
		radius:
			h * 0.28 * config.clickHighlightSize + (1 - progress) * h * 0.62 * config.clickHighlightSize,
		lineWidth: Math.max(2, h * 0.075 * Math.max(0.75, config.clickHighlightSize)),
	};
}

export interface ClickEffectShape {
	radius: number;
	color: number;
	alpha: number;
	/** Stroke width; undefined means a filled disc. */
	lineWidth?: number;
}

/**
 * Shapes for one frame of a click effect. `progress` runs 1 → 0 over the effect duration.
 */
export function getClickEffectShapes(
	effect: CursorClickEffectStyle,
	h: number,
	progress: number,
	config: Pick<
		CursorRenderConfig,
		"clickHighlightColor" | "clickHighlightOpacity" | "clickHighlightSize"
	>,
): ClickEffectShape[] {
	const ring = getClickRingStyle(h, progress, config);
	if (!ring) return [];
	const size = config.clickHighlightSize;
	const elapsed = 1 - progress;

	switch (effect) {
		case "spotlight": {
			const radius = h * (0.45 + elapsed * 0.45) * size;
			return [
				{ radius, color: ring.color, alpha: ring.alpha * 0.35 },
				{ radius: radius * 0.6, color: ring.color, alpha: ring.alpha * 0.25 },
			];
		}
		case "echo": {
			const lineWidth = Math.max(1.5, ring.lineWidth * 0.6);
			return [
				{ radius: ring.radius, color: ring.color, alpha: ring.alpha, lineWidth },
				{
					radius: h * 0.2 * size + elapsed * h * 0.95 * size,
					color: ring.color,
					alpha: ring.alpha * 0.6,
					lineWidth,
				},
			];
		}
		default: {
			const shapes: ClickEffectShape[] = [
				{ radius: ring.radius, color: ring.color, alpha: ring.alpha, lineWidth: ring.lineWidth },
			];
			// Second ring trails the first by a quarter of the effect.
			const trailing = getClickRingStyle(h, Math.min(1, progress + 0.25), config);
			if (trailing && progress < 0.75) {
				shapes.push({ ...trailing, alpha: trailing.alpha * 0.55 });
			}
			return shapes;
		}
	}
}

export class SmoothedCursorState {
	public x = 0.5;
	public y = 0.5;
	public trail: Array<{ x: number; y: number }> = [];
	private smoothingFactor: number;
	private springConfig: SpringConfig | null;
	private trailLength: number;
	private initialized = false;
	private lastTimeMs: number | null = null;
	private xSpring = createSpringState(0.5);
	private ySpring = createSpringState(0.5);

	constructor(
		config: Pick<CursorRenderConfig, "smoothingFactor" | "trailLength" | "springConfig">,
	) {
		this.smoothingFactor = config.smoothingFactor;
		this.springConfig = config.springConfig;
		this.trailLength = config.trailLength;
	}

	update(targetX: number, targetY: number, timeMs: number): void {
		if (!this.initialized) {
			this.x = targetX;
			this.y = targetY;
			this.initialized = true;
			this.lastTimeMs = timeMs;
			this.xSpring.value = targetX;
			this.ySpring.value = targetY;
			this.xSpring.velocity = 0;
			this.ySpring.velocity = 0;
			this.xSpring.initialized = true;
			this.ySpring.initialized = true;
			this.trail = [];
			return;
		}

		if (this.smoothingFactor <= 0 || (this.lastTimeMs !== null && timeMs < this.lastTimeMs)) {
			this.snapTo(targetX, targetY, timeMs);
			return;
		}

		this.trail.unshift({ x: this.x, y: this.y });
		if (this.trail.length > this.trailLength) {
			this.trail.length = this.trailLength;
		}

		const deltaMs = this.lastTimeMs === null ? 1000 / 60 : Math.max(1, timeMs - this.lastTimeMs);
		this.lastTimeMs = timeMs;

		const springConfig =
			this.springConfig ??
			(this.smoothingFactor > 0 ? getCursorSpringConfig(this.smoothingFactor) : null);
		if (!springConfig) {
			this.snapTo(targetX, targetY, timeMs);
			return;
		}
		this.x = stepSpringValue(this.xSpring, targetX, deltaMs, springConfig);
		this.y = stepSpringValue(this.ySpring, targetY, deltaMs, springConfig);
	}

	setSmoothingFactor(smoothingFactor: number): void {
		this.smoothingFactor = smoothingFactor;
	}

	setSpringConfig(springConfig: SpringConfig | null): void {
		this.springConfig = springConfig;
	}

	setTrailLength(trailLength: number): void {
		this.trailLength = Math.max(0, Math.round(trailLength));
		if (this.trail.length > this.trailLength) {
			this.trail.length = this.trailLength;
		}
	}

	snapTo(targetX: number, targetY: number, timeMs: number): void {
		this.x = targetX;
		this.y = targetY;
		this.initialized = true;
		this.lastTimeMs = timeMs;
		this.xSpring.value = targetX;
		this.ySpring.value = targetY;
		this.xSpring.velocity = 0;
		this.ySpring.velocity = 0;
		this.xSpring.initialized = true;
		this.ySpring.initialized = true;
		this.trail = [];
	}

	reset(): void {
		this.initialized = false;
		this.lastTimeMs = null;
		this.trail = [];
		resetSpringState(this.xSpring, this.x);
		resetSpringState(this.ySpring, this.y);
	}
}

function drawClickRing(
	graphics: Graphics,
	px: number,
	py: number,
	h: number,
	progress: number,
	config: Pick<
		CursorRenderConfig,
		"clickHighlightColor" | "clickHighlightOpacity" | "clickHighlightSize" | "clickStyle"
	>,
) {
	graphics.clear();
	for (const shape of getClickEffectShapes(config.clickStyle.effect, h, progress, config)) {
		graphics.circle(px, py, shape.radius);
		if (shape.lineWidth === undefined) {
			graphics.fill({ color: shape.color, alpha: shape.alpha });
		} else {
			graphics.stroke({ width: shape.lineWidth, color: shape.color, alpha: shape.alpha });
		}
	}
}

export class PixiCursorOverlay {
	public readonly container: Container;
	private trailGraphics: Graphics;
	private clickRingGraphics: Graphics;
	private circleCursorShadowGraphics: Graphics;
	private circleCursorGraphics: Graphics;
	private cursorShadowSprites: Partial<Record<CursorAssetKey, Sprite>>;
	private cursorShadowFilters: Partial<Record<CursorAssetKey, BlurFilter>>;
	private cursorSprites: Partial<Record<CursorAssetKey, Sprite>>;
	private cursorMotionBlurFilter: MotionBlurFilter;
	private state: SmoothedCursorState;
	private config: CursorRenderConfig;
	private lastRenderedPoint: { px: number; py: number } | null = null;
	private lastRenderedTimeMs: number | null = null;
	private swayRotation = 0;
	private swaySpring = createSpringState(0);
	private simulationPath: CursorSimulationPath | null = null;
	private simulationSamplesRef: CursorTelemetryPoint[] | null = null;

	constructor(config: Partial<CursorRenderConfig> = {}) {
		this.config = { ...DEFAULT_CURSOR_CONFIG, ...config };
		this.state = new SmoothedCursorState(this.config);

		this.container = new Container();
		this.container.label = "cursor-overlay";

		this.trailGraphics = new Graphics();
		this.clickRingGraphics = new Graphics();
		this.circleCursorShadowGraphics = new Graphics();
		this.circleCursorShadowGraphics.visible = false;
		this.circleCursorGraphics = new Graphics();
		this.circleCursorGraphics.visible = false;
		this.cursorShadowSprites = {};
		this.cursorShadowFilters = {};
		this.cursorSprites = {};
		for (const key of getAvailableCursorKeys(
			this.config.cursorPack,
			this.config.preferSystemCursorAssets,
		)) {
			const asset = getCursorAsset(
				key,
				this.config.cursorPack,
				this.config.preferSystemCursorAssets,
			);
			const shadowSprite = new Sprite(asset.texture);
			shadowSprite.anchor.set(asset.anchorX, asset.anchorY);
			shadowSprite.visible = false;
			shadowSprite.tint = CURSOR_SHADOW_COLOR;
			shadowSprite.alpha = CURSOR_SHADOW_ALPHA;
			const shadowFilter = new BlurFilter();
			shadowFilter.blur = CURSOR_SHADOW_BLUR;
			shadowFilter.quality = 4;
			shadowFilter.padding = CURSOR_SHADOW_PADDING;
			shadowSprite.filters = [shadowFilter];
			this.cursorShadowSprites[key] = shadowSprite;
			this.cursorShadowFilters[key] = shadowFilter;

			const sprite = new Sprite(asset.texture);
			sprite.anchor.set(asset.anchorX, asset.anchorY);
			sprite.visible = false;
			this.cursorSprites[key] = sprite;
		}

		this.cursorMotionBlurFilter = new MotionBlurFilter([0, 0], 5, 0);
		this.container.filters = null;

		this.container.addChild(
			this.trailGraphics,
			this.clickRingGraphics,
			this.circleCursorShadowGraphics,
			...Object.values(this.cursorShadowSprites),
			this.circleCursorGraphics,
			...Object.values(this.cursorSprites),
		);
		this.setMotionBlur(this.config.motionBlur);
	}

	setDotRadius(dotRadius: number) {
		this.config.dotRadius = dotRadius;
	}

	setCursorStyle(cursorStyle: CursorStyle) {
		this.config.cursorStyle = cursorStyle;
	}

	setCursorColor(cursorColor: string) {
		this.config.cursorColor = cursorColor;
	}

	setCursorOpacity(cursorOpacity: number) {
		this.config.cursorOpacity = clamp(cursorOpacity, 0, 1);
	}

	setSmoothingFactor(smoothingFactor: number) {
		this.config.smoothingFactor = smoothingFactor;
		this.state.setSmoothingFactor(smoothingFactor);
	}

	setTrailLength(trailLength: number) {
		this.config.trailLength = Math.max(0, Math.round(trailLength));
		this.state.setTrailLength(this.config.trailLength);
	}

	setTrailOpacity(trailOpacity: number) {
		this.config.trailOpacity = clamp(trailOpacity, 0, 1);
	}

	setSpringConfig(springConfig: SpringConfig | null) {
		this.config.springConfig = springConfig;
		this.state.setSpringConfig(springConfig);
	}

	setMotionBlur(motionBlur: number) {
		this.config.motionBlur = Math.max(0, motionBlur);
		this.container.filters = this.config.motionBlur > 0 ? [this.cursorMotionBlurFilter] : null;
		if (this.config.motionBlur <= 0) {
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			this.cursorMotionBlurFilter.kernelSize = 5;
			this.cursorMotionBlurFilter.offset = 0;
		}
	}

	setClickBounce(clickBounce: number) {
		this.config.clickBounce = Math.max(0, clickBounce);
	}

	setClickEffectsEnabled(clickEffectsEnabled: boolean) {
		this.config.clickEffectsEnabled = clickEffectsEnabled;
	}

	setClickHighlightColor(clickHighlightColor: string) {
		this.config.clickHighlightColor = clickHighlightColor;
	}

	setClickHighlightSize(clickHighlightSize: number) {
		this.config.clickHighlightSize = Math.max(0, clickHighlightSize);
	}

	setClickStyle(clickStyle: CursorClickStyleSettings) {
		this.config.clickStyle = clickStyle;
	}

	setClickHighlightOpacity(clickHighlightOpacity: number) {
		this.config.clickHighlightOpacity = clamp(clickHighlightOpacity, 0, 1);
	}

	setSway(sway: number) {
		this.config.sway = clamp(sway, 0, 2);
	}

	setCursorTypeMode(cursorTypeMode: CursorTypeMode) {
		this.config.cursorTypeMode = cursorTypeMode;
	}

	setCursorTilt(cursorTilt: number) {
		this.config.cursorTilt = clamp(cursorTilt, 0, 1);
	}

	setHideWhenIdle(hideWhenIdle: boolean) {
		this.config.hideWhenIdle = hideWhenIdle;
	}

	setIdleHideDelayMs(idleHideDelayMs: number) {
		this.config.idleHideDelayMs = clamp(idleHideDelayMs, 500, 5000);
	}

	setPreferSystemCursorAssets(preferSystemCursorAssets: boolean) {
		this.config.preferSystemCursorAssets = preferSystemCursorAssets;
	}

	update(
		samples: CursorTelemetryPoint[],
		timeMs: number,
		viewport: CursorViewportRect,
		visible: boolean,
		freeze = false,
	): void {
		if (!visible || samples.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
			this.container.visible = false;
			this.trailGraphics.clear();
			this.lastRenderedPoint = null;
			this.lastRenderedTimeMs = null;
			this.swayRotation = 0;
			resetSpringState(this.swaySpring, 0);
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			return;
		}

		if (
			this.simulationSamplesRef !== samples ||
			!this.simulationPath ||
			this.simulationPath.durationMs < timeMs
		) {
			this.simulationPath = buildCursorSimulationPath(
				samples,
				Math.max(timeMs, samples[samples.length - 1]?.timeMs ?? timeMs),
			);
			this.simulationSamplesRef = samples;
		}

		const motionSnapshot = evaluateCursorMotionSnapshot(
			this.simulationPath,
			timeMs,
			this.lastRenderedTimeMs,
		);
		this.updateFromMotionSnapshot(motionSnapshot, samples, timeMs, viewport, visible, freeze);
	}

	updateFromMotionSnapshot(
		motionSnapshot: CursorMotionSnapshot | null,
		samples: CursorTelemetryPoint[],
		timeMs: number,
		viewport: CursorViewportRect,
		visible: boolean,
		freeze = false,
		previewClickSample?: ClickInteractionSample | null,
	): void {
		if (
			!visible ||
			(samples.length === 0 && !previewClickSample) ||
			viewport.width <= 0 ||
			viewport.height <= 0
		) {
			this.container.visible = false;
			this.trailGraphics.clear();
			this.lastRenderedPoint = null;
			this.lastRenderedTimeMs = null;
			this.swayRotation = 0;
			resetSpringState(this.swaySpring, 0);
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			return;
		}

		if (!motionSnapshot) {
			this.container.visible = false;
			return;
		}

		const sameFrameTime =
			this.lastRenderedTimeMs !== null && Math.abs(this.lastRenderedTimeMs - timeMs) < 0.0001;
		const hasTimeDiscontinuity =
			this.lastRenderedTimeMs !== null &&
			Math.abs(timeMs - this.lastRenderedTimeMs) > CURSOR_TIME_DISCONTINUITY_MS;
		const shouldFreezeCursorMotion =
			freeze || hasTimeDiscontinuity || motionSnapshot.isDiscontinuous;

		if (shouldFreezeCursorMotion || !sameFrameTime) {
			this.state.snapTo(motionSnapshot.cx, motionSnapshot.cy, timeMs);
		}
		const visibilityOpacity = getCursorVisibilityOpacity(motionSnapshot, this.config);
		this.container.visible = visibilityOpacity > 0.001;
		this.container.alpha = visibilityOpacity;
		if (!this.container.visible) {
			this.lastRenderedPoint = {
				px: viewport.x + this.state.x * viewport.width,
				py: viewport.y + this.state.y * viewport.height,
			};
			this.lastRenderedTimeMs = timeMs;
			return;
		}

		const px = viewport.x + this.state.x * viewport.width;
		const py = viewport.y + this.state.y * viewport.height;
		const h = this.config.dotRadius * getCursorViewportScale(viewport);
		const { cursorType, clickBounceProgress, clickProgress } = getCursorVisualState(
			samples,
			timeMs,
			previewClickSample,
			this.config.clickStyle,
		);
		// Bounce is independent of the click graphic; clickBounce = 0 turns it off.
		const enabledClickBounceProgress = clickBounceProgress;
		const enabledClickProgress = this.config.clickEffectsEnabled ? clickProgress : 0;
		const visualMode = resolveCursorVisualMode({
			cursorTypeMode: this.config.cursorTypeMode,
			detectedCursorType: cursorType,
			availableCursorTypes: Object.keys(this.cursorSprites) as CursorAssetKey[],
		});
		const spriteKey = visualMode.assetCursorType as CursorAssetKey;
		const asset = getCursorAsset(
			spriteKey,
			this.config.cursorPack,
			this.config.preferSystemCursorAssets,
		);
		const shadowSprite = this.cursorShadowSprites[spriteKey] ?? this.cursorShadowSprites.arrow!;
		const sprite = this.cursorSprites[spriteKey] ?? this.cursorSprites.arrow!;
		const cursorColor = getCursorColorNumber(this.config);
		const bounceScale = getClickBounceScale(enabledClickBounceProgress, this.config.clickBounce);
		const scaledH = h;
		const swayRotation = this.updateCursorSway(
			px,
			py,
			timeMs,
			shouldFreezeCursorMotion,
			motionSnapshot,
		);

		this.drawTrail(viewport, h, cursorColor);
		drawClickRing(this.clickRingGraphics, px, py, h, enabledClickProgress, this.config);

		for (const [key, currentShadowSprite] of Object.entries(this.cursorShadowSprites) as Array<
			[CursorAssetKey, Sprite]
		>) {
			currentShadowSprite.visible = !visualMode.renderCircleCursor && key === spriteKey;
		}

		for (const [key, currentSprite] of Object.entries(this.cursorSprites) as Array<
			[CursorAssetKey, Sprite]
		>) {
			currentSprite.visible = !visualMode.renderCircleCursor && key === spriteKey;
		}

		this.circleCursorShadowGraphics.visible = visualMode.renderCircleCursor;
		this.circleCursorGraphics.visible = visualMode.renderCircleCursor;

		if (visualMode.renderCircleCursor) {
			this.drawStyledCursor(px, py, scaledH, bounceScale, swayRotation, cursorColor, "circle");
		} else if (shadowSprite) {
			shadowSprite.height = scaledH * bounceScale;
			shadowSprite.width = scaledH * bounceScale * asset.aspectRatio;
			shadowSprite.position.set(px + CURSOR_SHADOW_OFFSET_X, py + CURSOR_SHADOW_OFFSET_Y);
			shadowSprite.rotation = swayRotation;
			shadowSprite.tint = CURSOR_SHADOW_COLOR;
			shadowSprite.alpha = CURSOR_SHADOW_ALPHA;
		}

		if (sprite) {
			sprite.tint = cursorColor;
			sprite.alpha = this.config.cursorOpacity;
			sprite.height = scaledH * bounceScale;
			sprite.width = scaledH * bounceScale * asset.aspectRatio;
			sprite.position.set(px, py);
			sprite.rotation = swayRotation;
		}

		this.applyCursorMotionBlur(px, py, timeMs, shouldFreezeCursorMotion);
		this.lastRenderedPoint = { px, py };
		this.lastRenderedTimeMs = timeMs;
	}

	private drawStyledCursor(
		px: number,
		py: number,
		scaledH: number,
		bounceScale: number,
		rotation: number,
		color: number,
		style: Exclude<CursorStyle, "default">,
	) {
		this.circleCursorShadowGraphics.clear();
		this.circleCursorShadowGraphics.position.set(px + 1.5, py + 1.5);
		this.circleCursorShadowGraphics.rotation = rotation;
		this.circleCursorGraphics.clear();
		this.circleCursorGraphics.position.set(px, py);
		this.circleCursorGraphics.rotation = rotation;

		const radius = (scaledH * 0.28 * bounceScale) / 2;
		const lineWidth = Math.max(1, radius * 0.18);
		const crosshairExtent = radius * 1.5;
		const alpha = this.config.cursorOpacity;

		switch (style) {
			case "dot":
				this.circleCursorShadowGraphics.beginFill(0x000000, 0.22 * alpha);
				this.circleCursorShadowGraphics.drawCircle(0, 0, radius * 0.68);
				this.circleCursorShadowGraphics.endFill();
				this.circleCursorGraphics.beginFill(color, alpha);
				this.circleCursorGraphics.drawCircle(0, 0, radius * 0.68);
				this.circleCursorGraphics.endFill();
				break;
			case "crosshair":
				this.circleCursorShadowGraphics.lineStyle(Math.max(1, lineWidth), 0x000000, 0.24 * alpha);
				this.circleCursorShadowGraphics.drawCircle(0, 0, radius * 0.72);
				this.circleCursorShadowGraphics.moveTo(-crosshairExtent, 0);
				this.circleCursorShadowGraphics.lineTo(crosshairExtent, 0);
				this.circleCursorShadowGraphics.moveTo(0, -crosshairExtent);
				this.circleCursorShadowGraphics.lineTo(0, crosshairExtent);
				this.circleCursorGraphics.lineStyle(Math.max(1, lineWidth), color, alpha);
				this.circleCursorGraphics.drawCircle(0, 0, radius * 0.72);
				this.circleCursorGraphics.moveTo(-crosshairExtent, 0);
				this.circleCursorGraphics.lineTo(crosshairExtent, 0);
				this.circleCursorGraphics.moveTo(0, -crosshairExtent);
				this.circleCursorGraphics.lineTo(0, crosshairExtent);
				break;
			case "ring":
				this.circleCursorShadowGraphics.lineStyle(Math.max(1, lineWidth), 0x000000, 0.24 * alpha);
				this.circleCursorShadowGraphics.drawCircle(0, 0, radius);
				this.circleCursorGraphics.lineStyle(Math.max(1, lineWidth), color, alpha);
				this.circleCursorGraphics.drawCircle(0, 0, radius);
				break;
			case "circle":
			default: {
				const highlightRadius = radius * 0.35;
				const highlightOffset = radius * 0.35;
				this.circleCursorShadowGraphics.beginFill(0x000000, 0.22 * alpha);
				this.circleCursorShadowGraphics.drawCircle(0, 0, radius);
				this.circleCursorShadowGraphics.endFill();
				this.circleCursorGraphics.beginFill(color, alpha);
				this.circleCursorGraphics.lineStyle(lineWidth, 0xffffff, 0.28 * alpha);
				this.circleCursorGraphics.drawCircle(0, 0, radius);
				this.circleCursorGraphics.endFill();
				this.circleCursorGraphics.beginFill(0xffffff, 0.3 * alpha);
				this.circleCursorGraphics.drawCircle(-highlightOffset, -highlightOffset, highlightRadius);
				this.circleCursorGraphics.endFill();
				break;
			}
		}
	}

	private drawTrail(viewport: CursorViewportRect, cursorHeight: number, color: number) {
		this.trailGraphics.clear();
		if (
			this.config.trailLength <= 0 ||
			this.config.trailOpacity <= 0 ||
			this.state.trail.length === 0
		) {
			return;
		}

		const baseRadius = Math.max(2, cursorHeight * 0.08);
		for (const [index, point] of this.state.trail.entries()) {
			const progress = 1 - index / Math.max(1, this.state.trail.length);
			const alpha = progress * this.config.trailOpacity * this.config.cursorOpacity * 0.85;
			const px = viewport.x + point.x * viewport.width;
			const py = viewport.y + point.y * viewport.height;
			this.trailGraphics.beginFill(color, alpha);
			this.trailGraphics.drawCircle(px, py, baseRadius * (0.55 + progress * 0.9));
			this.trailGraphics.endFill();
		}
	}

	private updateCursorSway(
		px: number,
		py: number,
		timeMs: number,
		freeze: boolean,
		motionSnapshot: CursorMotionSnapshot | null,
	) {
		const deltaMs =
			this.lastRenderedTimeMs === null || freeze
				? 1000 / 60
				: Math.max(1, timeMs - this.lastRenderedTimeMs);
		const legacySwayRotation =
			!freeze && this.lastRenderedPoint && this.lastRenderedTimeMs !== null
				? computeCursorSwayRotation(
						px - this.lastRenderedPoint.px,
						py - this.lastRenderedPoint.py,
						timeMs - this.lastRenderedTimeMs,
						this.config.sway,
					)
				: 0;
		const tiltRotation = freeze ? 0 : getCursorTiltRotation(motionSnapshot, this.config.cursorTilt);
		const targetRotation = legacySwayRotation + tiltRotation;

		this.swayRotation = stepSpringValue(
			this.swaySpring,
			targetRotation,
			deltaMs,
			getCursorSwaySpringConfig(
				this.config.springConfig
					? this.config.springConfig.damping / 40
					: this.config.smoothingFactor,
			),
		);

		if (Math.abs(this.swayRotation) < 0.0001 && targetRotation === 0) {
			this.swayRotation = 0;
		}

		return this.swayRotation;
	}

	private applyCursorMotionBlur(px: number, py: number, timeMs: number, freeze: boolean) {
		if (
			freeze ||
			this.config.motionBlur <= 0 ||
			!this.lastRenderedPoint ||
			this.lastRenderedTimeMs === null
		) {
			this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
			this.cursorMotionBlurFilter.kernelSize = 5;
			this.cursorMotionBlurFilter.offset = 0;
			return;
		}

		const deltaMs = Math.max(1, timeMs - this.lastRenderedTimeMs);
		const dx = px - this.lastRenderedPoint.px;
		const dy = py - this.lastRenderedPoint.py;
		const velocityScale =
			(1000 / deltaMs) * this.config.motionBlur * CURSOR_MOTION_BLUR_BASE_MULTIPLIER;
		const velocity = {
			x: dx * velocityScale,
			y: dy * velocityScale,
		};
		const magnitude = Math.hypot(velocity.x, velocity.y);

		this.cursorMotionBlurFilter.velocity = magnitude > 0.05 ? velocity : { x: 0, y: 0 };
		this.cursorMotionBlurFilter.kernelSize = magnitude > 3 ? 9 : magnitude > 1 ? 7 : 5;
		this.cursorMotionBlurFilter.offset = magnitude > 0.5 ? -0.25 : 0;
	}

	reset(): void {
		this.state.reset();
		this.trailGraphics.clear();
		this.clickRingGraphics.clear();
		this.circleCursorShadowGraphics.clear();
		this.circleCursorShadowGraphics.visible = false;
		this.circleCursorGraphics.clear();
		this.circleCursorGraphics.visible = false;
		for (const shadowSprite of Object.values(this.cursorShadowSprites)) {
			shadowSprite.visible = false;
			shadowSprite.scale.set(1);
		}
		for (const sprite of Object.values(this.cursorSprites)) {
			sprite.visible = false;
			sprite.scale.set(1);
		}
		this.container.visible = false;
		this.container.alpha = 1;
		this.lastRenderedPoint = null;
		this.lastRenderedTimeMs = null;
		this.simulationPath = null;
		this.simulationSamplesRef = null;
		this.swayRotation = 0;
		resetSpringState(this.swaySpring, 0);
		this.cursorMotionBlurFilter.velocity = { x: 0, y: 0 };
		this.cursorMotionBlurFilter.kernelSize = 5;
		this.cursorMotionBlurFilter.offset = 0;
	}

	destroy(): void {
		this.trailGraphics.destroy();
		this.clickRingGraphics.destroy();
		this.circleCursorShadowGraphics.destroy();
		this.circleCursorGraphics.destroy();
		for (const shadowFilter of Object.values(this.cursorShadowFilters)) {
			shadowFilter.destroy();
		}
		this.cursorMotionBlurFilter.destroy();
		this.container.destroy({ children: true });
	}
}

export function drawCursorOnCanvas(
	ctx: CanvasRenderingContext2D,
	samples: CursorTelemetryPoint[],
	timeMs: number,
	viewport: CursorViewportRect,
	smoothedState: SmoothedCursorState,
	config: CursorRenderConfig = DEFAULT_CURSOR_CONFIG,
): void {
	if (samples.length === 0 || viewport.width <= 0 || viewport.height <= 0) return;

	const target = interpolateCursorPosition(samples, timeMs);
	if (!target) return;

	smoothedState.update(target.cx, target.cy, timeMs);

	const px = viewport.x + smoothedState.x * viewport.width;
	const py = viewport.y + smoothedState.y * viewport.height;
	const h = config.dotRadius * getCursorViewportScale(viewport);
	const { cursorType, clickBounceProgress } = getCursorVisualState(
		samples,
		timeMs,
		null,
		config.clickStyle,
	);
	let spriteKey: CursorAssetKey = "arrow";
	if (config.cursorTypeMode !== "circle" && cursorType) {
		try {
			getCursorAsset(cursorType, config.cursorPack, config.preferSystemCursorAssets);
			spriteKey = cursorType;
		} catch {
			spriteKey = "arrow";
		}
	}
	const asset = getCursorAsset(spriteKey, config.cursorPack, config.preferSystemCursorAssets);
	const bounceScale = getClickBounceScale(clickBounceProgress, config.clickBounce);

	if (config.cursorTypeMode === "circle") {
		const radius = ((h * 0.28) / 2) * bounceScale;
		const highlightRadius = radius * 0.35;
		const highlightOffset = radius * 0.35;
		ctx.save();
		ctx.globalAlpha = config.dotAlpha;
		ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
		ctx.shadowBlur = 6;
		ctx.shadowOffsetX = 1.5;
		ctx.shadowOffsetY = 1.5;
		ctx.fillStyle = "#F59E0B";
		ctx.beginPath();
		ctx.arc(px, py, radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowColor = "transparent";
		ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
		ctx.lineWidth = Math.max(1, radius * 0.18);
		ctx.stroke();
		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.beginPath();
		ctx.arc(px - highlightOffset, py - highlightOffset, highlightRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		return;
	}

	ctx.save();
	ctx.filter = CURSOR_SVG_DROP_SHADOW_FILTER;

	const drawHeight = h * bounceScale;
	const drawWidth = drawHeight * asset.aspectRatio;
	const hotspotX = asset.anchorX * drawWidth;
	const hotspotY = asset.anchorY * drawHeight;
	ctx.globalAlpha = config.dotAlpha;
	ctx.drawImage(asset.image, px - hotspotX, py - hotspotY, drawWidth, drawHeight);

	ctx.restore();
}
