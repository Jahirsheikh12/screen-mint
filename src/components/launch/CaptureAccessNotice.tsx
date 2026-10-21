import { ShieldAlert } from "lucide-react";
import { useScopedT } from "@/contexts/I18nContext";
import { Button } from "../ui/button";
import styles from "./LaunchWindow.module.css";

type CaptureAccessNoticeProps = {
	title: string;
	description: string;
	hint?: string;
	details?: string | null;
	onOpenSettings?: () => void;
	onRetry?: () => void;
	openSettingsLabel?: string;
	retryLabel?: string;
};

export function CaptureAccessNotice({
	title,
	description,
	hint,
	details,
	onOpenSettings,
	onRetry,
	openSettingsLabel = "Open Settings",
	retryLabel = "Retry",
}: CaptureAccessNoticeProps) {
	const t = useScopedT("launch");
	return (
		<div
			className={`flex flex-col items-center gap-5 px-6 py-8 text-center ${styles.overlayEnter}`}
		>
			<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
				<ShieldAlert size={22} className="text-accent-fg" />
			</div>
			<div className="max-w-md space-y-2">
				<h3 className="text-body font-semibold text-fg">{title}</h3>
				<p className="text-label leading-5 text-fg-subtle">{description}</p>
				{hint ? <p className="mt-1 text-caption leading-5 text-accent-fg/80">{hint}</p> : null}
			</div>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{onOpenSettings ? (
					<Button
						type="button"
						onClick={onOpenSettings}
						className="bg-accent text-on-accent hover:bg-accent/85"
					>
						{openSettingsLabel}
					</Button>
				) : null}
				{onRetry ? (
					<Button
						type="button"
						variant="outline"
						onClick={onRetry}
						className="border-line-strong bg-fill-subtle text-fg-muted hover:bg-fill-hover"
					>
						{retryLabel}
					</Button>
				) : null}
			</div>
			{details ? (
				<div className="max-w-md rounded-lg border border-line-strong bg-fill-subtle px-3 py-2 text-left">
					<p className="text-micro uppercase tracking-[0.18em] text-fg-subtle">
						{t("permissions.diagnostics")}
					</p>
					<p className="mt-1 break-words font-mono text-caption leading-5 text-fg-subtle">
						{details}
					</p>
				</div>
			) : null}
		</div>
	);
}
