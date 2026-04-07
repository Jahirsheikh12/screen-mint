import { Button } from "../ui/button";

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
	return (
		<div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
			<div className="max-w-md space-y-2">
				<h3 className="text-sm font-semibold text-white/90">{title}</h3>
				<p className="text-xs leading-5 text-white/55">{description}</p>
				{hint ? <p className="text-[11px] leading-5 text-amber-300/80">{hint}</p> : null}
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
					<p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Diagnostics</p>
					<p className="mt-1 break-words font-mono text-[11px] leading-5 text-white/50">
						{details}
					</p>
				</div>
			) : null}
		</div>
	);
}
