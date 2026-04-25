import { describe, expect, it } from "vitest";
import {
	buildWebcamConstraintCandidates,
	getPreferredWebcamProfiles,
	getPreferredWebcamRecorderMimeTypes,
	getWebcamRecorderBitrate,
	resolveWebcamCaptureProfile,
	selectSupportedWebcamRecorderMimeType,
} from "./webcamCapture";

describe("webcamCapture", () => {
	it("prefers 60fps webcam profiles for 60fps recordings", () => {
		expect(getPreferredWebcamProfiles(60)).toEqual([
			{ width: 1280, height: 720, frameRate: 60 },
			{ width: 1280, height: 720, frameRate: 30 },
			{ width: 1920, height: 1080, frameRate: 60 },
			{ width: 1920, height: 1080, frameRate: 30 },
		]);
	});

	it("uses 720p30-first webcam profiles for balanced 30fps recordings", () => {
		expect(getPreferredWebcamProfiles(30)).toEqual([
			{ width: 1280, height: 720, frameRate: 30 },
			{ width: 1920, height: 1080, frameRate: 30 },
			{ width: 1280, height: 720, frameRate: 60 },
			{ width: 1920, height: 1080, frameRate: 60 },
		]);
	});

	it("builds ordered constraint candidates with device constraints first", () => {
		const candidates = buildWebcamConstraintCandidates(60, {
			deviceId: { exact: "camera-1" },
		});

		expect(candidates[0]).toMatchObject({
			deviceId: { exact: "camera-1" },
			width: { ideal: 1280 },
			height: { ideal: 720 },
			frameRate: { ideal: 60, min: 50, max: 60 },
		});
		expect(candidates[4]).toMatchObject({
			deviceId: { exact: "camera-1" },
			frameRate: { ideal: 60, min: 50, max: 60 },
		});
		expect(candidates[5]).toMatchObject({
			deviceId: { exact: "camera-1" },
		});
	});

	it("prefers cheaper realtime webcam codecs before vp9", () => {
		expect(getPreferredWebcamRecorderMimeTypes(true)).toEqual([
			"video/webm;codecs=h264",
			"video/webm;codecs=vp8",
			"video/webm;codecs=vp9",
			"video/webm",
		]);
		expect(getPreferredWebcamRecorderMimeTypes(false)).toEqual([
			"video/webm;codecs=vp8",
			"video/webm;codecs=h264",
			"video/webm;codecs=vp9",
			"video/webm",
		]);
	});

	it("selects the first supported smoother webcam recorder mime type", () => {
		const supported = new Set(["video/webm;codecs=vp8", "video/webm"]);

		expect(selectSupportedWebcamRecorderMimeType((mimeType) => supported.has(mimeType), true)).toBe(
			"video/webm;codecs=vp8",
		);
	});

	it("derives a resolved webcam capture profile from track settings", () => {
		expect(
			resolveWebcamCaptureProfile({
				width: 1920,
				height: 1080,
				frameRate: 59.94,
			}),
		).toEqual({
			width: 1920,
			height: 1080,
			frameRate: 60,
			aspectRatio: 1920 / 1080,
		});
	});

	it("scales recorder bitrate with actual frame rate", () => {
		const bitrate30 = getWebcamRecorderBitrate({
			width: 1920,
			height: 1080,
			frameRate: 30,
		});
		const bitrate60 = getWebcamRecorderBitrate({
			width: 1920,
			height: 1080,
			frameRate: 60,
		});

		expect(bitrate60).toBeGreaterThan(bitrate30);
		expect(bitrate60).toBeLessThanOrEqual(12_000_000);
	});
});
