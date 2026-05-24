import type { EditorLayer } from "@/components/video-editor/layerModel";
import type { IpcSelectedSource } from "@/electron-ipc/contracts";
import type { SelectedArea } from "./session";

export type LayerCapturePlatform = "darwin" | "win32" | "linux";
export type LayerCaptureSourceKind = "display" | "window" | "area" | "derived-crop";
export type LayerCaptureStatus = "planned" | "recording" | "completed" | "failed" | "unsupported";

export interface LayerCaptureSource {
	id: string;
	kind: LayerCaptureSourceKind;
	source: IpcSelectedSource | null;
	selectedArea?: SelectedArea | null;
	layerId: string;
	isPrimary?: boolean;
}

export interface LayeredRecordingManifest {
	id: string;
	platform: LayerCapturePlatform;
	startedAt: string;
	status: LayerCaptureStatus;
	sources: LayerCaptureSource[];
	layers: EditorLayer[];
	limitations: string[];
}

function sourceKindFromIpcSource(source: IpcSelectedSource | null): LayerCaptureSourceKind {
	if (!source) return "area";
	if (source.sourceType === "window" || source.id?.startsWith("window:")) return "window";
	return "display";
}

function stableLayerId(source: IpcSelectedSource | null, index: number) {
	const sourceId = source?.id ?? `source-${index + 1}`;
	return `layer-capture-${sourceId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function sourceName(source: IpcSelectedSource | null, fallback: string) {
	const rawName = source?.windowTitle ?? source?.name ?? fallback;
	return rawName.trim() || fallback;
}

export function getLayerCapturePlatform(platform: NodeJS.Platform): LayerCapturePlatform {
	if (platform === "darwin" || platform === "win32") return platform;
	return "linux";
}

export function normalizeLayerCaptureSources(
	sources: LayerCaptureSource[],
	platform: LayerCapturePlatform,
): LayerCaptureSource[] {
	const deduped = new Map<string, LayerCaptureSource>();

	sources.forEach((candidate, index) => {
		const source = candidate?.source ?? null;
		const id = candidate?.id || source?.id || `capture-source-${index + 1}`;
		if (deduped.has(id)) return;

		const inferredKind = candidate?.kind ?? sourceKindFromIpcSource(source);
		const kind =
			platform === "linux" && index > 0 && inferredKind === "window"
				? "derived-crop"
				: inferredKind;

		deduped.set(id, {
			id,
			kind,
			source,
			selectedArea: candidate?.selectedArea ?? null,
			layerId: candidate?.layerId || stableLayerId(source, index),
			isPrimary: index === 0,
		});
	});

	return Array.from(deduped.values()).map((source, index) => ({
		...source,
		isPrimary: index === 0,
	}));
}

export function buildLayeredRecordingManifest({
	id,
	platform,
	startedAt,
	sources,
}: {
	id: string;
	platform: LayerCapturePlatform;
	startedAt: string;
	sources: LayerCaptureSource[];
}): LayeredRecordingManifest {
	const normalizedSources = normalizeLayerCaptureSources(sources, platform);
	const layers: EditorLayer[] = normalizedSources.map((source, index) => ({
		id: source.layerId,
		type: "window",
		name: sourceName(source.source, index === 0 ? "Primary recording" : `Window ${index + 1}`),
		visible: true,
		locked: false,
		zIndex: index,
		startMs: 0,
		endMs: null,
		opacity: 1,
		transform: {
			x: 0,
			y: 0,
			scale: 1,
			rotation: 0,
		},
		sourceId: source.source?.id,
		sourceName: sourceName(source.source, `Source ${index + 1}`),
		selectedArea: source.selectedArea ?? null,
	}));

	return {
		id,
		platform,
		startedAt,
		status: normalizedSources.length > 0 ? "planned" : "unsupported",
		sources: normalizedSources,
		layers,
		limitations: getLayeredCaptureLimitations(platform, normalizedSources),
	};
}

export function getLayeredCaptureLimitations(
	platform: LayerCapturePlatform,
	sources: LayerCaptureSource[],
) {
	const limitations: string[] = [];
	if (platform === "linux" && sources.some((source) => source.kind === "derived-crop")) {
		limitations.push(
			"Linux layered window capture uses crop-derived layers unless native window streams are available.",
			"Crop-derived layers can be inaccurate when windows overlap, move, or are covered.",
		);
	}
	if (platform === "win32") {
		limitations.push("Windows layered capture requires Windows 10 19041+ with WGC available.");
	}
	return limitations;
}
