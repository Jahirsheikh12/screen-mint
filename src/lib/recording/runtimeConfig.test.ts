import { describe, expect, it } from "vitest";
import {
	DEFAULT_RECORDING_RUNTIME_SETTINGS,
	resolveRecordingTargetProfile,
} from "./runtimeConfig";

describe("runtimeConfig", () => {
	it("uses balanced sustained defaults for auto recordings", () => {
		expect(DEFAULT_RECORDING_RUNTIME_SETTINGS.recordingFps).toBe(30);

		expect(resolveRecordingTargetProfile(undefined)).toMatchObject({
			width: 2560,
			height: 1440,
			frameRate: 30,
			preferHardwareEncoding: true,
		});
	});

	it("keeps explicit high quality and 60fps settings available", () => {
		const profile = resolveRecordingTargetProfile({
			recordingQuality: "high",
			recordingFps: 60,
			hardwareAcceleration: false,
		});

		expect(profile).toMatchObject({
			width: 2560,
			height: 1440,
			frameRate: 60,
			preferHardwareEncoding: false,
		});
		expect(profile.videoBitsPerSecond).toBeGreaterThan(28_000_000);
	});

	it("keeps medium quality at 720p", () => {
		expect(
			resolveRecordingTargetProfile({
				recordingQuality: "medium",
				recordingFps: 30,
				hardwareAcceleration: true,
			}),
		).toMatchObject({
			width: 1280,
			height: 720,
			frameRate: 30,
		});
	});
});
