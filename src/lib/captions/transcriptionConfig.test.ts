import { describe, expect, it } from "vitest";
import {
	VAD_MODEL_FILE_NAME,
	buildSpeechExtractionArgs,
	buildWhisperCliArgs,
	getFallbackCaptionModel,
	normalizeCaptionLanguage,
} from "./transcriptionConfig";

describe("transcriptionConfig", () => {
	it("normalizes common language names and locales to Whisper language codes", () => {
		expect(normalizeCaptionLanguage("English")).toBe("en");
		expect(normalizeCaptionLanguage("pt-BR")).toBe("pt");
		expect(normalizeCaptionLanguage("Hindi")).toBe("hi");
		expect(normalizeCaptionLanguage("zh-CN")).toBe("zh");
		expect(normalizeCaptionLanguage("")).toBe("auto");
	});

	it("builds enhanced ffmpeg extraction args with speech-friendly filters", () => {
		const args = buildSpeechExtractionArgs({
			sourceAudioPath: "/tmp/input.mp4",
			outputPath: "/tmp/output.wav",
			filtered: true,
		});

		expect(args).toContain("-map");
		expect(args).toContain("0:a:0?");
		expect(args).toContain("-af");
		expect(args.join(" ")).toContain("dynaudnorm");
	});

	it("can build a plain extraction fallback without filters", () => {
		const args = buildSpeechExtractionArgs({
			sourceAudioPath: "/tmp/input.mp4",
			outputPath: "/tmp/output.wav",
			filtered: false,
		});

		expect(args).not.toContain("-af");
	});

	it("builds whisper args with auto language, VAD, and prompt carry-over", () => {
		const args = buildWhisperCliArgs({
			modelPath: "/tmp/ggml-medium.bin",
			audioInputPath: "/tmp/input.wav",
			outputBasePath: "/tmp/transcript",
			language: "auto",
			prompt: "ScreenMint and YouTube terminology",
			vadModelPath: `/tmp/${VAD_MODEL_FILE_NAME}`,
		});

		expect(args).toContain("--vad");
		expect(args).toContain("-vm");
		expect(args).toContain(`/tmp/${VAD_MODEL_FILE_NAME}`);
		expect(args).toContain("-l");
		expect(args).toContain("auto");
		expect(args).toContain("--carry-initial-prompt");
		expect(args).toContain("-sns");
	});

	it("provides a smaller fallback model when memory is tight", () => {
		expect(getFallbackCaptionModel("medium")).toBe("small");
		expect(getFallbackCaptionModel("small")).toBe("base");
		expect(getFallbackCaptionModel("base")).toBeNull();
	});
});
