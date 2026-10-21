import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SliderControl } from "../SliderControl";
import {
	DisabledSettingsGroup,
	SettingsSection,
	TabContent,
	TabHeader,
} from "../settingsPanelLayout";
import type {
	CameraSpringSettings,
	CursorClickStyleSettings,
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorTypeMode,
	MotionPresetId,
} from "../types";
import {
	CURSOR_CLICK_BOUNCE_DURATION_MAX_MS,
	CURSOR_CLICK_BOUNCE_DURATION_MIN_MS,
	CURSOR_CLICK_EFFECT_STYLE_OPTIONS,
	CURSOR_MOVEMENT_STYLE_OPTIONS,
	CURSOR_PACK_OPTIONS,
	CURSOR_TYPE_MODE_OPTIONS,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_STYLE,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_OPACITY,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SPRING,
	DEFAULT_CURSOR_TILT,
	DEFAULT_CURSOR_TRAIL_LENGTH,
	DEFAULT_CURSOR_TRAIL_OPACITY,
} from "../types";
import { cursorPackPreviewUrls } from "../videoPlayback/cursorAssetPacks";

type SettingsTranslator = (key: string, fallback?: string) => string;

/*
const CURSOR_STATE_LABELS: Partial<Record<CursorType, string>> = {
	arrow: "Arrow",
	text: "Text",
	pointer: "Pointer",
	crosshair: "Crosshair",
	"open-hand": "Open Hand",
	"closed-hand": "Closed Hand",
	"resize-ew": "Resize EW",
	"resize-ns": "Resize NS",
	"resize-nesw": "Resize Diagonal",
	"not-allowed": "Blocked",
	copy: "Copy",
	help: "Help",
	move: "Move",
	"zoom-in": "Zoom In",
	"zoom-out": "Zoom Out",
	"screenshot-selection": "Selection",
};
*/

interface CursorSettingsTabProps {
	tSettings: SettingsTranslator;
	showCursor: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	hideWhenIdle: boolean;
	onHideWhenIdleChange?: (enabled: boolean) => void;
	idleHideDelayMs: number;
	onIdleHideDelayMsChange?: (delayMs: number) => void;
	cursorTypeMode: CursorTypeMode;
	onCursorTypeModeChange?: (mode: CursorTypeMode) => void;
	cursorSize: number;
	onCursorSizeChange?: (size: number) => void;
	cursorTilt: number;
	onCursorTiltChange?: (tilt: number) => void;
	cursorMovementStyle: CursorMovementStyle;
	onCursorMovementStyleChange?: (style: CursorMovementStyle) => void;
	smoothMovementEnabled: boolean;
	onSmoothMovementEnabledChange?: (enabled: boolean) => void;
	cursorSpring: CursorSpringSettings;
	onCursorSpringChange?: (spring: CursorSpringSettings) => void;
	cameraSpring?: CameraSpringSettings;
	onCameraSpringChange?: (spring: CameraSpringSettings) => void;
	highQualitySvgCursors: boolean;
	onHighQualitySvgCursorsChange?: (enabled: boolean) => void;
	showLegacyCursorSettings: boolean;
	onToggleLegacyCursorSettings: () => void;
	loopCursor: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorPack: CursorPack;
	onCursorPackChange?: (pack: CursorPack) => void;
	cursorColor: string;
	onCursorColorChange?: (color: string) => void;
	cursorOpacity: number;
	onCursorOpacityChange?: (opacity: number) => void;
	cursorMotionBlur: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorTrailLength: number;
	onCursorTrailLengthChange?: (length: number) => void;
	cursorTrailOpacity: number;
	onCursorTrailOpacityChange?: (opacity: number) => void;
	clickEffectsEnabled: boolean;
	onClickEffectsEnabledChange?: (enabled: boolean) => void;
	cursorClickBounce: number;
	onCursorClickBounceChange?: (amount: number) => void;
	clickHighlightColor: string;
	onClickHighlightColorChange?: (color: string) => void;
	clickHighlightSize: number;
	onClickHighlightSizeChange?: (size: number) => void;
	clickHighlightOpacity: number;
	onClickHighlightOpacityChange?: (opacity: number) => void;
	cursorClickStyle: CursorClickStyleSettings;
	onCursorClickStyleChange?: (style: CursorClickStyleSettings) => void;
	motionPreset: MotionPresetId | null;
	onApplyMotionPreset?: (preset: MotionPresetId) => void;
}

const MOTION_PRESET_OPTIONS: Array<{ value: MotionPresetId; label: string; description: string }> =
	[
		{
			value: "focused",
			label: "Focused",
			description: "Quick, snappy motion for demos and walkthroughs.",
		},
		{
			value: "smooth",
			label: "Smooth",
			description: "Slower, gentler motion for presentations and polished reveals.",
		},
	];

const CLICK_CARD =
	"p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner transition-colors duration-200";

export function CursorSettingsTab({
	tSettings,
	showCursor,
	onShowCursorChange,
	hideWhenIdle,
	onHideWhenIdleChange,
	idleHideDelayMs,
	onIdleHideDelayMsChange,
	cursorTypeMode,
	onCursorTypeModeChange,
	cursorSize,
	onCursorSizeChange,
	cursorTilt,
	onCursorTiltChange,
	cursorMovementStyle,
	onCursorMovementStyleChange,
	smoothMovementEnabled,
	onSmoothMovementEnabledChange,
	cursorSpring,
	onCursorSpringChange,
	cameraSpring,
	onCameraSpringChange,
	highQualitySvgCursors,
	onHighQualitySvgCursorsChange,
	showLegacyCursorSettings,
	onToggleLegacyCursorSettings,
	loopCursor,
	onLoopCursorChange,
	cursorPack,
	onCursorPackChange,
	cursorColor,
	onCursorColorChange,
	cursorOpacity,
	onCursorOpacityChange,
	cursorMotionBlur,
	onCursorMotionBlurChange,
	cursorTrailLength,
	onCursorTrailLengthChange,
	cursorTrailOpacity,
	onCursorTrailOpacityChange,
	clickEffectsEnabled,
	onClickEffectsEnabledChange,
	cursorClickBounce,
	onCursorClickBounceChange,
	clickHighlightColor,
	onClickHighlightColorChange,
	clickHighlightSize,
	onClickHighlightSizeChange,
	clickHighlightOpacity,
	onClickHighlightOpacityChange,
	cursorClickStyle,
	onCursorClickStyleChange,
	motionPreset,
	onApplyMotionPreset,
}: CursorSettingsTabProps) {
	// macOS is a proper name and stays as is; the other packs are translated.
	const packLabel = (option: { value: string; label: string }) =>
		option.value === "macos"
			? option.label
			: tSettings(`cursor.options.pack.${option.value}`, option.label);
	const [showAdvancedClickEffects, setShowAdvancedClickEffects] = useState(false);
	const cursorControlsDisabled = !showCursor;
	const smoothingControlsDisabled = cursorControlsDisabled || !smoothMovementEnabled;
	const clickEffectControlsDisabled = cursorControlsDisabled || !clickEffectsEnabled;
	/*
	const cursorStatePreviewItems = SUPPORTED_CURSOR_KEYS.map((cursorType) => {
		const asset = cursorAssetPacks[cursorPack][cursorType];
		if (!asset) {
			return null;
		}

		return {
			cursorType,
			label: CURSOR_STATE_LABELS[cursorType] ?? cursorType,
			url: asset.url,
		};
	}).filter(
		(item): item is { cursorType: CursorType; label: string; url: string } => item !== null,
	);
	*/

	return (
		<TabContent>
			<TabHeader
				title={tSettings("cursor.title")}
				description={tSettings(
					"cursor.description",
					"Control cursor style, movement, visibility, and rendering quality",
				)}
			/>

			<SettingsSection
				title={tSettings("cursor.motionPresets", "Motion Presets")}
				description={tSettings(
					"cursor.motionPresetsHint",
					"One-click zoom and cursor motion. Editing any value switches to Custom.",
				)}
			>
				<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
					{MOTION_PRESET_OPTIONS.map((option) => {
						const isActive = motionPreset === option.value;
						return (
							<Button
								key={option.value}
								type="button"
								title={tSettings(`cursor.presets.${option.value}Hint`, option.description)}
								onClick={() => onApplyMotionPreset?.(option.value)}
								className={cn(
									"h-9 rounded-xl border text-xs font-semibold transition-all duration-200",
									isActive
										? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white"
										: "border-white/5 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200",
								)}
							>
								{tSettings(`cursor.presets.${option.value}`, option.label)}
							</Button>
						);
					})}
					<div
						className={cn(
							"flex h-9 items-center justify-center whitespace-nowrap rounded-xl border px-3 text-xs font-semibold",
							motionPreset === null
								? "border-white/20 bg-white/[0.08] text-slate-200"
								: "border-white/5 text-slate-600",
						)}
					>
						{tSettings("cursor.presets.custom", "Custom")}
					</div>
				</div>
			</SettingsSection>

			<SettingsSection
				title={tSettings("cursor.visibility", "Visibility")}
				description={tSettings(
					"cursor.visibilityHint",
					"Control whether the cursor shows and when it fades away",
				)}
			>
				<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("effects.showCursor", "Cursor")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">
							{tSettings("cursor.showCursorHint", "Show the cursor in preview and export.")}
						</div>
					</div>
					<Switch
						checked={showCursor}
						onCheckedChange={onShowCursorChange}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>
				<DisabledSettingsGroup disabled={cursorControlsDisabled}>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.hideWhenIdle", "Hide When Idle")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								{tSettings(
									"cursor.hideWhenIdleHint",
									"Fade the cursor out after inactivity based on the timeline.",
								)}
							</div>
						</div>
						<Switch
							checked={hideWhenIdle}
							onCheckedChange={onHideWhenIdleChange}
							disabled={cursorControlsDisabled}
							className="data-[state=checked]:bg-[#F59E0B] scale-90"
						/>
					</div>
					<DisabledSettingsGroup disabled={!hideWhenIdle}>
						<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
							<SliderControl
								label={tSettings("cursor.idleDelay", "Idle Delay")}
								value={idleHideDelayMs}
								defaultValue={DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS}
								min={500}
								max={5000}
								step={50}
								onChange={(v) => onIdleHideDelayMsChange?.(Math.round(v))}
								formatValue={(v) => `${(v / 1000).toFixed(1)}s`}
								parseInput={(t) => Math.round(parseFloat(t.replace(/s$/i, "").trim()) * 1000)}
								disabled={cursorControlsDisabled || !hideWhenIdle}
							/>
						</div>
					</DisabledSettingsGroup>
				</DisabledSettingsGroup>
			</SettingsSection>

			<DisabledSettingsGroup disabled={cursorControlsDisabled}>
				<SettingsSection
					title={tSettings("cursor.type", "Cursor Type")}
					description={tSettings(
						"cursor.typeHint",
						"Choose between the cursor from your recording or a touch-style circle.",
					)}
				>
					<div className="grid grid-cols-1 gap-2">
						{CURSOR_TYPE_MODE_OPTIONS.map((option) => {
							const description =
								option.value === "auto"
									? tSettings(
											"cursor.typeAutoDescription",
											"Uses the actual cursor from your recording.",
										)
									: tSettings(
											"cursor.typeCircleDescription",
											"A touch-style circle cursor like mobile simulators.",
										);
							return (
								<button
									key={option.value}
									type="button"
									disabled={cursorControlsDisabled}
									onClick={() => onCursorTypeModeChange?.(option.value)}
									className={cn(
										"flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
										cursorTypeMode === option.value
											? "border-[#F59E0B]/55 bg-[#F59E0B]/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
											: "border-white/5 bg-black/30 hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)]",
									)}
								>
									<div
										className={cn(
											"mt-1 h-4 w-4 rounded-full border",
											cursorTypeMode === option.value
												? "border-[#F59E0B] bg-[#F59E0B]"
												: "border-white/15 bg-transparent",
										)}
									/>
									<div>
										<div className="text-[15px] font-semibold text-slate-100">
											{tSettings(`cursor.options.type.${option.value}`, option.label)}
										</div>
										<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
											{description}
										</div>
									</div>
								</button>
							);
						})}
					</div>
					<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<SliderControl
							label={tSettings("effects.cursorSize", "Size")}
							value={cursorSize}
							defaultValue={DEFAULT_CURSOR_SIZE}
							min={0.5}
							max={10}
							step={0.05}
							onChange={(v) => onCursorSizeChange?.(v)}
							formatValue={(v) => `${v.toFixed(2)}×`}
							parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
							disabled={cursorControlsDisabled}
						/>
					</div>
					<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<SliderControl
							label={tSettings("cursor.tilt", "Tilt")}
							value={cursorTilt}
							defaultValue={DEFAULT_CURSOR_TILT}
							min={0}
							max={1}
							step={0.01}
							onChange={(v) => onCursorTiltChange?.(v)}
							formatValue={(v) => `${Math.round(v * 100)}%`}
							parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
							disabled={cursorControlsDisabled}
						/>
					</div>
				</SettingsSection>

				<SettingsSection
					title={tSettings("cursor.movementStyle", "Cursor Movement Style")}
					description={tSettings(
						"cursor.movementStyleHint",
						"Choose a motion style or fine-tune the spring behavior.",
					)}
				>
					<DisabledSettingsGroup disabled={smoothingControlsDisabled}>
						<div className="grid grid-cols-1 gap-2">
							{CURSOR_MOVEMENT_STYLE_OPTIONS.map((option) => {
								const descriptionMap: Record<CursorMovementStyle, string> = {
									slow: "Relaxed easing with a gentle follow and higher inertia.",
									smooth: "Ultra-smooth cinematic feel with high damping.",
									mellow: "Balanced smoothing for everyday tutorials and walkthroughs.",
									fast: "Quick, responsive smoothing for fast-paced content.",
									custom: "Tune tension, friction, and mass manually for full control.",
								};
								return (
									<button
										key={option.value}
										type="button"
										disabled={smoothingControlsDisabled}
										onClick={() => onCursorMovementStyleChange?.(option.value)}
										className={cn(
											"flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
											cursorMovementStyle === option.value
												? "border-[#F59E0B]/55 bg-[#F59E0B]/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
												: "border-white/5 bg-black/30 hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)]",
										)}
									>
										<div
											className={cn(
												"mt-1 h-4 w-4 rounded-full border",
												cursorMovementStyle === option.value
													? "border-[#F59E0B] bg-[#F59E0B]"
													: "border-white/15 bg-transparent",
											)}
										/>
										<div>
											<div className="text-[15px] font-semibold text-slate-100">
												{tSettings(`cursor.options.movement.${option.value}`, option.label)}
											</div>
											<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
												{tSettings(
													`cursor.options.movement.${option.value}Hint`,
													descriptionMap[option.value],
												)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</DisabledSettingsGroup>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.smoothMovement", "Smooth Movement")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								{tSettings(
									"cursor.smoothMovementHint",
									"Use spring smoothing instead of raw cursor tracking.",
								)}
							</div>
						</div>
						<Switch
							checked={smoothMovementEnabled}
							onCheckedChange={onSmoothMovementEnabledChange}
							disabled={cursorControlsDisabled}
							className="data-[state=checked]:bg-[#F59E0B] scale-90"
						/>
					</div>
					{smoothMovementEnabled && cursorMovementStyle === "custom" && (
						<>
							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
								<SliderControl
									label={tSettings("cursor.tension", "Tension")}
									value={cursorSpring.tension}
									defaultValue={DEFAULT_CURSOR_SPRING.tension}
									min={120}
									max={700}
									step={1}
									onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, tension: v })}
									formatValue={(v) => `${Math.round(v)}`}
									parseInput={(t) => parseFloat(t)}
									disabled={smoothingControlsDisabled}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
								<SliderControl
									label={tSettings("cursor.friction", "Friction")}
									value={cursorSpring.friction}
									defaultValue={DEFAULT_CURSOR_SPRING.friction}
									min={20}
									max={100}
									step={1}
									onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, friction: v })}
									formatValue={(v) => `${Math.round(v)}`}
									parseInput={(t) => parseFloat(t)}
									disabled={smoothingControlsDisabled}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
								<SliderControl
									label={tSettings("cursor.mass", "Mass")}
									value={cursorSpring.mass}
									defaultValue={DEFAULT_CURSOR_SPRING.mass}
									min={0.5}
									max={1.6}
									step={0.01}
									onChange={(v) => onCursorSpringChange?.({ ...cursorSpring, mass: v })}
									formatValue={(v) => `${v.toFixed(2)}`}
									parseInput={(t) => parseFloat(t)}
									disabled={smoothingControlsDisabled}
								/>
							</div>
						</>
					)}
				</SettingsSection>

				<SettingsSection
					title={tSettings("cursor.cameraTracking", "Camera Tracking")}
					description={tSettings(
						"cursor.cameraTrackingHint",
						"Fine-tune how the camera follows the cursor during zoom.",
					)}
				>
					<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<SliderControl
							label={tSettings("cursor.cameraTension", "Tension")}
							value={cameraSpring?.tension ?? DEFAULT_CAMERA_SPRING.tension}
							defaultValue={DEFAULT_CAMERA_SPRING.tension}
							min={60}
							max={500}
							step={1}
							onChange={(v) =>
								onCameraSpringChange?.({
									...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
									tension: v,
								})
							}
							formatValue={(v) => `${Math.round(v)}`}
							parseInput={(t) => parseFloat(t)}
							disabled={cursorControlsDisabled}
						/>
					</div>
					<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<SliderControl
							label={tSettings("cursor.cameraFriction", "Friction")}
							value={cameraSpring?.friction ?? DEFAULT_CAMERA_SPRING.friction}
							defaultValue={DEFAULT_CAMERA_SPRING.friction}
							min={8}
							max={80}
							step={1}
							onChange={(v) =>
								onCameraSpringChange?.({
									...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
									friction: v,
								})
							}
							formatValue={(v) => `${Math.round(v)}`}
							parseInput={(t) => parseFloat(t)}
							disabled={cursorControlsDisabled}
						/>
					</div>
					<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<SliderControl
							label={tSettings("cursor.cameraMass", "Mass")}
							value={cameraSpring?.mass ?? DEFAULT_CAMERA_SPRING.mass}
							defaultValue={DEFAULT_CAMERA_SPRING.mass}
							min={0.3}
							max={2.5}
							step={0.01}
							onChange={(v) =>
								onCameraSpringChange?.({
									...(cameraSpring ?? DEFAULT_CAMERA_SPRING),
									mass: v,
								})
							}
							formatValue={(v) => `${v.toFixed(2)}`}
							parseInput={(t) => parseFloat(t)}
							disabled={cursorControlsDisabled}
						/>
					</div>
				</SettingsSection>

				<SettingsSection
					title={tSettings("cursor.rendering", "Rendering")}
					description={tSettings(
						"cursor.renderingHint",
						"Choose how cursor images are rendered in preview and export.",
					)}
				>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.highQualitySvg", "High Quality SVG Cursors")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								{tSettings(
									"cursor.highQualitySvgHint",
									"Use ScreenMint's SVG cursor images in preview and export.",
								)}
							</div>
						</div>
						<Switch
							checked={highQualitySvgCursors}
							onCheckedChange={onHighQualitySvgCursorsChange}
							disabled={cursorControlsDisabled}
							className="data-[state=checked]:bg-[#F59E0B] scale-90"
						/>
					</div>
				</SettingsSection>

				<SettingsSection
					title={tSettings("cursor.clickEffects", "Click Effects")}
					description={tSettings("cursor.clickEffectsHint", "Visual feedback when clicking")}
					accentColor="amber"
				>
					<div className="grid grid-cols-4 gap-1.5">
						{([{ value: "off", label: "Off" }, ...CURSOR_CLICK_EFFECT_STYLE_OPTIONS] as const).map(
							(option) => {
								const isActive =
									option.value === "off"
										? !clickEffectsEnabled
										: clickEffectsEnabled && cursorClickStyle.effect === option.value;
								return (
									<Button
										key={option.value}
										type="button"
										disabled={cursorControlsDisabled}
										onClick={() => {
											if (option.value === "off") {
												onClickEffectsEnabledChange?.(false);
												return;
											}
											onClickEffectsEnabledChange?.(true);
											onCursorClickStyleChange?.({ ...cursorClickStyle, effect: option.value });
										}}
										className={cn(
											"h-9 rounded-xl border text-xs font-semibold transition-all duration-200",
											isActive
												? "border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white"
												: "border-white/5 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200",
										)}
									>
										{tSettings(`cursor.options.click.${option.value}`, option.label)}
									</Button>
								);
							},
						)}
					</div>
					<p className="text-[10px] leading-relaxed text-slate-500">
						{clickEffectsEnabled
							? tSettings(
									`cursor.options.click.${cursorClickStyle.effect}Hint`,
									CURSOR_CLICK_EFFECT_STYLE_OPTIONS.find(
										(option) => option.value === cursorClickStyle.effect,
									)?.description,
								)
							: tSettings(
									"cursor.options.click.offHint",
									"No click graphic. Only the cursor bounce changes when you click.",
								)}
					</p>

					<div
						className={cn(CLICK_CARD, cursorControlsDisabled && "opacity-45 pointer-events-none")}
					>
						<SliderControl
							label={tSettings("effects.cursorClickBounce")}
							value={cursorClickBounce}
							defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
							min={0}
							max={5}
							step={0.05}
							onChange={(v) => onCursorClickBounceChange?.(v)}
							formatValue={(v) => (v <= 0 ? "Off" : `${v.toFixed(2)}×`)}
							parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
							disabled={cursorControlsDisabled}
						/>
						<SliderControl
							label={tSettings("cursor.bounceSpeed", "Bounce Speed")}
							value={cursorClickStyle.bounceDurationMs}
							defaultValue={DEFAULT_CURSOR_CLICK_STYLE.bounceDurationMs}
							min={CURSOR_CLICK_BOUNCE_DURATION_MIN_MS}
							max={CURSOR_CLICK_BOUNCE_DURATION_MAX_MS}
							step={10}
							onChange={(v) =>
								onCursorClickStyleChange?.({ ...cursorClickStyle, bounceDurationMs: v })
							}
							formatValue={(v) => `${Math.round(v)}ms`}
							parseInput={(t) => parseFloat(t.replace(/ms$/, ""))}
							disabled={cursorControlsDisabled || cursorClickBounce <= 0}
						/>
					</div>

					<button
						type="button"
						disabled={clickEffectControlsDisabled}
						onClick={() => setShowAdvancedClickEffects((value) => !value)}
						aria-expanded={showAdvancedClickEffects}
						className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2 text-left text-[11px] font-medium text-slate-300 disabled:opacity-45"
					>
						{tSettings("cursor.advanced", "Advanced")}
						<span className="text-[10px] text-slate-500">
							{showAdvancedClickEffects
								? tSettings("cursor.hide", "Hide")
								: tSettings("cursor.show", "Show")}
						</span>
					</button>

					{showAdvancedClickEffects && !clickEffectControlsDisabled && (
						<div className={cn(CLICK_CARD, "space-y-3")}>
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-medium text-slate-300">
									{tSettings("cursor.effectColor", "Effect Color")}
								</span>
								<div className="flex items-center gap-2">
									<label className="relative w-7 h-7 rounded-lg border border-white/[0.08] cursor-pointer overflow-hidden">
										<span
											className="absolute inset-[3px] rounded-[5px]"
											style={{ backgroundColor: clickHighlightColor }}
										/>
										<input
											type="color"
											aria-label={tSettings("cursor.effectColor", "Effect Color")}
											value={clickHighlightColor}
											onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
											className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
										/>
									</label>
									<button
										type="button"
										onClick={() => onClickHighlightColorChange?.(DEFAULT_CLICK_HIGHLIGHT_COLOR)}
										className="text-[10px] text-slate-500 hover:text-[#F59E0B]"
									>
										{tSettings("cursor.reset", "Reset")}
									</button>
								</div>
							</div>
							<SliderControl
								label={tSettings("cursor.effectSize", "Effect Size")}
								value={clickHighlightSize}
								defaultValue={DEFAULT_CLICK_HIGHLIGHT_SIZE}
								min={0.1}
								max={3}
								step={0.1}
								onChange={(v) => onClickHighlightSizeChange?.(v)}
								formatValue={(v) => `${v.toFixed(1)}×`}
								parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings("cursor.effectOpacity", "Effect Opacity")}
								value={clickHighlightOpacity}
								defaultValue={DEFAULT_CLICK_HIGHLIGHT_OPACITY}
								min={0.05}
								max={1}
								step={0.05}
								onChange={(v) => onClickHighlightOpacityChange?.(v)}
								formatValue={(v) => `${Math.round(v * 100)}%`}
								parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
							/>
							<SliderControl
								label={tSettings("cursor.effectDuration", "Effect Duration")}
								value={cursorClickStyle.effectDurationMs}
								defaultValue={DEFAULT_CURSOR_CLICK_STYLE.effectDurationMs}
								min={100}
								max={2000}
								step={50}
								onChange={(v) =>
									onCursorClickStyleChange?.({ ...cursorClickStyle, effectDurationMs: v })
								}
								formatValue={(v) => `${Math.round(v)}ms`}
								parseInput={(t) => parseFloat(t.replace(/ms$/, ""))}
							/>
						</div>
					)}
				</SettingsSection>
				<div className="mb-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
					<button
						type="button"
						onClick={onToggleLegacyCursorSettings}
						disabled={cursorControlsDisabled}
						className="flex w-full items-center justify-between text-left"
					>
						<div>
							<div className="text-xs font-semibold text-slate-200">
								{tSettings("cursor.legacySettings", "Advanced Settings")}
							</div>
							<div className="mt-0.5 text-[10px] text-slate-500">
								{tSettings(
									"cursor.legacySettingsHint",
									"Optional cursor appearance and compatibility controls for fine-tuning special cases.",
								)}
							</div>
						</div>
						{showLegacyCursorSettings ? (
							<ChevronUp className="h-4 w-4 text-slate-400" />
						) : (
							<ChevronDown className="h-4 w-4 text-slate-400" />
						)}
					</button>
				</div>

				{showLegacyCursorSettings && (
					<>
						<SettingsSection
							title={tSettings("cursor.legacyVisibility", "Legacy Visibility")}
							description={tSettings(
								"cursor.legacyVisibilityHint",
								"Compatibility controls for older projects",
							)}
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("effects.loopCursor")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										{tSettings("cursor.loopCursorHint", "Loop cursor from last position to first")}
									</div>
								</div>
								<Switch
									checked={loopCursor}
									onCheckedChange={onLoopCursorChange}
									disabled={cursorControlsDisabled}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.appearance", "Appearance")}
							description={tSettings("cursor.appearanceHint", "Customize how your cursor looks")}
						>
							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("cursor.pack")}
								</div>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
									{CURSOR_PACK_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											disabled={cursorControlsDisabled}
											onClick={() => onCursorPackChange?.(opt.value)}
											className={cn(
												"group relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
												cursorPack === opt.value
													? "bg-gradient-to-b from-[#F59E0B]/20 to-[#d97706]/10 ring-1 ring-[#F59E0B]/60 shadow-sm shadow-[#F59E0B]/10"
													: "bg-black/30 hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/[0.1]",
											)}
											title={packLabel(opt)}
										>
											<div
												className={cn(
													"w-8 h-8 flex items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110",
													cursorPack === opt.value
														? "drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]"
														: "",
												)}
											>
												<img
													src={cursorPackPreviewUrls[opt.value]}
													alt={packLabel(opt)}
													className="w-6 h-6 object-contain pointer-events-none"
													draggable={false}
												/>
											</div>
											<span
												className={cn(
													"text-[8px] font-medium leading-tight text-center break-words w-full",
													cursorPack === opt.value
														? "text-[#F59E0B]"
														: "text-slate-500 group-hover:text-slate-300",
												)}
											>
												{packLabel(opt)}
											</span>
										</button>
									))}
								</div>
								{/*
										{cursorStatePreviewItems.length > 0 && (
											<div className="mt-3 border-t border-white/5 pt-3">
												<div className="mb-2 flex items-center justify-between gap-2">
													<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
														States
													</span>
													<span className="text-[10px] text-slate-600">
														{cursorStatePreviewItems.length}
													</span>
												</div>
												<div className="grid grid-cols-4 gap-1.5">
													{cursorStatePreviewItems.map((item) => (
														<div
															key={item.cursorType}
															className="group flex min-w-0 flex-col items-center gap-1 rounded-lg border border-white/[0.04] bg-black/15 p-1.5"
															title={item.label}
														>
															<div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04]">
																<img
																	src={item.url}
																	alt={item.label}
																	className="h-6 w-6 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
																	draggable={false}
																/>
															</div>
															<span className="w-full truncate text-center text-[8px] font-medium leading-tight text-slate-500 group-hover:text-slate-300">
																{item.label}
															</span>
														</div>
													))}
												</div>
											</div>
										)}
									*/}
							</div>

							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<div className="flex items-center justify-between mb-2.5">
									<span className="text-[11px] font-medium text-slate-300">
										{tSettings("cursor.color", "Cursor Color")}
									</span>
									<button
										type="button"
										disabled={cursorControlsDisabled}
										onClick={() => onCursorColorChange?.(DEFAULT_CURSOR_COLOR)}
										className="text-[10px] text-slate-600 hover:text-[#F59E0B] transition-colors duration-200 cursor-pointer"
									>
										{tSettings("cursor.reset", "Reset")}
									</button>
								</div>
								<div className="flex items-center gap-2">
									<label className="relative w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer overflow-hidden group hover:border-[#F59E0B]/40 transition-colors duration-200">
										<div
											className="absolute inset-[3px] rounded-[5px]"
											style={{ backgroundColor: cursorColor }}
										/>
										<input
											type="color"
											value={cursorColor}
											disabled={cursorControlsDisabled}
											onChange={(e) => onCursorColorChange?.(e.target.value)}
											className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
										/>
									</label>
									<input
										type="text"
										value={cursorColor}
										disabled={cursorControlsDisabled}
										onChange={(e) => onCursorColorChange?.(e.target.value)}
										className="flex-1 h-8 rounded-lg border border-white/5 bg-black/30 px-2.5 text-[11px] text-slate-200 font-mono tracking-wider focus:outline-none focus:border-[#F59E0B]/40 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
									/>
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<SliderControl
									label={tSettings("cursor.opacity", "Cursor Opacity")}
									value={cursorOpacity}
									defaultValue={DEFAULT_CURSOR_OPACITY}
									min={0.1}
									max={1}
									step={0.05}
									onChange={(v) => onCursorOpacityChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
									disabled={cursorControlsDisabled}
								/>
							</div>
						</SettingsSection>

						<SettingsSection
							title={tSettings("cursor.motion", "Motion")}
							description={tSettings(
								"cursor.motionHint",
								"Fine-tune motion blur and trail effects",
							)}
						>
							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<SliderControl
									label={tSettings("effects.cursorMotionBlur")}
									value={cursorMotionBlur}
									defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
									min={0}
									max={5}
									step={0.05}
									onChange={(v) => onCursorMotionBlurChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
									disabled={cursorControlsDisabled}
								/>
							</div>

							<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200">
								<SliderControl
									label={tSettings("cursor.trailLength", "Trail Length")}
									value={cursorTrailLength}
									defaultValue={DEFAULT_CURSOR_TRAIL_LENGTH}
									min={0}
									max={20}
									step={1}
									onChange={(v) => onCursorTrailLengthChange?.(v)}
									formatValue={(v) => (v <= 0 ? "Off" : `${v}`)}
									parseInput={(t) => {
										if (t.trim().toLowerCase() === "off") return 0;
										return parseInt(t, 10);
									}}
									disabled={cursorControlsDisabled}
								/>
							</div>

							{cursorTrailLength > 0 && (
								<div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-colors duration-200 animate-in fade-in slide-in-from-top-1 duration-200">
									<SliderControl
										label={tSettings("cursor.trailOpacity", "Trail Opacity")}
										value={cursorTrailOpacity}
										defaultValue={DEFAULT_CURSOR_TRAIL_OPACITY}
										min={0.05}
										max={1}
										step={0.05}
										onChange={(v) => onCursorTrailOpacityChange?.(v)}
										formatValue={(v) => `${Math.round(v * 100)}%`}
										parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
										disabled={cursorControlsDisabled}
									/>
								</div>
							)}
						</SettingsSection>
					</>
				)}
			</DisabledSettingsGroup>
		</TabContent>
	);
}
