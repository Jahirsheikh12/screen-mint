import { useCallback, useEffect, useRef, useState } from "react";
import type { AfterRecordingAction } from "@/lib/recording/postRecording";
import {
	DEFAULT_RECORDING_RUNTIME_SETTINGS,
	type RecordingFrameRate,
	type RecordingQuality,
} from "@/lib/recording/runtimeConfig";
import type { SelectedArea } from "@/lib/recording/session";
import { useAudioLevelMeter } from "./useAudioLevelMeter";
import { useMicrophoneDevices } from "./useMicrophoneDevices";
import { useScreenRecorder } from "./useScreenRecorder";

export type HudMode = "display" | "window" | "area" | "device";

export type HudSettings = {
	hiddenFromCapture: boolean;
	hideDesktopIcons: boolean;
	hideDockIcon: boolean;
	highlightArea: boolean;
	openQuickShare: boolean;
	speakerNotesEnabled: boolean;
	speakerNotesText: string;
	afterRecordingAction: AfterRecordingAction;
	countdownDelay: number;
	autoCreateZooms: boolean;
	recordingQuality: RecordingQuality;
	recordingFps: RecordingFrameRate;
	hardwareAcceleration: boolean;
};

export type { AfterRecordingAction };

export const DEFAULT_HUD_SETTINGS: HudSettings = {
	hiddenFromCapture: true,
	hideDesktopIcons: false,
	hideDockIcon: false,
	highlightArea: true,
	openQuickShare: false,
	speakerNotesEnabled: false,
	speakerNotesText: "",
	afterRecordingAction: "create-project",
	countdownDelay: 0,
	autoCreateZooms: true,
	recordingQuality: DEFAULT_RECORDING_RUNTIME_SETTINGS.recordingQuality,
	recordingFps: DEFAULT_RECORDING_RUNTIME_SETTINGS.recordingFps,
	hardwareAcceleration: DEFAULT_RECORDING_RUNTIME_SETTINGS.hardwareAcceleration,
};

const VALID_AFTER_RECORDING_ACTIONS: AfterRecordingAction[] = [
	"create-project",
	"export-clipboard",
	"export-share-link",
	"export-save-file",
];
const VALID_COUNTDOWN_DELAYS = new Set([0, 3, 5, 10]);

function pickBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function pickString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function pickAfterRecordingAction(value: unknown): AfterRecordingAction {
	return typeof value === "string" &&
		VALID_AFTER_RECORDING_ACTIONS.includes(value as AfterRecordingAction)
		? (value as AfterRecordingAction)
		: DEFAULT_HUD_SETTINGS.afterRecordingAction;
}

function pickRecordingQuality(value: unknown): RecordingQuality {
	return value === "auto" || value === "high" || value === "medium"
		? value
		: DEFAULT_HUD_SETTINGS.recordingQuality;
}

function pickRecordingFrameRate(value: unknown): RecordingFrameRate {
	return value === 60 || value === "60" ? 60 : DEFAULT_HUD_SETTINGS.recordingFps;
}

function pickCountdownDelay(value: unknown): number {
	const numeric = typeof value === "string" ? Number(value) : value;
	return typeof numeric === "number" &&
		Number.isFinite(numeric) &&
		VALID_COUNTDOWN_DELAYS.has(numeric)
		? numeric
		: DEFAULT_HUD_SETTINGS.countdownDelay;
}

export function resolveHudSettings(
	settings: Record<string, unknown> | null | undefined,
): HudSettings {
	const raw = settings ?? {};
	return {
		hiddenFromCapture: pickBoolean(raw.hiddenFromCapture, DEFAULT_HUD_SETTINGS.hiddenFromCapture),
		hideDesktopIcons: pickBoolean(raw.hideDesktopIcons, DEFAULT_HUD_SETTINGS.hideDesktopIcons),
		hideDockIcon: pickBoolean(raw.hideDockIcon, DEFAULT_HUD_SETTINGS.hideDockIcon),
		highlightArea: pickBoolean(raw.highlightArea, DEFAULT_HUD_SETTINGS.highlightArea),
		openQuickShare: pickBoolean(raw.openQuickShare, DEFAULT_HUD_SETTINGS.openQuickShare),
		speakerNotesEnabled: pickBoolean(
			raw.speakerNotesEnabled,
			DEFAULT_HUD_SETTINGS.speakerNotesEnabled,
		),
		speakerNotesText: pickString(raw.speakerNotesText, DEFAULT_HUD_SETTINGS.speakerNotesText),
		afterRecordingAction: pickAfterRecordingAction(raw.afterRecordingAction),
		countdownDelay: pickCountdownDelay(raw.countdownDelay),
		autoCreateZooms: pickBoolean(raw.autoCreateZooms, DEFAULT_HUD_SETTINGS.autoCreateZooms),
		recordingQuality: pickRecordingQuality(raw.recordingQuality),
		recordingFps: pickRecordingFrameRate(raw.recordingFps),
		hardwareAcceleration: pickBoolean(
			raw.hardwareAcceleration,
			DEFAULT_HUD_SETTINGS.hardwareAcceleration,
		),
	};
}

export type CameraDeviceOption = {
	deviceId: string;
	label: string;
};

function selectedAreasEqual(left: SelectedArea | null, right: SelectedArea | null): boolean {
	if (left === right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return (
		left.displayId === right.displayId &&
		left.bounds.x === right.bounds.x &&
		left.bounds.y === right.bounds.y &&
		left.bounds.width === right.bounds.width &&
		left.bounds.height === right.bounds.height &&
		left.normalizedBounds.x === right.normalizedBounds.x &&
		left.normalizedBounds.y === right.normalizedBounds.y &&
		left.normalizedBounds.width === right.normalizedBounds.width &&
		left.normalizedBounds.height === right.normalizedBounds.height
	);
}

export function useHudState() {
	const [hudSettings, setHudSettingsState] = useState<HudSettings>(DEFAULT_HUD_SETTINGS);
	const screenRecorder = useScreenRecorder({
		recordingQuality: hudSettings.recordingQuality,
		recordingFps: hudSettings.recordingFps,
		hardwareAcceleration: hudSettings.hardwareAcceleration,
		afterRecordingAction: hudSettings.afterRecordingAction,
		openQuickShare: hudSettings.openQuickShare,
		autoCreateZooms: hudSettings.autoCreateZooms,
		highlightArea: hudSettings.highlightArea,
	});
	const [mode, setMode] = useState<HudMode>("display");
	const [platform, setPlatform] = useState<string | null>(null);
	const [selectedSource, setSelectedSource] = useState("Screen");
	const [hasSelectedSource, setHasSelectedSource] = useState(false);
	const [selectedArea, setSelectedAreaState] = useState<SelectedArea | null>(null);
	const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([]);
	const [contentPanelVisible, setContentPanelVisible] = useState(false);
	const settingsLoaded = useRef(false);

	const showMicControls = screenRecorder.microphoneEnabled && !screenRecorder.recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		screenRecorder.microphoneEnabled,
	);
	const { level } = useAudioLevelMeter({
		enabled: showMicControls,
		deviceId: screenRecorder.microphoneDeviceId,
	});

	// Load platform
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const p = await window.electronAPI.getPlatform();
				if (!cancelled) setPlatform(p);
			} catch {
				// ignore
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Load HUD settings
	useEffect(() => {
		if (settingsLoaded.current) return;
		settingsLoaded.current = true;

		void (async () => {
			try {
				const result = await window.electronAPI.getHudSettings();
				if (result.success && result.settings) {
					setHudSettingsState(resolveHudSettings(result.settings));
				}
			} catch {
				// Use defaults
			}
		})();
	}, []);

	// Reposition HUD onto cursor's display + auto-select that display as the
	// default capture source so the user can record their current screen
	// without opening the source picker.
	useEffect(() => {
		void window.electronAPI.recenterHudOnCursor?.();
		void window.electronAPI.autoSelectCursorDisplay?.();
	}, []);

	useEffect(() => {
		void window.electronAPI.setHudOverlayCaptureProtection(hudSettings.hiddenFromCapture);
	}, [hudSettings.hiddenFromCapture]);

	useEffect(() => {
		if (!screenRecorder.recording) {
			void window.electronAPI.showDesktopIcons?.();
			void window.electronAPI.showDockIcon?.();
			void window.electronAPI.closeSpeakerNotesWindow?.();
			return;
		}

		if (hudSettings.hideDesktopIcons && platform !== "linux") {
			void window.electronAPI.hideDesktopIcons?.();
		}

		if (hudSettings.hideDockIcon) {
			void window.electronAPI.hideDockIcon?.();
		}

		if (hudSettings.speakerNotesEnabled) {
			void window.electronAPI.openSpeakerNotesWindow({ text: hudSettings.speakerNotesText });
		}
	}, [
		hudSettings.hideDesktopIcons,
		hudSettings.hideDockIcon,
		hudSettings.speakerNotesEnabled,
		hudSettings.speakerNotesText,
		platform,
		screenRecorder.recording,
	]);

	useEffect(() => {
		if (!screenRecorder.recording || !hudSettings.speakerNotesEnabled) {
			return;
		}

		void window.electronAPI.updateSpeakerNotesWindow?.({
			text: hudSettings.speakerNotesText,
		});
	}, [hudSettings.speakerNotesEnabled, hudSettings.speakerNotesText, screenRecorder.recording]);

	// Poll selected source
	useEffect(() => {
		const checkSelectedSource = async () => {
			if (window.electronAPI) {
				const source = await window.electronAPI.getSelectedSource();
				if (source) {
					setSelectedSource(source.name);
					setHasSelectedSource(true);
				} else {
					setSelectedSource("Screen");
					setHasSelectedSource(false);
				}
			}
		};

		void checkSelectedSource();
		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const checkSelectedArea = async () => {
			const result = await window.electronAPI.getSelectedArea();
			if (result.success) {
				setSelectedAreaState((current) => {
					const next = result.area ?? null;
					return selectedAreasEqual(current, next) ? current : next;
				});
			}
		};

		void checkSelectedArea();
		const interval = setInterval(checkSelectedArea, 500);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const unsubscribe = window.electronAPI.onSelectedAreaChanged(({ area }) => {
			setSelectedAreaState((current) => (selectedAreasEqual(current, area) ? current : area));
		});

		return () => unsubscribe();
	}, []);

	// Refresh camera devices
	const refreshCameraDevices = useCallback(async () => {
		try {
			const devs = await navigator.mediaDevices.enumerateDevices();
			const videoInputs = devs
				.filter((device) => device.kind === "videoinput")
				.map((device, index) => ({
					deviceId: device.deviceId,
					label: device.label.trim() || `Camera ${index + 1}`,
				}));
			setCameraDevices(videoInputs);
		} catch {
			setCameraDevices([]);
		}
	}, []);

	useEffect(() => {
		void refreshCameraDevices();
		const handleDeviceChange = () => void refreshCameraDevices();
		navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
		return () => {
			navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
		};
	}, [refreshCameraDevices]);

	useEffect(() => {
		if (screenRecorder.cameraSession.enabled) {
			void refreshCameraDevices();
		}
	}, [screenRecorder.cameraSession.enabled, refreshCameraDevices]);

	const updateHudSettings = useCallback(
		(update: Partial<HudSettings>) => {
			setHudSettingsState((prev) => {
				const next = { ...prev, ...update };
				void window.electronAPI.setHudSettings(next);
				if (typeof update.countdownDelay === "number") {
					void screenRecorder.setCountdownDelay(update.countdownDelay);
				}
				return next;
			});
		},
		[screenRecorder],
	);

	const setSelectedArea = useCallback(async (area: SelectedArea | null) => {
		const result = await window.electronAPI.setSelectedArea(area);
		if (result.success) {
			setSelectedAreaState(result.area ?? null);
		}
	}, []);

	const clearSelectedArea = useCallback(async () => {
		await window.electronAPI.clearSelectedArea();
		setSelectedAreaState(null);
	}, []);

	// Toggle overlay: expands/shrinks the HUD window via IPC
	const resizeHudWindow = useCallback((contentVisible: boolean) => {
		setContentPanelVisible(contentVisible);
		void window.electronAPI.resizeHudWindow(contentVisible);
	}, []);

	return {
		// Screen recorder passthrough
		...screenRecorder,
		// HUD-specific state
		mode,
		setMode,
		hudSettings,
		updateHudSettings,
		platform,
		selectedSource,
		hasSelectedSource,
		selectedArea,
		hasSelectedArea: selectedArea != null,
		setSelectedArea,
		clearSelectedArea,
		cameraDevices,
		contentPanelVisible,
		setContentPanelVisible,
		resizeHudWindow,
		supportsSpeakerNotes: platform !== null,
		supportsHideDesktopIcons: platform === "darwin",
		supportsHideDockIcon: platform === "darwin",
		supportsDeviceCapture: false,
		// Mic controls
		showMicControls,
		micDevices: devices,
		selectedMicDeviceId: selectedDeviceId,
		setSelectedMicDeviceId: setSelectedDeviceId,
		audioLevel: level,
		refreshCameraDevices,
	};
}
