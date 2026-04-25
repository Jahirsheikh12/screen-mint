export type RecordingQuality = "auto" | "high" | "medium";
export type RecordingFrameRate = 30 | 60;

export interface RecordingRuntimeSettings {
	recordingQuality: RecordingQuality;
	recordingFps: RecordingFrameRate;
	hardwareAcceleration: boolean;
}

export interface RecordingTargetProfile {
	width: number;
	height: number;
	videoBitsPerSecond: number;
	frameRate: RecordingFrameRate;
	preferHardwareEncoding: boolean;
}

const BITRATE_4K = 45_000_000;
const BITRATE_QHD = 28_000_000;
const BITRATE_FHD = 18_000_000;
const BITRATE_HD = 10_000_000;
const HIGH_FRAME_RATE_BOOST = 1.7;

export const DEFAULT_RECORDING_RUNTIME_SETTINGS: RecordingRuntimeSettings = {
	recordingQuality: "auto",
	recordingFps: 30,
	hardwareAcceleration: true,
};

function computeBitrate(width: number, height: number, frameRate: RecordingFrameRate): number {
	const pixels = width * height;
	const highFrameRateBoost = frameRate >= 60 ? HIGH_FRAME_RATE_BOOST : 1;

	if (pixels >= 3840 * 2160) {
		return Math.round(BITRATE_4K * highFrameRateBoost);
	}

	if (pixels >= 2560 * 1440) {
		return Math.round(BITRATE_QHD * highFrameRateBoost);
	}

	if (pixels >= 1920 * 1080) {
		return Math.round(BITRATE_FHD * highFrameRateBoost);
	}

	return Math.round(BITRATE_HD * highFrameRateBoost);
}

export function resolveRecordingTargetProfile(
	settings: Partial<RecordingRuntimeSettings> | null | undefined,
): RecordingTargetProfile {
	const merged: RecordingRuntimeSettings = {
		...DEFAULT_RECORDING_RUNTIME_SETTINGS,
		...(settings ?? {}),
	};

	const dimensions =
		merged.recordingQuality === "medium"
			? { width: 1280, height: 720 }
			: merged.recordingQuality === "high"
				? { width: 2560, height: 1440 }
				: { width: 2560, height: 1440 };

	return {
		...dimensions,
		frameRate: merged.recordingFps,
		videoBitsPerSecond: computeBitrate(dimensions.width, dimensions.height, merged.recordingFps),
		preferHardwareEncoding: merged.hardwareAcceleration,
	};
}
