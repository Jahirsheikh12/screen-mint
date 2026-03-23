import type { CameraSessionState } from "@/components/video-editor/types";

export interface CameraPreferences extends CameraSessionState {}

export const CAMERA_PREFERENCES_STORAGE_KEY = "screenmint.camera.preferences";

export const DEFAULT_CAMERA_PREFERENCES: CameraPreferences = {
	enabled: false,
	deviceId: undefined,
	previewVisible: true,
	previewMirrored: true,
};

export function normalizeCameraPreferences(candidate: unknown): CameraPreferences {
	if (!candidate || typeof candidate !== "object") {
		return DEFAULT_CAMERA_PREFERENCES;
	}

	const raw = candidate as Partial<CameraPreferences>;

	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CAMERA_PREFERENCES.enabled,
		deviceId:
			typeof raw.deviceId === "string" && raw.deviceId.trim().length > 0 ? raw.deviceId : undefined,
		previewVisible:
			typeof raw.previewVisible === "boolean"
				? raw.previewVisible
				: DEFAULT_CAMERA_PREFERENCES.previewVisible,
		previewMirrored:
			typeof raw.previewMirrored === "boolean"
				? raw.previewMirrored
				: DEFAULT_CAMERA_PREFERENCES.previewMirrored,
	};
}

export function loadCameraPreferences(): CameraPreferences {
	if (typeof globalThis.localStorage === "undefined") {
		return DEFAULT_CAMERA_PREFERENCES;
	}

	try {
		const stored = globalThis.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY);
		if (!stored) {
			return DEFAULT_CAMERA_PREFERENCES;
		}

		const normalized = normalizeCameraPreferences(JSON.parse(stored));
		globalThis.localStorage.setItem(CAMERA_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
		return normalized;
	} catch {
		return DEFAULT_CAMERA_PREFERENCES;
	}
}

export function saveCameraPreferences(preferences: Partial<CameraPreferences>): void {
	if (typeof globalThis.localStorage === "undefined") {
		return;
	}

	try {
		const current = loadCameraPreferences();
		const next = normalizeCameraPreferences({ ...current, ...preferences });
		globalThis.localStorage.setItem(CAMERA_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Ignore storage failures so camera controls still work.
	}
}
