import type { EditorLayer, EditorLayerTransform } from "./layerModel";
import { normalizeEditorLayer, sortEditorLayersForRender } from "./layerModel";

type LayerUpdater = (layer: EditorLayer) => EditorLayer;

function updateLayer(layers: EditorLayer[], layerId: string, updater: LayerUpdater) {
	return layers.map((layer) => {
		if (layer.id !== layerId) return layer;
		const updated = normalizeEditorLayer(updater(layer));
		return updated ?? layer;
	});
}

function canEdit(layer: EditorLayer) {
	return !layer.locked;
}

export function renameEditorLayer(layers: EditorLayer[], layerId: string, name: string) {
	return updateLayer(layers, layerId, (layer) => ({
		...layer,
		name: name.trim() || layer.name,
	}));
}

export function setEditorLayerVisibility(layers: EditorLayer[], layerId: string, visible: boolean) {
	return updateLayer(layers, layerId, (layer) => ({ ...layer, visible }));
}

export function setEditorLayerLocked(layers: EditorLayer[], layerId: string, locked: boolean) {
	return updateLayer(layers, layerId, (layer) => ({ ...layer, locked }));
}

export function setEditorLayerOpacity(layers: EditorLayer[], layerId: string, opacity: number) {
	return updateLayer(layers, layerId, (layer) => (canEdit(layer) ? { ...layer, opacity } : layer));
}

export function setEditorLayerTiming(
	layers: EditorLayer[],
	layerId: string,
	timing: { startMs: number; endMs: number | null },
) {
	return updateLayer(layers, layerId, (layer) =>
		canEdit(layer) ? { ...layer, startMs: timing.startMs, endMs: timing.endMs } : layer,
	);
}

export function setEditorLayerTransform(
	layers: EditorLayer[],
	layerId: string,
	transform: Partial<EditorLayerTransform>,
) {
	return updateLayer(layers, layerId, (layer) =>
		canEdit(layer)
			? {
					...layer,
					transform: {
						...layer.transform,
						...transform,
					},
				}
			: layer,
	);
}

export function deleteEditorLayer(layers: EditorLayer[], layerId: string) {
	return layers.filter((layer) => layer.id !== layerId || layer.locked);
}

export function moveEditorLayerZ(
	layers: EditorLayer[],
	layerId: string,
	direction: "forward" | "backward" | "front" | "back",
) {
	const target = layers.find((layer) => layer.id === layerId);
	if (!target || target.locked) return layers;

	const sorted = sortEditorLayersForRender(layers);
	const editable = sorted.filter((layer) => !layer.locked);
	const editableIndex = editable.findIndex((layer) => layer.id === layerId);
	if (editableIndex < 0) return layers;

	const nextEditable = [...editable];
	const [moved] = nextEditable.splice(editableIndex, 1);
	if (!moved) return layers;

	const nextIndex =
		direction === "front"
			? nextEditable.length
			: direction === "back"
				? 0
				: direction === "forward"
					? Math.min(nextEditable.length, editableIndex + 1)
					: Math.max(0, editableIndex - 1);
	nextEditable.splice(nextIndex, 0, moved);

	const nextZ = new Map(nextEditable.map((layer, index) => [layer.id, index]));
	return sortEditorLayersForRender(
		layers.map((layer) => {
			const zIndex = nextZ.get(layer.id);
			return zIndex === undefined ? layer : { ...layer, zIndex };
		}),
	);
}
