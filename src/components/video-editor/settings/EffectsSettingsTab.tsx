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
import {
	DisabledSettingsGroup,
	SettingsSection,
	TabContent,
	TabHeader,
} from "../settingsPanelLayout";
import {
	DEFAULT_ZOOM_MOTION_BLUR,
	PADDING_LINKED_MAX,
	PADDING_UNLINKED_VERTICAL_MAX,
	type PaddingSides,
	PREVIEW_QUALITY_OPTIONS,
	type PreviewQuality,
	type ZoomTemporalBlurSettings,
	type ZoomTimingSettings,
} from "../types";
import { ZoomTimingControls } from "./ZoomTimingControls";

type SettingsTranslator = (key: string, fallback?: string) => string;

interface EffectsSettingsTabProps {
	tSettings: SettingsTranslator;
	previewQuality: PreviewQuality;
	onPreviewQualityChange?: (quality: PreviewQuality) => void;
	connectZooms: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	zoomTiming: ZoomTimingSettings;
	onZoomTimingChange?: (timing: ZoomTimingSettings) => void;
	hideBackground: boolean;
	onHideBackgroundChange?: (hidden: boolean) => void;
	backgroundBlur: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlur: number;
	onZoomMotionBlurChange?: (amount: number) => void;
	zoomTemporalBlur: ZoomTemporalBlurSettings;
	onZoomTemporalBlurChange?: (settings: ZoomTemporalBlurSettings) => void;
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
	paddingSides: PaddingSides | null;
	onPaddingSidesChange?: (sides: PaddingSides | null) => void;
	onCropToggle: () => void;
}

export function EffectsSettingsTab({
	tSettings,
	previewQuality,
	onPreviewQualityChange,
	connectZooms,
	onConnectZoomsChange,
	zoomTiming,
	onZoomTimingChange,
	hideBackground,
	onHideBackgroundChange,
	backgroundBlur,
	onBackgroundBlurChange,
	zoomMotionBlur,
	onZoomMotionBlurChange,
	zoomTemporalBlur,
	onZoomTemporalBlurChange,
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
	paddingSides,
	onPaddingSidesChange,
	onCropToggle,
}: EffectsSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("effects.title")}
				description={tSettings(
					"effectsTab.controlVisualEffectsTransitions",
					"Control visual effects, transitions, and frame properties",
				)}
				trailing={<KeyboardShortcutsHelp />}
			/>

			<SettingsSection
				title={tSettings("previewQuality.title")}
				description={tSettings("previewQuality.description")}
			>
				<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
					<div className="grid grid-cols-3 gap-1.5">
						{PREVIEW_QUALITY_OPTIONS.map((option) => {
							const isActive = previewQuality === option.value;
							return (
								<Button
									variant="outline"
									key={option.value}
									type="button"
									onClick={() => onPreviewQualityChange?.(option.value)}
									className={cn(
										"h-10 rounded-lg border shadow-sm transition-all justify-center",
										"duration-200 ease-out",
										isActive
											? "border-accent/50 bg-accent/12 text-accent-fg"
											: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:border-line-strong hover:text-fg",
									)}
								>
									<span className="text-label font-semibold">
										{tSettings(`previewQuality.options.${option.value}`)}
									</span>
								</Button>
							);
						})}
					</div>
					<p className="mt-2 text-micro leading-relaxed text-fg-subtle">
						{tSettings("previewQuality.helper")}
					</p>
				</div>
			</SettingsSection>

			<SettingsSection
				title={tSettings("effectsTab.transitions", "Transitions")}
				description={tSettings(
					"effectsTab.howZoomTransitionsConnect",
					"How zoom transitions connect and blend together",
				)}
			>
				<div className="flex items-center justify-between p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
					<div>
						<div className="text-label font-medium text-fg-muted">
							{tSettings("effects.connectZooms")}
						</div>
						<div className="text-micro text-fg-subtle mt-0.5">
							{tSettings(
								"effectsTab.smoothlyLinkAdjacentZoom",
								"Smoothly link adjacent zoom regions",
							)}
						</div>
					</div>
					<Switch checked={connectZooms} onCheckedChange={onConnectZoomsChange} />
				</div>
				<ZoomTimingControls
					zoomTiming={zoomTiming}
					connectZooms={connectZooms}
					onZoomTimingChange={onZoomTimingChange}
				/>
				<div className="flex items-center justify-between p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
					<div>
						<div className="text-label font-medium text-fg-muted">
							{tSettings("effects.removeBackground")}
						</div>
						<div className="text-micro text-fg-subtle mt-0.5">
							{tSettings(
								"effectsTab.hideWallpaperColorAnd",
								"Hide wallpaper, color, and gradient backgrounds",
							)}
						</div>
					</div>
					<Switch
						checked={hideBackground}
						onCheckedChange={(checked) => onHideBackgroundChange?.(checked)}
					/>
				</div>
			</SettingsSection>

			<SettingsSection
				title={tSettings("effectsTab.visualEffects", "Visual Effects")}
				description={tSettings(
					"effectsTab.fineTuneBlurShadow",
					"Fine-tune blur, shadow, and motion effects",
				)}
			>
				<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
						disabled={hideBackground}
					/>
				</div>
				<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
				<div className="space-y-3 p-2.5 rounded-lg bg-fill-subtle border border-line">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-label font-medium text-fg-muted">
								{tSettings("effectsTab.temporalZoomBlur", "Temporal Zoom Blur")}
							</div>
							<div className="text-micro text-fg-subtle mt-0.5">
								{tSettings(
									"effectsTab.blendSubFrameSamples",
									"Blend sub-frame samples during zoom motion. Applied on export.",
								)}
							</div>
						</div>
						<Switch
							checked={zoomTemporalBlur.enabled}
							onCheckedChange={(enabled) =>
								onZoomTemporalBlurChange?.({ ...zoomTemporalBlur, enabled })
							}
						/>
					</div>
					{zoomTemporalBlur.enabled && (
						<>
							<SliderControl
								label={tSettings("effectsTab.blurSamples", "Blur Samples")}
								value={zoomTemporalBlur.sampleCount ?? 8}
								defaultValue={8}
								min={2}
								max={32}
								step={1}
								onChange={(value) =>
									onZoomTemporalBlurChange?.({ ...zoomTemporalBlur, sampleCount: value })
								}
								formatValue={(value) => `${Math.round(value)}`}
								parseInput={(text) => parseInt(text, 10)}
							/>
							<SliderControl
								label={tSettings("effectsTab.shutter", "Shutter")}
								value={zoomTemporalBlur.shutterFraction ?? 0.5}
								defaultValue={0.5}
								min={0}
								max={1}
								step={0.05}
								onChange={(value) =>
									onZoomTemporalBlurChange?.({ ...zoomTemporalBlur, shutterFraction: value })
								}
								formatValue={(value) => `${Math.round(value * 360)}°`}
								parseInput={(text) => parseFloat(text.replace(/°$/, "")) / 360}
							/>
						</>
					)}
				</div>
				<div className="rounded-lg border border-line bg-fill-subtle transition-colors duration-200 hover:border-line-strong">
					<button
						type="button"
						onClick={onToggleAdvancedShadowSettings}
						className="flex w-full items-center justify-between px-3 py-2.5 text-left"
					>
						<div>
							<div className="text-caption font-medium text-fg">
								{tSettings("effects.advancedShadowSettings")}
							</div>
							<div className="mt-0.5 text-micro leading-relaxed text-fg-subtle">
								{tSettings("effects.advancedShadowDescription")}
							</div>
						</div>
						{showAdvancedShadowSettings ? (
							<ChevronUp className="h-3.5 w-3.5 text-fg-muted" />
						) : (
							<ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
						)}
					</button>
					{showAdvancedShadowSettings && (
						<div className="flex flex-col gap-1.5 border-t border-line px-2.5 py-2.5">
							<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
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
							<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
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
							<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
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

			<SettingsSection
				title={tSettings("effectsTab.frame", "Frame")}
				description={tSettings(
					"effectsTab.adjustTheRecordingFrame",
					"Adjust the recording frame shape and spacing",
				)}
			>
				<div className="rounded-lg border border-line bg-fill-subtle px-3 py-2.5 transition-colors duration-200 hover:border-line-strong">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="text-caption font-medium text-fg">{tSettings("effects.border")}</div>
							<div className="mt-0.5 text-micro leading-relaxed text-fg-subtle">
								{tSettings("effects.borderDescription")}
							</div>
						</div>
						<Switch
							checked={frameBorderEnabled}
							onCheckedChange={(checked) => onFrameBorderEnabledChange?.(checked)}
							className="data-[state=checked]:bg-info"
						/>
					</div>
				</div>
				<DisabledSettingsGroup disabled={!frameBorderEnabled}>
					<div className="flex flex-col gap-1.5">
						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
								disabled={!frameBorderEnabled}
							/>
						</div>
						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
							<label className="mb-2 block text-label font-medium text-fg-muted">
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
						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
								disabled={!frameBorderEnabled}
							/>
						</div>
					</div>
				</DisabledSettingsGroup>
				<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
				<div className="space-y-3 p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
					<div className="flex items-center justify-between">
						<span className="text-label font-medium text-fg-muted">
							{tSettings("effects.padding")}
						</span>
						<div className="grid grid-cols-2 gap-1 rounded-lg bg-fill-subtle p-0.5">
							{(["linked", "unlinked"] as const).map((mode) => {
								const isActive = (mode === "linked") === (paddingSides === null);
								return (
									<button
										key={mode}
										type="button"
										aria-pressed={isActive}
										onClick={() =>
											onPaddingSidesChange?.(
												mode === "linked"
													? null
													: { top: padding, bottom: padding, left: padding, right: padding },
											)
										}
										className={cn(
											"rounded-md px-2 py-1 text-micro font-medium transition-colors",
											isActive ? "bg-control text-fg shadow-sm" : "text-fg-muted hover:text-fg",
										)}
									>
										{mode === "linked"
											? tSettings("effectsTab.linked", "Linked")
											: tSettings("effectsTab.perSide", "Per side")}
									</button>
								);
							})}
						</div>
					</div>
					{paddingSides === null ? (
						<SliderControl
							label={tSettings("effectsTab.allSides", "All sides")}
							value={padding}
							defaultValue={DEFAULT_VIDEO_PREVIEW_PADDING}
							min={0}
							max={PADDING_LINKED_MAX}
							step={1}
							onChange={(value) => onPaddingChange?.(value)}
							formatValue={(value) => `${value}%`}
							parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
						/>
					) : (
						(["top", "bottom", "left", "right"] as const).map((side) => (
							<SliderControl
								key={side}
								label={side[0].toUpperCase() + side.slice(1)}
								value={paddingSides[side]}
								defaultValue={padding}
								min={0}
								max={
									side === "top" || side === "bottom"
										? PADDING_UNLINKED_VERTICAL_MAX
										: PADDING_LINKED_MAX
								}
								step={1}
								onChange={(value) => onPaddingSidesChange?.({ ...paddingSides, [side]: value })}
								formatValue={(value) => `${value}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
						))
					)}
				</div>
				<Button
					onClick={onCropToggle}
					variant="outline"
					className="w-full gap-2 bg-fill-subtle text-fg border-line hover:bg-accent/10 hover:border-accent/30 hover:text-accent-fg text-micro h-9 rounded-lg transition-all duration-200"
				>
					<Crop className="w-3.5 h-3.5" />
					{tSettings("crop.title")}
				</Button>
			</SettingsSection>
		</TabContent>
	);
}
