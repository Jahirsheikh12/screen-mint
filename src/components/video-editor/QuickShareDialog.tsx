import { Copy, Download, Edit3, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

type QuickShareDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	onSave: () => void;
	onCopy: () => void;
	onEdit: () => void;
};

export function QuickShareDialog({
	isOpen,
	onClose,
	onSave,
	onCopy,
	onEdit,
}: QuickShareDialogProps) {
	const { t } = useI18n();
	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="fixed inset-0 z-[9998] bg-scrim/50 backdrop-blur-[2px]" onClick={onClose} />
			<div
				role="dialog"
				aria-modal="true"
				className="fixed left-1/2 top-1/2 z-[9999] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-raised p-6 text-fg shadow-dialog"
			>
				<div className="mb-5 flex items-center justify-between">
					<div>
						<div className="text-heading font-semibold text-fg">
							{t("dialogs.quickShare.quickShare", "Quick Share")}
						</div>
						<div className="mt-1 text-body text-fg-muted">
							{t(
								"dialogs.quickShare.chooseWhatToDo",
								"Choose what to do with this recording next.",
							)}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full p-2 text-fg-muted transition hover:bg-fill-hover hover:text-fg"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<button
						type="button"
						onClick={onSave}
						className="rounded-lg border border-line bg-fill-subtle p-4 text-left transition hover:bg-fill-hover"
					>
						<Download className="mb-3 h-5 w-5 text-accent-fg" />
						<div className="text-body font-semibold text-fg">
							{t("dialogs.quickShare.save", "Save")}
						</div>
						<div className="mt-1 text-label text-fg-muted">
							{t("dialogs.quickShare.exportAndSaveTo", "Export and save to a file.")}
						</div>
					</button>
					<button
						type="button"
						onClick={onCopy}
						className="rounded-lg border border-line bg-fill-subtle p-4 text-left transition hover:bg-fill-hover"
					>
						<Copy className="mb-3 h-5 w-5 text-info-fg" />
						<div className="text-body font-semibold text-fg">
							{t("dialogs.quickShare.copy", "Copy")}
						</div>
						<div className="mt-1 text-label text-fg-muted">
							{t(
								"dialogs.quickShare.exportLocallyAndCopy",
								"Export locally and copy the saved file path.",
							)}
						</div>
					</button>
					<button
						type="button"
						onClick={onEdit}
						className="rounded-lg border border-line bg-fill-subtle p-4 text-left transition hover:bg-fill-hover"
					>
						<Edit3 className="mb-3 h-5 w-5 text-accent-fg" />
						<div className="text-body font-semibold text-fg">
							{t("dialogs.quickShare.edit", "Edit")}
						</div>
						<div className="mt-1 text-label text-fg-muted">
							{t("dialogs.quickShare.openTheRecordingIn", "Open the recording in the editor.")}
						</div>
					</button>
				</div>
			</div>
		</>
	);
}
