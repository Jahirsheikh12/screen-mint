import type { SelectedArea } from "./session";

export function buildNativeRecordingOptions(payload: {
	capturesSystemAudio: boolean;
	capturesMicrophone: boolean;
	microphoneDeviceId?: string;
	microphoneLabel?: string;
	selectedArea?: SelectedArea | null;
	recordingFps?: number;
	recordingWidth?: number;
	recordingHeight?: number;
	videoBitsPerSecond?: number;
	hardwareAcceleration?: boolean;
}) {
	return {
		capturesSystemAudio: payload.capturesSystemAudio,
		capturesMicrophone: payload.capturesMicrophone,
		microphoneDeviceId: payload.microphoneDeviceId,
		microphoneLabel: payload.microphoneLabel,
		selectedArea: payload.selectedArea ?? undefined,
		recordingFps: payload.recordingFps,
		recordingWidth: payload.recordingWidth,
		recordingHeight: payload.recordingHeight,
		videoBitsPerSecond: payload.videoBitsPerSecond,
		hardwareAcceleration: payload.hardwareAcceleration,
	};
}
