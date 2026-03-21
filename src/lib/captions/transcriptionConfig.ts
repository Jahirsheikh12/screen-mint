import type { CaptionModel } from "../../components/video-editor/types";

const LANGUAGE_ALIASES = new Map<string, string>([
	["auto", "auto"],
	["english", "en"],
	["en", "en"],
	["en-us", "en"],
	["en-gb", "en"],
	["spanish", "es"],
	["espanol", "es"],
	["español", "es"],
	["es", "es"],
	["french", "fr"],
	["francais", "fr"],
	["français", "fr"],
	["fr", "fr"],
	["german", "de"],
	["deutsch", "de"],
	["de", "de"],
	["italian", "it"],
	["italiano", "it"],
	["it", "it"],
	["portuguese", "pt"],
	["portugues", "pt"],
	["português", "pt"],
	["pt", "pt"],
	["pt-br", "pt"],
	["pt-pt", "pt"],
	["brazilian portuguese", "pt"],
	["chinese", "zh"],
	["mandarin", "zh"],
	["zh", "zh"],
	["zh-cn", "zh"],
	["zh-tw", "zh"],
	["cantonese", "yue"],
	["yue", "yue"],
	["japanese", "ja"],
	["ja", "ja"],
	["korean", "ko"],
	["ko", "ko"],
	["hindi", "hi"],
	["hi", "hi"],
	["hinglish", "hi"],
	["arabic", "ar"],
	["ar", "ar"],
	["russian", "ru"],
	["ru", "ru"],
	["turkish", "tr"],
	["tr", "tr"],
	["dutch", "nl"],
	["nl", "nl"],
	["polish", "pl"],
	["pl", "pl"],
	["ukrainian", "uk"],
	["uk", "uk"],
	["indonesian", "id"],
	["bahasa indonesia", "id"],
	["id", "id"],
	["vietnamese", "vi"],
	["vi", "vi"],
	["thai", "th"],
	["th", "th"],
	["malay", "ms"],
	["ms", "ms"],
	["tamil", "ta"],
	["ta", "ta"],
	["telugu", "te"],
	["te", "te"],
	["bengali", "bn"],
	["bangla", "bn"],
	["bn", "bn"],
	["urdu", "ur"],
	["ur", "ur"],
	["persian", "fa"],
	["farsi", "fa"],
	["fa", "fa"],
	["swedish", "sv"],
	["sv", "sv"],
	["danish", "da"],
	["da", "da"],
	["norwegian", "no"],
	["no", "no"],
	["nb", "no"],
	["finnish", "fi"],
	["fi", "fi"],
]);

const SPEECH_ENHANCEMENT_FILTERS = [
	"highpass=f=80",
	"lowpass=f=7600",
	"dynaudnorm=f=120:g=21:p=0.9",
];

export const VAD_MODEL_FILE_NAME = "ggml-silero-v6.2.0.bin";

export interface WhisperCliArgOptions {
	modelPath: string;
	audioInputPath: string;
	outputBasePath: string;
	language: string;
	prompt: string;
	vadModelPath: string;
}

export interface SpeechExtractionArgOptions {
	sourceAudioPath: string;
	outputPath: string;
	filtered: boolean;
}

export function normalizeCaptionLanguage(language: string): string {
	const raw = language.trim();
	if (!raw) {
		return "auto";
	}

	const normalized = raw.toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ").trim();
	const alias = LANGUAGE_ALIASES.get(normalized);
	if (alias) {
		return alias;
	}

	const compact = normalized.replace(/[()]/g, "");
	const compactAlias = LANGUAGE_ALIASES.get(compact);
	if (compactAlias) {
		return compactAlias;
	}

	if (/^[a-z]{2,3}$/.test(normalized)) {
		return normalized;
	}

	const prefixMatch = normalized.match(/^([a-z]{2,3})-[a-z0-9-]+$/);
	if (prefixMatch) {
		return prefixMatch[1] ?? "auto";
	}

	return normalized;
}

export function buildSpeechExtractionArgs(options: SpeechExtractionArgOptions): string[] {
	const args = [
		"-y",
		"-i",
		options.sourceAudioPath,
		"-map",
		"0:a:0?",
		"-vn",
		"-ac",
		"1",
		"-ar",
		"16000",
	];

	if (options.filtered) {
		args.push("-af", SPEECH_ENHANCEMENT_FILTERS.join(","));
	}

	args.push("-c:a", "pcm_s16le", options.outputPath);
	return args;
}

export function buildWhisperCliArgs(options: WhisperCliArgOptions): string[] {
	const args = [
		"-m",
		options.modelPath,
		"-f",
		options.audioInputPath,
		"-ojf",
		"-of",
		options.outputBasePath,
		"-ml",
		"1",
		"-sow",
		"-bs",
		"5",
		"-bo",
		"5",
		"-mc",
		"256",
		"-sns",
		"--vad",
		"-vm",
		options.vadModelPath,
		"-vt",
		"0.6",
		"-vspd",
		"180",
		"-vsd",
		"220",
		"-vp",
		"80",
		"-vo",
		"0.15",
		"-pp",
		"-l",
		normalizeCaptionLanguage(options.language),
	];

	const prompt = options.prompt.trim();
	if (prompt.length > 0) {
		args.push("--prompt", prompt, "--carry-initial-prompt");
	}

	return args;
}

export const RECOMMENDED_CAPTION_MODEL: CaptionModel = "medium";

export function getFallbackCaptionModel(model: CaptionModel): CaptionModel | null {
	if (model === "medium") {
		return "small";
	}

	if (model === "small") {
		return "base";
	}

	return null;
}
