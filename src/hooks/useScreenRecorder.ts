import { fixWebmDuration } from "@fix-webm-duration/fix";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CameraSessionState } from "@/components/video-editor/types";

const TARGET_FRAME_RATE = 60;
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;
const FOUR_K_PIXELS = TARGET_WIDTH * TARGET_HEIGHT;
const QHD_WIDTH = 2560;
const QHD_HEIGHT = 1440;
const QHD_PIXELS = QHD_WIDTH * QHD_HEIGHT;
const BITRATE_4K = 45_000_000;
const BITRATE_QHD = 28_000_000;
const BITRATE_BASE = 18_000_000;
const HIGH_FRAME_RATE_THRESHOLD = 60;
const HIGH_FRAME_RATE_BOOST = 1.7;
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

const WEBCAM_BITRATE = 4_000_000;

type UseScreenRecorderReturn = {
	recording: boolean;
	countdownActive: boolean;
	toggleRecording: () => void;
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
};

export function useScreenRecorder(): UseScreenRecorderReturn {
	const [recording, setRecording] = useState(false);
	const [starting, setStarting] = useState(false);
	const [countdownActive, setCountdownActive] = useState(false);
	const [isMacOS, setIsMacOS] = useState(false);
	const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
	const [microphoneDeviceId, setMicrophoneDeviceId] = useState<string | undefined>(undefined);
	const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
	const [countdownDelay, setCountdownDelayState] = useState(3);
	const [cameraSession, setCameraSession] = useState<CameraSessionState>({
		enabled: false,
		deviceId: undefined,
		previewVisible: true,
		previewMirrored: true,
	});
	const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
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
	const webcamEnabled = cameraSession.enabled;

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

	const selectMimeType = () => {
		const preferred = [
			"video/webm;codecs=av1",
			"video/webm;codecs=h264",
			"video/webm;codecs=vp9",
			"video/webm;codecs=vp8",
			"video/webm",
		];

		return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
	};

	const computeBitrate = (width: number, height: number) => {
		const pixels = width * height;
		const highFrameRateBoost =
			TARGET_FRAME_RATE >= HIGH_FRAME_RATE_THRESHOLD ? HIGH_FRAME_RATE_BOOST : 1;

		if (pixels >= FOUR_K_PIXELS) {
			return Math.round(BITRATE_4K * highFrameRateBoost);
		}

		if (pixels >= QHD_PIXELS) {
			return Math.round(BITRATE_QHD * highFrameRateBoost);
		}

		return Math.round(BITRATE_BASE * highFrameRateBoost);
	};

	const releaseWebcamStream = useCallback(() => {
		if (webcamStream.current) {
			webcamStream.current.getTracks().forEach((track) => track.stop());
			webcamStream.current = null;
		}

		setCameraPreviewStream(null);
	}, []);

	const setWebcamEnabled = useCallback(
		(enabled: boolean) => {
			setCameraSession((prev) => ({
				...prev,
				enabled,
				previewVisible: enabled ? prev.previewVisible : false,
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
				previewVisible: deviceId ? true : prev.previewVisible,
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
	const getWebcamConstraints = useCallback((): MediaStreamConstraints => {
		const baseVideo = {
			width: 1280,
			height: 720,
			frameRate: 30,
		};

		return cameraSession.deviceId
			? {
					video: {
						...baseVideo,
						deviceId: { exact: cameraSession.deviceId },
					},
					audio: false,
				}
			: {
					video: baseVideo,
					audio: false,
				};
	}, [cameraSession.deviceId]);

	const ensureWebcamStream = useCallback(async () => {
		if (webcamStream.current) {
			return webcamStream.current;
		}

		const camStream = await navigator.mediaDevices.getUserMedia(getWebcamConstraints());
		webcamStream.current = camStream;
		setCameraPreviewStream(cameraSession.previewVisible ? camStream : null);
		return camStream;
	}, [cameraSession.previewVisible, getWebcamConstraints]);

	const startWebcamRecording = useCallback(async () => {
		try {
			const camStream = await ensureWebcamStream();
			webcamChunks.current = [];

			const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
				? "video/webm;codecs=vp9"
				: "video/webm";

			const recorder = new MediaRecorder(camStream, {
				mimeType,
				videoBitsPerSecond: WEBCAM_BITRATE,
			});
			webcamRecorder.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) webcamChunks.current.push(event.data);
			};
			recorder.start(RECORDER_TIMESLICE_MS);
		} catch (error) {
			console.warn("Failed to start webcam recording:", error);
			await window.electronAPI.clearCurrentWebcamPath();
			setCameraSession((prev) => ({ ...prev, enabled: false, previewVisible: false }));
			setCameraPreviewStream(null);
			toast.error("Unable to access the selected camera. Recording will continue without webcam.");
		}
	}, [ensureWebcamStream]);

	const stopWebcamRecording = useCallback(async () => {
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
			return;
		}

		const duration = Date.now() - startTime.current;
		const buggyBlob = new Blob(webcamChunks.current, { type: mimeType });
		webcamChunks.current = [];

		try {
			const webcamBlob = await fixWebmDuration(buggyBlob, duration);
			const arrayBuffer = await webcamBlob.arrayBuffer();
			const webcamFileName = `${WEBCAM_FILE_PREFIX}${Date.now()}${VIDEO_FILE_EXTENSION}`;
			const result = await window.electronAPI.storeRecordedVideo(arrayBuffer, webcamFileName);
			if (result.success && result.path) {
				await window.electronAPI.setCurrentWebcamPath(result.path);
			}
		} catch (error) {
			console.error("Error saving webcam recording:", error);
			await window.electronAPI.clearCurrentWebcamPath();
		}

		webcamRecorder.current = null;
	}, [releaseWebcamStream]);

	const stopRecording = useRef(() => {
		if (nativeScreenRecording.current) {
			nativeScreenRecording.current = false;
			setRecording(false);

			void (async () => {
				const isWgc = wgcRecording.current;
				wgcRecording.current = false;

				const result = await window.electronAPI.stopNativeScreenRecording();
				window.electronAPI?.setRecordingState(false);

				if (!result.success || !result.path) {
					console.error("Failed to stop native screen recording:", result.error ?? result.message);
					return;
				}

				let finalPath = result.path;

				if (isWgc) {
					const muxResult = await window.electronAPI.muxWgcRecording();
					finalPath = muxResult?.path ?? result.path;
				}

				await stopWebcamRecording();
				await window.electronAPI.setCurrentVideoPath(finalPath);
				await window.electronAPI.switchToEditor();
			})();
			return;
		}

		if (mediaRecorder.current?.state === "recording") {
			cleanupCapturedMedia();
			mediaRecorder.current.stop();
			setRecording(false);
			window.electronAPI?.setRecordingState(false);
			// Webcam stop is handled inside recorder.onstop before switchToEditor
		}
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
				setCameraSession((prev) => ({ ...prev, enabled: false, previewVisible: false }));
				setCameraPreviewStream(null);
			});

		return () => {
			cancelled = true;
		};
	}, [cameraSession.enabled, cameraSession.previewVisible, ensureWebcamStream, releaseWebcamStream]);

	useEffect(() => {
		let cleanup: (() => void) | undefined;

		if (window.electronAPI?.onStopRecordingFromTray) {
			cleanup = window.electronAPI.onStopRecordingFromTray(() => {
				stopRecording.current();
			});
		}

		const removeRecordingStateListener = window.electronAPI?.onRecordingStateChanged?.((state) => {
			setRecording(state.recording);
		});

		const removeRecordingInterruptedListener = window.electronAPI?.onRecordingInterrupted?.(
			(state) => {
				setRecording(false);
				nativeScreenRecording.current = false;
				cleanupCapturedMedia();
				void window.electronAPI.setRecordingState(false);

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
			removeRecordingStateListener?.();
			removeRecordingInterruptedListener?.();

			if (nativeScreenRecording.current) {
				nativeScreenRecording.current = false;
				void window.electronAPI.stopNativeScreenRecording();
			}

			if (mediaRecorder.current?.state === "recording") {
				mediaRecorder.current.stop();
			}

			cleanupCapturedMedia();
		};
	}, [cleanupCapturedMedia]);

	const startRecording = async () => {
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

				const nativeResult = await window.electronAPI.startNativeScreenRecording(selectedSource, {
					capturesSystemAudio: systemAudioEnabled,
					capturesMicrophone: microphoneEnabled,
					microphoneDeviceId,
					microphoneLabel: micLabel,
				});
				if (!nativeResult.success) {
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
					startTime.current = Date.now();
					setRecording(true);
					window.electronAPI?.setRecordingState(true);

					if (webcamEnabled) {
						void startWebcamRecording();
					} else {
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
						maxWidth: TARGET_WIDTH,
						maxHeight: TARGET_HEIGHT,
						maxFrameRate: TARGET_FRAME_RATE,
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
						width: { ideal: TARGET_WIDTH, max: TARGET_WIDTH },
						height: { ideal: TARGET_HEIGHT, max: TARGET_HEIGHT },
						frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
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
					frameRate: { ideal: TARGET_FRAME_RATE, max: TARGET_FRAME_RATE },
					width: { ideal: TARGET_WIDTH, max: TARGET_WIDTH },
					height: { ideal: TARGET_HEIGHT, max: TARGET_HEIGHT },
				} as MediaTrackConstraints);
			} catch (error) {
				console.warn(
					"Unable to lock 4K/60fps constraints, using best available track settings.",
					error,
				);
			}

			let {
				width = DEFAULT_WIDTH,
				height = DEFAULT_HEIGHT,
				frameRate = TARGET_FRAME_RATE,
			} = videoTrack.getSettings();

			width = Math.floor(width / CODEC_ALIGNMENT) * CODEC_ALIGNMENT;
			height = Math.floor(height / CODEC_ALIGNMENT) * CODEC_ALIGNMENT;

			const videoBitsPerSecond = computeBitrate(width, height);
			const mimeType = selectMimeType();

			console.log(
				`Recording at ${width}x${height} @ ${frameRate ?? TARGET_FRAME_RATE}fps using ${mimeType} / ${Math.round(
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
				if (chunks.current.length === 0) return;

				const duration = Date.now() - startTime.current;
				const recordedChunks = chunks.current;
				const buggyBlob = new Blob(recordedChunks, { type: mimeType });
				chunks.current = [];
				const timestamp = Date.now();
				const videoFileName = `${RECORDING_FILE_PREFIX}${timestamp}${VIDEO_FILE_EXTENSION}`;

				try {
					const videoBlob = await fixWebmDuration(buggyBlob, duration);
					const arrayBuffer = await videoBlob.arrayBuffer();
					const videoResult = await window.electronAPI.storeRecordedVideo(
						arrayBuffer,
						videoFileName,
					);
					if (!videoResult.success) {
						console.error("Failed to store video:", videoResult.message);
						return;
					}

					if (videoResult.path) {
						await window.electronAPI.setCurrentVideoPath(videoResult.path);
					}

					await stopWebcamRecording();
					await window.electronAPI.switchToEditor();
				} catch (error) {
					console.error("Error saving recording:", error);
				}
			};
			recorder.onerror = () => {
				setRecording(false);
			};
			recorder.start(RECORDER_TIMESLICE_MS);
			startTime.current = Date.now();
			setRecording(true);
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
			setRecording(false);
			cleanupCapturedMedia();
		} finally {
			startInFlight.current = false;
			setStarting(false);
		}
	};

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
		countdownActive,
		toggleRecording,
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
	};
}
