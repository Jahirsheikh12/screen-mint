export const SHORTCUT_ACTIONS = [
	"addZoom",
	"addTrim",
	"addSpeed",
	"addAnnotation",
	"addKeyframe",
	"deleteSelected",
	"playPause",
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export interface ShortcutBinding {
	key: string;
	/** Maps to Cmd on macOS, Ctrl on Windows/Linux */
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
}

export type ShortcutsConfig = Record<ShortcutAction, ShortcutBinding>;

export interface FixedShortcut {
	/** Translation key under shortcuts.actions. */
	key: string;
	label: string;
	bindings: ShortcutBinding[];
	/** Extra bindings that apply off macOS only (Ctrl+Y redo). */
	nonMacBindings?: ShortcutBinding[];
}

/** Built into the editor and timeline; not rebindable, so custom shortcuts can't take them. */
export const FIXED_SHORTCUTS: FixedShortcut[] = [
	{ key: "undo", label: "Undo", bindings: [{ key: "z", ctrl: true }] },
	{
		key: "redo",
		label: "Redo",
		bindings: [{ key: "z", ctrl: true, shift: true }],
		nonMacBindings: [{ key: "y", ctrl: true }],
	},
	{ key: "export", label: "Export", bindings: [{ key: "e", ctrl: true }] },
	{ key: "exitTrimMode", label: "Exit Trim Mode", bindings: [{ key: "escape" }] },
	{ key: "cycleForward", label: "Cycle Annotations Forward", bindings: [{ key: "tab" }] },
	{
		key: "cycleBackward",
		label: "Cycle Annotations Backward",
		bindings: [{ key: "tab", shift: true }],
	},
	{
		key: "deleteSelectedAlt",
		label: "Delete Selected (alt)",
		bindings: [{ key: "delete" }, { key: "backspace" }],
	},
	{
		key: "panTimeline",
		label: "Pan Timeline",
		bindings: [{ key: "scroll", ctrl: true, shift: true }],
	},
	{ key: "zoomTimeline", label: "Zoom Timeline", bindings: [{ key: "scroll", ctrl: true }] },
];

export function getFixedBindings(fixed: FixedShortcut, isMac: boolean): ShortcutBinding[] {
	return isMac ? fixed.bindings : [...fixed.bindings, ...(fixed.nonMacBindings ?? [])];
}

export type ShortcutConflict =
	| { type: "configurable"; action: ShortcutAction }
	| { type: "fixed"; key: string; label: string };

export function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
	return (
		a.key.toLowerCase() === b.key.toLowerCase() &&
		!!a.ctrl === !!b.ctrl &&
		!!a.shift === !!b.shift &&
		!!a.alt === !!b.alt
	);
}

export function findConflict(
	binding: ShortcutBinding,
	forAction: ShortcutAction,
	config: ShortcutsConfig,
	isMac = false,
): ShortcutConflict | null {
	for (const fixed of FIXED_SHORTCUTS) {
		if (getFixedBindings(fixed, isMac).some((b) => bindingsEqual(b, binding))) {
			return { type: "fixed", key: fixed.key, label: fixed.label };
		}
	}
	for (const action of SHORTCUT_ACTIONS) {
		if (action !== forAction && bindingsEqual(config[action], binding)) {
			return { type: "configurable", action };
		}
	}
	return null;
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
	addZoom: { key: "z" },
	addTrim: { key: "t" },
	addSpeed: { key: "s" },
	addAnnotation: { key: "a" },
	addKeyframe: { key: "f" },
	deleteSelected: { key: "d", ctrl: true },
	playPause: { key: " " },
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
	addZoom: "Add Zoom",
	addTrim: "Add Trim",
	addSpeed: "Add Speed",
	addAnnotation: "Add Annotation",
	addKeyframe: "Add Keyframe",
	deleteSelected: "Delete Selected",
	playPause: "Play / Pause",
};

export function matchesShortcut(
	e: KeyboardEvent,
	binding: ShortcutBinding,
	isMacPlatform: boolean,
): boolean {
	if (e.key.toLowerCase() !== binding.key.toLowerCase()) return false;

	const primaryMod = isMacPlatform ? e.metaKey : e.ctrlKey;
	if (primaryMod !== !!binding.ctrl) return false;
	// On macOS bindings use Cmd; a stray Ctrl (Ctrl+Z) must not trigger the plain-key binding.
	if (isMacPlatform && e.ctrlKey) return false;
	if (e.shiftKey !== !!binding.shift) return false;
	if (e.altKey !== !!binding.alt) return false;

	return true;
}

// Word labels (Space, Tab, Scroll) can be translated through formatBinding's keyLabel argument.
const KEY_LABELS: Record<string, string> = {
	" ": "Space",
	tab: "Tab",
	scroll: "Scroll",
	delete: "Del",
	backspace: "⌫",
	escape: "Esc",
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
};

export function formatBinding(
	binding: ShortcutBinding,
	isMac: boolean,
	keyLabel: (key: string, fallback: string) => string = (_key, fallback) => fallback,
): string {
	const parts: string[] = [];
	if (binding.ctrl) parts.push(isMac ? "⌘" : "Ctrl");
	if (binding.shift) parts.push(isMac ? "⇧" : "Shift");
	if (binding.alt) parts.push(isMac ? "⌥" : "Alt");
	const label = KEY_LABELS[binding.key];
	parts.push(label ? keyLabel(binding.key, label) : binding.key.toUpperCase());
	return parts.join(" + ");
}

/** shortcuts-namespace key for a key's word label (Space, Tab, Scroll). */
export function keyLabelTranslationKey(key: string): string {
	return `keys.${key === " " ? "space" : key}`;
}

export function formatFixedShortcut(
	fixed: FixedShortcut,
	isMac: boolean,
	keyLabel?: (key: string, fallback: string) => string,
): string {
	return getFixedBindings(fixed, isMac)
		.map((binding) => formatBinding(binding, isMac, keyLabel))
		.join(" / ");
}

export function mergeWithDefaults(partial: Partial<ShortcutsConfig>): ShortcutsConfig {
	const merged = { ...DEFAULT_SHORTCUTS };
	for (const action of SHORTCUT_ACTIONS) {
		if (partial[action]) {
			merged[action] = partial[action] as ShortcutBinding;
		}
	}
	return merged;
}
