import type { WebcamCaptureProfile } from "@/components/video-editor/types";

export interface WebcamConstraintProfile {
	width: number;
	height: number;
	frameRate: number;
}

const DEFAULT_FALLBACK_FRAME_RATE = 30;
const MIN_WEBCAM_BITRATE = 4_000_000;
const MAX_WEBCAM_BITRATE = 20_000_000;
const WEBCAM_BITS_PER_PIXEL = 0.09;

const HIGH_FPS_PROFILES: WebcamConstraintProfile[] = [
	{ width: 1920, height: 1080, frameRate: 60 },
	{ width: 1280, height: 720, frameRate: 60 },
	{ width: 1920, height: 1080, frameRate: 30 },
	{ width: 1280, height: 720, frameRate: 30 },
];

const STANDARD_FPS_PROFILES: WebcamConstraintProfile[] = [
	{ width: 1920, height: 1080, frameRate: 30 },
	{ width: 1280, height: 720, frameRate: 30 },
	{ width: 1920, height: 1080, frameRate: 60 },
	{ width: 1280, height: 720, frameRate: 60 },
];

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function getPreferredWebcamProfiles(requestedRecordingFps: number): WebcamConstraintProfile[] {
	return requestedRecordingFps >= 60 ? HIGH_FPS_PROFILES : STANDARD_FPS_PROFILES;
}

export function buildWebcamConstraintCandidates(
	requestedRecordingFps: number,
	deviceConstraint: MediaTrackConstraints = {},
): MediaTrackConstraints[] {
	const candidates = getPreferredWebcamProfiles(requestedRecordingFps).map((profile) => ({
		...deviceConstraint,
		width: { ideal: profile.width },
		height: { ideal: profile.height },
		aspectRatio: { ideal: profile.width / profile.height },
		frameRate: { ideal: profile.frameRate, max: profile.frameRate },
	}));

	return [
		...candidates,
		{
			...deviceConstraint,
			frameRate: {
				ideal: requestedRecordingFps >= 60 ? 60 : DEFAULT_FALLBACK_FRAME_RATE,
				max: requestedRecordingFps >= 60 ? 60 : DEFAULT_FALLBACK_FRAME_RATE,
			},
		},
		{
			...deviceConstraint,
		},
	];
}

export function resolveWebcamCaptureProfile(
	settings: MediaTrackSettings | undefined,
): WebcamCaptureProfile | undefined {
	const width = settings?.width;
	const height = settings?.height;
	if (!width || !height) {
		return undefined;
	}

	const frameRate =
		typeof settings?.frameRate === "number" && Number.isFinite(settings.frameRate)
			? Math.max(DEFAULT_FALLBACK_FRAME_RATE, Math.round(settings.frameRate))
			: DEFAULT_FALLBACK_FRAME_RATE;

	return {
		width,
		height,
		frameRate,
		aspectRatio: width / height,
	};
}

export function getWebcamRecorderBitrate(settings: MediaTrackSettings | undefined): number {
	const profile = resolveWebcamCaptureProfile(settings);
	const width = profile?.width ?? 1280;
	const height = profile?.height ?? 720;
	const frameRate = profile?.frameRate ?? DEFAULT_FALLBACK_FRAME_RATE;

	return clamp(
		Math.round(width * height * Math.max(frameRate, DEFAULT_FALLBACK_FRAME_RATE) * WEBCAM_BITS_PER_PIXEL),
		MIN_WEBCAM_BITRATE,
		MAX_WEBCAM_BITRATE,
	);
}
