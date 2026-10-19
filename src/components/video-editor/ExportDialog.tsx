import { CheckCircle2, Download, FolderOpen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportDetails, ExportProgress } from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { useScopedT } from "../../contexts/I18nContext";
import type { ExportStatus } from "./editorSession";
import { getExportDialogPhaseState } from "./exportUtils";

interface ExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
	progress: ExportProgress | null;
	isExporting: boolean;
	exportStatus: ExportStatus;
	error: string | null;
	onCancel?: () => void;
	onRetrySave?: () => void;
	canRetrySave?: boolean;
	exportFormat?: "mp4" | "gif";
	details?: ExportDetails | null;
	exportedFilePath?: string;
}

const EXPORT_TIP_INTERVAL_MS = 6000;
const EXPORT_TIPS = [
	"Tip: Fewer zoom regions render faster. You can turn off automatic zooms in Settings.",
	"Tip: Motion presets in the Cursor tab switch zoom and cursor feel in one click.",
	"Tip: Click effects can be set to Ripple, Spotlight or Echo.",
	"Tip: Save the project to come back and re-export with different settings.",
];

export function ExportDialog({
	isOpen,
	onClose,
	progress,
	isExporting,
	exportStatus,
	error,
	onCancel,
	onRetrySave,
	canRetrySave = false,
	exportFormat = "mp4",
	details,
	exportedFilePath,
}: ExportDialogProps) {
	const t = useScopedT("dialogs");
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const prevIsOpenRef = useRef(isOpen);
	const [tipIndex, setTipIndex] = useState(0);

	useEffect(() => {
		if (!isExporting) return;
		const timer = window.setInterval(
			() => setTipIndex((index) => (index + 1) % EXPORT_TIPS.length),
			EXPORT_TIP_INTERVAL_MS,
		);
		return () => window.clearInterval(timer);
	}, [isExporting]);

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

	if (!isOpen && !isVisible) return null;

	const formatLabel = exportFormat === "gif" ? "GIF" : "Video";
	const activeProgress: ExportProgress = progress ?? {
		currentFrame: 0,
		totalFrames: 1,
		percentage: 0,
		estimatedTimeRemaining: 0,
		etaSeconds: 0,
		phase: "preparing",
	};
	const showSuccess = exportStatus === "saved";
	const showSaving = exportStatus === "awaiting-save-path" || exportStatus === "saving";
	const showError = Boolean(error) && !showSuccess;
	const showProgress = exportStatus === "exporting" && !showSuccess && !showError;
	const showIdle = !showSuccess && !showSaving && !showError && !showProgress;
	const canDismiss =
		exportStatus === "idle" ||
		exportStatus === "saved" ||
		exportStatus === "canceled" ||
		exportStatus === "failed";

	const { isGifCompiling, isVideoFinalizing } = getExportDialogPhaseState({
		isExporting,
		exportFormat,
		progress,
	});
	const renderProgress = progress?.renderProgress;
	const etaSeconds = progress?.etaSeconds ?? progress?.estimatedTimeRemaining ?? 0;
	const throughputFps = progress?.throughputFps;
	const warnings = progress?.warnings ?? details?.warnings ?? [];
	const fallbackSteps = details?.fallbackSteps ?? [];

	const getStatusMessage = () => {
		if (error) return t("export.pleaseTryAgain");
		if (isGifCompiling) {
			if (renderProgress !== undefined && renderProgress > 0) {
				return t("export.compilingGifProgress", undefined, { progress: renderProgress });
			}
			return t("export.compilingGifWait");
		}
		if (isVideoFinalizing) {
			return `${t("export.finalizingFormat", "Finalizing {{format}}", {
				format: formatLabel,
			})}${throughputFps ? ` • ${throughputFps.toFixed(1)} fps` : ""}`;
		}
		if (progress?.phase && progress.phase !== "finalizing") {
			const phaseLabel =
				progress.engine === "native-composed" && progress.phase === "encoding"
					? "Native composing"
					: progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1);
			return `${phaseLabel}${throughputFps ? ` • ${throughputFps.toFixed(1)} fps` : ""}${etaSeconds > 0 ? ` • ETA ${Math.ceil(etaSeconds)}s` : ""}`;
		}
		return t("export.takeMoment");
	};

	// Get title based on phase
	const getTitle = () => {
		if (error) return t("export.exportFailed");
		if (isGifCompiling) return t("export.compilingGifTitle");
		if (isVideoFinalizing) {
			return t("export.finalizingFormat", "Finalizing {{format}}", {
				format: formatLabel,
			});
		}
		return t("export.exportingFormat", undefined, { format: formatLabel });
	};

	const getProgressLabel = () => {
		if (isGifCompiling) {
			return t("export.compiling");
		}
		if (isVideoFinalizing) {
			return t("export.finalizingFormat", "Finalizing {{format}}", {
				format: formatLabel,
			});
		}
		return t("export.renderingFrames");
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
	const displayPercentage = isGifCompiling
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
				onClick={canDismiss ? onClose : undefined}
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
					{(showProgress || showSaving) && !showSuccess ? (
						<div className="h-[2px] bg-white/[0.04] overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent transition-all duration-500 ease-out"
								style={{
									width:
										showSaving || displayPercentage === null ? "100%" : `${displayPercentage}%`,
									animation:
										showSaving || displayPercentage === null
											? "shimmer 2s ease-in-out infinite"
											: undefined,
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
									<div className="mb-4 flex w-full justify-end">
										<button
											type="button"
											onClick={onClose}
											className="rounded-xl p-2 text-white/40 transition-all duration-200 active:scale-95 hover:bg-white/[0.06] hover:text-white"
										>
											<X className="w-4 h-4" />
										</button>
									</div>
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
											{details.format === "gif" &&
											typeof details.estimatedSizeBytes === "number" ? (
												<div>
													Estimated {(details.estimatedSizeBytes / 1_000_000).toFixed(1)} MB
												</div>
											) : null}
											{details.format === "gif" && typeof details.colorCount === "number" ? (
												<div>{details.colorCount} colors</div>
											) : null}
											{details.format === "gif" && details.ditherMode ? (
												<div>Dither: {details.ditherMode}</div>
											) : null}
											{details.format === "gif" && details.motionSensitivity ? (
												<div>Motion sensitivity: {details.motionSensitivity}</div>
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
										<div className="mt-2 flex flex-col items-center gap-3">
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
											<Button
												onClick={onClose}
												className="bg-[#F59E0B] text-black hover:bg-[#d97706]"
											>
												Done
											</Button>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Error state */}
						{showError && (
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
									{canDismiss && (
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

								{canRetrySave && onRetrySave && (
									<Button
										onClick={onRetrySave}
										className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white font-semibold text-sm shadow-lg shadow-[#F59E0B]/20 hover:shadow-[#F59E0B]/30 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
									>
										Save Again
									</Button>
								)}
							</div>
						)}

						{showSaving && (
							<div className="animate-in fade-in duration-200">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
										<Download className="w-5 h-5 text-[#F59E0B]" />
									</div>
									<div>
										<h3 className="text-[15px] font-semibold text-white tracking-tight">
											{exportStatus === "awaiting-save-path"
												? "Choose Save Location"
												: "Saving Export"}
										</h3>
										<p className="text-[11px] text-slate-500 mt-0.5">
											{exportStatus === "awaiting-save-path"
												? "Waiting for the native save dialog."
												: `Writing your ${formatLabel.toLowerCase()} to disk.`}
										</p>
									</div>
								</div>
								<div className="mt-6 h-2.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
									<div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-[shimmer_1.6s_ease-in-out_infinite]" />
								</div>
							</div>
						)}

						{/* Exporting state */}
						{showProgress && (
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
											<p className="text-[11px] text-slate-500 mt-0.5 min-h-[16px]">
												{getStatusMessage()}
											</p>
										</div>
									</div>
								</div>

								{isExporting && (
									<p className="mb-4 text-[11px] leading-relaxed text-slate-400" aria-live="polite">
										{EXPORT_TIPS[tipIndex]}
									</p>
								)}

								{/* Progress section */}
								<div className="space-y-5">
									{/* Progress bar */}
									<div>
										<div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.1em] mb-2">
											<span className="text-slate-500 flex items-center gap-1.5">
												<div className="w-1 h-1 rounded-full bg-[#F59E0B]" />
												{getProgressLabel()}
											</span>
											<span className="font-mono text-slate-300 tabular-nums min-w-[3.5ch] text-right">
												{isGifCompiling ? (
													renderProgress !== undefined && renderProgress > 0 ? (
														`${renderProgress}%`
													) : (
														<span className="flex items-center gap-1.5">
															<Download className="w-3 h-3 text-[#F59E0B]" />
															<span className="text-slate-400">{t("export.processing")}</span>
														</span>
													)
												) : (
													`${activeProgress.percentage.toFixed(0)}%`
												)}
											</span>
										</div>

										<div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
											{isGifCompiling ? (
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
														width: `${Math.min(activeProgress.percentage, 100)}%`,
													}}
												/>
											)}
										</div>
									</div>

									{/* Stats */}
									<div className="grid grid-cols-3 gap-2">
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
											<div className="text-[9px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-1">
												{t("export.format")}
											</div>
											<div className="text-slate-200 font-semibold text-sm">{formatLabel}</div>
										</div>
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
											<div className="text-[9px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-1">
												{t("export.frames")}
											</div>
											<div className="text-slate-200 font-semibold text-sm font-mono tabular-nums">
												{activeProgress.currentFrame}
												<span className="text-slate-500"> / </span>
												{activeProgress.totalFrames}
											</div>
										</div>
										<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
											<div className="text-[9px] text-slate-500 uppercase tracking-[0.12em] font-semibold mb-1">
												ETA
											</div>
											<div className="text-slate-200 font-semibold text-sm font-mono tabular-nums">
												{etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s` : "—"}
											</div>
										</div>
									</div>

									{/* Phase & throughput bar */}
									<div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-[11px] text-slate-300 min-h-[52px]">
										<div className="flex items-center justify-between">
											<span className="capitalize">
												{activeProgress.phase ? activeProgress.phase : "rendering"}
											</span>
											<span className="font-mono tabular-nums min-w-[5ch] text-right">
												{displayPercentage !== null ? `${displayPercentage}%` : "—"}
											</span>
										</div>
										<div className="mt-1 text-slate-500 min-h-[16px]">
											{throughputFps ? `${throughputFps.toFixed(1)} fps throughput` : "\u00A0"}
										</div>
										{warnings.length > 0 && (
											<div className="mt-1 text-amber-200">{warnings[0]}</div>
										)}
									</div>

									{/* Cancel button */}
									{onCancel && exportStatus === "exporting" && (
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

						{showIdle && (
							<div className="animate-in fade-in duration-200">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
											<Download className="w-5 h-5 text-[#F59E0B]" />
										</div>
										<div>
											<h3 className="text-[15px] font-semibold text-white tracking-tight">
												Ready to Export
											</h3>
											<p className="text-[11px] text-slate-500 mt-0.5">
												Preparing the export workflow.
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
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
