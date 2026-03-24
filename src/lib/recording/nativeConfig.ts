import type { SelectedArea } from "./session";

export function buildNativeRecordingOptions(payload: {
	capturesSystemAudio: boolean;
	capturesMicrophone: boolean;
	microphoneDeviceId?: string;
	microphoneLabel?: string;
	selectedArea?: SelectedArea | null;
}) {
	return {
		capturesSystemAudio: payload.capturesSystemAudio,
		capturesMicrophone: payload.capturesMicrophone,
		microphoneDeviceId: payload.microphoneDeviceId,
		microphoneLabel: payload.microphoneLabel,
		selectedArea: payload.selectedArea ?? undefined,
	};
}
