import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { app, dialog, ipcMain } from "electron";
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

const RECENT_PROJECTS_LIMIT = 30;
const PROJECT_LIST_LIMIT = 60;

export interface ProjectListEntry {
	path: string;
	name: string;
	modifiedAt: number;
	thumbnail: string | null;
}

/** Writes via a temp file + rename so a crash mid-save never leaves a half-written project. */
export async function writeProjectFileAtomic(filePath: string, data: unknown) {
	const tempPath = `${filePath}.${process.pid}.tmp`;
	await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
	try {
		await fs.rename(tempPath, filePath);
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		throw error;
	}
}

function getRecentProjectsPath() {
	return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecentProjects(): Promise<string[]> {
	try {
		const parsed = JSON.parse(await fs.readFile(getRecentProjectsPath(), "utf-8"));
		return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
	} catch {
		return [];
	}
}

async function rememberRecentProject(filePath: string) {
	const recent = (await readRecentProjects()).filter((entry) => entry !== filePath);
	recent.unshift(filePath);
	await fs
		.writeFile(getRecentProjectsPath(), JSON.stringify(recent.slice(0, RECENT_PROJECTS_LIMIT)))
		.catch(() => undefined);
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
					await writeProjectFileAtomic(trustedExistingProjectPath, projectData);
					setCurrentProjectPath(trustedExistingProjectPath);
					void rememberRecentProject(trustedExistingProjectPath);
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

				await writeProjectFileAtomic(result.filePath, projectData);
				setCurrentProjectPath(result.filePath);
				void rememberRecentProject(result.filePath);

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
			void rememberRecentProject(filePath);
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

	/** Recent projects plus project files in the recordings folder, newest first. */
	async function collectProjectEntries(): Promise<ProjectListEntry[]> {
		const recordingsDir = await getRecordingsDir();
		const names = await fs.readdir(recordingsDir).catch(() => [] as string[]);
		const inRecordings = names
			.filter((name) => projectFileExtensions.includes(path.extname(name).slice(1).toLowerCase()))
			.map((name) => path.join(recordingsDir, name));
		const candidates = [...new Set([...(await readRecentProjects()), ...inRecordings])];
		const entries = await Promise.all(
			candidates.map(async (filePath): Promise<ProjectListEntry | null> => {
				try {
					const stat = await fs.stat(filePath);
					if (!stat.isFile()) return null;
					const project = JSON.parse(await fs.readFile(filePath, "utf-8"));
					if (!project || typeof project !== "object" || typeof project.videoPath !== "string") {
						return null;
					}
					return {
						path: filePath,
						name:
							typeof project.videoName === "string" && project.videoName.trim()
								? project.videoName
								: path.basename(filePath, path.extname(filePath)),
						modifiedAt: stat.mtimeMs,
						thumbnail:
							typeof project.thumbnail === "string" && project.thumbnail.startsWith("data:image/")
								? project.thumbnail
								: null,
					};
				} catch {
					return null;
				}
			}),
		);
		return entries
			.filter((entry): entry is ProjectListEntry => entry !== null)
			.sort((a, b) => b.modifiedAt - a.modifiedAt)
			.slice(0, PROJECT_LIST_LIMIT);
	}

	ipcMain.handle(IPC_CHANNELS.projects.list, async () => {
		try {
			return { success: true, projects: await collectProjectEntries() };
		} catch (error) {
			console.error("Failed to list projects:", error);
			return { success: false, projects: [], error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.projects.openPath, async (_, filePath: unknown) => {
		try {
			// Only open paths the browser listed; never arbitrary renderer-supplied paths.
			const allowed = (await collectProjectEntries()).some((entry) => entry.path === filePath);
			if (typeof filePath !== "string" || !allowed) {
				return { success: false, message: "Project is not in the project list" };
			}
			const project = JSON.parse(await fs.readFile(filePath, "utf-8"));
			setCurrentProjectPath(filePath);
			setCurrentMicrophoneAudioPath(null);
			if (project && typeof project === "object" && typeof project.videoPath === "string") {
				setCurrentVideoPath(normalizeVideoSourcePath(project.videoPath) ?? project.videoPath);
			}
			void rememberRecentProject(filePath);
			return { success: true, path: filePath, project };
		} catch (error) {
			console.error("Failed to open project:", error);
			return { success: false, message: "Failed to open project", error: String(error) };
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
