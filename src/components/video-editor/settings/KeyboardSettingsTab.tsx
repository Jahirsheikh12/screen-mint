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
				description="Show keyboard shortcuts used during recording"
			/>

			<SettingsSection title="Display" description="Toggle keyboard shortcut overlay visibility">
				<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("keyboard.showShortcuts")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">
							Overlay shortcut keys in the video
						</div>
					</div>
					<Switch
						checked={showKeyboardShortcuts}
						onCheckedChange={onShowKeyboardShortcutsChange}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>
			</SettingsSection>

			<DisabledSettingsGroup disabled={!showKeyboardShortcuts}>
				<SettingsSection title="Layout" description="Position and style of the shortcut display">
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<div className="text-xs font-medium text-slate-300 mb-2">
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
										"px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer",
										keyboardShortcutPosition === option.value
											? "bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
											: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/[0.04]",
									)}
								>
									{tSettings(`keyboard.positions.${option.value}`)}
								</button>
							))}
						</div>
					</div>

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<div className="text-xs font-medium text-slate-300 mb-2">
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
										"px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer",
										keyboardShortcutTheme === option.value
											? "bg-gradient-to-r from-[#F59E0B] to-[#d97706] text-white shadow-sm shadow-[#F59E0B]/20"
											: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 border border-white/[0.04]",
									)}
								>
									{tSettings(`keyboard.themes.${option.value}`)}
								</button>
							))}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection title="Appearance" description="Fine-tune size, opacity, and timing">
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
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
