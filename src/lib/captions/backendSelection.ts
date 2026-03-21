import type {
	CaptionBackend,
	CaptionBackendPreference,
	CaptionSourceAudio,
} from "../../components/video-editor/types";
import { normalizeCaptionLanguage } from "./transcriptionConfig";

export function resolveCaptionBackend(params: {
	preferredBackend: CaptionBackendPreference;
	language: string;
	availableSourceAudios?: CaptionSourceAudio[];
	appleSpeechAvailable?: boolean;
}): CaptionBackend {
	if (params.preferredBackend === "whisper.cpp" || params.preferredBackend === "apple-speech") {
		return params.preferredBackend;
	}

	const normalizedLanguage = normalizeCaptionLanguage(params.language);
	if (
		params.appleSpeechAvailable &&
		normalizedLanguage !== "auto" &&
		(params.availableSourceAudios?.includes("microphone") ?? false)
	) {
		return "apple-speech";
	}

	return "whisper.cpp";
}
