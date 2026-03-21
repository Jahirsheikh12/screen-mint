import { describe, expect, it } from "vitest";
import { resolveCaptionBackend } from "./backendSelection";

describe("backendSelection", () => {
	it("prefers Apple Speech only when auto mode has microphone audio and a fixed language", () => {
		expect(
			resolveCaptionBackend({
				preferredBackend: "auto",
				language: "en",
				availableSourceAudios: ["microphone"],
				appleSpeechAvailable: true,
			}),
		).toBe("apple-speech");
	});

	it("keeps Whisper for auto language or mixed-only audio", () => {
		expect(
			resolveCaptionBackend({
				preferredBackend: "auto",
				language: "auto",
				availableSourceAudios: ["microphone"],
				appleSpeechAvailable: true,
			}),
		).toBe("whisper.cpp");

		expect(
			resolveCaptionBackend({
				preferredBackend: "auto",
				language: "en",
				availableSourceAudios: ["mixed"],
				appleSpeechAvailable: true,
			}),
		).toBe("whisper.cpp");
	});

	it("honors an explicit backend selection", () => {
		expect(
			resolveCaptionBackend({
				preferredBackend: "whisper.cpp",
				language: "en",
				availableSourceAudios: ["microphone"],
				appleSpeechAvailable: true,
			}),
		).toBe("whisper.cpp");

		expect(
			resolveCaptionBackend({
				preferredBackend: "apple-speech",
				language: "en",
				availableSourceAudios: ["mixed"],
				appleSpeechAvailable: false,
			}),
		).toBe("apple-speech");
	});
});
