import { describe, expect, it } from "vitest";
import { buildNativeRecordingOptions } from "./nativeConfig";
import { normalizeSelectedArea } from "./session";

describe("buildNativeRecordingOptions", () => {
	it("includes selected area metadata for native payloads", () => {
		const selectedArea = normalizeSelectedArea(
			{ x: 100, y: 80, width: 640, height: 360 },
			{ x: 0, y: 0, width: 1920, height: 1080 },
			1,
		);

		expect(
			buildNativeRecordingOptions({
				capturesSystemAudio: true,
				capturesMicrophone: true,
				microphoneDeviceId: "mic-1",
				microphoneLabel: "Studio Mic",
				selectedArea,
			}),
		).toEqual({
			capturesSystemAudio: true,
			capturesMicrophone: true,
			microphoneDeviceId: "mic-1",
			microphoneLabel: "Studio Mic",
			selectedArea,
		});
	});

	it("omits area metadata when recording the whole source", () => {
		expect(
			buildNativeRecordingOptions({
				capturesSystemAudio: false,
				capturesMicrophone: false,
				selectedArea: null,
			}),
		).toEqual({
			capturesSystemAudio: false,
			capturesMicrophone: false,
			microphoneDeviceId: undefined,
			microphoneLabel: undefined,
			selectedArea: undefined,
		});
	});
});
