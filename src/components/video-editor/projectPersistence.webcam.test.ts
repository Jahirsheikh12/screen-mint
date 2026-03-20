import { describe, expect, it } from "vitest";
import {
	createProjectData,
	normalizeProjectEditor,
	validateProjectData,
} from "./projectPersistence";
import { DEFAULT_CAMERA_SIZE_DURING_ZOOM, DEFAULT_WEBCAM_REGION } from "./types";

describe("webcam project persistence", () => {
	it("normalizes missing webcam fields to safe defaults", () => {
		const result = normalizeProjectEditor({});

		expect(result.webcamPath).toBeUndefined();
		expect(result.webcamRegion).toEqual(DEFAULT_WEBCAM_REGION);
		expect(result.showWebcam).toBe(true);
		expect(result.mirrorWebcam).toBe(false);
		expect(result.cameraSizeDuringZoom).toBe(DEFAULT_CAMERA_SIZE_DURING_ZOOM);
		expect(result.cameraLayouts).toEqual([]);
	});

	it("normalizes webcam regions and camera layouts", () => {
		const result = normalizeProjectEditor({
			webcamPath: "/tmp/webcam.webm",
			showWebcam: false,
			mirrorWebcam: true,
			cameraSizeDuringZoom: 5,
			webcamRegion: {
				position: { x: -20, y: 120 },
				size: { width: 60, height: 50 },
				shape: "rectangle",
				borderRadius: 16,
				opacity: 0.5,
				borderWidth: 4,
				borderColor: "#10B981",
			},
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 1000,
					endMs: 500,
					mode: "fullscreen",
					regionOverride: {
						position: { x: -10, y: 110 },
						size: { width: 150, height: 0 },
						borderWidth: 3,
					},
				},
			],
		});

		expect(result.webcamPath).toBe("/tmp/webcam.webm");
		expect(result.showWebcam).toBe(false);
		expect(result.mirrorWebcam).toBe(true);
		expect(result.cameraSizeDuringZoom).toBe(1);
		expect(result.webcamRegion.position).toEqual({ x: 0, y: 100 });
		expect(result.webcamRegion.size).toEqual({ width: 60, height: 50 });
		expect(result.cameraLayouts).toHaveLength(1);
		expect(result.cameraLayouts[0]).toMatchObject({
			id: "camera-layout-1",
			startMs: 1000,
			endMs: 1000,
			mode: "fullscreen",
			regionOverride: {
				position: { x: 0, y: 100 },
				size: { width: 100, height: 1 },
				borderWidth: 3,
			},
		});
	});

	it("round-trips webcam editor data through createProjectData", () => {
		const editor = normalizeProjectEditor({
			webcamPath: "/tmp/webcam.webm",
			showWebcam: true,
			mirrorWebcam: true,
			cameraSizeDuringZoom: 0.65,
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1200,
					mode: "hidden",
				},
			],
		});

		const project = createProjectData("/tmp/video.mp4", editor);

		expect(validateProjectData(project)).toBe(true);
		expect(project.editor.webcamPath).toBe("/tmp/webcam.webm");
		expect(project.editor.mirrorWebcam).toBe(true);
		expect(project.editor.cameraLayouts).toEqual([
			{
				id: "camera-layout-1",
				startMs: 0,
				endMs: 1200,
				mode: "hidden",
			},
		]);
	});
});
