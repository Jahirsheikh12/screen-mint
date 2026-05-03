import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/electron-ipc/contracts";
import { ensureFileExtension, sanitizeFileNameBase } from "../../src/lib/fileNames";

interface ProjectFileIpcHandlersContext {
	brandName: string;
	projectFileExtension: string;
	projectFileExtensions: string[];
	defaultRecordingsDir: string;
	getRecordingsDir: () => Promise<string>;
	persistRecordingsDirectorySetting: (nextDir: string) => Promise<void>;
	getCurrentProjectPath: () => string | null;
	setCurrentProjectPath: (path: string | null) => void;
	getCurrentVideoPath: () => string | null;
	setCurrentVideoPath: (path: string | null) => void;
	getCurrentWebcamPath: () => string | null;
	setCurrentWebcamPath: (path: string | null) => void;
	setCurrentMicrophoneAudioPath: (path: string | null) => void;
	normalizeVideoSourcePath: (videoPath?: string | null) => string | null;
	normalizePath: (value: string) => string;
	isPathInsideDirectory: (candidate: string, directory: string) => boolean;
	deletePathIfExists: (targetPath: string) => Promise<boolean>;
	getTelemetryPathForVideo: (videoPath: string) => string;
	getKeyboardTelemetryPathForVideo: (videoPath: string) => string;
	isTrustedProjectPath: (projectPath?: string | null) => boolean;
}

export function registerProjectFileIpcHandlers({
	brandName,
	projectFileExtension,
	projectFileExtensions,
	defaultRecordingsDir,
	getRecordingsDir,
	persistRecordingsDirectorySetting,
	getCurrentProjectPath,
	setCurrentProjectPath,
	getCurrentVideoPath,
	setCurrentVideoPath,
	getCurrentWebcamPath,
	setCurrentWebcamPath,
	setCurrentMicrophoneAudioPath,
	normalizeVideoSourcePath,
	normalizePath,
	isPathInsideDirectory,
	deletePathIfExists,
	getTelemetryPathForVideo,
	getKeyboardTelemetryPathForVideo,
	isTrustedProjectPath,
}: ProjectFileIpcHandlersContext) {
	ipcMain.handle(
		IPC_CHANNELS.projects.deleteAndMedia,
		async (
			_,
			payload: {
				projectPath?: string | null;
				videoPath?: string | null;
				webcamPath?: string | null;
			},
		) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const deletedPaths: string[] = [];
				const skippedPaths: string[] = [];
				const candidates = [
					payload.projectPath ?? null,
					normalizeVideoSourcePath(payload.videoPath) ?? payload.videoPath ?? null,
					payload.webcamPath ?? null,
				].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

				for (const candidate of new Set(candidates)) {
					const normalizedCandidate = path.resolve(candidate);
					const currentProjectPath = getCurrentProjectPath();
					const isProject =
						currentProjectPath != null &&
						normalizePath(normalizedCandidate) === normalizePath(currentProjectPath);
					const canDelete = isProject || isPathInsideDirectory(normalizedCandidate, recordingsDir);

					if (!canDelete) {
						skippedPaths.push(normalizedCandidate);
						continue;
					}

					const deleted = await deletePathIfExists(normalizedCandidate);
					if (!deleted) {
						continue;
					}

					await Promise.all([
						fs.rm(getTelemetryPathForVideo(normalizedCandidate), { force: true }),
						fs.rm(getKeyboardTelemetryPathForVideo(normalizedCandidate), { force: true }),
					]);
					deletedPaths.push(normalizedCandidate);

					if (
						currentProjectPath &&
						normalizePath(currentProjectPath) === normalizePath(normalizedCandidate)
					) {
						setCurrentProjectPath(null);
					}

					const currentVideoPath = getCurrentVideoPath();
					if (
						currentVideoPath &&
						normalizePath(currentVideoPath) === normalizePath(normalizedCandidate)
					) {
						setCurrentVideoPath(null);
					}

					const currentWebcamPath = getCurrentWebcamPath();
					if (
						currentWebcamPath &&
						normalizePath(currentWebcamPath) === normalizePath(normalizedCandidate)
					) {
						setCurrentWebcamPath(null);
					}
				}

				return {
					success: true,
					deletedPaths,
					skippedPaths,
					message: deletedPaths.length > 0 ? "Deleted project assets" : "Nothing was deleted",
				};
			} catch (error) {
				console.error("Failed to delete project and media:", error);
				return {
					success: false,
					message: "Failed to delete project and media",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.recordingDirectory.get, async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			return {
				success: true,
				path: recordingsDir,
				isDefault: recordingsDir === defaultRecordingsDir,
			};
		} catch (error) {
			return {
				success: false,
				path: defaultRecordingsDir,
				isDefault: true,
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.recordingDirectory.choose, async () => {
		try {
			const current = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: "Choose recordings folder",
				defaultPath: current,
				properties: ["openDirectory", "createDirectory", "promptToCreate"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, path: current };
			}

			const selectedPath = path.resolve(result.filePaths[0]);
			await fs.mkdir(selectedPath, { recursive: true });
			await fs.access(selectedPath, fsConstants.W_OK);
			await persistRecordingsDirectorySetting(selectedPath);

			return {
				success: true,
				path: selectedPath,
				isDefault: selectedPath === defaultRecordingsDir,
			};
		} catch (error) {
			return { success: false, error: String(error), message: "Failed to set recordings folder" };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.projects.saveFile,
		async (_, projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
			try {
				const recordingsDir = await getRecordingsDir();
				const trustedExistingProjectPath = isTrustedProjectPath(existingProjectPath)
					? existingProjectPath
					: null;

				if (trustedExistingProjectPath) {
					await fs.writeFile(
						trustedExistingProjectPath,
						JSON.stringify(projectData, null, 2),
						"utf-8",
					);
					setCurrentProjectPath(trustedExistingProjectPath);
					return {
						success: true,
						path: trustedExistingProjectPath,
						message: "Project saved successfully",
					};
				}

				const safeName = sanitizeFileNameBase(suggestedName, `project-${Date.now()}`);
				const defaultName = ensureFileExtension(safeName, projectFileExtension);

				const result = await dialog.showSaveDialog({
					title: `Save ${brandName} Project`,
					defaultPath: path.join(recordingsDir, defaultName),
					filters: [
						{ name: `${brandName} Project`, extensions: [projectFileExtension] },
						{ name: "JSON", extensions: ["json"] },
					],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return {
						success: false,
						canceled: true,
						message: "Save project canceled",
					};
				}

				await fs.writeFile(result.filePath, JSON.stringify(projectData, null, 2), "utf-8");
				setCurrentProjectPath(result.filePath);

				return {
					success: true,
					path: result.filePath,
					message: "Project saved successfully",
				};
			} catch (error) {
				console.error("Failed to save project file:", error);
				return {
					success: false,
					message: "Failed to save project file",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.projects.loadFile, async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: `Open ${brandName} Project`,
				defaultPath: recordingsDir,
				filters: [
					{ name: `${brandName} Project`, extensions: projectFileExtensions },
					{ name: "JSON", extensions: ["json"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, message: "Open project canceled" };
			}

			const filePath = result.filePaths[0];
			const content = await fs.readFile(filePath, "utf-8");
			const project = JSON.parse(content);
			setCurrentProjectPath(filePath);
			setCurrentMicrophoneAudioPath(null);
			if (project && typeof project === "object" && typeof project.videoPath === "string") {
				setCurrentVideoPath(normalizeVideoSourcePath(project.videoPath) ?? project.videoPath);
			}

			return {
				success: true,
				path: filePath,
				project,
			};
		} catch (error) {
			console.error("Failed to load project file:", error);
			return {
				success: false,
				message: "Failed to load project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle(IPC_CHANNELS.projects.loadCurrentFile, async () => {
		try {
			const currentProjectPath = getCurrentProjectPath();
			if (!currentProjectPath) {
				return { success: false, message: "No active project" };
			}

			const content = await fs.readFile(currentProjectPath, "utf-8");
			const project = JSON.parse(content);
			setCurrentMicrophoneAudioPath(null);
			if (project && typeof project === "object" && typeof project.videoPath === "string") {
				setCurrentVideoPath(normalizeVideoSourcePath(project.videoPath) ?? project.videoPath);
			}
			return {
				success: true,
				path: currentProjectPath,
				project,
			};
		} catch (error) {
			console.error("Failed to load current project file:", error);
			return {
				success: false,
				message: "Failed to load current project file",
				error: String(error),
			};
		}
	});
}
