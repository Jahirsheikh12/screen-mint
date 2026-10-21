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
				description={tSettings(
					"audioTab.addBackgroundMusicTo",
					"Add background music to polish your recording",
				)}
				badge={tSettings("audio.subtleMix", "Subtle Mix")}
			/>

			<SettingsSection
				title={tSettings("audioTab.audioSource", "Audio Source")}
				description={tSettings(
					"audioTab.uploadYourOwnTrack",
					"Upload your own track or browse the built-in library",
				)}
			>
				<div className="p-3 rounded-xl bg-sunken border border-line shadow-inner">
					<p className="text-caption text-fg-muted leading-relaxed">
						{tSettings(
							"audio.subtitle",
							"Keep your voice clear and add a subtle music bed for polished demos.",
						)}
					</p>
					<div className="mt-3 flex gap-2">
						<Button
							type="button"
							onClick={() => void onImportAudio()}
							className="w-full gap-2 bg-fill-subtle text-fg border border-line hover:bg-accent/10 hover:text-accent-fg hover:border-accent/30 transition-all duration-200 rounded-xl"
						>
							<Upload className="h-3.5 w-3.5" />
							{tSettings("audio.upload", "Upload audio")}
						</Button>
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				title={tSettings("audioTab.builtInLibrary", "Built-in Library")}
				description={tSettings(
					"audioTab.curatedTracksOrganizedBy",
					"Curated tracks organized by mood",
				)}
			>
				<div className="rounded-xl bg-sunken border border-line shadow-inner overflow-hidden">
					{Object.entries(builtInTracksByMood).map(([mood, tracks], moodIndex) => (
						<div key={mood} className={cn("p-2.5", moodIndex > 0 && "border-t border-line")}>
							<div className="text-micro uppercase tracking-wider text-fg-subtle font-semibold mb-2">
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
													? "border-accent/40 bg-accent/10 shadow-sm shadow-accent/10"
													: "border-line bg-sunken hover:bg-fill-subtle hover:border-line-strong",
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
																? "border-accent/40 bg-accent/15 text-accent-fg shadow-sm shadow-accent/20"
																: "border-line-strong bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:text-fg",
														)}
														aria-label={
															playingBuiltInTrackId === track.id
																? tSettings("audioTab.pausePreview", "Pause preview")
																: tSettings("audioTab.playPreview", "Play preview")
														}
													>
														{playingBuiltInTrackId === track.id ? (
															<Pause className="h-3.5 w-3.5" />
														) : (
															<Play className="h-3.5 w-3.5 fill-current" />
														)}
													</button>
													<div className="min-w-0">
														<div className="truncate text-label font-medium text-fg">
															{track.label}
														</div>
														<div className="mt-0.5 flex items-center gap-2 text-micro text-fg-subtle">
															<span>{formatAudioDuration(builtInTrackDurations[track.id])}</span>
															<span className="text-fg-disabled">•</span>
															<span>{tSettings(`audio.moods.${track.mood}`, track.mood)}</span>
														</div>
													</div>
												</div>
												<div className="text-micro text-fg-subtle font-mono">
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
				title={tSettings("audioTab.selectedRegion", "Selected Region")}
				description={tSettings(
					"audioTab.adjustPropertiesForThe",
					"Adjust properties for the selected audio region",
				)}
				accentColor="amber"
			>
				{selectedAudio ? (
					<>
						<div className="rounded-xl bg-sunken border border-line shadow-inner px-3 py-2.5">
							<div className="text-label font-medium text-fg">
								{getAudioRegionDisplayName(selectedAudio)}
							</div>
							<div className="mt-0.5 text-micro text-fg-subtle">
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
								className="gap-1.5 bg-fill-subtle text-fg border border-line hover:bg-fill-hover hover:border-line-strong rounded-xl text-micro transition-all duration-200"
							>
								<Music className="h-3 w-3" />
								{tSettings("audio.replaceBuiltIn", "Replace selected")}
							</Button>
							<Button
								type="button"
								onClick={() => void onReplaceWithUploadedAudio()}
								className="gap-1.5 bg-fill-subtle text-fg border border-line hover:bg-fill-hover hover:border-line-strong rounded-xl text-micro transition-all duration-200"
							>
								<Upload className="h-3 w-3" />
								{tSettings("audio.replaceUpload", "Replace with file")}
							</Button>
						</div>

						{missingAudioPath && (
							<div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2.5 text-caption text-fg">
								<div className="font-semibold text-fg">
									{tSettings("audio.missingTitle", "Audio source missing")}
								</div>
								<div className="mt-1 truncate text-fg-muted">{missingAudioPath}</div>
								<div className="mt-2 flex gap-2">
									<Button
										type="button"
										onClick={() => void onRelinkMissingAudio?.()}
										className="flex-1 bg-accent/20 text-fg hover:bg-accent/30 rounded-xl"
									>
										{tSettings("audio.relink", "Relink audio")}
									</Button>
									<Button
										type="button"
										onClick={() => onRemoveMissingAudio?.()}
										className="flex-1 bg-fill-hover text-fg hover:bg-fill-pressed rounded-xl"
									>
										{tSettings("audio.remove", "Remove")}
									</Button>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between p-2.5 rounded-xl bg-sunken border border-line shadow-inner hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<div>
								<div className="text-label font-medium text-fg-muted">
									{tSettings("audio.loop", "Loop audio")}
								</div>
								<div className="text-micro text-fg-subtle mt-0.5">
									{tSettings("audioTab.repeatAudioWhenIt", "Repeat audio when it ends")}
								</div>
							</div>
							<Switch
								checked={selectedAudio.loop}
								onCheckedChange={(checked) => onAudioLoopChange?.(selectedAudio.id, checked)}
								className="data-[state=checked]:bg-accent scale-90"
							/>
						</div>

						<div className="flex items-center justify-between p-2.5 rounded-xl bg-sunken border border-line shadow-inner hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
							<div>
								<div className="text-label font-medium text-fg-muted">
									{tSettings("audioTab.normalize", "Normalize")}
								</div>
								<div className="text-micro text-fg-subtle mt-0.5">
									{tSettings(
										"audioTab.evenOutLoudnessSo",
										"Even out loudness so the clip peaks just below full volume",
									)}
								</div>
							</div>
							<Switch
								checked={selectedAudio.normalize === true}
								onCheckedChange={(checked) => onAudioNormalizeChange?.(selectedAudio.id, checked)}
								className="data-[state=checked]:bg-accent scale-90"
							/>
						</div>

						<div className="p-2.5 rounded-xl bg-sunken border border-line shadow-inner hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
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
						<div className="p-2.5 rounded-xl bg-sunken border border-line shadow-inner hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
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
						<div className="p-2.5 rounded-xl bg-sunken border border-line shadow-inner hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
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
							className="w-full gap-2 bg-danger/8 text-danger-fg border border-danger/15 hover:bg-danger/15 hover:border-danger/25 transition-all duration-200 h-9 text-label rounded-xl"
						>
							<Trash2 className="h-3.5 w-3.5" />
							{tSettings("audio.deleteRegion", "Delete Audio Region")}
						</Button>
					</>
				) : (
					<div className="flex items-center justify-center py-4 px-4 rounded-xl bg-fill-subtle border border-dashed border-line">
						<p className="text-micro text-fg-subtle text-center">
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
