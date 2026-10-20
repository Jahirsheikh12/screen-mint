import { Shuffle, Upload, X } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BUILT_IN_WALLPAPERS, WALLPAPER_PATHS } from "@/lib/wallpapers";
import { ColorPicker } from "../ColorPicker";
import { SliderControl } from "../SliderControl";
import {
	type BackgroundTab,
	GRADIENT_PRESETS,
	presetToGradientCss,
} from "../settingsPanelBackground";
import { DisabledSettingsGroup, TabContent, TabHeader } from "../settingsPanelLayout";

type SettingsTranslator = (key: string, fallback?: string) => string;
type GradientState = {
	from: string;
	to: string;
	angle: number;
};

interface BackgroundSettingsTabProps {
	tSettings: SettingsTranslator;
	hideBackground: boolean;
	selected: string;
	onWallpaperChange: (path: string) => void;
	backgroundTab: BackgroundTab;
	onBackgroundTabChange: (tab: BackgroundTab) => void;
	fileInputRef: React.RefObject<HTMLInputElement>;
	onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
	customImages: string[];
	onRemoveCustomImage: (imageUrl: string, event: React.MouseEvent) => void;
	wallpaperPreviewPaths: string[];
	selectedColor: string;
	onSelectedColorChange: (color: string) => void;
	colorPalette: string[];
	gradient: string;
	gradientFromColor: string;
	onGradientFromColorChange: (color: string) => void;
	gradientToColor: string;
	onGradientToColorChange: (color: string) => void;
	gradientAngle: number;
	onGradientAngleChange: (angle: number) => void;
	gradientNoise: number;
	onGradientNoiseChange: (noise: number) => void;
	initialGradientState: GradientState;
}

function normalizeWallpaperPath(path: string): string {
	return path.replace(/^file:\/\//, "").replace(/^\//, "");
}

function sanitizeHexInput(value: string): string {
	let next = value;
	if (!next.startsWith("#")) next = `#${next}`;
	return `#${next
		.replace(/^#/, "")
		.replace(/[^0-9A-Fa-f]/g, "")
		.slice(0, 6)}`;
}

function isValidHexColor(value: string): boolean {
	return /^#[0-9A-Fa-f]{6}$/i.test(value);
}

export function BackgroundSettingsTab({
	tSettings,
	hideBackground,
	selected,
	onWallpaperChange,
	backgroundTab,
	onBackgroundTabChange,
	fileInputRef,
	onImageUpload,
	customImages,
	onRemoveCustomImage,
	wallpaperPreviewPaths,
	selectedColor,
	onSelectedColorChange,
	colorPalette,
	gradient,
	gradientFromColor,
	onGradientFromColorChange,
	gradientToColor,
	onGradientToColorChange,
	gradientAngle,
	onGradientAngleChange,
	gradientNoise,
	onGradientNoiseChange,
	initialGradientState,
}: BackgroundSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("background.title")}
				description={tSettings(
					"backgroundTab.setTheBackdropBehind",
					"Set the backdrop behind your recording canvas",
				)}
			/>
			<DisabledSettingsGroup disabled={hideBackground}>
				<Tabs
					value={backgroundTab}
					onValueChange={(value) => onBackgroundTabChange(value as BackgroundTab)}
					className="w-full"
				>
					<TabsList className="mb-3 bg-black/40 border border-white/5 shadow-inner p-1 w-full grid grid-cols-3 h-9 rounded-xl">
						<TabsTrigger
							value="image"
							disabled={hideBackground}
							className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[11px] font-medium py-1 rounded-lg transition-all duration-300 ease-out"
						>
							{tSettings("background.image")}
						</TabsTrigger>
						<TabsTrigger
							value="color"
							disabled={hideBackground}
							className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[11px] font-medium py-1 rounded-lg transition-all duration-300 ease-out"
						>
							{tSettings("background.color")}
						</TabsTrigger>
						<TabsTrigger
							value="gradient"
							disabled={hideBackground}
							className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 text-[11px] font-medium py-1 rounded-lg transition-all duration-300 ease-out"
						>
							{tSettings("background.gradient")}
						</TabsTrigger>
					</TabsList>

					<div
						className={cn(
							"overflow-y-auto custom-scrollbar",
							backgroundTab === "gradient" ? "max-h-[min(520px,65vh)]" : "max-h-[min(300px,40vh)]",
						)}
					>
						<TabsContent value="image" className="mt-0 space-y-2">
							<input
								type="file"
								ref={fileInputRef}
								onChange={onImageUpload}
								disabled={hideBackground}
								accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
								className="hidden"
							/>
							<Button
								onClick={() => fileInputRef.current?.click()}
								disabled={hideBackground}
								variant="outline"
								className="w-full gap-2 bg-white/[0.04] text-slate-200 border-white/[0.08] hover:bg-[#F59E0B]/15 hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all duration-200 h-8 text-[10px] rounded-xl"
							>
								<Upload className="w-3 h-3" />
								{tSettings("background.uploadCustom")}
							</Button>

							<div className="grid grid-cols-7 gap-1.5">
								{customImages.map((imageUrl, idx) => {
									const isSelected = selected === imageUrl;
									return (
										<div
											key={`custom-${idx}`}
											className={cn(
												"aspect-square w-9 h-9 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 relative group shadow-sm hover:scale-105",
												isSelected
													? "border-amber-500 ring-2 ring-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
													: "border-white/10 hover:border-amber-500/40 opacity-80 hover:opacity-100 bg-white/5",
											)}
											style={{
												backgroundImage: `url(${imageUrl})`,
												backgroundSize: "cover",
												backgroundPosition: "center",
											}}
											onClick={() => onWallpaperChange(imageUrl)}
											role="button"
										>
											<button
												type="button"
												disabled={hideBackground}
												onClick={(event) => onRemoveCustomImage(imageUrl, event)}
												className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
											>
												<X className="w-2 h-2 text-white" />
											</button>
										</div>
									);
								})}

								{(wallpaperPreviewPaths.length > 0 ? wallpaperPreviewPaths : WALLPAPER_PATHS).map(
									(previewPath, index) => {
										const wallpaper = BUILT_IN_WALLPAPERS[index];
										const wallpaperValue = WALLPAPER_PATHS[index] ?? previewPath;
										const isSelected = (() => {
											if (!selected) return false;
											if (selected === wallpaperValue) return true;
											try {
												if (
													normalizeWallpaperPath(selected).endsWith(
														normalizeWallpaperPath(wallpaperValue),
													)
												) {
													return true;
												}
												if (
													normalizeWallpaperPath(wallpaperValue).endsWith(
														normalizeWallpaperPath(selected),
													)
												) {
													return true;
												}
											} catch {
												return false;
											}
											return false;
										})();
										const label = wallpaper?.label ?? `Wallpaper ${index + 1}`;
										return (
											<button
												type="button"
												key={wallpaperValue}
												disabled={hideBackground}
												className={cn(
													"aspect-square w-9 h-9 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:scale-105 p-0 bg-white/5",
													isSelected
														? "border-amber-500 ring-2 ring-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
														: "border-white/10 hover:border-amber-500/40 opacity-80 hover:opacity-100",
												)}
												aria-label={label}
												title={label}
												onClick={() => onWallpaperChange(wallpaperValue)}
											>
												<img
													src={previewPath}
													alt=""
													width={36}
													height={36}
													loading="lazy"
													decoding="async"
													draggable={false}
													className="h-full w-full object-cover"
												/>
											</button>
										);
									},
								)}
							</div>
						</TabsContent>

						<TabsContent value="color" className="mt-0 p-2.5">
							<ColorPicker
								color={selectedColor}
								colors={colorPalette}
								onChange={(color) => {
									onSelectedColorChange(color.hex);
									onWallpaperChange(color.hex);
								}}
							/>
						</TabsContent>

						<TabsContent value="gradient" className="mt-0">
							<div className="flex flex-col gap-3 px-0.5">
								<div
									className="w-full rounded-xl overflow-hidden relative"
									style={{
										height: 130,
										background: gradient,
									}}
								>
									{gradientNoise > 0 && (
										<svg
											className="absolute inset-0 w-full h-full pointer-events-none"
											style={{
												opacity: gradientNoise / 100,
												mixBlendMode: "overlay",
											}}
										>
											<filter id="gradient-noise-filter">
												<feTurbulence
													type="fractalNoise"
													baseFrequency="0.65"
													numOctaves="3"
													stitchTiles="stitch"
												/>
												<feColorMatrix type="saturate" values="0" />
											</filter>
											<rect width="100%" height="100%" filter="url(#gradient-noise-filter)" />
										</svg>
									)}
								</div>

								<div className="border-t border-dashed border-white/[0.08] pt-3">
									<div className="grid grid-cols-2 gap-3">
										<div className="flex flex-col gap-1.5">
											<span className="text-[11px] text-slate-300 font-medium">
												{tSettings("backgroundTab.from", "From")}
											</span>
											<div className="flex items-center gap-1.5 h-8 rounded-lg border border-white/10 bg-black/40 px-1.5 shadow-inner focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
												<label className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 cursor-pointer border border-white/10">
													<div
														className="absolute inset-0 rounded-md"
														style={{ backgroundColor: gradientFromColor }}
													/>
													<input
														type="color"
														value={gradientFromColor}
														disabled={hideBackground}
														onChange={(event) => {
															onGradientFromColorChange(event.target.value);
															onWallpaperChange(
																`linear-gradient(${gradientAngle}deg, ${event.target.value} 0%, ${gradientToColor} 100%)`,
															);
														}}
														className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
													/>
												</label>
												<input
													type="text"
													value={gradientFromColor.toUpperCase()}
													disabled={hideBackground}
													onChange={(event) =>
														onGradientFromColorChange(sanitizeHexInput(event.target.value))
													}
													onBlur={() => {
														if (isValidHexColor(gradientFromColor)) {
															onWallpaperChange(
																`linear-gradient(${gradientAngle}deg, ${gradientFromColor} 0%, ${gradientToColor} 100%)`,
															);
														} else {
															onGradientFromColorChange(initialGradientState.from);
														}
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															(event.target as HTMLInputElement).blur();
														}
													}}
													className="flex-1 text-[11px] font-mono text-slate-200 bg-transparent outline-none uppercase tracking-wider min-w-0"
												/>
											</div>
										</div>
										<div className="flex flex-col gap-1.5">
											<span className="text-[11px] text-slate-300 font-medium">
												{tSettings("backgroundTab.to", "To")}
											</span>
											<div className="flex items-center gap-1.5 h-8 rounded-lg border border-white/10 bg-black/40 px-1.5 shadow-inner focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
												<label className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 cursor-pointer border border-white/10">
													<div
														className="absolute inset-0 rounded-md"
														style={{ backgroundColor: gradientToColor }}
													/>
													<input
														type="color"
														value={gradientToColor}
														disabled={hideBackground}
														onChange={(event) => {
															onGradientToColorChange(event.target.value);
															onWallpaperChange(
																`linear-gradient(${gradientAngle}deg, ${gradientFromColor} 0%, ${event.target.value} 100%)`,
															);
														}}
														className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
													/>
												</label>
												<input
													type="text"
													value={gradientToColor.toUpperCase()}
													disabled={hideBackground}
													onChange={(event) =>
														onGradientToColorChange(sanitizeHexInput(event.target.value))
													}
													onBlur={() => {
														if (isValidHexColor(gradientToColor)) {
															onWallpaperChange(
																`linear-gradient(${gradientAngle}deg, ${gradientFromColor} 0%, ${gradientToColor} 100%)`,
															);
														} else {
															onGradientToColorChange(initialGradientState.to);
														}
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															(event.target as HTMLInputElement).blur();
														}
													}}
													className="flex-1 text-[11px] font-mono text-slate-200 bg-transparent outline-none uppercase tracking-wider min-w-0"
												/>
											</div>
										</div>
									</div>
								</div>

								<div className="border-t border-dashed border-white/[0.08] pt-3">
									<SliderControl
										label={tSettings("backgroundTab.angle", "Angle")}
										value={gradientAngle}
										defaultValue={135}
										min={0}
										max={360}
										step={1}
										onChange={(value) => {
											onGradientAngleChange(value);
											onWallpaperChange(
												`linear-gradient(${value}deg, ${gradientFromColor} 0%, ${gradientToColor} 100%)`,
											);
										}}
										formatValue={(value) => `${value}°`}
										parseInput={(text) => {
											const parsed = Number.parseInt(text);
											return Number.isNaN(parsed) ? null : parsed;
										}}
										disabled={hideBackground}
									/>
								</div>

								<div className="border-t border-dashed border-white/[0.08] pt-3">
									<SliderControl
										label={tSettings("backgroundTab.noise", "Noise")}
										value={gradientNoise}
										defaultValue={0}
										min={0}
										max={100}
										step={1}
										onChange={(value) => onGradientNoiseChange(value)}
										formatValue={(value) => `${value}%`}
										parseInput={(text) => {
											const parsed = Number.parseInt(text);
											return Number.isNaN(parsed) ? null : parsed;
										}}
										disabled={hideBackground}
									/>
								</div>

								<div className="border-t border-dashed border-white/[0.08] pt-3">
									<div className="grid grid-cols-7 gap-2">
										<button
											type="button"
											disabled={hideBackground}
											onClick={() => {
												const preset =
													GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)];
												onGradientFromColorChange(preset.from);
												onGradientToColorChange(preset.to);
												onGradientAngleChange(preset.angle);
												onWallpaperChange(presetToGradientCss(preset));
											}}
											className="aspect-square rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-[#F59E0B]/50 hover:bg-white/[0.04] text-slate-500 hover:text-[#F59E0B]"
											title={tSettings("backgroundTab.randomizeGradient", "Randomize gradient")}
										>
											<Shuffle className="w-3.5 h-3.5" />
										</button>
										{GRADIENT_PRESETS.map((preset, idx) => {
											const css = presetToGradientCss(preset);
											const isSelected =
												gradientFromColor === preset.from && gradientToColor === preset.to;
											return (
												<div
													key={`preset-${idx}`}
													className={cn(
														"aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:scale-105",
														isSelected
															? "border-[#F59E0B] ring-1 ring-[#F59E0B]/30"
															: "border-white/10 hover:border-[#F59E0B]/40 opacity-80 hover:opacity-100",
													)}
													style={{ background: css }}
													aria-label={`Gradient preset ${idx + 1}`}
													onClick={() => {
														onGradientFromColorChange(preset.from);
														onGradientToColorChange(preset.to);
														onGradientAngleChange(preset.angle);
														onWallpaperChange(css);
													}}
													role="button"
												/>
											);
										})}
									</div>
								</div>
							</div>
						</TabsContent>
					</div>
				</Tabs>
			</DisabledSettingsGroup>
		</TabContent>
	);
}
