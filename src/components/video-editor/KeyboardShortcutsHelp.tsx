import { HelpCircle, Settings2 } from "lucide-react";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	FIXED_SHORTCUTS,
	formatBinding,
	formatFixedShortcut,
	keyLabelTranslationKey,
	SHORTCUT_ACTIONS,
	SHORTCUT_LABELS,
} from "@/lib/shortcuts";

const KBD_CLASS =
	"shrink-0 px-1 py-0.5 bg-fill-subtle border border-line-strong rounded text-accent-fg font-mono";

export function KeyboardShortcutsHelp() {
	const { shortcuts, isMac, openConfig } = useShortcuts();
	const t = useScopedT("editor");
	const tShortcuts = useScopedT("shortcuts");
	const keyLabel = (key: string, fallback: string) =>
		tShortcuts(keyLabelTranslationKey(key), fallback);

	return (
		<div className="relative group">
			<HelpCircle className="w-4 h-4 text-fg-subtle hover:text-accent-fg transition-colors cursor-help" />

			<div className="absolute right-0 top-full mt-2 w-72 bg-raised shadow-popover rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
				<div className="flex items-center justify-between mb-2">
					<span className="text-label font-semibold text-fg">{t("keyboardShortcuts.title")}</span>
					<button
						type="button"
						onClick={openConfig}
						title={t("keyboardShortcuts.customizeTooltip")}
						className="flex items-center gap-1 text-micro text-fg-subtle hover:text-accent-fg transition-colors"
					>
						<Settings2 className="w-3 h-3" />
						{t("keyboardShortcuts.customize")}
					</button>
				</div>

				<div className="space-y-1.5 text-micro">
					{SHORTCUT_ACTIONS.map((action) => (
						<div key={action} className="flex items-center justify-between gap-2">
							<span className="text-fg-muted">
								{tShortcuts(`actions.${action}`, SHORTCUT_LABELS[action])}
							</span>
							<kbd className={KBD_CLASS}>{formatBinding(shortcuts[action], isMac, keyLabel)}</kbd>
						</div>
					))}

					<div className="pt-1 border-t border-line mt-1 space-y-1.5">
						{FIXED_SHORTCUTS.map((fixed) => (
							<div key={fixed.key} className="flex items-center justify-between gap-2">
								<span className="text-fg-muted">
									{tShortcuts(`actions.${fixed.key}`, fixed.label)}
								</span>
								<kbd className={KBD_CLASS}>{formatFixedShortcut(fixed, isMac, keyLabel)}</kbd>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
