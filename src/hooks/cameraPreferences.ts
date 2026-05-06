import {
	type CameraSessionState,
	DEFAULT_CAMERA_PREVIEW_CORNER,
	DEFAULT_CAMERA_PREVIEW_SHAPE,
	DEFAULT_CAMERA_PREVIEW_SIZE,
} from "@/components/video-editor/types";

export interface CameraPreferences extends CameraSessionState {}

export const CAMERA_PREFERENCES_STORAGE_KEY = "screenmint.camera.preferences";

export const DEFAULT_CAMERA_PREFERENCES: CameraPreferences = {
	enabled: false,
	sourceType: "local-device",
	deviceId: undefined,
	previewVisible: true,
	previewMirrored: true,
	previewSize: DEFAULT_CAMERA_PREVIEW_SIZE,
	previewCorner: DEFAULT_CAMERA_PREVIEW_CORNER,
	previewShape: DEFAULT_CAMERA_PREVIEW_SHAPE,
};

export function normalizeCameraPreferences(candidate: unknown): CameraPreferences {
	if (!candidate || typeof candidate !== "object") {
		return DEFAULT_CAMERA_PREFERENCES;
	}

	const raw = candidate as Partial<CameraPreferences>;

	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CAMERA_PREFERENCES.enabled,
		sourceType:
			raw.sourceType === "mobile" || raw.sourceType === "local-device"
				? raw.sourceType
				: DEFAULT_CAMERA_PREFERENCES.sourceType,
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
		previewSize:
			raw.previewSize === "small" || raw.previewSize === "large" || raw.previewSize === "medium"
				? raw.previewSize
				: DEFAULT_CAMERA_PREFERENCES.previewSize,
		previewCorner:
			raw.previewCorner === "top-left" ||
			raw.previewCorner === "top-right" ||
			raw.previewCorner === "bottom-left" ||
			raw.previewCorner === "bottom-right"
				? raw.previewCorner
				: DEFAULT_CAMERA_PREFERENCES.previewCorner,
		previewShape:
			raw.previewShape === "circle" || raw.previewShape === "rounded-rect"
				? raw.previewShape
				: DEFAULT_CAMERA_PREFERENCES.previewShape,
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
