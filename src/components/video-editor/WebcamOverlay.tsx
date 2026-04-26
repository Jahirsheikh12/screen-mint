import type { SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { getRenderableAssetUrl } from "@/lib/assetPath";
import type { PixelRect, ResolvedWebcamRenderModel } from "./cameraLayouts";
import { toFileUrl } from "./projectPersistence";
import {
	DEFAULT_WEBCAM_HEALTH_METRICS,
	type WebcamEffects,
	type WebcamHealthMetrics,
	type WebcamPreviewMode,
} from "./types";
import { createWebcamCompositionScratch, drawResolvedWebcamComposition } from "./webcamEffects";
import WebcamMaskRefinementWorker from "./webcamMaskRefinement.worker?worker";
import { resolveWebcamPreviewSyncDecision } from "./webcamPreviewSync";
import { resolvePreviewWebcamBudgetByMode, resolveWebcamRenderPlan } from "./webcamRenderPlan";
import { buildWebcamHealthMetrics, resolvePreviewWebcamBudget } from "./webcamRenderSpec";
import {
	alphaMaskToCanvas,
	createWebcamSegmentationProvider,
	type WebcamSegmentationFrame,
	type WebcamSegmentationProvider,
} from "./webcamSegmentation";

interface WebcamOverlayProps {
	webcamPath: string;
	renderModel: ResolvedWebcamRenderModel;
	compositionRect: PixelRect;
	webcamEffects: WebcamEffects;
	webcamPreviewMode: WebcamPreviewMode;
	currentTime: number;
	isPlaying: boolean;
	isHeld: boolean;
	playbackRate?: number;
	onHealthMetricsChange?: (metrics: WebcamHealthMetrics | null) => void;
	isSelected: boolean;
	onPositionChange: (position: { x: number; y: number }) => void;
	onSizeChange: (size: { width: number; height: number }) => void;
	onClick: () => void;
}

interface WorkerRefinementResponse {
	id: number;
	refinedAlphaBuffer: ArrayBuffer;
	quality: {
		foregroundCoverage: number;
		edgeCoverage: number;
		temporalWeight: number;
	};
}

const MAX_SEGMENTATION_CACHE_ENTRIES = 18;

function rememberSegmentationFrame(
	cache: Map<string, WebcamSegmentationFrame | null>,
	key: string,
	frame: WebcamSegmentationFrame | null,
) {
	if (cache.has(key)) {
		cache.delete(key);
	}
	cache.set(key, frame);
	while (cache.size > MAX_SEGMENTATION_CACHE_ENTRIES) {
		const oldestKey = cache.keys().next().value;
		if (typeof oldestKey !== "string") {
			break;
		}
		cache.delete(oldestKey);
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function withAlpha(color: string, alpha: number) {
	if (!color.startsWith("#")) {
		return color;
	}

	const normalized =
		color.length === 4
			? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
			: color;
	const safeAlpha = clamp(alpha, 0, 1);
	const red = Number.parseInt(normalized.slice(1, 3), 16);
	const green = Number.parseInt(normalized.slice(3, 5), 16);
	const blue = Number.parseInt(normalized.slice(5, 7), 16);
	return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

function pushTimestamp(timestamps: number[], now: number) {
	timestamps.push(now);
	while (timestamps.length > 0 && now - timestamps[0] > 1000) {
		timestamps.shift();
	}
	return timestamps;
}

function getFpsFromTimestamps(timestamps: number[]) {
	if (timestamps.length < 2) {
		return 0;
	}

	const duration = timestamps[timestamps.length - 1] - timestamps[0];
	if (duration <= 0) {
		return 0;
	}

	return ((timestamps.length - 1) * 1000) / duration;
}

export function WebcamOverlay({
	webcamPath,
	renderModel,
	compositionRect,
	webcamEffects,
	webcamPreviewMode,
	currentTime,
	isPlaying,
	isHeld,
	playbackRate = 1,
	onHealthMetricsChange,
	isSelected,
	onPositionChange,
	onSizeChange,
	onClick,
}: WebcamOverlayProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const scratchRef = useRef(createWebcamCompositionScratch());
	const isDraggingRef = useRef(false);
	const pendingSeekRef = useRef<Promise<void> | null>(null);
	const queuedSeekRef = useRef<{ time: number; resumePlayback: boolean } | null>(null);
	const lastWebcamPathRef = useRef(webcamPath);
	const frameTimestampsRef = useRef<number[]>([]);
	const segmentationTimestampsRef = useRef<number[]>([]);
	const observedFpsRef = useRef(0);
	const segmentationFpsRef = useRef(0);
	const segmentationProviderRef = useRef<WebcamSegmentationProvider | null>(null);
	const segmentationProviderPromiseRef = useRef<Promise<WebcamSegmentationProvider | null> | null>(
		null,
	);
	const segmentationFrameRef = useRef<WebcamSegmentationFrame | null>(null);
	const segmentationPendingRef = useRef(false);
	const segmentationCacheRef = useRef<Map<string, WebcamSegmentationFrame | null>>(new Map());
	const lastSegmentationRequestRef = useRef(0);
	const lastReportedMetricsRef = useRef<WebcamHealthMetrics | null>(null);
	const lastRefinedAlphaRef = useRef<Uint8ClampedArray | null>(null);
	const renderQueuedRef = useRef(false);
	const renderRafIdRef = useRef(0);
	const renderCountRef = useRef(0);
	const lastRenderCostMsRef = useRef(0);
	const lastRenderCostSampleRef = useRef(0);
	const pendingWorkerStartedAtRef = useRef(0);
	const workerRef = useRef<Worker | null>(null);
	const workerRequestIdRef = useRef(0);
	const pendingWorkerIdRef = useRef(0);
	const renderMediaTimeBucketRef = useRef(0);
	const lastDriftSampleRef = useRef(0);

	const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
	const [observedFps, setObservedFps] = useState(0);
	const [segmentationFps, setSegmentationFps] = useState(0);
	const [segmentationUnavailable, setSegmentationUnavailable] = useState(false);
	const [workerLatencyMs, setWorkerLatencyMs] = useState(0);
	const [renderCostMs, setRenderCostMs] = useState(0);
	const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
	const [canvasHasRenderedFrame, setCanvasHasRenderedFrame] = useState(false);
	const [mediaReadyVersion, setMediaReadyVersion] = useState(0);
	const [segmentationWorkingSize, setSegmentationWorkingSize] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [driftMs, setDriftMs] = useState(0);

	const { region, mode, displayRect } = renderModel;
	const { x, y, width, height } = displayRect;
	const borderRadius =
		renderModel.clipShape === "circle" ? "50%" : `${renderModel.borderRadiusPx}px`;
	const compositionWidth = Math.max(compositionRect.width, 1);
	const compositionHeight = Math.max(compositionRect.height, 1);
	const targetFps = playbackRate >= 1.4 ? 60 : 30;
	const previewBudget = useMemo(
		() =>
			webcamPreviewMode === "exact"
				? resolvePreviewWebcamBudget({
						effects: webcamEffects,
						targetFps,
						observedFps,
						segmentationFps,
						workerLatencyMs,
						renderCostMs,
						segmentationUnavailable,
					})
				: resolvePreviewWebcamBudgetByMode({
						previewMode: webcamPreviewMode,
						effects: webcamEffects,
						segmentationUnavailable,
					}),
		[
			webcamEffects,
			webcamPreviewMode,
			targetFps,
			observedFps,
			segmentationFps,
			workerLatencyMs,
			renderCostMs,
			segmentationUnavailable,
		],
	);
	const activeRenderPlan = useMemo(
		() =>
			resolveWebcamRenderPlan({
				timeMs: currentTime * 1000,
				webcamRegion: renderModel.region,
				showWebcam: renderModel.opacity > 0,
				resolvedRenderModel: renderModel,
				containerWidth: width,
				containerHeight: height,
				sourceSize,
				effects: webcamEffects,
				renderMode: "preview",
				previewMode: webcamPreviewMode,
				previewBudget,
				segmentationUnavailable,
				sourceKey: webcamPath,
				backgroundCacheKey:
					webcamEffects.backgroundMode === "blur"
						? `preview-blur:init:${webcamPreviewMode}`
						: webcamEffects.backgroundMode === "image"
							? `preview-image:init:${webcamEffects.backgroundImagePath ?? "none"}:${webcamPreviewMode}`
							: null,
			}),
		[
			currentTime,
			height,
			renderModel,
			segmentationUnavailable,
			sourceSize,
			webcamEffects,
			webcamPath,
			webcamPreviewMode,
			width,
			previewBudget,
		],
	);
	const activeRenderSpec = activeRenderPlan.spec;
	const staticCompositionModel = activeRenderSpec.compositionModel;
	const webcamUrl = useMemo(() => toFileUrl(webcamPath), [webcamPath]);
	const boxShadow =
		staticCompositionModel.shadowOpacity > 0
			? `0 ${staticCompositionModel.shadowOffsetYPx}px ${staticCompositionModel.shadowBlurPx}px ${withAlpha(
					staticCompositionModel.shadowColor,
					staticCompositionModel.shadowOpacity,
				)}`
			: "none";

	const ensureSegmentationProvider = useCallback(async () => {
		if (segmentationProviderRef.current) {
			return segmentationProviderRef.current;
		}

		if (!segmentationProviderPromiseRef.current) {
			segmentationProviderPromiseRef.current = createWebcamSegmentationProvider()
				.then((provider) => {
					segmentationProviderRef.current = provider;
					if (!provider) {
						setSegmentationUnavailable(true);
					}
					return provider;
				})
				.catch((error) => {
					console.warn("[WebcamOverlay] Failed to initialize segmentation provider:", error);
					setSegmentationUnavailable(true);
					return null;
				})
				.finally(() => {
					segmentationProviderPromiseRef.current = null;
				});
		}

		return segmentationProviderPromiseRef.current;
	}, []);

	const renderCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		const video = videoRef.current;
		if (!canvas || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
			renderQueuedRef.current = false;
			return;
		}

		const renderStartedAt = performance.now();
		const safeDpr = Math.min(window.devicePixelRatio || 1, previewBudget.renderScale);
		const pixelWidth = Math.max(1, Math.round(width * safeDpr));
		const pixelHeight = Math.max(1, Math.round(height * safeDpr));
		if (canvas.width !== pixelWidth) {
			canvas.width = pixelWidth;
		}
		if (canvas.height !== pixelHeight) {
			canvas.height = pixelHeight;
		}

		const ctx = canvas.getContext("2d", {
			alpha: true,
			willReadFrequently: false,
		});
		if (!ctx) {
			renderQueuedRef.current = false;
			return;
		}

		ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		const backgroundCacheKey =
			webcamEffects.backgroundMode === "blur"
				? `preview-blur:${webcamPreviewMode}:${Math.round(video.currentTime * 8)}`
				: webcamEffects.backgroundMode === "image"
					? `preview-image:${webcamEffects.backgroundImagePath ?? "none"}:${webcamPreviewMode}`
					: null;
		const renderPlan = resolveWebcamRenderPlan({
			timeMs: video.currentTime * 1000,
			webcamRegion: renderModel.region,
			showWebcam: renderModel.opacity > 0,
			resolvedRenderModel: renderModel,
			containerWidth: width,
			containerHeight: height,
			sourceSize,
			effects: webcamEffects,
			renderMode: "preview",
			previewMode: webcamPreviewMode,
			previewBudget,
			segmentationUnavailable,
			sourceKey: webcamPath,
			backgroundCacheKey,
			segmentationFrame: segmentationFrameRef.current,
		});

		drawResolvedWebcamComposition({
			ctx,
			source: video,
			model: renderPlan.spec.compositionModel,
			mirror: renderPlan.spec.renderModel.mirror,
			backgroundImage,
			scratch: scratchRef.current,
		});
		setCanvasHasRenderedFrame(true);

		renderQueuedRef.current = false;
		renderCountRef.current += 1;
		renderMediaTimeBucketRef.current = Math.round(video.currentTime * 1000);
		const renderCost = performance.now() - renderStartedAt;
		if (performance.now() - lastRenderCostSampleRef.current > 250) {
			lastRenderCostSampleRef.current = performance.now();
			lastRenderCostMsRef.current = renderCost;
			setRenderCostMs(renderCost);
		}
	}, [
		backgroundImage,
		previewBudget,
		renderModel,
		segmentationUnavailable,
		sourceSize,
		webcamEffects,
		webcamPath,
		webcamPreviewMode,
		width,
		height,
	]);

	const scheduleRender = useCallback(() => {
		if (renderQueuedRef.current) {
			return;
		}

		renderQueuedRef.current = true;
		renderRafIdRef.current = window.requestAnimationFrame(() => {
			renderCanvas();
		});
	}, [renderCanvas]);

	const requestSegmentation = useCallback(
		async (timestampMs: number) => {
			const video = videoRef.current;
			const cacheKey = [
				webcamPath,
				webcamPreviewMode,
				webcamEffects.backgroundMode,
				previewBudget.segmentationMaxEdge,
				Math.round(timestampMs / (1000 / 15)),
			].join(":");
			if (
				!video ||
				segmentationPendingRef.current ||
				!activeRenderSpec.segmentationRequired ||
				previewBudget.qualityTier === "raw-webcam-only" ||
				renderModel.opacity <= 0
			) {
				return;
			}

			if (segmentationCacheRef.current.has(cacheKey)) {
				segmentationFrameRef.current = segmentationCacheRef.current.get(cacheKey) ?? null;
				scheduleRender();
				return;
			}

			segmentationPendingRef.current = true;
			const startedAt = performance.now();
			try {
				const provider = await ensureSegmentationProvider();
				if (!provider) {
					setSegmentationUnavailable(true);
					segmentationPendingRef.current = false;
					return;
				}

				const frame = await provider.segment(video, timestampMs, {
					mode: "preview",
					workingMaxEdge: previewBudget.segmentationMaxEdge,
					refinementMode: "none",
				});
				if (!frame?.confidenceBuffer) {
					segmentationPendingRef.current = false;
					return;
				}

				setSegmentationUnavailable(false);
				setSegmentationWorkingSize({
					width: frame.workingWidth,
					height: frame.workingHeight,
				});

				const requestId = workerRequestIdRef.current + 1;
				workerRequestIdRef.current = requestId;
				pendingWorkerIdRef.current = requestId;
				pendingWorkerStartedAtRef.current = startedAt;
				if (!workerRef.current) {
					segmentationPendingRef.current = false;
					return;
				}
				workerRef.current.postMessage(
					{
						id: requestId,
						confidenceBuffer: frame.confidenceBuffer,
						width: frame.workingWidth,
						height: frame.workingHeight,
						previousAlphaBuffer: lastRefinedAlphaRef.current?.buffer ?? null,
					},
					frame.confidenceBuffer ? [frame.confidenceBuffer] : [],
				);
				(
					workerRef.current as Worker & { __pendingFrame?: WebcamSegmentationFrame }
				).__pendingFrame = frame;
			} catch (error) {
				console.warn("[WebcamOverlay] Webcam segmentation failed:", error);
				setSegmentationUnavailable(true);
				segmentationPendingRef.current = false;
			} finally {
				// Worker completion releases the pending gate for normal refinement flow.
			}
		},
		[
			ensureSegmentationProvider,
			previewBudget,
			renderModel.opacity,
			scheduleRender,
			activeRenderSpec.segmentationRequired,
			webcamEffects.backgroundMode,
			webcamPath,
			webcamPreviewMode,
		],
	);

	useEffect(() => {
		const worker = new WebcamMaskRefinementWorker();
		workerRef.current = worker;

		worker.onmessage = (event: MessageEvent<WorkerRefinementResponse>) => {
			if (event.data.id !== pendingWorkerIdRef.current) {
				return;
			}

			const pendingFrame = (worker as Worker & { __pendingFrame?: WebcamSegmentationFrame })
				.__pendingFrame;
			if (!pendingFrame) {
				return;
			}

			const refinedAlpha = new Uint8ClampedArray(event.data.refinedAlphaBuffer);
			lastRefinedAlphaRef.current = refinedAlpha.slice();
			const refinedMask = alphaMaskToCanvas(
				refinedAlpha,
				pendingFrame.workingWidth,
				pendingFrame.workingHeight,
			);
			segmentationFrameRef.current = {
				...pendingFrame,
				refinedMask,
				mask: refinedMask,
				quality: event.data.quality,
			};
			const cacheKey = [
				webcamPath,
				webcamPreviewMode,
				webcamEffects.backgroundMode,
				previewBudget.segmentationMaxEdge,
				Math.round(pendingFrame.timestampMs / (1000 / 15)),
			].join(":");
			rememberSegmentationFrame(
				segmentationCacheRef.current,
				cacheKey,
				segmentationFrameRef.current,
			);
			delete (worker as Worker & { __pendingFrame?: WebcamSegmentationFrame }).__pendingFrame;
			segmentationPendingRef.current = false;
			setWorkerLatencyMs(performance.now() - pendingWorkerStartedAtRef.current);

			const timestamps = pushTimestamp(segmentationTimestampsRef.current, performance.now());
			const nextSegmentationFps = getFpsFromTimestamps(timestamps);
			if (Math.abs(nextSegmentationFps - segmentationFpsRef.current) > 0.4) {
				segmentationFpsRef.current = nextSegmentationFps;
				setSegmentationFps(nextSegmentationFps);
			}
			scheduleRender();
		};

		return () => {
			worker.terminate();
			workerRef.current = null;
		};
	}, [
		previewBudget.segmentationMaxEdge,
		scheduleRender,
		webcamEffects.backgroundMode,
		webcamPath,
		webcamPreviewMode,
	]);

	useEffect(() => {
		const nextMetrics: WebcamHealthMetrics = buildWebcamHealthMetrics({
			spec: activeRenderSpec,
			targetFps,
			observedFps,
			segmentationFps,
			segmentationWorkingSize,
			previewMode: webcamPreviewMode,
			driftMs,
			renderLatencyMs: renderCostMs,
			frameQueueDepth:
				(renderQueuedRef.current ? 1 : 0) +
				(segmentationPendingRef.current ? 1 : 0) +
				(pendingSeekRef.current ? 1 : 0),
		});
		if (
			!lastReportedMetricsRef.current ||
			lastReportedMetricsRef.current.targetFps !== nextMetrics.targetFps ||
			Math.abs((lastReportedMetricsRef.current.observedFps ?? 0) - nextMetrics.observedFps) > 0.5 ||
			Math.abs(
				(lastReportedMetricsRef.current.segmentationFps ?? 0) - nextMetrics.segmentationFps,
			) > 0.5 ||
			lastReportedMetricsRef.current.effectFallbackState !== nextMetrics.effectFallbackState ||
			lastReportedMetricsRef.current.configuredBackgroundMode !==
				nextMetrics.configuredBackgroundMode ||
			lastReportedMetricsRef.current.appliedBackgroundMode !== nextMetrics.appliedBackgroundMode ||
			lastReportedMetricsRef.current.degradationStep !== nextMetrics.degradationStep ||
			lastReportedMetricsRef.current.previewQualityTier !== nextMetrics.previewQualityTier ||
			lastReportedMetricsRef.current.segmentationWorkingWidth !==
				nextMetrics.segmentationWorkingWidth ||
			lastReportedMetricsRef.current.segmentationWorkingHeight !==
				nextMetrics.segmentationWorkingHeight ||
			lastReportedMetricsRef.current.segmentationProviderStatus !==
				nextMetrics.segmentationProviderStatus ||
			lastReportedMetricsRef.current.renderResolutionScale !== nextMetrics.renderResolutionScale ||
			lastReportedMetricsRef.current.previewMode !== nextMetrics.previewMode ||
			Math.abs((lastReportedMetricsRef.current.driftMs ?? 0) - (nextMetrics.driftMs ?? 0)) > 4 ||
			Math.abs(
				(lastReportedMetricsRef.current.renderLatencyMs ?? 0) - (nextMetrics.renderLatencyMs ?? 0),
			) > 1 ||
			lastReportedMetricsRef.current.frameQueueDepth !== nextMetrics.frameQueueDepth ||
			lastReportedMetricsRef.current.fallbackReason !== nextMetrics.fallbackReason
		) {
			lastReportedMetricsRef.current = nextMetrics;
			onHealthMetricsChange?.(nextMetrics);
		}
	}, [
		observedFps,
		onHealthMetricsChange,
		segmentationFps,
		segmentationWorkingSize,
		activeRenderSpec,
		targetFps,
		webcamPreviewMode,
		driftMs,
		renderCostMs,
	]);

	useEffect(() => {
		if (!onHealthMetricsChange) {
			return;
		}

		return () => {
			onHealthMetricsChange(DEFAULT_WEBCAM_HEALTH_METRICS);
		};
	}, [onHealthMetricsChange]);

	useEffect(() => {
		let cancelled = false;
		const imagePath = staticCompositionModel.backgroundImagePath;
		if (staticCompositionModel.backgroundMode !== "image" || !imagePath) {
			setBackgroundImage(null);
			return;
		}

		void (async () => {
			try {
				const img = new Image();
				const src = await getRenderableAssetUrl(imagePath);
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = () => reject(new Error(`Failed to load ${src}`));
					img.src = src;
				});
				if (!cancelled) {
					setBackgroundImage(img);
					scratchRef.current.backgroundCacheKey = null;
				}
			} catch (error) {
				console.warn("[WebcamOverlay] Failed to load webcam background image:", error);
				if (!cancelled) {
					setBackgroundImage(null);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [staticCompositionModel.backgroundImagePath, staticCompositionModel.backgroundMode]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}
		const shouldForceReadySync = mediaReadyVersion > 0;

		if (lastWebcamPathRef.current !== webcamPath) {
			pendingSeekRef.current = null;
			queuedSeekRef.current = null;
			lastWebcamPathRef.current = webcamPath;
			frameTimestampsRef.current = [];
			segmentationTimestampsRef.current = [];
			segmentationFrameRef.current = null;
			lastRefinedAlphaRef.current = null;
			lastSegmentationRequestRef.current = 0;
			renderCountRef.current = 0;
			setObservedFps(0);
			observedFpsRef.current = 0;
			setSegmentationFps(0);
			segmentationFpsRef.current = 0;
			setSegmentationUnavailable(false);
			setWorkerLatencyMs(0);
			setSegmentationWorkingSize(null);
			segmentationCacheRef.current.clear();
			setDriftMs(0);
			setMediaReadyVersion((value) => value + 1);
			setCanvasHasRenderedFrame(false);
			scratchRef.current.backgroundCacheKey = null;
		}

		const playVideo = async () => {
			if (!video.paused) {
				return;
			}

			try {
				await video.play();
			} catch (error) {
				console.warn("Failed to resume preview webcam playback:", error);
			}
		};

		const queueSeek = async (time: number, resumePlayback: boolean) => {
			if (!Number.isFinite(time) || video.readyState < HTMLMediaElement.HAVE_METADATA) {
				return;
			}

			if (pendingSeekRef.current) {
				queuedSeekRef.current = { time, resumePlayback };
				return;
			}

			const performSeek = async (targetTime: number, shouldResumePlayback: boolean) => {
				pendingSeekRef.current = new Promise<void>((resolve) => {
					const handleSeeked = () => {
						video.removeEventListener("seeked", handleSeeked);
						resolve();
					};

					video.addEventListener("seeked", handleSeeked, { once: true });
					video.currentTime = targetTime;
				});

				try {
					await pendingSeekRef.current;
					scheduleRender();
					if (activeRenderSpec.segmentationRequired) {
						void requestSegmentation(targetTime * 1000);
					}
				} finally {
					pendingSeekRef.current = null;
				}

				if (shouldResumePlayback) {
					await playVideo();
				}

				const queuedSeek = queuedSeekRef.current;
				queuedSeekRef.current = null;
				if (
					queuedSeek &&
					(Math.abs(video.currentTime - queuedSeek.time) > 0.001 ||
						(queuedSeek.resumePlayback && video.paused))
				) {
					await performSeek(queuedSeek.time, queuedSeek.resumePlayback);
				}
			};

			await performSeek(time, resumePlayback);
		};

		const decision = resolveWebcamPreviewSyncDecision({
			mediaTime: video.currentTime,
			targetTime: currentTime,
			isPlaying,
			isHeld,
			isReady: video.readyState >= HTMLMediaElement.HAVE_METADATA,
			isPaused: video.paused,
			hasPendingSeek: pendingSeekRef.current !== null,
			playbackRate,
			currentPlaybackRate: video.playbackRate,
		});
		const nextDriftMs = (currentTime - video.currentTime) * 1000;
		if (Math.abs(nextDriftMs - lastDriftSampleRef.current) >= 4) {
			lastDriftSampleRef.current = nextDriftMs;
			setDriftMs(nextDriftMs);
		}

		if (decision.playbackRate !== null) {
			video.playbackRate = decision.playbackRate;
		}

		if (shouldForceReadySync && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
			scheduleRender();
		}

		if (decision.shouldPause) {
			video.pause();
			scheduleRender();
			if (activeRenderSpec.segmentationRequired) {
				void requestSegmentation(video.currentTime * 1000);
			}
		}

		if (decision.seekTarget !== null) {
			void queueSeek(decision.seekTarget, isPlaying && !isHeld);
			return;
		}

		if (decision.shouldPlay) {
			void playVideo();
		}
	}, [
		currentTime,
		isHeld,
		isPlaying,
		mediaReadyVersion,
		playbackRate,
		requestSegmentation,
		scheduleRender,
		activeRenderSpec.segmentationRequired,
		webcamPath,
	]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}

		let cancelled = false;
		let callbackId = 0;
		let rafId = 0;

		const tick = (frameTimeMs: number, mediaTimeMs: number) => {
			if (cancelled) {
				return;
			}

			const frameTimestamps = pushTimestamp(frameTimestampsRef.current, frameTimeMs);
			const nextObservedFps = getFpsFromTimestamps(frameTimestamps);
			if (Math.abs(nextObservedFps - observedFpsRef.current) > 0.5) {
				observedFpsRef.current = nextObservedFps;
				setObservedFps(nextObservedFps);
			}

			if (
				Number.isFinite(previewBudget.segmentationCadenceMs) &&
				activeRenderSpec.segmentationRequired &&
				renderModel.opacity > 0 &&
				mediaTimeMs - lastSegmentationRequestRef.current >= previewBudget.segmentationCadenceMs
			) {
				lastSegmentationRequestRef.current = mediaTimeMs;
				void requestSegmentation(mediaTimeMs);
			}

			scheduleRender();
		};

		if ("requestVideoFrameCallback" in video) {
			const schedule = () => {
				callbackId = video.requestVideoFrameCallback((_now, metadata) => {
					tick(performance.now(), metadata.mediaTime * 1000);
					schedule();
				});
			};
			schedule();
			return () => {
				cancelled = true;
				video.cancelVideoFrameCallback?.(callbackId);
			};
		}

		const fallbackVideo = video as HTMLVideoElement;
		const fallbackLoop = () => {
			if (cancelled) {
				return;
			}

			tick(performance.now(), fallbackVideo.currentTime * 1000);
			rafId = window.requestAnimationFrame(fallbackLoop);
		};
		rafId = window.requestAnimationFrame(fallbackLoop);
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(rafId);
		};
	}, [
		previewBudget.segmentationCadenceMs,
		renderModel.opacity,
		requestSegmentation,
		scheduleRender,
		activeRenderSpec.segmentationRequired,
	]);

	useEffect(() => {
		scheduleRender();
	}, [scheduleRender]);

	useEffect(() => {
		return () => {
			segmentationProviderRef.current?.close();
			segmentationProviderRef.current = null;
			segmentationProviderPromiseRef.current = null;
			segmentationCacheRef.current.clear();
			if (renderRafIdRef.current) {
				window.cancelAnimationFrame(renderRafIdRef.current);
			}
		};
	}, []);

	const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
		const video = event.currentTarget;
		if (video.videoWidth > 0 && video.videoHeight > 0) {
			setSourceSize({ width: video.videoWidth, height: video.videoHeight });
		}
		setMediaReadyVersion((value) => value + 1);
		scheduleRender();
	};

	const handleLoadedData = () => {
		setMediaReadyVersion((value) => value + 1);
		scheduleRender();
	};

	const previewVideo = (
		<video
			ref={videoRef}
			src={webcamUrl}
			onLoadedMetadata={handleLoadedMetadata}
			onLoadedData={handleLoadedData}
			muted
			preload="auto"
			playsInline
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				display: "block",
				objectFit: "cover",
				opacity: canvasHasRenderedFrame ? 0 : 1,
				pointerEvents: "none",
				filter: staticCompositionModel.cssFilter || "none",
				transform: renderModel.mirror ? "scaleX(-1)" : undefined,
				transformOrigin: "center",
			}}
		/>
	);

	if (mode === "fullscreen") {
		return (
			<div
				className="absolute overflow-hidden"
				style={{
					pointerEvents: "auto",
					zIndex: 850,
					left: x,
					top: y,
					width,
					height,
					borderRadius,
					boxShadow,
					opacity: renderModel.opacity,
				}}
				onClick={onClick}
			>
				{previewVideo}
				<canvas
					ref={canvasRef}
					className="h-full w-full"
					style={{
						width: "100%",
						height: "100%",
						display: "block",
					}}
				/>
			</div>
		);
	}

	return (
		<Rnd
			position={{ x, y }}
			size={{ width, height }}
			onDragStart={() => {
				isDraggingRef.current = true;
			}}
			onDragStop={(_event, data) => {
				const xPercent = ((data.x - compositionRect.x) / compositionWidth) * 100;
				const yPercent = ((data.y - compositionRect.y) / compositionHeight) * 100;
				onPositionChange({ x: xPercent, y: yPercent });
				setTimeout(() => {
					isDraggingRef.current = false;
				}, 100);
			}}
			onResizeStop={(_event, _direction, ref, _delta, position) => {
				const xPercent = ((position.x - compositionRect.x) / compositionWidth) * 100;
				const yPercent = ((position.y - compositionRect.y) / compositionHeight) * 100;
				const widthPercent = (ref.offsetWidth / compositionWidth) * 100;
				const heightPercent = (ref.offsetHeight / compositionHeight) * 100;
				const sidePercent =
					(Math.max(ref.offsetWidth, ref.offsetHeight) /
						Math.min(compositionWidth, compositionHeight)) *
					100;
				onPositionChange({ x: xPercent, y: yPercent });
				onSizeChange({
					width:
						region.shape === "circle" || region.shape === "square" ? sidePercent : widthPercent,
					height:
						region.shape === "circle" || region.shape === "square" ? sidePercent : heightPercent,
				});
			}}
			onClick={() => {
				if (isDraggingRef.current) {
					return;
				}
				onClick();
			}}
			bounds="parent"
			lockAspectRatio
			className="cursor-move"
			style={{
				zIndex: 900,
				pointerEvents: "auto",
			}}
			enableResizing={isSelected}
			disableDragging={!isSelected}
		>
			<div
				className="relative h-full w-full overflow-hidden"
				style={{
					borderRadius,
					opacity: renderModel.opacity,
					border: `${renderModel.borderWidthPx}px solid ${region.borderColor}`,
					boxShadow,
				}}
			>
				{previewVideo}
				<canvas
					ref={canvasRef}
					className="h-full w-full"
					style={{
						width: "100%",
						height: "100%",
						display: "block",
					}}
				/>
			</div>
		</Rnd>
	);
}
