import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
		"w-full bg-black/40 border border-white/[0.08] hover:border-white/[0.15] focus:border-amber-500/50 text-slate-200 h-8 px-2.5 rounded-lg text-[11px] outline-none transition-all shadow-inner font-medium disabled:opacity-40 disabled:cursor-not-allowed";

	return (
		<div
			className={cn(
				"w-full h-full shrink-0 min-w-0 bg-[#0B0F0D]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden",
				embedded ? "" : "w-[400px]",
			)}
		>
			<div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar p-4 relative pb-20">
				<SettingsSection
					title="Layers"
					description={`${layers.length > 0 ? `${layers.length} editable layer${layers.length === 1 ? "" : "s"}` : "No video layer loaded"}`}
					accentColor="amber"
				>
					<div className="flex flex-col gap-1 pr-1 -mr-1">
						{ordered.length === 0 ? (
							<div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-slate-400 text-center bg-white/[0.02]">
								Load or record a video to create the primary editable layer.
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
												? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5 shadow-sm shadow-amber-500/5"
												: "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]",
										)}
									>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span
													className={cn(
														"rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
														selected
															? "bg-amber-500 text-white"
															: "bg-white/10 text-slate-300 group-hover:bg-white/20",
													)}
												>
													{layerKindLabel(layer)}
												</span>
												<span
													className={cn(
														"truncate text-[11px] font-semibold transition-colors",
														selected
															? "text-amber-100"
															: "text-slate-300 group-hover:text-slate-100",
													)}
												>
													{layer.name}
												</span>
											</div>
											<div
												className={cn(
													"mt-0.5 truncate text-[10px] font-medium transition-colors",
													selected ? "text-amber-200/60" : "text-slate-500",
												)}
											>
												{usable
													? `z ${layer.zIndex} · ${Math.round(layer.opacity * 100)}%`
													: "Pending captured media"}
											</div>
										</div>
										<div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
											<span
												className={cn(
													"rounded-md p-1",
													selected ? "text-amber-200" : "text-slate-400 hover:text-slate-200",
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
													selected ? "text-amber-200" : "text-slate-400 hover:text-slate-200",
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
						title="Layer Settings"
						description="Transform and visibility controls"
						accentColor="amber"
					>
						<div className="flex items-center justify-between gap-2 p-1 bg-white/[0.03] border border-white/[0.05] rounded-xl pl-2">
							<input
								value={selectedLayer.name}
								onChange={(event) =>
									onLayersChange(renameEditorLayer(layers, selectedLayer.id, event.target.value))
								}
								className="min-w-0 flex-1 bg-transparent border-none text-[11px] font-bold text-amber-100 outline-none placeholder:text-slate-600 focus:ring-0 px-1"
								aria-label="Layer name"
							/>
							<div className="flex gap-1 shrink-0">
								<button
									type="button"
									className="rounded-lg p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
									onClick={() =>
										onLayersChange(
											setEditorLayerVisibility(layers, selectedLayer.id, !selectedLayer.visible),
										)
									}
									aria-label={selectedLayer.visible ? "Hide layer" : "Show layer"}
								>
									{selectedLayer.visible ? (
										<Eye className="h-4 w-4" />
									) : (
										<EyeOff className="h-4 w-4" />
									)}
								</button>
								<button
									type="button"
									className="rounded-lg p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
									onClick={() =>
										onLayersChange(
											setEditorLayerLocked(layers, selectedLayer.id, !selectedLayer.locked),
										)
									}
									aria-label={selectedLayer.locked ? "Unlock layer" : "Lock layer"}
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
							<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-medium text-amber-200/80 mt-1">
								This layer is planned but does not have captured media yet.
							</div>
						)}

						<div className="mt-3">
							<div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-amber-500/50" /> Transform
							</div>
							<div className="grid grid-cols-3 gap-2">
								<label className="space-y-1.5">
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">X Position</span>
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
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">Y Position</span>
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
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">Scale</span>
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
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">Opacity</span>
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
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">Start ms</span>
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
									<span className="text-[10px] font-medium text-slate-500 pl-0.5">End ms</span>
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
							<div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-blue-500/50" /> Crop
							</div>
							<div className="grid grid-cols-4 gap-2">
								{(["x", "y", "width", "height"] as const).map((key) => (
									<label key={key} className="space-y-1.5">
										<span className="text-[10px] font-medium text-slate-500 pl-0.5 capitalize">
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

						<div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
							<div className="flex gap-2 bg-black/40 border border-white/5 rounded-lg p-1 shadow-inner">
								<button
									type="button"
									className="rounded-md p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-30"
									onClick={() =>
										onLayersChange(moveEditorLayerZ(layers, selectedLayer.id, "forward"))
									}
									disabled={!editable}
									aria-label="Move layer forward"
								>
									<ArrowUp className="h-4 w-4" />
								</button>
								<div className="w-[1px] bg-white/[0.06] my-1" />
								<button
									type="button"
									className="rounded-md p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-30"
									onClick={() =>
										onLayersChange(moveEditorLayerZ(layers, selectedLayer.id, "backward"))
									}
									disabled={!editable}
									aria-label="Move layer backward"
								>
									<ArrowDown className="h-4 w-4" />
								</button>
							</div>
							<button
								type="button"
								className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-2 text-[11px] font-bold tracking-wider text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
