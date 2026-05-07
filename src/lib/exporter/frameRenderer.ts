import { Application, BlurFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { MotionBlurFilter } from "pixi-filters/motion-blur";
import {
	createWebcamZoomMotionState,
	type WebcamZoomMotionState,
} from "@/components/video-editor/cameraLayouts";
import {
	applyOpacityToHex,
	buildFrameShadowFilter,
	hasVisibleFrameShadow,
} from "@/components/video-editor/frameEffects";
import { renderKeyboardShortcutCalloutsCanvas } from "@/components/video-editor/keyboardShortcuts";
import type {
	AnnotationRegion,
	CameraLayoutRegion,
	CaptionRegion,
	CaptionSettings,
	CropRegion,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorStyle,
	CursorTelemetryPoint,
	CursorTypeMode,
	DeviceMockup,
	KeyboardShortcutCallout,
	KeyboardShortcutPosition,
	KeyboardShortcutTheme,
	SpeedRegion,
	WebcamEffects,
	WebcamRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import {
	DEFAULT_CURSOR_SPRING,
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_REGION,
} from "@/components/video-editor/types";
import {
	createPlaybackCameraState,
	evaluatePlaybackCameraFrame,
	type PlaybackCameraState,
} from "@/components/video-editor/videoPlayback/cameraEvaluator";
import {
	DEFAULT_CURSOR_CONFIG,
	PixiCursorOverlay,
	preloadCursorAssets,
} from "@/components/video-editor/videoPlayback/cursorRenderer";
import {
	buildCursorSimulationPath,
	type CursorSimulationPath,
} from "@/components/video-editor/videoPlayback/cursorSimulation";
import { resolveCursorV2Config } from "@/components/video-editor/videoPlayback/cursorV2";
import { getMockupDefinition } from "@/components/video-editor/videoPlayback/deviceMockups";
import { calculateVideoLayoutGeometry } from "@/components/video-editor/videoPlayback/layoutUtils";
import {
	applyZoomTransform,
	createMotionBlurState,
	type MotionBlurState,
	projectFrameRect,
} from "@/components/video-editor/videoPlayback/zoomTransform";
import {
	createWebcamCompositionScratch,
	drawResolvedWebcamComposition,
} from "@/components/video-editor/webcamEffects";
import { evaluateWebcamFrame } from "@/components/video-editor/webcamFrameEvaluation";
import { resolveWebcamRenderSpec } from "@/components/video-editor/webcamRenderSpec";
import {
	createWebcamSegmentationProvider,
	type WebcamSegmentationFrame,
	type WebcamSegmentationProvider,
} from "@/components/video-editor/webcamSegmentation";
import { getAssetPath, getRenderableAssetUrl } from "@/lib/assetPath";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { renderAnnotations, renderCaptions } from "./annotationRenderer";
import { StreamingVideoFrameProvider } from "./streamingDecoder";

interface FrameRenderConfig {
	width: number;
	height: number;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	frameShadowSize?: number;
	frameShadowOpacity?: number;
	frameShadowBlur?: number;
	backgroundBlur: number;
	hideBackground?: boolean;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	deviceMockup?: DeviceMockup;
	frameBorderEnabled?: boolean;
	frameBorderWidth?: number;
	frameBorderColor?: string;
	frameBorderOpacity?: number;
	borderRadius?: number;
	padding?: number;
	cropRegion: CropRegion;
	aspectRatio?: AspectRatio;
	videoWidth: number;
	videoHeight: number;
	annotationRegions?: AnnotationRegion[];
	speedRegions?: SpeedRegion[];
	previewWidth?: number;
	previewHeight?: number;
	cursorTelemetry?: CursorTelemetryPoint[];
	keyboardShortcutCallouts?: KeyboardShortcutCallout[];
	showKeyboardShortcuts?: boolean;
	keyboardShortcutPosition?: KeyboardShortcutPosition;
	keyboardShortcutTheme?: KeyboardShortcutTheme;
	keyboardShortcutScale?: number;
	keyboardShortcutOpacity?: number;
	keyboardShortcutMaxVisible?: number;
	showCursor?: boolean;
	cursorSize?: number;
	cursorSmoothing?: number;
	cursorMotionBlur?: number;
	cursorClickBounce?: number;
	cursorSway?: number;
	cursorStyle?: CursorStyle;
	cursorPack?: CursorPack;
	cursorColor?: string;
	cursorOpacity?: number;
	clickEffectsEnabled?: boolean;
	clickHighlightColor?: string;
	clickHighlightSize?: number;
	clickHighlightOpacity?: number;
	cursorTrailLength?: number;
	cursorTrailOpacity?: number;
	cursorTypeMode?: CursorTypeMode;
	cursorTilt?: number;
	hideWhenIdle?: boolean;
	idleHideDelayMs?: number;
	smoothMovementEnabled?: boolean;
	cursorMovementStyle?: CursorMovementStyle;
	cursorSpring?: CursorSpringSettings;
	highQualitySvgCursors?: boolean;
	cameraSpring?: import("@/components/video-editor/types").CameraSpringSettings;
	webcamPath?: string | null;
	webcamRegion?: WebcamRegion;
	webcamEffects?: WebcamEffects;
	showWebcam?: boolean;
	mirrorWebcam?: boolean;
	cameraSizeDuringZoom?: number;
	cameraLayouts?: CameraLayoutRegion[];
	captionRegions?: CaptionRegion[];
	captionSettings?: CaptionSettings;
}

type TextureSourceInput = Parameters<typeof Texture.from>[0];

interface FrameLayoutCache {
	stageSize: { width: number; height: number };
	frameRect: { x: number; y: number; width: number; height: number };
	videoSize: { width: number; height: number };
	baseScale: number;
	baseOffset: { x: number; y: number };
	maskRect: { x: number; y: number; width: number; height: number };
}

interface FrameShadowSettings {
	size: number;
	opacity: number;
	blur: number;
}

// Renders video frames with all effects (background, zoom, crop, blur, shadow) to an offscreen canvas for export.

export class FrameRenderer {
	private app: Application | null = null;
	private cameraContainer: Container | null = null;
	private videoContainer: Container | null = null;
	private cursorContainer: Container | null = null;
	private videoSprite: Sprite | null = null;
	private videoTexture: Texture | null = null;
	private frameCanvas: HTMLCanvasElement | null = null;
	private frameCtx: CanvasRenderingContext2D | null = null;
	private backgroundCanvas: HTMLCanvasElement | null = null;
	private maskGraphics: Graphics | null = null;
	private blurFilter: BlurFilter | null = null;
	private motionBlurFilter: MotionBlurFilter | null = null;
	private shadowCanvas: HTMLCanvasElement | null = null;
	private shadowCtx: CanvasRenderingContext2D | null = null;
	private compositeCanvas: HTMLCanvasElement | null = null;
	private compositeCtx: CanvasRenderingContext2D | null = null;
	private config: FrameRenderConfig;
	private animationState: PlaybackCameraState;
	private webcamMotionState: WebcamZoomMotionState;
	private webcamLayoutMotionState: WebcamZoomMotionState;
	private motionBlurState: MotionBlurState;
	private layoutCache: FrameLayoutCache | null = null;
	private currentVideoTime = 0;
	private lastMotionVector = { x: 0, y: 0 };
	private cursorOverlay: PixiCursorOverlay | null = null;
	private webcamFrameProvider: StreamingVideoFrameProvider | null = null;
	private webcamSegmentationProvider: WebcamSegmentationProvider | null = null;
	private webcamSourceSize: { width: number; height: number } | null = null;
	private webcamSegmentationCache = new Map<number, WebcamSegmentationFrame | null>();
	private cursorSimulationPath: CursorSimulationPath | null = null;
	private webcamImageCache = new Map<string, Promise<HTMLImageElement | null>>();
	private webcamCompositionScratch = createWebcamCompositionScratch();
	private readonly canvasScaleFactor: number;
	private readonly annotationScaleFactor: number;
	private readonly shadowSettings: FrameShadowSettings;
	private readonly borderRadiusPx: number;
	private readonly borderWidthPx: number;
	private readonly frameBorderColorWithOpacity: string;
	private readonly webcamCompositionRect: { x: number; y: number; width: number; height: number };

	constructor(config: FrameRenderConfig) {
		this.config = config;
		this.animationState = createPlaybackCameraState();
		this.webcamMotionState = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		this.webcamLayoutMotionState = createWebcamZoomMotionState(DEFAULT_WEBCAM_REGION);
		this.motionBlurState = createMotionBlurState();
		const previewWidth = this.config.previewWidth || 1920;
		const previewHeight = this.config.previewHeight || 1080;
		this.canvasScaleFactor = Math.min(
			this.config.width / previewWidth,
			this.config.height / previewHeight,
		);
		this.annotationScaleFactor =
			(this.config.width / previewWidth + this.config.height / previewHeight) / 2;
		this.shadowSettings = {
			size: this.config.frameShadowSize ?? this.config.shadowIntensity * 12,
			opacity: this.config.frameShadowOpacity ?? this.config.shadowIntensity * 0.7,
			blur: this.config.frameShadowBlur ?? this.config.shadowIntensity * 48,
		};
		this.borderRadiusPx = (this.config.borderRadius || 0) * this.canvasScaleFactor;
		this.borderWidthPx = (this.config.frameBorderWidth || 0) * this.canvasScaleFactor;
		this.frameBorderColorWithOpacity = applyOpacityToHex(
			this.config.frameBorderColor || "#000000",
			this.config.frameBorderOpacity ?? 0,
		);
		this.webcamCompositionRect = {
			x: 0,
			y: 0,
			width: this.config.width,
			height: this.config.height,
		};
	}

	async initialize(): Promise<void> {
		let cursorOverlayEnabled = true;
		try {
			await preloadCursorAssets();
		} catch (error) {
			cursorOverlayEnabled = false;
			console.warn(
				"[FrameRenderer] Native cursor assets are unavailable; continuing export without cursor overlay.",
				error,
			);
		}

		// Create canvas for rendering
		const canvas = document.createElement("canvas");
		canvas.width = this.config.width;
		canvas.height = this.config.height;

		// Try to set colorSpace if supported (may not be available on all platforms)
		try {
			if ("colorSpace" in canvas) {
				(canvas as HTMLCanvasElement & { colorSpace?: string }).colorSpace = "srgb";
			}
		} catch (error) {
			// Silently ignore colorSpace errors on platforms that don't support it
			console.warn("[FrameRenderer] colorSpace not supported on this platform:", error);
		}

		// Initialize PixiJS with optimized settings for export performance
		this.app = new Application();
		await this.app.init({
			canvas,
			width: this.config.width,
			height: this.config.height,
			backgroundAlpha: 0,
			antialias: true,
			resolution: 1,
			autoDensity: true,
		});

		// Setup containers
		this.cameraContainer = new Container();
		this.videoContainer = new Container();
		this.cursorContainer = new Container();
		this.app.stage.addChild(this.cameraContainer);
		this.cameraContainer.addChild(this.videoContainer);
		this.cameraContainer.addChild(this.cursorContainer);

		this.cursorSimulationPath = buildCursorSimulationPath(
			this.config.cursorTelemetry ?? [],
			this.config.cursorTelemetry?.[this.config.cursorTelemetry.length - 1]?.timeMs ?? 0,
		);

		if (cursorOverlayEnabled) {
			const resolvedCursorConfig = resolveCursorV2Config({
				cursorPack: this.config.cursorPack,
				cursorTypeMode: this.config.cursorTypeMode ?? "auto",
				cursorTilt: this.config.cursorTilt ?? 0,
				hideWhenIdle: this.config.hideWhenIdle ?? false,
				idleHideDelayMs: this.config.idleHideDelayMs ?? 1500,
				smoothMovementEnabled: this.config.smoothMovementEnabled ?? true,
				cursorMovementStyle: this.config.cursorMovementStyle ?? "custom",
				cursorSpring: this.config.cursorSpring ?? DEFAULT_CURSOR_SPRING,
				highQualitySvgCursors: this.config.highQualitySvgCursors ?? true,
			});
			this.cursorOverlay = new PixiCursorOverlay({
				dotRadius: DEFAULT_CURSOR_CONFIG.dotRadius * (this.config.cursorSize ?? 1.4),
				smoothingFactor:
					this.config.smoothMovementEnabled === false ? 0 : (this.config.cursorSmoothing ?? 0),
				motionBlur: this.config.cursorMotionBlur ?? 0,
				clickBounce: this.config.cursorClickBounce ?? DEFAULT_CURSOR_CONFIG.clickBounce,
				sway: this.config.cursorSway ?? DEFAULT_CURSOR_CONFIG.sway,
				cursorStyle: this.config.cursorStyle ?? DEFAULT_CURSOR_CONFIG.cursorStyle,
				cursorPack: resolvedCursorConfig.cursorPack,
				cursorColor: this.config.cursorColor ?? DEFAULT_CURSOR_CONFIG.cursorColor,
				cursorOpacity: this.config.cursorOpacity ?? DEFAULT_CURSOR_CONFIG.cursorOpacity,
				clickEffectsEnabled:
					this.config.clickEffectsEnabled ?? DEFAULT_CURSOR_CONFIG.clickEffectsEnabled,
				clickHighlightColor:
					this.config.clickHighlightColor ?? DEFAULT_CURSOR_CONFIG.clickHighlightColor,
				clickHighlightSize:
					this.config.clickHighlightSize ?? DEFAULT_CURSOR_CONFIG.clickHighlightSize,
				clickHighlightOpacity:
					this.config.clickHighlightOpacity ?? DEFAULT_CURSOR_CONFIG.clickHighlightOpacity,
				trailLength: this.config.cursorTrailLength ?? DEFAULT_CURSOR_CONFIG.trailLength,
				trailOpacity: this.config.cursorTrailOpacity ?? DEFAULT_CURSOR_CONFIG.trailOpacity,
				springConfig: resolvedCursorConfig.springConfig,
				cursorTypeMode: resolvedCursorConfig.cursorTypeMode,
				cursorTilt: resolvedCursorConfig.cursorTilt,
				hideWhenIdle: resolvedCursorConfig.hideWhenIdle,
				idleHideDelayMs: resolvedCursorConfig.idleHideDelayMs,
				preferSystemCursorAssets: resolvedCursorConfig.preferSystemCursorAssets,
			});
		}

		// Setup background (render separately, not in PixiJS)
		await this.setupBackground();

		this.frameCanvas = document.createElement("canvas");
		this.frameCanvas.width = this.config.videoWidth;
		this.frameCanvas.height = this.config.videoHeight;
		this.frameCtx = this.frameCanvas.getContext("2d", { willReadFrequently: false });
		if (!this.frameCtx) {
			throw new Error("Failed to get 2D context for frame canvas");
		}

		// Setup blur filter for video container
		this.blurFilter = new BlurFilter();
		this.blurFilter.quality = 5;
		this.blurFilter.resolution = this.app.renderer.resolution;
		this.blurFilter.blur = 0;
		this.motionBlurFilter = new MotionBlurFilter([0, 0], 5, 0);
		this.videoContainer.filters = [this.blurFilter, this.motionBlurFilter];

		// Setup composite canvas for final output with shadows
		this.compositeCanvas = document.createElement("canvas");
		this.compositeCanvas.width = this.config.width;
		this.compositeCanvas.height = this.config.height;
		this.compositeCtx = this.compositeCanvas.getContext("2d", {
			willReadFrequently: false,
		});

		if (!this.compositeCtx) {
			throw new Error("Failed to get 2D context for composite canvas");
		}

		// Setup shadow canvas if needed
		if (this.config.showShadow) {
			this.shadowCanvas = document.createElement("canvas");
			this.shadowCanvas.width = this.config.width;
			this.shadowCanvas.height = this.config.height;
			this.shadowCtx = this.shadowCanvas.getContext("2d", {
				willReadFrequently: false,
			});

			if (!this.shadowCtx) {
				throw new Error("Failed to get 2D context for shadow canvas");
			}
		}

		// Setup mask
		this.maskGraphics = new Graphics();
		this.videoContainer.addChild(this.maskGraphics);
		this.videoContainer.mask = this.maskGraphics;
		if (this.cursorOverlay) {
			this.cursorContainer.addChild(this.cursorOverlay.container);
		}

		// Setup sequential webcam frame provider if available
		if (this.config.webcamPath) {
			try {
				this.webcamFrameProvider = new StreamingVideoFrameProvider();
				const webcamInfo = await this.webcamFrameProvider.loadMetadata(this.config.webcamPath);
				this.webcamSourceSize = {
					width: webcamInfo.width,
					height: webcamInfo.height,
				};
			} catch (error) {
				console.warn(
					"[FrameRenderer] Webcam decode setup failed; continuing without webcam.",
					error,
				);
				this.webcamFrameProvider?.destroy();
				this.webcamFrameProvider = null;
				this.webcamSourceSize = null;
			}
		}
	}

	private async setupBackground(): Promise<void> {
		if (this.config.hideBackground) {
			this.backgroundCanvas = null;
			return;
		}

		const wallpaper = await this.resolveWallpaperForExport(this.config.wallpaper);

		// Create background canvas for separate rendering (not affected by zoom)
		const bgCanvas = document.createElement("canvas");
		bgCanvas.width = this.config.width;
		bgCanvas.height = this.config.height;
		const bgCtx = bgCanvas.getContext("2d")!;

		try {
			// Render background based on type
			if (
				wallpaper.startsWith("file://") ||
				wallpaper.startsWith("data:") ||
				wallpaper.startsWith("/") ||
				wallpaper.startsWith("http")
			) {
				// Image background
				const img = new Image();
				const imageUrl = await this.resolveWallpaperImageUrl(wallpaper);
				// Don't set crossOrigin for same-origin images to avoid CORS taint.
				if (
					imageUrl.startsWith("http") &&
					window.location.origin &&
					!imageUrl.startsWith(window.location.origin)
				) {
					img.crossOrigin = "anonymous";
				}

				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = (err) => {
						console.error("[FrameRenderer] Failed to load background image:", imageUrl, err);
						reject(new Error(`Failed to load background image: ${imageUrl}`));
					};
					img.src = imageUrl;
				});

				// Draw the image using cover and center positioning
				const imgAspect = img.width / img.height;
				const canvasAspect = this.config.width / this.config.height;

				let drawWidth, drawHeight, drawX, drawY;

				if (imgAspect > canvasAspect) {
					drawHeight = this.config.height;
					drawWidth = drawHeight * imgAspect;
					drawX = (this.config.width - drawWidth) / 2;
					drawY = 0;
				} else {
					drawWidth = this.config.width;
					drawHeight = drawWidth / imgAspect;
					drawX = 0;
					drawY = (this.config.height - drawHeight) / 2;
				}

				bgCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
			} else if (wallpaper.startsWith("#")) {
				bgCtx.fillStyle = wallpaper;
				bgCtx.fillRect(0, 0, this.config.width, this.config.height);
			} else if (
				wallpaper.startsWith("linear-gradient") ||
				wallpaper.startsWith("radial-gradient")
			) {
				const gradientMatch = wallpaper.match(/(linear|radial)-gradient\((.+)\)/);
				if (gradientMatch) {
					const [, type, params] = gradientMatch;
					const parts = params.split(",").map((s) => s.trim());

					let gradient: CanvasGradient;

					if (type === "linear") {
						gradient = bgCtx.createLinearGradient(0, 0, 0, this.config.height);
						parts.forEach((part, index) => {
							if (part.startsWith("to ") || part.includes("deg")) return;

							const colorMatch = part.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/);
							if (colorMatch) {
								const color = colorMatch[1];
								const position = index / (parts.length - 1);
								gradient.addColorStop(position, color);
							}
						});
					} else {
						const cx = this.config.width / 2;
						const cy = this.config.height / 2;
						const radius = Math.max(this.config.width, this.config.height) / 2;
						gradient = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);

						parts.forEach((part, index) => {
							const colorMatch = part.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/);
							if (colorMatch) {
								const color = colorMatch[1];
								const position = index / (parts.length - 1);
								gradient.addColorStop(position, color);
							}
						});
					}

					bgCtx.fillStyle = gradient;
					bgCtx.fillRect(0, 0, this.config.width, this.config.height);
				} else {
					console.warn("[FrameRenderer] Could not parse gradient, using black fallback");
					bgCtx.fillStyle = "#000000";
					bgCtx.fillRect(0, 0, this.config.width, this.config.height);
				}
			} else {
				bgCtx.fillStyle = wallpaper;
				bgCtx.fillRect(0, 0, this.config.width, this.config.height);
			}
		} catch (error) {
			console.error("[FrameRenderer] Error setting up background, using fallback:", error);
			bgCtx.fillStyle = "#000000";
			bgCtx.fillRect(0, 0, this.config.width, this.config.height);
		}

		// Store the background canvas for compositing
		this.backgroundCanvas = bgCanvas;
	}

	private async resolveWallpaperImageUrl(wallpaper: string): Promise<string> {
		if (
			wallpaper.startsWith("file://") ||
			wallpaper.startsWith("data:") ||
			wallpaper.startsWith("http")
		) {
			return wallpaper;
		}

		const resolved = await getAssetPath(wallpaper.replace(/^\/+/, ""));
		if (resolved.startsWith("/") && window.location.protocol.startsWith("http")) {
			return `${window.location.origin}${resolved}`;
		}

		return resolved;
	}

	private async resolveWallpaperForExport(wallpaper: string): Promise<string> {
		if (!wallpaper) {
			return wallpaper;
		}

		if (
			wallpaper.startsWith("#") ||
			wallpaper.startsWith("linear-gradient") ||
			wallpaper.startsWith("radial-gradient")
		) {
			return wallpaper;
		}

		const looksLikeAbsoluteFilePath =
			wallpaper.startsWith("/") &&
			!wallpaper.startsWith("//") &&
			!wallpaper.startsWith("/wallpapers/") &&
			!wallpaper.startsWith("/app-icons/");

		const wallpaperAsset = looksLikeAbsoluteFilePath ? `file://${encodeURI(wallpaper)}` : wallpaper;

		return getRenderableAssetUrl(wallpaperAsset);
	}

	drawWebcamFrame(
		ctx: CanvasRenderingContext2D,
		frame: CanvasImageSource,
		sourceCrop: { x: number; y: number; width: number; height: number } | null,
		x: number,
		y: number,
		width: number,
		height: number,
		mirror: boolean,
	) {
		const drawFrame = () => {
			if (sourceCrop) {
				ctx.drawImage(
					frame,
					sourceCrop.x,
					sourceCrop.y,
					sourceCrop.width,
					sourceCrop.height,
					0,
					0,
					width,
					height,
				);
				return;
			}

			ctx.drawImage(frame, 0, 0, width, height);
		};

		if (!mirror) {
			ctx.save();
			ctx.translate(x, y);
			drawFrame();
			ctx.restore();
			return;
		}

		ctx.save();
		ctx.translate(x + width, y);
		ctx.scale(-1, 1);
		drawFrame();
		ctx.restore();
	}

	private async loadWebcamBackgroundImage(imagePath: string): Promise<HTMLImageElement | null> {
		const cached = this.webcamImageCache.get(imagePath);
		if (cached) {
			return cached;
		}

		const pending = (async () => {
			try {
				const img = new Image();
				const src = imagePath.startsWith("file://") ? imagePath : `file://${encodeURI(imagePath)}`;
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = () => reject(new Error(`Failed to load ${src}`));
					img.src = src;
				});
				return img;
			} catch (error) {
				console.warn("[FrameRenderer] Failed to load webcam background image:", error);
				return null;
			}
		})();

		this.webcamImageCache.set(imagePath, pending);
		return pending;
	}

	private async ensureWebcamSegmentationProvider() {
		if (this.webcamSegmentationProvider) {
			return this.webcamSegmentationProvider;
		}

		this.webcamSegmentationProvider = await createWebcamSegmentationProvider();
		return this.webcamSegmentationProvider;
	}

	private getWebcamSegmentationCacheBucket(timeMs: number) {
		return Math.round(timeMs / (1000 / 15));
	}

	private async getCachedWebcamSegmentationFrame(
		webcamFrame: VideoFrame,
		timeMs: number,
	): Promise<WebcamSegmentationFrame | null> {
		const bucket = this.getWebcamSegmentationCacheBucket(timeMs);
		if (this.webcamSegmentationCache.has(bucket)) {
			return this.webcamSegmentationCache.get(bucket) ?? null;
		}

		const segmentationProvider = await this.ensureWebcamSegmentationProvider();
		if (!segmentationProvider) {
			this.webcamSegmentationCache.set(bucket, null);
			return null;
		}

		const segmentationFrame = await segmentationProvider.segment(webcamFrame, timeMs, {
			mode: "export",
			workingMaxEdge: 512,
			refinementMode: "sync",
		});
		this.webcamSegmentationCache.set(bucket, segmentationFrame ?? null);
		return segmentationFrame ?? null;
	}

	async renderFrame(videoFrame: VideoFrame, timestamp: number): Promise<void> {
		if (!this.app || !this.videoContainer || !this.cameraContainer) {
			throw new Error("Renderer not initialized");
		}

		this.currentVideoTime = timestamp / 1000000;

		if (!this.frameCanvas || !this.frameCtx) {
			throw new Error("Frame canvas not initialized");
		}

		if (
			this.frameCanvas.width !== videoFrame.displayWidth ||
			this.frameCanvas.height !== videoFrame.displayHeight
		) {
			this.frameCanvas.width = videoFrame.displayWidth;
			this.frameCanvas.height = videoFrame.displayHeight;
			if (this.videoTexture) {
				this.videoTexture.destroy(true);
				this.videoTexture = null;
			}
		}

		this.frameCtx.clearRect(0, 0, this.frameCanvas.width, this.frameCanvas.height);
		this.frameCtx.drawImage(videoFrame, 0, 0, this.frameCanvas.width, this.frameCanvas.height);

		if (!this.videoSprite) {
			this.videoTexture = Texture.from(this.frameCanvas as TextureSourceInput);
			this.videoSprite = new Sprite(this.videoTexture);
			this.videoContainer.addChild(this.videoSprite);
			if (this.cursorOverlay && this.cursorContainer) {
				this.cursorContainer.addChild(this.cursorOverlay.container);
			}
			if (this.maskGraphics) {
				this.videoContainer.addChild(this.maskGraphics);
			}
		} else {
			this.videoTexture?.source.update();
		}

		// Apply layout
		this.updateLayout();
		if (!this.layoutCache) {
			throw new Error("Frame layout was not computed");
		}

		const timeMs = this.currentVideoTime * 1000;

		const evaluation = this.updateAnimationState(timeMs);
		const maxMotionIntensity = evaluation.motionIntensity;

		// Apply transform once with maximum motion intensity from all ticks
		applyZoomTransform({
			cameraContainer: this.cameraContainer,
			blurFilter: this.blurFilter,
			motionBlurFilter: this.motionBlurFilter,
			stageSize: this.layoutCache.stageSize,
			baseMask: this.layoutCache.maskRect,
			zoomScale: this.animationState.scale,
			zoomProgress: this.animationState.progress,
			focusX: this.animationState.focusX,
			focusY: this.animationState.focusY,
			motionIntensity: maxMotionIntensity,
			motionVector: this.lastMotionVector,
			isPlaying: true,
			motionBlurAmount: this.config.zoomMotionBlur ?? 0,
			transformOverride: {
				scale: this.animationState.appliedScale,
				x: this.animationState.x,
				y: this.animationState.y,
			},
			motionBlurState: this.motionBlurState,
			frameTimeMs: timeMs,
		});

		if (this.cursorOverlay) {
			this.cursorOverlay.updateFromMotionSnapshot(
				evaluation.simulatedCursor,
				this.config.cursorTelemetry ?? [],
				timeMs,
				this.layoutCache.maskRect,
				this.config.showCursor ?? true,
				false,
			);
		}

		// Render the PixiJS stage to its canvas (video only, transparent background)
		this.app.renderer.render(this.app.stage);

		// Composite with shadows to final output canvas
		this.compositeWithShadows();

		// Render annotations on top if present
		if (
			this.config.annotationRegions &&
			this.config.annotationRegions.length > 0 &&
			this.compositeCtx
		) {
			// Calculate scale factor based on export vs preview dimensions
			await renderAnnotations(
				this.compositeCtx,
				this.config.annotationRegions,
				this.config.width,
				this.config.height,
				timeMs,
				this.annotationScaleFactor,
			);
		}

		// Render captions
		if (
			this.compositeCtx &&
			this.config.captionRegions?.length &&
			this.config.captionSettings?.enabled
		) {
			renderCaptions(
				this.compositeCtx,
				this.config.captionRegions,
				this.config.captionSettings,
				this.config.width,
				this.config.height,
				timeMs,
			);
		}

		if (
			this.compositeCtx &&
			this.config.showKeyboardShortcuts &&
			this.config.keyboardShortcutCallouts?.length
		) {
			renderKeyboardShortcutCalloutsCanvas(
				this.compositeCtx,
				this.config.keyboardShortcutCallouts,
				timeMs,
				this.config.width,
				this.config.height,
				{
					position: this.config.keyboardShortcutPosition ?? "bottom-center",
					theme: this.config.keyboardShortcutTheme ?? "dark",
					scale: this.config.keyboardShortcutScale ?? 1,
					opacity: this.config.keyboardShortcutOpacity ?? 1,
					maxVisible: this.config.keyboardShortcutMaxVisible ?? 1,
				},
			);
		}

		const compositeCtx = this.compositeCtx;
		if (compositeCtx && this.webcamFrameProvider && this.config.webcamRegion) {
			const webcamFrame = await this.webcamFrameProvider.getFrameAt(timeMs);
			if (webcamFrame) {
				try {
					const webcamContentRect = this.layoutCache?.maskRect ?? this.webcamCompositionRect;
					const webcamEvaluation = evaluateWebcamFrame({
						state: {
							baseMotionState: this.webcamMotionState,
							layoutMotionState: this.webcamLayoutMotionState,
						},
						playbackTimeMs: timeMs,
						webcamRegion: this.config.webcamRegion,
						showWebcam: this.config.showWebcam ?? true,
						mirrorWebcam: this.config.mirrorWebcam,
						cameraLayouts: this.config.cameraLayouts,
						zoomRegions: this.config.zoomRegions,
						cursorTelemetry: this.config.cursorTelemetry,
						connectZooms: this.config.connectZooms,
						cameraSizeDuringZoom: this.config.cameraSizeDuringZoom,
						enableCursorAvoidance: this.config.webcamEffects?.subtleAvoidance,
						compositionRect: this.webcamCompositionRect,
						contentRect: webcamContentRect,
						containerWidth: this.config.width,
						containerHeight: this.config.height,
						sourceSize: this.webcamSourceSize,
						effects: this.config.webcamEffects,
						renderMode: "export",
						sourceKey: this.config.webcamPath ?? "webcam-export",
						shouldSmooth: true,
					});
					this.webcamMotionState = webcamEvaluation.baseMotionState;
					this.webcamLayoutMotionState = webcamEvaluation.layoutMotionState;
					const webcamModel = webcamEvaluation.renderSpec.renderModel;

					if (webcamModel.opacity > 0) {
						const requestedWebcamEffects = this.config.webcamEffects ?? DEFAULT_WEBCAM_EFFECTS;
						let segmentationFrame = null;
						let fallbackState =
							"none" as import("@/components/video-editor/types").WebcamEffectFallbackState;
						const exportReferenceSpec = webcamEvaluation.renderSpec;
						if (exportReferenceSpec.segmentationRequired) {
							try {
								segmentationFrame = await this.getCachedWebcamSegmentationFrame(
									webcamFrame,
									timeMs,
								);
								if (!segmentationFrame?.mask) {
									fallbackState = "segmentation-unavailable";
								}
							} catch (error) {
								console.warn("[FrameRenderer] Webcam segmentation failed:", error);
								this.webcamSegmentationProvider?.close();
								this.webcamSegmentationProvider = null;
								this.webcamSegmentationCache.clear();
								fallbackState = "segmentation-unavailable";
							}
						}

						const renderSpec = resolveWebcamRenderSpec({
							timeMs,
							webcamRegion: this.config.webcamRegion,
							showWebcam: this.config.showWebcam ?? true,
							resolvedRenderModel: webcamModel,
							containerWidth: this.config.width,
							containerHeight: this.config.height,
							sourceSize: this.webcamSourceSize,
							effects: requestedWebcamEffects,
							renderMode: "export",
							forcedFallbackState: fallbackState,
							segmentationFrame,
						});
						const { displayRect } = renderSpec.renderModel;
						const effectModel = renderSpec.compositionModel;
						compositeCtx.save();
						compositeCtx.globalAlpha = renderSpec.renderModel.opacity;

						if (renderSpec.renderModel.mode !== "fullscreen" && webcamModel.shadowOpacity > 0) {
							compositeCtx.save();
							compositeCtx.beginPath();
							if (renderSpec.renderModel.clipShape === "circle") {
								compositeCtx.ellipse(
									displayRect.x + displayRect.width / 2,
									displayRect.y + displayRect.height / 2,
									displayRect.width / 2,
									displayRect.height / 2,
									0,
									0,
									Math.PI * 2,
								);
							} else {
								compositeCtx.roundRect(
									displayRect.x,
									displayRect.y,
									displayRect.width,
									displayRect.height,
									renderSpec.renderModel.borderRadiusPx,
								);
							}
							compositeCtx.fillStyle = effectModel.shadowColor;
							compositeCtx.shadowColor = effectModel.shadowColor;
							compositeCtx.shadowBlur = effectModel.shadowBlurPx;
							compositeCtx.shadowOffsetX = 0;
							compositeCtx.shadowOffsetY = effectModel.shadowOffsetYPx;
							compositeCtx.globalAlpha = effectModel.shadowOpacity;
							compositeCtx.fill();
							compositeCtx.restore();
							compositeCtx.globalAlpha = renderSpec.renderModel.opacity;
						}

						compositeCtx.beginPath();
						if (renderSpec.renderModel.clipShape === "circle") {
							compositeCtx.ellipse(
								displayRect.x + displayRect.width / 2,
								displayRect.y + displayRect.height / 2,
								displayRect.width / 2,
								displayRect.height / 2,
								0,
								0,
								Math.PI * 2,
							);
						} else {
							compositeCtx.roundRect(
								displayRect.x,
								displayRect.y,
								displayRect.width,
								displayRect.height,
								renderSpec.renderModel.borderRadiusPx,
							);
						}
						compositeCtx.clip();
						const backgroundImage =
							effectModel.backgroundMode === "image" && effectModel.backgroundImagePath
								? await this.loadWebcamBackgroundImage(effectModel.backgroundImagePath)
								: null;
						drawResolvedWebcamComposition({
							ctx: compositeCtx,
							source: webcamFrame,
							model: effectModel,
							mirror: renderSpec.renderModel.mirror,
							backgroundImage,
							scratch: this.webcamCompositionScratch,
						});

						if (renderSpec.renderModel.borderWidthPx > 0) {
							compositeCtx.strokeStyle = renderSpec.renderModel.region.borderColor;
							compositeCtx.lineWidth = renderSpec.renderModel.borderWidthPx;
							compositeCtx.stroke();
						}

						compositeCtx.restore();
					}
				} finally {
					webcamFrame.close();
				}
			}
		}
	}

	private updateLayout(): void {
		if (!this.app || !this.videoSprite || !this.maskGraphics || !this.videoContainer) return;
		if (this.layoutCache) return;

		const { width, height } = this.config;
		const { cropRegion, borderRadius = 0, padding = 0, aspectRatio = "native" } = this.config;
		const layout = calculateVideoLayoutGeometry({
			containerWidth: width,
			containerHeight: height,
			videoWidth: this.config.videoWidth,
			videoHeight: this.config.videoHeight,
			cropRegion,
			padding,
			aspectRatio,
		});

		if (!layout) {
			return;
		}

		this.videoSprite.scale.set(layout.baseScale);
		this.videoSprite.position.set(layout.baseOffset.x, layout.baseOffset.y);

		this.videoContainer.position.set(0, 0);

		this.maskGraphics.clear();
		this.maskGraphics.roundRect(
			layout.maskRect.x,
			layout.maskRect.y,
			layout.maskRect.width,
			layout.maskRect.height,
			borderRadius * this.canvasScaleFactor,
		);
		this.maskGraphics.fill({ color: 0xffffff });

		// Cache layout info
		this.layoutCache = {
			stageSize: layout.stageSize,
			frameRect: layout.frameRect,
			videoSize: layout.videoSize,
			baseScale: layout.baseScale,
			baseOffset: layout.baseOffset,
			maskRect: layout.maskRect,
		};
	}

	private getCanvasScaleFactor(): number {
		return this.canvasScaleFactor;
	}

	private drawFrameBorder(
		ctx: CanvasRenderingContext2D,
		scaleFactor = this.canvasScaleFactor,
	): void {
		if (!this.layoutCache || !this.config.frameBorderEnabled) {
			return;
		}
		const borderRadius =
			scaleFactor === this.canvasScaleFactor
				? this.borderRadiusPx
				: (this.config.borderRadius || 0) * scaleFactor;
		const borderWidthPx =
			scaleFactor === this.canvasScaleFactor
				? this.borderWidthPx
				: (this.config.frameBorderWidth || 0) * scaleFactor;

		const projectedFrame = projectFrameRect({
			rect: this.layoutCache.maskRect,
			transform: {
				scale: this.animationState.appliedScale,
				x: this.animationState.x,
				y: this.animationState.y,
			},
			borderRadius,
			borderWidth: borderWidthPx,
		});
		const borderWidth = projectedFrame.borderWidth;
		const borderOpacity = this.config.frameBorderOpacity ?? 0;
		if (borderWidth <= 0 || borderOpacity <= 0) {
			return;
		}

		const radius = projectedFrame.borderRadius;
		const mask = projectedFrame.rect;

		ctx.save();
		ctx.fillStyle = this.frameBorderColorWithOpacity;
		ctx.beginPath();
		ctx.roundRect(
			mask.x - borderWidth,
			mask.y - borderWidth,
			mask.width + borderWidth * 2,
			mask.height + borderWidth * 2,
			radius + borderWidth,
		);
		ctx.roundRect(mask.x, mask.y, mask.width, mask.height, radius);
		ctx.fill("evenodd");
		ctx.restore();
	}

	private drawDeviceMockupFrame(ctx: CanvasRenderingContext2D): void {
		if (!this.layoutCache || !this.config.deviceMockup || this.config.deviceMockup === "none") {
			return;
		}

		const definition = getMockupDefinition(this.config.deviceMockup);
		if (!definition) {
			return;
		}

		const projectedFrame = projectFrameRect({
			rect: this.layoutCache.maskRect,
			transform: {
				scale: this.animationState.appliedScale,
				x: this.animationState.x,
				y: this.animationState.y,
			},
			borderRadius: this.borderRadiusPx,
			borderWidth: 0,
		}).rect;
		const inset = definition.inset;
		const deviceW = projectedFrame.width / Math.max(0.01, 1 - inset.left - inset.right);
		const deviceH = projectedFrame.height / Math.max(0.01, 1 - inset.top - inset.bottom);
		const deviceX = projectedFrame.x - deviceW * inset.left;
		const deviceY = projectedFrame.y - deviceH * inset.top;

		ctx.save();
		ctx.translate(deviceX, deviceY);
		definition.drawFrame(ctx, deviceW, deviceH, {
			x: projectedFrame.x - deviceX,
			y: projectedFrame.y - deviceY,
			w: projectedFrame.width,
			h: projectedFrame.height,
		});
		ctx.restore();
	}

	private updateAnimationState(timeMs: number) {
		if (!this.cameraContainer || !this.layoutCache) {
			return {
				motionIntensity: 0,
				motionVector: { x: 0, y: 0 },
				simulatedCursor: null,
				state: this.animationState,
				transform: {
					scale: this.animationState.appliedScale,
					x: this.animationState.x,
					y: this.animationState.y,
				},
				targetFocus: { cx: this.animationState.focusX, cy: this.animationState.focusY },
				targetScaleFactor: this.animationState.scale,
				targetProgress: this.animationState.progress,
				region: null,
			};
		}
		const evaluation = evaluatePlaybackCameraFrame({
			state: this.animationState,
			frameTimeMs: timeMs,
			playbackTimeMs: timeMs,
			cursorSimulationPath: this.cursorSimulationPath,
			zoomRegions: this.config.zoomRegions,
			connectZooms: this.config.connectZooms,
			geometry: {
				stageSize: this.layoutCache.stageSize,
				baseMask: this.layoutCache.maskRect,
			},
			shouldSmooth: true,
			cameraSpring: this.config.cameraSpring,
		});

		this.animationState = evaluation.state;
		this.lastMotionVector = evaluation.motionVector;
		return evaluation;
	}

	private compositeWithShadows(): void {
		if (!this.compositeCanvas || !this.compositeCtx || !this.app) return;

		const videoCanvas = this.app.canvas as HTMLCanvasElement;
		const ctx = this.compositeCtx;
		const w = this.compositeCanvas.width;
		const h = this.compositeCanvas.height;
		const canvasScaleFactor = this.getCanvasScaleFactor();

		// Clear composite canvas
		ctx.clearRect(0, 0, w, h);

		// Step 1: Draw background layer (with optional blur, not affected by zoom)
		if (this.backgroundCanvas && !this.config.hideBackground) {
			if (this.config.backgroundBlur > 0) {
				ctx.save();
				ctx.filter = `blur(${this.config.backgroundBlur * 3}px)`;
				ctx.drawImage(this.backgroundCanvas, 0, 0, w, h);
				ctx.restore();
			} else {
				ctx.drawImage(this.backgroundCanvas, 0, 0, w, h);
			}
		} else if (!this.config.hideBackground) {
			console.warn("[FrameRenderer] No background sprite found during compositing!");
		}

		// Draw the outside border beneath the video/cursor layer so it never occludes the cursor.
		this.drawFrameBorder(ctx);

		// Draw video layer with shadows on top of background and border
		if (
			this.config.showShadow &&
			hasVisibleFrameShadow(this.shadowSettings) &&
			this.shadowCanvas &&
			this.shadowCtx
		) {
			const shadowCtx = this.shadowCtx;
			shadowCtx.clearRect(0, 0, w, h);
			shadowCtx.save();
			shadowCtx.filter = buildFrameShadowFilter(this.shadowSettings, canvasScaleFactor);
			shadowCtx.drawImage(videoCanvas, 0, 0, w, h);
			shadowCtx.restore();
			ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
		} else {
			ctx.drawImage(videoCanvas, 0, 0, w, h);
		}

		this.drawDeviceMockupFrame(ctx);
	}

	getCanvas(): HTMLCanvasElement {
		if (!this.compositeCanvas) {
			throw new Error("Renderer not initialized");
		}
		return this.compositeCanvas;
	}

	destroy(): void {
		if (this.videoSprite) {
			const videoTexture = this.videoSprite.texture;
			this.videoSprite.destroy({ texture: false, textureSource: false });
			videoTexture?.destroy(true);
			this.videoSprite = null;
		}
		this.videoTexture = null;
		this.frameCanvas = null;
		this.frameCtx = null;
		this.backgroundCanvas = null;
		if (this.app) {
			this.app.destroy(true, {
				children: true,
				texture: false,
				textureSource: false,
			});
			this.app = null;
		}
		this.cameraContainer = null;
		this.videoContainer = null;
		this.maskGraphics = null;
		this.blurFilter = null;
		this.motionBlurFilter = null;
		if (this.cursorOverlay) {
			this.cursorOverlay.destroy();
			this.cursorOverlay = null;
		}
		if (this.webcamFrameProvider) {
			this.webcamFrameProvider.destroy();
			this.webcamFrameProvider = null;
		}
		if (this.webcamSegmentationProvider) {
			this.webcamSegmentationProvider.close();
			this.webcamSegmentationProvider = null;
		}
		this.webcamSegmentationCache.clear();
		this.webcamSourceSize = null;
		this.shadowCanvas = null;
		this.shadowCtx = null;
		this.compositeCanvas = null;
		this.compositeCtx = null;
	}
}
