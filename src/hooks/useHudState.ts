import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedArea } from "@/lib/recording/session";
import { useAudioLevelMeter } from "./useAudioLevelMeter";
import { useMicrophoneDevices } from "./useMicrophoneDevices";
import { useScreenRecorder } from "./useScreenRecorder";

export type HudMode = "display" | "window" | "area" | "device";

export type AfterRecordingAction =
	| "create-project"
	| "export-clipboard"
	| "export-share-link"
	| "export-save-file";

export type HudSettings = {
	hiddenFromCapture: boolean;
	hideDesktopIcons: boolean;
	hideDockIcon: boolean;
	highlightArea: boolean;
	openQuickShare: boolean;
	afterRecordingAction: AfterRecordingAction;
	countdownDelay: number;
	autoCreateZooms: boolean;
	recordingQuality: "auto" | "high" | "medium";
	recordingFps: 30 | 60;
	hardwareAcceleration: boolean;
};

const DEFAULT_SETTINGS: HudSettings = {
	hiddenFromCapture: true,
	hideDesktopIcons: false,
	hideDockIcon: false,
	highlightArea: false,
	openQuickShare: false,
	afterRecordingAction: "create-project",
	countdownDelay: 0,
	autoCreateZooms: false,
	recordingQuality: "auto",
	recordingFps: 60,
	hardwareAcceleration: true,
};

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
	const screenRecorder = useScreenRecorder();
	const [mode, setMode] = useState<HudMode>("display");
	const [hudSettings, setHudSettingsState] = useState<HudSettings>(DEFAULT_SETTINGS);
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
					setHudSettingsState((prev) => ({ ...prev, ...result.settings }));
				}
			} catch {
				// Use defaults
			}
		})();
	}, []);

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

	const updateHudSettings = useCallback((update: Partial<HudSettings>) => {
		setHudSettingsState((prev) => {
			const next = { ...prev, ...update };
			void window.electronAPI.setHudSettings(next);
			return next;
		});
	}, []);

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
		// Mic controls
		showMicControls,
		micDevices: devices,
		selectedMicDeviceId: selectedDeviceId,
		setSelectedMicDeviceId: setSelectedDeviceId,
		audioLevel: level,
		refreshCameraDevices,
	};
}
