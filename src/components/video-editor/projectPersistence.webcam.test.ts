import { describe, expect, it } from "vitest";
import {
	createProjectData,
	normalizeProjectEditor,
	normalizeWebcamSessionMetadata,
	validateProjectData,
} from "./projectPersistence";
import {
	DEFAULT_CAMERA_LAYOUT_MOTION_PRESET,
	DEFAULT_CAMERA_LAYOUT_TRANSITION_IN_MS,
	DEFAULT_CAMERA_LAYOUT_TRANSITION_OUT_MS,
	DEFAULT_CAMERA_SIZE_DURING_ZOOM,
	DEFAULT_WEBCAM_EFFECTS,
	DEFAULT_WEBCAM_PREVIEW_MODE,
	DEFAULT_WEBCAM_REGION,
} from "./types";

describe("webcam project persistence", () => {
	it("normalizes missing webcam fields to safe defaults", () => {
		const result = normalizeProjectEditor({});

		expect(result.webcamPath).toBeUndefined();
		expect(result.webcamRegion).toEqual(DEFAULT_WEBCAM_REGION);
		expect(result.webcamEffects).toEqual(DEFAULT_WEBCAM_EFFECTS);
		expect(result.showWebcam).toBe(true);
		expect(result.mirrorWebcam).toBe(false);
		expect(result.cameraSizeDuringZoom).toBe(DEFAULT_CAMERA_SIZE_DURING_ZOOM);
		expect(result.cameraLayouts).toEqual([]);
		expect(result.webcamPreviewMode).toBe(DEFAULT_WEBCAM_PREVIEW_MODE);
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
				borderColor: "#F59E0B",
			},
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 1000,
					endMs: 500,
					mode: "fullscreen",
					transitionInMs: 420,
					transitionOutMs: 510,
					motionPreset: "smooth",
					regionOverride: {
						position: { x: -10, y: 110 },
						size: { width: 150, height: 0 },
						borderWidth: 3,
					},
				},
			],
			webcamEffects: {
				presetId: "spotlight",
				backgroundMode: "blur",
				backgroundBlurStrength: 48,
				portraitScale: 1.2,
				portraitOffset: { x: 0.5, y: -0.5 },
			},
		});

		expect(result.webcamPath).toBe("/tmp/webcam.webm");
		expect(result.showWebcam).toBe(false);
		expect(result.mirrorWebcam).toBe(true);
		expect(result.cameraSizeDuringZoom).toBe(1);
		expect(result.webcamRegion.position).toEqual({ x: 0, y: 50 });
		expect(result.webcamRegion.size).toEqual({ width: 60, height: 50 });
		expect(result.webcamEffects).toMatchObject({
			presetId: "spotlight",
			backgroundMode: "blur",
			backgroundBlurStrength: 32,
			portraitScale: 1.2,
			portraitOffset: { x: 0.3, y: -0.3 },
		});
		expect(result.cameraLayouts).toHaveLength(1);
		expect(result.cameraLayouts[0]).toMatchObject({
			id: "camera-layout-1",
			startMs: 1000,
			endMs: 1000,
			mode: "fullscreen",
			transitionInMs: 420,
			transitionOutMs: 510,
			motionPreset: "smooth",
			regionOverride: {
				position: { x: 0, y: 100 },
				size: { width: 100, height: 1 },
				borderWidth: 3,
			},
		});
	});

	it("clamps oversized square webcam regions inside the frame", () => {
		const result = normalizeProjectEditor({
			webcamRegion: {
				position: { x: 65, y: 80 },
				size: { width: 45, height: 30 },
				shape: "square",
				borderRadius: 25,
				opacity: 1,
				borderWidth: 3,
				borderColor: "#fff",
			},
		});

		expect(result.webcamRegion.shape).toBe("square");
		expect(result.webcamRegion.size).toEqual({ width: 45, height: 45 });
		expect(result.webcamRegion.position).toEqual({ x: 55, y: 55 });
		expect(result.webcamRegion.borderRadius).toBe(25);
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
					transitionInMs: 300,
					transitionOutMs: 180,
					motionPreset: "instant",
				},
			],
			webcamEffects: {
				presetId: "floating-card",
				backgroundMode: "solid",
				backgroundColor: "#0f172a",
			},
		});

		const project = createProjectData("/tmp/video.mp4", editor);

		expect(validateProjectData(project)).toBe(true);
		expect(project.editor.webcamPath).toBe("/tmp/webcam.webm");
		expect(project.editor.mirrorWebcam).toBe(true);
		expect(project.editor.webcamEffects).toMatchObject({
			presetId: "floating-card",
			backgroundMode: "solid",
			backgroundColor: "#0f172a",
		});
		expect(project.editor.cameraLayouts).toEqual([
			{
				id: "camera-layout-1",
				startMs: 0,
				endMs: 1200,
				mode: "hidden",
				transitionInMs: 300,
				transitionOutMs: 180,
				motionPreset: "instant",
			},
		]);
	});

	it("defaults missing camera layout transition metadata", () => {
		const result = normalizeProjectEditor({
			cameraLayouts: [
				{
					id: "camera-layout-1",
					startMs: 0,
					endMs: 1000,
					mode: "default",
				},
			],
		});

		expect(result.cameraLayouts[0]).toMatchObject({
			transitionInMs: DEFAULT_CAMERA_LAYOUT_TRANSITION_IN_MS,
			transitionOutMs: DEFAULT_CAMERA_LAYOUT_TRANSITION_OUT_MS,
			motionPreset: DEFAULT_CAMERA_LAYOUT_MOTION_PRESET,
		});
	});

	it("normalizes persisted webcam session metadata", () => {
		const metadata = normalizeWebcamSessionMetadata({
			sessionCaptureProfile: {
				width: 1919.9,
				height: 1079.9,
				frameRate: 59.6,
				aspectRatio: 16 / 9,
			},
			captureProfile: {
				width: 1920.4,
				height: 1080.2,
				frameRate: 61.7,
				aspectRatio: 16 / 9,
			},
			segmentOffsetsMs: [0, 1000.8, -25, Number.NaN],
			segmentProfiles: [
				{
					width: 1920.4,
					height: 1080.2,
					frameRate: 61.7,
					aspectRatio: 16 / 9,
				},
				null,
			],
			segmentCompatibilityMode: "normalized",
			renderPipelineVersion: 3.2,
		});

		expect(metadata).toEqual({
			sessionCaptureProfile: {
				width: 1920,
				height: 1080,
				frameRate: 60,
				aspectRatio: 16 / 9,
			},
			captureProfile: {
				width: 1920,
				height: 1080,
				frameRate: 62,
				aspectRatio: 16 / 9,
			},
			segmentOffsetsMs: [0, 1001, 0],
			segmentProfiles: [
				{
					width: 1920,
					height: 1080,
					frameRate: 62,
					aspectRatio: 16 / 9,
				},
				null,
			],
			segmentCompatibilityMode: "normalized",
			renderPipelineVersion: 3,
		});
	});

	it("stores webcam session metadata alongside the project", () => {
		const editor = normalizeProjectEditor({
			webcamPath: "/tmp/webcam.webm",
			webcamPreviewMode: "performance",
		});
		const project = createProjectData("/tmp/video.mp4", editor, {
			sessionCaptureProfile: {
				width: 1920,
				height: 1080,
				frameRate: 30,
				aspectRatio: 16 / 9,
			},
			captureProfile: {
				width: 1920,
				height: 1080,
				frameRate: 30,
				aspectRatio: 16 / 9,
			},
			segmentOffsetsMs: [0, 1200],
			segmentProfiles: [
				{
					width: 1920,
					height: 1080,
					frameRate: 30,
					aspectRatio: 16 / 9,
				},
			],
			segmentCompatibilityMode: "copy",
			renderPipelineVersion: 2,
		});

		expect(validateProjectData(project)).toBe(true);
		expect(project.editor.webcamPreviewMode).toBe("performance");
		expect(project.webcamSessionMetadata?.segmentOffsetsMs).toEqual([0, 1200]);
		expect(project.webcamSessionMetadata?.sessionCaptureProfile?.width).toBe(1920);
		expect(project.webcamSessionMetadata?.segmentCompatibilityMode).toBe("copy");
	});
});
