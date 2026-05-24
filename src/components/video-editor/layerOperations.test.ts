import { describe, expect, it } from "vitest";
import { buildPrimaryVideoLayer, normalizeEditorLayers } from "./layerModel";
import {
	deleteEditorLayer,
	moveEditorLayerZ,
	renameEditorLayer,
	setEditorLayerLocked,
	setEditorLayerOpacity,
	setEditorLayerTiming,
	setEditorLayerTransform,
	setEditorLayerVisibility,
} from "./layerOperations";

const layers = normalizeEditorLayers([
	buildPrimaryVideoLayer("/tmp/primary.mp4"),
	{
		id: "window",
		type: "window",
		name: "Window",
		visible: true,
		locked: false,
		zIndex: 1,
		startMs: 0,
		endMs: null,
		opacity: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0 },
		sourceId: "window:1",
	},
]);

describe("layer operations", () => {
	it("updates visibility even when a layer is locked", () => {
		const locked = setEditorLayerLocked(layers, "window", true);
		const hidden = setEditorLayerVisibility(locked, "window", false);

		expect(hidden.find((layer) => layer.id === "window")?.visible).toBe(false);
	});

	it("prevents destructive edits while locked", () => {
		const locked = setEditorLayerLocked(layers, "window", true);

		expect(setEditorLayerTransform(locked, "window", { x: 100 })).toEqual(locked);
		expect(setEditorLayerOpacity(locked, "window", 0.4)).toEqual(locked);
		expect(setEditorLayerTiming(locked, "window", { startMs: 500, endMs: 1000 })).toEqual(locked);
		expect(deleteEditorLayer(locked, "window")).toEqual(locked);
	});

	it("reorders editable layers by z-index", () => {
		const moved = moveEditorLayerZ(layers, "layer-primary-video", "front");

		expect(moved.map((layer) => [layer.id, layer.zIndex])).toEqual([
			["window", 0],
			["layer-primary-video", 1],
		]);
	});

	it("updates transform, opacity, timing, and delete for unlocked layers", () => {
		const transformed = setEditorLayerTransform(layers, "window", { x: 32, scale: 1.5 });
		const faded = setEditorLayerOpacity(transformed, "window", 0.5);
		const timed = setEditorLayerTiming(faded, "window", { startMs: 200, endMs: 900 });
		const final = timed.find((layer) => layer.id === "window");

		expect(final?.transform).toMatchObject({ x: 32, scale: 1.5 });
		expect(final?.opacity).toBe(0.5);
		expect(final?.startMs).toBe(200);
		expect(final?.endMs).toBe(900);
		expect(deleteEditorLayer(timed, "window").map((layer) => layer.id)).toEqual([
			"layer-primary-video",
		]);
	});

	it("renames layers and stores crop controls through the transform path", () => {
		const renamed = renameEditorLayer(layers, "window", "Demo window");
		const cropped = setEditorLayerTransform(renamed, "window", {
			crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
		});
		const final = cropped.find((layer) => layer.id === "window");

		expect(final?.name).toBe("Demo window");
		expect(final?.transform.crop).toEqual({ x: 0.1, y: 0.2, width: 0.7, height: 0.6 });
	});
});
