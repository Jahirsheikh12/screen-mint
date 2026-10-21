import {
	AlertTriangle,
	Check,
	Clipboard,
	FileText,
	Film,
	Link,
	Monitor,
	Settings2,
	SlidersHorizontal,
	Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useScopedT } from "@/contexts/I18nContext";
import type {
	ExportDestination,
	ExportFormat,
	GifColorCount,
	GifDitherMode,
	GifExportConfig,
	GifMotionSensitivity,
	ResolvedGifExportPlan,
	ResolvedVideoExportPlan,
	VideoBitrateMode,
	VideoExportSettings,
} from "@/lib/exporter";
import {
	GIF_COLOR_COUNT_OPTIONS,
	GIF_DITHER_MODE_OPTIONS,
	GIF_FRAME_RATES,
	GIF_MOTION_SENSITIVITY_OPTIONS,
	GIF_RESOLUTION_MODE_OPTIONS,
	getGifExportSettingsForPreset,
	getVideoExportSettingsForPreset,
	VIDEO_BITRATE_MODE_OPTIONS,
	VIDEO_FRAME_RATE_MODE_OPTIONS,
	VIDEO_RESOLUTION_MODE_OPTIONS,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";
import {
	GIF_EXPORT_QUALITY_OPTIONS,
	getSelectedGifQuality,
	getSelectedVideoQuality,
	selectGifQualitySettings,
	selectVideoQualitySettings,
	VIDEO_EXPORT_QUALITY_OPTIONS,
} from "./exportUtils";

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

const QUALITY_LABELS = {
	potato: {
		label: "Draft",
		description: "Smallest file",
	},
	web: {
		label: "Web",
		description: "Balanced",
	},
	social: {
		label: "Social",
		description: "Crisp share",
	},
	maximum: {
		label: "Maximum",
		description: "Source detail",
	},
} as const;

const VIDEO_BITRATE_OPTIONS: Array<{
	value: VideoBitrateMode;
	label: string;
	description: string;
}> = [
	...VIDEO_BITRATE_MODE_OPTIONS,
	{
		value: "bpp",
		label: "BPP",
		description: "Scale bitrate from resolution and frame rate",
	},
];

function formatEstimatedSize(bytes: number): string {
	if (bytes >= 1_000_000) {
		return `${(bytes / 1_000_000).toFixed(1)} MB`;
	}
	return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

function formatBitrate(bitsPerSecond: number): string {
	return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
}

function clampBpp(value: number): number {
	return Math.min(0.5, Math.max(0.02, value));
}

function SectionHeader({
	icon,
	title,
	description,
}: {
	icon: ReactNode;
	title: string;
	description?: string;
}) {
	return (
		<div className="mb-3 flex items-start justify-between gap-4">
			<div className="flex items-center gap-2.5">
				<span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-fill-subtle text-fg-subtle">
					{icon}
				</span>
				<div>
					<h3 className="text-body font-semibold text-fg">{title}</h3>
					{description ? (
						<p className="mt-0.5 text-caption leading-4 text-fg-subtle">{description}</p>
					) : null}
				</div>
			</div>
		</div>
	);
}

function ChoiceButton({
	children,
	selected,
	disabled = false,
	description,
	selectionLabel,
	optionGroup,
	className,
	onClick,
}: {
	children: ReactNode;
	selected: boolean;
	disabled?: boolean;
	description?: string;
	selectionLabel?: string;
	optionGroup?: string;
	className?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			data-selection-label={selectionLabel}
			data-selected={selected ? "true" : "false"}
			data-option-group={optionGroup}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"relative min-h-[42px] rounded-lg border px-3 py-2 text-left transition-all duration-150",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
				selected
					? "border-accent/55 bg-accent/12 text-on-accent"
					: "border-line bg-fill-subtle text-fg-subtle hover:border-line-strong hover:bg-fill-subtle hover:text-fg-muted",
				disabled && "cursor-not-allowed opacity-35 hover:border-line hover:bg-fill-subtle",
				className,
			)}
		>
			<span className="flex items-center justify-between gap-2 text-label font-semibold">
				{children}
				{selected ? <Check className="h-3.5 w-3.5 text-accent-fg" /> : null}
			</span>
			{description ? (
				<span className="mt-1 block text-micro text-fg-subtle">{description}</span>
			) : null}
		</button>
	);
}

function DestinationButton({
	icon,
	label,
	description,
	selected,
	disabled,
	badge,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	description: string;
	selected: boolean;
	disabled?: boolean;
	badge?: string;
	onClick: () => void;
}) {
	return (
		<ChoiceButton
			selected={selected}
			disabled={disabled}
			description={description}
			selectionLabel={label}
			onClick={onClick}
			className="min-h-[78px]"
		>
			<span className="flex items-center gap-2">
				<span className={selected ? "text-accent-fg" : "text-fg-subtle"}>{icon}</span>
				<span>{label}</span>
				{badge ? (
					<span className="rounded-full border border-line px-1.5 py-0.5 text-micro font-medium text-fg-subtle">
						{badge}
					</span>
				) : null}
			</span>
		</ChoiceButton>
	);
}

function SegmentedGrid<T extends string | number>({
	options,
	value,
	columns,
	group,
	onChange,
}: {
	options: Array<{ value: T; label: string; description?: string }>;
	value: T;
	columns: string;
	group?: string;
	onChange: (value: T) => void;
}) {
	return (
		<div className={cn("grid gap-1.5", columns)}>
			{options.map((option) => (
				<ChoiceButton
					key={String(option.value)}
					selected={value === option.value}
					description={option.description}
					selectionLabel={option.label}
					optionGroup={group}
					onClick={() => onChange(option.value)}
					className="min-h-[40px] px-2.5 text-center"
				>
					<span className="w-full text-center">{option.label}</span>
				</ChoiceButton>
			))}
		</div>
	);
}

function ToggleRow({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-fill-subtle px-3 py-2.5">
			<div>
				<div className="text-label font-semibold text-fg-muted">{label}</div>
				<div className="mt-0.5 text-micro leading-4 text-fg-subtle">{description}</div>
			</div>
			<Switch
				checked={checked}
				onCheckedChange={onChange}
				className="shrink-0 data-[state=checked]:bg-accent"
			/>
		</div>
	);
}

function SummaryStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<div className="text-micro font-semibold uppercase tracking-[0.14em] text-fg-disabled">
				{label}
			</div>
			<div className="mt-1 truncate text-label font-semibold text-fg-muted">{value}</div>
		</div>
	);
}

const WARNING_KEYS: Record<string, string> = {
	"4K exports may be slower on some systems.": "warn4k",
	"Web optimization prefers safer H.264 profiles while preserving your chosen size and frame rate.":
		"warnWeb",
	"Long GIF exports can be large and slow. MP4 may share better.": "warnLongGif",
	"This GIF is likely to exceed 15 MB. Lower the resolution, FPS, or color count.": "warnGifSize",
	"Source-resolution GIF exports above 1080p can be very slow and heavy.": "warnGifSource",
};

function Warnings({ warnings }: { warnings: string[] }) {
	const t = useScopedT("settings");
	const translateWarning = (warning: string) =>
		WARNING_KEYS[warning] ? t(`exportAdvanced.${WARNING_KEYS[warning]}`, warning) : warning;
	if (warnings.length === 0) {
		return null;
	}

	return (
		<div className="mt-3 space-y-1.5 rounded-lg border border-accent/16 bg-accent/[0.06] p-3">
			{warnings.map((warning) => (
				<div key={warning} className="flex gap-2 text-caption leading-4 text-fg-muted">
					<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-fg/80" />
					<span>{translateWarning(warning)}</span>
				</div>
			))}
		</div>
	);
}

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
	const t = useScopedT("settings");
	const qualityLabel = (quality: keyof typeof QUALITY_LABELS) =>
		t(`exportAdvanced.quality.${quality}`, QUALITY_LABELS[quality].label);
	const qualityHint = (quality: keyof typeof QUALITY_LABELS) =>
		t(`exportAdvanced.quality.${quality}Hint`, QUALITY_LABELS[quality].description);
	const localize = <T extends string | number>(
		group: string,
		options: Array<{ value: T; label: string; description?: string }>,
	) =>
		options.map((option) => ({
			...option,
			// Numeric labels (64, 720p…) read the same in every language and have no key.
			label: t(`exportAdvanced.options.${group}.${option.value}`, option.label),
			description: option.description
				? t(`exportAdvanced.options.${group}.${option.value}Hint`, option.description)
				: undefined,
		}));
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
		setAdvancedOpen(
			exportFormat === "gif"
				? gifExportSettings.mode === "custom"
				: videoExportSettings.mode === "custom",
		);
	}, [exportFormat, gifExportSettings.mode, videoExportSettings.mode]);

	if (!isOpen && !isVisible) return null;

	const isGif = exportFormat === "gif";
	const currentVideoQuality = getSelectedVideoQuality(videoExportSettings);
	const currentGifQuality = getSelectedGifQuality(gifExportSettings);
	const activePlan = isGif ? resolvedGifPlan : resolvedVideoPlan;
	const activeWarnings = activePlan.warnings;
	const bppValue = clampBpp(videoExportSettings.bitsPerPixel ?? 0.3);
	const bppPercent = ((bppValue - 0.02) / (0.5 - 0.02)) * 100;
	const exportLabel =
		exportDestination === "clipboard"
			? t("exportAdvanced.copyExport", "Copy Export")
			: exportDestination === "link"
				? t("exportAdvanced.createLink", "Create Link")
				: t("export.exportVideo", "Export {{format}}", { format: isGif ? "GIF" : "MP4" });

	const setCustomVideoSettings = (patch: Partial<VideoExportSettings>) => {
		onVideoExportSettingsChange({
			...videoExportSettings,
			mode: "custom",
			...patch,
		});
	};

	const setCustomGifSettings = (patch: Partial<GifExportConfig>) => {
		onGifExportSettingsChange({
			...gifExportSettings,
			mode: "custom",
			...patch,
		});
	};

	const handleAdvancedToggle = (checked: boolean) => {
		setAdvancedOpen(checked);
		if (isGif) {
			onGifExportSettingsChange(
				checked
					? { ...gifExportSettings, mode: "custom" }
					: getGifExportSettingsForPreset(gifExportSettings.preset),
			);
			return;
		}

		if (checked) {
			onVideoExportSettingsChange({
				...videoExportSettings,
				mode: "custom",
				bitrateMode:
					videoExportSettings.bitrateMode === "custom" || videoExportSettings.bitrateMode === "bpp"
						? videoExportSettings.bitrateMode
						: "bpp",
				bitsPerPixel: videoExportSettings.bitsPerPixel ?? 0.3,
			});
			return;
		}

		onVideoExportSettingsChange({
			...getVideoExportSettingsForPreset(videoExportSettings.preset),
			forceFFmpegDecoder: videoExportSettings.forceFFmpegDecoder,
		});
	};

	const handleExportClick = () => {
		if (exportDestination === "link") {
			return;
		}
		onExport(exportDestination);
		onClose();
	};

	return (
		<>
			<div
				className={cn(
					"fixed inset-0 z-[9999] bg-scrim/72 backdrop-blur-md transition-all",
					isClosing ? "opacity-0 duration-200 ease-in" : "opacity-100 duration-300 ease-out",
				)}
				onClick={onClose}
			/>

			<div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
				<div
					role="dialog"
					aria-modal="true"
					className={cn(
						"pointer-events-auto flex max-h-[90vh] w-[min(960px,94vw)] flex-col overflow-hidden rounded-xl border border-line bg-canvas shadow-2xl shadow-black/70 transition-all",
						isClosing
							? "opacity-0 scale-95 translate-y-2 duration-200 ease-in"
							: "opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3",
					)}
				>
					<div className="flex items-center justify-between border-b border-line px-5 py-4">
						<div>
							<h2 className="text-heading font-semibold tracking-tight text-fg">
								{t("exportAdvanced.title", "Export settings")}
							</h2>
							<p className="mt-0.5 text-label text-fg-subtle">
								{t(
									"exportAdvanced.subtitle",
									"Choose the format, destination, and output quality before rendering.",
								)}
							</p>
						</div>
						<div className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-caption font-semibold text-accent-fg">
							{t("exportAdvanced.ready", "{{format}} ready", { format: isGif ? "GIF" : "MP4" })}
						</div>
					</div>

					<div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto [scrollbar-width:thin] lg:grid-cols-[1fr_300px] lg:overflow-hidden">
						<div className="px-5 py-5 [scrollbar-width:thin] lg:overflow-y-auto">
							<div className="space-y-6">
								<section>
									<SectionHeader
										icon={<Film className="h-4 w-4" />}
										title={t("exportAdvanced.format", "Format")}
										description={t(
											"exportAdvanced.formatHint",
											"MP4 is best for sharing and editing. GIF is best for short loops.",
										)}
									/>
									<div className="grid grid-cols-2 gap-2">
										<ChoiceButton
											selected={exportFormat === "mp4"}
											description={t(
												"exportAdvanced.mp4Hint",
												"Audio, timeline edits, high quality",
											)}
											selectionLabel={t("exportAdvanced.mp4Label", "MP4 video")}
											onClick={() => onExportFormatChange("mp4")}
										>
											{t("exportAdvanced.mp4Video", "MP4 video")}
										</ChoiceButton>
										<ChoiceButton
											selected={exportFormat === "gif"}
											description={t("exportAdvanced.gifHint", "Silent animated image")}
											selectionLabel={t("exportAdvanced.gifLabel", "GIF animation")}
											onClick={() => onExportFormatChange("gif")}
										>
											{t("exportAdvanced.gifAnimation", "GIF animation")}
										</ChoiceButton>
									</div>
								</section>

								<section>
									<SectionHeader
										icon={<FileText className="h-4 w-4" />}
										title={t("exportAdvanced.destination", "Destination")}
										description={t(
											"exportAdvanced.destinationHint",
											"Save a file or copy the rendered export as a temporary file.",
										)}
									/>
									<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
										<DestinationButton
											icon={<FileText className="h-4 w-4" />}
											label={t("exportAdvanced.destFile", "File")}
											description={t("exportAdvanced.destFileHint", "Choose a folder")}
											selected={exportDestination === "file"}
											onClick={() => onExportDestinationChange("file")}
										/>
										<DestinationButton
											icon={<Clipboard className="h-4 w-4" />}
											label={t("exportAdvanced.destClipboard", "Clipboard")}
											description={t("exportAdvanced.destClipboardHint", "Copy file reference")}
											selected={exportDestination === "clipboard"}
											onClick={() => onExportDestinationChange("clipboard")}
										/>
										<DestinationButton
											icon={<Link className="h-4 w-4" />}
											label={t("exportAdvanced.destLink", "Link")}
											description={t("exportAdvanced.destLinkHint", "Cloud share")}
											selected={exportDestination === "link"}
											disabled
											badge={t("exportAdvanced.soon", "Soon")}
											onClick={() => undefined}
										/>
									</div>
								</section>

								<section>
									<SectionHeader
										icon={<Zap className="h-4 w-4" />}
										title={t("exportAdvanced.profile", "Quality profile")}
										description={t(
											"exportAdvanced.profileHint",
											"Profiles set sensible defaults. Any manual output change becomes Custom.",
										)}
									/>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
										{isGif
											? GIF_EXPORT_QUALITY_OPTIONS.map((quality) => (
													<ChoiceButton
														key={quality}
														selected={currentGifQuality === quality}
														description={qualityHint(quality)}
														selectionLabel={qualityLabel(quality)}
														onClick={() =>
															onGifExportSettingsChange(selectGifQualitySettings(quality))
														}
													>
														{qualityLabel(quality)}
													</ChoiceButton>
												))
											: VIDEO_EXPORT_QUALITY_OPTIONS.map((quality) => (
													<ChoiceButton
														key={quality}
														selected={currentVideoQuality === quality}
														description={qualityHint(quality)}
														selectionLabel={qualityLabel(quality)}
														onClick={() =>
															onVideoExportSettingsChange(
																selectVideoQualitySettings(videoExportSettings, quality),
															)
														}
													>
														{qualityLabel(quality)}
													</ChoiceButton>
												))}
									</div>
									{(isGif ? currentGifQuality === null : currentVideoQuality === null) ? (
										<div className="mt-2 rounded-lg border border-accent/18 bg-accent/8 px-3 py-2 text-caption text-accent-fg/88">
											{t(
												"exportAdvanced.customActive",
												"Custom profile is active because one or more output controls were changed.",
											)}
										</div>
									) : null}
								</section>

								<section>
									<SectionHeader
										icon={<Monitor className="h-4 w-4" />}
										title={t("exportAdvanced.output", "Output")}
										description={t(
											"exportAdvanced.outputHint",
											"Resolution and frame rate are applied to the final rendered canvas.",
										)}
									/>
									<div className="space-y-4">
										<div>
											<div className="mb-2 text-caption font-semibold text-fg-subtle">
												{t("exportAdvanced.resolution", "Resolution")}
											</div>
											<SegmentedGrid
												value={
													isGif
														? gifExportSettings.resolutionMode
														: videoExportSettings.resolutionMode
												}
												options={localize(
													"resolution",
													isGif ? GIF_RESOLUTION_MODE_OPTIONS : VIDEO_RESOLUTION_MODE_OPTIONS,
												)}
												columns={isGif ? "grid-cols-4" : "grid-cols-5"}
												group={isGif ? "gif-resolution" : "video-resolution"}
												onChange={(resolutionMode) => {
													if (isGif) {
														setCustomGifSettings({
															resolutionMode: resolutionMode as GifExportConfig["resolutionMode"],
														});
													} else {
														setCustomVideoSettings({
															resolutionMode:
																resolutionMode as VideoExportSettings["resolutionMode"],
														});
													}
												}}
											/>
										</div>

										<div>
											<div className="mb-2 text-caption font-semibold text-fg-subtle">
												{t("exportAdvanced.frameRate", "Frame rate")}
											</div>
											<SegmentedGrid
												value={
													isGif ? gifExportSettings.frameRate : videoExportSettings.frameRateMode
												}
												options={
													isGif
														? GIF_FRAME_RATES.map((option) => ({
																value: option.value,
																label: `${option.value}`,
															}))
														: VIDEO_FRAME_RATE_MODE_OPTIONS.map((option) => ({
																value: option.value,
																label: option.value,
															}))
												}
												columns={isGif ? "grid-cols-7" : "grid-cols-2"}
												group={isGif ? "gif-frame-rate" : "video-frame-rate"}
												onChange={(frameRate) => {
													if (isGif) {
														setCustomGifSettings({
															frameRate: frameRate as GifExportConfig["frameRate"],
														});
													} else {
														setCustomVideoSettings({
															frameRateMode: frameRate as VideoExportSettings["frameRateMode"],
														});
													}
												}}
											/>
										</div>
									</div>
								</section>

								<section>
									<div className="flex items-center justify-between rounded-lg border border-line bg-fill-subtle px-3 py-3">
										<div className="flex items-center gap-2.5">
											<SlidersHorizontal className="h-4 w-4 text-fg-subtle" />
											<div>
												<div className="text-body font-semibold text-fg-muted">
													{t("exportAdvanced.advancedControls", "Advanced controls")}
												</div>
												<div className="mt-0.5 text-caption text-fg-subtle">
													{isGif
														? t(
																"exportAdvanced.advancedGifHint",
																"Looping, dedupe, colors, dithering, and motion sensitivity.",
															)
														: t(
																"exportAdvanced.advancedVideoHint",
																"Bitrate, web optimization, and decoder fallback controls.",
															)}
												</div>
											</div>
										</div>
										<Switch
											checked={advancedOpen}
											onCheckedChange={handleAdvancedToggle}
											className="data-[state=checked]:bg-accent"
										/>
									</div>

									{advancedOpen ? (
										<div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
											{isGif ? (
												<>
													<div className="grid gap-2 sm:grid-cols-2">
														<ToggleRow
															label={t("exportAdvanced.loop", "Loop forever")}
															description={t(
																"exportAdvanced.loopHint",
																"Repeat the GIF automatically.",
															)}
															checked={gifExportSettings.loop}
															onChange={(loop) => setCustomGifSettings({ loop })}
														/>
														<ToggleRow
															label={t("exportAdvanced.dedupe", "Dedupe frames")}
															description={t(
																"exportAdvanced.dedupeHint",
																"Remove near-identical frames to reduce size.",
															)}
															checked={gifExportSettings.dedupeFrames}
															onChange={(dedupeFrames) => setCustomGifSettings({ dedupeFrames })}
														/>
													</div>
													<SegmentedGrid
														value={gifExportSettings.colorCount}
														options={localize("colors", GIF_COLOR_COUNT_OPTIONS)}
														columns="grid-cols-3"
														onChange={(colorCount) =>
															setCustomGifSettings({ colorCount: colorCount as GifColorCount })
														}
													/>
													<SegmentedGrid
														value={gifExportSettings.ditherMode}
														options={localize("dither", GIF_DITHER_MODE_OPTIONS)}
														columns="grid-cols-3"
														onChange={(ditherMode) =>
															setCustomGifSettings({ ditherMode: ditherMode as GifDitherMode })
														}
													/>
													<SegmentedGrid
														value={gifExportSettings.motionSensitivity}
														options={localize("motion", GIF_MOTION_SENSITIVITY_OPTIONS)}
														columns="grid-cols-3"
														onChange={(motionSensitivity) =>
															setCustomGifSettings({
																motionSensitivity: motionSensitivity as GifMotionSensitivity,
															})
														}
													/>
												</>
											) : (
												<>
													<SegmentedGrid
														value={videoExportSettings.bitrateMode}
														options={localize(
															"bitrate",
															VIDEO_BITRATE_OPTIONS.map((option) => ({
																value: option.value,
																label: option.label,
															})),
														)}
														columns="grid-cols-3 sm:grid-cols-6"
														onChange={(bitrateMode) =>
															setCustomVideoSettings({
																bitrateMode: bitrateMode as VideoBitrateMode,
																bitsPerPixel:
																	bitrateMode === "bpp"
																		? (videoExportSettings.bitsPerPixel ?? 0.3)
																		: videoExportSettings.bitsPerPixel,
															})
														}
													/>

													{videoExportSettings.bitrateMode === "bpp" ? (
														<div className="rounded-lg border border-line bg-fill-subtle px-3 py-3">
															<div className="mb-3 flex items-center justify-between">
																<span className="text-label font-semibold text-fg-muted">
																	{t("exportAdvanced.bpp", "Bits per pixel")}
																</span>
																<span className="font-mono text-label font-semibold tabular-nums text-fg-muted">
																	{bppValue.toFixed(2)}
																</span>
															</div>
															<div className="relative h-1.5 rounded-full bg-fill-hover">
																<div
																	className="absolute inset-y-0 left-0 rounded-full bg-accent"
																	style={{ width: `${bppPercent}%` }}
																/>
																<input
																	type="range"
																	min={0.02}
																	max={0.5}
																	step={0.01}
																	value={bppValue}
																	onChange={(event) =>
																		setCustomVideoSettings({
																			bitrateMode: "bpp",
																			bitsPerPixel: Number.parseFloat(event.target.value),
																		})
																	}
																	className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-line [&::-webkit-slider-thumb]:bg-accent"
																/>
															</div>
															<div className="mt-2 flex justify-between text-micro text-fg-disabled">
																<span>{t("exportAdvanced.smaller", "Smaller")}</span>
																<span>{t("exportAdvanced.sharper", "Sharper")}</span>
															</div>
														</div>
													) : null}

													{videoExportSettings.bitrateMode === "custom" ? (
														<label className="block rounded-lg border border-line bg-fill-subtle px-3 py-3">
															<span className="text-label font-semibold text-fg-muted">
																{t("exportAdvanced.customBitrate", "Custom bitrate")}
															</span>
															<div className="mt-2 flex items-center gap-2">
																<input
																	type="number"
																	min={4}
																	max={80}
																	step={1}
																	value={videoExportSettings.customBitrateMbps ?? 16}
																	onChange={(event) =>
																		setCustomVideoSettings({
																			bitrateMode: "custom",
																			customBitrateMbps: Number.parseFloat(event.target.value),
																		})
																	}
																	className="h-9 w-24 rounded-md border border-line-strong bg-sunken px-2 text-body text-fg outline-none focus:border-accent/60"
																/>
																<span className="text-caption text-fg-subtle">
																	{t("exportAdvanced.mbps", "Mbps")}
																</span>
															</div>
														</label>
													) : null}

													<div className="grid gap-2 sm:grid-cols-2">
														<ToggleRow
															label={t("exportAdvanced.web", "Optimize for web")}
															description={t(
																"exportAdvanced.webHint",
																"Prefer broadly compatible H.264 profiles.",
															)}
															checked={videoExportSettings.optimizeForWeb}
															onChange={(optimizeForWeb) =>
																setCustomVideoSettings({ optimizeForWeb })
															}
														/>
														<ToggleRow
															label={t("exportAdvanced.ffmpegDecoder", "Force FFmpeg decoder")}
															description={t(
																"exportAdvanced.ffmpegDecoderHint",
																"Use the software decoder when hardware decode misbehaves.",
															)}
															checked={videoExportSettings.forceFFmpegDecoder ?? false}
															onChange={(forceFFmpegDecoder) =>
																setCustomVideoSettings({ forceFFmpegDecoder })
															}
														/>
													</div>
												</>
											)}
										</div>
									) : null}
								</section>
							</div>
						</div>

						<aside className="border-t border-line bg-fill-subtle p-5 lg:border-l lg:border-t-0">
							<div className="lg:sticky lg:top-0">
								<SectionHeader
									icon={<Settings2 className="h-4 w-4" />}
									title={t("exportAdvanced.resolved", "Resolved export")}
									description={t(
										"exportAdvanced.resolvedHint",
										"These are the exact output settings that will be sent to the renderer.",
									)}
								/>
								<div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-fill-subtle p-3">
									<SummaryStat
										label={t("exportAdvanced.canvas", "Canvas")}
										value={`${activePlan.width}x${activePlan.height}`}
									/>
									<SummaryStat
										label={t("exportAdvanced.fps", "FPS")}
										value={`${activePlan.frameRate}`}
									/>
									{isGif ? (
										<>
											<SummaryStat
												label={t("exportAdvanced.estimate", "Estimate")}
												value={formatEstimatedSize(resolvedGifPlan.estimatedSizeBytes)}
											/>
											<SummaryStat
												label={t("exportAdvanced.colors", "Colors")}
												value={`${resolvedGifPlan.colorCount}`}
											/>
										</>
									) : (
										<>
											<SummaryStat
												label={t("exportAdvanced.bitrate", "Bitrate")}
												value={formatBitrate(resolvedVideoPlan.bitrate)}
											/>
											<SummaryStat
												label={t("exportAdvanced.codec", "Codec")}
												value={resolvedVideoPlan.codecLabel}
											/>
										</>
									)}
								</div>

								<Warnings warnings={activeWarnings} />

								<div className="mt-5 space-y-2 rounded-lg border border-line bg-fill-subtle p-3 text-caption leading-4 text-fg-subtle">
									<div className="flex justify-between gap-4">
										<span>{t("exportAdvanced.summaryProfile", "Profile")}</span>
										<span className="text-right text-fg-muted">
											{isGif
												? currentGifQuality
													? qualityLabel(currentGifQuality)
													: t("exportAdvanced.custom", "Custom")
												: currentVideoQuality
													? qualityLabel(currentVideoQuality)
													: t("exportAdvanced.custom", "Custom")}
										</span>
									</div>
									<div className="flex justify-between gap-4">
										<span>{t("exportAdvanced.destination", "Destination")}</span>
										<span className="text-right text-fg-muted">
											{exportDestination === "clipboard"
												? t("exportAdvanced.destClipboard", "Clipboard")
												: exportDestination === "link"
													? t("exportAdvanced.destLink", "Link")
													: t("exportAdvanced.destFile", "File")}
										</span>
									</div>
									<div className="flex justify-between gap-4">
										<span>{t("exportAdvanced.summaryMode", "Mode")}</span>
										<span className="text-right text-fg-muted">
											{(isGif ? resolvedGifPlan.mode : resolvedVideoPlan.mode) === "custom"
												? t("exportAdvanced.custom", "Custom")
												: t("exportAdvanced.modePreset", "Preset")}
										</span>
									</div>
								</div>
							</div>
						</aside>
					</div>

					<div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
						<button
							type="button"
							onClick={onClose}
							className="h-10 rounded-lg px-4 text-body font-semibold text-fg-subtle transition-colors hover:bg-fill-subtle hover:text-fg-muted"
						>
							{t("exportAdvanced.back", "Back to editor")}
						</button>
						<button
							type="button"
							disabled={exportDestination === "link"}
							onClick={handleExportClick}
							className={cn(
								"flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-lg bg-accent px-5 text-body font-bold text-on-accent transition-all",
								"hover:bg-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35",
							)}
						>
							{exportDestination === "clipboard" ? (
								<Clipboard className="h-4 w-4" />
							) : (
								<FileText className="h-4 w-4" />
							)}
							{exportLabel}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
