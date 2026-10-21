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
			<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
				<ShieldAlert size={22} className="text-amber-400" />
			</div>
			<div className="max-w-md space-y-2">
				<h3 className="text-sm font-semibold text-white/90">{title}</h3>
				<p className="text-xs leading-5 text-white/55">{description}</p>
				{hint ? <p className="mt-1 text-[11px] leading-5 text-amber-300/80">{hint}</p> : null}
			</div>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{onOpenSettings ? (
					<Button
						type="button"
						onClick={onOpenSettings}
						className="bg-[#F59E0B] text-white hover:bg-[#F59E0B]/85"
					>
						{openSettingsLabel}
					</Button>
				) : null}
				{onRetry ? (
					<Button
						type="button"
						variant="outline"
						onClick={onRetry}
						className="border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
					>
						{retryLabel}
					</Button>
				) : null}
			</div>
			{details ? (
				<div className="max-w-md rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left">
					<p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
						{t("permissions.diagnostics")}
					</p>
					<p className="mt-1 break-words font-mono text-[11px] leading-5 text-white/50">
						{details}
					</p>
				</div>
			) : null}
		</div>
	);
}
