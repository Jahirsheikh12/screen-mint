import { Download, Film, FolderOpen, Image, Save, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ExportFormat, ExportQuality, GifFrameRate, GifSizePreset } from "@/lib/exporter";
import { GIF_FRAME_RATES, GIF_SIZE_PRESETS } from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { useScopedT } from "../../contexts/I18nContext";

interface ExportSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	exportFormat: ExportFormat;
	onExportFormatChange: (format: ExportFormat) => void;
	exportQuality: ExportQuality;
	onExportQualityChange: (quality: ExportQuality) => void;
	gifFrameRate: GifFrameRate;
	onGifFrameRateChange: (rate: GifFrameRate) => void;
	gifLoop: boolean;
	onGifLoopChange: (loop: boolean) => void;
	gifSizePreset: GifSizePreset;
	onGifSizePresetChange: (preset: GifSizePreset) => void;
	gifOutputDimensions: { width: number; height: number };
	onSaveProject: () => void;
	onLoadProject: () => void;
	onExport: () => void;
}

const QUALITY_DESCRIPTIONS: Record<ExportQuality, string> = {
	medium: "Smaller file size, faster export",
	good: "Balanced quality and size",
	high: "Best quality, larger file",
	source: "Lossless, original resolution",
};

export function ExportSettingsDialog({
	isOpen,
	onClose,
	exportFormat,
	onExportFormatChange,
	exportQuality,
	onExportQualityChange,
	gifFrameRate,
	onGifFrameRateChange,
	gifLoop,
	onGifLoopChange,
	gifSizePreset,
	onGifSizePresetChange,
	gifOutputDimensions,
	onSaveProject,
	onLoadProject,
	onExport,
}: ExportSettingsDialogProps) {
	const tSettings = useScopedT("settings");
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
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

	return (
		<>
			{/* Backdrop */}
			<div
				className={cn(
					"fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md transition-all",
					isClosing
						? "opacity-0 duration-250 ease-in"
						: "opacity-100 duration-300 ease-out animate-in fade-in",
				)}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				className={cn(
					"fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none",
				)}
			>
				<div
					className={cn(
						"pointer-events-auto w-[90vw] max-w-[440px] bg-[#0A0F0D] rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.08] overflow-hidden transition-all",
						isClosing
							? "opacity-0 scale-95 translate-y-2 duration-200 ease-in"
							: "opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3",
					)}
				>
					{/* Top accent line */}
					<div className="h-[2px] bg-gradient-to-r from-transparent via-[#10B981] to-transparent" />

					<div className="p-6">
						{/* Header */}
						<div className="flex items-center justify-between mb-6">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#059669]/10 border border-[#10B981]/20 flex items-center justify-center">
									<Download className="w-4.5 h-4.5 text-[#10B981]" />
								</div>
								<div>
									<h2 className="text-[15px] font-semibold text-white tracking-tight">
										{tSettings("export.title", "Export")}
									</h2>
									<p className="text-[11px] text-slate-500 mt-0.5">
										Configure your export settings
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all duration-200 active:scale-95"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* Format selector */}
						<div className="mb-5">
							<div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
								<div className="w-1 h-1 rounded-full bg-[#10B981]" />
								Format
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => onExportFormatChange("mp4")}
									className={cn(
										"flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-200",
										exportFormat === "mp4"
											? "bg-gradient-to-br from-[#10B981]/15 to-[#10B981]/5 border-[#10B981]/40 text-white shadow-lg shadow-[#10B981]/10"
											: "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-slate-200",
									)}
								>
									<Film className="w-4 h-4" />
									<span className="text-xs font-semibold">{tSettings("export.mp4")}</span>
									{exportFormat === "mp4" && <Sparkles className="w-3 h-3 text-[#10B981] ml-0.5" />}
								</button>
								<button
									type="button"
									onClick={() => onExportFormatChange("gif")}
									className={cn(
										"flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-200",
										exportFormat === "gif"
											? "bg-gradient-to-br from-[#10B981]/15 to-[#10B981]/5 border-[#10B981]/40 text-white shadow-lg shadow-[#10B981]/10"
											: "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-slate-200",
									)}
								>
									<Image className="w-4 h-4" />
									<span className="text-xs font-semibold">{tSettings("export.gif")}</span>
									{exportFormat === "gif" && <Sparkles className="w-3 h-3 text-[#10B981] ml-0.5" />}
								</button>
							</div>
						</div>

						{/* MP4 quality */}
						{exportFormat === "mp4" && (
							<div className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
								<div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
									<div className="w-1 h-1 rounded-full bg-[#10B981]" />
									Quality
								</div>
								<div className="grid h-10 w-full grid-cols-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 gap-1">
									{(
										[
											["medium", tSettings("export.quality.low")],
											["good", tSettings("export.quality.medium")],
											["high", tSettings("export.quality.high")],
											["source", tSettings("export.quality.original")],
										] as const
									).map(([quality, label]) => (
										<button
											type="button"
											key={quality}
											onClick={() => onExportQualityChange(quality)}
											className={cn(
												"rounded-lg transition-all duration-200 text-[11px] font-semibold",
												exportQuality === quality
													? "bg-gradient-to-b from-white to-white/90 text-[#0A0F0D] shadow-sm"
													: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
											)}
										>
											{label}
										</button>
									))}
								</div>
								<p className="text-[10px] text-slate-500 mt-1.5 ml-0.5 transition-all duration-200">
									{QUALITY_DESCRIPTIONS[exportQuality]}
								</p>
							</div>
						)}

						{/* GIF settings */}
						{exportFormat === "gif" && (
							<div className="mb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
								<div>
									<div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
										<div className="w-1 h-1 rounded-full bg-[#10B981]" />
										Frame Rate
									</div>
									<div className="grid h-10 w-full grid-cols-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 gap-1">
										{GIF_FRAME_RATES.map((rate) => (
											<button
												type="button"
												key={rate.value}
												onClick={() => onGifFrameRateChange(rate.value)}
												className={cn(
													"rounded-lg transition-all duration-200 text-[11px] font-semibold",
													gifFrameRate === rate.value
														? "bg-gradient-to-b from-white to-white/90 text-[#0A0F0D] shadow-sm"
														: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
												)}
											>
												{rate.value} fps
											</button>
										))}
									</div>
								</div>

								<div>
									<div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
										<div className="w-1 h-1 rounded-full bg-[#10B981]" />
										Size
									</div>
									<div className="grid h-10 w-full grid-cols-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 gap-1">
										{Object.entries(GIF_SIZE_PRESETS).map(([key]) => (
											<button
												type="button"
												key={key}
												onClick={() => onGifSizePresetChange(key as GifSizePreset)}
												className={cn(
													"rounded-lg transition-all duration-200 text-[11px] font-semibold",
													gifSizePreset === key
														? "bg-gradient-to-b from-white to-white/90 text-[#0A0F0D] shadow-sm"
														: "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
												)}
											>
												{key === "original"
													? "Original"
													: key.charAt(0).toUpperCase() + key.slice(1)}
											</button>
										))}
									</div>
								</div>

								<div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
									<div>
										<span className="text-xs text-slate-300 font-medium">
											{tSettings("export.loop")}
										</span>
										<span className="text-[10px] text-slate-500 block mt-0.5">
											{gifOutputDimensions.width} × {gifOutputDimensions.height}px
										</span>
									</div>
									<Switch
										checked={gifLoop}
										onCheckedChange={onGifLoopChange}
										className="data-[state=checked]:bg-[#10B981] scale-90"
									/>
								</div>
							</div>
						)}

						{/* Divider */}
						<div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-5" />

						{/* Project buttons */}
						<div className="grid grid-cols-2 gap-2 mb-5">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									onLoadProject();
									onClose();
								}}
								className="h-10 text-[11px] font-medium gap-2 bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 hover:border-white/[0.12] rounded-xl transition-all duration-200"
							>
								<FolderOpen className="w-3.5 h-3.5" />
								{tSettings("export.loadProject")}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									onSaveProject();
									onClose();
								}}
								className="h-10 text-[11px] font-medium gap-2 bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 hover:border-white/[0.12] rounded-xl transition-all duration-200"
							>
								<Save className="w-3.5 h-3.5" />
								{tSettings("export.saveProject")}
							</Button>
						</div>

						{/* Export button */}
						<Button
							type="button"
							size="lg"
							onClick={() => {
								onExport();
								onClose();
							}}
							className="w-full h-12 text-sm font-semibold flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-xl shadow-xl shadow-[#10B981]/20 hover:shadow-[#10B981]/30 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 border border-[#10B981]/30"
						>
							<Zap className="w-4 h-4" />
							{tSettings("export.exportVideo", undefined, {
								format: exportFormat === "gif" ? "GIF" : "Video",
							})}
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
