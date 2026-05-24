import { describe, expect, it } from "vitest";
import {
	buildLayeredRecordingManifest,
	type LayerCaptureSource,
	normalizeLayerCaptureSources,
} from "./layeredCapture";

const sources: LayerCaptureSource[] = [
	{
		id: "screen:1",
		kind: "display",
		source: { id: "screen:1", name: "Studio Display", sourceType: "screen" },
		layerId: "display-layer",
	},
	{
		id: "window:notes",
		kind: "window",
		source: {
			id: "window:notes",
			name: "Notes",
			sourceType: "window",
			windowTitle: "Launch notes",
		},
		layerId: "notes-layer",
	},
	{
		id: "window:notes",
		kind: "window",
		source: { id: "window:notes", name: "Notes duplicate", sourceType: "window" },
		layerId: "duplicate-layer",
	},
];

describe("layered capture planning", () => {
	it("deduplicates selected sources and marks one primary source", () => {
		const normalized = normalizeLayerCaptureSources(sources, "darwin");

		expect(normalized).toHaveLength(2);
		expect(normalized[0]).toMatchObject({ id: "screen:1", kind: "display", isPrimary: true });
		expect(normalized[1]).toMatchObject({
			id: "window:notes",
			kind: "window",
			isPrimary: false,
		});
	});

	it("uses crop-derived layer limitations for secondary Linux windows", () => {
		const manifest = buildLayeredRecordingManifest({
			id: "manifest-1",
			platform: "linux",
			startedAt: "2026-05-24T00:00:00.000Z",
			sources,
		});

		expect(manifest.sources.map((source) => source.kind)).toEqual(["display", "derived-crop"]);
		expect(manifest.layers.map((layer) => layer.id)).toEqual(["display-layer", "notes-layer"]);
		expect(manifest.limitations.join("\n")).toContain("Crop-derived layers");
	});

	it("records Windows WGC readiness as a manifest limitation", () => {
		const manifest = buildLayeredRecordingManifest({
			id: "manifest-2",
			platform: "win32",
			startedAt: "2026-05-24T00:00:00.000Z",
			sources: sources.slice(0, 2),
		});

		expect(manifest.status).toBe("planned");
		expect(manifest.limitations.join("\n")).toContain("Windows 10 19041+");
	});
});
