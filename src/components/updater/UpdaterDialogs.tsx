import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
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

	const canRenderDialogs = windowType === "editor";
	const showWhatsNewDialog = canRenderDialogs && state.showWhatsNew;

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

	const whatsNewTitle = t("updates.whatsNew.title", undefined, {
		version: state.whatsNewVersion ?? state.currentVersion,
	});

	// Update prompts live in the separate update-toast window (UpdateToast).
	return (
		<>
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

						<DialogFooter className="mt-6 flex flex-wrap gap-2 sm:justify-end sm:space-x-0">
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
