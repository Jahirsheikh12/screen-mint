import type {
	CaptionGenerationProgress,
	CaptionModelStatus,
	CaptionTrack,
} from "../../src/components/video-editor/types";
import { resolveCaptionBackend } from "../../src/lib/captions/backendSelection";
import { tMain } from "../i18n";
import {
	cancelAppleSpeechGeneration,
	generateCaptionsWithAppleSpeech,
	getAppleSpeechAvailability,
	isAppleSpeechGenerationCancelled,
	shouldPreferAppleSpeechBackend,
} from "./appleSpeechService";
import type { GenerateCaptionsRequest } from "./whisperService";
import {
	cancelCaptionGeneration as cancelWhisperCaptionGeneration,
	exportCaptionTranscript,
	generateCaptions as generateWhisperCaptions,
	getCaptionModelStatus as getWhisperCaptionModelStatus,
	isCaptionGenerationCancelled as isWhisperCaptionGenerationCancelled,
} from "./whisperService";

type CaptionProgressCallback = (progress: CaptionGenerationProgress) => void;

export async function getCaptionModelStatus(
	videoPath: string,
	microphoneAudioPath?: string | null,
	ffmpegPath?: string,
): Promise<CaptionModelStatus> {
	const whisperStatus = await getWhisperCaptionModelStatus(
		videoPath,
		microphoneAudioPath,
		ffmpegPath,
	);
	const appleAvailability = await getAppleSpeechAvailability();
	const availableBackends = appleAvailability.available
		? (["whisper.cpp", "apple-speech"] as const)
		: (["whisper.cpp"] as const);

	return {
		...whisperStatus,
		availableBackends: [...availableBackends],
		recommendedBackend: appleAvailability.available ? "apple-speech" : "whisper.cpp",
		backendMessages: appleAvailability.message
			? {
					"apple-speech": appleAvailability.message,
				}
			: {},
	};
}

export async function generateCaptions(
	request: GenerateCaptionsRequest & { preferredBackend: "auto" | "whisper.cpp" | "apple-speech" },
	onProgress: CaptionProgressCallback,
): Promise<CaptionTrack> {
	const selectedBackend = await resolveCaptionBackendForRequest(request);
	if (selectedBackend === "apple-speech") {
		try {
			return await generateCaptionsWithAppleSpeech(request, onProgress);
		} catch (error) {
			if (
				request.preferredBackend !== "auto" ||
				isAppleSpeechGenerationCancelled(error) ||
				isWhisperCaptionGenerationCancelled(error)
			) {
				throw error;
			}

			onProgress({
				stage: "bootstrap",
				percentage: 18,
				message: tMain("captions.appleFallback"),
			});
		}
	}

	return generateWhisperCaptions(request, onProgress);
}

export function cancelCaptionGeneration() {
	cancelAppleSpeechGeneration();
	cancelWhisperCaptionGeneration();
}

export function isCaptionGenerationCancelled(error: unknown): boolean {
	return isAppleSpeechGenerationCancelled(error) || isWhisperCaptionGenerationCancelled(error);
}

export { exportCaptionTranscript };

async function resolveCaptionBackendForRequest(
	request: GenerateCaptionsRequest & { preferredBackend: "auto" | "whisper.cpp" | "apple-speech" },
) {
	const shouldPreferAppleSpeech = await shouldPreferAppleSpeechBackend(request);
	return resolveCaptionBackend({
		preferredBackend: request.preferredBackend,
		language: request.language,
		availableSourceAudios: shouldPreferAppleSpeech ? ["microphone"] : ["mixed"],
		appleSpeechAvailable: shouldPreferAppleSpeech,
	});
}
