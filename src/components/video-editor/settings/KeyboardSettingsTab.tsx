import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SliderControl } from "../SliderControl";
import {
	DisabledSettingsGroup,
	SettingsSection,
	TabContent,
	TabHeader,
} from "../settingsPanelLayout";
import {
	DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS,
	DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE,
	DEFAULT_KEYBOARD_SHORTCUT_OPACITY,
	DEFAULT_KEYBOARD_SHORTCUT_SCALE,
	KEYBOARD_SHORTCUT_POSITION_OPTIONS,
	KEYBOARD_SHORTCUT_THEME_OPTIONS,
	type KeyboardShortcutPosition,
	type KeyboardShortcutTheme,
} from "../types";

type SettingsTranslator = (key: string, fallback?: string) => string;

interface KeyboardSettingsTabProps {
	tSettings: SettingsTranslator;
	showKeyboardShortcuts: boolean;
	onShowKeyboardShortcutsChange?: (enabled: boolean) => void;
	keyboardShortcutPosition: KeyboardShortcutPosition;
	onKeyboardShortcutPositionChange?: (position: KeyboardShortcutPosition) => void;
	keyboardShortcutTheme: KeyboardShortcutTheme;
	onKeyboardShortcutThemeChange?: (theme: KeyboardShortcutTheme) => void;
	keyboardShortcutScale: number;
	onKeyboardShortcutScaleChange?: (scale: number) => void;
	keyboardShortcutOpacity: number;
	onKeyboardShortcutOpacityChange?: (opacity: number) => void;
	keyboardShortcutDisplayMs: number;
	onKeyboardShortcutDisplayMsChange?: (durationMs: number) => void;
	keyboardShortcutMaxVisible: number;
	onKeyboardShortcutMaxVisibleChange?: (count: number) => void;
}

export function KeyboardSettingsTab({
	tSettings,
	showKeyboardShortcuts,
	onShowKeyboardShortcutsChange,
	keyboardShortcutPosition,
	onKeyboardShortcutPositionChange,
	keyboardShortcutTheme,
	onKeyboardShortcutThemeChange,
	keyboardShortcutScale,
	onKeyboardShortcutScaleChange,
	keyboardShortcutOpacity,
	onKeyboardShortcutOpacityChange,
	keyboardShortcutDisplayMs,
	onKeyboardShortcutDisplayMsChange,
	keyboardShortcutMaxVisible,
	onKeyboardShortcutMaxVisibleChange,
}: KeyboardSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("keyboard.title")}
				description={tSettings(
					"keyboardTab.showKeyboardShortcutsUsed",
					"Show keyboard shortcuts used during recording",
				)}
			/>

			<SettingsSection
				title={tSettings("keyboardTab.display", "Display")}
				description={tSettings(
					"keyboardTab.toggleKeyboardShortcutOverlay",
					"Toggle keyboard shortcut overlay visibility",
				)}
			>
				<div className="flex items-center justify-between p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
					<div>
						<div className="text-label font-medium text-fg-muted">
							{tSettings("keyboard.showShortcuts")}
						</div>
						<div className="text-micro text-fg-subtle mt-0.5">
							{tSettings("keyboardTab.overlayShortcutKeysIn", "Overlay shortcut keys in the video")}
						</div>
					</div>
					<Switch checked={showKeyboardShortcuts} onCheckedChange={onShowKeyboardShortcutsChange} />
				</div>
			</SettingsSection>

			<DisabledSettingsGroup disabled={!showKeyboardShortcuts}>
				<SettingsSection
					title={tSettings("keyboardTab.layout", "Layout")}
					description={tSettings(
						"keyboardTab.positionAndStyleOf",
						"Position and style of the shortcut display",
					)}
				>
					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<div className="text-label font-medium text-fg-muted mb-2">
							{tSettings("keyboard.position")}
						</div>
						<div className="grid grid-cols-2 gap-1">
							{KEYBOARD_SHORTCUT_POSITION_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									disabled={!showKeyboardShortcuts}
									onClick={() => onKeyboardShortcutPositionChange?.(option.value)}
									className={cn(
										"px-2 py-1.5 rounded-lg text-micro font-medium transition-all duration-200 cursor-pointer",
										keyboardShortcutPosition === option.value
											? "bg-accent/12 text-accent-fg"
											: "bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:text-fg border border-line",
									)}
								>
									{tSettings(`keyboard.positions.${option.value}`)}
								</button>
							))}
						</div>
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<div className="text-label font-medium text-fg-muted mb-2">
							{tSettings("keyboard.theme")}
						</div>
						<div className="grid grid-cols-3 gap-1">
							{KEYBOARD_SHORTCUT_THEME_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									disabled={!showKeyboardShortcuts}
									onClick={() => onKeyboardShortcutThemeChange?.(option.value)}
									className={cn(
										"px-2 py-1.5 rounded-lg text-micro font-medium transition-all duration-200 cursor-pointer",
										keyboardShortcutTheme === option.value
											? "bg-accent/12 text-accent-fg"
											: "bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:text-fg border border-line",
									)}
								>
									{tSettings(`keyboard.themes.${option.value}`)}
								</button>
							))}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection
					title={tSettings("keyboardTab.appearance", "Appearance")}
					description={tSettings(
						"keyboardTab.fineTuneSizeOpacity",
						"Fine-tune size, opacity, and timing",
					)}
				>
					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<SliderControl
							label={tSettings("keyboard.scale")}
							value={keyboardShortcutScale}
							defaultValue={DEFAULT_KEYBOARD_SHORTCUT_SCALE}
							min={0.5}
							max={2}
							step={0.05}
							onChange={(value) => onKeyboardShortcutScaleChange?.(value)}
							formatValue={(value) => `${value.toFixed(2)}×`}
							parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							disabled={!showKeyboardShortcuts}
						/>
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<SliderControl
							label={tSettings("keyboard.opacity")}
							value={keyboardShortcutOpacity}
							defaultValue={DEFAULT_KEYBOARD_SHORTCUT_OPACITY}
							min={0.05}
							max={1}
							step={0.05}
							onChange={(value) => onKeyboardShortcutOpacityChange?.(value)}
							formatValue={(value) => `${Math.round(value * 100)}%`}
							parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
							disabled={!showKeyboardShortcuts}
						/>
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<SliderControl
							label={tSettings("keyboard.displayDuration")}
							value={keyboardShortcutDisplayMs}
							defaultValue={DEFAULT_KEYBOARD_SHORTCUT_DISPLAY_MS}
							min={250}
							max={4000}
							step={50}
							onChange={(value) => onKeyboardShortcutDisplayMsChange?.(value)}
							formatValue={(value) => `${Math.round(value)}ms`}
							parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
							disabled={!showKeyboardShortcuts}
						/>
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<SliderControl
							label={tSettings("keyboard.maxVisible")}
							value={keyboardShortcutMaxVisible}
							defaultValue={DEFAULT_KEYBOARD_SHORTCUT_MAX_VISIBLE}
							min={1}
							max={3}
							step={1}
							onChange={(value) => onKeyboardShortcutMaxVisibleChange?.(Math.round(value))}
							formatValue={(value) => `${Math.round(value)}`}
							parseInput={(text) => parseInt(text, 10)}
							disabled={!showKeyboardShortcuts}
						/>
					</div>
				</SettingsSection>
			</DisabledSettingsGroup>
		</TabContent>
	);
}
