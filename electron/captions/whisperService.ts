import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import type {
	CaptionGenerationOptions,
	CaptionGenerationProgress,
	CaptionModel,
	CaptionRegion,
	CaptionSourceAudio,
	CaptionTrack,
	CaptionWord,
} from "../../src/components/video-editor/types";
import {
	formatCaptionTrack,
	type CaptionTranscriptFormat,
} from "../../src/components/video-editor/captionTranscript";
import { ffmpegOutputHasAudioStream } from "../../src/lib/captions/ffmpegAudioDetection";
import {
	VAD_MODEL_FILE_NAME,
	buildSpeechExtractionArgs,
	buildWhisperCliArgs,
	getFallbackCaptionModel,
	normalizeCaptionLanguage,
} from "../../src/lib/captions/transcriptionConfig";
import { buildCaptionSegmentsFromWords } from "./captionSegmentation";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

const WHISPER_TAG = "v1.8.4";
const WHISPER_REPO_URL = "https://github.com/ggml-org/whisper.cpp.git";
const WHISPER_MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
const WHISPER_VAD_MODEL_BASE_URL = "https://huggingface.co/ggml-org/whisper-vad/resolve/main";
const MODEL_FILE_NAMES: Record<CaptionModel, string> = {
	base: "ggml-base.bin",
	small: "ggml-small.bin",
	medium: "ggml-medium.bin",
};

export interface GenerateCaptionsRequest extends CaptionGenerationOptions {
	videoPath: string;
	microphoneAudioPath?: string | null;
	ffmpegPath: string;
}

export interface WhisperCaptionModelStatus {
	ready: boolean;
	availableModels: CaptionModel[];
	downloadedModels: CaptionModel[];
	availableSourceAudios: CaptionSourceAudio[];
}

type CaptionProgressCallback = (progress: CaptionGenerationProgress) => void;

export type ResolvedCaptionAudioSource = {
	kind: CaptionSourceAudio;
	path: string;
};

let activeWhisperProcess: ChildProcessWithoutNullStreams | null = null;
let cancellationRequested = false;

class CaptionGenerationCancelledError extends Error {
	constructor() {
		super("Caption generation was cancelled.");
		this.name = "CaptionGenerationCancelledError";
	}
}

export async function getCaptionModelStatus(
	videoPath: string,
	microphoneAudioPath?: string | null,
	ffmpegPath?: string,
): Promise<WhisperCaptionModelStatus> {
	const downloadedModels = await getDownloadedModels();
	const availableSourceAudios = await detectAvailableSourceAudios(
		videoPath,
		microphoneAudioPath,
		ffmpegPath,
	);

	return {
		ready: downloadedModels.length > 0 && availableSourceAudios.length > 0,
		availableModels: ["base", "small", "medium"],
		downloadedModels,
		availableSourceAudios,
	};
}

export async function generateCaptions(
	request: GenerateCaptionsRequest,
	onProgress: CaptionProgressCallback,
): Promise<CaptionTrack> {
	cancellationRequested = false;
	const captionsDir = await ensureCaptionsDir();
	const cliPath = await ensureWhisperCli(captionsDir, onProgress);
	throwIfCancelled();
	const vadModelPath = await ensureVadModelFile(captionsDir, onProgress);
	throwIfCancelled();
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "screenmint-captions-"));
	const audioInputPath = path.join(tempDir, "input.wav");
	const outputBasePath = path.join(tempDir, "transcript");

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
			message: `Extracting ${sourceAudio.kind === "microphone" ? "microphone" : "mixed"} audio...`,
		});
		throwIfCancelled();

		await extractSpeechFriendlyAudio(request.ffmpegPath, sourceAudio.path, audioInputPath);
		throwIfCancelled();

		onProgress({
			stage: "transcribe",
			percentage: 45,
			message: "Running local Whisper transcription...",
		});

		let resolvedModel = request.model;
		try {
			const modelPath = await ensureModelFile(captionsDir, resolvedModel, onProgress);
			throwIfCancelled();
			await runWhisperCli(
				cliPath,
				modelPath,
				vadModelPath,
				audioInputPath,
				outputBasePath,
				{ ...request, model: resolvedModel },
				onProgress,
			);
		} catch (error) {
			const fallbackModel = isWhisperOutOfMemoryError(error)
				? getFallbackCaptionModel(resolvedModel)
				: null;
			if (!fallbackModel) {
				throw error;
			}

			onProgress({
				stage: "model",
				percentage: 32,
				message: `Retrying with the smaller ${fallbackModel} model...`,
			});
			resolvedModel = fallbackModel;
			const fallbackModelPath = await ensureModelFile(captionsDir, resolvedModel, onProgress);
			throwIfCancelled();
			await runWhisperCli(
				cliPath,
				fallbackModelPath,
				vadModelPath,
				audioInputPath,
				outputBasePath,
				{ ...request, model: resolvedModel },
				onProgress,
			);
		}
		throwIfCancelled();

		onProgress({
			stage: "align",
			percentage: 85,
			message: "Building transcript segments...",
		});

		const jsonPath = `${outputBasePath}.json`;
		const raw = await fs.readFile(jsonPath, "utf-8");
		const parsed = JSON.parse(raw);
		const segments = parseWhisperOutput(parsed);
		throwIfCancelled();

		onProgress({
			stage: "complete",
			percentage: 100,
			message: "Transcript ready",
		});

		return {
			backend: "whisper.cpp",
			model: resolvedModel,
			language: readDetectedLanguage(parsed, request.language),
			prompt: request.prompt,
			sourceAudio: sourceAudio.kind,
			sourceAudioPath: sourceAudio.path,
			status: "ready",
			generatedAt: new Date().toISOString(),
			segments,
		};
	} finally {
		activeWhisperProcess = null;
		cancellationRequested = false;
		await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
			// best effort temp cleanup
		});
	}
}

export function cancelCaptionGeneration() {
	cancellationRequested = true;
	if (activeWhisperProcess) {
		try {
			activeWhisperProcess.kill();
		} catch {
			// ignore cancellation cleanup issues
		}
		activeWhisperProcess = null;
	}
}

export function isCaptionGenerationCancelled(error: unknown): boolean {
	return error instanceof CaptionGenerationCancelledError;
}

export async function exportCaptionTranscript(
	videoPath: string,
	track: CaptionTrack,
	format: CaptionTranscriptFormat,
) {
	const ext = format === "txt" ? "txt" : format;
	const fileNameBase =
		path.basename(videoPath, path.extname(videoPath)).replace(/[^a-zA-Z0-9-_]/g, "_") ||
		"transcript";
	const content = formatCaptionTrack(track, format);

	return {
		defaultFileName: `${fileNameBase}.${ext}`,
		content,
	};
}

async function ensureCaptionsDir() {
	const captionsDir = path.join(app.getPath("userData"), "captions");
	await fs.mkdir(captionsDir, { recursive: true });
	return captionsDir;
}

async function getDownloadedModels(): Promise<CaptionModel[]> {
	const captionsDir = await ensureCaptionsDir();
	const modelsDir = path.join(captionsDir, "models");
	await fs.mkdir(modelsDir, { recursive: true });
	const entries = await fs.readdir(modelsDir).catch(() => [] as string[]);
	return (Object.entries(MODEL_FILE_NAMES) as Array<[CaptionModel, string]>)
		.filter(([, fileName]) => entries.includes(fileName))
		.map(([model]) => model);
}

async function ensureModelFile(
	captionsDir: string,
	model: CaptionModel,
	onProgress: CaptionProgressCallback,
) {
	const modelsDir = path.join(captionsDir, "models");
	await fs.mkdir(modelsDir, { recursive: true });
	const fileName = MODEL_FILE_NAMES[model];
	const targetPath = path.join(modelsDir, fileName);
	try {
		await fs.access(targetPath);
		return targetPath;
	} catch {
		// download below
	}

	onProgress({
		stage: "model",
		percentage: 8,
		message: `Downloading Whisper ${model} model...`,
	});

	const response = await fetch(`${WHISPER_MODEL_BASE_URL}/${fileName}?download=true`);
	if (!response.ok) {
		throw new Error(`Failed to download Whisper model (${response.status}).`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	await fs.writeFile(targetPath, buffer);
	return targetPath;
}

async function ensureVadModelFile(captionsDir: string, onProgress: CaptionProgressCallback) {
	const modelsDir = path.join(captionsDir, "models");
	await fs.mkdir(modelsDir, { recursive: true });
	const targetPath = path.join(modelsDir, VAD_MODEL_FILE_NAME);
	try {
		await fs.access(targetPath);
		return targetPath;
	} catch {
		// download below
	}

	onProgress({
		stage: "model",
		percentage: 16,
		message: "Downloading speech detection helper...",
	});

	const response = await fetch(`${WHISPER_VAD_MODEL_BASE_URL}/${VAD_MODEL_FILE_NAME}`);
	if (!response.ok) {
		throw new Error(`Failed to download Whisper VAD model (${response.status}).`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	await fs.writeFile(targetPath, buffer);
	return targetPath;
}

async function ensureWhisperCli(captionsDir: string, onProgress: CaptionProgressCallback) {
	const sourceDir = path.join(captionsDir, "whisper.cpp");
	const buildDir = path.join(sourceDir, "build");
	const existing = await findWhisperCli(sourceDir, buildDir);
	if (existing) {
		return existing;
	}

	onProgress({
		stage: "bootstrap",
		percentage: 2,
		message: "Preparing local Whisper runtime...",
	});

	try {
		await fs.access(sourceDir);
	} catch {
		await execFileAsync(
			"git",
			["clone", "--depth", "1", "--branch", WHISPER_TAG, WHISPER_REPO_URL, sourceDir],
			{ maxBuffer: 20 * 1024 * 1024 },
		);
	}

	onProgress({
		stage: "bootstrap",
		percentage: 5,
		message: "Building Whisper CLI...",
	});

	await buildWhisperCli(sourceDir);

	const cliPath = await findWhisperCli(sourceDir, buildDir);
	if (!cliPath) {
		throw new Error("Whisper CLI build completed, but the executable was not found.");
	}

	return cliPath;
}

async function buildWhisperCli(sourceDir: string) {
	const cmakePath = await findCmakeExecutable();
	if (cmakePath) {
		await execFileAsync(cmakePath, ["-B", "build", "-S", ".", "-DWHISPER_SDL2=OFF"], {
			cwd: sourceDir,
			maxBuffer: 20 * 1024 * 1024,
		});
		await execFileAsync(
			cmakePath,
			["--build", "build", "--config", "Release", "--target", "whisper-cli"],
			{
				cwd: sourceDir,
				maxBuffer: 20 * 1024 * 1024,
			},
		);
		return;
	}

	throw new Error(
		process.platform === "win32"
			? "Whisper CLI build tools are unavailable. Install Visual Studio C++ build tools."
			: "Whisper CLI build tools are unavailable. Install Xcode Command Line Tools or a C/C++ toolchain.",
	);
}

async function commandExists(command: string) {
	try {
		await execFileAsync(command, ["--version"], { maxBuffer: 1024 * 1024 });
		return true;
	} catch {
		return false;
	}
}

async function findCmakeExecutable() {
	if (await commandExists("cmake")) {
		return "cmake";
	}

	try {
		const cmakeRuntime = nodeRequire("cmake-runtime") as (
			referrer?: string,
			options?: { platform?: string; arch?: string },
		) => string;
		const bundledCmakePath = cmakeRuntime();
		if (existsSync(bundledCmakePath)) {
			return bundledCmakePath;
		}
	} catch {
		// bundled runtime is optional during development
	}

	if (process.platform === "win32") {
		const vsEditions = ["Community", "Professional", "Enterprise", "BuildTools"];
		for (const edition of vsEditions) {
			const cmakePath = path.join(
				"C:",
				"Program Files",
				"Microsoft Visual Studio",
				"2022",
				edition,
				"Common7",
				"IDE",
				"CommonExtensions",
				"Microsoft",
				"CMake",
				"CMake",
				"bin",
				"cmake.exe",
			);
			if (existsSync(cmakePath)) {
				return cmakePath;
			}
		}
	}

	return null;
}

async function findWhisperCli(sourceDir: string, buildDir: string) {
	const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
	const candidates = [
		path.join(buildDir, "bin", exeName),
		path.join(buildDir, "bin", "Release", exeName),
		path.join(buildDir, "src", "Release", exeName),
		path.join(buildDir, exeName),
		path.join(sourceDir, "bin", exeName),
		path.join(sourceDir, exeName),
		path.join(sourceDir, "main"),
	];

	for (const candidate of candidates) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch {
			// keep looking
		}
	}

	return null;
}

export async function detectAvailableSourceAudios(
	videoPath: string,
	microphoneAudioPath: string | null | undefined,
	ffmpegPath?: string,
) {
	const available: CaptionSourceAudio[] = [];

	if (microphoneAudioPath) {
		try {
			await fs.access(microphoneAudioPath);
			available.push("microphone");
		} catch {
			// microphone track is optional
		}
	}

	if (ffmpegPath && (await hasAudioStream(videoPath, ffmpegPath))) {
		available.push("mixed");
	}

	return available;
}

export async function resolveSourceAudioSource(
	videoPath: string,
	microphoneAudioPath: string | null | undefined,
	preferredSourceAudio: CaptionSourceAudio,
	ffmpegPath: string,
): Promise<ResolvedCaptionAudioSource> {
	const available = await detectAvailableSourceAudios(videoPath, microphoneAudioPath, ffmpegPath);
	if (
		preferredSourceAudio === "microphone" &&
		available.includes("microphone") &&
		microphoneAudioPath
	) {
		return { kind: "microphone" as const, path: microphoneAudioPath };
	}

	if (available.includes("mixed")) {
		return { kind: "mixed" as const, path: videoPath };
	}

	if (available.includes("microphone") && microphoneAudioPath) {
		return { kind: "microphone" as const, path: microphoneAudioPath };
	}

	throw new Error(
		"No usable audio track was found for this video. Record microphone or system audio to generate captions.",
	);
}

async function hasAudioStream(filePath: string, ffmpegPath: string) {
	try {
		await fs.access(filePath);
	} catch {
		return false;
	}

	try {
		await execFileAsync(ffmpegPath, ["-hide_banner", "-i", filePath], {
			maxBuffer: 10 * 1024 * 1024,
		});
	} catch (error) {
		const stderr = error instanceof Error && "stderr" in error ? String(error.stderr ?? "") : "";
		if (ffmpegOutputHasAudioStream(stderr)) {
			return true;
		}

		const message = error instanceof Error ? error.message : String(error);
		return ffmpegOutputHasAudioStream(message);
	}

	return false;
}

async function runWhisperCli(
	cliPath: string,
	modelPath: string,
	vadModelPath: string,
	audioInputPath: string,
	outputBasePath: string,
	request: GenerateCaptionsRequest,
	onProgress: CaptionProgressCallback,
) {
	const args = buildWhisperCliArgs({
		modelPath,
		audioInputPath,
		outputBasePath,
		language: request.language,
		prompt: request.prompt,
		vadModelPath,
	});

	const process = spawn(cliPath, args, {
		stdio: ["pipe", "pipe", "pipe"],
	});
	activeWhisperProcess = process;

	let output = "";
	process.stdout.on("data", (chunk: Buffer) => {
		output += chunk.toString();
		if (output.includes("processing")) {
			onProgress({
				stage: "transcribe",
				percentage: 65,
				message: "Whisper is transcribing the audio...",
			});
		}
	});
	process.stderr.on("data", (chunk: Buffer) => {
		output += chunk.toString();
	});

	await new Promise<void>((resolve, reject) => {
		process.once("error", reject);
		process.once("close", (code) => {
			if (cancellationRequested) {
				reject(new CaptionGenerationCancelledError());
				return;
			}

			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(output.trim() || `Whisper CLI exited with code ${code ?? "unknown"}.`));
		});
	});
}

export async function extractSpeechFriendlyAudio(
	ffmpegPath: string,
	sourceAudioPath: string,
	outputPath: string,
) {
	try {
		await execFileAsync(
			ffmpegPath,
			buildSpeechExtractionArgs({ sourceAudioPath, outputPath, filtered: true }),
			{
				maxBuffer: 20 * 1024 * 1024,
			},
		);
		return;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("does not contain any stream")) {
			throw error;
		}
	}

	await execFileAsync(
		ffmpegPath,
		buildSpeechExtractionArgs({ sourceAudioPath, outputPath, filtered: false }),
		{
			maxBuffer: 20 * 1024 * 1024,
		},
	);
}

function throwIfCancelled() {
	if (cancellationRequested) {
		throw new CaptionGenerationCancelledError();
	}
}

function isWhisperOutOfMemoryError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error ?? "");
	const normalized = message.toLowerCase();
	return (
		normalized.includes("bad_alloc") ||
		normalized.includes("bad allocation") ||
		normalized.includes("out of memory") ||
		normalized.includes("not enough memory")
	);
}

function parseWhisperOutput(parsed: Record<string, unknown>): CaptionRegion[] {
	const transcription = Array.isArray(parsed.transcription)
		? parsed.transcription
		: Array.isArray(parsed.result)
			? parsed.result
			: [];

	const wordEntries = transcription
		.map((entry, index) => parseWordEntry(entry, index))
		.filter((entry): entry is CaptionWord => Boolean(entry));

	if (wordEntries.length === 0) {
		return [];
	}

	return buildCaptionSegmentsFromWords(wordEntries);
}

function parseWordEntry(entry: unknown, index: number): CaptionWord | null {
	if (!entry || typeof entry !== "object") {
		return null;
	}

	const record = entry as Record<string, unknown>;
	const text = typeof record.text === "string" ? record.text.trim() : "";
	if (!text) {
		return null;
	}

	const offsets =
		record.offsets && typeof record.offsets === "object"
			? (record.offsets as Record<string, unknown>)
			: null;
	const startMs = toNumber(offsets?.from) ?? toTimestampMs(record.timestamps, "from");
	const endMs = toNumber(offsets?.to) ?? toTimestampMs(record.timestamps, "to");

	if (startMs == null || endMs == null) {
		return null;
	}

	return {
		id: `caption-word-${index + 1}`,
		text,
		startMs,
		endMs: Math.max(startMs + 1, endMs),
	};
}

function toTimestampMs(candidate: unknown, key: "from" | "to") {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const value = (candidate as Record<string, unknown>)[key];
	if (typeof value !== "string") {
		return null;
	}

	const match = value.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
	if (!match) {
		return null;
	}

	const [, hours, minutes, seconds, millis] = match;
	return (
		Number(hours) * 3_600_000 +
		Number(minutes) * 60_000 +
		Number(seconds) * 1_000 +
		Number(millis.padEnd(3, "0").slice(0, 3))
	);
}

function toNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function readDetectedLanguage(parsed: Record<string, unknown>, requestedLanguage: string) {
	const detected =
		typeof parsed.language === "string"
			? parsed.language
			: typeof parsed.lang === "string"
				? parsed.lang
				: null;

	if (detected && detected.trim().length > 0) {
		return normalizeCaptionLanguage(detected);
	}

	return normalizeCaptionLanguage(requestedLanguage);
}
