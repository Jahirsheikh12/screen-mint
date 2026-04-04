import { Application, BlurFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { MotionBlurFilter } from "pixi-filters/motion-blur";
import { resolveCameraLayoutState } from "@/components/video-editor/cameraLayouts";
import {
	applyOpacityToHex,
	buildFrameShadowFilter,
	hasVisibleFrameShadow,
} from "@/components/video-editor/frameEffects";
import { renderKeyboardShortcutCalloutsCanvas } from "@/components/video-editor/keyboardShortcuts";
import { toFileUrl } from "@/components/video-editor/projectPersistence";
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
	WebcamRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import { DEFAULT_CURSOR_SPRING } from "@/components/video-editor/types";
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
import {
	computeMockupScreenRect,
	drawDeviceMockup,
} from "@/components/video-editor/videoPlayback/deviceMockups";
import { calculateVideoLayoutGeometry } from "@/components/video-editor/videoPlayback/layoutUtils";
import {
	applyZoomTransform,
	createMotionBlurState,
	type MotionBlurState,
	projectFrameRect,
} from "@/components/video-editor/videoPlayback/zoomTransform";
import { getWebcamPixelRect } from "@/components/video-editor/webcamRegionUtils";
import { getAssetPath, getRenderableAssetUrl } from "@/lib/assetPath";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { renderAnnotations, renderCaptions } from "./annotationRenderer";

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
	private motionBlurState: MotionBlurState;
	private layoutCache: FrameLayoutCache | null = null;
	private currentVideoTime = 0;
	private lastMotionVector = { x: 0, y: 0 };
	private cursorOverlay: PixiCursorOverlay | null = null;
	private webcamVideo: HTMLVideoElement | null = null;
	private cursorSimulationPath: CursorSimulationPath | null = null;

	constructor(config: FrameRenderConfig) {
		this.config = config;
		this.animationState = createPlaybackCameraState();
		this.motionBlurState = createMotionBlurState();
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

		// Setup webcam video if available
		if (this.config.webcamPath) {
			this.webcamVideo = document.createElement("video");
			const webcamSrc = this.config.webcamPath.startsWith("file://")
				? this.config.webcamPath
				: toFileUrl(this.config.webcamPath);
			this.webcamVideo.src = webcamSrc;
			this.webcamVideo.muted = true;
			this.webcamVideo.playsInline = true;
			this.webcamVideo.preload = "auto";
			await new Promise<void>((resolve) => {
				this.webcamVideo!.addEventListener("loadeddata", () => resolve(), { once: true });
				this.webcamVideo!.addEventListener("error", () => resolve(), { once: true });
				this.webcamVideo!.load();
			});
		}
	}

	private async setupBackground(): Promise<void> {
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

	private drawWebcamFrame(
		ctx: CanvasRenderingContext2D,
		video: HTMLVideoElement,
		x: number,
		y: number,
		width: number,
		height: number,
		mirror: boolean,
	) {
		if (!mirror) {
			ctx.drawImage(video, x, y, width, height);
			return;
		}

		ctx.save();
		ctx.translate(x + width, y);
		ctx.scale(-1, 1);
		ctx.drawImage(video, 0, 0, width, height);
		ctx.restore();
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
			const previewWidth = this.config.previewWidth || 1920;
			const previewHeight = this.config.previewHeight || 1080;
			const scaleX = this.config.width / previewWidth;
			const scaleY = this.config.height / previewHeight;
			const scaleFactor = (scaleX + scaleY) / 2;

			await renderAnnotations(
				this.compositeCtx,
				this.config.annotationRegions,
				this.config.width,
				this.config.height,
				timeMs,
				scaleFactor,
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
		const webcamVideo = this.webcamVideo;
		if (compositeCtx && webcamVideo && this.config.webcamRegion) {
			const resolvedCameraState = resolveCameraLayoutState({
				timeMs,
				webcamRegion: this.config.webcamRegion,
				showWebcam: this.config.showWebcam ?? true,
				mirrorWebcam: this.config.mirrorWebcam,
				cameraLayouts: this.config.cameraLayouts,
				zoomRegions: this.config.zoomRegions,
				connectZooms: this.config.connectZooms,
				cameraSizeDuringZoom: this.config.cameraSizeDuringZoom,
			});

			if (resolvedCameraState.mode !== "hidden") {
				webcamVideo.currentTime = timeMs / 1000;
				await new Promise<void>((resolve) => {
					if (webcamVideo.readyState >= 2) {
						resolve();
					} else {
						webcamVideo.addEventListener("seeked", () => resolve(), { once: true });
					}
				});

				if (resolvedCameraState.mode === "fullscreen") {
					compositeCtx.save();
					this.drawWebcamFrame(
						compositeCtx,
						webcamVideo,
						0,
						0,
						this.config.width,
						this.config.height,
						resolvedCameraState.mirror,
					);
					compositeCtx.restore();
				} else {
					const region = resolvedCameraState.region;
					const {
						x: wx,
						y: wy,
						width: ww,
						height: wh,
					} = getWebcamPixelRect(region, this.config.width, this.config.height);

					compositeCtx.save();
					compositeCtx.globalAlpha = region.opacity;
					compositeCtx.beginPath();
					if (region.shape === "circle") {
						compositeCtx.ellipse(wx + ww / 2, wy + wh / 2, ww / 2, wh / 2, 0, 0, Math.PI * 2);
					} else {
						compositeCtx.roundRect(wx, wy, ww, wh, region.borderRadius);
					}
					compositeCtx.clip();
					this.drawWebcamFrame(
						compositeCtx,
						webcamVideo,
						wx,
						wy,
						ww,
						wh,
						resolvedCameraState.mirror,
					);

					if (region.borderWidth > 0) {
						compositeCtx.strokeStyle = region.borderColor;
						compositeCtx.lineWidth = region.borderWidth;
						compositeCtx.stroke();
					}

					compositeCtx.restore();
				}
			}
		}
	}

	private updateLayout(): void {
		if (!this.app || !this.videoSprite || !this.maskGraphics || !this.videoContainer) return;

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

		// scale border radius by export/preview canvas ratio
		const previewWidth = this.config.previewWidth || 1920;
		const previewHeight = this.config.previewHeight || 1080;
		const canvasScaleFactor = Math.min(width / previewWidth, height / previewHeight);
		const scaledBorderRadius = borderRadius * canvasScaleFactor;

		this.maskGraphics.clear();
		this.maskGraphics.roundRect(
			layout.maskRect.x,
			layout.maskRect.y,
			layout.maskRect.width,
			layout.maskRect.height,
			scaledBorderRadius,
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
		const previewWidth = this.config.previewWidth || 1920;
		const previewHeight = this.config.previewHeight || 1080;
		return Math.min(this.config.width / previewWidth, this.config.height / previewHeight);
	}

	private drawFrameBorder(ctx: CanvasRenderingContext2D, scaleFactor: number): void {
		if (!this.layoutCache || !this.config.frameBorderEnabled) {
			return;
		}

		const projectedFrame = projectFrameRect({
			rect: this.layoutCache.maskRect,
			transform: {
				scale: this.animationState.appliedScale,
				x: this.animationState.x,
				y: this.animationState.y,
			},
			borderRadius: (this.config.borderRadius || 0) * scaleFactor,
			borderWidth: (this.config.frameBorderWidth || 0) * scaleFactor,
		});
		const borderWidth = projectedFrame.borderWidth;
		const borderOpacity = this.config.frameBorderOpacity ?? 0;
		if (borderWidth <= 0 || borderOpacity <= 0) {
			return;
		}

		const color = applyOpacityToHex(this.config.frameBorderColor || "#000000", borderOpacity);
		const radius = projectedFrame.borderRadius;
		const mask = projectedFrame.rect;

		ctx.save();
		ctx.fillStyle = color;
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
		const shadowSettings = {
			size: this.config.frameShadowSize ?? this.config.shadowIntensity * 12,
			opacity: this.config.frameShadowOpacity ?? this.config.shadowIntensity * 0.7,
			blur: this.config.frameShadowBlur ?? this.config.shadowIntensity * 48,
		};
		const canvasScaleFactor = this.getCanvasScaleFactor();

		// Clear composite canvas
		ctx.clearRect(0, 0, w, h);

		// Step 1: Draw background layer (with optional blur, not affected by zoom)
		if (this.backgroundCanvas) {
			if (this.config.backgroundBlur > 0) {
				ctx.save();
				ctx.filter = `blur(${this.config.backgroundBlur * 3}px)`;
				ctx.drawImage(this.backgroundCanvas, 0, 0, w, h);
				ctx.restore();
			} else {
				ctx.drawImage(this.backgroundCanvas, 0, 0, w, h);
			}
		} else {
			console.warn("[FrameRenderer] No background sprite found during compositing!");
		}

		// Draw the outside border beneath the video/cursor layer so it never occludes the cursor.
		this.drawFrameBorder(ctx, canvasScaleFactor);

		// Draw video layer with shadows on top of background and border
		if (
			this.config.showShadow &&
			hasVisibleFrameShadow(shadowSettings) &&
			this.shadowCanvas &&
			this.shadowCtx
		) {
			const shadowCtx = this.shadowCtx;
			shadowCtx.clearRect(0, 0, w, h);
			shadowCtx.save();
			shadowCtx.filter = buildFrameShadowFilter(shadowSettings, canvasScaleFactor);
			shadowCtx.drawImage(videoCanvas, 0, 0, w, h);
			shadowCtx.restore();
			ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
		} else {
			ctx.drawImage(videoCanvas, 0, 0, w, h);
		}

		// Draw device mockup frame on top of video
		const mockup = this.config.deviceMockup;
		if (mockup && mockup !== "none" && this.layoutCache) {
			const mask = this.layoutCache.maskRect;
			const videoAR = mask.width / mask.height;
			const screenRect = computeMockupScreenRect(mockup, w, h, videoAR);
			if (screenRect) {
				drawDeviceMockup(ctx, mockup, w, h, screenRect);
			}
		}
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
		this.shadowCanvas = null;
		this.shadowCtx = null;
		this.compositeCanvas = null;
		this.compositeCtx = null;
	}
}
