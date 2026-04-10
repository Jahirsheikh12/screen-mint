import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ConfirmDialogState } from "./editorSession";

interface PresetNameDialogProps {
	isOpen: boolean;
	name: string;
	onNameChange: (name: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
}

export function PresetNameDialog({
	isOpen,
	name,
	onNameChange,
	onCancel,
	onConfirm,
}: PresetNameDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent className="border-white/10 bg-[#0A0F0D] text-white sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Save Preset</DialogTitle>
					<DialogDescription className="text-slate-400">
						Give this preset a clear name so it is easy to reuse later.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<label htmlFor="preset-name" className="text-sm font-medium text-slate-200">
						Preset name
					</label>
					<Input
						id="preset-name"
						value={name}
						onChange={(event) => onNameChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && name.trim().length > 0) {
								onConfirm();
							}
						}}
						autoFocus
						placeholder="My preset"
						className="border-white/10 bg-white/[0.04] text-white"
					/>
				</div>
				<DialogFooter>
					<Button variant="secondary" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						disabled={name.trim().length === 0}
						className="bg-[#F59E0B] text-black hover:bg-[#d97706]"
					>
						Save preset
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface ConfirmActionDialogProps {
	dialog: ConfirmDialogState | null;
	onCancel: () => void;
	onConfirm: () => void;
}

export function ConfirmActionDialog({ dialog, onCancel, onConfirm }: ConfirmActionDialogProps) {
	return (
		<Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent className="border-white/10 bg-[#0A0F0D] text-white sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{dialog?.title ?? "Confirm action"}</DialogTitle>
					<DialogDescription className="whitespace-pre-line text-slate-400">
						{dialog?.description ?? ""}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="secondary" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						onClick={onConfirm}
						className={
							dialog?.tone === "danger"
								? "bg-red-500 text-white hover:bg-red-600"
								: "bg-[#F59E0B] text-black hover:bg-[#d97706]"
						}
					>
						{dialog?.confirmLabel ?? "Continue"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
