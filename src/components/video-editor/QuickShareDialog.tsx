import { Copy, Download, Edit3, X } from "lucide-react";

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
	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={onClose} />
			<div className="fixed left-1/2 top-1/2 z-[9999] w-[92vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0a0f0d] p-6 text-white shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<div className="text-lg font-semibold text-white">Quick Share</div>
						<div className="mt-1 text-sm text-slate-400">
							Choose what to do with this recording next.
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<button
						type="button"
						onClick={onSave}
						className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
					>
						<Download className="mb-3 h-5 w-5 text-amber-400" />
						<div className="text-sm font-semibold text-white">Save</div>
						<div className="mt-1 text-xs text-slate-400">Export and save to a file.</div>
					</button>
					<button
						type="button"
						onClick={onCopy}
						className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
					>
						<Copy className="mb-3 h-5 w-5 text-sky-400" />
						<div className="text-sm font-semibold text-white">Copy</div>
						<div className="mt-1 text-xs text-slate-400">
							Export locally and copy the saved file path.
						</div>
					</button>
					<button
						type="button"
						onClick={onEdit}
						className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
					>
						<Edit3 className="mb-3 h-5 w-5 text-amber-400" />
						<div className="text-sm font-semibold text-white">Edit</div>
						<div className="mt-1 text-xs text-slate-400">Open the recording in the editor.</div>
					</button>
				</div>
			</div>
		</>
	);
}
