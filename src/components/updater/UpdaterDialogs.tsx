import { AlertCircle, Download, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { useUpdaterState } from "@/hooks/useUpdaterState";

type UpdaterDialogsProps = {
	windowType: string;
};

function isBusy(busy: ReturnType<typeof useUpdaterState>["busy"]): boolean {
	return busy.recording || busy.exporting || busy.transcribing;
}

function formatProgress(progress: number | null): string {
	if (typeof progress !== "number") {
		return "0%";
	}

	return `${Math.round(Math.max(0, Math.min(100, progress)))}%`;
}

function buildUpdateBody(
	state: ReturnType<typeof useUpdaterState>,
	t: ReturnType<typeof useScopedT>,
) {
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
		case "available":
		default:
			return state.installMode === "external-installer"
				? t("updates.popup.availableBodyExternal", undefined, { version })
				: t("updates.popup.availableBody", undefined, { version });
	}
}

function buildUpdateTitle(
	state: ReturnType<typeof useUpdaterState>,
	t: ReturnType<typeof useScopedT>,
) {
	switch (state.status) {
		case "downloading":
			return t("updates.popup.downloadingTitle");
		case "downloaded":
			return t("updates.popup.readyTitle");
		default:
			return t("updates.popup.title");
	}
}

function renderReleaseNotes(notes: string | null, fallback: string) {
	return (
		<div className="max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
			<div className="whitespace-pre-wrap text-sm leading-6 text-white/78">
				{notes?.trim() || fallback}
			</div>
		</div>
	);
}

export function UpdaterDialogs({ windowType }: UpdaterDialogsProps) {
	const state = useUpdaterState();
	const t = useScopedT("common");
	const lastToastSignatureRef = useRef<string | null>(null);
	const busy = isBusy(state.busy);

	const canRenderDialogs = windowType === "editor";
	const showUpdateDialog = canRenderDialogs && state.showUpdatePrompt && !state.showWhatsNew;
	const showWhatsNewDialog = canRenderDialogs && state.showWhatsNew;

	const updateTitle = useMemo(() => buildUpdateTitle(state, t), [state, t]);
	const updateBody = useMemo(() => buildUpdateBody(state, t), [state, t]);
	const progressLabel = useMemo(
		() =>
			t("updates.popup.downloadingProgressLabel", undefined, {
				progress: formatProgress(state.progress),
			}),
		[state.progress, t],
	);

	useEffect(() => {
		if (!canRenderDialogs) {
			return;
		}

		const signature = [state.status, state.checkSource ?? "", state.error ?? ""].join(":");
		if (lastToastSignatureRef.current === signature) {
			return;
		}

		lastToastSignatureRef.current = signature;

		if (state.status === "no-update" && state.checkSource === "manual") {
			toast.success(t("updates.upToDate", undefined, { version: state.currentVersion }));
			return;
		}

		if (state.status === "error" && state.checkSource === "manual") {
			toast.error(state.error ?? t("updates.error"));
		}
	}, [canRenderDialogs, state, t]);

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

	const whatsNewTitle = t("updates.whatsNew.title", undefined, {
		version: state.whatsNewVersion ?? state.currentVersion,
	});

	return (
		<>
			<Dialog
				open={showUpdateDialog}
				onOpenChange={(open) => {
					if (!open && showUpdateDialog) {
						void window.electronAPI.updateLaterForSession();
					}
				}}
			>
				<DialogContent className="max-w-[440px] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0A0F0D] p-0 text-white shadow-2xl shadow-black/60 [&>button]:text-slate-400 [&>button:hover]:bg-white/[0.06] [&>button:hover]:text-white">
					<div className="h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
					<div className="p-6">
						<div className="mb-5 flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/10">
								<Download className="h-5 w-5 text-[#F59E0B]" />
							</div>
							<DialogHeader className="space-y-1 text-left">
								<DialogTitle className="text-lg font-semibold text-white">
									{updateTitle}
								</DialogTitle>
								<DialogDescription className="text-sm leading-6 text-slate-400">
									{updateBody}
								</DialogDescription>
							</DialogHeader>
						</div>

						<div className="space-y-4">
							{state.latestVersion ? (
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
									<div className="flex items-center justify-between gap-3">
										<div>
											<div className="text-sm font-semibold text-white">
												{state.releaseName || `ScreenMint ${state.latestVersion}`}
											</div>
											<div className="mt-1 text-xs text-slate-400">
												{t("updates.available", undefined, { version: state.latestVersion })}
											</div>
										</div>
										<div className="rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F59E0B]">
											{state.status === "downloaded"
												? t("updates.popup.readyTitle")
												: state.status === "downloading"
													? t("updates.popup.downloadingTitle")
													: t("updates.popup.title")}
										</div>
									</div>
								</div>
							) : null}

							{state.status === "downloading" ? (
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
									<div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
										<span>{t("updates.popup.downloadingTitle")}</span>
										<span className="text-[#F59E0B]">{formatProgress(state.progress)}</span>
									</div>
									<div className="h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
										<div
											className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#d97706] transition-[width] duration-300"
											style={{ width: formatProgress(state.progress) }}
										/>
									</div>
									<div className="mt-2 text-xs text-slate-400">{progressLabel}</div>
								</div>
							) : null}

							{state.releaseNotes ? (
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
									<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
										{t("updates.whatsNew.intro")}
									</div>
									<div className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-300">
										{state.releaseNotes}
									</div>
								</div>
							) : null}

							{busy && (state.status === "available" || state.status === "downloaded") ? (
								<div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
									<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
									<div>{t("updates.popup.busyHint")}</div>
								</div>
							) : null}
						</div>

						<DialogFooter className="mt-6 flex gap-2 sm:justify-end">
							<Button
								type="button"
								variant="ghost"
								className="h-10 rounded-xl px-3 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 sm:mr-auto"
								onClick={() => {
									void window.electronAPI.skipUpdateVersion();
								}}
							>
								Skip this version
							</Button>
							<Button
								type="button"
								variant="secondary"
								className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-slate-300 hover:bg-white/[0.06] hover:text-white"
								onClick={() => {
									void window.electronAPI.updateLaterForSession();
								}}
							>
								{t("updates.popup.updateLater")}
							</Button>
							<Button
								type="button"
								className="h-10 rounded-xl bg-[#F59E0B] px-4 text-white hover:bg-[#b45309]"
								onClick={() => {
									void handleUpdateNow();
								}}
								disabled={updateNowDisabled}
							>
								{t("updates.popup.updateNow")}
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={showWhatsNewDialog}
				onOpenChange={(open) => {
					if (!open && showWhatsNewDialog) {
						void window.electronAPI.dismissWhatsNew();
					}
				}}
			>
				<DialogContent className="max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0A0F0D] p-0 text-white shadow-2xl shadow-black/60 [&>button]:text-slate-400 [&>button:hover]:bg-white/[0.06] [&>button:hover]:text-white">
					<div className="h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent" />
					<div className="p-6">
						<div className="mb-5 flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/10">
								<Sparkles className="h-5 w-5 text-[#F59E0B]" />
							</div>
							<DialogHeader className="space-y-1 text-left">
								<DialogTitle className="text-lg font-semibold text-white">
									{whatsNewTitle}
								</DialogTitle>
								<DialogDescription className="text-sm leading-6 text-slate-400">
									{state.whatsNewReleaseName || t("updates.whatsNew.intro")}
								</DialogDescription>
							</DialogHeader>
						</div>

						<div className="space-y-4">
							<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
								<div className="mb-3 flex items-center justify-between">
									<div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
										{t("updates.whatsNew.intro")}
									</div>
									<div className="rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F59E0B]">
										ScreenMint
									</div>
								</div>
								{renderReleaseNotes(state.whatsNewReleaseNotes, t("updates.whatsNew.fallback"))}
							</div>
						</div>

						<DialogFooter className="mt-6 flex gap-2 sm:justify-end">
							<Button
								type="button"
								className="h-10 rounded-xl bg-[#F59E0B] px-4 text-white hover:bg-[#b45309]"
								onClick={() => {
									void window.electronAPI.dismissWhatsNew();
								}}
							>
								{t("actions.done")}
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
