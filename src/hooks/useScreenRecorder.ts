import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type CameraSessionState,
	WEBCAM_RENDER_PIPELINE_VERSION,
} from "@/components/video-editor/types";
import type { MobileCapturePairingState } from "@/electron-ipc/contracts";
import { loadCameraPreferences, saveCameraPreferences } from "@/hooks/cameraPreferences";
import { playAppAudioCue, preloadAppAudioCues } from "@/lib/appAudio";
import { resolveCaptureSourceAccessState } from "@/lib/recording/capturePermissionState";
import { resolveCaptureDimensions } from "@/lib/recording/captureSizing";
import { MobileCaptureClient } from "@/lib/recording/mobileCaptureClient";
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
import {
	buildWebcamConstraintCandidates,
	getWebcamRecorderBitrate,
	resolveWebcamCaptureProfile,
	selectSupportedWebcamRecorderMimeType,
} from "@/lib/recording/webcamCapture";

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const CODEC_ALIGNMENT = 2;
const RECORDER_TIMESLICE_MS = 1000;
const BITS_PER_MEGABIT = 1_000_000;
const MIN_FRAME_RATE = 30;
const CHROME_MEDIA_SOURCE = "desktop";
const RECORDING_FILE_PREFIX = "recording-";
const WEBCAM_FILE_PREFIX = "webcam-";
const MICROPHONE_FILE_PREFIX = "microphone-";
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
	setMobileCameraEnabled: (enabled: boolean) => void;
	setCameraPreviewVisible: (visible: boolean) => void;
	setCameraPreviewMirrored: (mirrored: boolean) => void;
	setCameraPreviewSize: (size: CameraSessionState["previewSize"]) => void;
	setCameraPreviewCorner: (corner: CameraSessionState["previewCorner"]) => void;
	setCameraPreviewShape: (shape: CameraSessionState["previewShape"]) => void;
	cameraPreviewStream: MediaStream | null;
	mobileCaptureState: MobileCapturePairingState;
	recordingBusy: boolean;
	sessionState: RecordingSessionState;
};

type ScreenRecorderOptions = Partial<RecordingRuntimeSettings> & {
	afterRecordingAction?: AfterRecordingAction;
	openQuickShare?: boolean;
	autoCreateZooms?: boolean;
	highlightArea?: boolean;
};

type MutableRecorderRef<T> = { current: T };

function createIdleMobileCaptureState(): MobileCapturePairingState {
	return {
		status: "idle",
		sessionId: null,
		pairingUrl: null,
		qrSvg: null,
		expiresAt: null,
		lanAddress: null,
	};
}

export function useScreenRecorder(
	recordingSettings?: ScreenRecorderOptions,
): UseScreenRecorderReturn {
	const initialCameraPreferences = loadCameraPreferences();
	const [starting, setStarting] = useState(false);
	const [countdownActive, setCountdownActive] = useState(false);
	const [isMacOS, setIsMacOS] = useState(false);
	const [microphoneEnabled, setMicrophoneEnabledState] = useState(false);
	const [microphoneDeviceId, setMicrophoneDeviceId] = useState<string | undefined>(undefined);
	const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
	const [countdownDelay, setCountdownDelayState] = useState(3);
	const [cameraSession, setCameraSession] = useState<CameraSessionState>(initialCameraPreferences);
	const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
	const [mobileCaptureState, setMobileCaptureState] = useState<MobileCapturePairingState>(
		createIdleMobileCaptureState,
	);
	const [sessionState, dispatchSession] = useReducer(
		recordingSessionReducer,
		INITIAL_RECORDING_SESSION_STATE,
	);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const screenStream = useRef<MediaStream | null>(null);
	const microphoneStream = useRef<MediaStream | null>(null);
	const mixingContext = useRef<AudioContext | null>(null);
	const webcamStream = useRef<MediaStream | null>(null);
	const webcamRecorder = useRef<MediaRecorder | null>(null);
	const screenChunkSessionId = useRef<string | null>(null);
	const screenChunkWriteChain = useRef<Promise<void>>(Promise.resolve());
	const screenChunkWriteError = useRef<unknown>(null);
	const screenChunkCount = useRef(0);
	const webcamChunkSessionId = useRef<string | null>(null);
	const webcamChunkWriteChain = useRef<Promise<void>>(Promise.resolve());
	const webcamChunkWriteError = useRef<unknown>(null);
	const webcamChunkCount = useRef(0);
	const microphoneChunkSessionId = useRef<string | null>(null);
	const microphoneChunkWriteChain = useRef<Promise<void>>(Promise.resolve());
	const microphoneChunkWriteError = useRef<unknown>(null);
	const microphoneChunkCount = useRef(0);
	const startTime = useRef<number>(0);
	const nativeScreenRecording = useRef(false);
	const wgcRecording = useRef(false);
	const layeredRecordingActive = useRef(false);
	const startInFlight = useRef(false);
	const hasPromptedForReselect = useRef(false);
	const hasShownWgcFallbackToast = useRef(false);
	const countdownDelayLoaded = useRef(false);
	const webcamStopInFlight = useRef(false);
	const hasShownCameraDisconnectToast = useRef(false);
	const mobileCaptureClient = useRef<MobileCaptureClient | null>(null);
	const mobileMicrophoneRecorder = useRef<MediaRecorder | null>(null);
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

	useEffect(() => {
		preloadAppAudioCues();
	}, []);

	const preparePermissions = useCallback(async (options: { startup?: boolean } = {}) => {
		const platform = await window.electronAPI.getPlatform();
		if (platform !== "darwin") {
			return true;
		}

		const capturePermission = await window.electronAPI.getCapturePermissionState();
		if (!capturePermission.success) {
			return false;
		}

		const screenAccess = resolveCaptureSourceAccessState(capturePermission.state);
		if (!screenAccess.canProbeSources) {
			await window.electronAPI.openDisplayCapturePreferences();
			alert(
				options.startup
					? "ScreenMint needs Screen Recording permission before you start. System Settings has been opened. After enabling it, quit and reopen ScreenMint."
					: "Screen Recording permission is still missing. System Settings has been opened again. Enable it, then quit and reopen ScreenMint before recording.",
			);
			return false;
		}

		if (capturePermission.state.accessibilityTrusted) {
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

	const setMicrophoneEnabled = useCallback((enabled: boolean) => {
		void (async () => {
			if (!enabled) {
				setMicrophoneEnabledState(false);
				return;
			}

			const platform = await window.electronAPI.getPlatform();
			if (platform === "darwin") {
				const microphoneAccess = await window.electronAPI.requestMicrophoneAccess();
				if (!microphoneAccess.success || !microphoneAccess.granted) {
					alert("Microphone access was denied. Recording will continue without microphone audio.");
					setMicrophoneEnabledState(false);
					return;
				}
			}

			setMicrophoneEnabledState(true);
		})();
	}, []);

	const resolvedRecordingProfile = resolveRecordingTargetProfile(recordingSettings);

	const selectMimeType = useCallback(() => {
		const preferred = resolvedRecordingProfile.preferHardwareEncoding
			? ["video/webm;codecs=h264", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
			: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm;codecs=h264", "video/webm"];

		return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
	}, [resolvedRecordingProfile.preferHardwareEncoding]);

	const resolveSourceCaptureBounds = useCallback(
		async (
			selectedSource: { id?: string; display_id?: string } | null,
			fallbackTrackSize?: { width?: number; height?: number },
		): Promise<{ width: number; height: number } | null> => {
			// An area is cropped from the full display after recording, so the whole display is
			// captured; sizing the track to the area would shrink everything before the crop.
			if (selectedSource?.id?.startsWith("screen:") && selectedSource.display_id) {
				const displayInfo = await window.electronAPI.getDisplayInfo();
				const matchedDisplay = displayInfo.success
					? displayInfo.displays.find(
							(display) => String(display.id) === String(selectedSource.display_id),
						)
					: null;

				if (matchedDisplay) {
					return {
						width: matchedDisplay.width,
						height: matchedDisplay.height,
					};
				}
			}

			if (fallbackTrackSize?.width && fallbackTrackSize?.height) {
				return {
					width: fallbackTrackSize.width,
					height: fallbackTrackSize.height,
				};
			}

			return null;
		},
		[],
	);

	const releaseWebcamStream = useCallback(() => {
		const activeStream = webcamStream.current;
		webcamStream.current = null;
		mobileCaptureClient.current?.stop();
		mobileCaptureClient.current = null;
		setMobileCaptureState(createIdleMobileCaptureState());

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
			const strictDeviceConstraint = deviceId ? { deviceId: { exact: deviceId } } : {};
			const preferredDeviceConstraint = deviceId ? { deviceId: { ideal: deviceId } } : {};

			return [
				...buildWebcamConstraintCandidates(
					resolvedRecordingProfile.frameRate,
					strictDeviceConstraint,
				),
				...buildWebcamConstraintCandidates(
					resolvedRecordingProfile.frameRate,
					preferredDeviceConstraint,
				),
			];
		},
		[resolvedRecordingProfile.frameRate],
	);

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
				setCameraSession((prev) => ({
					...prev,
					enabled: false,
					resolvedCaptureProfile: undefined,
				}));
			})();
			return;
		}

		releaseWebcamStream();
		setCameraSession((prev) => ({
			...prev,
			enabled: false,
			resolvedCaptureProfile: undefined,
		}));
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
			if (cameraSession.sourceType === "mobile") {
				if (!mobileCaptureClient.current) {
					const client = new MobileCaptureClient({
						onState: setMobileCaptureState,
						onDisconnect: handleUnexpectedWebcamEnd,
					});
					mobileCaptureClient.current = client;
					await client.startPairing();
				}

				const mobileStream = await mobileCaptureClient.current.waitForStream();
				return {
					stream: mobileStream,
					resolvedDeviceId: "mobile-camera",
				};
			}

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
		[
			cameraSession.sourceType,
			getAvailableCameraDevices,
			getWebcamConstraintCandidates,
			handleUnexpectedWebcamEnd,
		],
	);

	const setWebcamEnabled = useCallback(
		(enabled: boolean) => {
			setCameraSession((prev) => ({
				...prev,
				enabled,
				sourceType: enabled ? "local-device" : prev.sourceType,
				resolvedCaptureProfile: enabled ? prev.resolvedCaptureProfile : undefined,
			}));

			if (!enabled) {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
			} else if (webcamRecorder.current?.state !== "recording") {
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
				sourceType: "local-device",
				deviceId,
				enabled: Boolean(deviceId),
				resolvedCaptureProfile: deviceId ? prev.resolvedCaptureProfile : undefined,
			}));

			if (webcamRecorder.current?.state !== "recording") {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
			}
		},
		[releaseWebcamStream],
	);

	const setMobileCameraEnabled = useCallback(
		(enabled: boolean) => {
			setCameraSession((prev) => ({
				...prev,
				sourceType: enabled ? "mobile" : "local-device",
				deviceId: enabled ? "mobile-camera" : undefined,
				enabled,
				resolvedCaptureProfile: undefined,
			}));

			if (!enabled) {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
				return;
			}

			if (webcamRecorder.current?.state !== "recording") {
				void window.electronAPI.clearCurrentWebcamPath();
				releaseWebcamStream();
			}

			const client = new MobileCaptureClient({
				onState: setMobileCaptureState,
				onDisconnect: handleUnexpectedWebcamEnd,
			});
			mobileCaptureClient.current = client;
			void client.startPairing().catch((error) => {
				console.warn("Failed to start mobile camera pairing:", error);
				setCameraSession((prev) => ({
					...prev,
					enabled: false,
					sourceType: "local-device",
					deviceId: undefined,
					resolvedCaptureProfile: undefined,
				}));
				setMobileCaptureState({
					...createIdleMobileCaptureState(),
					status: "error",
					error: error instanceof Error ? error.message : String(error),
				});
				toast.error("Unable to start mobile camera pairing.");
			});
		},
		[handleUnexpectedWebcamEnd, releaseWebcamStream],
	);

	const setCameraPreviewVisible = useCallback((visible: boolean) => {
		setCameraSession((prev) => ({ ...prev, previewVisible: visible }));
	}, []);

	const setCameraPreviewMirrored = useCallback((mirrored: boolean) => {
		setCameraSession((prev) => ({ ...prev, previewMirrored: mirrored }));
	}, []);

	const setCameraPreviewSize = useCallback((previewSize: CameraSessionState["previewSize"]) => {
		setCameraSession((prev) => ({ ...prev, previewSize }));
	}, []);

	const setCameraPreviewCorner = useCallback(
		(previewCorner: CameraSessionState["previewCorner"]) => {
			setCameraSession((prev) => ({ ...prev, previewCorner }));
		},
		[],
	);

	const setCameraPreviewShape = useCallback((previewShape: CameraSessionState["previewShape"]) => {
		setCameraSession((prev) => ({ ...prev, previewShape }));
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
		mobileCaptureClient.current?.stop();
		mobileCaptureClient.current = null;
		setMobileCaptureState(createIdleMobileCaptureState());

		setCameraSession((prev) =>
			prev.resolvedCaptureProfile ? { ...prev, resolvedCaptureProfile: undefined } : prev,
		);
		setCameraPreviewStream(null);
	}, []);

	const resetChunkWriter = useCallback(
		(
			sessionIdRef: MutableRecorderRef<string | null>,
			writeChainRef: MutableRecorderRef<Promise<void>>,
			writeErrorRef: MutableRecorderRef<unknown>,
			chunkCountRef: MutableRecorderRef<number>,
		) => {
			sessionIdRef.current = null;
			writeChainRef.current = Promise.resolve();
			writeErrorRef.current = null;
			chunkCountRef.current = 0;
		},
		[],
	);

	const startChunkWriter = useCallback(
		async (
			fileName: string,
			sessionIdRef: MutableRecorderRef<string | null>,
			writeChainRef: MutableRecorderRef<Promise<void>>,
			writeErrorRef: MutableRecorderRef<unknown>,
			chunkCountRef: MutableRecorderRef<number>,
		) => {
			resetChunkWriter(sessionIdRef, writeChainRef, writeErrorRef, chunkCountRef);
			const result = await window.electronAPI.startMediaRecorderChunkSession(fileName);
			if (!result.success || !result.id) {
				throw new Error(result.error ?? "Failed to start recorder chunk writer");
			}
			sessionIdRef.current = result.id;
		},
		[resetChunkWriter],
	);

	const queueChunkWrite = useCallback(
		(
			data: Blob,
			sessionIdRef: MutableRecorderRef<string | null>,
			writeChainRef: MutableRecorderRef<Promise<void>>,
			writeErrorRef: MutableRecorderRef<unknown>,
			chunkCountRef: MutableRecorderRef<number>,
		) => {
			const sessionId = sessionIdRef.current;
			if (!sessionId || data.size === 0) {
				return;
			}

			chunkCountRef.current += 1;
			writeChainRef.current = writeChainRef.current
				.then(async () => {
					const arrayBuffer = await data.arrayBuffer();
					const result = await window.electronAPI.appendMediaRecorderChunk(sessionId, arrayBuffer);
					if (!result.success) {
						throw new Error(result.error ?? "Failed to append recorder chunk");
					}
				})
				.catch((error) => {
					writeErrorRef.current = error;
					console.error("Failed to write recorder chunk:", error);
				});
		},
		[],
	);

	const finishChunkWriter = useCallback(
		async (
			sessionIdRef: MutableRecorderRef<string | null>,
			writeChainRef: MutableRecorderRef<Promise<void>>,
			writeErrorRef: MutableRecorderRef<unknown>,
			chunkCountRef: MutableRecorderRef<number>,
		) => {
			const sessionId = sessionIdRef.current;
			if (!sessionId) {
				return null;
			}

			await writeChainRef.current;
			if (writeErrorRef.current) {
				await window.electronAPI.discardMediaRecorderChunkSession(sessionId);
				resetChunkWriter(sessionIdRef, writeChainRef, writeErrorRef, chunkCountRef);
				throw writeErrorRef.current;
			}

			if (chunkCountRef.current === 0) {
				await window.electronAPI.discardMediaRecorderChunkSession(sessionId);
				resetChunkWriter(sessionIdRef, writeChainRef, writeErrorRef, chunkCountRef);
				return null;
			}

			const result = await window.electronAPI.finishMediaRecorderChunkSession(sessionId);
			resetChunkWriter(sessionIdRef, writeChainRef, writeErrorRef, chunkCountRef);
			if (!result.success || !result.path) {
				throw new Error(result.error ?? "Failed to finish recorder chunk writer");
			}
			return result.path;
		},
		[resetChunkWriter],
	);

	const discardChunkWriter = useCallback(
		async (
			sessionIdRef: MutableRecorderRef<string | null>,
			writeChainRef: MutableRecorderRef<Promise<void>>,
			writeErrorRef: MutableRecorderRef<unknown>,
			chunkCountRef: MutableRecorderRef<number>,
		) => {
			const sessionId = sessionIdRef.current;
			if (sessionId) {
				await window.electronAPI.discardMediaRecorderChunkSession(sessionId);
			}
			resetChunkWriter(sessionIdRef, writeChainRef, writeErrorRef, chunkCountRef);
		},
		[resetChunkWriter],
	);
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
		const resolvedCaptureProfile = resolveWebcamCaptureProfile(
			camStream.getVideoTracks()[0]?.getSettings(),
		);

		if (resolvedDeviceId && resolvedDeviceId !== cameraSession.deviceId) {
			setCameraSession((prev) => ({
				...prev,
				deviceId: resolvedDeviceId,
				enabled: true,
				resolvedCaptureProfile,
			}));
		} else {
			setCameraSession((prev) => ({
				...prev,
				resolvedCaptureProfile,
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
			await startChunkWriter(
				`${WEBCAM_FILE_PREFIX}${Date.now()}${VIDEO_FILE_EXTENSION}`,
				webcamChunkSessionId,
				webcamChunkWriteChain,
				webcamChunkWriteError,
				webcamChunkCount,
			);

			const mimeType = selectSupportedWebcamRecorderMimeType(
				(type) => MediaRecorder.isTypeSupported(type),
				resolvedRecordingProfile.preferHardwareEncoding,
			);
			const videoTrack = camStream.getVideoTracks()[0];
			const trackSettings = videoTrack?.getSettings();
			const recorderStream =
				cameraSession.sourceType === "mobile" && videoTrack
					? new MediaStream([videoTrack])
					: camStream;

			const recorder = new MediaRecorder(recorderStream, {
				mimeType,
				videoBitsPerSecond: getWebcamRecorderBitrate(trackSettings),
			});
			webcamRecorder.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					queueChunkWrite(
						event.data,
						webcamChunkSessionId,
						webcamChunkWriteChain,
						webcamChunkWriteError,
						webcamChunkCount,
					);
				}
			};
			recorder.start(RECORDER_TIMESLICE_MS);
		} catch (error) {
			console.warn("Failed to start webcam recording:", error);
			await discardChunkWriter(
				webcamChunkSessionId,
				webcamChunkWriteChain,
				webcamChunkWriteError,
				webcamChunkCount,
			);
			await window.electronAPI.clearCurrentWebcamPath();
			setCameraSession((prev) => ({
				...prev,
				enabled: false,
				resolvedCaptureProfile: undefined,
			}));
			setCameraPreviewStream(null);
			toast.error("Unable to access the selected camera. Recording will continue without webcam.");
		}
	}, [
		discardChunkWriter,
		ensureWebcamStream,
		cameraSession.sourceType,
		queueChunkWrite,
		resolvedRecordingProfile.preferHardwareEncoding,
		startChunkWriter,
	]);

	const stopWebcamRecording = useCallback(async () => {
		webcamStopInFlight.current = true;
		try {
			const recorder = webcamRecorder.current;

			// Wait for MediaRecorder to fully stop and fire final dataavailable
			if (recorder?.state === "recording" || recorder?.state === "paused") {
				await new Promise<void>((resolve) => {
					recorder.onstop = () => resolve();
					recorder.stop();
				});
			}

			releaseWebcamStream();

			const webcamPath = await finishChunkWriter(
				webcamChunkSessionId,
				webcamChunkWriteChain,
				webcamChunkWriteError,
				webcamChunkCount,
			);

			if (!webcamPath) {
				webcamRecorder.current = null;
				await window.electronAPI.clearCurrentWebcamPath();
				return null;
			}

			const duration =
				recordingSegmentsRef.current.reduce((total, segment) => total + segment.durationMs, 0) ||
				Math.max(0, Date.now() - startTime.current);
			return { path: webcamPath, durationMs: duration };
		} catch (error) {
			console.error("Error saving webcam recording:", error);
			await discardChunkWriter(
				webcamChunkSessionId,
				webcamChunkWriteChain,
				webcamChunkWriteError,
				webcamChunkCount,
			);
			await window.electronAPI.clearCurrentWebcamPath();
			return null;
		} finally {
			webcamRecorder.current = null;
			webcamStopInFlight.current = false;
		}
	}, [discardChunkWriter, finishChunkWriter, releaseWebcamStream]);

	stopWebcamRecordingRef.current = stopWebcamRecording;

	const startMobileMicrophoneRecording = useCallback(async () => {
		if (cameraSession.sourceType !== "mobile" || !microphoneEnabled) {
			return;
		}

		const camStream = await ensureWebcamStream();
		const audioTrack = camStream.getAudioTracks()[0];
		if (!audioTrack) {
			return;
		}

		await startChunkWriter(
			`${MICROPHONE_FILE_PREFIX}${Date.now()}${VIDEO_FILE_EXTENSION}`,
			microphoneChunkSessionId,
			microphoneChunkWriteChain,
			microphoneChunkWriteError,
			microphoneChunkCount,
		);

		const recorder = new MediaRecorder(new MediaStream([audioTrack]), {
			audioBitsPerSecond: AUDIO_BITRATE_VOICE,
		});
		mobileMicrophoneRecorder.current = recorder;
		recorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) {
				queueChunkWrite(
					event.data,
					microphoneChunkSessionId,
					microphoneChunkWriteChain,
					microphoneChunkWriteError,
					microphoneChunkCount,
				);
			}
		};
		recorder.start(RECORDER_TIMESLICE_MS);
	}, [
		cameraSession.sourceType,
		ensureWebcamStream,
		microphoneEnabled,
		queueChunkWrite,
		startChunkWriter,
	]);

	const stopMobileMicrophoneRecording = useCallback(async () => {
		const recorder = mobileMicrophoneRecorder.current;
		try {
			if (recorder?.state === "recording" || recorder?.state === "paused") {
				await new Promise<void>((resolve) => {
					recorder.onstop = () => resolve();
					recorder.stop();
				});
			}
			const path = await finishChunkWriter(
				microphoneChunkSessionId,
				microphoneChunkWriteChain,
				microphoneChunkWriteError,
				microphoneChunkCount,
			);
			if (!path) {
				return null;
			}
			const duration =
				recordingSegmentsRef.current.reduce((total, segment) => total + segment.durationMs, 0) ||
				Math.max(0, Date.now() - startTime.current);
			return { path, durationMs: duration };
		} catch (error) {
			console.error("Error saving mobile microphone recording:", error);
			await discardChunkWriter(
				microphoneChunkSessionId,
				microphoneChunkWriteChain,
				microphoneChunkWriteError,
				microphoneChunkCount,
			);
			return null;
		} finally {
			mobileMicrophoneRecorder.current = null;
		}
	}, [discardChunkWriter, finishChunkWriter]);

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
			await window.electronAPI.closeAreaOverlay();
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
				setCameraSession((prev) => ({
					...prev,
					enabled: false,
					resolvedCaptureProfile: undefined,
				}));
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
			if (cameraSession.sourceType === "mobile") {
				return;
			}

			void (async () => {
				const devices = await getAvailableCameraDevices();

				if (devices.length === 0) {
					releaseWebcamStream();
					setCameraSession((prev) => ({
						...prev,
						enabled: false,
						deviceId: undefined,
						resolvedCaptureProfile: undefined,
					}));
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
					resolvedCaptureProfile: undefined,
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
		cameraSession.sourceType,
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
				playAppAudioCue("recording-error");
				nativeScreenRecording.current = false;
				wgcRecording.current = false;
				cleanupCapturedMedia();
				void window.electronAPI.setRecordingState(false);
				void window.electronAPI.closeAreaOverlay();
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

			if (!isResumingNative) {
				playAppAudioCue("recording-start");
			}

			const platform = await window.electronAPI.getPlatform();
			if (!isResumingNative) {
				try {
					const layeredPlan = await window.electronAPI.getLayeredCaptureSources();
					const plannedSources = layeredPlan.success ? (layeredPlan.manifest?.sources ?? []) : [];
					if (plannedSources.length > 1) {
						const layeredStart = await window.electronAPI.startLayeredCapture({
							sources: plannedSources,
						});
						layeredRecordingActive.current = layeredStart.success;
						if (layeredStart.success && layeredStart.manifest?.limitations.length) {
							toast.info("Layered recording has platform limitations.", {
								description: layeredStart.manifest.limitations[0],
							});
						}
					}
				} catch (layeredError) {
					console.warn("Unable to start layered capture planning:", layeredError);
					layeredRecordingActive.current = false;
				}
			}
			const usesMobileCamera = cameraSession.sourceType === "mobile";
			const usesMobileMicrophone = usesMobileCamera && microphoneEnabled;
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
				if (useWgcCapture && microphoneEnabled && !usesMobileMicrophone) {
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
						capturesMicrophone: microphoneEnabled && !usesMobileMicrophone,
						microphoneDeviceId: usesMobileMicrophone ? undefined : microphoneDeviceId,
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

					if (captureMode === "area" && effectiveSelectedArea) {
						// The outline stays only as a non-interactive highlight; otherwise remove it.
						if (recordingSettings?.highlightArea) {
							void window.electronAPI.lockAreaOverlay();
						} else {
							void window.electronAPI.closeAreaOverlay();
						}
					}

					if (!isResumingNative && webcamEnabled) {
						void startWebcamRecording();
						if (usesMobileMicrophone) {
							void startMobileMicrophoneRecording();
						}
					} else if (isResumingNative && webcamRecorder.current?.state === "paused") {
						webcamRecorder.current.resume();
						if (mobileMicrophoneRecorder.current?.state === "paused") {
							mobileMicrophoneRecorder.current.resume();
						}
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
						if (usesMobileMicrophone) {
							const mobileStream = await ensureWebcamStream();
							const mobileAudioTrack = mobileStream.getAudioTracks()[0];
							if (mobileAudioTrack) {
								microphoneStream.current = new MediaStream([mobileAudioTrack]);
							}
						} else {
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
						}
					} catch (audioError) {
						console.warn("Failed to get microphone access:", audioError);
						alert(
							"Microphone access was denied. Recording will continue without microphone audio.",
						);
						setMicrophoneEnabledState(false);
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

			const initialTrackSettings = videoTrack.getSettings();
			const sourceCaptureBounds = await resolveSourceCaptureBounds(selectedSource, {
				width: initialTrackSettings.width,
				height: initialTrackSettings.height,
			});
			// With an area, the profile limit applies to the cropped result, not the whole display.
			const areaScale = effectiveSelectedArea?.normalizedBounds;
			const targetCaptureDimensions = sourceCaptureBounds
				? resolveCaptureDimensions({
						sourceWidth: sourceCaptureBounds.width,
						sourceHeight: sourceCaptureBounds.height,
						maxWidth: Math.round(resolvedRecordingProfile.width / (areaScale?.width ?? 1)),
						maxHeight: Math.round(resolvedRecordingProfile.height / (areaScale?.height ?? 1)),
					})
				: null;

			try {
				await videoTrack.applyConstraints({
					frameRate: {
						ideal: resolvedRecordingProfile.frameRate,
						max: resolvedRecordingProfile.frameRate,
					},
					...(targetCaptureDimensions
						? {
								width: {
									ideal: targetCaptureDimensions.width,
									max: targetCaptureDimensions.width,
								},
								height: {
									ideal: targetCaptureDimensions.height,
									max: targetCaptureDimensions.height,
								},
							}
						: {}),
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

			await startChunkWriter(
				`${RECORDING_FILE_PREFIX}${Date.now()}${VIDEO_FILE_EXTENSION}`,
				screenChunkSessionId,
				screenChunkWriteChain,
				screenChunkWriteError,
				screenChunkCount,
			);
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
				if (event.data && event.data.size > 0) {
					queueChunkWrite(
						event.data,
						screenChunkSessionId,
						screenChunkWriteChain,
						screenChunkWriteError,
						screenChunkCount,
					);
				}
			};
			recorder.onstop = async () => {
				cleanupCapturedMedia();
				const pendingAction = pendingActionRef.current;
				browserSessionStopPending.current = false;

				const duration = Math.max(0, Date.now() - currentSegmentStartedAtRef.current);

				try {
					const videoPath = await finishChunkWriter(
						screenChunkSessionId,
						screenChunkWriteChain,
						screenChunkWriteError,
						screenChunkCount,
					);
					if (!videoPath) {
						return;
					}

					recordSegment(videoPath, duration);

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
					await discardChunkWriter(
						screenChunkSessionId,
						screenChunkWriteChain,
						screenChunkWriteError,
						screenChunkCount,
					);
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

			if (captureMode === "area" && effectiveSelectedArea) {
				// The outline stays only as a non-interactive highlight; otherwise remove it.
				if (recordingSettings?.highlightArea) {
					void window.electronAPI.lockAreaOverlay();
				} else {
					void window.electronAPI.closeAreaOverlay();
				}
			}

			if (webcamEnabled) {
				void startWebcamRecording();
			} else {
				await window.electronAPI.clearCurrentWebcamPath();
			}
		} catch (error) {
			playAppAudioCue("recording-error");
			console.error("Failed to start recording:", error);
			alert(
				error instanceof Error
					? `Failed to start recording: ${error.message}`
					: "Failed to start recording",
			);
			dispatchSession({ type: "reset" });
			cleanupCapturedMedia();
			await discardChunkWriter(
				screenChunkSessionId,
				screenChunkWriteChain,
				screenChunkWriteError,
				screenChunkCount,
			);
		} finally {
			startInFlight.current = false;
			setStarting(false);
		}
	}, [
		cleanupCapturedMedia,
		cameraSession.sourceType,
		discardChunkWriter,
		ensureWebcamStream,
		finishChunkWriter,
		getCaptureMode,
		getSelectedArea,
		microphoneDeviceId,
		microphoneEnabled,
		preparePermissions,
		queueChunkWrite,
		recordSegment,
		recordingSettings?.highlightArea,
		resolvedRecordingProfile.frameRate,
		resolvedRecordingProfile.height,
		resolvedRecordingProfile.preferHardwareEncoding,
		resolvedRecordingProfile.videoBitsPerSecond,
		resolvedRecordingProfile.width,
		resolveSourceCaptureBounds,
		resetSegmentBuffers,
		selectMimeType,
		startChunkWriter,
		startMobileMicrophoneRecording,
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
				const mobileMicrophoneSegment = await stopMobileMicrophoneRecording();
				const webcamSegment = await stopWebcamRecordingRef.current();
				if (layeredRecordingActive.current) {
					try {
						await window.electronAPI.stopLayeredCapture();
					} catch (layeredError) {
						console.warn("Unable to stop layered capture planning:", layeredError);
					} finally {
						layeredRecordingActive.current = false;
					}
				}
				const webcamSessionMetadata: PostRecordingContext["webcamSessionMetadata"] =
					cameraSession.enabled && webcamSegment
						? {
								sessionCaptureProfile: cameraSession.resolvedCaptureProfile ?? null,
								captureProfile: cameraSession.resolvedCaptureProfile ?? null,
								segmentProfiles: [cameraSession.resolvedCaptureProfile ?? null],
								segmentCompatibilityMode: "copy" as const,
								renderPipelineVersion: WEBCAM_RENDER_PIPELINE_VERSION,
							}
						: null;

				// Retake path: keep the old behavior (fully synchronous finalize) because we
				// immediately start a new recording and don't open the editor.
				if (nextAction === "retake") {
					const finalized = await window.electronAPI.finalizeRecordingSession({
						videoSegments: recordingSegmentsRef.current,
						webcamSegments: webcamSegment ? [webcamSegment] : [],
						microphoneSegments: mobileMicrophoneSegment
							? [...microphoneSegmentsRef.current, mobileMicrophoneSegment]
							: microphoneSegmentsRef.current,
						selectedArea,
						webcamSessionMetadata,
					});
					if (!finalized.success || !finalized.path) {
						throw new Error(finalized.error ?? finalized.message ?? "Failed to finalize session");
					}
					resetSegmentBuffers();
					await window.electronAPI.closeAreaOverlay();
					await window.electronAPI.setPostRecordingContext({
						action: recordingSettings?.afterRecordingAction ?? "create-project",
						openQuickShare: Boolean(recordingSettings?.openQuickShare),
						autoCreateZooms: Boolean(recordingSettings?.autoCreateZooms),
						recordingPath: finalized.path,
						webcamPath: webcamSegment?.path ?? null,
						webcamSessionMetadata: finalized.webcamSessionMetadata ?? webcamSessionMetadata ?? null,
						projectPath: null,
					} satisfies PostRecordingContext);
					pendingActionRef.current = null;
					dispatchSession({ type: "reset" });
					dispatchSession({ type: "clear-pending-action" });
					await startRecording();
					return;
				}

				// Optimistic stop path: kick off finalization in the background and
				// immediately hand the user off to the editor. The editor awaits the
				// finalized result via awaitRecordingFinalized().
				await window.electronAPI.triggerFinalizeRecordingSession({
					videoSegments: recordingSegmentsRef.current,
					webcamSegments: webcamSegment ? [webcamSegment] : [],
					microphoneSegments: mobileMicrophoneSegment
						? [...microphoneSegmentsRef.current, mobileMicrophoneSegment]
						: microphoneSegmentsRef.current,
					selectedArea,
					webcamSessionMetadata,
				});

				resetSegmentBuffers();
				// Seed the post-recording context now so the editor picks up user
				// preferences on mount. The main process will populate recordingPath
				// and webcamPath once finalization completes.
				await window.electronAPI.setPostRecordingContext({
					action: recordingSettings?.afterRecordingAction ?? "create-project",
					openQuickShare: Boolean(recordingSettings?.openQuickShare),
					autoCreateZooms: Boolean(recordingSettings?.autoCreateZooms),
					recordingPath: null,
					webcamPath: webcamSegment?.path ?? null,
					webcamSessionMetadata,
					projectPath: null,
				} satisfies PostRecordingContext);
				pendingActionRef.current = null;
				dispatchSession({ type: "reset" });
				dispatchSession({ type: "clear-pending-action" });

				// Open editor immediately. switchToEditor closes the current main
				// window (the HUD), so we don't need a separate hide step. Don't
				// await the area-overlay close — let it tear down in the background.
				void window.electronAPI.closeAreaOverlay();
				await window.electronAPI.switchToEditor();
			} finally {
				finalizingRecordingRef.current = false;
			}
		},
		[
			cameraSession.enabled,
			cameraSession.resolvedCaptureProfile,
			recordingSettings?.afterRecordingAction,
			recordingSettings?.autoCreateZooms,
			recordingSettings?.openQuickShare,
			resetSegmentBuffers,
			startRecording,
			stopMobileMicrophoneRecording,
		],
	);

	finalizeSessionRef.current = finalizeSession;

	const handleDiscardAction = useCallback(
		async (action: Exclude<PendingRecordingAction, "stop" | null>) => {
			const mobileMicrophoneSegment = await stopMobileMicrophoneRecording();
			const webcamSegment = await stopWebcamRecordingRef.current();
			await window.electronAPI.discardRecordingArtifacts({
				paths: [
					...recordingSegmentsRef.current.map((segment) => segment.path),
					...microphoneSegmentsRef.current.map((segment) => segment.path),
					...(mobileMicrophoneSegment?.path ? [mobileMicrophoneSegment.path] : []),
					...(webcamSegment?.path ? [webcamSegment.path] : []),
				],
				clearCurrentVideo: true,
				clearCurrentWebcam: true,
			});
			resetSegmentBuffers();
			if (recordingSettings?.highlightArea) {
				await window.electronAPI.closeAreaOverlay();
			}
			pendingActionRef.current = null;
			dispatchSession({ type: "reset" });
			dispatchSession({ type: "clear-pending-action" });
			if (action === "retake") {
				await startRecording();
			}
		},
		[
			recordingSettings?.highlightArea,
			resetSegmentBuffers,
			startRecording,
			stopMobileMicrophoneRecording,
		],
	);

	stopRecording.current = () => {
		void (async () => {
			dispatchSession({ type: "queue-stop" });
			pendingActionRef.current = "stop";

			if (nativeScreenRecording.current) {
				void playAppAudioCue("recording-stop");
				await stopActiveNativeSegment(false);
				await finalizeSessionRef.current("stop");
				return;
			}

			if (sessionRef.current.phase === "paused" && mediaRecorder.current == null) {
				void playAppAudioCue("recording-stop");
				await finalizeSessionRef.current("stop");
				return;
			}

			if (
				mediaRecorder.current?.state === "recording" ||
				mediaRecorder.current?.state === "paused"
			) {
				browserSessionStopPending.current = true;
				void playAppAudioCue("recording-stop");
				cleanupCapturedMedia();
				await window.electronAPI.setRecordingState(false);
				mediaRecorder.current.stop();
			}
		})().catch((error) => {
			playAppAudioCue("recording-error");
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
				if (mobileMicrophoneRecorder.current?.state === "recording") {
					mobileMicrophoneRecorder.current.pause();
				}
				dispatchSession({ type: "pause" });
				return;
			}

			if (sessionRef.current.phase === "paused") {
				await startRecording();
			}
		})().catch((error) => {
			console.error("Failed to toggle pause for native recording:", error);
		});
	}, [recording, starting, stopActiveNativeSegment, startRecording]);

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
			playAppAudioCue("recording-error");
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
			playAppAudioCue("recording-error");
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
				// Show the countdown on the display being recorded.
				const [area, source] = await Promise.all([
					window.electronAPI.getSelectedArea().catch(() => null),
					window.electronAPI.getSelectedSource().catch(() => null),
				]);
				const targetDisplayId =
					area?.success && area.area ? area.area.displayId : Number(source?.display_id);
				const result = await window.electronAPI.startCountdown(
					countdownDelay,
					Number.isFinite(targetDisplayId) ? targetDisplayId : undefined,
				);
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
		setMobileCameraEnabled,
		setCameraPreviewVisible,
		setCameraPreviewMirrored,
		setCameraPreviewSize,
		setCameraPreviewCorner,
		setCameraPreviewShape,
		cameraPreviewStream,
		mobileCaptureState,
		recordingBusy: starting || finalizingRecordingRef.current || browserSessionStopPending.current,
		sessionState,
	};
}
