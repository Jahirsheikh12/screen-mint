import { Download, Film, Image as ImageIcon } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useScopedT } from "@/contexts/I18nContext";
import {
	type ExportDetails,
	type ExportFormat,
	type ExportProgress,
	QUICK_ENCODING_MODES,
	QUICK_GIF_FRAME_RATES,
	QUICK_GIF_SIZES,
	QUICK_VIDEO_FRAME_RATES,
	QUICK_VIDEO_QUALITIES,
	type QuickGifSettings,
	type QuickVideoQuality,
	type QuickVideoSettings,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";
import type { ExportStatus } from "../editorSession";
import { resolveExportMenuStatus } from "./exportMenuStatus";

const TIP_INTERVAL_MS = 6_000;
const TIP_KEYS = ["zooms", "presets", "clicks", "project"] as const;
const PILL_SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

type Size = { width: number; height: number };

export interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	status: ExportStatus;
	progress: ExportProgress | null;
	error: string | null;
	exportedFilePath?: string;
	details: ExportDetails | null;
	hasPendingSave: boolean;
	format: ExportFormat;
	onFormatChange: (format: ExportFormat) => void;
	video: QuickVideoSettings;
	onVideoChange: (patch: Partial<QuickVideoSettings>) => void;
	gif: QuickGifSettings;
	onGifChange: (patch: Partial<QuickGifSettings>) => void;
	videoDimensions: Record<QuickVideoQuality, Size>;
	gifDimensions: Size;
	showCaptionSidecar: boolean;
	includeCaptionSidecar: boolean;
	onIncludeCaptionSidecarChange: (enabled: boolean) => void;
	extraMessages?: string[];
	onExport: () => void;
	onCancel: () => void;
	onRetrySave: () => void;
	onDismiss: () => void;
	onReveal: () => void;
	onOpenAdvanced: () => void;
}

function Segmented<T extends string | number>({
	id,
	options,
	value,
	onChange,
	render,
	className,
}: {
	id: string;
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
	render: (option: T, active: boolean) => ReactNode;
	className?: string;
}) {
	return (
		<LayoutGroup id={id}>
			<div
				role="radiogroup"
				className={cn(
					"grid rounded-xl border border-white/[0.06] bg-white/[0.04] p-0.5",
					className,
				)}
				style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
			>
				{options.map((option) => {
					const active = option === value;
					return (
						<button
							key={String(option)}
							type="button"
							role="radio"
							aria-checked={active}
							onClick={() => onChange(option)}
							className="relative min-w-0 rounded-lg px-1 py-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
						>
							{active ? (
								<motion.span
									layoutId={`${id}-pill`}
									className="absolute inset-0 rounded-lg bg-white"
									transition={PILL_SPRING}
								/>
							) : null}
							<span
								className={cn(
									"relative z-10 flex flex-col items-center break-words text-center leading-tight transition-colors [hyphens:auto]",
									active ? "text-black" : "text-white/55 hover:text-white",
								)}
							>
								{render(option, active)}
							</span>
						</button>
					);
				})}
			</div>
		</LayoutGroup>
	);
}

function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
			{children}
		</div>
	);
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("min-w-0 text-white", className)}>{children}</div>;
}

/** Buttons whose labels may wrap in long languages instead of spilling out. */
const WRAP_BUTTON = "h-auto min-h-9 min-w-[8rem] flex-1 whitespace-normal px-3 py-2 leading-tight";

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ExportDialog(props: ExportDialogProps) {
	const t = useScopedT("settings");
	const tDialogs = useScopedT("dialogs");
	const tCommon = useScopedT("common");
	const status = resolveExportMenuStatus({
		status: props.status,
		progress: props.progress,
		format: props.format,
	});
	const isWorking = status.view === "progress";

	const messages = useMemo(
		() => [
			...TIP_KEYS.map((key) => tDialogs(`export.tips.${key}`)),
			...(props.extraMessages ?? []),
		],
		[tDialogs, props.extraMessages],
	);
	const [messageIndex, setMessageIndex] = useState(0);
	useEffect(() => {
		if (!isWorking || messages.length < 2) return;
		const timer = window.setInterval(
			() => setMessageIndex((index) => (index + 1) % messages.length),
			TIP_INTERVAL_MS,
		);
		return () => window.clearInterval(timer);
	}, [isWorking, messages.length]);

	const formatName = props.format === "gif" ? "GIF" : t("export.formatVideo", "Video");

	const settingsView = (
		<Panel>
			<DialogTitle className="mb-1 text-base font-semibold tracking-tight text-white">
				{t("export.title", "Export")}
			</DialogTitle>
			<DialogDescription className="mb-4 text-xs text-white/45">
				{t("export.buttonTooltip", "Export video or GIF")}
			</DialogDescription>

			<Segmented
				id="export-format"
				className="mb-3"
				options={["mp4", "gif"] as const}
				value={props.format}
				onChange={props.onFormatChange}
				render={(option) => (
					<span className="flex items-center gap-1.5 py-0.5 text-xs">
						{option === "mp4" ? (
							<Film className="h-3.5 w-3.5" />
						) : (
							<ImageIcon className="h-3.5 w-3.5" />
						)}
						{option === "mp4" ? t("export.mp4", "MP4") : t("export.gif", "GIF")}
					</span>
				)}
			/>

			{props.format === "mp4" ? (
				<>
					<Segmented
						id="export-quality"
						className="mb-3 min-h-12"
						options={QUICK_VIDEO_QUALITIES}
						value={props.video.quality}
						onChange={(quality) => props.onVideoChange({ quality })}
						render={(option, active) => (
							<>
								<span>{t(`export.quality.${option}`)}</span>
								<span
									className={cn(
										"mt-0.5 text-[9px] tabular-nums",
										active ? "text-black/60" : "text-white/35",
									)}
								>
									{props.videoDimensions[option].width} × {props.videoDimensions[option].height}
								</span>
							</>
						)}
					/>
					<SectionLabel>{t("export.encodingTitle", "Encoding")}</SectionLabel>
					<Segmented
						id="export-encoding"
						className="mb-3"
						options={QUICK_ENCODING_MODES}
						value={props.video.encoding}
						onChange={(encoding) => props.onVideoChange({ encoding })}
						render={(option) => t(`export.encoding.${option}`)}
					/>
					<SectionLabel>{t("export.fpsTitle", "FPS")}</SectionLabel>
					<Segmented
						id="export-fps"
						className="mb-3"
						options={QUICK_VIDEO_FRAME_RATES}
						value={props.video.frameRate}
						onChange={(frameRate) => props.onVideoChange({ frameRate })}
						render={(option) => option}
					/>
					{props.showCaptionSidecar ? (
						<div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
							<div className="min-w-0">
								<p className="text-[11px] font-semibold">
									{t("export.captionSidecarTitle", "Export captions file")}
								</p>
								<p className="mt-0.5 truncate text-[10px] text-white/45">
									{t("export.captionSidecarHint", "Save .srt and .vtt files next to the video.")}
								</p>
							</div>
							<Switch
								checked={props.includeCaptionSidecar}
								onCheckedChange={props.onIncludeCaptionSidecarChange}
								aria-label={t("export.captionSidecarTitle", "Export captions file")}
								className="shrink-0 scale-75"
							/>
						</div>
					) : null}
				</>
			) : (
				<div className="mb-3 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Segmented
							id="export-gif-fps"
							className="min-w-[11rem] flex-1"
							options={QUICK_GIF_FRAME_RATES}
							value={props.gif.frameRate}
							onChange={(frameRate) => props.onGifChange({ frameRate })}
							render={(option) => option}
						/>
						<Segmented
							id="export-gif-size"
							className="min-w-[11rem] flex-1"
							options={QUICK_GIF_SIZES}
							value={props.gif.size}
							onChange={(size) => props.onGifChange({ size })}
							render={(option) => t(`export.gifSize.${option}`)}
						/>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-2 px-1">
						<span className="text-[10px] tabular-nums text-white/45">
							{t("export.outputDimensions", undefined, {
								dimensions: `${props.gifDimensions.width} × ${props.gifDimensions.height}`,
							})}
						</span>
						<label className="flex items-center gap-2 text-[10px] text-white/55">
							{t("export.loop", "Loop")}
							<Switch
								checked={props.gif.loop}
								onCheckedChange={(loop) => props.onGifChange({ loop })}
								className="scale-75"
							/>
						</label>
					</div>
				</div>
			)}

			<Button
				type="button"
				onClick={props.onExport}
				className="h-auto min-h-11 w-full gap-2 whitespace-normal rounded-lg bg-[#f59e0b] py-2 text-sm font-semibold text-white hover:bg-[#d97706]"
			>
				<Download className="h-4 w-4" />
				{t("export.exportVideo", undefined, { format: formatName })}
			</Button>
			<button
				type="button"
				onClick={props.onOpenAdvanced}
				className="mt-2 w-full text-center text-[11px] text-white/40 transition-colors hover:text-white/75"
			>
				{t("export.advanced", "Advanced settings…")}
			</button>
		</Panel>
	);

	const progressView = (
		<Panel>
			<div className="mb-4 min-w-0 pr-8">
				<DialogTitle className="text-base font-semibold text-white">
					{tDialogs("export.exporting", "Exporting")}
				</DialogTitle>
				<DialogDescription className="mt-0.5 text-xs text-white/50">
					{tDialogs("export.renderingFile", "Rendering your file.")}
				</DialogDescription>
			</div>
			<div
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={status.indeterminate ? undefined : status.percent}
				className="relative h-2 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.06]"
			>
				{status.indeterminate ? (
					<div className="export-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-[#f59e0b]" />
				) : (
					<div
						className="h-full rounded-full bg-[#f59e0b] transition-[width] duration-300 ease-out"
						style={{ width: `${Math.max(status.percent, 4)}%` }}
					/>
				)}
			</div>
			<p className="mt-2 text-xs tabular-nums text-white/60">
				{tDialogs(status.line.key, status.line.fallback, status.line.vars)}
			</p>
			{status.renderFps ? (
				<p className="mt-1 text-[11px] tabular-nums text-white/40">
					{tDialogs("export.renderSpeed", undefined, { fps: status.renderFps })}
				</p>
			) : null}
			{messages.length > 0 ? (
				<p aria-live="polite" className="mt-3 min-h-8 text-[11px] leading-relaxed text-white/40">
					{messages[messageIndex % messages.length]}
				</p>
			) : null}
			<Button
				type="button"
				variant="outline"
				onClick={props.onCancel}
				disabled={props.status !== "exporting"}
				className="mt-4 h-auto min-h-9 w-full whitespace-normal border-red-500/20 bg-red-500/10 py-2 text-xs text-red-300 hover:bg-red-500/20"
			>
				{tCommon("actions.cancel", "Cancel")}
			</Button>
		</Panel>
	);

	const errorView = (
		<Panel>
			<DialogTitle className="pr-8 text-base font-semibold text-white">
				{tDialogs("export.issue", "Export issue")}
			</DialogTitle>
			<DialogDescription className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-white/55">
				{props.error}
			</DialogDescription>
			<div className="mt-4 flex flex-wrap gap-2">
				{props.hasPendingSave ? (
					<Button
						type="button"
						onClick={props.onRetrySave}
						className={cn(
							WRAP_BUTTON,
							"rounded-md bg-[#f59e0b] text-xs font-semibold text-white hover:bg-[#d97706]",
						)}
					>
						{tDialogs("export.saveAgain", "Save Again")}
					</Button>
				) : null}
				<Button
					type="button"
					variant="outline"
					onClick={props.onDismiss}
					className={cn(
						WRAP_BUTTON,
						"border-white/10 bg-white/[0.05] text-xs text-white/60 hover:bg-white/10",
					)}
				>
					{tDialogs("export.close", "Close")}
				</Button>
			</div>
		</Panel>
	);

	const detailParts = props.details
		? [
				`${props.details.width} × ${props.details.height}`,
				`${props.details.frameRate} fps`,
				props.details.fileSizeBytes ? formatBytes(props.details.fileSizeBytes) : null,
			].filter(Boolean)
		: [];
	const completeView = (
		<Panel>
			<DialogTitle className="pr-8 text-base font-semibold text-white">
				{tDialogs("export.complete", "Export complete")}
			</DialogTitle>
			<DialogDescription className="mt-1 text-xs text-white/50">
				{tDialogs("export.savedSuccessfully", "Your file was saved.")}
			</DialogDescription>
			{props.exportedFilePath ? (
				<p className="mt-3 truncate text-xs text-white/45" title={props.exportedFilePath}>
					{props.exportedFilePath.split(/[\\/]/).pop()}
				</p>
			) : null}
			{detailParts.length > 0 ? (
				<p className="mt-1 text-[11px] tabular-nums text-white/35">{detailParts.join(" • ")}</p>
			) : null}
			<div className="mt-4 flex flex-wrap gap-2">
				{props.exportedFilePath ? (
					<Button
						type="button"
						onClick={props.onReveal}
						className={cn(
							WRAP_BUTTON,
							"rounded-md bg-[#f59e0b] text-xs font-semibold text-white hover:bg-[#d97706]",
						)}
					>
						{tDialogs("export.showInFolder", "Show in Folder")}
					</Button>
				) : null}
				<Button
					type="button"
					variant="outline"
					onClick={props.onDismiss}
					className={cn(
						WRAP_BUTTON,
						"border-white/10 bg-white/[0.05] text-xs text-white/60 hover:bg-white/10",
					)}
				>
					{tDialogs("export.done", "Done")}
				</Button>
			</div>
		</Panel>
	);

	const views = {
		settings: settingsView,
		progress: progressView,
		error: errorView,
		complete: completeView,
	} as const;

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent
				className="w-[calc(100vw-2rem)] max-w-[420px] gap-0 rounded-2xl border-white/[0.08] bg-[#111114] p-5 text-white shadow-2xl [&>button]:text-white/50 [&>button:hover]:text-white"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<style>{`@keyframes export-indeterminate{0%{left:-35%}100%{left:100%}}.export-indeterminate{animation:export-indeterminate 1.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.export-indeterminate{animation:none;left:0;width:100%;opacity:.5}}`}</style>
				{views[status.view]}
			</DialogContent>
		</Dialog>
	);
}
