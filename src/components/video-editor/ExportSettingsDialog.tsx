import { Clipboard, FileText, Film, Link, Monitor } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import type {
	ExportDestination,
	ExportFormat,
	GifColorCount,
	GifDitherMode,
	GifExportConfig,
	GifMotionSensitivity,
	GifQualityLabel,
	ResolvedGifExportPlan,
	ResolvedVideoExportPlan,
	VideoExportSettings,
	VideoQualityLabel,
} from "@/lib/exporter";
import {
	GIF_QUALITY_TO_PRESET,
	getGifExportSettingsForPreset,
	getVideoExportSettingsForPreset,
	VIDEO_PRESET_TO_QUALITY,
	VIDEO_QUALITY_TO_PRESET,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";

interface ExportSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	exportFormat: ExportFormat;
	onExportFormatChange: (format: ExportFormat) => void;
	exportDestination: ExportDestination;
	onExportDestinationChange: (dest: ExportDestination) => void;
	videoExportSettings: VideoExportSettings;
	onVideoExportSettingsChange: (settings: VideoExportSettings) => void;
	gifExportSettings: GifExportConfig;
	onGifExportSettingsChange: (settings: GifExportConfig) => void;
	resolvedVideoPlan: ResolvedVideoExportPlan;
	resolvedGifPlan: ResolvedGifExportPlan;
	onExport: (destination: ExportDestination) => void;
}

// --- Sub-components ---

function SectionLabel({ icon, children }: { icon: ReactNode; children: string }) {
	return (
		<div className="mb-3 flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/70">
			<span className="text-white/40">{icon}</span>
			{children}
		</div>
	);
}

function DestinationCard({
	icon,
	label,
	selected,
	disabled = false,
	badge,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	selected: boolean;
	disabled?: boolean;
	badge?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"group relative flex flex-1 flex-col items-center gap-2 rounded-[14px] border py-4 transition-all duration-200",
				selected
					? "border-white/20 bg-white/[0.07] text-white"
					: "border-white/[0.06] text-white/40 hover:border-white/[0.12] hover:text-white/60",
				disabled && "pointer-events-none opacity-30",
			)}
		>
			<span className={cn("transition-colors", selected ? "text-white" : "text-white/30")}>
				{icon}
			</span>
			<span className="text-[11px] font-medium">{label}</span>
			{badge && (
				<span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[8px] text-white/30">
					{badge}
				</span>
			)}
		</button>
	);
}

function Pill({
	children,
	selected,
	className,
	onClick,
}: {
	children: ReactNode;
	selected: boolean;
	className?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex-1 rounded-[10px] border py-2.5 text-center text-[13px] font-semibold transition-all duration-150",
				selected
					? "border-white/15 bg-white/[0.08] text-white"
					: "border-transparent text-white/35 hover:text-white/55",
				className,
			)}
		>
			{children}
		</button>
	);
}

function ToggleRow({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between py-1">
			<div>
				<div className="text-[12px] font-medium text-white/70">{label}</div>
				{description && <div className="mt-0.5 text-[10px] text-white/30">{description}</div>}
			</div>
			<Switch
				checked={checked}
				onCheckedChange={onChange}
				className="scale-[0.8] data-[state=checked]:bg-[#F59E0B]"
			/>
		</div>
	);
}

function SegmentedRow<T extends string | number>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: Array<{ value: T; label: string }>;
	value: T;
	onChange: (val: T) => void;
}) {
	return (
		<div>
			<div className="mb-2 text-[11px] font-medium text-white/40">{label}</div>
			<div className="flex gap-1 rounded-[10px] bg-white/[0.03] p-1">
				{options.map((opt) => (
					<button
						type="button"
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						className={cn(
							"flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all duration-150",
							value === opt.value
								? "bg-white/10 text-white shadow-sm"
								: "text-white/30 hover:text-white/50",
						)}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}

function formatEstimatedSize(bytes: number): string {
	if (bytes >= 1_000_000) {
		return `~${(bytes / 1_000_000).toFixed(1)} MB`;
	}
	return `~${Math.round(bytes / 1_000)} KB`;
}

// --- Main Component ---

export function ExportSettingsDialog({
	isOpen,
	onClose,
	exportFormat,
	onExportFormatChange,
	exportDestination,
	onExportDestinationChange,
	videoExportSettings,
	onVideoExportSettingsChange,
	gifExportSettings,
	onGifExportSettingsChange,
	resolvedVideoPlan,
	resolvedGifPlan,
	onExport,
}: ExportSettingsDialogProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
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

	useEffect(() => {
		if (exportFormat === "mp4") {
			setAdvancedOpen(videoExportSettings.mode === "custom");
		} else {
			setAdvancedOpen(gifExportSettings.mode === "custom");
		}
	}, [exportFormat, videoExportSettings.mode, gifExportSettings.mode]);

	if (!isOpen && !isVisible) return null;

	const isGif = exportFormat === "gif";

	// Quality mapping
	const currentVideoQuality: VideoQualityLabel =
		VIDEO_PRESET_TO_QUALITY[videoExportSettings.preset] ?? "web";

	const currentGifQuality: GifQualityLabel =
		gifExportSettings.preset === "small-share"
			? "potato"
			: gifExportSettings.preset === "balanced"
				? "web"
				: "maximum";

	const handleVideoQualityChange = (quality: VideoQualityLabel) => {
		const preset = VIDEO_QUALITY_TO_PRESET[quality];
		const presetSettings = getVideoExportSettingsForPreset(preset);
		onVideoExportSettingsChange({
			...presetSettings,
			forceFFmpegDecoder: videoExportSettings.forceFFmpegDecoder,
		});
	};

	const handleGifQualityChange = (quality: GifQualityLabel) => {
		const preset = GIF_QUALITY_TO_PRESET[quality];
		onGifExportSettingsChange(getGifExportSettingsForPreset(preset));
	};

	const handleAdvancedToggle = (checked: boolean) => {
		setAdvancedOpen(checked);
		if (isGif) {
			if (checked) {
				onGifExportSettingsChange({ ...gifExportSettings, mode: "custom" });
			} else {
				onGifExportSettingsChange(getGifExportSettingsForPreset(gifExportSettings.preset));
			}
		} else if (checked) {
			onVideoExportSettingsChange({
				...videoExportSettings,
				mode: "custom",
				bitrateMode: "bpp",
				bitsPerPixel: videoExportSettings.bitsPerPixel ?? 0.3,
			});
		} else {
			const presetSettings = getVideoExportSettingsForPreset(videoExportSettings.preset);
			onVideoExportSettingsChange({
				...presetSettings,
				forceFFmpegDecoder: videoExportSettings.forceFFmpegDecoder,
			});
		}
	};

	const handleVideoResolutionChange = (resolutionMode: VideoExportSettings["resolutionMode"]) => {
		onVideoExportSettingsChange({ ...videoExportSettings, mode: "custom", resolutionMode });
	};

	const handleVideoFrameRateChange = (frameRateMode: VideoExportSettings["frameRateMode"]) => {
		onVideoExportSettingsChange({ ...videoExportSettings, mode: "custom", frameRateMode });
	};

	const handleGifResolutionChange = (resolutionMode: GifExportConfig["resolutionMode"]) => {
		onGifExportSettingsChange({ ...gifExportSettings, mode: "custom", resolutionMode });
	};

	const handleGifFrameRateChange = (frameRate: GifExportConfig["frameRate"]) => {
		onGifExportSettingsChange({ ...gifExportSettings, mode: "custom", frameRate });
	};

	const exportLabel =
		exportDestination === "clipboard"
			? "Copy to Clipboard"
			: exportDestination === "link"
				? "Get Shareable Link"
				: "Export to File";

	const exportIcon =
		exportDestination === "clipboard" ? (
			<Clipboard className="h-[18px] w-[18px]" />
		) : (
			<FileText className="h-[18px] w-[18px]" />
		);

	const bppValue = videoExportSettings.bitsPerPixel ?? 0.3;
	const bppPercent = ((bppValue - 0.02) / (0.5 - 0.02)) * 100;

	return (
		<>
			{/* Backdrop */}
			<div
				className={cn(
					"fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm transition-all",
					isClosing
						? "opacity-0 duration-200 ease-in"
						: "opacity-100 duration-300 ease-out animate-in fade-in",
				)}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
				<div
					className={cn(
						"pointer-events-auto w-[90vw] max-w-[480px] rounded-2xl border border-white/[0.06] bg-[#0c0c0e] shadow-2xl shadow-black/80 overflow-hidden transition-all",
						isClosing
							? "opacity-0 scale-95 translate-y-2 duration-200 ease-in"
							: "opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3",
					)}
				>
					<div className="max-h-[88vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						<div className="px-6 pt-7 pb-6">
							{/* ── Destination ── */}
							<SectionLabel
								icon={
									<svg
										viewBox="0 0 16 16"
										fill="none"
										className="h-4 w-4"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M8 2v8M4.5 6.5 8 3l3.5 3.5M3 11h10M3 13.5h10" />
									</svg>
								}
							>
								Destination
							</SectionLabel>
							<div className="flex gap-2.5">
								<DestinationCard
									icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
									label="File"
									selected={exportDestination === "file"}
									onClick={() => onExportDestinationChange("file")}
								/>
								<DestinationCard
									icon={<Clipboard className="h-5 w-5" strokeWidth={1.5} />}
									label="Clipboard"
									selected={exportDestination === "clipboard"}
									onClick={() => onExportDestinationChange("clipboard")}
								/>
								<DestinationCard
									icon={<Link className="h-5 w-5" strokeWidth={1.5} />}
									label="Shareable Link"
									selected={exportDestination === "link"}
									disabled
									badge="Coming soon"
									onClick={() => {
										// No-op: shareable link not yet implemented
									}}
								/>
							</div>

							{/* ── Format ── */}
							<div className="mt-7">
								<SectionLabel icon={<Film className="h-4 w-4" strokeWidth={1.5} />}>
									Format
								</SectionLabel>
								<div className="flex gap-1.5 rounded-xl bg-white/[0.03] p-1">
									<Pill
										selected={exportFormat === "mp4"}
										onClick={() => onExportFormatChange("mp4")}
										className="flex-[1.6]"
									>
										MP4
									</Pill>
									<Pill
										selected={exportFormat === "gif"}
										onClick={() => onExportFormatChange("gif")}
									>
										GIF
									</Pill>
								</div>
							</div>

							{/* ── Resolution ── */}
							<div className="mt-7">
								<SectionLabel icon={<Monitor className="h-4 w-4" strokeWidth={1.5} />}>
									Resolution
								</SectionLabel>
								<div className="flex gap-1.5">
									{isGif ? (
										<>
											{(["480p", "720p", "1080p"] as const).map((r) => (
												<Pill
													key={r}
													selected={gifExportSettings.resolutionMode === r}
													onClick={() => handleGifResolutionChange(r)}
												>
													{r}
												</Pill>
											))}
										</>
									) : (
										<>
											<Pill
												selected={videoExportSettings.resolutionMode === "720p"}
												onClick={() => handleVideoResolutionChange("720p")}
											>
												720p
											</Pill>
											<Pill
												selected={videoExportSettings.resolutionMode === "1080p"}
												onClick={() => handleVideoResolutionChange("1080p")}
											>
												1080p
											</Pill>
											<Pill
												selected={videoExportSettings.resolutionMode === "2160p"}
												onClick={() => handleVideoResolutionChange("2160p")}
											>
												4K
											</Pill>
										</>
									)}
								</div>
							</div>

							{/* ── Frame Rate ── */}
							<div className="mt-7">
								<SectionLabel
									icon={
										<svg
											viewBox="0 0 16 16"
											fill="none"
											className="h-4 w-4"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<circle cx="8" cy="8" r="6.5" />
											<path d="M8 4.5V8l2.5 1.5" />
										</svg>
									}
								>
									Frame Rate
								</SectionLabel>
								<div className="flex gap-1.5">
									{isGif ? (
										<>
											{([10, 15, 30] as const).map((fps) => (
												<Pill
													key={fps}
													selected={gifExportSettings.frameRate === fps}
													onClick={() => handleGifFrameRateChange(fps)}
												>
													{fps}
												</Pill>
											))}
										</>
									) : (
										<>
											{(
												[
													["24", "24"],
													["30", "30"],
													["60", "60"],
												] as const
											).map(([mode, display]) => (
												<Pill
													key={mode}
													selected={videoExportSettings.frameRateMode === mode}
													onClick={() =>
														handleVideoFrameRateChange(mode as VideoExportSettings["frameRateMode"])
													}
												>
													{display}
												</Pill>
											))}
										</>
									)}
								</div>
							</div>

							{/* ── Quality ── */}
							<div className="mt-7">
								<SectionLabel
									icon={
										<svg
											viewBox="0 0 16 16"
											fill="none"
											className="h-4 w-4"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M8 1.5l1.8 3.7 4 .6-2.9 2.8.7 4L8 10.8 4.4 12.6l.7-4-2.9-2.8 4-.6L8 1.5z" />
										</svg>
									}
								>
									Quality
								</SectionLabel>
								<div className="flex gap-1.5">
									{(["potato", "web", "social", "maximum"] as const).map((q) => (
										<Pill
											key={q}
											selected={isGif ? currentGifQuality === q : currentVideoQuality === q}
											onClick={() =>
												isGif ? handleGifQualityChange(q) : handleVideoQualityChange(q)
											}
										>
											{q.charAt(0).toUpperCase() + q.slice(1)}
										</Pill>
									))}
								</div>
								<div className="mt-2 flex justify-between text-[10px] text-white/20">
									<span>Smaller file</span>
									<span>Larger file</span>
								</div>
							</div>

							{/* ── Divider ── */}
							<div className="my-6 h-px bg-white/[0.06]" />

							{/* ── Advanced ── */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Switch
										checked={advancedOpen}
										onCheckedChange={handleAdvancedToggle}
										className="scale-[0.85] data-[state=checked]:bg-[#F59E0B]"
									/>
									<span className="text-[13px] font-medium text-white/70">Advanced</span>
								</div>
							</div>

							{advancedOpen && (
								<div className="mt-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
									{isGif ? (
										<>
											<ToggleRow
												label="Loop"
												description="Loop the GIF forever"
												checked={gifExportSettings.loop}
												onChange={(checked) =>
													onGifExportSettingsChange({ ...gifExportSettings, loop: checked })
												}
											/>
											<ToggleRow
												label="Dedupe similar frames"
												description="Merge near-identical frames to reduce size"
												checked={gifExportSettings.dedupeFrames}
												onChange={(checked) =>
													onGifExportSettingsChange({
														...gifExportSettings,
														dedupeFrames: checked,
													})
												}
											/>
											<SegmentedRow
												label="Color Count"
												value={gifExportSettings.colorCount}
												onChange={(colorCount: GifColorCount) =>
													onGifExportSettingsChange({ ...gifExportSettings, colorCount })
												}
												options={[
													{ value: 64 as GifColorCount, label: "64" },
													{ value: 128 as GifColorCount, label: "128" },
													{ value: 256 as GifColorCount, label: "256" },
												]}
											/>
											<SegmentedRow
												label="Dithering"
												value={gifExportSettings.ditherMode}
												onChange={(ditherMode: GifDitherMode) =>
													onGifExportSettingsChange({ ...gifExportSettings, ditherMode })
												}
												options={[
													{ value: "off" as GifDitherMode, label: "Off" },
													{ value: "bayer" as GifDitherMode, label: "Bayer" },
													{ value: "floyd-steinberg" as GifDitherMode, label: "F-S" },
												]}
											/>
											<SegmentedRow
												label="Motion Sensitivity"
												value={gifExportSettings.motionSensitivity}
												onChange={(motionSensitivity: GifMotionSensitivity) =>
													onGifExportSettingsChange({
														...gifExportSettings,
														motionSensitivity,
													})
												}
												options={[
													{ value: "low" as GifMotionSensitivity, label: "Low" },
													{ value: "balanced" as GifMotionSensitivity, label: "Balanced" },
													{ value: "high" as GifMotionSensitivity, label: "High" },
												]}
											/>
										</>
									) : (
										<>
											{/* Bits per pixel */}
											<div>
												<div className="mb-3 flex items-center justify-between">
													<span className="text-[12px] font-medium text-white/50">
														Bits per pixel
													</span>
													<span className="text-[13px] font-semibold tabular-nums text-white/80">
														{bppValue.toFixed(2)}
													</span>
												</div>
												<div className="relative h-1.5 rounded-full bg-white/[0.06]">
													<div
														className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#F59E0B]/60 to-[#F59E0B]"
														style={{ width: `${bppPercent}%` }}
													/>
													<input
														type="range"
														min={0.02}
														max={0.5}
														step={0.01}
														value={bppValue}
														onChange={(e) =>
															onVideoExportSettingsChange({
																...videoExportSettings,
																mode: "custom",
																bitrateMode: "bpp",
																bitsPerPixel: Number.parseFloat(e.target.value),
															})
														}
														className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#F59E0B] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(245,158,11,0.5)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0c0c0e] [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_14px_rgba(245,158,11,0.7)]"
													/>
												</div>
												<div className="mt-2 flex justify-between text-[10px] text-white/20">
													<span>0.02 (tiny)</span>
													<span>0.50 (huge)</span>
												</div>
											</div>

											{/* Force FFmpeg decoder */}
											<div className="flex items-start gap-3 pt-1">
												<Switch
													checked={videoExportSettings.forceFFmpegDecoder ?? false}
													onCheckedChange={(checked) =>
														onVideoExportSettingsChange({
															...videoExportSettings,
															forceFFmpegDecoder: checked,
														})
													}
													className="mt-0.5 scale-[0.8] data-[state=checked]:bg-[#F59E0B]"
												/>
												<div>
													<div className="text-[12px] font-medium text-white/70">
														Force FFmpeg decoder
													</div>
													<div className="mt-0.5 text-[10px] text-white/30">
														Skip hardware decoder (auto-fallback enabled)
													</div>
												</div>
											</div>
										</>
									)}
								</div>
							)}
						</div>

						{/* ── Resolved Summary ── */}
						<div className="px-6 pb-3">
							<p className="text-center text-[12px] text-white/30 tracking-wide">
								{exportFormat === "gif"
									? `${resolvedGifPlan.width}×${resolvedGifPlan.height} · ${resolvedGifPlan.frameRate} fps · ${formatEstimatedSize(resolvedGifPlan.estimatedSizeBytes)}`
									: `${resolvedVideoPlan.width}×${resolvedVideoPlan.height} · ${resolvedVideoPlan.frameRate} fps · ${(resolvedVideoPlan.bitrate / 1_000_000).toFixed(1)} Mbps`}
							</p>
						</div>

						{/* ── Footer ── */}
						<div className="px-6 pb-7">
							{/* Export button */}
							<button
								type="button"
								disabled={exportDestination === "link"}
								onClick={() => {
									onExport(exportDestination);
									onClose();
								}}
								className={cn(
									"flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl text-[14px] font-semibold transition-all duration-200",
									"bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white",
									"shadow-[0_4px_24px_rgba(245,158,11,0.25)]",
									"hover:shadow-[0_4px_32px_rgba(245,158,11,0.35)] hover:brightness-110",
									"active:scale-[0.98] active:brightness-95",
									"disabled:opacity-40 disabled:pointer-events-none",
								)}
							>
								{exportIcon}
								{exportLabel}
							</button>

							{/* Back to Editor */}
							<button
								type="button"
								onClick={onClose}
								className="mt-4 w-full text-center text-[13px] font-medium text-white/35 hover:text-white/60 transition-colors duration-200"
							>
								Back to Editor
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
