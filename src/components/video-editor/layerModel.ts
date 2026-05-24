import type { SelectedArea } from "@/lib/recording/session";
import { normalizeScene3DSettings, type Scene3DSettings } from "./scene3d";

export type EditorLayerType =
	| "video"
	| "window"
	| "screenshot"
	| "webcam"
	| "audio"
	| "annotation"
	| "caption"
	| "scene-3d";

export interface EditorLayerTransform {
	x: number;
	y: number;
	scale: number;
	rotation: number;
	crop?: { x: number; y: number; width: number; height: number };
}

export interface EditorLayerBase {
	id: string;
	type: EditorLayerType;
	name: string;
	visible: boolean;
	locked: boolean;
	zIndex: number;
	startMs: number;
	endMs: number | null;
	opacity: number;
	transform: EditorLayerTransform;
}

export interface VideoEditorLayer extends EditorLayerBase {
	type: "video";
	sourcePath: string;
	isPrimary: boolean;
}

export interface WindowEditorLayer extends EditorLayerBase {
	type: "window";
	sourcePath?: string;
	sourceId?: string;
	sourceName?: string;
	selectedArea?: SelectedArea | null;
}

export interface ScreenshotEditorLayer extends EditorLayerBase {
	type: "screenshot";
	imagePath: string;
	width?: number;
	height?: number;
}

export interface WebcamEditorLayer extends EditorLayerBase {
	type: "webcam";
	sourcePath: string;
}

export interface AudioEditorLayer extends EditorLayerBase {
	type: "audio";
	audioPath?: string;
	assetId?: string;
	volume: number;
}

export interface AnnotationEditorLayer extends EditorLayerBase {
	type: "annotation";
	annotationId: string;
}

export interface CaptionEditorLayer extends EditorLayerBase {
	type: "caption";
	trackId?: string;
}

export interface Scene3DEditorLayer extends EditorLayerBase {
	type: "scene-3d";
	scene: Scene3DSettings;
}

export type EditorLayer =
	| VideoEditorLayer
	| WindowEditorLayer
	| ScreenshotEditorLayer
	| WebcamEditorLayer
	| AudioEditorLayer
	| AnnotationEditorLayer
	| CaptionEditorLayer
	| Scene3DEditorLayer;

export const EDITOR_LAYER_TYPES: EditorLayerType[] = [
	"video",
	"window",
	"screenshot",
	"webcam",
	"audio",
	"annotation",
	"caption",
	"scene-3d",
];

export const DEFAULT_LAYER_TRANSFORM: EditorLayerTransform = {
	x: 0,
	y: 0,
	scale: 1,
	rotation: 0,
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

function normalizeTransform(candidate: unknown): EditorLayerTransform {
	if (!candidate || typeof candidate !== "object") {
		return { ...DEFAULT_LAYER_TRANSFORM };
	}

	const raw = candidate as Partial<EditorLayerTransform>;
	const crop =
		raw.crop && typeof raw.crop === "object"
			? {
					x: clamp(raw.crop.x, 0, 1, 0),
					y: clamp(raw.crop.y, 0, 1, 0),
					width: clamp(raw.crop.width, 0.001, 1, 1),
					height: clamp(raw.crop.height, 0.001, 1, 1),
				}
			: undefined;

	return {
		x: clamp(raw.x, -500, 500, DEFAULT_LAYER_TRANSFORM.x),
		y: clamp(raw.y, -500, 500, DEFAULT_LAYER_TRANSFORM.y),
		scale: clamp(raw.scale, 0.01, 20, DEFAULT_LAYER_TRANSFORM.scale),
		rotation: clamp(raw.rotation, -360, 360, DEFAULT_LAYER_TRANSFORM.rotation),
		...(crop ? { crop } : {}),
	};
}

export function buildPrimaryVideoLayer(
	videoPath: string,
	durationMs?: number | null,
): VideoEditorLayer {
	return {
		id: "layer-primary-video",
		type: "video",
		name: "Primary recording",
		visible: true,
		locked: false,
		zIndex: 0,
		startMs: 0,
		endMs: typeof durationMs === "number" && Number.isFinite(durationMs) ? durationMs : null,
		opacity: 1,
		transform: { ...DEFAULT_LAYER_TRANSFORM },
		sourcePath: videoPath,
		isPrimary: true,
	};
}

export function normalizeEditorLayer(candidate: unknown): EditorLayer | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Partial<EditorLayer> & Record<string, unknown>;
	if (!EDITOR_LAYER_TYPES.includes(raw.type as EditorLayerType)) {
		return null;
	}

	const startMs = Math.round(clamp(raw.startMs, 0, 60 * 60 * 1000, 0));
	const endMs =
		typeof raw.endMs === "number" && Number.isFinite(raw.endMs)
			? Math.max(startMs, Math.round(raw.endMs))
			: null;
	const base = {
		id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `layer-${raw.type}`,
		name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : String(raw.type),
		visible: raw.visible !== false,
		locked: Boolean(raw.locked),
		zIndex: Math.round(clamp(raw.zIndex, -1000, 1000, 0)),
		startMs,
		endMs,
		opacity: clamp(raw.opacity, 0, 1, 1),
		transform: normalizeTransform(raw.transform),
	};

	switch (raw.type) {
		case "video": {
			const sourcePath = typeof raw.sourcePath === "string" ? raw.sourcePath.trim() : "";
			if (!sourcePath) return null;
			return {
				...base,
				type: "video",
				sourcePath,
				isPrimary: Boolean(raw.isPrimary),
			};
		}
		case "window":
			return {
				...base,
				type: "window",
				sourcePath: typeof raw.sourcePath === "string" ? raw.sourcePath : undefined,
				sourceId: typeof raw.sourceId === "string" ? raw.sourceId : undefined,
				sourceName: typeof raw.sourceName === "string" ? raw.sourceName : undefined,
				selectedArea: (raw.selectedArea as SelectedArea | null | undefined) ?? null,
			};
		case "screenshot": {
			const imagePath = typeof raw.imagePath === "string" ? raw.imagePath.trim() : "";
			if (!imagePath) return null;
			return {
				...base,
				type: "screenshot",
				imagePath,
				width: typeof raw.width === "number" ? raw.width : undefined,
				height: typeof raw.height === "number" ? raw.height : undefined,
			};
		}
		case "webcam": {
			const sourcePath = typeof raw.sourcePath === "string" ? raw.sourcePath.trim() : "";
			if (!sourcePath) return null;
			return {
				...base,
				type: "webcam",
				sourcePath,
			};
		}
		case "audio": {
			const audioPath = typeof raw.audioPath === "string" ? raw.audioPath.trim() : undefined;
			const assetId = typeof raw.assetId === "string" ? raw.assetId.trim() : undefined;
			if (!audioPath && !assetId) return null;
			return {
				...base,
				type: "audio",
				audioPath,
				assetId,
				volume: clamp(raw.volume, 0, 1, 1),
			};
		}
		case "annotation": {
			const annotationId = typeof raw.annotationId === "string" ? raw.annotationId.trim() : "";
			if (!annotationId) return null;
			return {
				...base,
				type: "annotation",
				annotationId,
			};
		}
		case "caption":
			return {
				...base,
				type: "caption",
				trackId: typeof raw.trackId === "string" ? raw.trackId : undefined,
			};
		case "scene-3d":
			return {
				...base,
				type: "scene-3d",
				scene: normalizeScene3DSettings(raw.scene),
			};
		default:
			return null;
	}
}

export function normalizeEditorLayers(candidates: unknown, fallbackVideoPath?: string | null) {
	const layers = Array.isArray(candidates)
		? candidates.flatMap((candidate) => {
				const layer = normalizeEditorLayer(candidate);
				return layer ? [layer] : [];
			})
		: [];

	if (layers.length > 0) {
		return sortEditorLayersForRender(layers);
	}

	return fallbackVideoPath ? [buildPrimaryVideoLayer(fallbackVideoPath)] : [];
}

export function ensurePrimaryVideoLayer(
	layers: EditorLayer[],
	videoPath: string | null | undefined,
	durationMs?: number | null,
) {
	if (!videoPath) return sortEditorLayersForRender(layers);
	const normalized = normalizeEditorLayers(layers, null);
	const hasPrimaryVideo = normalized.some(
		(layer) => layer.type === "video" && layer.isPrimary && layer.sourcePath === videoPath,
	);
	if (hasPrimaryVideo) return sortEditorLayersForRender(normalized);

	const hasAnyPrimaryVideo = normalized.some((layer) => layer.type === "video" && layer.isPrimary);
	if (hasAnyPrimaryVideo) {
		return sortEditorLayersForRender(
			normalized.map((layer) =>
				layer.type === "video" && layer.isPrimary
					? {
							...layer,
							sourcePath: videoPath,
							endMs:
								typeof durationMs === "number" && Number.isFinite(durationMs)
									? durationMs
									: layer.endMs,
						}
					: layer,
			),
		);
	}

	return sortEditorLayersForRender([
		buildPrimaryVideoLayer(videoPath, durationMs),
		...normalized.map((layer) => ({ ...layer, zIndex: layer.zIndex + 1 })),
	]);
}

export function sortEditorLayersForRender(layers: EditorLayer[]) {
	return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.startMs - b.startMs);
}

export function getVisibleLayersAtTime(layers: EditorLayer[], timeMs: number) {
	return sortEditorLayersForRender(
		layers.filter((layer) => {
			if (!layer.visible) {
				return false;
			}
			const startsBefore = layer.startMs <= timeMs;
			const endsAfter = layer.endMs === null || layer.endMs >= timeMs;
			return startsBefore && endsAfter;
		}),
	);
}
