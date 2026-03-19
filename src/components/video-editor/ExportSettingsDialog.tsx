import { Download, Film, FolderOpen, Image, Save, X } from "lucide-react";
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
			}, 200);
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
				className={`fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? "opacity-0" : "animate-in fade-in-0 duration-200"}`}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] bg-[#0A0F0D] rounded-2xl shadow-2xl border border-white/10 p-6 w-[90vw] max-w-md transition-all duration-200 ${isClosing ? "opacity-0 scale-95" : "animate-in zoom-in-95 fade-in-0 duration-200"}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-base font-semibold text-white">
						{tSettings("export.title", "Export")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Format selector */}
				<div className="flex items-center gap-2 mb-4">
					<button
						type="button"
						onClick={() => onExportFormatChange("mp4")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border transition-all text-xs font-medium",
							exportFormat === "mp4"
								? "bg-[#10B981]/10 border-[#10B981]/50 text-white"
								: "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200",
						)}
					>
						<Film className="w-3.5 h-3.5" />
						{tSettings("export.mp4")}
					</button>
					<button
						type="button"
						onClick={() => onExportFormatChange("gif")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border transition-all text-xs font-medium",
							exportFormat === "gif"
								? "bg-[#10B981]/10 border-[#10B981]/50 text-white"
								: "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200",
						)}
					>
						<Image className="w-3.5 h-3.5" />
						{tSettings("export.gif")}
					</button>
				</div>

				{/* MP4 quality */}
				{exportFormat === "mp4" && (
					<div className="mb-4">
						<div className="text-[10px] uppercase tracking-wider text-white/40 mb-2 font-medium">
							Quality
						</div>
						<div className="grid h-8 w-full grid-cols-4 rounded-lg border border-white/5 bg-white/5 p-0.5">
							<button
								type="button"
								onClick={() => onExportQualityChange("medium")}
								className={cn(
									"rounded-md transition-all text-[11px] font-medium",
									exportQuality === "medium"
										? "bg-white text-black"
										: "text-slate-400 hover:text-slate-200",
								)}
							>
								{tSettings("export.quality.low")}
							</button>
							<button
								type="button"
								onClick={() => onExportQualityChange("good")}
								className={cn(
									"rounded-md transition-all text-[11px] font-medium",
									exportQuality === "good"
										? "bg-white text-black"
										: "text-slate-400 hover:text-slate-200",
								)}
							>
								{tSettings("export.quality.medium")}
							</button>
							<button
								type="button"
								onClick={() => onExportQualityChange("high")}
								className={cn(
									"rounded-md transition-all text-[11px] font-medium",
									exportQuality === "high"
										? "bg-white text-black"
										: "text-slate-400 hover:text-slate-200",
								)}
							>
								{tSettings("export.quality.high")}
							</button>
							<button
								type="button"
								onClick={() => onExportQualityChange("source")}
								className={cn(
									"rounded-md transition-all text-[11px] font-medium",
									exportQuality === "source"
										? "bg-white text-black"
										: "text-slate-400 hover:text-slate-200",
								)}
							>
								{tSettings("export.quality.original")}
							</button>
						</div>
					</div>
				)}

				{/* GIF settings */}
				{exportFormat === "gif" && (
					<div className="mb-4 space-y-3">
						<div className="flex items-center gap-2">
							<div className="flex-1">
								<div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium">
									Frame Rate
								</div>
								<div className="bg-white/5 border border-white/5 p-0.5 grid grid-cols-4 h-8 rounded-lg">
									{GIF_FRAME_RATES.map((rate) => (
										<button
											type="button"
											key={rate.value}
											onClick={() => onGifFrameRateChange(rate.value)}
											className={cn(
												"rounded-md transition-all text-[11px] font-medium",
												gifFrameRate === rate.value
													? "bg-white text-black"
													: "text-slate-400 hover:text-slate-200",
											)}
										>
											{rate.value}
										</button>
									))}
								</div>
							</div>
							<div className="flex-1">
								<div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 font-medium">
									Size
								</div>
								<div className="bg-white/5 border border-white/5 p-0.5 grid grid-cols-3 h-8 rounded-lg">
									{Object.entries(GIF_SIZE_PRESETS).map(([key]) => (
										<button
											type="button"
											key={key}
											onClick={() => onGifSizePresetChange(key as GifSizePreset)}
											className={cn(
												"rounded-md transition-all text-[11px] font-medium",
												gifSizePreset === key
													? "bg-white text-black"
													: "text-slate-400 hover:text-slate-200",
											)}
										>
											{key === "original" ? "Orig" : key.charAt(0).toUpperCase() + key.slice(1, 3)}
										</button>
									))}
								</div>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-[11px] text-slate-500">
								{gifOutputDimensions.width} × {gifOutputDimensions.height}px
							</span>
							<div className="flex items-center gap-2">
								<span className="text-[11px] text-slate-400">{tSettings("export.loop")}</span>
								<Switch
									checked={gifLoop}
									onCheckedChange={onGifLoopChange}
									className="data-[state=checked]:bg-[#10B981] scale-80"
								/>
							</div>
						</div>
					</div>
				)}

				{/* Project buttons */}
				<div className="grid grid-cols-2 gap-2 mb-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							onLoadProject();
							onClose();
						}}
						className="h-9 text-[11px] font-medium gap-1.5 bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
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
						className="h-9 text-[11px] font-medium gap-1.5 bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
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
					className="w-full py-5 text-sm font-semibold flex items-center justify-center gap-2 bg-[#10B981] text-white rounded-xl shadow-lg shadow-[#10B981]/20 hover:bg-[#10B981]/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
				>
					<Download className="w-4 h-4" />
					{tSettings("export.exportVideo", undefined, {
						format: exportFormat === "gif" ? "GIF" : "Video",
					})}
				</Button>
			</div>
		</>
	);
}
