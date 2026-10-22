import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { execFile, spawn, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import type {
	CaptionGenerationProgress,
	CaptionTrack,
	CaptionWord,
} from "../../src/components/video-editor/types";
import { normalizeCaptionLanguage } from "../../src/lib/captions/transcriptionConfig";
import { tMain } from "../i18n";
import { buildCaptionSegmentsFromWords } from "./captionSegmentation";
import type { GenerateCaptionsRequest } from "./whisperService";
import {
	detectAvailableSourceAudios,
	extractSpeechFriendlyAudio,
	resolveSourceAudioSource,
} from "./whisperService";

const execFileAsync = promisify(execFile);

type CaptionProgressCallback = (progress: CaptionGenerationProgress) => void;

type AppleSpeechAvailability = {
	available: boolean;
	message?: string;
	supportedLanguages?: string[];
};

type AppleSpeechWord = {
	text: string;
	startMs: number;
	endMs: number;
	confidence?: number;
};

type AppleSpeechResponse = {
	language: string;
	words: AppleSpeechWord[];
};

let activeAppleSpeechProcess: ChildProcessWithoutNullStreams | null = null;
let appleSpeechCancellationRequested = false;

class AppleSpeechGenerationCancelledError extends Error {
	constructor() {
		super("Apple Speech caption generation was cancelled.");
		this.name = "AppleSpeechGenerationCancelledError";
	}
}

export async function getAppleSpeechAvailability(
	language = "auto",
): Promise<AppleSpeechAvailability> {
	if (process.platform !== "darwin") {
		return {
			available: false,
			message: "Apple Speech is available only on macOS.",
		};
	}

	const helperPath = await ensureAppleSpeechHelperBinary();
	const normalizedLanguage = normalizeCaptionLanguage(language);
	const args = ["availability"];
	if (normalizedLanguage !== "auto") {
		args.push(normalizedLanguage);
	}

	try {
		const { stdout } = await execFileAsync(helperPath, args, {
			maxBuffer: 5 * 1024 * 1024,
		});
		return JSON.parse(stdout) as AppleSpeechAvailability;
	} catch (error) {
		return {
			available: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function generateCaptionsWithAppleSpeech(
	request: GenerateCaptionsRequest,
	onProgress: CaptionProgressCallback,
): Promise<CaptionTrack> {
	appleSpeechCancellationRequested = false;
	const normalizedLanguage = normalizeCaptionLanguage(request.language);
	if (normalizedLanguage === "auto") {
		throw new Error("Apple Speech requires a specific language. Choose a language and try again.");
	}

	const helperPath = await ensureAppleSpeechHelperBinary();
	const tempDir = await fs.mkdtemp(path.join(app.getPath("temp"), "screenmint-apple-speech-"));
	const audioInputPath = path.join(tempDir, "input.wav");
	const requestPath = path.join(tempDir, "apple-speech-request.json");

	try {
		const sourceAudio = await resolveSourceAudioSource(
			request.videoPath,
			request.microphoneAudioPath,
			request.preferredSourceAudio,
			request.ffmpegPath,
		);
		onProgress({
			stage: "audio",
			percentage: 25,
			message: tMain(
				sourceAudio.kind === "microphone"
					? "captions.preparingAppleMicrophone"
					: "captions.preparingAppleMixed",
			),
		});

		await extractSpeechFriendlyAudio(request.ffmpegPath, sourceAudio.path, audioInputPath);

		onProgress({
			stage: "transcribe",
			percentage: 50,
			message: tMain("captions.runningApple"),
		});

		await fs.writeFile(
			requestPath,
			JSON.stringify({
				audioPath: audioInputPath,
				language: normalizedLanguage,
				contextualStrings: parseContextualStrings(request.prompt),
			}),
			"utf-8",
		);

		const response = await runAppleSpeechHelper(helperPath, requestPath);
		const words = response.words.map<CaptionWord>((word, index) => ({
			id: `apple-word-${index + 1}`,
			text: word.text.trim(),
			startMs: Math.max(0, Math.round(word.startMs)),
			endMs: Math.max(Math.round(word.startMs) + 1, Math.round(word.endMs)),
			confidence: word.confidence,
		}));

		onProgress({
			stage: "align",
			percentage: 85,
			message: tMain("captions.buildingSegments"),
		});

		return {
			backend: "apple-speech",
			model: request.model,
			language: normalizeCaptionLanguage(response.language || normalizedLanguage),
			prompt: request.prompt,
			sourceAudio: sourceAudio.kind,
			sourceAudioPath: sourceAudio.path,
			status: "ready",
			generatedAt: new Date().toISOString(),
			segments: buildCaptionSegmentsFromWords(words),
		};
	} finally {
		activeAppleSpeechProcess = null;
		appleSpeechCancellationRequested = false;
		await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
			// best effort cleanup
		});
	}
}

export function cancelAppleSpeechGeneration() {
	appleSpeechCancellationRequested = true;
	if (activeAppleSpeechProcess) {
		try {
			activeAppleSpeechProcess.kill();
		} catch {
			// ignore
		}
		activeAppleSpeechProcess = null;
	}
}

export function isAppleSpeechGenerationCancelled(error: unknown) {
	return error instanceof AppleSpeechGenerationCancelledError;
}

export async function shouldPreferAppleSpeechBackend(request: GenerateCaptionsRequest) {
	if (process.platform !== "darwin") {
		return false;
	}

	const normalizedLanguage = normalizeCaptionLanguage(request.language);
	if (normalizedLanguage === "auto") {
		return false;
	}

	const availableSourceAudios = await detectAvailableSourceAudios(
		request.videoPath,
		request.microphoneAudioPath,
		request.ffmpegPath,
	);
	if (!availableSourceAudios.includes("microphone")) {
		return false;
	}

	const availability = await getAppleSpeechAvailability(normalizedLanguage);
	return availability.available;
}

async function runAppleSpeechHelper(helperPath: string, requestPath: string) {
	const process = spawn(helperPath, ["transcribe", requestPath], {
		stdio: ["pipe", "pipe", "pipe"],
	});
	activeAppleSpeechProcess = process;

	let output = "";
	process.stdout.on("data", (chunk: Buffer) => {
		output += chunk.toString();
	});
	process.stderr.on("data", (chunk: Buffer) => {
		output += chunk.toString();
	});

	await new Promise<void>((resolve, reject) => {
		process.once("error", reject);
		process.once("close", (code) => {
			if (appleSpeechCancellationRequested) {
				reject(new AppleSpeechGenerationCancelledError());
				return;
			}

			if (code === 0) {
				resolve();
				return;
			}

			reject(
				new Error(output.trim() || `Apple Speech helper exited with code ${code ?? "unknown"}.`),
			);
		});
	});

	const jsonStart = output.indexOf("{");
	const jsonEnd = output.lastIndexOf("}");
	if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
		throw new Error("Apple Speech helper did not return transcript data.");
	}

	return JSON.parse(output.slice(jsonStart, jsonEnd + 1)) as AppleSpeechResponse;
}

function parseContextualStrings(prompt: string) {
	const tokens = prompt
		.split(/[\n,]/)
		.map((token) => token.trim())
		.filter((token) => token.length > 1);

	return Array.from(new Set(tokens)).slice(0, 50);
}

function resolveUnpackedAppPath(...segments: string[]) {
	const base = app.getAppPath();
	const resolved = path.join(base, ...segments);
	if (app.isPackaged) {
		return resolved.replace(/\.asar([/\\])/, ".asar.unpacked$1");
	}
	return resolved;
}

function getNativeArchTag() {
	return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
}

function getAppleSpeechHelperSourcePath() {
	return resolveUnpackedAppPath("electron", "native", "AppleSpeechTranscriber.swift");
}

function getPrebundledAppleSpeechHelperPath() {
	return resolveUnpackedAppPath(
		"electron",
		"native",
		"bin",
		getNativeArchTag(),
		"screenmint-apple-speech-helper",
	);
}

function getAppleSpeechHelperBinaryPath() {
	return path.join(app.getPath("userData"), "native-tools", "screenmint-apple-speech-helper");
}

async function ensureAppleSpeechHelperBinary() {
	const sourcePath = getAppleSpeechHelperSourcePath();
	const binaryPath = getAppleSpeechHelperBinaryPath();

	if (app.isPackaged) {
		const prebundledPath = getPrebundledAppleSpeechHelperPath();
		await fs.access(prebundledPath, fsConstants.X_OK);
		return prebundledPath;
	}

	const helperDir = path.dirname(binaryPath);
	await fs.mkdir(helperDir, { recursive: true });

	let shouldCompile = false;
	try {
		const [sourceStat, binaryStat] = await Promise.all([
			fs.stat(sourcePath),
			fs.stat(binaryPath).catch(() => null),
		]);
		shouldCompile = !binaryStat || sourceStat.mtimeMs > binaryStat.mtimeMs;
	} catch (error) {
		throw new Error(`Apple Speech helper source is unavailable: ${String(error)}`);
	}

	if (!shouldCompile) {
		return binaryPath;
	}

	const result = spawnSync("swiftc", ["-O", sourcePath, "-o", binaryPath], {
		encoding: "utf8",
		timeout: 120000,
	});
	if (result.status !== 0) {
		const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
		throw new Error(details || "Failed to compile Apple Speech helper.");
	}

	return binaryPath;
}
