import { describe, expect, it } from "vitest";
import { createProjectData, normalizeProjectEditor, PROJECT_VERSION } from "./projectPersistence";

describe("project persistence v11 layers", () => {
	it("saves new projects with schema version 12 and a primary video layer", () => {
		const editor = normalizeProjectEditor({});
		const project = createProjectData("/tmp/recording.mp4", editor);

		expect(project.version).toBe(PROJECT_VERSION);
		expect(project.version).toBe(12);
		expect(project.editor.layers[0]).toMatchObject({
			id: "layer-primary-video",
			type: "video",
			sourcePath: "/tmp/recording.mp4",
			isPrimary: true,
		});
	});

	it("migrates legacy editor fields into derived layers", () => {
		const editor = normalizeProjectEditor(
			{
				webcamPath: "/tmp/webcam.webm",
				audioRegions: [
					{
						id: "audio-1",
						startMs: 100,
						endMs: 1000,
						sourceType: "file",
						audioPath: "/tmp/music.mp3",
						volume: 0.4,
					},
				],
				annotationRegions: [
					{
						id: "annotation-1",
						startMs: 200,
						endMs: 700,
						type: "text",
						content: "Hello",
						position: { x: 50, y: 50 },
						size: { width: 20, height: 10 },
						style: {},
					},
				],
				captionRegions: [{ id: "caption-1", startMs: 0, endMs: 500, text: "Caption" }],
			},
			{ fallbackVideoPath: "/tmp/recording.mp4" },
		);

		expect(editor.layers.map((layer) => layer.type)).toEqual([
			"video",
			"audio",
			"webcam",
			"annotation",
			"caption",
		]);
	});

	it("drops invalid explicit layers but preserves the fallback primary layer", () => {
		const editor = normalizeProjectEditor(
			{
				layers: [
					{ id: "bad-video", type: "video", sourcePath: "" },
					{ id: "bad-audio", type: "audio" },
				],
			},
			{ fallbackVideoPath: "/tmp/recording.mp4" },
		);

		expect(editor.layers).toHaveLength(1);
		expect(editor.layers[0]).toMatchObject({
			type: "video",
			sourcePath: "/tmp/recording.mp4",
		});
	});
});
