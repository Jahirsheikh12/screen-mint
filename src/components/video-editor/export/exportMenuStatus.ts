import type { ExportFormat, ExportProgress } from "@/lib/exporter";
import type { ExportStatus } from "../editorSession";

export type ExportMenuView = "settings" | "progress" | "error" | "complete";

export interface ExportMenuStatus {
	view: ExportMenuView;
	/** Bar shows an animated stripe instead of a percentage. */
	indeterminate: boolean;
	percent: number;
	/** i18n key in the `dialogs` namespace plus its interpolation values. */
	line: { key: string; fallback: string; vars?: Record<string, number> };
	renderFps: number | null;
}

const RENDER_PHASES = new Set(["decoding", "rendering", "encoding"]);
const FINALIZE_PHASES = new Set(["muxing", "writing", "finalizing"]);

function clampPercent(value: number | undefined): number {
	return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value as number))) : 0;
}

export function resolveExportMenuStatus({
	status,
	progress,
	format,
}: {
	status: ExportStatus;
	progress: ExportProgress | null;
	format: ExportFormat;
}): ExportMenuStatus {
	const base = { indeterminate: false, percent: 0, renderFps: null };
	if (status === "saved") {
		return {
			...base,
			view: "complete",
			percent: 100,
			line: { key: "export.complete", fallback: "Export complete" },
		};
	}
	if (status === "failed" || status === "canceled") {
		return { ...base, view: "error", line: { key: "export.issue", fallback: "Export issue" } };
	}
	if (status === "idle") {
		return { ...base, view: "settings", line: { key: "export.ready", fallback: "Ready" } };
	}
	if (status === "awaiting-save-path") {
		return {
			...base,
			view: "progress",
			indeterminate: true,
			percent: 100,
			line: { key: "export.openingSaveDialog", fallback: "Opening save dialog…" },
		};
	}
	if (status === "saving") {
		return {
			...base,
			view: "progress",
			indeterminate: true,
			percent: 100,
			line: { key: "export.savingFile", fallback: "Saving file…" },
		};
	}

	const phase = progress?.phase;
	if (!progress || phase === "probing" || phase === "preparing") {
		return {
			...base,
			view: "progress",
			indeterminate: true,
			line: { key: "export.preparing", fallback: "Preparing export…" },
		};
	}

	const percent = clampPercent(progress.percentage);
	if (phase === "audio") {
		return {
			...base,
			view: "progress",
			percent,
			line: {
				key: "export.renderingAudio",
				fallback: "Rendering audio {{percent}}%",
				vars: { percent },
			},
		};
	}
	if (phase && FINALIZE_PHASES.has(phase)) {
		const finalizePercent =
			format === "gif" && typeof progress.renderProgress === "number"
				? clampPercent(progress.renderProgress)
				: percent;
		return {
			...base,
			view: "progress",
			percent: finalizePercent,
			// Encoders report the last stretch without progress; show it as working.
			indeterminate: finalizePercent >= 99,
			line:
				format === "gif"
					? {
							key: "export.compilingGif",
							fallback: "Compiling GIF {{percent}}%",
							vars: { percent: finalizePercent },
						}
					: {
							key: "export.finalizing",
							fallback: "Finalizing {{percent}}%",
							vars: { percent: finalizePercent },
						},
		};
	}

	const fps = progress.throughputFps;
	return {
		...base,
		view: "progress",
		percent,
		renderFps:
			(!phase || RENDER_PHASES.has(phase)) && typeof fps === "number" && fps > 0
				? Math.round(fps * 10) / 10
				: null,
		line: { key: "export.percentComplete", fallback: "{{percent}}% complete", vars: { percent } },
	};
}
