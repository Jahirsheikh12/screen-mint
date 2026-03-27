import { fixWebmDuration } from "@fix-webm-duration/fix";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import type { CameraSessionState } from "@/components/video-editor/types";
import { loadCameraPreferences, saveCameraPreferences } from "@/hooks/cameraPreferences";
import { buildNativeRecordingOptions } from "@/lib/recording/nativeConfig";
import type { AfterRecordingAction, PostRecordingContext } from "@/lib/recording/postRecording";
import {
	type RecordingRuntimeSettings,
	resolveRecordingTargetProfile,
} from "@/lib/recording/runtimeConfig";
import type {
	CaptureMode,
	PendingRecordingAction,
	RecordingSessionState,
	SelectedArea,
} from "@/lib/recording/session";
import { INITIAL_RECORDING_SESSION_STATE, recordingSessionReducer } from "@/lib/recording/session";

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const CODEC_ALIGNMENT = 2;
const RECORDER_TIMESLICE_MS = 1000;
const BITS_PER_MEGABIT = 1_000_000;
const MIN_FRAME_RATE = 30;
const CHROME_MEDIA_SOURCE = "desktop";
const RECORDING_FILE_PREFIX = "recording-";
const WEBCAM_FILE_PREFIX = "webcam-";
const VIDEO_FILE_EXTENSION = ".webm";
const AUDIO_BITRATE_VOICE = 128_000;
const AUDIO_BITRATE_SYSTEM = 192_000;
const MIC_GAIN_BOOST = 1.4;

type ExtendedMediaDevices = MediaDevices & {
	getUserMedia(constraints: MediaStreamConstraints | Record<string, unknown>): Promise<MediaStream>;
	getDisplayMedia(
		constraints?: DisplayMediaStreamOptions & Record<string, unknown>,
	): Promise<MediaStream>;
};

type ExtendedDisplayVideoConstraints = MediaTrackConstraints & {
	displaySurface?: "window" | "monitor" | "browser";
	cursor?: "always" | "motion" | "never";
};

type UseScreenRecorderReturn = {
	recording: boolean;
	paused: boolean;
	countdownActive: boolean;
	toggleRecording: () => void;
	togglePause: () => void;
	retakeRecording: () => void;
	deleteRecording: () => void;
	preparePermissions: (options?: { startup?: boolean }) => Promise<boolean>;
	isMacOS: boolean;
	microphoneEnabled: boolean;
	setMicrophoneEnabled: (enabled: boolean) => void;
	microphoneDeviceId: string | undefined;
	setMicrophoneDeviceId: (deviceId: string | undefined) => void;
	systemAudioEnabled: boolean;
	setSystemAudioEnabled: (enabled: boolean) => void;
	countdownDelay: number;
	setCountdownDelay: (delay: number) => void;
	webcamEnabled: boolean;
	setWebcamEnabled: (enabled: boolean) => void;
	cameraSession: CameraSessionState;
	setCameraDeviceId: (deviceId?: string) => void;
	setCameraPreviewVisible: (visible: boolean) => void;
	setCameraPreviewMirrored: (mirrored: boolean) => void;
	cameraPreviewStream: MediaStream | null;
	recordingBusy: boolean;
	sessionState: RecordingSessionState;
};

type ScreenRecorderOptions = Partial<RecordingRuntimeSettings> & {
	afterRecordingAction?: AfterRecordingAction;
	openQuickShare?: boolean;
	autoCreateZooms?: boolean;
	highlightArea?: boolean;
};

export function useScreenRecorder(
	recordingSettings?: ScreenRecorderOptions,
): UseScreenRecorderReturn {
	const initialCameraPreferences = loadCameraPreferences();
	const [starting, setStarting] = useState(false);
	const [countdownActive, setCountdownActive] = useState(false);
	const [isMacOS, setIsMacOS] = useState(false);
	const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
	const [microphoneDeviceId, setMicrophoneDeviceId] = useState<string | undefined>(undefined);
	const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
	const [countdownDelay, setCountdownDelayState] = useState(3);
	const [cameraSession, setCameraSession] = useState<CameraSessionState>(initialCameraPreferences);
	const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
	const [sessionState, dispatchSession] = useReducer(
		recordingSessionReducer,
		INITIAL_RECORDING_SESSION_STATE,
	);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const screenStream = useRef<MediaStream | null>(null);
	const microphoneStream = useRef<MediaStream | null>(null);
	const mixingContext = useRef<AudioContext | null>(null);
	const chunks = useRef<Blob[]>([]);
	const webcamStream = useRef<MediaStream | null>(null);
	const webcamRecorder = useRef<MediaRecorder | null>(null);
	const webcamChunks = useRef<Blob[]>([]);
	const startTime = useRef<number>(0);
	const nativeScreenRecording = useRef(false);
	const wgcRecording = useRef(false);
	const startInFlight = useRef(false);
	const hasPromptedForReselect = useRef(false);
	const hasShownWgcFallbackToast = useRef(false);
	const countdownDelayLoaded = useRef(false);
	const webcamStopInFlight = useRef(false);
	const hasShownCameraDisconnectToast = useRef(false);
	const stopWebcamRecordingRef = useRef<() => Promise<{ path: string; durationMs: number } | null>>(
		async () => null,
	);
	const finalizeSessionRef = useRef<(nextAction: PendingRecordingAction) => Promise<void>>(
		async () => undefined,
	);
	const pendingActionRef = useRef<PendingRecordingAction>(null);
	const sessionRef = useRef<RecordingSessionState>(INITIAL_RECORDING_SESSION_STATE);
	const browserSessionStopPending = useRef(false);
	const currentSegmentStartedAtRef = useRef<number>(0);
	const finalizingRecordingRef = useRef(false);
	const recordingSegmentsRef = useRef<Array<{ path: string; durationMs: number }>>([]);
	const microphoneSegmentsRef = useRef<Array<{ path: string; durationMs: number }>>([]);
	const webcamEnabled = cameraSession.enabled;
	const recording = sessionState.phase !== "idle";
	const paused = sessionState.phase === "paused";

	useEffect(() => {
		sessionRef.current = sessionState;
	}, [sessionState]);

	const preparePermissions = useCallback(async (options: { startup?: boolean } = {}) => {
		const platform = await window.electronAPI.getPlatform();
		if (platform !== "darwin") {
			return true;
		}

		const screenPermission = await window.electronAPI.getScreenRecordingPermissionStatus();
		if (!screenPermission.success || screenPermission.status !== "granted") {
			await window.electronAPI.openDisplayCapturePreferences();
			alert(
				options.startup
					? "ScreenMint needs Screen Recording permission before you start. System Settings has been opened. After enabling it, quit and reopen ScreenMint."
					: "Screen Recording permission is still missing. System Settings has been opened again. Enable it, then quit and reopen ScreenMint before recording.",
			);
			return false;
		}

		const accessibilityPermission = await window.electronAPI.getAccessibilityPermissionStatus();
		if (!accessibilityPermission.success) {
			return false;
		}

		if (accessibilityPermission.trusted) {
			return true;
		}

		const requestedAccessibility = await window.electronAPI.requestAccessibilityPermission();
		if (requestedAccessibility.success && requestedAccessibility.trusted) {
			return true;
		}

		await window.electronAPI.openAccessibilityPreferences();
		alert(
			options.startup
				? "ScreenMint also needs Accessibility permission for cursor tracking. System Settings has been opened. After enabling it, quit and reopen ScreenMint."
				: "Accessibility permission is still missing. System Settings has been opened again. Enable it, then quit and reopen ScreenMint before recording.",
		);

		return false;
	}, []);

	const resolvedRecordingProfile = resolveRecordingTargetProfile(recordingSettings);

	const selectMimeType = useCallback(() => {
		const preferred = resolvedRecordingProfile.preferHardwareEncoding
			? ["video/webm;codecs=h264", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
			: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm;codecs=h264", "video/webm"];

		return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
	}, [resolvedRecordingProfile.preferHardwareEncoding]);

	const releaseWebcamStream = useCallback(() => {
		const activeStream = webcamStream.current;
		webcamStream.current = null;

		if (activeStream) {
			activeStream.getTracks().forEach((track) => {
				track.onended = null;
				track.stop();
			});
		}

		setCameraPreviewStream(null);
	}, []);

	const getAvailableCameraDevices = useCallback(async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			return devices.filter((device) => device.kind === "videoinput");
		} catch {
			return [];
		}
	}, []);

	const getWebcamConstraintCandidates = useCallback(
		(deviceId?: string): MediaTrackConstraints[] => {
			const deviceConstraint = deviceId ? { deviceId: { exact: deviceId } } : {};
			const unconstrainedDevice = deviceId ? { deviceId: { ideal: deviceId } } : {};

			return [
				{
					...deviceConstraint,
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					frameRate: { ideal: 30, max: 30 },
				},
				{
					...deviceConstraint,
					width: { ideal: 1280 },
					height: { ideal: 720 },
					frameRate: { ideal: 30, max: 30 },
				},
				{
					...unconstrainedDevice,
					width: { ideal: 1280 },
					height: { ideal: 720 },
					frameRate: { ideal: 30, max: 30 },
				},
				{
					...unconstrainedDevice,
					frameRate: { ideal: 30, max: 30 },
				},
				{
					...unconstrainedDevice,
				},
			];
		},
		[],
	);

	const getWebcamRecorderBitrate = useCallback((camStream: MediaStream) => {
		const settings = camStream.getVideoTracks()[0]?.getSettings();
		const width = settings?.width ?? 1280;
		const height = settings?.height ?? 720;
		const pixels = width * height;

		if (pixels >= 1920 * 1080) {
			return 7_000_000;
		}

		if (pixels >= 1280 * 720) {
			return 5_000_000;
		}

		return 3_500_000;
	}, []);

	const handleUnexpectedWebcamEnd = useCallback(() => {
		if (!cameraSession.enabled || webcamStopInFlight.current) {
			return;
		}

		if (!hasShownCameraDisconnectToast.current) {
			hasShownCameraDisconnectToast.current = true;
			toast.warning("Camera disconnected. Screen recording will continue without webcam.");
		}

		void window.electronAPI.clearCurrentWebcamPath();

		if (webcamRecorder.current?.state === "recording") {
			void (async () => {
				await stopWebcamRecordingRef.current();
				setCameraSession((prev) => ({ ...prev, enabled: false }));
			})();
			return;
		}

		releaseWebcamStream();
		setCameraSession((prev) => ({ ...prev, enabled: false }));
	}, [cameraSession.enabled, releaseWebcamStream]);

	const attachWebcamTrackLifecycle = useCallback(
		(camStream: MediaStream) => {
			const track = camStream.getVideoTracks()[0];
			if (!track) {
				return;
			}

			track.onended = () => {
				if (webcamStream.current !== camStream) {
					return;
				}

				handleUnexpectedWebcamEnd();
			};
		},
		[handleUnexpectedWebcamEnd],
	);

	const acquireWebcamStream = useCallback(
		async (preferredDeviceId?: string) => {
			let lastError: unknown = null;
			const attemptedDeviceIds = new Set<string | undefined>();

			for (const candidateDeviceId of [preferredDeviceId, undefined]) {
				if (attemptedDeviceIds.has(candidateDeviceId)) {
					continue;
				}
				attemptedDeviceIds.add(candidateDeviceId);

				for (const video of getWebcamConstraintCandidates(candidateDeviceId)) {
					try {
						const camStream = await navigator.mediaDevices.getUserMedia({
							video,
							audio: false,
						});
						const resolvedDeviceId =
							camStream.getVideoTracks()[0]?.getSettings().deviceId ?? candidateDeviceId;

						return {
							stream: camStream,
							resolvedDeviceId,
						};
					} catch (error) {
						lastError = error;
					}
				}
			}

			const devices = await getAvailableCameraDevices();
			for (const device of devices) {
				if (!device.deviceId || attemptedDeviceIds.has(device.deviceId)) {
					continue;
				}

				for (const video of getWebcamConstraintCandidates(device.deviceId)) {
					try {
						const camStream = await navigator.mediaDevices.getUserMedia({
							video,
							audio: false,
						});
						return {
							stream: camStream,
							resolvedDeviceId: device.deviceId,
						};
					} catch (error) {
						lastError = error;
					}
				}
			}

			throw lastError ?? new Error("No camera is available.");
		},
		[getAvailableCameraDevices, getWebcamConstraintCandidates],
	);

	const setWebcamEnabled = useCallback(
		(enabled: boolean) => {
			setCameraSession((prev) => ({
				...prev,
				enabled,
			}));

			if (!enabled) {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
			}
		},
		[releaseWebcamStream],
	);

	const setCameraDeviceId = useCallback(
		(deviceId?: string) => {
			setCameraSession((prev) => ({
				...prev,
				deviceId,
				enabled: Boolean(deviceId),
			}));

			if (webcamRecorder.current?.state !== "recording") {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
			}
		},
		[releaseWebcamStream],
	);

	const setCameraPreviewVisible = useCallback((visible: boolean) => {
		setCameraSession((prev) => ({ ...prev, previewVisible: visible }));
	}, []);

	const setCameraPreviewMirrored = useCallback((mirrored: boolean) => {
		setCameraSession((prev) => ({ ...prev, previewMirrored: mirrored }));
	}, []);

	const cleanupCapturedMedia = useCallback(() => {
		if (stream.current) {
			stream.current.getTracks().forEach((track) => track.stop());
			stream.current = null;
		}

		if (screenStream.current) {
			screenStream.current.getTracks().forEach((track) => track.stop());
			screenStream.current = null;
		}

		if (microphoneStream.current) {
			microphoneStream.current.getTracks().forEach((track) => track.stop());
			microphoneStream.current = null;
		}

		if (mixingContext.current) {
			mixingContext.current.close().catch(() => {
				// Ignore teardown failures while stopping a recording session.
			});
			mixingContext.current = null;
		}

		if (webcamStream.current) {
			webcamStream.current.getTracks().forEach((track) => track.stop());
			webcamStream.current = null;
		}

		setCameraPreviewStream(null);
	}, []);
	const ensureWebcamStream = useCallback(async () => {
		if (webcamStream.current) {
			return webcamStream.current;
		}

		const { stream: camStream, resolvedDeviceId } = await acquireWebcamStream(
			cameraSession.deviceId,
		);
		webcamStream.current = camStream;
		attachWebcamTrackLifecycle(camStream);
		setCameraPreviewStream(cameraSession.previewVisible ? camStream : null);

		if (resolvedDeviceId && resolvedDeviceId !== cameraSession.deviceId) {
			setCameraSession((prev) => ({
				...prev,
				deviceId: resolvedDeviceId,
				enabled: true,
			}));
		}

		return camStream;
	}, [
		acquireWebcamStream,
		attachWebcamTrackLifecycle,
		cameraSession.deviceId,
		cameraSession.previewVisible,
	]);

	const startWebcamRecording = useCallback(async () => {
		try {
			hasShownCameraDisconnectToast.current = false;
			const camStream = await ensureWebcamStream();
			webcamChunks.current = [];

			const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
				? "video/webm;codecs=vp9"
				: "video/webm";

			const recorder = new MediaRecorder(camStream, {
				mimeType,
				videoBitsPerSecond: getWebcamRecorderBitrate(camStream),
			});
			webcamRecorder.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) webcamChunks.current.push(event.data);
			};
			recorder.start(RECORDER_TIMESLICE_MS);
		} catch (error) {
			console.warn("Failed to start webcam recording:", error);
			await window.electronAPI.clearCurrentWebcamPath();
			setCameraSession((prev) => ({ ...prev, enabled: false }));
			setCameraPreviewStream(null);
			toast.error("Unable to access the selected camera. Recording will continue without webcam.");
		}
	}, [ensureWebcamStream, getWebcamRecorderBitrate]);

	const stopWebcamRecording = useCallback(async () => {
		webcamStopInFlight.current = true;
		try {
			const recorder = webcamRecorder.current;
			const mimeType = recorder?.mimeType ?? "video/webm";

			// Wait for MediaRecorder to fully stop and fire final dataavailable
			if (recorder?.state === "recording") {
				await new Promise<void>((resolve) => {
					recorder.onstop = () => resolve();
					recorder.stop();
				});
			}

			releaseWebcamStream();

			if (webcamChunks.current.length === 0) {
				webcamRecorder.current = null;
				await window.electronAPI.clearCurrentWebcamPath();
				return null;
			}

			const duration =
				recordingSegmentsRef.current.reduce((total, segment) => total + segment.durationMs, 0) ||
				Math.max(0, Date.now() - startTime.current);
			const buggyBlob = new Blob(webcamChunks.current, { type: mimeType });
			webcamChunks.current = [];

			const webcamBlob = await fixWebmDuration(buggyBlob, duration);
			const arrayBuffer = await webcamBlob.arrayBuffer();
			const webcamFileName = `${WEBCAM_FILE_PREFIX}${Date.now()}${VIDEO_FILE_EXTENSION}`;
			const result = await window.electronAPI.storeRecordedVideoSegment(
				arrayBuffer,
				webcamFileName,
			);
			if (result.success && result.path) {
				return { path: result.path, durationMs: duration };
			}
			return null;
		} catch (error) {
			console.error("Error saving webcam recording:", error);
			await window.electronAPI.clearCurrentWebcamPath();
			return null;
		} finally {
			webcamRecorder.current = null;
			webcamStopInFlight.current = false;
		}
	}, [releaseWebcamStream]);

	stopWebcamRecordingRef.current = stopWebcamRecording;

	const getSelectedArea = useCallback(async (): Promise<SelectedArea | null> => {
		const result = await window.electronAPI.getSelectedArea();
		return result.success ? (result.area ?? null) : null;
	}, []);

	const recordSegment = useCallback(
		(path: string, durationMs: number, microphonePath?: string | null) => {
			recordingSegmentsRef.current.push({ path, durationMs });
			dispatchSession({ type: "segment-stored" });
			if (microphonePath) {
				microphoneSegmentsRef.current.push({ path: microphonePath, durationMs });
			}
		},
		[],
	);

	const resetSegmentBuffers = useCallback(() => {
		recordingSegmentsRef.current = [];
		microphoneSegmentsRef.current = [];
	}, []);

	const discardCurrentArtifacts = useCallback(
		async (clearCurrentPaths = false) => {
			await window.electronAPI.discardRecordingArtifacts({
				paths: [
					...recordingSegmentsRef.current.map((segment) => segment.path),
					...microphoneSegmentsRef.current.map((segment) => segment.path),
				],
				clearCurrentVideo: clearCurrentPaths,
				clearCurrentWebcam: clearCurrentPaths,
			});
			resetSegmentBuffers();
			await window.electronAPI.closeHighlightOverlay();
			await window.electronAPI.clearCurrentWebcamPath();
		},
		[resetSegmentBuffers],
	);

	const getCaptureMode = useCallback(
		(selectedSource: { id?: string } | null, selectedArea: SelectedArea | null): CaptureMode => {
			if (selectedArea && selectedSource?.id?.startsWith("screen:")) {
				return "area";
			}
			if (selectedSource?.id?.startsWith("window:")) {
				return "window";
			}
			return "display";
		},
		[],
	);

	const stopActiveNativeSegment = useCallback(
		async (pauseOnly: boolean) => {
			if (!nativeScreenRecording.current) {
				return null;
			}

			nativeScreenRecording.current = false;
			const isWgc = wgcRecording.current;
			wgcRecording.current = false;
			await window.electronAPI.setRecordingState(false);

			const result = await window.electronAPI.stopNativeScreenRecording();
			if (!result.success || !result.path) {
				throw new Error(result.error ?? result.message ?? "Failed to stop native recording");
			}

			let finalPath = result.path;
			let microphonePath = result.microphonePath ?? null;
			if (isWgc) {
				const muxResult = await window.electronAPI.muxWgcRecording();
				if (!muxResult.success || !muxResult.path) {
					throw new Error(muxResult.error ?? muxResult.message ?? "Failed to mux WGC segment");
				}
				finalPath = muxResult.path;
				microphonePath = muxResult.microphonePath ?? microphonePath;
			}

			const durationMs = Math.max(0, Date.now() - currentSegmentStartedAtRef.current);
			recordSegment(finalPath, durationMs, microphonePath);

			if (pauseOnly && webcamRecorder.current?.state === "recording") {
				webcamRecorder.current.pause();
			}

			return { path: finalPath, durationMs, microphonePath };
		},
		[recordSegment],
	);

	const stopRecording = useRef(() => {
		// Replaced after the recorder callbacks are wired.
	});

	useEffect(() => {
		void (async () => {
			const platform = await window.electronAPI.getPlatform();
			setIsMacOS(platform === "darwin");
		})();
	}, []);

	useEffect(() => {
		if (countdownDelayLoaded.current) return;
		countdownDelayLoaded.current = true;

		void (async () => {
			const result = await window.electronAPI.getCountdownDelay();
			if (result.success && typeof result.delay === "number") {
				setCountdownDelayState(result.delay);
			}
		})();
	}, []);

	const setCountdownDelay = useCallback((delay: number) => {
		setCountdownDelayState(delay);
		void window.electronAPI.setCountdownDelay(delay);
	}, []);

	useEffect(() => {
		saveCameraPreferences(cameraSession);
	}, [cameraSession]);

	useEffect(() => {
		let cancelled = false;

		if (!cameraSession.enabled) {
			if (webcamRecorder.current?.state !== "recording") {
				releaseWebcamStream();
			}
			return;
		}

		void ensureWebcamStream()
			.then((camStream) => {
				if (cancelled) {
					return;
				}

				setCameraPreviewStream(cameraSession.previewVisible ? camStream : null);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				console.warn("Failed to prepare camera preview:", error);
				setCameraSession((prev) => ({ ...prev, enabled: false }));
				setCameraPreviewStream(null);
			});

		return () => {
			cancelled = true;
		};
	}, [
		cameraSession.enabled,
		cameraSession.previewVisible,
		ensureWebcamStream,
		releaseWebcamStream,
	]);

	useEffect(() => {
		const handleDeviceChange = () => {
			void (async () => {
				const devices = await getAvailableCameraDevices();

				if (devices.length === 0) {
					releaseWebcamStream();
					setCameraSession((prev) => ({ ...prev, enabled: false, deviceId: undefined }));
					return;
				}

				if (
					cameraSession.deviceId &&
					devices.some((device) => device.deviceId === cameraSession.deviceId)
				) {
					return;
				}

				if (!cameraSession.enabled) {
					return;
				}

				const fallbackDeviceId = devices[0]?.deviceId;
				releaseWebcamStream();
				setCameraSession((prev) => ({
					...prev,
					deviceId: fallbackDeviceId,
					enabled: Boolean(fallbackDeviceId),
				}));
			})();
		};

		navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
		return () => {
			navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
		};
	}, [
		cameraSession.deviceId,
		cameraSession.enabled,
		getAvailableCameraDevices,
		releaseWebcamStream,
	]);

	useEffect(() => {
		let cleanup: (() => void) | undefined;

		if (window.electronAPI?.onStopRecordingFromTray) {
			cleanup = window.electronAPI.onStopRecordingFromTray(() => {
				stopRecording.current();
			});
		}

		const removeRecordingInterruptedListener = window.electronAPI?.onRecordingInterrupted?.(
			(state) => {
				nativeScreenRecording.current = false;
				wgcRecording.current = false;
				cleanupCapturedMedia();
				void window.electronAPI.setRecordingState(false);
				void window.electronAPI.closeHighlightOverlay();
				void discardCurrentArtifacts(true);
				pendingActionRef.current = null;
				dispatchSession({ type: "reset" });
				dispatchSession({ type: "clear-pending-action" });

				if (state.reason === "window-unavailable" && !hasPromptedForReselect.current) {
					hasPromptedForReselect.current = true;
					alert(state.message);
					void window.electronAPI.openSourceSelector();
				} else {
					console.error(state.message);
				}
			},
		);

		return () => {
			cleanup?.();
			removeRecordingInterruptedListener?.();

			if (nativeScreenRecording.current) {
				nativeScreenRecording.current = false;
				void window.electronAPI.stopNativeScreenRecording();
			}

			if (
				mediaRecorder.current?.state === "recording" ||
				mediaRecorder.current?.state === "paused"
			) {
				mediaRecorder.current.stop();
			}

			cleanupCapturedMedia();
		};
	}, [cleanupCapturedMedia, discardCurrentArtifacts]);

	const startRecording = useCallback(async () => {
		if (startInFlight.current) {
			return;
		}

		hasPromptedForReselect.current = false;
		startInFlight.current = true;
		setStarting(true);

		try {
			const selectedSource = await window.electronAPI.getSelectedSource();
			if (!selectedSource) {
				alert("Please select a source to record");
				return;
			}
			const selectedArea = await getSelectedArea();
			const effectiveSelectedArea = selectedSource.id?.startsWith("screen:") ? selectedArea : null;
			const captureMode = getCaptureMode(selectedSource, effectiveSelectedArea);
			if (captureMode === "area" && !effectiveSelectedArea) {
				alert("Please select an area to record");
				return;
			}
			const isResumingNative = sessionRef.current.phase === "paused";
			if (!isResumingNative) {
				resetSegmentBuffers();
				pendingActionRef.current = null;
			}

			const permissionsReady = await preparePermissions();
			if (!permissionsReady) {
				return;
			}

			const platform = await window.electronAPI.getPlatform();
			const useNativeMacScreenCapture =
				platform === "darwin" &&
				(selectedSource.id?.startsWith("screen:") || selectedSource.id?.startsWith("window:")) &&
				typeof window.electronAPI.startNativeScreenRecording === "function";

			let useWgcCapture = false;
			if (
				platform === "win32" &&
				(selectedSource.id?.startsWith("screen:") || selectedSource.id?.startsWith("window:")) &&
				typeof window.electronAPI.isWgcAvailable === "function"
			) {
				try {
					const wgcResult = await window.electronAPI.isWgcAvailable();
					useWgcCapture = wgcResult.available;
					if (!useWgcCapture && !hasShownWgcFallbackToast.current) {
						hasShownWgcFallbackToast.current = true;
						toast.info(
							"Native Windows capture (WGC) is unavailable. Falling back to browser capture.",
						);
					}
				} catch {
					useWgcCapture = false;
					if (!hasShownWgcFallbackToast.current) {
						hasShownWgcFallbackToast.current = true;
						toast.info(
							"Unable to check native Windows capture (WGC). Falling back to browser capture.",
						);
					}
				}
			}

			if (useNativeMacScreenCapture || useWgcCapture) {
				// WGC: resolve mic device label for native WASAPI capture
				let micLabel: string | undefined;
				if (useWgcCapture && microphoneEnabled) {
					try {
						const devices = await navigator.mediaDevices.enumerateDevices();
						const mic = devices.find(
							(d) => d.deviceId === microphoneDeviceId && d.kind === "audioinput",
						);
						micLabel = mic?.label || undefined;
					} catch {
						// Fall through — native process will use default mic
					}
				}

				const nativeResult = await window.electronAPI.startNativeScreenRecording(
					selectedSource,
					buildNativeRecordingOptions({
						capturesSystemAudio: systemAudioEnabled,
						capturesMicrophone: microphoneEnabled,
						microphoneDeviceId,
						microphoneLabel: micLabel,
						selectedArea: effectiveSelectedArea,
						recordingFps: resolvedRecordingProfile.frameRate,
						recordingWidth: resolvedRecordingProfile.width,
						recordingHeight: resolvedRecordingProfile.height,
						videoBitsPerSecond: resolvedRecordingProfile.videoBitsPerSecond,
						hardwareAcceleration: resolvedRecordingProfile.preferHardwareEncoding,
					}),
				);
				if (!nativeResult.success) {
					if (isResumingNative || recordingSegmentsRef.current.length > 0) {
						throw new Error(
							nativeResult.error ??
								nativeResult.message ??
								"Failed to resume native screen recording",
						);
					}

					if (useWgcCapture) {
						console.warn(
							"WGC capture failed, falling back to browser capture:",
							nativeResult.error ?? nativeResult.message,
						);
						if (!hasShownWgcFallbackToast.current) {
							hasShownWgcFallbackToast.current = true;
							toast.warning(
								"Native Windows capture failed to start. Falling back to browser capture.",
							);
						}
					} else {
						throw new Error(
							nativeResult.error ??
								nativeResult.message ??
								"Failed to start native screen recording",
						);
					}
				}

				if (nativeResult.success) {
					nativeScreenRecording.current = true;
					wgcRecording.current = useWgcCapture;
					currentSegmentStartedAtRef.current = Date.now();
					if (!isResumingNative) {
						startTime.current = Date.now();
						dispatchSession({
							type: "start",
							captureMode,
							selectedSourceId: selectedSource.id ?? null,
							selectedArea: effectiveSelectedArea,
						});
					} else {
						dispatchSession({ type: "resume" });
					}
					window.electronAPI?.setRecordingState(true);

					if (!isResumingNative && webcamEnabled) {
						void startWebcamRecording();
					} else if (isResumingNative && webcamRecorder.current?.state === "paused") {
						webcamRecorder.current.resume();
					} else if (!webcamEnabled) {
						await window.electronAPI.clearCurrentWebcamPath();
					}

					return;
				}
			}

			const wantsAudioCapture = microphoneEnabled || systemAudioEnabled;

			try {
				await window.electronAPI.hideOsCursor?.();
			} catch {
				console.warn("Could not hide OS cursor before recording.");
			}

			let videoTrack: MediaStreamTrack | undefined;
			let systemAudioIncluded = false;
			const mediaDevices = navigator.mediaDevices as ExtendedMediaDevices;

			if (wantsAudioCapture) {
				const videoConstraints = {
					mandatory: {
						chromeMediaSource: CHROME_MEDIA_SOURCE,
						chromeMediaSourceId: selectedSource.id,
						maxWidth: resolvedRecordingProfile.width,
						maxHeight: resolvedRecordingProfile.height,
						maxFrameRate: resolvedRecordingProfile.frameRate,
						minFrameRate: MIN_FRAME_RATE,
					},
				};

				let screenMediaStream: MediaStream;

				if (systemAudioEnabled) {
					try {
						screenMediaStream = await mediaDevices.getUserMedia({
							audio: {
								mandatory: {
									chromeMediaSource: CHROME_MEDIA_SOURCE,
									chromeMediaSourceId: selectedSource.id,
								},
							},
							video: videoConstraints,
						});
					} catch (audioError) {
						console.warn("System audio capture failed, falling back to video-only:", audioError);
						alert(
							"System audio is not available for this source. Recording will continue without system audio.",
						);
						screenMediaStream = await mediaDevices.getUserMedia({
							audio: false,
							video: videoConstraints,
						});
					}
				} else {
					screenMediaStream = await mediaDevices.getUserMedia({
						audio: false,
						video: videoConstraints,
					});
				}

				screenStream.current = screenMediaStream;
				stream.current = new MediaStream();

				videoTrack = screenMediaStream.getVideoTracks()[0];
				if (!videoTrack) {
					throw new Error("Video track is not available.");
				}

				stream.current.addTrack(videoTrack);

				if (microphoneEnabled) {
					try {
						microphoneStream.current = await navigator.mediaDevices.getUserMedia({
							audio: microphoneDeviceId
								? {
										deviceId: { exact: microphoneDeviceId },
										echoCancellation: true,
										noiseSuppression: true,
										autoGainControl: true,
									}
								: {
										echoCancellation: true,
										noiseSuppression: true,
										autoGainControl: true,
									},
							video: false,
						});
					} catch (audioError) {
						console.warn("Failed to get microphone access:", audioError);
						alert(
							"Microphone access was denied. Recording will continue without microphone audio.",
						);
						setMicrophoneEnabled(false);
					}
				}

				const systemAudioTrack = screenMediaStream.getAudioTracks()[0];
				const micAudioTrack = microphoneStream.current?.getAudioTracks()[0];

				if (systemAudioTrack && micAudioTrack) {
					const context = new AudioContext();
					mixingContext.current = context;
					const systemSource = context.createMediaStreamSource(new MediaStream([systemAudioTrack]));
					const micSource = context.createMediaStreamSource(new MediaStream([micAudioTrack]));
					const micGain = context.createGain();
					micGain.gain.value = MIC_GAIN_BOOST;
					const destination = context.createMediaStreamDestination();

					systemSource.connect(destination);
					micSource.connect(micGain).connect(destination);

					const mixedTrack = destination.stream.getAudioTracks()[0];
					if (mixedTrack) {
						stream.current.addTrack(mixedTrack);
						systemAudioIncluded = true;
					}
				} else if (systemAudioTrack) {
					stream.current.addTrack(systemAudioTrack);
					systemAudioIncluded = true;
				} else if (micAudioTrack) {
					stream.current.addTrack(micAudioTrack);
				}
			} else {
				const mediaStream = await mediaDevices.getDisplayMedia({
					audio: false,
					video: {
						displaySurface: selectedSource.id?.startsWith("window:") ? "window" : "monitor",
						width: {
							ideal: resolvedRecordingProfile.width,
							max: resolvedRecordingProfile.width,
						},
						height: {
							ideal: resolvedRecordingProfile.height,
							max: resolvedRecordingProfile.height,
						},
						frameRate: {
							ideal: resolvedRecordingProfile.frameRate,
							max: resolvedRecordingProfile.frameRate,
						},
						cursor: "never",
					} as ExtendedDisplayVideoConstraints,
					selfBrowserSurface: "exclude",
					surfaceSwitching: "exclude",
				});

				stream.current = mediaStream;
				videoTrack = mediaStream.getVideoTracks()[0];
			}

			if (!stream.current || !videoTrack) {
				throw new Error("Media stream is not available.");
			}

			try {
				await videoTrack.applyConstraints({
					frameRate: {
						ideal: resolvedRecordingProfile.frameRate,
						max: resolvedRecordingProfile.frameRate,
					},
					width: { ideal: resolvedRecordingProfile.width, max: resolvedRecordingProfile.width },
					height: {
						ideal: resolvedRecordingProfile.height,
						max: resolvedRecordingProfile.height,
					},
				} as MediaTrackConstraints);
			} catch (error) {
				console.warn(
					"Unable to lock the requested recording constraints, using best available track settings.",
					error,
				);
			}

			let {
				width = DEFAULT_WIDTH,
				height = DEFAULT_HEIGHT,
				frameRate = resolvedRecordingProfile.frameRate,
			} = videoTrack.getSettings();

			width = Math.floor(width / CODEC_ALIGNMENT) * CODEC_ALIGNMENT;
			height = Math.floor(height / CODEC_ALIGNMENT) * CODEC_ALIGNMENT;

			const videoBitsPerSecond = Math.max(
				resolvedRecordingProfile.videoBitsPerSecond,
				Math.round((width * height * Math.max(frameRate, 30)) / 8),
			);
			const mimeType = selectMimeType();

			console.log(
				`Recording at ${width}x${height} @ ${frameRate ?? resolvedRecordingProfile.frameRate}fps using ${mimeType} / ${Math.round(
					videoBitsPerSecond / BITS_PER_MEGABIT,
				)} Mbps`,
			);

			chunks.current = [];
			const hasAudio = stream.current.getAudioTracks().length > 0;
			const recorder = new MediaRecorder(stream.current, {
				mimeType,
				videoBitsPerSecond,
				...(hasAudio
					? { audioBitsPerSecond: systemAudioIncluded ? AUDIO_BITRATE_SYSTEM : AUDIO_BITRATE_VOICE }
					: {}),
			});

			mediaRecorder.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) chunks.current.push(event.data);
			};
			recorder.onstop = async () => {
				cleanupCapturedMedia();
				const pendingAction = pendingActionRef.current;
				browserSessionStopPending.current = false;
				if (chunks.current.length === 0) return;

				const duration = Math.max(0, Date.now() - currentSegmentStartedAtRef.current);
				const recordedChunks = chunks.current;
				const buggyBlob = new Blob(recordedChunks, { type: mimeType });
				chunks.current = [];
				const timestamp = Date.now();
				const videoFileName = `${RECORDING_FILE_PREFIX}${timestamp}${VIDEO_FILE_EXTENSION}`;

				try {
					const videoBlob = await fixWebmDuration(buggyBlob, duration);
					const arrayBuffer = await videoBlob.arrayBuffer();
					const videoResult = await window.electronAPI.storeRecordedVideoSegment(
						arrayBuffer,
						videoFileName,
					);
					if (!videoResult.success) {
						console.error("Failed to store video:", videoResult.message);
						return;
					}

					if (videoResult.path) {
						recordSegment(videoResult.path, duration);
					}

					if (pendingAction === "delete" || pendingAction === "retake") {
						const webcamSegment = await stopWebcamRecordingRef.current();
						await window.electronAPI.discardRecordingArtifacts({
							paths: [
								...recordingSegmentsRef.current.map((segment) => segment.path),
								...microphoneSegmentsRef.current.map((segment) => segment.path),
								...(webcamSegment?.path ? [webcamSegment.path] : []),
							],
							clearCurrentVideo: true,
							clearCurrentWebcam: true,
						});
						resetSegmentBuffers();
						pendingActionRef.current = null;
						dispatchSession({ type: "reset" });
						dispatchSession({ type: "clear-pending-action" });
						if (pendingAction === "retake") {
							await startRecording();
						}
						return;
					}

					await finalizeSessionRef.current("stop");
				} catch (error) {
					console.error("Error saving recording:", error);
				}
			};
			recorder.onerror = () => {
				dispatchSession({ type: "reset" });
			};
			recorder.start(RECORDER_TIMESLICE_MS);
			currentSegmentStartedAtRef.current = Date.now();
			startTime.current = Date.now();
			dispatchSession({
				type: "start",
				captureMode,
				selectedSourceId: selectedSource.id ?? null,
				selectedArea: effectiveSelectedArea,
			});
			window.electronAPI?.setRecordingState(true);

			if (webcamEnabled) {
				void startWebcamRecording();
			} else {
				await window.electronAPI.clearCurrentWebcamPath();
			}
		} catch (error) {
			console.error("Failed to start recording:", error);
			alert(
				error instanceof Error
					? `Failed to start recording: ${error.message}`
					: "Failed to start recording",
			);
			dispatchSession({ type: "reset" });
			cleanupCapturedMedia();
		} finally {
			startInFlight.current = false;
			setStarting(false);
		}
	}, [
		cleanupCapturedMedia,
		getCaptureMode,
		getSelectedArea,
		microphoneDeviceId,
		microphoneEnabled,
		preparePermissions,
		recordSegment,
		resolvedRecordingProfile.frameRate,
		resolvedRecordingProfile.height,
		resolvedRecordingProfile.preferHardwareEncoding,
		resolvedRecordingProfile.videoBitsPerSecond,
		resolvedRecordingProfile.width,
		resetSegmentBuffers,
		selectMimeType,
		startWebcamRecording,
		systemAudioEnabled,
		webcamEnabled,
	]);

	const finalizeSession = useCallback(
		async (nextAction: PendingRecordingAction) => {
			if (finalizingRecordingRef.current) {
				return;
			}
			finalizingRecordingRef.current = true;

			try {
				const selectedArea =
					sessionRef.current.captureMode === "area" ? sessionRef.current.selectedArea : null;
				const webcamSegment = await stopWebcamRecordingRef.current();
				const finalized = await window.electronAPI.finalizeRecordingSession({
					videoSegments: recordingSegmentsRef.current,
					webcamSegments: webcamSegment ? [webcamSegment] : [],
					microphoneSegments: microphoneSegmentsRef.current,
					selectedArea,
				});

				if (!finalized.success || !finalized.path) {
					throw new Error(finalized.error ?? finalized.message ?? "Failed to finalize session");
				}

				resetSegmentBuffers();
				await window.electronAPI.closeHighlightOverlay();
				await window.electronAPI.setPostRecordingContext({
					action: recordingSettings?.afterRecordingAction ?? "create-project",
					openQuickShare: Boolean(recordingSettings?.openQuickShare),
					autoCreateZooms: Boolean(recordingSettings?.autoCreateZooms),
					recordingPath: finalized.path,
					webcamPath: webcamSegment?.path ?? null,
					projectPath: null,
				} satisfies PostRecordingContext);
				pendingActionRef.current = null;
				dispatchSession({ type: "reset" });
				dispatchSession({ type: "clear-pending-action" });

				if (nextAction === "retake") {
					await startRecording();
					return;
				}

				await window.electronAPI.switchToEditor();
			} finally {
				finalizingRecordingRef.current = false;
			}
		},
		[
			recordingSettings?.afterRecordingAction,
			recordingSettings?.autoCreateZooms,
			recordingSettings?.openQuickShare,
			resetSegmentBuffers,
			startRecording,
		],
	);

	finalizeSessionRef.current = finalizeSession;

	const handleDiscardAction = useCallback(
		async (action: Exclude<PendingRecordingAction, "stop" | null>) => {
			const webcamSegment = await stopWebcamRecordingRef.current();
			await window.electronAPI.discardRecordingArtifacts({
				paths: [
					...recordingSegmentsRef.current.map((segment) => segment.path),
					...microphoneSegmentsRef.current.map((segment) => segment.path),
					...(webcamSegment?.path ? [webcamSegment.path] : []),
				],
				clearCurrentVideo: true,
				clearCurrentWebcam: true,
			});
			resetSegmentBuffers();
			if (recordingSettings?.highlightArea) {
				await window.electronAPI.closeHighlightOverlay();
			}
			pendingActionRef.current = null;
			dispatchSession({ type: "reset" });
			dispatchSession({ type: "clear-pending-action" });
			if (action === "retake") {
				await startRecording();
			}
		},
		[recordingSettings?.highlightArea, resetSegmentBuffers, startRecording],
	);

	stopRecording.current = () => {
		void (async () => {
			dispatchSession({ type: "queue-stop" });
			pendingActionRef.current = "stop";

			if (nativeScreenRecording.current) {
				await stopActiveNativeSegment(false);
				await finalizeSessionRef.current("stop");
				return;
			}

			if (sessionRef.current.phase === "paused" && mediaRecorder.current == null) {
				await finalizeSessionRef.current("stop");
				return;
			}

			if (
				mediaRecorder.current?.state === "recording" ||
				mediaRecorder.current?.state === "paused"
			) {
				browserSessionStopPending.current = true;
				cleanupCapturedMedia();
				await window.electronAPI.setRecordingState(false);
				mediaRecorder.current.stop();
			}
		})().catch((error) => {
			console.error("Failed to stop recording session:", error);
		});
	};

	const togglePause = useCallback(() => {
		if (!recording || starting || finalizingRecordingRef.current) {
			return;
		}

		if (mediaRecorder.current && !nativeScreenRecording.current) {
			if (mediaRecorder.current.state === "recording") {
				mediaRecorder.current.pause();
				if (webcamRecorder.current?.state === "recording") {
					webcamRecorder.current.pause();
				}
				dispatchSession({ type: "pause" });
				if (recordingSettings?.highlightArea) {
					void window.electronAPI.closeHighlightOverlay();
				}
			} else if (mediaRecorder.current.state === "paused") {
				mediaRecorder.current.resume();
				if (webcamRecorder.current?.state === "paused") {
					webcamRecorder.current.resume();
				}
				dispatchSession({ type: "resume" });
			}
			return;
		}

		void (async () => {
			if (nativeScreenRecording.current) {
				await stopActiveNativeSegment(true);
				dispatchSession({ type: "pause" });
				return;
			}

			if (sessionRef.current.phase === "paused") {
				await startRecording();
			}
		})().catch((error) => {
			console.error("Failed to toggle pause for native recording:", error);
		});
	}, [
		recording,
		recordingSettings?.highlightArea,
		starting,
		stopActiveNativeSegment,
		startRecording,
	]);

	const retakeRecording = useCallback(() => {
		if (!recording || starting || finalizingRecordingRef.current) {
			return;
		}

		void (async () => {
			dispatchSession({ type: "queue-retake" });
			pendingActionRef.current = "retake";

			if (nativeScreenRecording.current) {
				await stopActiveNativeSegment(false);
				await handleDiscardAction("retake");
				return;
			}

			if (sessionRef.current.phase === "paused" && mediaRecorder.current == null) {
				await handleDiscardAction("retake");
				return;
			}

			if (
				mediaRecorder.current?.state === "recording" ||
				mediaRecorder.current?.state === "paused"
			) {
				browserSessionStopPending.current = true;
				cleanupCapturedMedia();
				await window.electronAPI.setRecordingState(false);
				mediaRecorder.current.stop();
			}
		})().catch((error) => {
			console.error("Failed to retake recording:", error);
		});
	}, [cleanupCapturedMedia, handleDiscardAction, recording, starting, stopActiveNativeSegment]);

	const deleteRecording = useCallback(() => {
		if (!recording || starting || finalizingRecordingRef.current) {
			return;
		}

		void (async () => {
			dispatchSession({ type: "queue-delete" });
			pendingActionRef.current = "delete";

			if (nativeScreenRecording.current) {
				await stopActiveNativeSegment(false);
				await handleDiscardAction("delete");
				return;
			}

			if (sessionRef.current.phase === "paused" && mediaRecorder.current == null) {
				await handleDiscardAction("delete");
				return;
			}

			if (
				mediaRecorder.current?.state === "recording" ||
				mediaRecorder.current?.state === "paused"
			) {
				browserSessionStopPending.current = true;
				cleanupCapturedMedia();
				await window.electronAPI.setRecordingState(false);
				mediaRecorder.current.stop();
			}
		})().catch((error) => {
			console.error("Failed to delete recording:", error);
		});
	}, [cleanupCapturedMedia, handleDiscardAction, recording, starting, stopActiveNativeSegment]);

	const toggleRecording = async () => {
		if (starting || countdownActive) {
			return;
		}

		if (recording) {
			stopRecording.current();
			return;
		}

		// Start recording with optional countdown
		if (countdownDelay > 0) {
			setCountdownActive(true);
			try {
				const result = await window.electronAPI.startCountdown(countdownDelay);
				if (!result.success || result.cancelled) {
					return;
				}
			} finally {
				setCountdownActive(false);
			}
		}

		startRecording();
	};

	return {
		recording,
		paused,
		countdownActive,
		toggleRecording,
		togglePause,
		retakeRecording,
		deleteRecording,
		preparePermissions,
		isMacOS,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		countdownDelay,
		setCountdownDelay,
		webcamEnabled,
		setWebcamEnabled,
		cameraSession,
		setCameraDeviceId,
		setCameraPreviewVisible,
		setCameraPreviewMirrored,
		cameraPreviewStream,
		recordingBusy: starting || finalizingRecordingRef.current || browserSessionStopPending.current,
		sessionState,
	};
}
