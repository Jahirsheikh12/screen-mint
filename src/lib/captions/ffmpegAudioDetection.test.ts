import { describe, expect, it } from "vitest";
import { ffmpegOutputHasAudioStream } from "./ffmpegAudioDetection";

describe("ffmpegAudioDetection", () => {
	it("detects an audio stream in ffmpeg output", () => {
		const output = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'recording.mp4':
  Duration: 00:00:21.04, start: 0.000000, bitrate: 22511 kb/s
  Stream #0:0(und): Video: h264 (High)
  Stream #0:1(und): Audio: aac (LC), 48000 Hz, stereo, fltp, 155 kb/s
`;

		expect(ffmpegOutputHasAudioStream(output)).toBe(true);
	});

	it("returns false for video-only ffmpeg output", () => {
		const output = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'recording.mp4':
  Duration: 00:00:35.78, start: 0.000000, bitrate: 22995 kb/s
  Stream #0:0(und): Video: h264 (High)
`;

		expect(ffmpegOutputHasAudioStream(output)).toBe(false);
	});

	it("detects audio when the ffmpeg details are embedded in an error message", () => {
		const output =
			"Command failed: ffmpeg -i recording.mp4\nStream #0:1(und): Audio: aac (LC), 48000 Hz, stereo";

		expect(ffmpegOutputHasAudioStream(output)).toBe(true);
	});
});
