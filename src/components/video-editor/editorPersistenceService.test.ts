import { describe, expect, it } from "vitest";
import { editorPersistenceService } from "./editorPersistenceService";

describe("editorPersistenceService", () => {
	it("builds stable project artifacts", () => {
		const artifacts = editorPersistenceService.buildProjectArtifacts({
			sourcePath: "/tmp/demo-recording.mp4",
			editor: {},
			videoName: "Launch Demo",
		});

		expect(artifacts.fileNameBase).toBe("Launch Demo");
		expect(artifacts.projectData.videoPath).toBe("/tmp/demo-recording.mp4");
		expect(artifacts.projectData.videoName).toBe("Launch Demo");
		expect(artifacts.projectSnapshot).toBe(JSON.stringify(artifacts.projectData));
	});

	it("falls back to the source video name when no explicit video name exists", () => {
		const artifacts = editorPersistenceService.buildProjectArtifacts({
			sourcePath: "/tmp/demo-recording.mp4",
			editor: {},
		});

		expect(artifacts.fileNameBase).toBe("demo-recording");
		expect(artifacts.projectData.videoName).toBeUndefined();
	});

	it("detects unsaved changes only for named projects with a changed snapshot", () => {
		expect(
			editorPersistenceService.hasUnsavedChanges({
				currentProjectPath: null,
				currentProjectSnapshot: "a",
				lastSavedSnapshot: "b",
			}),
		).toBe(false);

		expect(
			editorPersistenceService.hasUnsavedChanges({
				currentProjectPath: "/tmp/demo.screenmint",
				currentProjectSnapshot: "a",
				lastSavedSnapshot: "a",
			}),
		).toBe(false);

		expect(
			editorPersistenceService.hasUnsavedChanges({
				currentProjectPath: "/tmp/demo.screenmint",
				currentProjectSnapshot: "a",
				lastSavedSnapshot: "b",
			}),
		).toBe(true);
	});
});
