import { ChevronDown, ChevronUp, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ColorPicker } from "../ColorPicker";
import {
	DEFAULT_FRAME_BORDER_OPACITY,
	DEFAULT_FRAME_BORDER_WIDTH,
	DEFAULT_FRAME_SHADOW_BLUR,
	DEFAULT_FRAME_SHADOW_OPACITY,
	DEFAULT_FRAME_SHADOW_SIZE,
} from "../frameEffects";
import { KeyboardShortcutsHelp } from "../KeyboardShortcutsHelp";
import { DEFAULT_VIDEO_PREVIEW_PADDING } from "../projectPersistence";
import { SliderControl } from "../SliderControl";
import { SettingsSection, TabContent, TabHeader } from "../settingsPanelLayout";
import { DEFAULT_ZOOM_MOTION_BLUR, PREVIEW_QUALITY_OPTIONS, type PreviewQuality } from "../types";

type SettingsTranslator = (key: string, fallback?: string) => string;

interface EffectsSettingsTabProps {
	tSettings: SettingsTranslator;
	previewQuality: PreviewQuality;
	onPreviewQualityChange?: (quality: PreviewQuality) => void;
	connectZooms: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	hideBackground: boolean;
	onHideBackgroundChange?: (hidden: boolean) => void;
	backgroundBlur: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlur: number;
	onZoomMotionBlurChange?: (amount: number) => void;
	showAdvancedShadowSettings: boolean;
	onToggleAdvancedShadowSettings: () => void;
	frameShadowSize: number;
	onFrameShadowSizeChange?: (size: number) => void;
	frameShadowOpacity: number;
	onFrameShadowOpacityChange?: (opacity: number) => void;
	frameShadowBlur: number;
	onFrameShadowBlurChange?: (blur: number) => void;
	frameBorderEnabled: boolean;
	onFrameBorderEnabledChange?: (enabled: boolean) => void;
	frameBorderWidth: number;
	onFrameBorderWidthChange?: (width: number) => void;
	frameBorderColor: string;
	onFrameBorderColorChange?: (color: string) => void;
	frameBorderOpacity: number;
	onFrameBorderOpacityChange?: (opacity: number) => void;
	borderRadius: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding: number;
	onPaddingChange?: (padding: number) => void;
	onCropToggle: () => void;
}

export function EffectsSettingsTab({
	tSettings,
	previewQuality,
	onPreviewQualityChange,
	connectZooms,
	onConnectZoomsChange,
	hideBackground,
	onHideBackgroundChange,
	backgroundBlur,
	onBackgroundBlurChange,
	zoomMotionBlur,
	onZoomMotionBlurChange,
	showAdvancedShadowSettings,
	onToggleAdvancedShadowSettings,
	frameShadowSize,
	onFrameShadowSizeChange,
	frameShadowOpacity,
	onFrameShadowOpacityChange,
	frameShadowBlur,
	onFrameShadowBlurChange,
	frameBorderEnabled,
	onFrameBorderEnabledChange,
	frameBorderWidth,
	onFrameBorderWidthChange,
	frameBorderColor,
	onFrameBorderColorChange,
	frameBorderOpacity,
	onFrameBorderOpacityChange,
	borderRadius,
	onBorderRadiusChange,
	padding,
	onPaddingChange,
	onCropToggle,
}: EffectsSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("effects.title")}
				description="Control visual effects, transitions, and frame properties"
				trailing={<KeyboardShortcutsHelp />}
			/>

			<SettingsSection
				title={tSettings("previewQuality.title")}
				description={tSettings("previewQuality.description")}
			>
				<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
					<div className="grid grid-cols-3 gap-1.5">
						{PREVIEW_QUALITY_OPTIONS.map((option) => {
							const isActive = previewQuality === option.value;
							return (
								<Button
									key={option.value}
									type="button"
									onClick={() => onPreviewQualityChange?.(option.value)}
									className={cn(
										"h-10 rounded-xl border shadow-sm transition-all justify-center",
										"duration-200 ease-out",
										isActive
											? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25"
											: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:border-white/[0.1] hover:text-slate-200",
									)}
								>
									<span className="text-xs font-semibold">
										{tSettings(`previewQuality.options.${option.value}`)}
									</span>
								</Button>
							);
						})}
					</div>
					<p className="mt-2 text-[10px] leading-relaxed text-slate-500">
						{tSettings("previewQuality.helper")}
					</p>
				</div>
			</SettingsSection>

			<SettingsSection
				title="Transitions"
				description="How zoom transitions connect and blend together"
			>
				<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("effects.connectZooms")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">
							Smoothly link adjacent zoom regions
						</div>
					</div>
					<Switch
						checked={connectZooms}
						onCheckedChange={onConnectZoomsChange}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>
				<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("effects.removeBackground")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">
							Hide wallpaper, color, and gradient backgrounds
						</div>
					</div>
					<Switch
						checked={hideBackground}
						onCheckedChange={(checked) => onHideBackgroundChange?.(checked)}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>
			</SettingsSection>

			<SettingsSection
				title="Visual Effects"
				description="Fine-tune blur, shadow, and motion effects"
			>
				<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<SliderControl
						label={tSettings("effects.backgroundBlur")}
						value={backgroundBlur}
						defaultValue={0}
						min={0}
						max={8}
						step={0.25}
						onChange={(value) => onBackgroundBlurChange?.(value)}
						formatValue={(value) => `${value.toFixed(1)}px`}
						parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
					/>
				</div>
				<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<SliderControl
						label={tSettings("effects.zoomMotionBlur")}
						value={zoomMotionBlur}
						defaultValue={DEFAULT_ZOOM_MOTION_BLUR}
						min={0}
						max={2}
						step={0.05}
						onChange={(value) => onZoomMotionBlurChange?.(value)}
						formatValue={(value) => `${value.toFixed(2)}×`}
						parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
					/>
				</div>
				<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] transition-colors duration-200 hover:bg-white/[0.06]">
					<button
						type="button"
						onClick={onToggleAdvancedShadowSettings}
						className="flex w-full items-center justify-between px-3 py-2.5 text-left"
					>
						<div>
							<div className="text-[11px] font-medium text-slate-200">
								{tSettings("effects.advancedShadowSettings")}
							</div>
							<div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
								{tSettings("effects.advancedShadowDescription")}
							</div>
						</div>
						{showAdvancedShadowSettings ? (
							<ChevronUp className="h-3.5 w-3.5 text-slate-400" />
						) : (
							<ChevronDown className="h-3.5 w-3.5 text-slate-400" />
						)}
					</button>
					{showAdvancedShadowSettings && (
						<div className="flex flex-col gap-1.5 border-t border-white/[0.06] px-2.5 py-2.5">
							<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label={tSettings("effects.shadowSize")}
									value={frameShadowSize}
									defaultValue={DEFAULT_FRAME_SHADOW_SIZE}
									min={0}
									max={48}
									step={0.5}
									onChange={(value) => onFrameShadowSizeChange?.(value)}
									formatValue={(value) => `${value.toFixed(1)}px`}
									parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
								/>
							</div>
							<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label={tSettings("effects.shadowOpacity")}
									value={frameShadowOpacity}
									defaultValue={DEFAULT_FRAME_SHADOW_OPACITY}
									min={0}
									max={1}
									step={0.01}
									onChange={(value) => onFrameShadowOpacityChange?.(value)}
									formatValue={(value) => `${Math.round(value * 100)}%`}
									parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
								/>
							</div>
							<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label={tSettings("effects.shadowBlur")}
									value={frameShadowBlur}
									defaultValue={DEFAULT_FRAME_SHADOW_BLUR}
									min={0}
									max={96}
									step={1}
									onChange={(value) => onFrameShadowBlurChange?.(value)}
									formatValue={(value) => `${Math.round(value)}px`}
									parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
								/>
							</div>
						</div>
					)}
				</div>
			</SettingsSection>

			<SettingsSection title="Frame" description="Adjust the recording frame shape and spacing">
				<div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.06]">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="text-[11px] font-medium text-slate-200">
								{tSettings("effects.border")}
							</div>
							<div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
								{tSettings("effects.borderDescription")}
							</div>
						</div>
						<Switch
							checked={frameBorderEnabled}
							onCheckedChange={(checked) => onFrameBorderEnabledChange?.(checked)}
							className="data-[state=checked]:bg-[#3b82f6]"
						/>
					</div>
				</div>
				{frameBorderEnabled && (
					<>
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<SliderControl
								label={tSettings("effects.borderWidth")}
								value={frameBorderWidth}
								defaultValue={DEFAULT_FRAME_BORDER_WIDTH}
								min={0}
								max={20}
								step={1}
								onChange={(value) => onFrameBorderWidthChange?.(value)}
								formatValue={(value) => `${Math.round(value)}px`}
								parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
							/>
						</div>
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<label className="mb-2 block text-xs font-medium text-slate-300">
								{tSettings("effects.borderColor")}
							</label>
							<ColorPicker
								color={frameBorderColor}
								onChange={(color) => onFrameBorderColorChange?.(color.hex)}
								colors={[
									"#000000",
									"#FFFFFF",
									"#F59E0B",
									"#3B82F6",
									"#22C55E",
									"#EF4444",
									"#A855F7",
									"#F97316",
								]}
							/>
						</div>
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<SliderControl
								label={tSettings("effects.borderOpacity")}
								value={frameBorderOpacity}
								defaultValue={DEFAULT_FRAME_BORDER_OPACITY}
								min={0}
								max={1}
								step={0.01}
								onChange={(value) => onFrameBorderOpacityChange?.(value)}
								formatValue={(value) => `${Math.round(value * 100)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
							/>
						</div>
					</>
				)}
				<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<SliderControl
						label={tSettings("effects.roundness")}
						value={borderRadius}
						defaultValue={12.5}
						min={0}
						max={25}
						step={0.5}
						onChange={(value) => onBorderRadiusChange?.(value)}
						formatValue={(value) => `${value}px`}
						parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
					/>
				</div>
				<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<SliderControl
						label={tSettings("effects.padding")}
						value={padding}
						defaultValue={DEFAULT_VIDEO_PREVIEW_PADDING}
						min={0}
						max={100}
						step={1}
						onChange={(value) => onPaddingChange?.(value)}
						formatValue={(value) => `${value}%`}
						parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
					/>
				</div>
				<Button
					onClick={onCropToggle}
					variant="outline"
					className="w-full gap-2 bg-white/[0.04] text-slate-200 border-white/[0.08] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 hover:text-[#F59E0B] text-[10px] h-9 rounded-xl transition-all duration-200"
				>
					<Crop className="w-3.5 h-3.5" />
					{tSettings("crop.title")}
				</Button>
			</SettingsSection>
		</TabContent>
	);
}
