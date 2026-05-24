import type { AudioMixSettings } from "@/components/video-editor/audioMix";
import { normalizeAudioMixSettings } from "@/components/video-editor/audioMix";
import type { EditorLayer } from "@/components/video-editor/layerModel";
import {
	ensurePrimaryVideoLayer,
	getVisibleLayersAtTime,
	sortEditorLayersForRender,
} from "@/components/video-editor/layerModel";
import type { Scene3DSettings } from "@/components/video-editor/scene3d";
import { normalizeScene3DSettings } from "@/components/video-editor/scene3d";

export interface LayeredExportComposition {
	layers: EditorLayer[];
	scene3D: Scene3DSettings;
	audioMix: AudioMixSettings;
	width: number;
	height: number;
	durationMs: number;
}

export function normalizeLayeredExportComposition(
	composition: LayeredExportComposition,
): LayeredExportComposition {
	return {
		...composition,
		width: Math.max(1, Math.round(composition.width)),
		height: Math.max(1, Math.round(composition.height)),
		durationMs: Math.max(0, Math.round(composition.durationMs)),
		layers: sortEditorLayersForRender(composition.layers),
	};
}

export function buildLayeredExportComposition(input: {
	layers: EditorLayer[];
	scene3D: Scene3DSettings;
	audioMix: AudioMixSettings;
	width: number;
	height: number;
	durationMs: number;
	primaryVideoPath?: string | null;
}): LayeredExportComposition {
	return normalizeLayeredExportComposition({
		layers: ensurePrimaryVideoLayer(input.layers, input.primaryVideoPath, input.durationMs),
		scene3D: normalizeScene3DSettings(input.scene3D),
		audioMix: normalizeAudioMixSettings(input.audioMix),
		width: input.width,
		height: input.height,
		durationMs: input.durationMs,
	});
}

export function getCompositionLayersAtTime(composition: LayeredExportComposition, timeMs: number) {
	return getVisibleLayersAtTime(composition.layers, timeMs);
}
