import { Bug, ExternalLink, Github, Lightbulb, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useScopedT } from "@/contexts/I18nContext";

const REPOSITORY_URL = "https://github.com/Jahirsheikh12/screen-mint";

const FEEDBACK_LINKS = [
	{ key: "reportBug", icon: Bug, url: `${REPOSITORY_URL}/issues/new?labels=bug` },
	{
		key: "suggestFeature",
		icon: Lightbulb,
		url: `${REPOSITORY_URL}/issues/new?labels=enhancement`,
	},
	{ key: "viewSource", icon: Github, url: REPOSITORY_URL },
] as const;

/** Header button + dialog with the project's contact and issue links. */
export function FeedbackDialog() {
	const t = useScopedT("editor");
	const [open, setOpen] = useState(false);

	const openLink = async (url: string) => {
		try {
			const result = await window.electronAPI.openExternalUrl(url);
			if (!result.success) throw new Error(result.error);
		} catch {
			toast.error(t("feedback.openFailed", "Couldn't open the link."));
		}
	};

	return (
		<>
			<Tooltip content={t("feedback.trigger", "Feedback")} side="bottom">
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-label={t("feedback.trigger", "Feedback")}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-fill-hover hover:text-fg cursor-pointer"
				>
					<MessageSquare className="h-4 w-4" />
				</button>
			</Tooltip>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-[400px] gap-4 border-line-strong bg-canvas text-fg">
					<DialogHeader className="text-left">
						<DialogTitle>{t("feedback.title", "Feedback & contact")}</DialogTitle>
						<DialogDescription className="text-fg-muted">
							{t(
								"feedback.description",
								"Found a bug or missing something? Tell us on GitHub — every report helps.",
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						{FEEDBACK_LINKS.map(({ key, icon: Icon, url }) => (
							<button
								key={key}
								type="button"
								onClick={() => void openLink(url)}
								className="flex min-w-0 items-center gap-3 rounded-xl border border-line-strong bg-fill-subtle px-3.5 py-3 text-left transition hover:border-accent/40 hover:bg-accent/10 cursor-pointer"
							>
								<Icon className="h-4 w-4 shrink-0 text-accent-fg" />
								<span className="min-w-0 flex-1">
									<span className="block break-words text-body font-medium text-fg">
										{t(`feedback.${key}`)}
									</span>
									<span className="block break-words text-label text-fg-muted">
										{t(`feedback.${key}Hint`)}
									</span>
								</span>
								<ExternalLink className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
							</button>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
