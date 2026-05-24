import { describe, expect, it } from "vitest";
import {
	buildPrimaryVideoLayer,
	ensurePrimaryVideoLayer,
	getVisibleLayersAtTime,
	normalizeEditorLayer,
	normalizeEditorLayers,
	sortEditorLayersForRender,
} from "./layerModel";

describe("editor layer model", () => {
	it("migrates legacy projects into one primary video layer", () => {
		expect(normalizeEditorLayers(undefined, "/tmp/demo.mp4")).toEqual([
			buildPrimaryVideoLayer("/tmp/demo.mp4"),
		]);
	});

	it("ensures loaded videos always have an editable primary layer", () => {
		const layers = normalizeEditorLayers([
			{
				id: "pending-window",
				type: "window",
				name: "Pending window",
				visible: true,
				locked: false,
				zIndex: 0,
				startMs: 0,
				endMs: null,
				opacity: 1,
				transform: { x: 0, y: 0, scale: 1, rotation: 0 },
				sourceId: "window:1",
			},
		]);

		expect(ensurePrimaryVideoLayer(layers, "/tmp/demo.mp4", 1200).map((layer) => layer.id)).toEqual(
			["layer-primary-video", "pending-window"],
		);
		expect(ensurePrimaryVideoLayer([], "/tmp/demo.mp4")[0]).toMatchObject({
			type: "video",
			sourcePath: "/tmp/demo.mp4",
			isPrimary: true,
		});
	});

	it("keeps render order stable by z-index and layer start time", () => {
		const top = normalizeEditorLayer({
			id: "top",
			type: "annotation",
			annotationId: "a1",
			name: "Top",
			zIndex: 10,
			startMs: 0,
		});
		const bottom = normalizeEditorLayer({
			id: "bottom",
			type: "video",
			sourcePath: "/tmp/demo.mp4",
			name: "Bottom",
			zIndex: 0,
			startMs: 100,
		});
		const middle = normalizeEditorLayer({
			id: "middle",
			type: "screenshot",
			imagePath: "/tmp/demo.png",
			name: "Middle",
			zIndex: 5,
			startMs: 50,
		});

		expect(sortEditorLayersForRender([top!, bottom!, middle!]).map((layer) => layer.id)).toEqual([
			"bottom",
			"middle",
			"top",
		]);
	});

	it("filters visible layers by time range", () => {
		const layers = normalizeEditorLayers([
			{ id: "past", type: "video", sourcePath: "/tmp/past.mp4", startMs: 0, endMs: 999 },
			{ id: "current", type: "video", sourcePath: "/tmp/current.mp4", startMs: 1000, endMs: 2000 },
			{ id: "hidden", type: "caption", startMs: 1000, endMs: 2000, visible: false },
			{
				id: "open",
				type: "audio",
				assetId: "soft-horizon",
				startMs: 1500,
				endMs: null,
				volume: 0.5,
			},
		]);

		expect(getVisibleLayersAtTime(layers, 1500).map((layer) => layer.id)).toEqual([
			"current",
			"open",
		]);
	});
});
