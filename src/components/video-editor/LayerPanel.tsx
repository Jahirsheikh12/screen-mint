import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import type { EditorLayer, EditorLayerTransform } from "./layerModel";
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
import { SettingsSection } from "./settingsPanelLayout";

interface LayerPanelProps {
	layers: EditorLayer[];
	onLayersChange: (layers: EditorLayer[]) => void;
	embedded?: boolean;
}

function layerKindLabel(layer: EditorLayer) {
	switch (layer.type) {
		case "scene-3d":
			return "3D";
		case "webcam":
			return "Cam";
		default:
			return layer.type;
	}
}

function hasUsableMedia(layer: EditorLayer) {
	if (layer.type === "video" || layer.type === "webcam") return Boolean(layer.sourcePath);
	if (layer.type === "window") return Boolean(layer.sourcePath);
	if (layer.type === "audio") return Boolean(layer.audioPath || layer.assetId);
	if (layer.type === "screenshot") return Boolean(layer.imagePath);
	return true;
}

function numericValue(value: string, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function transformWithCrop(
	layer: EditorLayer,
	crop: NonNullable<EditorLayerTransform["crop"]> | undefined,
) {
	return {
		...layer.transform,
		...(crop ? { crop } : { crop: undefined }),
	};
}

export function LayerPanel({ layers, onLayersChange, embedded = false }: LayerPanelProps) {
	const { t } = useI18n();
	const ordered = useMemo(() => [...layers].sort((a, b) => b.zIndex - a.zIndex), [layers]);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? ordered[0] ?? null;
	const editable = selectedLayer ? !selectedLayer.locked : false;
	const crop = selectedLayer?.transform.crop;

	const updateSelectedTransform = (transform: Partial<EditorLayerTransform>) => {
		if (!selectedLayer) return;
		onLayersChange(setEditorLayerTransform(layers, selectedLayer.id, transform));
	};

	const inputClass =
		"w-full bg-sunken border border-line hover:border-line-strong focus:border-accent/50 text-fg h-8 px-2.5 rounded-lg text-caption outline-none transition-all shadow-inner font-medium disabled:opacity-40 disabled:cursor-not-allowed";

	return (
		<div
			className={cn(
				"w-full h-full shrink-0 min-w-0 bg-canvas/90 backdrop-blur-2xl border border-line rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden",
				embedded ? "" : "w-[400px]",
			)}
		>
			<div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar p-4 relative pb-20">
				<SettingsSection
					title={t("editor.layerPanel.layers", "Layers")}
					description={`${layers.length > 0 ? `${layers.length} editable layer${layers.length === 1 ? "" : "s"}` : t("editor.layerPanel.noVideoLayerLoaded", "No video layer loaded")}`}
					accentColor="amber"
				>
					<div className="flex flex-col gap-1 pr-1 -mr-1">
						{ordered.length === 0 ? (
							<div className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-label text-fg-muted text-center bg-fill-subtle">
								{t(
									"editor.layerPanel.loadOrRecordA",
									"Load or record a video to create the primary editable layer.",
								)}
							</div>
						) : (
							ordered.map((layer) => {
								const selected = selectedLayer?.id === layer.id;
								const usable = hasUsableMedia(layer);
								return (
									<button
										type="button"
										key={layer.id}
										onClick={() => setSelectedLayerId(layer.id)}
										className={cn(
											"group grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 cursor-pointer",
											selected
												? "border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 shadow-sm shadow-accent/5"
												: "border-line bg-fill-subtle hover:bg-fill-subtle hover:border-line-strong",
										)}
									>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span
													className={cn(
														"rounded px-1.5 py-0.5 text-micro font-bold uppercase tracking-wider",
														selected
															? "bg-accent text-on-accent"
															: "bg-fill-hover text-fg-muted group-hover:bg-fill-pressed",
													)}
												>
													{layerKindLabel(layer)}
												</span>
												<span
													className={cn(
														"truncate text-caption font-semibold transition-colors",
														selected ? "text-fg" : "text-fg-muted group-hover:text-fg",
													)}
												>
													{layer.name}
												</span>
											</div>
											<div
												className={cn(
													"mt-0.5 truncate text-micro font-medium transition-colors",
													selected ? "text-accent-fg/60" : "text-fg-subtle",
												)}
											>
												{usable
													? `z ${layer.zIndex} · ${Math.round(layer.opacity * 100)}%`
													: t("editor.layerPanel.pendingCapturedMedia", "Pending captured media")}
											</div>
										</div>
										<div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
											<span
												className={cn(
													"rounded-md p-1",
													selected ? "text-accent-fg" : "text-fg-muted hover:text-fg",
												)}
											>
												{layer.visible ? (
													<Eye className="h-3.5 w-3.5" />
												) : (
													<EyeOff className="h-3.5 w-3.5" />
												)}
											</span>
											<span
												className={cn(
													"rounded-md p-1",
													selected ? "text-accent-fg" : "text-fg-muted hover:text-fg",
												)}
											>
												{layer.locked ? (
													<Lock className="h-3.5 w-3.5" />
												) : (
													<LockOpen className="h-3.5 w-3.5" />
												)}
											</span>
										</div>
									</button>
								);
							})
						)}
					</div>
				</SettingsSection>

				{selectedLayer && (
					<SettingsSection
						title={t("editor.layerPanel.layerSettings", "Layer Settings")}
						description={t(
							"editor.layerPanel.transformAndVisibilityControls",
							"Transform and visibility controls",
						)}
						accentColor="amber"
					>
						<div className="flex items-center justify-between gap-2 p-1 bg-fill-subtle border border-line rounded-xl pl-2">
							<input
								value={selectedLayer.name}
								onChange={(event) =>
									onLayersChange(renameEditorLayer(layers, selectedLayer.id, event.target.value))
								}
								className="min-w-0 flex-1 bg-transparent border-none text-caption font-bold text-fg outline-none placeholder:text-fg-subtle focus:ring-0 px-1"
								aria-label={t("editor.layerPanel.layerName", "Layer name")}
							/>
							<div className="flex gap-1 shrink-0">
								<button
									type="button"
									className="rounded-lg p-1.5 text-fg-muted hover:text-accent-fg hover:bg-accent/10 transition-colors"
									onClick={() =>
										onLayersChange(
											setEditorLayerVisibility(layers, selectedLayer.id, !selectedLayer.visible),
										)
									}
									aria-label={
										selectedLayer.visible
											? t("editor.layerPanel.hideLayer", "Hide layer")
											: t("editor.layerPanel.showLayer", "Show layer")
									}
								>
									{selectedLayer.visible ? (
										<Eye className="h-4 w-4" />
									) : (
										<EyeOff className="h-4 w-4" />
									)}
								</button>
								<button
									type="button"
									className="rounded-lg p-1.5 text-fg-muted hover:text-accent-fg hover:bg-accent/10 transition-colors"
									onClick={() =>
										onLayersChange(
											setEditorLayerLocked(layers, selectedLayer.id, !selectedLayer.locked),
										)
									}
									aria-label={
										selectedLayer.locked
											? t("editor.layerPanel.unlockLayer", "Unlock layer")
											: t("editor.layerPanel.lockLayer", "Lock layer")
									}
								>
									{selectedLayer.locked ? (
										<Lock className="h-4 w-4" />
									) : (
										<LockOpen className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{!hasUsableMedia(selectedLayer) && (
							<div className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-micro font-medium text-accent-fg/80 mt-1">
								{t(
									"editor.layerPanel.thisLayerIsPlanned",
									"This layer is planned but does not have captured media yet.",
								)}
							</div>
						)}

						<div className="mt-3">
							<div className="text-micro font-bold text-fg-muted uppercase tracking-widest mb-3 flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-accent/50" />{" "}
								{t("editor.layerPanel.transform", "Transform")}
							</div>
							<div className="grid grid-cols-3 gap-2">
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.xPosition", "X Position")}
									</span>
									<input
										type="number"
										value={selectedLayer.transform.x}
										disabled={!editable}
										onChange={(event) =>
											updateSelectedTransform({
												x: numericValue(event.target.value, selectedLayer.transform.x),
											})
										}
										className={inputClass}
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.yPosition", "Y Position")}
									</span>
									<input
										type="number"
										value={selectedLayer.transform.y}
										disabled={!editable}
										onChange={(event) =>
											updateSelectedTransform({
												y: numericValue(event.target.value, selectedLayer.transform.y),
											})
										}
										className={inputClass}
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.scale", "Scale")}
									</span>
									<input
										type="number"
										step="0.05"
										min="0.01"
										value={selectedLayer.transform.scale}
										disabled={!editable}
										onChange={(event) =>
											updateSelectedTransform({
												scale: numericValue(event.target.value, selectedLayer.transform.scale),
											})
										}
										className={inputClass}
									/>
								</label>
							</div>
							<div className="grid grid-cols-3 gap-2 mt-2">
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.opacity", "Opacity")}
									</span>
									<input
										type="number"
										step="0.05"
										min="0"
										max="1"
										value={selectedLayer.opacity}
										disabled={!editable}
										onChange={(event) =>
											onLayersChange(
												setEditorLayerOpacity(
													layers,
													selectedLayer.id,
													numericValue(event.target.value, selectedLayer.opacity),
												),
											)
										}
										className={inputClass}
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.startMs", "Start ms")}
									</span>
									<input
										type="number"
										min="0"
										value={selectedLayer.startMs}
										disabled={!editable}
										onChange={(event) =>
											onLayersChange(
												setEditorLayerTiming(layers, selectedLayer.id, {
													startMs: numericValue(event.target.value, selectedLayer.startMs),
													endMs: selectedLayer.endMs,
												}),
											)
										}
										className={inputClass}
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">
										{t("editor.layerPanel.endMs", "End ms")}
									</span>
									<input
										type="number"
										min="0"
										value={selectedLayer.endMs ?? ""}
										disabled={!editable}
										onChange={(event) =>
											onLayersChange(
												setEditorLayerTiming(layers, selectedLayer.id, {
													startMs: selectedLayer.startMs,
													endMs:
														event.target.value.trim() === ""
															? null
															: numericValue(event.target.value, selectedLayer.startMs),
												}),
											)
										}
										className={inputClass}
									/>
								</label>
							</div>
						</div>

						<div className="mt-4">
							<div className="text-micro font-bold text-fg-muted uppercase tracking-widest mb-3 flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-info/50" />{" "}
								{t("editor.layerPanel.crop", "Crop")}
							</div>
							<div className="grid grid-cols-4 gap-2">
								{(["x", "y", "width", "height"] as const).map((key) => (
									<label key={key} className="space-y-1.5">
										<span className="text-micro font-medium text-fg-subtle pl-0.5 capitalize">
											{key}
										</span>
										<input
											type="number"
											step="0.01"
											min="0"
											max="1"
											value={crop?.[key] ?? (key === "width" || key === "height" ? 1 : 0)}
											disabled={!editable}
											onChange={(event) => {
												const nextCrop = {
													x: crop?.x ?? 0,
													y: crop?.y ?? 0,
													width: crop?.width ?? 1,
													height: crop?.height ?? 1,
													[key]: numericValue(
														event.target.value,
														crop?.[key] ?? (key === "width" || key === "height" ? 1 : 0),
													),
												};
												updateSelectedTransform(transformWithCrop(selectedLayer, nextCrop));
											}}
											className={inputClass}
										/>
									</label>
								))}
							</div>
						</div>

						<div className="mt-5 flex items-center justify-between border-t border-line pt-4">
							<div className="flex gap-2 bg-sunken border border-line rounded-lg p-1 shadow-inner">
								<button
									type="button"
									className="rounded-md p-1.5 text-fg-muted hover:text-accent-fg hover:bg-accent/10 transition-colors disabled:opacity-30"
									onClick={() =>
										onLayersChange(moveEditorLayerZ(layers, selectedLayer.id, "forward"))
									}
									disabled={!editable}
									aria-label={t("editor.layerPanel.moveLayerForward", "Move layer forward")}
								>
									<ArrowUp className="h-4 w-4" />
								</button>
								<div className="w-[1px] bg-fill-hover my-1" />
								<button
									type="button"
									className="rounded-md p-1.5 text-fg-muted hover:text-accent-fg hover:bg-accent/10 transition-colors disabled:opacity-30"
									onClick={() =>
										onLayersChange(moveEditorLayerZ(layers, selectedLayer.id, "backward"))
									}
									disabled={!editable}
									aria-label={t("editor.layerPanel.moveLayerBackward", "Move layer backward")}
								>
									<ArrowDown className="h-4 w-4" />
								</button>
							</div>
							<button
								type="button"
								className="inline-flex items-center gap-2 rounded-lg bg-danger/10 hover:bg-danger/20 border border-danger/20 px-3 py-2 text-caption font-bold tracking-wider text-danger-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								onClick={() => onLayersChange(deleteEditorLayer(layers, selectedLayer.id))}
								disabled={!editable}
							>
								<Trash2 className="h-3.5 w-3.5" />
								DELETE
							</button>
						</div>
					</SettingsSection>
				)}
			</div>
		</div>
	);
}
