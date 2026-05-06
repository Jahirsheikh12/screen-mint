import { ChevronDown, ChevronUp } from "lucide-react";
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
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorTypeMode,
} from "../types";
import {
	CURSOR_MOVEMENT_STYLE_OPTIONS,
	CURSOR_PACK_OPTIONS,
	CURSOR_TYPE_MODE_OPTIONS,
	DEFAULT_CAMERA_SPRING,
	DEFAULT_CLICK_HIGHLIGHT_COLOR,
	DEFAULT_CLICK_HIGHLIGHT_OPACITY,
	DEFAULT_CLICK_HIGHLIGHT_SIZE,
	DEFAULT_CURSOR_CLICK_BOUNCE,
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
}

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
}: CursorSettingsTabProps) {
	const cursorControlsDisabled = !showCursor;
	const smoothingControlsDisabled = cursorControlsDisabled || !smoothMovementEnabled;
	const clickEffectControlsDisabled = cursorControlsDisabled || !clickEffectsEnabled;

	return (
		<TabContent>
			<TabHeader
				title={tSettings("cursor.title")}
				description="Control cursor style, movement, visibility, and rendering quality"
			/>

			<SettingsSection
				title="Visibility"
				description="Control whether the cursor shows and when it fades away"
			>
				<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("effects.showCursor", "Cursor")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">
							Show the cursor in preview and export.
						</div>
					</div>
					<Switch
						checked={showCursor}
						onCheckedChange={onShowCursorChange}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>
				<DisabledSettingsGroup disabled={cursorControlsDisabled}>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.hideWhenIdle", "Hide When Idle")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								Fade the cursor out after inactivity based on the timeline.
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
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					description="Choose between using detected cursor states or a touch-style circle."
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
											: "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
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
										<div className="text-[15px] font-semibold text-slate-100">{option.label}</div>
										<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
											{description}
										</div>
									</div>
								</button>
							);
						})}
					</div>
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					description="Choose a motion preset or fine-tune the spring behavior."
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
												: "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
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
											<div className="text-[15px] font-semibold text-slate-100">{option.label}</div>
											<div className="mt-0.5 text-[12px] leading-relaxed text-slate-400">
												{descriptionMap[option.value]}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</DisabledSettingsGroup>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.smoothMovement", "Smooth Movement")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								Use spring smoothing instead of raw cursor tracking.
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					description="Fine-tune how the camera follows the cursor during zoom."
				>
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
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
					description="Choose how cursor assets are rendered in preview and export."
				>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("cursor.highQualitySvg", "High Quality SVG Cursors")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								Use Screen Mint&apos;s SVG cursor assets in preview and export.
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

				<div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
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
								Optional cursor appearance and compatibility controls for fine-tuning special cases.
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
							title="Legacy Visibility"
							description="Compatibility controls for older projects"
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">
										{tSettings("effects.loopCursor")}
									</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Loop cursor from last position to first
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

						<SettingsSection title="Appearance" description="Customize how your cursor looks">
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div className="text-xs font-medium text-slate-300 mb-2">
									{tSettings("cursor.pack")}
								</div>
								<div className="grid grid-cols-5 gap-1.5">
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
													: "bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/[0.1]",
											)}
											title={opt.label}
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
													alt={opt.label}
													className="w-6 h-6 object-contain pointer-events-none"
													draggable={false}
												/>
											</div>
											<span
												className={cn(
													"text-[8px] font-medium leading-tight text-center truncate w-full",
													cursorPack === opt.value
														? "text-[#F59E0B]"
														: "text-slate-500 group-hover:text-slate-300",
												)}
											>
												{opt.label}
											</span>
										</button>
									))}
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div className="flex items-center justify-between mb-2.5">
									<span className="text-[11px] font-medium text-slate-300">Cursor Color</span>
									<button
										type="button"
										disabled={cursorControlsDisabled}
										onClick={() => onCursorColorChange?.(DEFAULT_CURSOR_COLOR)}
										className="text-[10px] text-slate-600 hover:text-[#F59E0B] transition-colors duration-200 cursor-pointer"
									>
										Reset
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
										className="flex-1 h-8 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-[11px] text-slate-200 font-mono tracking-wider focus:outline-none focus:border-[#F59E0B]/40 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
									/>
								</div>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<SliderControl
									label="Cursor Opacity"
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

						<SettingsSection title="Motion" description="Fine-tune motion blur and trail effects">
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<SliderControl
									label={tSettings("effects.cursorMotionBlur")}
									value={cursorMotionBlur}
									defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
									min={0}
									max={2}
									step={0.05}
									onChange={(v) => onCursorMotionBlurChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
									disabled={cursorControlsDisabled}
								/>
							</div>

							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<SliderControl
									label="Trail Length"
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
								<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200 animate-in fade-in slide-in-from-top-1 duration-200">
									<SliderControl
										label="Trail Opacity"
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

						<SettingsSection
							title="Click Effects"
							description="Visual feedback when clicking"
							accentColor="amber"
						>
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<div>
									<div className="text-xs font-medium text-slate-300">Enable Click Effects</div>
									<div className="text-[10px] text-slate-500 mt-0.5">
										Show click bounce and highlight rings in preview and export.
									</div>
								</div>
								<Switch
									checked={clickEffectsEnabled}
									onCheckedChange={onClickEffectsEnabledChange}
									disabled={cursorControlsDisabled}
									className="data-[state=checked]:bg-[#F59E0B] scale-90"
								/>
							</div>
							<div
								className={cn(
									"p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-colors duration-200",
									clickEffectControlsDisabled
										? "opacity-45 pointer-events-none"
										: "hover:bg-white/[0.06]",
								)}
							>
								<SliderControl
									label={tSettings("effects.cursorClickBounce")}
									value={cursorClickBounce}
									defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
									min={0}
									max={5}
									step={0.05}
									onChange={(v) => onCursorClickBounceChange?.(v)}
									formatValue={(v) => `${v.toFixed(2)}×`}
									parseInput={(t) => parseFloat(t.replace(/×$/, ""))}
									disabled={clickEffectControlsDisabled}
								/>
							</div>

							<div
								className={cn(
									"p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-colors duration-200",
									clickEffectControlsDisabled
										? "opacity-45 pointer-events-none"
										: "hover:bg-white/[0.06]",
								)}
							>
								<div className="flex items-center justify-between mb-2.5">
									<span className="text-[11px] font-medium text-slate-300">
										Click Highlight Color
									</span>
									<button
										type="button"
										disabled={clickEffectControlsDisabled}
										onClick={() => onClickHighlightColorChange?.(DEFAULT_CLICK_HIGHLIGHT_COLOR)}
										className="text-[10px] text-slate-600 hover:text-[#F59E0B] transition-colors duration-200 cursor-pointer"
									>
										Reset
									</button>
								</div>
								<div className="flex items-center gap-2">
									<label className="relative w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer overflow-hidden group hover:border-[#F59E0B]/40 transition-colors duration-200">
										<div
											className="absolute inset-[3px] rounded-[5px]"
											style={{ backgroundColor: clickHighlightColor }}
										/>
										<input
											type="color"
											value={clickHighlightColor}
											disabled={clickEffectControlsDisabled}
											onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
											className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
										/>
									</label>
									<input
										type="text"
										value={clickHighlightColor}
										disabled={clickEffectControlsDisabled}
										onChange={(e) => onClickHighlightColorChange?.(e.target.value)}
										className="flex-1 h-8 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 text-[11px] text-slate-200 font-mono tracking-wider focus:outline-none focus:border-[#F59E0B]/40 focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200"
									/>
								</div>
							</div>

							<div
								className={cn(
									"p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-colors duration-200",
									clickEffectControlsDisabled
										? "opacity-45 pointer-events-none"
										: "hover:bg-white/[0.06]",
								)}
							>
								<SliderControl
									label="Click Highlight Size"
									value={clickHighlightSize}
									defaultValue={DEFAULT_CLICK_HIGHLIGHT_SIZE}
									min={0}
									max={3}
									step={0.1}
									onChange={(v) => onClickHighlightSizeChange?.(v)}
									formatValue={(v) => (v <= 0 ? "Off" : `${v.toFixed(1)}×`)}
									parseInput={(t) => {
										if (t.trim().toLowerCase() === "off") return 0;
										return parseFloat(t.replace(/×$/, ""));
									}}
									disabled={clickEffectControlsDisabled}
								/>
							</div>

							<div
								className={cn(
									"p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-colors duration-200",
									clickEffectControlsDisabled
										? "opacity-45 pointer-events-none"
										: "hover:bg-white/[0.06]",
								)}
							>
								<SliderControl
									label="Click Highlight Opacity"
									value={clickHighlightOpacity}
									defaultValue={DEFAULT_CLICK_HIGHLIGHT_OPACITY}
									min={0}
									max={1}
									step={0.05}
									onChange={(v) => onClickHighlightOpacityChange?.(v)}
									formatValue={(v) => `${Math.round(v * 100)}%`}
									parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
									disabled={clickEffectControlsDisabled}
								/>
							</div>
						</SettingsSection>
					</>
				)}
			</DisabledSettingsGroup>
		</TabContent>
	);
}
