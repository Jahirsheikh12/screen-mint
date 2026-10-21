import { AudioLines, ChevronDown } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import type { AudioMixSettings, AudioMixTrack } from "./audioMix";
import { normalizeAudioMixSettings } from "./audioMix";
import type { AutoPolishContentType } from "./autoPolish";
import {
	normalizeScene3DSettings,
	SCENE_3D_PRESET_IDS,
	type Scene3DEnvironment,
	type Scene3DPresetId,
	type Scene3DSettings,
} from "./scene3d";
import { SettingsSection } from "./settingsPanelLayout";
import { DEVICE_MOCKUP_OPTIONS, type DeviceMockup } from "./types";

const ENVIRONMENTS: Scene3DEnvironment[] = [
	"studio",
	"keynote",
	"soft-gradient",
	"dark-stage",
	"transparent",
];

const CONTENT_TYPES: Array<{ value: AutoPolishContentType; label: string }> = [
	{ value: "product-hunt", label: "Product Hunt" },
	{ value: "landing-page", label: "Landing page" },
	{ value: "app-store", label: "App Store" },
	{ value: "pitch-deck", label: "Pitch deck" },
];

interface SceneAudioPolishPanelProps {
	scene3D: Scene3DSettings;
	audioMix: AudioMixSettings;
	onScene3DChange: (settings: Scene3DSettings) => void;
	onAudioMixChange: (settings: AudioMixSettings) => void;
	onAutoPolish: (contentType: AutoPolishContentType) => void;
	embedded?: boolean;
}

function updateTrack(
	mix: AudioMixSettings,
	trackId: string,
	updater: (track: AudioMixTrack) => AudioMixTrack,
) {
	return normalizeAudioMixSettings({
		...mix,
		tracks: mix.tracks.map((track) => (track.id === trackId ? updater(track) : track)),
	});
}

function numericValue(value: string, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative w-full group">
			{children}
			<ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none group-hover:text-accent-fg transition-colors" />
		</div>
	);
}

export function SceneAudioPolishPanel({
	scene3D,
	audioMix,
	onScene3DChange,
	onAudioMixChange,
	onAutoPolish,
	embedded = false,
}: SceneAudioPolishPanelProps) {
	const { t } = useI18n();
	const updateScene = (patch: Partial<Scene3DSettings>) => {
		onScene3DChange(normalizeScene3DSettings({ ...scene3D, ...patch }));
	};
	const updateLens = (key: keyof Scene3DSettings["lens"], value: number) => {
		updateScene({ lens: { ...scene3D.lens, [key]: value } });
	};
	const updateLighting = (key: keyof Scene3DSettings["lighting"], value: number) => {
		updateScene({ lighting: { ...scene3D.lighting, [key]: value } });
	};

	const inputClass =
		"w-full bg-sunken border border-line hover:border-line-strong focus:border-accent/50 text-fg h-8 px-2.5 rounded-md text-caption outline-none transition-all font-medium placeholder:text-fg-subtle";
	const selectClass = cn(inputClass, "appearance-none cursor-pointer pr-8");

	return (
		<div
			className={cn(
				"w-full h-full shrink-0 min-w-0 bg-canvas/90 backdrop-blur-2xl border border-line rounded-2xl flex flex-col shadow-panel overflow-hidden",
				embedded ? "" : "w-[400px]",
			)}
		>
			<div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar p-4 pb-20 relative">
				<SettingsSection
					title="3D Scene"
					description={t(
						"editor.polishPanel.environmentLensAndLighting",
						"Environment, lens, and lighting configuration",
					)}
				>
					<label className="mb-2 flex items-center justify-between gap-3 text-caption text-fg-muted p-3 rounded-lg bg-fill-subtle border border-line hover:bg-fill-subtle transition-colors cursor-pointer group">
						<span className="font-medium group-hover:text-fg-muted transition-colors">
							{t("editor.polishPanel.enable3dRendering", "Enable 3D Rendering")}
						</span>
						<div className="relative flex items-center">
							<input
								type="checkbox"
								checked={scene3D.enabled}
								onChange={(event) => updateScene({ enabled: event.target.checked })}
								className="peer appearance-none w-8 h-4 bg-sunken border border-line-strong rounded-full checked:bg-accent checked:border-accent transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
							/>
							<div className="absolute left-[2px] top-[2px] w-3 h-3 bg-fg-subtle rounded-full pointer-events-none peer-checked:translate-x-4 peer-checked:bg-fixed-white transition-transform shadow-sm" />
						</div>
					</label>

					<div className="grid grid-cols-2 gap-3 mt-1">
						<div className="space-y-1.5">
							<label className="text-micro font-semibold text-fg-subtle uppercase tracking-wider pl-0.5">
								{t("editor.polishPanel.preset", "Preset")}
							</label>
							<SelectWrapper>
								<select
									value={scene3D.presetId}
									onChange={(event) =>
										updateScene({ presetId: event.target.value as Scene3DPresetId })
									}
									className={selectClass}
								>
									{SCENE_3D_PRESET_IDS.map((preset) => (
										<option key={preset} value={preset} className="bg-surface">
											{preset.split("-").join(" ")}
										</option>
									))}
								</select>
							</SelectWrapper>
						</div>
						<div className="space-y-1.5">
							<label className="text-micro font-semibold text-fg-subtle uppercase tracking-wider pl-0.5">
								{t("editor.polishPanel.device", "Device")}
							</label>
							<SelectWrapper>
								<select
									value={scene3D.deviceModel}
									onChange={(event) =>
										updateScene({ deviceModel: event.target.value as DeviceMockup })
									}
									className={selectClass}
								>
									{DEVICE_MOCKUP_OPTIONS.map((option) => (
										<option key={option.value} value={option.value} className="bg-surface">
											{option.label}
										</option>
									))}
								</select>
							</SelectWrapper>
						</div>
						<div className="space-y-1.5">
							<label className="text-micro font-semibold text-fg-subtle uppercase tracking-wider pl-0.5">
								{t("editor.polishPanel.environment", "Environment")}
							</label>
							<SelectWrapper>
								<select
									value={scene3D.environment}
									onChange={(event) =>
										updateScene({ environment: event.target.value as Scene3DEnvironment })
									}
									className={selectClass}
								>
									{ENVIRONMENTS.map((environment) => (
										<option key={environment} value={environment} className="bg-surface">
											{environment.split("-").join(" ")}
										</option>
									))}
								</select>
							</SelectWrapper>
						</div>
						<div className="space-y-1.5">
							<label className="text-micro font-semibold text-fg-subtle uppercase tracking-wider pl-0.5">
								{t("editor.polishPanel.fallback", "Fallback")}
							</label>
							<SelectWrapper>
								<select
									value={scene3D.fallback2DMockup}
									onChange={(event) =>
										updateScene({ fallback2DMockup: event.target.value as DeviceMockup })
									}
									className={selectClass}
								>
									{DEVICE_MOCKUP_OPTIONS.map((option) => (
										<option key={option.value} value={option.value} className="bg-surface">
											{option.label}
										</option>
									))}
								</select>
							</SelectWrapper>
						</div>
					</div>

					<div className="mt-4">
						<div className="text-micro font-bold text-fg-muted uppercase tracking-widest mb-3 flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-info/50" />{" "}
							{t("editor.polishPanel.lens", "Lens")}
						</div>
						<div className="grid grid-cols-3 gap-2">
							{[
								["focalLengthMm", "Focal"],
								["perspectiveStrength", "Perspective"],
								["depthOfField", "DOF"],
								["vignette", "Vignette"],
								["bloom", "Bloom"],
								["motionBlur", "Motion"],
							].map(([key, label]) => (
								<label key={key} className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">{label}</span>
									<input
										type="number"
										step={key === "focalLengthMm" ? 1 : 0.05}
										value={scene3D.lens[key as keyof Scene3DSettings["lens"]]}
										onChange={(event) =>
											updateLens(
												key as keyof Scene3DSettings["lens"],
												numericValue(
													event.target.value,
													scene3D.lens[key as keyof Scene3DSettings["lens"]],
												),
											)
										}
										className={inputClass}
									/>
								</label>
							))}
						</div>
					</div>

					<div className="mt-4">
						<div className="text-micro font-bold text-fg-muted uppercase tracking-widest mb-3 flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-accent/50" />{" "}
							{t("editor.polishPanel.lighting", "Lighting")}
						</div>
						<div className="grid grid-cols-3 gap-2">
							{[
								["keyIntensity", "Key"],
								["fillIntensity", "Fill"],
								["rimIntensity", "Rim"],
								["reflectionIntensity", "Reflect"],
								["shadowSoftness", "Shadow"],
							].map(([key, label]) => (
								<label key={key} className="space-y-1.5">
									<span className="text-micro font-medium text-fg-subtle pl-0.5">{label}</span>
									<input
										type="number"
										step="0.05"
										value={scene3D.lighting[key as keyof Scene3DSettings["lighting"]]}
										onChange={(event) =>
											updateLighting(
												key as keyof Scene3DSettings["lighting"],
												numericValue(
													event.target.value,
													scene3D.lighting[key as keyof Scene3DSettings["lighting"]],
												),
											)
										}
										className={inputClass}
									/>
								</label>
							))}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection
					title={t("editor.polishPanel.audioMix", "Audio Mix")}
					description={t(
						"editor.polishPanel.trackVolumeAndDucking",
						"Track volume and ducking rules",
					)}
				>
					<label className="flex items-center justify-between gap-3 text-caption text-fg-muted p-3 rounded-lg bg-fill-subtle border border-line hover:bg-fill-subtle transition-colors cursor-pointer group">
						<span className="font-medium group-hover:text-fg-muted transition-colors flex items-center gap-2">
							<AudioLines className="w-3.5 h-3.5 text-accent-fg" />{" "}
							{t("editor.polishPanel.masterVolume", "Master Volume")}
						</span>
						<input
							type="number"
							step="0.05"
							min="0"
							max="2"
							value={audioMix.masterVolume}
							onChange={(event) =>
								onAudioMixChange(
									normalizeAudioMixSettings({
										...audioMix,
										masterVolume: numericValue(event.target.value, audioMix.masterVolume),
									}),
								)
							}
							className={cn(inputClass, "w-16 text-center !px-1 h-7 bg-scrim/60")}
						/>
					</label>
					<div className="space-y-2 mt-2">
						{audioMix.tracks.map((track) => (
							<div
								key={track.id}
								className="rounded-lg border border-line bg-fill-subtle overflow-hidden shadow-sm"
							>
								<div className="px-3 py-2 bg-fill-subtle border-b border-line flex items-center justify-between">
									<span className="text-caption font-bold text-fg tracking-wider uppercase">
										{track.label}
									</span>
									<div className="flex items-center gap-3">
										<label className="flex items-center gap-1.5 cursor-pointer group">
											<div className="relative flex items-center">
												<input
													type="checkbox"
													checked={track.muted}
													onChange={(event) =>
														onAudioMixChange(
															updateTrack(audioMix, track.id, (current) => ({
																...current,
																muted: event.target.checked,
															})),
														)
													}
													className="peer appearance-none w-6 h-3.5 bg-sunken border border-line-strong rounded-full checked:bg-danger checked:border-danger transition-colors cursor-pointer outline-none"
												/>
												<div className="absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-fg-subtle rounded-full pointer-events-none peer-checked:translate-x-2.5 peer-checked:bg-fixed-white transition-transform" />
											</div>
											<span className="text-micro font-medium text-fg-subtle group-hover:text-fg-muted">
												{t("editor.polishPanel.mute", "Mute")}
											</span>
										</label>
										<label className="flex items-center gap-1.5 cursor-pointer group">
											<div className="relative flex items-center">
												<input
													type="checkbox"
													checked={track.solo}
													onChange={(event) =>
														onAudioMixChange(
															updateTrack(audioMix, track.id, (current) => ({
																...current,
																solo: event.target.checked,
															})),
														)
													}
													className="peer appearance-none w-6 h-3.5 bg-sunken border border-line-strong rounded-full checked:bg-accent checked:border-accent transition-colors cursor-pointer outline-none"
												/>
												<div className="absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-fg-subtle rounded-full pointer-events-none peer-checked:translate-x-2.5 peer-checked:bg-fixed-white transition-transform" />
											</div>
											<span className="text-micro font-medium text-fg-subtle group-hover:text-fg-muted">
												{t("editor.polishPanel.solo", "Solo")}
											</span>
										</label>
									</div>
								</div>
								<div className="p-3 grid grid-cols-4 gap-2">
									<label className="flex flex-col gap-1.5 cursor-pointer group col-span-1 justify-center border-r border-line pr-2">
										<div className="flex items-center gap-2">
											<div className="relative flex items-center">
												<input
													type="checkbox"
													checked={track.duckUnderSpeech}
													onChange={(event) =>
														onAudioMixChange(
															updateTrack(audioMix, track.id, (current) => ({
																...current,
																duckUnderSpeech: event.target.checked,
															})),
														)
													}
													className="peer appearance-none w-6 h-3.5 bg-sunken border border-line-strong rounded-full checked:bg-info checked:border-info transition-colors cursor-pointer outline-none"
												/>
												<div className="absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-fg-subtle rounded-full pointer-events-none peer-checked:translate-x-2.5 peer-checked:bg-fixed-white transition-transform" />
											</div>
											<span className="text-micro font-medium text-fg-subtle group-hover:text-fg-muted">
												{t("editor.polishPanel.duck", "Duck")}
											</span>
										</div>
									</label>
									<label className="space-y-1.5 col-span-1 pl-1">
										<span className="text-micro font-semibold text-fg-subtle uppercase pl-0.5">
											{t("editor.polishPanel.vol", "Vol")}
										</span>
										<input
											type="number"
											step="0.05"
											value={track.volume}
											onChange={(event) =>
												onAudioMixChange(
													updateTrack(audioMix, track.id, (current) => ({
														...current,
														volume: numericValue(event.target.value, current.volume),
													})),
												)
											}
											className={inputClass}
										/>
									</label>
									<label className="space-y-1.5 col-span-1">
										<span className="text-micro font-semibold text-fg-subtle uppercase pl-0.5">
											{t("editor.polishPanel.fadeIn", "Fade In")}
										</span>
										<input
											type="number"
											value={track.fadeInMs}
											onChange={(event) =>
												onAudioMixChange(
													updateTrack(audioMix, track.id, (current) => ({
														...current,
														fadeInMs: numericValue(event.target.value, current.fadeInMs),
													})),
												)
											}
											className={inputClass}
										/>
									</label>
									<label className="space-y-1.5 col-span-1">
										<span className="text-micro font-semibold text-fg-subtle uppercase pl-0.5">
											{t("editor.polishPanel.fadeOut", "Fade Out")}
										</span>
										<input
											type="number"
											value={track.fadeOutMs}
											onChange={(event) =>
												onAudioMixChange(
													updateTrack(audioMix, track.id, (current) => ({
														...current,
														fadeOutMs: numericValue(event.target.value, current.fadeOutMs),
													})),
												)
											}
											className={inputClass}
										/>
									</label>
								</div>
							</div>
						))}
					</div>
				</SettingsSection>

				<SettingsSection
					title={t("editor.polishPanel.autoPolish", "Auto Polish")}
					description={t(
						"editor.polishPanel.oneClickStudioTemplates",
						"One-click studio templates",
					)}
				>
					<div className="grid grid-cols-[1fr_auto] gap-2 items-center p-3 rounded-lg border border-line bg-fill-subtle">
						<SelectWrapper>
							<select
								defaultValue="product-hunt"
								className={selectClass}
								onChange={(event) => {
									event.currentTarget.dataset.selected = event.target.value;
								}}
								data-selected="product-hunt"
							>
								{CONTENT_TYPES.map((type) => (
									<option key={type.value} value={type.value} className="bg-surface">
										{type.label}
									</option>
								))}
							</select>
						</SelectWrapper>
						<button
							type="button"
							className="h-8 px-4 rounded-lg bg-gradient-to-r from-accent to-accent text-fg text-caption font-bold tracking-wider shadow-sm hover:from-accent hover:to-accent transition-all duration-300"
							onClick={(event) => {
								const select = event.currentTarget.previousElementSibling?.querySelector(
									"select",
								) as HTMLSelectElement | null;
								onAutoPolish((select?.value as AutoPolishContentType) ?? "product-hunt");
							}}
						>
							APPLY
						</button>
					</div>
				</SettingsSection>
			</div>
		</div>
	);
}
