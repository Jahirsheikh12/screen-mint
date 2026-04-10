import { describe, expect, it } from "vitest";
import { editorPersistenceService } from "./editorPersistenceService";

describe("editorPersistenceService", () => {
	it("builds stable project artifacts", () => {
		const artifacts = editorPersistenceService.buildProjectArtifacts({
			sourcePath: "/tmp/demo-recording.mp4",
			editor: {},
		});

		expect(artifacts.fileNameBase).toBe("demo-recording");
		expect(artifacts.projectData.videoPath).toBe("/tmp/demo-recording.mp4");
		expect(artifacts.projectSnapshot).toBe(JSON.stringify(artifacts.projectData));
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
