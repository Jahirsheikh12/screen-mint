import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { CaptionTrack } from "../../src/components/video-editor/types";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { setCustomWhisperPath } from "../captions/customWhisper";
import {
	cancelCaptionGeneration,
	exportCaptionTranscript,
	generateCaptions,
	getCaptionModelStatus,
	isCaptionGenerationCancelled,
} from "../captions/transcriptionOrchestrator";
import { deleteCaptionModel } from "../captions/whisperService";

interface CaptionIpcHandlersContext {
	getCurrentVideoPath: () => string | null;
	getCurrentMicrophoneAudioPath: () => string | null;
	getFfmpegBinaryPath: () => string;
	normalizeVideoSourcePath: (videoPath?: string | null) => string | null;
}

function emitCaptionGenerationProgress(progress: {
	stage: string;
	percentage: number;
	message: string;
}) {
	BrowserWindow.getAllWindows().forEach((window) => {
		if (!window.isDestroyed()) {
			window.webContents.send("caption-generation-progress", progress);
		}
	});
}

export function registerCaptionIpcHandlers({
	getCurrentVideoPath,
	getCurrentMicrophoneAudioPath,
	getFfmpegBinaryPath,
	normalizeVideoSourcePath,
}: CaptionIpcHandlersContext) {
	ipcMain.handle(IPC_CHANNELS.captions.deleteModel, async (_, model: unknown) => {
		if (model !== "base" && model !== "small" && model !== "medium") {
			return { success: false, message: "Unknown caption model." };
		}
		try {
			await deleteCaptionModel(model);
			return { success: true };
		} catch (error) {
			console.error("Failed to delete caption model:", error);
			return { success: false, message: "Failed to delete caption model", error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.captions.chooseCustomWhisper, async (_, kind: unknown) => {
		if (kind !== "model" && kind !== "executable") {
			return { success: false, error: "invalid-kind" };
		}
		try {
			const result = await dialog.showOpenDialog({
				title: kind === "model" ? "Select Whisper Model" : "Select Whisper Program",
				filters:
					kind === "model"
						? [{ name: "Whisper models (ggml)", extensions: ["bin"] }]
						: process.platform === "win32"
							? [{ name: "Programs", extensions: ["exe", "cmd", "bat"] }]
							: [],
				properties: ["openFile"],
			});
			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}
			const { error } = await setCustomWhisperPath(kind, result.filePaths[0]);
			return error ? { success: false, error } : { success: true, path: result.filePaths[0] };
		} catch (error) {
			console.error("Failed to choose custom Whisper file:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.captions.clearCustomWhisper, async (_, kind: unknown) => {
		if (kind !== "model" && kind !== "executable") {
			return { success: false, error: "invalid-kind" };
		}
		await setCustomWhisperPath(kind, null);
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.captions.getModelStatus, async (_, videoPath?: string) => {
		try {
			const targetVideoPath = normalizeVideoSourcePath(videoPath ?? getCurrentVideoPath());
			if (!targetVideoPath) {
				return { success: false, message: "No video available for captions." };
			}

			const status = await getCaptionModelStatus(
				targetVideoPath,
				getCurrentMicrophoneAudioPath(),
				getFfmpegBinaryPath(),
			);
			return { success: true, status };
		} catch (error) {
			console.error("Failed to get caption model status:", error);
			return {
				success: false,
				message: "Failed to get caption model status",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.captions.generate,
		async (
			_,
			request: {
				videoPath?: string;
				preferredBackend: "auto" | "whisper.cpp" | "apple-speech";
				model: "base" | "small" | "medium";
				language: string;
				prompt: string;
				preferredSourceAudio: "microphone" | "mixed";
			},
		) => {
			try {
				const targetVideoPath = normalizeVideoSourcePath(
					request.videoPath ?? getCurrentVideoPath(),
				);
				if (!targetVideoPath) {
					return { success: false, message: "No video available for transcription." };
				}

				const track = await generateCaptions(
					{
						videoPath: targetVideoPath,
						preferredBackend: request.preferredBackend,
						model: request.model,
						language: request.language,
						prompt: request.prompt,
						preferredSourceAudio: request.preferredSourceAudio,
						microphoneAudioPath: getCurrentMicrophoneAudioPath(),
						ffmpegPath: getFfmpegBinaryPath(),
					},
					(progress) => {
						emitCaptionGenerationProgress(progress);
					},
				);

				return { success: true, track };
			} catch (error) {
				if (isCaptionGenerationCancelled(error)) {
					return {
						success: false,
						canceled: true,
						message: "Caption generation cancelled",
					};
				}

				console.error("Failed to generate captions:", error);
				return {
					success: false,
					message: "Failed to generate captions",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.captions.cancelGeneration, async () => {
		cancelCaptionGeneration();
		return { success: true };
	});

	ipcMain.handle(
		IPC_CHANNELS.captions.exportTranscript,
		async (
			_,
			payload: {
				videoPath?: string;
				format: "srt" | "vtt" | "txt";
				track: CaptionTrack;
			},
		) => {
			try {
				const targetVideoPath = normalizeVideoSourcePath(
					payload.videoPath ?? getCurrentVideoPath(),
				);
				if (!targetVideoPath) {
					return { success: false, message: "No video available for transcript export." };
				}

				const transcript = await exportCaptionTranscript(
					targetVideoPath,
					payload.track,
					payload.format,
				);
				const result = await dialog.showSaveDialog({
					title: "Export Transcript",
					defaultPath: path.join(app.getPath("downloads"), transcript.defaultFileName),
					filters: [{ name: "Transcript", extensions: [payload.format] }],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return { success: false, canceled: true, message: "Transcript export canceled" };
				}

				await fs.writeFile(result.filePath, transcript.content, "utf-8");
				return { success: true, path: result.filePath };
			} catch (error) {
				console.error("Failed to export transcript:", error);
				return {
					success: false,
					message: "Failed to export transcript",
					error: String(error),
				};
			}
		},
	);
}
