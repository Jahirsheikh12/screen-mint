import {
	ChevronDown,
	ChevronUp,
	Download,
	Film,
	FolderOpen,
	Image,
	Save,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
	ExportFormat,
	GifColorCount,
	GifDitherMode,
	GifExportConfig,
	GifFrameRate,
	GifMotionSensitivity,
	GifResolutionMode,
	ResolvedGifExportPlan,
	ResolvedVideoExportPlan,
	VideoBitrateMode,
	VideoExportFrameRateMode,
	VideoExportSettings,
	VideoResolutionMode,
} from "@/lib/exporter";
import {
	GIF_COLOR_COUNT_OPTIONS,
	GIF_DITHER_MODE_OPTIONS,
	GIF_EXPORT_PRESETS,
	GIF_FRAME_RATES,
	GIF_MOTION_SENSITIVITY_OPTIONS,
	GIF_RESOLUTION_MODE_OPTIONS,
	VIDEO_BITRATE_MODE_OPTIONS,
	VIDEO_EXPORT_PRESETS,
	VIDEO_FRAME_RATE_MODE_OPTIONS,
	VIDEO_RESOLUTION_MODE_OPTIONS,
	getGifExportSettingsForPreset,
	getVideoExportSettingsForPreset,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { useScopedT } from "../../contexts/I18nContext";

interface ExportSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	exportFormat: ExportFormat;
	onExportFormatChange: (format: ExportFormat) => void;
	videoExportSettings: VideoExportSettings;
	onVideoExportSettingsChange: (settings: VideoExportSettings) => void;
	gifExportSettings: GifExportConfig;
	onGifExportSettingsChange: (settings: GifExportConfig) => void;
	resolvedVideoPlan: ResolvedVideoExportPlan;
	resolvedGifPlan: ResolvedGifExportPlan;
	onSaveProject: () => void;
	onLoadProject: () => void;
	onExport: () => void;
}

function formatEstimatedSize(bytes: number): string {
	if (bytes >= 1_000_000) {
		return `${(bytes / 1_000_000).toFixed(1)} MB est.`;
	}
	return `${Math.round(bytes / 1_000)} KB est.`;
}

function OptionGridButton({
	label,
	description,
	selected,
	disabled = false,
	onClick,
}: {
	label: string;
	description?: string;
	selected: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition-all duration-200",
				selected
					? "border-[#F59E0B]/30 bg-[#F59E0B]/8 text-white shadow-[0_0_0_1px_rgba(245,158,11,0.08)]"
					: "text-slate-300 hover:bg-white/[0.05]",
				disabled && "cursor-not-allowed opacity-50 hover:bg-white/[0.03] shadow-none",
			)}
		>
			<div className="text-xs font-semibold">{label}</div>
			{description ? <div className="mt-1 text-[10px] text-slate-500">{description}</div> : null}
		</button>
	);
}

function SegmentedButtons<T extends string | number>({
	options,
	value,
	disabled = false,
	onChange,
	columnsClassName,
}: {
	options: Array<{ value: T; label: string }>;
	value: T;
	disabled?: boolean;
	onChange: (value: T) => void;
	columnsClassName: string;
}) {
	return (
		<div
			className={cn(
				"grid h-auto w-full rounded-xl border border-white/[0.06] bg-black/20 p-1 gap-1",
				columnsClassName,
				disabled && "opacity-55",
			)}
		>
			{options.map((option) => (
				<button
					type="button"
					key={String(option.value)}
					disabled={disabled}
					onClick={() => onChange(option.value)}
					className={cn(
						"rounded-lg px-2 py-2 transition-all duration-200 text-[11px] font-semibold",
						value === option.value
							? "bg-gradient-to-b from-white to-white/90 text-[#0A0F0D] shadow-sm"
							: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
						disabled && "cursor-not-allowed hover:text-slate-400 hover:bg-transparent",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

export function ExportSettingsDialog({
	isOpen,
	onClose,
	exportFormat,
	onExportFormatChange,
	videoExportSettings,
	onVideoExportSettingsChange,
	gifExportSettings,
	onGifExportSettingsChange,
	resolvedVideoPlan,
	resolvedGifPlan,
	onSaveProject,
	onLoadProject,
	onExport,
}: ExportSettingsDialogProps) {
	const tSettings = useScopedT("settings");
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const [videoAdvancedOpen, setVideoAdvancedOpen] = useState(false);
	const [gifAdvancedOpen, setGifAdvancedOpen] = useState(false);
	const prevIsOpenRef = useRef(isOpen);

	useEffect(() => {
		if (isOpen && !prevIsOpenRef.current) {
			setIsVisible(true);
			setIsClosing(false);
		} else if (!isOpen && prevIsOpenRef.current) {
			setIsClosing(true);
			const timer = setTimeout(() => {
				setIsVisible(false);
				setIsClosing(false);
			}, 250);
			prevIsOpenRef.current = isOpen;
			return () => clearTimeout(timer);
		}
		prevIsOpenRef.current = isOpen;
	}, [isOpen]);

	if (!isOpen && !isVisible) return null;

	const videoAdvancedEnabled = videoExportSettings.mode === "custom";
	const gifAdvancedEnabled = gifExportSettings.mode === "custom";

	const handleVideoPresetSelect = (preset: VideoExportSettings["preset"]) => {
		onVideoExportSettingsChange(getVideoExportSettingsForPreset(preset));
	};

	const handleGifPresetSelect = (preset: GifExportConfig["preset"]) => {
		onGifExportSettingsChange(getGifExportSettingsForPreset(preset));
	};

	return (
		<>
			<div
				className={cn(
					"fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md transition-all",
					isClosing
						? "opacity-0 duration-250 ease-in"
						: "opacity-100 duration-300 ease-out animate-in fade-in",
				)}
				onClick={onClose}
			/>

			<div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
				<div
					className={cn(
						"pointer-events-auto w-[90vw] max-w-[540px] bg-[#0A0F0D] rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.08] overflow-hidden transition-all",
						isClosing
							? "opacity-0 scale-95 translate-y-2 duration-200 ease-in"
							: "opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3",
					)}
				>
					<div className="h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />

					<div className="max-h-[85vh] overflow-y-auto p-6">
						<div className="mb-6 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F59E0B]/20 bg-gradient-to-br from-[#F59E0B]/20 to-[#d97706]/10">
									<Download className="h-4.5 w-4.5 text-[#F59E0B]" />
								</div>
								<div>
									<h2 className="text-[15px] font-semibold tracking-tight text-white">
										{tSettings("export.title", "Export")}
									</h2>
									<p className="mt-0.5 text-[11px] text-slate-500">
										Configure your export settings
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl p-2 text-white/40 transition-all duration-200 active:scale-95 hover:bg-white/[0.06] hover:text-white"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="mb-5">
							<div className="mb-2 border-l-2 border-l-amber-500/60 pl-2.5 text-[11px] font-semibold tracking-wide text-slate-200">
								Format
							</div>
							<div className="flex items-center gap-2">
								{[
									{ value: "mp4" as const, icon: Film, label: tSettings("export.mp4") },
									{ value: "gif" as const, icon: Image, label: tSettings("export.gif") },
								].map((option) => {
									const Icon = option.icon;
									return (
										<button
											type="button"
											key={option.value}
											onClick={() => onExportFormatChange(option.value)}
											className={cn(
												"flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all duration-200",
												exportFormat === option.value
													? "border-[#F59E0B]/30 bg-[#F59E0B]/8 text-white"
													: "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-slate-200",
											)}
										>
											<Icon className="h-4 w-4" />
											<span className="text-xs font-semibold">{option.label}</span>
										</button>
									);
								})}
							</div>
						</div>

						{exportFormat === "mp4" ? (
							<div className="mb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
								<div>
									<div className="mb-2 border-l-2 border-l-amber-500/60 pl-2.5 text-[11px] font-semibold tracking-wide text-slate-200">
										Preset
									</div>
									<div className="grid grid-cols-2 gap-2">
										{Object.entries(VIDEO_EXPORT_PRESETS).map(([preset, config]) => (
											<OptionGridButton
												key={preset}
												label={config.label}
												description={config.description}
												selected={videoExportSettings.preset === preset}
												onClick={() =>
													handleVideoPresetSelect(preset as VideoExportSettings["preset"])
												}
											/>
										))}
									</div>
								</div>

								<div className="rounded-xl border border-white/[0.06] bg-black/20">
									<button
										type="button"
										onClick={() => setVideoAdvancedOpen((current) => !current)}
										className="flex w-full items-center justify-between px-3 py-3 text-left"
									>
										<div>
											<div className="text-xs font-semibold text-white">Advanced</div>
											<div className="mt-0.5 text-[10px] text-slate-500">
												Manual resolution, FPS, and bitrate controls
											</div>
										</div>
										{videoAdvancedOpen ? (
											<ChevronUp className="h-4 w-4 text-slate-400" />
										) : (
											<ChevronDown className="h-4 w-4 text-slate-400" />
										)}
									</button>

									{videoAdvancedOpen ? (
										<div className="space-y-4 border-t border-white/[0.06] p-3">
											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">Mode</div>
												<SegmentedButtons
													value={videoExportSettings.mode}
													onChange={(mode) =>
														mode === "preset"
															? handleVideoPresetSelect(videoExportSettings.preset)
															: onVideoExportSettingsChange({
																	...videoExportSettings,
																	mode,
																})
													}
													options={[
														{ value: "preset", label: "Preset" },
														{ value: "custom", label: "Custom" },
													]}
													columnsClassName="grid-cols-2"
												/>
												{!videoAdvancedEnabled ? (
													<div className="mt-2 text-[10px] text-slate-500">
														Switch to Custom to tune resolution, FPS, and bitrate directly.
													</div>
												) : null}
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Resolution
												</div>
												<SegmentedButtons
													value={videoExportSettings.resolutionMode}
													onChange={(resolutionMode: VideoResolutionMode) =>
														onVideoExportSettingsChange({
															...videoExportSettings,
															resolutionMode,
														})
													}
													options={VIDEO_RESOLUTION_MODE_OPTIONS}
													columnsClassName="grid-cols-5"
													disabled={!videoAdvancedEnabled}
												/>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Frame Rate
												</div>
												<SegmentedButtons
													value={videoExportSettings.frameRateMode}
													onChange={(frameRateMode: VideoExportFrameRateMode) =>
														onVideoExportSettingsChange({
															...videoExportSettings,
															frameRateMode,
														})
													}
													options={VIDEO_FRAME_RATE_MODE_OPTIONS}
													columnsClassName="grid-cols-3"
													disabled={!videoAdvancedEnabled}
												/>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">Bitrate</div>
												<div className="grid grid-cols-3 gap-2">
													{VIDEO_BITRATE_MODE_OPTIONS.map((option) => (
														<OptionGridButton
															key={option.value}
															label={option.label}
															description={option.description}
															selected={videoExportSettings.bitrateMode === option.value}
															disabled={!videoAdvancedEnabled}
															onClick={() =>
																onVideoExportSettingsChange({
																	...videoExportSettings,
																	bitrateMode: option.value as VideoBitrateMode,
																})
															}
														/>
													))}
												</div>
												{videoAdvancedEnabled && videoExportSettings.bitrateMode === "custom" ? (
													<div className="mt-3">
														<label className="mb-2 block text-[11px] font-semibold text-slate-300">
															Custom Bitrate (Mbps)
														</label>
														<Input
															type="number"
															min={4}
															max={80}
															step={1}
															value={videoExportSettings.customBitrateMbps ?? 12}
															onChange={(event) =>
																onVideoExportSettingsChange({
																	...videoExportSettings,
																	customBitrateMbps: Math.min(
																		80,
																		Math.max(4, Number(event.target.value) || 12),
																	),
																})
															}
															className="border-white/[0.08] bg-white/[0.03] text-white"
														/>
													</div>
												) : null}
											</div>
										</div>
									) : null}
								</div>

								<div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div>
										<span className="text-xs font-medium text-slate-300">Optimize for Web</span>
										<span className="mt-0.5 block text-[10px] text-slate-500">
											Prefer safer H.264 profiles and instant playback on the web
										</span>
									</div>
									<Switch
										checked={videoExportSettings.optimizeForWeb}
										onCheckedChange={(checked) =>
											onVideoExportSettingsChange({
												...videoExportSettings,
												optimizeForWeb: checked,
											})
										}
										className="scale-90 data-[state=checked]:bg-[#F59E0B]"
									/>
								</div>

								<div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div className="mb-2 text-[11px] font-semibold text-white">Resolved Output</div>
									<div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
										<div>
											{resolvedVideoPlan.width} × {resolvedVideoPlan.height}
										</div>
										<div>{resolvedVideoPlan.frameRate} FPS</div>
										<div>{resolvedVideoPlan.codecLabel}</div>
										<div>{(resolvedVideoPlan.bitrate / 1_000_000).toFixed(1)} Mbps</div>
									</div>
									{resolvedVideoPlan.fallbackSteps.map((step) => (
										<div key={step} className="mt-1 text-[10px] text-amber-300">
											{step}
										</div>
									))}
									{resolvedVideoPlan.warnings.map((warning) => (
										<div key={warning} className="mt-1 text-[10px] text-slate-500">
											{warning}
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="mb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
								<div>
									<div className="mb-2 border-l-2 border-l-amber-500/60 pl-2.5 text-[11px] font-semibold tracking-wide text-slate-200">
										Preset
									</div>
									<div className="grid grid-cols-3 gap-2">
										{Object.entries(GIF_EXPORT_PRESETS).map(([preset, config]) => (
											<OptionGridButton
												key={preset}
												label={config.label.split(" ")[0]}
												description={config.label}
												selected={gifExportSettings.preset === preset}
												onClick={() => handleGifPresetSelect(preset as GifExportConfig["preset"])}
											/>
										))}
									</div>
								</div>

								<div className="rounded-xl border border-white/[0.06] bg-black/20">
									<button
										type="button"
										onClick={() => setGifAdvancedOpen((current) => !current)}
										className="flex w-full items-center justify-between px-3 py-3 text-left"
									>
										<div>
											<div className="text-xs font-semibold text-white">Advanced</div>
											<div className="mt-0.5 text-[10px] text-slate-500">
												Manual GIF quality, color, and motion controls
											</div>
										</div>
										{gifAdvancedOpen ? (
											<ChevronUp className="h-4 w-4 text-slate-400" />
										) : (
											<ChevronDown className="h-4 w-4 text-slate-400" />
										)}
									</button>

									{gifAdvancedOpen ? (
										<div className="space-y-4 border-t border-white/[0.06] p-3">
											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">Mode</div>
												<SegmentedButtons
													value={gifExportSettings.mode}
													onChange={(mode) =>
														mode === "preset"
															? handleGifPresetSelect(gifExportSettings.preset)
															: onGifExportSettingsChange({
																	...gifExportSettings,
																	mode,
																})
													}
													options={[
														{ value: "preset", label: "Preset" },
														{ value: "custom", label: "Custom" },
													]}
													columnsClassName="grid-cols-2"
												/>
												{!gifAdvancedEnabled ? (
													<div className="mt-2 text-[10px] text-slate-500">
														Switch to Custom to tune GIF resolution, frame rate, and color handling.
													</div>
												) : null}
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Resolution
												</div>
												<SegmentedButtons
													value={gifExportSettings.resolutionMode}
													onChange={(resolutionMode: GifResolutionMode) =>
														onGifExportSettingsChange({
															...gifExportSettings,
															resolutionMode,
														})
													}
													options={GIF_RESOLUTION_MODE_OPTIONS}
													columnsClassName="grid-cols-4"
													disabled={!gifAdvancedEnabled}
												/>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Frame Rate
												</div>
												<SegmentedButtons
													value={gifExportSettings.frameRate}
													onChange={(frameRate: GifFrameRate) =>
														onGifExportSettingsChange({
															...gifExportSettings,
															frameRate,
														})
													}
													options={GIF_FRAME_RATES.map((rate) => ({
														value: rate.value,
														label: String(rate.value),
													}))}
													columnsClassName="grid-cols-4"
													disabled={!gifAdvancedEnabled}
												/>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Color Count
												</div>
												<SegmentedButtons
													value={gifExportSettings.colorCount}
													onChange={(colorCount: GifColorCount) =>
														onGifExportSettingsChange({
															...gifExportSettings,
															colorCount,
														})
													}
													options={GIF_COLOR_COUNT_OPTIONS.map((option) => ({
														value: option.value,
														label: option.label,
													}))}
													columnsClassName="grid-cols-3"
													disabled={!gifAdvancedEnabled}
												/>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Dithering
												</div>
												<div className="grid grid-cols-3 gap-2">
													{GIF_DITHER_MODE_OPTIONS.map((option) => (
														<OptionGridButton
															key={option.value}
															label={option.label}
															description={option.description}
															selected={gifExportSettings.ditherMode === option.value}
															disabled={!gifAdvancedEnabled}
															onClick={() =>
																onGifExportSettingsChange({
																	...gifExportSettings,
																	ditherMode: option.value as GifDitherMode,
																})
															}
														/>
													))}
												</div>
											</div>

											<div>
												<div className="mb-2 text-[11px] font-semibold text-slate-300">
													Motion Sensitivity
												</div>
												<div className="grid grid-cols-3 gap-2">
													{GIF_MOTION_SENSITIVITY_OPTIONS.map((option) => (
														<OptionGridButton
															key={option.value}
															label={option.label}
															description={option.description}
															selected={gifExportSettings.motionSensitivity === option.value}
															disabled={!gifAdvancedEnabled}
															onClick={() =>
																onGifExportSettingsChange({
																	...gifExportSettings,
																	motionSensitivity: option.value as GifMotionSensitivity,
																})
															}
														/>
													))}
												</div>
											</div>
										</div>
									) : null}
								</div>

								<div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div>
										<span className="text-xs font-medium text-slate-300">
											{tSettings("export.loop")}
										</span>
										<span className="mt-0.5 block text-[10px] text-slate-500">
											Loop the GIF forever
										</span>
									</div>
									<Switch
										checked={gifExportSettings.loop}
										onCheckedChange={(checked) =>
											onGifExportSettingsChange({ ...gifExportSettings, loop: checked })
										}
										className="scale-90 data-[state=checked]:bg-[#F59E0B]"
									/>
								</div>

								<div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div>
										<span className="text-xs font-medium text-slate-300">
											Dedupe Similar Frames
										</span>
										<span className="mt-0.5 block text-[10px] text-slate-500">
											Merge near-identical frames to reduce GIF size
										</span>
									</div>
									<Switch
										checked={gifExportSettings.dedupeFrames}
										onCheckedChange={(checked) =>
											onGifExportSettingsChange({ ...gifExportSettings, dedupeFrames: checked })
										}
										className="scale-90 data-[state=checked]:bg-[#F59E0B]"
									/>
								</div>

								<div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
									<div className="mb-2 text-[11px] font-semibold text-white">Resolved Output</div>
									<div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
										<div>
											{resolvedGifPlan.width} × {resolvedGifPlan.height}
										</div>
										<div>{resolvedGifPlan.frameRate} FPS</div>
										<div>{resolvedGifPlan.loop ? "Looping" : "Play once"}</div>
										<div>{formatEstimatedSize(resolvedGifPlan.estimatedSizeBytes)}</div>
										<div>{resolvedGifPlan.colorCount} colors</div>
										<div>{resolvedGifPlan.ditherMode}</div>
									</div>
									{resolvedGifPlan.warnings.map((warning) => (
										<div key={warning} className="mt-1 text-[10px] text-slate-500">
											{warning}
										</div>
									))}
								</div>
							</div>
						)}

						<div className="mb-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

						<div className="mb-4 grid grid-cols-2 gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									onLoadProject();
									onClose();
								}}
								className="h-10 gap-2 rounded-xl border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-slate-400 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-slate-200"
							>
								<FolderOpen className="h-3.5 w-3.5" />
								{tSettings("export.loadProject")}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									onSaveProject();
									onClose();
								}}
								className="h-10 gap-2 rounded-xl border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-slate-400 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-slate-200"
							>
								<Save className="h-3.5 w-3.5" />
								{tSettings("export.saveProject")}
							</Button>
						</div>

						<div className="flex items-center justify-between gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								className="h-11 px-5 text-xs font-medium bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 hover:border-white/[0.12] rounded-xl transition-all duration-200"
							>
								Cancel
							</Button>
							<Button
								type="button"
								size="lg"
								onClick={() => {
									onExport();
									onClose();
								}}
								className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-xl border border-[#F59E0B]/30 bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-sm font-semibold text-white shadow-lg shadow-[#F59E0B]/20 transition-all duration-200 hover:scale-[1.01] hover:shadow-[#F59E0B]/30 active:scale-[0.98]"
							>
								<Zap className="h-4 w-4" />
								{tSettings("export.exportVideo", undefined, {
									format: exportFormat === "gif" ? "GIF" : "Video",
								})}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
