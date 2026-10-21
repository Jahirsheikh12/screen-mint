import { Keyboard, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	DEFAULT_SHORTCUTS,
	FIXED_SHORTCUTS,
	findConflict,
	formatBinding,
	SHORTCUT_ACTIONS,
	SHORTCUT_LABELS,
	type ShortcutAction,
	type ShortcutBinding,
	type ShortcutConflict,
	type ShortcutsConfig,
} from "@/lib/shortcuts";
import { useScopedT } from "../../contexts/I18nContext";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

export function ShortcutsConfigDialog() {
	const t = useScopedT("dialogs");
	const tShortcuts = useScopedT("shortcuts");
	const { shortcuts, isMac, isConfigOpen, closeConfig, setShortcuts, persistShortcuts } =
		useShortcuts();

	const [draft, setDraft] = useState<ShortcutsConfig>(shortcuts);
	const [captureFor, setCaptureFor] = useState<ShortcutAction | null>(null);
	const [conflict, setConflict] = useState<{
		forAction: ShortcutAction;
		pending: ShortcutBinding;
		conflictWith: ShortcutConflict;
	} | null>(null);

	useEffect(() => {
		if (isConfigOpen) {
			setDraft(shortcuts);
			setCaptureFor(null);
			setConflict(null);
		}
	}, [isConfigOpen, shortcuts]);

	useEffect(() => {
		if (!captureFor) return;

		const handleCapture = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();

			if (e.key === "Escape") {
				setCaptureFor(null);
				return;
			}

			if (MODIFIER_KEYS.has(e.key)) return;

			const binding: ShortcutBinding = {
				key: e.key.toLowerCase(),
				...(e.ctrlKey || e.metaKey ? { ctrl: true } : {}),
				...(e.shiftKey ? { shift: true } : {}),
				...(e.altKey ? { alt: true } : {}),
			};

			const found = findConflict(binding, captureFor, draft);
			setCaptureFor(null);

			if (found?.type === "fixed") {
				toast.error(t("shortcutsConfig.reserved", undefined, { label: found.label }));
				return;
			}

			if (found?.type === "configurable") {
				setConflict({ forAction: captureFor, pending: binding, conflictWith: found });
				return;
			}

			setDraft((prev: ShortcutsConfig) => ({ ...prev, [captureFor]: binding }));
		};

		window.addEventListener("keydown", handleCapture, { capture: true });
		return () => window.removeEventListener("keydown", handleCapture, { capture: true });
	}, [captureFor, draft, t]);

	const handleSwap = useCallback(() => {
		if (!conflict || conflict.conflictWith.type !== "configurable") return;
		const { forAction, pending, conflictWith } = conflict;
		setDraft((prev: ShortcutsConfig) => ({
			...prev,
			[forAction]: pending,
			[conflictWith.action]: prev[forAction],
		}));
		setConflict(null);
	}, [conflict]);

	const handleCancelConflict = useCallback(() => setConflict(null), []);

	const handleSave = useCallback(async () => {
		setShortcuts(draft);
		await persistShortcuts(draft);
		toast.success(t("shortcutsConfig.saved"));
		closeConfig();
	}, [draft, setShortcuts, persistShortcuts, closeConfig, t]);

	const handleReset = useCallback(() => {
		setDraft({ ...DEFAULT_SHORTCUTS });
		toast.info(t("shortcutsConfig.resetNotice"));
	}, [t]);

	const handleClose = useCallback(() => {
		setCaptureFor(null);
		setConflict(null);
		closeConfig();
	}, [closeConfig]);

	return (
		<Dialog
			open={isConfigOpen}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<DialogContent className="bg-canvas border-line-strong text-fg max-w-[480px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-body">
						<Keyboard className="w-4 h-4 text-accent-fg" />
						{t("shortcutsConfig.title")}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-0.5">
					<p className="text-micro text-fg-subtle mb-2 uppercase tracking-wide font-semibold">
						{t("shortcutsConfig.configurable")}
					</p>
					{SHORTCUT_ACTIONS.map((action) => {
						const isCapturing = captureFor === action;
						const hasConflict = conflict?.forAction === action;
						return (
							<div key={action}>
								<div className="flex items-center justify-between gap-3 py-1.5 px-1 border-b border-line">
									<span className="min-w-0 break-words text-body text-fg-muted">
										{tShortcuts(`actions.${action}`, SHORTCUT_LABELS[action])}
									</span>
									<button
										type="button"
										onClick={() => {
											setConflict(null);
											setCaptureFor(isCapturing ? null : action);
										}}
										title={
											isCapturing
												? t("shortcutsConfig.pressEscToCancel")
												: t("shortcutsConfig.clickToChange")
										}
										className={[
											"shrink-0 px-2 py-1 rounded text-label font-mono border transition-all min-w-[90px] text-center select-none",
											isCapturing
												? "bg-accent/20 border-accent text-accent-fg animate-pulse"
												: hasConflict
													? "bg-accent/10 border-accent/50 text-accent-fg"
													: "bg-fill-subtle border-line-strong text-fg hover:border-accent/50 hover:text-accent-fg cursor-pointer",
										].join(" ")}
									>
										{isCapturing
											? t("shortcutsConfig.pressAKey")
											: formatBinding(draft[action], isMac)}
									</button>
								</div>
								{hasConflict && conflict?.conflictWith.type === "configurable" && (
									<div className="flex items-center justify-between px-1 py-1.5 mb-0.5 bg-accent/10 border border-accent/20 rounded text-label">
										<span className="text-accent-fg">
											{t("shortcutsConfig.alreadyUsedBy", undefined, {
												action: SHORTCUT_LABELS[conflict.conflictWith.action],
											})}
										</span>
										<div className="flex gap-1.5">
											<button
												type="button"
												onClick={handleSwap}
												className="px-2 py-0.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded text-accent-fg font-medium transition-colors"
											>
												{t("shortcutsConfig.swap")}
											</button>
											<button
												type="button"
												onClick={handleCancelConflict}
												className="px-2 py-0.5 bg-fill-subtle hover:bg-fill-hover border border-line-strong rounded text-fg-muted transition-colors"
											>
												{t("shortcutsConfig.cancel")}
											</button>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>

				<div className="space-y-0.5 mt-2">
					<p className="text-micro text-fg-subtle mb-2 uppercase tracking-wide font-semibold">
						{t("shortcutsConfig.fixed")}
					</p>
					{FIXED_SHORTCUTS.map(({ label, display, key }) => (
						<div
							key={label}
							className="flex items-center justify-between gap-3 py-1.5 px-1 border-b border-line last:border-0"
						>
							<span className="min-w-0 break-words text-body text-fg-muted">
								{tShortcuts(`actions.${key}`, label)}
							</span>
							<kbd className="shrink-0 px-2 py-1 bg-fill-subtle border border-line-strong rounded text-label font-mono text-fg-muted min-w-[90px] text-center">
								{display}
							</kbd>
						</div>
					))}
				</div>

				<p className="text-micro text-fg-subtle mt-1">{t("shortcutsConfig.instructions")}</p>

				<DialogFooter className="flex flex-wrap gap-2 sm:justify-between mt-2">
					<Button
						variant="ghost"
						size="sm"
						className="text-fg-muted hover:text-fg gap-1.5"
						onClick={handleReset}
					>
						<RotateCcw className="w-3 h-3" />
						{t("shortcutsConfig.resetToDefaults")}
					</Button>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={handleClose}>
							{t("shortcutsConfig.cancel")}
						</Button>
						<Button
							size="sm"
							className="bg-accent hover:bg-accent-hover text-on-accent"
							onClick={handleSave}
						>
							{t("shortcutsConfig.save")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
