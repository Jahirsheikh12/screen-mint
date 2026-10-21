import { AlertCircle, Download, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { useUpdaterState } from "@/hooks/useUpdaterState";

type UpdaterSnapshot = ReturnType<typeof useUpdaterState>;
type Translator = ReturnType<typeof useScopedT>;

function isBusy(busy: UpdaterSnapshot["busy"]): boolean {
	return busy.recording || busy.exporting || busy.transcribing;
}

function formatProgress(progress: number | null): string {
	if (typeof progress !== "number") {
		return "0%";
	}

	return `${Math.round(Math.max(0, Math.min(100, progress)))}%`;
}

function buildUpdateTitle(state: UpdaterSnapshot, t: Translator) {
	switch (state.status) {
		case "downloading":
			return t("updates.popup.downloadingTitle");
		case "downloaded":
			return t("updates.popup.readyTitle");
		default:
			return t("updates.popup.title");
	}
}

function buildUpdateBody(state: UpdaterSnapshot, t: Translator) {
	const version = state.latestVersion ?? state.currentVersion;

	switch (state.status) {
		case "downloading":
			return t("updates.popup.downloadingBody", undefined, {
				version,
				progress: formatProgress(state.progress),
			});
		case "downloaded":
			return state.installMode === "external-installer"
				? t("updates.popup.downloadedBodyExternal", undefined, { version })
				: t("updates.popup.downloadedBodyInApp", undefined, { version });
		case "manual-download-required":
			return t("updates.popup.manualBody", undefined, { version });
		default:
			return state.installMode === "external-installer"
				? t("updates.popup.availableBodyExternal", undefined, { version })
				: t("updates.popup.availableBody", undefined, { version });
	}
}

/** Content of the `update-toast` window: a compact, non-blocking update prompt. */
export function UpdateToast() {
	const state = useUpdaterState();
	const t = useScopedT("common");
	const busy = isBusy(state.busy);
	const rootRef = useRef<HTMLDivElement | null>(null);

	// Size the window to the card so no transparent strip sits over other apps.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const observer = new ResizeObserver(() => {
			window.electronAPI.resizeUpdateToast(Math.ceil(root.getBoundingClientRect().height));
		});
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	async function handleUpdateNow() {
		if (state.status === "downloading") {
			return;
		}

		if (state.status === "downloaded") {
			await window.electronAPI.installUpdateAndRestart();
			return;
		}

		if (state.status === "manual-download-required") {
			if (state.manualDownloadUrl) {
				await window.electronAPI.openExternalUrl(state.manualDownloadUrl);
			}
			await window.electronAPI.updateLaterForSession();
			return;
		}

		await window.electronAPI.downloadUpdate();
	}

	const updateNowDisabled =
		state.status === "downloading" ||
		((state.status === "available" || state.status === "downloaded") && busy);

	return (
		<div ref={rootRef} className="w-screen p-2">
			<div
				role="alertdialog"
				aria-labelledby="update-toast-title"
				aria-describedby="update-toast-body"
				className="relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0F0D]/95 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl"
			>
				<div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10">
						<Download className="h-4 w-4 text-[#F59E0B]" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-2">
							<h1 id="update-toast-title" className="min-w-0 truncate text-sm font-semibold">
								{buildUpdateTitle(state, t)}
							</h1>
							{state.experimentalUpdatesEnabled ? (
								<span className="shrink-0 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#F59E0B]">
									{t("updates.popup.experimentalBadge", "Experimental")}
								</span>
							) : null}
						</div>
						<p id="update-toast-body" className="mt-0.5 text-xs leading-5 text-slate-400">
							{buildUpdateBody(state, t)}
						</p>
					</div>
					<button
						type="button"
						aria-label={t("updates.popup.updateLater")}
						onClick={() => void window.electronAPI.updateLaterForSession()}
						className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>

				{state.status === "downloading" ? (
					<div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
						<div
							className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#d97706] transition-[width] duration-300"
							style={{ width: formatProgress(state.progress) }}
						/>
					</div>
				) : null}

				{busy && (state.status === "available" || state.status === "downloaded") ? (
					<div className="flex items-start gap-2 text-[11px] leading-4 text-amber-300">
						<AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
						<span>{t("updates.popup.busyHint")}</span>
					</div>
				) : null}

				<div className="flex flex-wrap items-center justify-end gap-2">
					<button
						type="button"
						onClick={() => void window.electronAPI.skipUpdateVersion()}
						className="mr-auto rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
					>
						{t("updates.popup.skipVersion")}
					</button>
					<button
						type="button"
						onClick={() => void window.electronAPI.updateLaterForSession()}
						className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
					>
						{t("updates.popup.updateLater")}
					</button>
					<button
						type="button"
						onClick={() => void handleUpdateNow()}
						disabled={updateNowDisabled}
						className="rounded-lg bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-[#d97706] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{t("updates.popup.updateNow")}
					</button>
				</div>
			</div>
		</div>
	);
}
