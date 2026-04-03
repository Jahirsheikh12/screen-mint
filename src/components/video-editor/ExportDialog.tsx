import { CheckCircle2, Download, FolderOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportDetails, ExportProgress } from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { useScopedT } from "../../contexts/I18nContext";

interface ExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
	progress: ExportProgress | null;
	isExporting: boolean;
	error: string | null;
	onCancel?: () => void;
	onRetrySave?: () => void;
	canRetrySave?: boolean;
	exportFormat?: "mp4" | "gif";
	details?: ExportDetails | null;
	exportedFilePath?: string;
}

export function ExportDialog({
	isOpen,
	onClose,
	progress,
	isExporting,
	error,
	onCancel,
	onRetrySave,
	canRetrySave = false,
	exportFormat = "mp4",
	details,
	exportedFilePath,
}: ExportDialogProps) {
	const t = useScopedT("dialogs");
	const [showSuccess, setShowSuccess] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const prevIsOpenRef = useRef(isOpen);

	// Handle open/close transitions
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

	// Reset showSuccess when a new export starts or dialog reopens
	useEffect(() => {
		if (isExporting) {
			setShowSuccess(false);
		}
	}, [isExporting]);

	// Reset showSuccess when dialog opens fresh
	useEffect(() => {
		if (isOpen && !isExporting && !progress) {
			setShowSuccess(false);
		}
	}, [isOpen, isExporting, progress]);

	useEffect(() => {
		if (!isExporting && progress && progress.percentage >= 100 && !error) {
			setShowSuccess(true);
			const timer = setTimeout(() => {
				setShowSuccess(false);
				onClose();
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isExporting, progress, error, onClose]);

	if (!isOpen && !isVisible) return null;

	const formatLabel = exportFormat === "gif" ? "GIF" : "Video";

	const isCompiling = isExporting && progress?.phase === "finalizing" && exportFormat === "gif";
	const isFinalizing = progress?.phase === "finalizing";
	const renderProgress = progress?.renderProgress;
	const etaSeconds = progress?.etaSeconds ?? progress?.estimatedTimeRemaining ?? 0;
	const throughputFps = progress?.throughputFps;
	const warnings = progress?.warnings ?? details?.warnings ?? [];
	const fallbackSteps = details?.fallbackSteps ?? [];

	const getStatusMessage = () => {
		if (error) return t("export.pleaseTryAgain");
		if (progress?.phase && progress.phase !== "finalizing") {
			const phaseLabel = progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1);
			return `${phaseLabel}${throughputFps ? ` • ${throughputFps.toFixed(1)} fps` : ""}${etaSeconds > 0 ? ` • ETA ${Math.ceil(etaSeconds)}s` : ""}`;
		}
		if (isCompiling || isFinalizing) {
			if (renderProgress !== undefined && renderProgress > 0) {
				return t("export.compilingGifProgress", undefined, { progress: renderProgress });
			}
			return t("export.compilingGifWait");
		}
		return t("export.takeMoment");
	};

	// Get title based on phase
	const getTitle = () => {
		if (error) return t("export.exportFailed");
		if (isCompiling || isFinalizing) return t("export.compilingGifTitle");
		return t("export.exportingFormat", undefined, { format: formatLabel });
	};

	const handleClickShowInFolder = async () => {
		if (exportedFilePath) {
			try {
				const result = await window.electronAPI.revealInFolder(exportedFilePath);
				if (!result.success) {
					const errorMessage = result.error || result.message || "Failed to reveal item in folder.";
					console.error("Failed to reveal in folder:", errorMessage);
					toast.error(errorMessage);
				}
			} catch (err) {
				const errorMessage = String(err);
				console.error("Error calling revealInFolder IPC:", errorMessage);
				toast.error(`Error revealing in folder: ${errorMessage}`);
			}
		}
	};

	// Progress percentage for display
	const displayPercentage =
		isCompiling || isFinalizing
			? renderProgress !== undefined && renderProgress > 0
				? renderProgress
				: null
			: progress
				? Math.min(progress.percentage, 100)
				: 0;

	return (
		<>
			{/* Backdrop */}
			<div
				className={cn(
					"fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] transition-all",
					isClosing
						? "opacity-0 duration-250 ease-in"
						: "opacity-100 duration-300 ease-out animate-in fade-in",
				)}
				onClick={isExporting ? undefined : onClose}
			/>

			{/* Dialog */}
			<div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
				<div
					className={cn(
						"pointer-events-auto w-[90vw] max-w-[440px] bg-[#0A0F0D] rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.08] overflow-hidden transition-all",
						isClosing
							? "opacity-0 scale-95 translate-y-2 duration-200 ease-in"
							: "opacity-100 scale-100 translate-y-0 duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-3",
					)}
				>
					{/* Top accent line - animated during export */}
					{isExporting && !showSuccess ? (
						<div className="h-[2px] bg-white/[0.04] overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent transition-all duration-500 ease-out"
								style={{
									width: displayPercentage !== null ? `${displayPercentage}%` : "100%",
									animation:
										displayPercentage === null ? "shimmer 2s ease-in-out infinite" : undefined,
								}}
							/>
						</div>
					) : (
						<div
							className={cn(
								"h-[2px] bg-gradient-to-r from-transparent to-transparent transition-all duration-500",
								showSuccess ? "via-[#F59E0B]" : error ? "via-red-500" : "via-[#F59E0B]",
							)}
						/>
					)}

					<style>{`
						@keyframes shimmer {
							0% { transform: translateX(-100%); }
							100% { transform: translateX(200%); }
						}
						@keyframes pulse-ring {
							0% { transform: scale(1); opacity: 1; }
							100% { transform: scale(1.6); opacity: 0; }
						}
					`}</style>

					<div className="p-6">
						{/* Success state */}
						{showSuccess && (
							<div className="animate-in fade-in zoom-in-95 duration-300">
								<div className="flex flex-col items-center text-center py-2">
									<div className="relative mb-4">
										<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F59E0B]/20 to-[#d97706]/10 border border-[#F59E0B]/25 flex items-center justify-center">
											<CheckCircle2 className="w-8 h-8 text-[#F59E0B]" />
										</div>
										<div
											className="absolute inset-0 rounded-2xl border border-[#F59E0B]/30"
											style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
										/>
									</div>
									<h3 className="text-lg font-semibold text-white mb-1">
										{t("export.exportComplete")}
									</h3>
									<p className="text-sm text-slate-400 mb-4">
										{t("export.formatReady", undefined, {
											format: formatLabel.toLowerCase(),
										})}
									</p>
									{details ? (
										<div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-[11px] text-slate-300">
											<div>
												{details.width} × {details.height} • {details.frameRate} FPS
											</div>
											{details.codecLabel || details.codec ? (
												<div>{details.codecLabel ?? details.codec}</div>
											) : null}
											{typeof details.bitrate === "number" ? (
												<div>{(details.bitrate / 1_000_000).toFixed(1)} Mbps</div>
											) : null}
											{typeof details.fileSizeBytes === "number" ? (
												<div>{(details.fileSizeBytes / 1_000_000).toFixed(1)} MB</div>
											) : null}
											{fallbackSteps.map((step) => (
												<div key={step} className="mt-1 text-amber-300">
													{step}
												</div>
											))}
											{details.warnings?.map((warning) => (
												<div key={warning} className="mt-1 text-slate-500">
													{warning}
												</div>
											))}
										</div>
									) : null}
									{exportedFilePath && (
										<>
											<Button
												variant="secondary"
												onClick={handleClickShowInFolder}
												className="gap-2 px-4 py-2.5 text-xs font-medium rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] transition-all duration-200"
											>
												<FolderOpen className="w-3.5 h-3.5" />
												{t("export.showInFolder")}
											</Button>
											<span className="text-[10px] text-slate-500 break-all max-w-xs mt-3 font-mono">
												{exportedFilePath.split("/").pop()}
											</span>
										</>
									)}
								</div>
							</div>
						)}

						{/* Error state */}
						{error && !showSuccess && (
							<div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
								<div className="flex items-center justify-between mb-5">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
											<X className="w-5 h-5 text-red-400" />
										</div>
										<div>
											<h3 className="text-[15px] font-semibold text-white">{getTitle()}</h3>
											<p className="text-[11px] text-slate-500 mt-0.5">{getStatusMessage()}</p>
										</div>
									</div>
									{!isExporting && (
										<button
											type="button"
											onClick={onClose}
											className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all duration-200 active:scale-95"
										>
											<X className="w-4 h-4" />
										</button>
									)}
								</div>

								<div className="rounded-xl bg-red-500/8 border border-red-500/15 p-4 mb-4">
									<p className="text-sm text-red-300 leading-relaxed">{error}</p>
								</div>

								{!isExporting && canRetrySave && onRetrySave && (
									<Button
										onClick={onRetrySave}
										className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white font-semibold text-sm shadow-lg shadow-[#F59E0B]/20 hover:shadow-[#F59E0B]/30 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
									>
										Save Again
									</Button>
								)}
							</div>
						)}

						{/* Exporting state */}
						{isExporting && progress && !showSuccess && !error && (
							<div className="animate-in fade-in duration-200">
								{/* Header */}
								<div className="flex items-center justify-between mb-6">
									<div className="flex items-center gap-3">
										<div className="relative">
											<div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
												<Download className="w-5 h-5 text-[#F59E0B]" />
											</div>
										</div>
										<div>
											<h3 className="text-[15px] font-semibold text-white tracking-tight">
												{getTitle()}
											</h3>
											<p className="text-[11px] text-slate-500 mt-0.5">{getStatusMessage()}</p>
										</div>
									</div>
								</div>

								{/* Progress section */}
								<div className="space-y-5">
									{/* Progress bar */}
									<div>
										<div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.1em] mb-2">
											<span className="text-slate-500 flex items-center gap-1.5">
												<div className="w-1 h-1 rounded-full bg-[#F59E0B]" />
												{isCompiling || isFinalizing
													? t("export.compiling")
													: t("export.renderingFrames")}
											</span>
											<span className="font-mono text-slate-300">
												{isCompiling || isFinalizing ? (
													renderProgress !== undefined && renderProgress > 0 ? (
														`${renderProgress}%`
													) : (
														<span className="flex items-center gap-1.5">
															<Download className="w-3 h-3 text-[#F59E0B]" />
															<span className="text-slate-400">{t("export.processing")}</span>
														</span>
													)
												) : (
													`${progress.percentage.toFixed(0)}%`
												)}
											</span>
										</div>

										<div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
											{isCompiling || isFinalizing ? (
												renderProgress !== undefined && renderProgress > 0 ? (
													<div
														className="h-full bg-gradient-to-r from-[#F59E0B] to-[#d97706] shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-500 ease-out rounded-full"
														style={{ width: `${renderProgress}%` }}
													/>
												) : (
													<div className="h-full w-full relative overflow-hidden rounded-full">
														<div
															className="absolute h-full w-1/3 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent shadow-[0_0_12px_rgba(245,158,11,0.4)] rounded-full"
															style={{
																animation: "indeterminate 1.8s ease-in-out infinite",
															}}
														/>
														<style>{`
															@keyframes indeterminate {
																0% { transform: translateX(-100%); }
																100% { transform: translateX(400%); }
															}
														`}</style>
													</div>
												)
											) : (
												<div
													className="h-full bg-gradient-to-r from-[#F59E0B] to-[#d97706] shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-500 ease-out rounded-full"
													style={{
														width: `${Math.min(progress.percentage, 100)}%`,
													}}
												/>
											)}
										</div>
									</div>

									{/* Stats */}
									<div className="grid grid-cols-2 gap-2">
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
											<div className="text-[9px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-1">
												{isCompiling || isFinalizing ? t("export.status") : t("export.format")}
											</div>
											<div className="text-slate-200 font-semibold text-sm">
												{isCompiling || isFinalizing ? t("export.compilingStatus") : formatLabel}
											</div>
										</div>
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
											<div className="text-[9px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-1">
												{t("export.frames")}
											</div>
											<div className="text-slate-200 font-semibold text-sm font-mono">
												{progress.currentFrame} <span className="text-slate-500">/</span>{" "}
												{progress.totalFrames}
											</div>
										</div>
									</div>
									<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-[11px] text-slate-300">
										<div className="flex items-center justify-between">
											<span>{progress.phase ? progress.phase : "rendering"}</span>
											<span>
												{displayPercentage !== null ? `${displayPercentage}%` : "working"}
											</span>
										</div>
										{throughputFps ? (
											<div className="mt-1 text-slate-500">
												{throughputFps.toFixed(1)} fps throughput
											</div>
										) : null}
										{etaSeconds > 0 ? (
											<div className="mt-1 text-slate-500">ETA {Math.ceil(etaSeconds)} seconds</div>
										) : null}
										{warnings.length > 0 ? (
											<div className="mt-1 text-amber-200">{warnings[0]}</div>
										) : null}
									</div>

									{/* Cancel button */}
									{onCancel && (
										<Button
											onClick={onCancel}
											variant="destructive"
											className="w-full h-11 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500/15 hover:border-red-500/25 transition-all duration-200 rounded-xl text-sm font-semibold"
										>
											{t("export.cancelExport")}
										</Button>
									)}
								</div>
							</div>
						)}

						{/* Idle success message (after export, before auto-close) */}
						{showSuccess && (
							<div className="text-center pt-2 animate-in fade-in zoom-in-95 duration-200">
								<p className="text-sm text-slate-300 font-medium">
									{t("export.savedSuccess", undefined, { format: formatLabel })}
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
