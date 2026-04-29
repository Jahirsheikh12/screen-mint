import { deriveVideoNameFromPath, sanitizeFileNameBase } from "@/lib/fileNames";
import {
	createProjectData,
	normalizeProjectEditor,
	type ProjectEditorState,
} from "./projectPersistence";
import type { WebcamSessionMetadata } from "./types";

export interface BuildProjectArtifactsInput {
	sourcePath: string;
	editor: Partial<ProjectEditorState>;
	videoName?: string;
	webcamSessionMetadata?: WebcamSessionMetadata;
}

export interface ProjectArtifacts {
	projectData: ReturnType<typeof createProjectData>;
	projectSnapshot: string;
	fileNameBase: string;
}

export interface EditorPersistenceService {
	buildProjectArtifacts(input: BuildProjectArtifactsInput): ProjectArtifacts;
	hasUnsavedChanges(input: {
		currentProjectPath: string | null;
		currentProjectSnapshot: string | null;
		lastSavedSnapshot: string | null;
	}): boolean;
}

function buildFileNameBase(sourcePath: string, videoName?: string): string {
	return sanitizeFileNameBase(
		videoName ?? deriveVideoNameFromPath(sourcePath),
		`project-${Date.now()}`,
	);
}

export const editorPersistenceService: EditorPersistenceService = {
	buildProjectArtifacts({ sourcePath, editor, videoName, webcamSessionMetadata }) {
		const projectData = createProjectData(
			sourcePath,
			normalizeProjectEditor(editor),
			webcamSessionMetadata,
			videoName,
		);
		return {
			projectData,
			projectSnapshot: JSON.stringify(projectData),
			fileNameBase: buildFileNameBase(sourcePath, videoName),
		};
	},
	hasUnsavedChanges({ currentProjectPath, currentProjectSnapshot, lastSavedSnapshot }) {
		return Boolean(
			currentProjectPath &&
				currentProjectSnapshot &&
				lastSavedSnapshot &&
				currentProjectSnapshot !== lastSavedSnapshot,
		);
	},
};
