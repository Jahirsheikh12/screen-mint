import { Music, Pause, Play, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { BackgroundMusicAsset } from "@/lib/backgroundMusic";
import { cn } from "@/lib/utils";
import { getAudioRegionDisplayName } from "../audioRegionUtils";
import { SliderControl } from "../SliderControl";
import { formatAudioDuration } from "../settingsPanelBackground";
import { SettingsSection, TabContent, TabHeader } from "../settingsPanelLayout";
import {
	type AudioRegion,
	DEFAULT_AUDIO_FADE_IN_MS,
	DEFAULT_AUDIO_FADE_OUT_MS,
	DEFAULT_AUDIO_REGION_VOLUME,
} from "../types";

type SettingsTranslator = (key: string, fallback?: string) => string;

interface AudioSettingsTabProps {
	tSettings: SettingsTranslator;
	builtInTracksByMood: Record<string, BackgroundMusicAsset[]>;
	selectedBuiltInTrackId: string | null;
	selectedBuiltInTrack: BackgroundMusicAsset | null;
	builtInTrackDurations: Record<string, number>;
	playingBuiltInTrackId: string | null;
	selectedAudio: AudioRegion | null;
	missingAudioPath?: string | null;
	onImportAudio: () => Promise<void>;
	onSelectBuiltInTrack: (trackId: string) => Promise<void>;
	onToggleBuiltInPreview: (trackId: string) => Promise<void>;
	onReplaceBuiltInAudio: () => Promise<void>;
	onReplaceWithUploadedAudio: () => Promise<void>;
	onRelinkMissingAudio?: () => void;
	onRemoveMissingAudio?: () => void;
	onAudioLoopChange?: (id: string, loop: boolean) => void;
	onAudioNormalizeChange?: (id: string, normalize: boolean) => void;
	onAudioVolumeChange?: (id: string, volume: number) => void;
	onAudioFadeChange?: (
		id: string,
		updates: Partial<Pick<AudioRegion, "fadeInMs" | "fadeOutMs">>,
	) => void;
	onAudioDelete?: (id: string) => void;
}

export function AudioSettingsTab({
	tSettings,
	builtInTracksByMood,
	selectedBuiltInTrackId,
	selectedBuiltInTrack,
	builtInTrackDurations,
	playingBuiltInTrackId,
	selectedAudio,
	missingAudioPath,
	onImportAudio,
	onSelectBuiltInTrack,
	onToggleBuiltInPreview,
	onReplaceBuiltInAudio,
	onReplaceWithUploadedAudio,
	onRelinkMissingAudio,
	onRemoveMissingAudio,
	onAudioLoopChange,
	onAudioNormalizeChange,
	onAudioVolumeChange,
	onAudioFadeChange,
	onAudioDelete,
}: AudioSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("audio.title", "Background Audio")}
				description="Add background music to polish your recording"
				badge={tSettings("audio.subtleMix", "Subtle Mix")}
			/>

			<SettingsSection
				title="Audio Source"
				description="Upload your own track or browse the built-in library"
			>
				<div className="p-3 rounded-xl bg-black/40 border border-white/5 shadow-inner">
					<p className="text-[11px] text-slate-400 leading-relaxed">
						{tSettings(
							"audio.subtitle",
							"Keep your voice clear and add a subtle music bed for polished demos.",
						)}
					</p>
					<div className="mt-3 flex gap-2">
						<Button
							type="button"
							onClick={() => void onImportAudio()}
							className="w-full gap-2 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all duration-200 rounded-xl"
						>
							<Upload className="h-3.5 w-3.5" />
							{tSettings("audio.upload", "Upload audio")}
						</Button>
					</div>
				</div>
			</SettingsSection>

			<SettingsSection title="Built-in Library" description="Curated tracks organized by mood">
				<div className="rounded-xl bg-black/40 border border-white/5 shadow-inner overflow-hidden">
					{Object.entries(builtInTracksByMood).map(([mood, tracks], moodIndex) => (
						<div
							key={mood}
							className={cn("p-2.5", moodIndex > 0 && "border-t border-white/[0.04]")}
						>
							<div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
								{tSettings(`audio.moods.${mood}`, mood)}
							</div>
							<div className="space-y-1.5">
								{tracks.map((track) => {
									const isSelected = track.id === selectedBuiltInTrackId;
									return (
										<button
											key={track.id}
											type="button"
											onClick={() => void onSelectBuiltInTrack(track.id)}
											className={cn(
												"w-full rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
												isSelected
													? "border-[#F59E0B]/40 bg-[#F59E0B]/10 shadow-sm shadow-[#F59E0B]/10"
													: "border-white/5 bg-black/10 hover:bg-white/[0.04] hover:border-white/[0.1]",
											)}
										>
											<div className="flex items-center justify-between gap-3">
												<div className="flex min-w-0 items-center gap-2">
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															void onToggleBuiltInPreview(track.id);
														}}
														className={cn(
															"flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
															playingBuiltInTrackId === track.id
																? "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/20"
																: "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100",
														)}
														aria-label={
															playingBuiltInTrackId === track.id ? "Pause preview" : "Play preview"
														}
													>
														{playingBuiltInTrackId === track.id ? (
															<Pause className="h-3.5 w-3.5" />
														) : (
															<Play className="h-3.5 w-3.5 fill-current" />
														)}
													</button>
													<div className="min-w-0">
														<div className="truncate text-xs font-medium text-slate-200">
															{track.label}
														</div>
														<div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
															<span>{formatAudioDuration(builtInTrackDurations[track.id])}</span>
															<span className="text-white/15">•</span>
															<span>{tSettings(`audio.moods.${track.mood}`, track.mood)}</span>
														</div>
													</div>
												</div>
												<div className="text-[10px] text-slate-500 font-mono">
													{Math.round(track.defaultVolume * 100)}%
												</div>
											</div>
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</SettingsSection>

			<SettingsSection
				title="Selected Region"
				description="Adjust properties for the selected audio region"
				accentColor="amber"
			>
				{selectedAudio ? (
					<>
						<div className="rounded-xl bg-black/40 border border-white/5 shadow-inner px-3 py-2.5">
							<div className="text-xs font-medium text-slate-200">
								{getAudioRegionDisplayName(selectedAudio)}
							</div>
							<div className="mt-0.5 text-[10px] text-slate-500">
								{selectedAudio.sourceType === "built-in"
									? tSettings("audio.builtIn", "Built-in")
									: tSettings("audio.uploaded", "Uploaded")}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-1.5">
							<Button
								type="button"
								onClick={() => void onReplaceBuiltInAudio()}
								disabled={!selectedBuiltInTrack}
								className="gap-1.5 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] rounded-xl text-[10px] transition-all duration-200"
							>
								<Music className="h-3 w-3" />
								{tSettings("audio.replaceBuiltIn", "Replace selected")}
							</Button>
							<Button
								type="button"
								onClick={() => void onReplaceWithUploadedAudio()}
								className="gap-1.5 bg-white/[0.04] text-slate-200 border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] rounded-xl text-[10px] transition-all duration-200"
							>
								<Upload className="h-3 w-3" />
								{tSettings("audio.replaceUpload", "Replace with file")}
							</Button>
						</div>

						{missingAudioPath && (
							<div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-[11px] text-amber-100">
								<div className="font-semibold text-amber-50">
									{tSettings("audio.missingTitle", "Audio source missing")}
								</div>
								<div className="mt-1 truncate text-amber-100/80">{missingAudioPath}</div>
								<div className="mt-2 flex gap-2">
									<Button
										type="button"
										onClick={() => void onRelinkMissingAudio?.()}
										className="flex-1 bg-amber-300/20 text-amber-50 hover:bg-amber-300/30 rounded-xl"
									>
										{tSettings("audio.relink", "Relink audio")}
									</Button>
									<Button
										type="button"
										onClick={() => onRemoveMissingAudio?.()}
										className="flex-1 bg-white/7 text-slate-100 hover:bg-white/12 rounded-xl"
									>
										{tSettings("audio.remove", "Remove")}
									</Button>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<div>
								<div className="text-xs font-medium text-slate-300">
									{tSettings("audio.loop", "Loop audio")}
								</div>
								<div className="text-[10px] text-slate-500 mt-0.5">Repeat audio when it ends</div>
							</div>
							<Switch
								checked={selectedAudio.loop}
								onCheckedChange={(checked) => onAudioLoopChange?.(selectedAudio.id, checked)}
								className="data-[state=checked]:bg-[#F59E0B] scale-90"
							/>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<div>
								<div className="text-xs font-medium text-slate-300">Normalize</div>
								<div className="text-[10px] text-slate-500 mt-0.5">
									Even out loudness so the clip peaks just below full volume
								</div>
							</div>
							<Switch
								checked={selectedAudio.normalize === true}
								onCheckedChange={(checked) => onAudioNormalizeChange?.(selectedAudio.id, checked)}
								className="data-[state=checked]:bg-[#F59E0B] scale-90"
							/>
						</div>

						<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<SliderControl
								label={tSettings("audio.volume", "Volume")}
								value={selectedAudio.volume}
								defaultValue={DEFAULT_AUDIO_REGION_VOLUME}
								min={0}
								max={1}
								step={0.01}
								onChange={(value) => onAudioVolumeChange?.(selectedAudio.id, value)}
								formatValue={(value) => `${Math.round(value * 100)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
							/>
						</div>
						<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<SliderControl
								label={tSettings("audio.fadeIn", "Fade In")}
								value={selectedAudio.fadeInMs}
								defaultValue={DEFAULT_AUDIO_FADE_IN_MS}
								min={0}
								max={3000}
								step={50}
								onChange={(value) => onAudioFadeChange?.(selectedAudio.id, { fadeInMs: value })}
								formatValue={(value) => `${Math.round(value)}ms`}
								parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
							/>
						</div>
						<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<SliderControl
								label={tSettings("audio.fadeOut", "Fade Out")}
								value={selectedAudio.fadeOutMs}
								defaultValue={DEFAULT_AUDIO_FADE_OUT_MS}
								min={0}
								max={3000}
								step={50}
								onChange={(value) => onAudioFadeChange?.(selectedAudio.id, { fadeOutMs: value })}
								formatValue={(value) => `${Math.round(value)}ms`}
								parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
							/>
						</div>
						<Button
							type="button"
							onClick={() => onAudioDelete?.(selectedAudio.id)}
							variant="destructive"
							size="sm"
							className="w-full gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 h-9 text-xs rounded-xl"
						>
							<Trash2 className="h-3.5 w-3.5" />
							{tSettings("audio.deleteRegion", "Delete Audio Region")}
						</Button>
					</>
				) : (
					<div className="flex items-center justify-center py-4 px-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08]">
						<p className="text-[10px] text-slate-500 text-center">
							{tSettings(
								"audio.empty",
								"Choose a built-in track or upload your own file, then add it at the playhead.",
							)}
						</p>
					</div>
				)}
			</SettingsSection>
		</TabContent>
	);
}
