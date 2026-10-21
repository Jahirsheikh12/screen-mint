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
		<div className="max-h-[320px] overflow-y-auto rounded-2xl border border-line-strong bg-fill-subtle p-4">
			<div className="whitespace-pre-wrap text-body leading-6 text-fg-muted">
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
				<DialogContent className="max-w-2xl overflow-y-auto rounded-2xl border border-line bg-canvas p-0 text-fg shadow-2xl shadow-black/60 [&>button]:text-fg-muted [&>button:hover]:bg-fill-hover [&>button:hover]:text-fg">
					<div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
					<div className="p-6">
						<div className="mb-5 flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
								<Sparkles className="h-5 w-5 text-accent-fg" />
							</div>
							<DialogHeader className="space-y-1 text-left">
								<DialogTitle className="text-lg font-semibold text-fg">{whatsNewTitle}</DialogTitle>
								<DialogDescription className="text-body leading-6 text-fg-muted">
									{state.whatsNewReleaseName || t("updates.whatsNew.intro")}
								</DialogDescription>
							</DialogHeader>
						</div>

						<div className="space-y-4">
							<div className="rounded-2xl border border-line bg-fill-subtle p-4">
								<div className="mb-3 flex items-center justify-between">
									<div className="text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
										{t("updates.whatsNew.intro")}
									</div>
									<div className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-micro font-semibold uppercase tracking-[0.16em] text-accent-fg">
										ScreenMint
									</div>
								</div>
								{renderReleaseNotes(state.whatsNewReleaseNotes, t("updates.whatsNew.fallback"))}
							</div>
						</div>

						<DialogFooter className="mt-6 flex flex-wrap gap-2 sm:justify-end sm:space-x-0">
							<Button
								type="button"
								className="h-10 rounded-xl bg-accent px-4 text-on-accent hover:bg-accent-hover"
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
