import { AlertTriangle, Gauge, Sparkles, Upload } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { ColorPicker } from "../ColorPicker";
import { SliderControl } from "../SliderControl";
import {
	DisabledSettingsGroup,
	SettingsSection,
	TabContent,
	TabHeader,
} from "../settingsPanelLayout";
import type {
	CameraLayoutRegion,
	WebcamEffects,
	WebcamHealthMetrics,
	WebcamPreviewMode,
	WebcamRegion,
} from "../types";
import { CAMERA_ZOOM_SCALE_DISABLED, getRecommendedWebcamDefaults } from "../types";
import {
	buildWebcamStylePresets,
	normalizeWebcamEffects,
	resolveWebcamEffectCapability,
} from "../webcamEffects";

type SettingsTranslator = (key: string, fallback?: string) => string;

interface WebcamSettingsTabProps {
	tSettings: SettingsTranslator;
	aspectRatio: AspectRatio;
	webcamMissing: boolean;
	missingWebcamPath?: string | null;
	onRelinkMissingWebcam?: () => void;
	onRemoveMissingWebcam?: () => void;
	showAdvancedWebcam: boolean;
	onToggleAdvancedWebcam: () => void;
	selectedCameraLayout: CameraLayoutRegion | null;
	onCameraLayoutChange?: (id: string, region: Partial<CameraLayoutRegion>) => void;
	onResetRecommendedWebcam?: () => void;
	onResetSelectedCameraLayout?: () => void;
	showWebcam: boolean;
	onShowWebcamChange?: (show: boolean) => void;
	mirrorWebcam: boolean;
	onMirrorWebcamChange?: (mirror: boolean) => void;
	webcamRegion: WebcamRegion;
	onWebcamRegionChange?: (region: Partial<WebcamRegion>) => void;
	cameraSizeDuringZoom: number;
	onCameraSizeDuringZoomChange?: (scale: number) => void;
	webcamEffects?: WebcamEffects;
	onWebcamEffectsChange?: (effects: Partial<WebcamEffects>) => void;
	webcamPreviewMode: WebcamPreviewMode;
	onWebcamPreviewModeChange?: (mode: WebcamPreviewMode) => void;
	webcamHealthMetrics?: WebcamHealthMetrics | null;
	onApplyWebcamPreset?: (presetId: WebcamEffects["presetId"]) => void;
}

function getWebcamTreatmentStatusClasses(tone: "neutral" | "warning" | "info"): {
	container: string;
	title: string;
	body: string;
} {
	switch (tone) {
		case "warning":
			return {
				container: "border-amber-400/20 bg-amber-400/10",
				title: "text-amber-100",
				body: "text-amber-100/75",
			};
		case "info":
			return {
				container: "border-blue-400/20 bg-blue-400/10",
				title: "text-blue-100",
				body: "text-blue-100/75",
			};
		case "neutral":
		default:
			return {
				container: "border-white/[0.06] bg-black/10",
				title: "text-slate-200",
				body: "text-slate-400",
			};
	}
}

export function WebcamSettingsTab({
	tSettings,
	aspectRatio,
	webcamMissing,
	missingWebcamPath,
	onRelinkMissingWebcam,
	onRemoveMissingWebcam,
	showAdvancedWebcam,
	onToggleAdvancedWebcam,
	selectedCameraLayout,
	onCameraLayoutChange,
	onResetRecommendedWebcam,
	onResetSelectedCameraLayout,
	showWebcam,
	onShowWebcamChange,
	mirrorWebcam,
	onMirrorWebcamChange,
	webcamRegion,
	onWebcamRegionChange,
	cameraSizeDuringZoom,
	onCameraSizeDuringZoomChange,
	webcamEffects,
	onWebcamEffectsChange,
	webcamPreviewMode,
	onWebcamPreviewModeChange,
	webcamHealthMetrics,
	onApplyWebcamPreset,
}: WebcamSettingsTabProps) {
	const webcamSizeValue =
		Math.round(((webcamRegion.size.width + webcamRegion.size.height) / 2) * 10) / 10;
	const resolvedWebcamEffects = useMemo(
		() => normalizeWebcamEffects(webcamEffects),
		[webcamEffects],
	);
	const webcamEffectCapability = useMemo(
		() =>
			resolveWebcamEffectCapability({
				effects: resolvedWebcamEffects,
				healthMetrics: webcamHealthMetrics,
			}),
		[resolvedWebcamEffects, webcamHealthMetrics],
	);
	const exactPreviewNeedsWarning =
		webcamPreviewMode === "exact" &&
		((webcamHealthMetrics?.effectFallbackState ?? "none") !== "none" ||
			(webcamHealthMetrics?.droppedFrameRatio ?? 0) >= 0.15 ||
			Math.abs(webcamHealthMetrics?.driftMs ?? 0) >= 34 ||
			(webcamHealthMetrics?.frameQueueDepth ?? 0) >= 2);
	const webcamTreatmentStatusClasses = useMemo(
		() => getWebcamTreatmentStatusClasses(webcamEffectCapability.statusTone),
		[webcamEffectCapability.statusTone],
	);
	const webcamStylePresets = useMemo(() => buildWebcamStylePresets(), []);
	const recommendedWebcamDefaults = useMemo(
		() => getRecommendedWebcamDefaults(aspectRatio),
		[aspectRatio],
	);
	const webcamControlsDisabled = !showWebcam;

	const handleWebcamSizeSliderChange = (nextSize: number) => {
		if (!onWebcamRegionChange) return;

		const width = Math.max(8, Math.min(40, nextSize));
		const aspectRatioValue =
			webcamRegion.shape === "circle" || webcamRegion.shape === "square"
				? 1
				: webcamRegion.size.height / Math.max(webcamRegion.size.width, 0.01);
		onWebcamRegionChange({
			size: {
				width,
				height: Math.max(8, Math.min(40, width * aspectRatioValue)),
			},
		});
	};

	const handlePickWebcamBackgroundImage = async () => {
		if (!onWebcamEffectsChange) return;

		try {
			const result = await window.electronAPI.openImageFilePicker();
			if (!result.success || !result.path) return;

			onWebcamEffectsChange({
				backgroundMode: "image",
				backgroundImagePath: result.path,
				presetId: "custom",
			});
		} catch (error) {
			console.error("Failed to pick webcam background image:", error);
			toast.error("Failed to select webcam background image.");
		}
	};

	return (
		<TabContent>
			<TabHeader
				title={tSettings("webcam.title")}
				description="Configure your webcam overlay display"
				badge={selectedCameraLayout ? tSettings("webcam.layoutBadge") : undefined}
				badgeColor="blue"
				trailing={
					<Button
						type="button"
						onClick={onToggleAdvancedWebcam}
						disabled={webcamControlsDisabled}
						className="h-7 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.08] transition-all duration-200"
					>
						{showAdvancedWebcam
							? tSettings("webcam.hideAdvanced")
							: tSettings("webcam.showAdvanced")}
					</Button>
				}
			/>

			{webcamMissing && (
				<div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100 mb-4">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
						<div className="min-w-0">
							<div className="font-semibold text-amber-50">{tSettings("webcam.missingTitle")}</div>
							<div className="mt-1 text-amber-100/80">{tSettings("webcam.missingDescription")}</div>
							{missingWebcamPath && (
								<div className="mt-2 truncate rounded-lg bg-black/20 px-2 py-1 font-mono text-[10px] text-amber-50/80">
									{missingWebcamPath}
								</div>
							)}
							<div className="mt-3 grid grid-cols-2 gap-2">
								<Button
									type="button"
									onClick={onRelinkMissingWebcam}
									className="h-8 rounded-xl border border-amber-300/30 bg-amber-300/15 text-[10px] font-semibold text-amber-50 hover:bg-amber-300/25 transition-colors duration-200"
								>
									{tSettings("webcam.relink")}
								</Button>
								<Button
									type="button"
									onClick={onRemoveMissingWebcam}
									className="h-8 rounded-xl border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors duration-200"
								>
									{tSettings("webcam.remove")}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			<SettingsSection
				title="Display"
				description="Show or hide your webcam overlay"
				accentColor="blue"
			>
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						type="button"
						onClick={onResetRecommendedWebcam}
						disabled={webcamControlsDisabled}
						className="h-8 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[10px] font-semibold text-[#fde68a] hover:bg-[#F59E0B]/18 transition-colors duration-200"
					>
						{tSettings("webcam.resetRecommended")}
					</Button>
					{selectedCameraLayout ? (
						<Button
							type="button"
							onClick={onResetSelectedCameraLayout}
							disabled={webcamControlsDisabled}
							className="h-8 rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[10px] font-semibold text-[#a9c7ff] hover:bg-[#3b82f6]/18 transition-colors duration-200"
						>
							{tSettings("webcam.resetLayout")}
						</Button>
					) : (
						<div className="h-8 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 text-[10px] font-medium text-slate-500 flex items-center justify-center">
							{tSettings("webcam.recommendedDefaults")}
						</div>
					)}
				</div>

				<DisabledSettingsGroup disabled={webcamControlsDisabled}>
					{selectedCameraLayout && (
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<label className="text-xs font-medium text-slate-300 mb-2 block">
								{tSettings("webcam.cameraLayout")}
							</label>
							<div className="grid grid-cols-3 gap-1.5">
								{(
									[
										["default", tSettings("webcam.defaultMode")],
										["fullscreen", tSettings("webcam.fullscreenMode")],
										["hidden", tSettings("webcam.hiddenMode")],
									] as const
								).map(([mode, label]) => (
									<Button
										key={mode}
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => onCameraLayoutChange?.(selectedCameraLayout.id, { mode })}
										className={cn(
											"h-9 rounded-lg border shadow-sm transition-all duration-200 justify-center",
											selectedCameraLayout.mode === mode
												? "border-[#3b82f6] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-sm shadow-[#3b82f6]/20"
												: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
										)}
									>
										<span className="text-xs font-semibold">{label}</span>
									</Button>
								))}
							</div>
							<div className="mt-3 grid grid-cols-1 gap-2">
								<div className="rounded-lg border border-white/[0.06] bg-black/10 p-2">
									<SliderControl
										label="Transition in"
										value={selectedCameraLayout.transitionInMs ?? 260}
										defaultValue={260}
										min={0}
										max={1200}
										step={20}
										onChange={(value) =>
											onCameraLayoutChange?.(selectedCameraLayout.id, {
												transitionInMs: value,
											})
										}
										formatValue={(value) => `${Math.round(value)}ms`}
										parseInput={(text) => parseFloat(text.replace(/ms$/i, ""))}
										disabled={webcamControlsDisabled}
									/>
								</div>
								<div className="rounded-lg border border-white/[0.06] bg-black/10 p-2">
									<SliderControl
										label="Transition out"
										value={selectedCameraLayout.transitionOutMs ?? 220}
										defaultValue={220}
										min={0}
										max={1200}
										step={20}
										onChange={(value) =>
											onCameraLayoutChange?.(selectedCameraLayout.id, {
												transitionOutMs: value,
											})
										}
										formatValue={(value) => `${Math.round(value)}ms`}
										parseInput={(text) => parseFloat(text.replace(/ms$/i, ""))}
										disabled={webcamControlsDisabled}
									/>
								</div>
								<div className="rounded-lg border border-white/[0.06] bg-black/10 p-2">
									<label className="mb-2 block text-xs font-medium text-slate-300">
										Motion preset
									</label>
									<div className="grid grid-cols-3 gap-1.5">
										{(["focused", "smooth", "instant"] as const).map((preset) => (
											<Button
												key={preset}
												type="button"
												disabled={webcamControlsDisabled}
												onClick={() =>
													onCameraLayoutChange?.(selectedCameraLayout.id, {
														motionPreset: preset,
													})
												}
												className={cn(
													"h-8 rounded-lg border text-[10px] transition-all duration-200",
													(selectedCameraLayout.motionPreset ?? "focused") === preset
														? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#fde68a]"
														: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
												)}
											>
												{preset}
											</Button>
										))}
									</div>
								</div>
							</div>
						</div>
					)}
				</DisabledSettingsGroup>

				<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
					<div>
						<div className="text-xs font-medium text-slate-300">
							{tSettings("webcam.showWebcam")}
						</div>
						<div className="text-[10px] text-slate-500 mt-0.5">Display webcam in the export</div>
					</div>
					<Switch
						checked={showWebcam}
						onCheckedChange={onShowWebcamChange}
						className="data-[state=checked]:bg-[#F59E0B] scale-90"
					/>
				</div>

				<DisabledSettingsGroup disabled={webcamControlsDisabled}>
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<div>
							<div className="text-xs font-medium text-slate-300">
								{tSettings("webcam.mirrorCamera")}
							</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								Horizontally flip the webcam feed
							</div>
						</div>
						<Switch
							checked={mirrorWebcam}
							onCheckedChange={onMirrorWebcamChange}
							disabled={webcamControlsDisabled}
							className="data-[state=checked]:bg-[#F59E0B] scale-90"
						/>
					</div>
				</DisabledSettingsGroup>
			</SettingsSection>

			<DisabledSettingsGroup disabled={webcamControlsDisabled}>
				<SettingsSection
					title="Position & Size"
					description="Place and resize your webcam on the canvas"
					accentColor="blue"
				>
					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<label className="text-xs font-medium text-slate-300 mb-2 block">
							{tSettings("webcam.position")}
						</label>
						<div className="grid grid-cols-2 gap-1.5">
							{[
								{ label: tSettings("webcam.topLeft"), anchor: "top-left" as const },
								{ label: tSettings("webcam.topRight"), anchor: "top-right" as const },
								{ label: tSettings("webcam.bottomLeft"), anchor: "bottom-left" as const },
								{ label: tSettings("webcam.bottomRight"), anchor: "bottom-right" as const },
							].map((preset) => (
								<Button
									key={preset.label}
									type="button"
									disabled={webcamControlsDisabled}
									onClick={() =>
										onWebcamRegionChange?.({
											anchor: preset.anchor,
											marginPct: 4,
										})
									}
									className={cn(
										"h-8 rounded-lg border text-[10px] transition-all duration-200",
										webcamRegion.anchor === preset.anchor
											? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#fde68a] shadow-sm shadow-[#F59E0B]/10"
											: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
									)}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</div>

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<SliderControl
							label={tSettings("webcam.size")}
							value={webcamSizeValue}
							defaultValue={18}
							min={8}
							max={40}
							step={0.5}
							onChange={handleWebcamSizeSliderChange}
							formatValue={(v) => `${v.toFixed(1)}%`}
							parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
							disabled={webcamControlsDisabled}
						/>
					</div>

					<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
						<SliderControl
							label={tSettings("webcam.cameraDuringZoom")}
							value={cameraSizeDuringZoom}
							defaultValue={recommendedWebcamDefaults.cameraSizeDuringZoom}
							min={0.4}
							max={1}
							step={0.05}
							onChange={(v) => onCameraSizeDuringZoomChange?.(v)}
							formatValue={(v) =>
								v >= CAMERA_ZOOM_SCALE_DISABLED
									? tSettings("webcam.sameSize")
									: `${Math.round(v * 100)}%`
							}
							parseInput={(t) => {
								const normalized = t.trim().toLowerCase();
								if (
									normalized === tSettings("webcam.sameSize").trim().toLowerCase() ||
									normalized === "off"
								) {
									return CAMERA_ZOOM_SCALE_DISABLED;
								}
								return parseFloat(t.replace(/%$/, "")) / 100;
							}}
							disabled={webcamControlsDisabled}
						/>
						<p className="mt-2 text-[10px] leading-relaxed text-slate-500">
							{tSettings("webcam.cameraDuringZoomHint")}
						</p>
					</div>
				</SettingsSection>

				<SettingsSection
					title="Appearance"
					description="Match the webcam look and treatment to the rest of your edit"
					accentColor="blue"
				>
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
						<div className="mb-2 flex items-center justify-between">
							<div>
								<div className="text-[11px] font-semibold text-slate-200">Studio presets</div>
								<div className="mt-0.5 text-[10px] text-slate-500">
									Start from a tuned webcam style and refine from there
								</div>
							</div>
							<Sparkles className="h-4 w-4 text-[#F59E0B]" />
						</div>
						<div className="grid grid-cols-2 gap-1.5">
							{webcamStylePresets.map((preset) => (
								<Button
									key={preset.id}
									type="button"
									disabled={webcamControlsDisabled}
									onClick={() => onApplyWebcamPreset?.(preset.id)}
									className={cn(
										"h-9 rounded-xl border px-2 text-[10px] font-semibold transition-all duration-200",
										resolvedWebcamEffects.presetId === preset.id
											? "border-[#3b82f6]/40 bg-gradient-to-r from-[#3b82f6]/20 to-[#2563eb]/10 text-[#dbeafe] shadow-sm shadow-[#3b82f6]/10"
											: "border-white/[0.06] bg-black/10 text-slate-300 hover:bg-white/[0.08]",
									)}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</div>

					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
						<div className="mb-3 flex items-center justify-between">
							<div>
								<div className="text-[11px] font-semibold text-slate-200">Background treatment</div>
								<div className="mt-0.5 text-[10px] text-slate-500">
									Choose how the webcam background is separated and styled
								</div>
							</div>
							<Gauge className="h-4 w-4 text-[#F59E0B]" />
						</div>

						<div
							className={cn(
								"mb-3 rounded-xl border px-3 py-2.5",
								webcamTreatmentStatusClasses.container,
							)}
						>
							<div className={cn("text-[11px] font-semibold", webcamTreatmentStatusClasses.title)}>
								{webcamEffectCapability.statusTitle}
							</div>
							<div
								className={cn(
									"mt-0.5 text-[10px] leading-relaxed",
									webcamTreatmentStatusClasses.body,
								)}
							>
								{webcamEffectCapability.statusDescription}
							</div>
							{webcamEffectCapability.configuredBackgroundMode !==
							webcamEffectCapability.appliedBackgroundMode ? (
								<div className="mt-2 text-[10px] text-slate-400">
									Applied in preview:{" "}
									<span className="font-medium capitalize text-slate-200">
										{webcamEffectCapability.appliedBackgroundMode}
									</span>
								</div>
							) : null}
						</div>

						<div className="mb-3 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
							<div className="mb-2 text-[11px] font-medium text-slate-300">Preview mode</div>
							<div className="grid grid-cols-3 gap-1.5">
								{(
									[
										["exact", "Exact Match"],
										["performance", "Performance"],
										["power-saving", "Power Saving"],
									] as const
								).map(([mode, label]) => (
									<Button
										key={mode}
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => onWebcamPreviewModeChange?.(mode)}
										className={cn(
											"h-8 rounded-lg border text-[10px] transition-all duration-200",
											webcamPreviewMode === mode
												? "border-[#3b82f6]/40 bg-[#3b82f6]/12 text-[#dbeafe]"
												: "border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]",
										)}
									>
										{label}
									</Button>
								))}
							</div>
							<div className="mt-2 text-[10px] text-slate-500">
								{webcamPreviewMode === "exact"
									? "Preview uses export-reference webcam rendering and warns instead of silently downgrading."
									: webcamPreviewMode === "performance"
										? "Keeps webcam preview smooth with deterministic reduced-cost rendering."
										: "Minimizes webcam preview CPU/GPU cost with simplified treatment."}
							</div>
							{exactPreviewNeedsWarning ? (
								<div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-100">
									Exact Match is currently under load. Export stays deterministic, but preview is
									struggling right now. Switch to Performance mode if you want smoother editing.
								</div>
							) : null}
						</div>

						<Tabs
							value={resolvedWebcamEffects.backgroundMode}
							onValueChange={(value) =>
								onWebcamEffectsChange?.({
									backgroundMode: value as WebcamEffects["backgroundMode"],
									presetId: "custom",
								})
							}
							className="w-full"
						>
							<TabsList className="mb-3 grid h-9 w-full grid-cols-4 rounded-xl border border-white/[0.06] bg-black/10 p-0.5">
								{(["none", "blur", "solid", "image"] as const).map((mode) => (
									<TabsTrigger
										key={mode}
										value={mode}
										disabled={webcamControlsDisabled}
										className="rounded-lg text-[10px] font-semibold capitalize text-slate-400 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F59E0B] data-[state=active]:to-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-sm"
									>
										{mode}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						{resolvedWebcamEffects.backgroundMode === "solid" && (
							<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<label className="mb-1 block text-[11px] font-medium text-slate-300">
									Background color
								</label>
								<ColorPicker
									color={resolvedWebcamEffects.backgroundColor}
									colors={[
										"#0F172A",
										"#111827",
										"#1D4ED8",
										"#065F46",
										"#7C2D12",
										"#7C3AED",
										"#9A3412",
										"#111111",
									]}
									onChange={(color) =>
										onWebcamEffectsChange?.({
											backgroundColor: color.hex,
											presetId: "custom",
										})
									}
								/>
							</div>
						)}

						{resolvedWebcamEffects.backgroundMode === "image" && (
							<div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<div className="flex items-center justify-between gap-2">
									<div>
										<div className="text-[11px] font-medium text-slate-200">Background image</div>
										<div className="mt-0.5 text-[10px] text-slate-500">
											Pick an image to place behind the presenter cutout
										</div>
									</div>
									<Button
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => void handlePickWebcamBackgroundImage()}
										className="h-8 rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 px-2.5 text-[10px] font-semibold text-[#bfdbfe] hover:bg-[#3b82f6]/18"
									>
										<Upload className="mr-1.5 h-3 w-3" />
										Browse
									</Button>
								</div>
								<div className="truncate rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-2 text-[10px] text-slate-300">
									{resolvedWebcamEffects.backgroundImagePath ?? "No image selected"}
								</div>
								{resolvedWebcamEffects.backgroundImagePath ? (
									<div className="flex justify-end">
										<Button
											type="button"
											disabled={webcamControlsDisabled}
											onClick={() =>
												onWebcamEffectsChange?.({
													backgroundImagePath: "",
													presetId: "custom",
												})
											}
											className="h-7 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.08]"
										>
											Clear image
										</Button>
									</div>
								) : null}
							</div>
						)}

						{resolvedWebcamEffects.backgroundMode === "blur" && (
							<div className="rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label="Background blur"
									value={resolvedWebcamEffects.backgroundBlurStrength}
									defaultValue={12}
									min={0}
									max={32}
									step={1}
									onChange={(value) =>
										onWebcamEffectsChange?.({
											backgroundBlurStrength: value,
											presetId: "custom",
										})
									}
									formatValue={(value) => `${Math.round(value)}px`}
									parseInput={(text) => parseFloat(text.replace(/px$/i, ""))}
									disabled={webcamControlsDisabled}
								/>
							</div>
						)}

						{resolvedWebcamEffects.backgroundMode !== "none" &&
						webcamEffectCapability.canApplyEdgeFeather ? (
							<div className="mt-2 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label="Edge feather"
									value={resolvedWebcamEffects.edgeFeather}
									defaultValue={10}
									min={0}
									max={32}
									step={1}
									onChange={(value) =>
										onWebcamEffectsChange?.({ edgeFeather: value, presetId: "custom" })
									}
									formatValue={(value) => `${Math.round(value)}px`}
									parseInput={(text) => parseFloat(text.replace(/px$/i, ""))}
									disabled={webcamControlsDisabled}
								/>
							</div>
						) : null}

						{resolvedWebcamEffects.backgroundMode !== "none" &&
						!webcamEffectCapability.canApplyEdgeFeather ? (
							<div className="mt-2 rounded-xl border border-dashed border-white/[0.08] bg-black/10 px-3 py-2 text-[10px] text-slate-500">
								Edge feather becomes available when webcam background treatment is active in
								preview.
							</div>
						) : null}
					</div>

					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
						<div className="mb-2 text-[11px] font-semibold text-slate-200">Frame styling</div>
						<div className="grid grid-cols-3 gap-1.5">
							{(["circle", "square", "rectangle"] as const).map((shape) => (
								<Button
									key={shape}
									type="button"
									disabled={webcamControlsDisabled}
									onClick={() => onWebcamRegionChange?.({ shape })}
									className={cn(
										"h-9 rounded-xl border shadow-sm transition-all duration-200 justify-center",
										webcamRegion.shape === shape
											? "border-[#3b82f6] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-sm shadow-[#3b82f6]/20"
											: "border-white/[0.06] bg-black/10 text-slate-400 hover:bg-white/[0.08]",
									)}
								>
									<span className="text-[10px] font-semibold capitalize">{shape}</span>
								</Button>
							))}
						</div>

						<div className="mt-2 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
							<SliderControl
								label={tSettings("webcam.borderWidth")}
								value={webcamRegion.borderWidth}
								defaultValue={3}
								min={0}
								max={10}
								step={1}
								onChange={(v) => onWebcamRegionChange?.({ borderWidth: v })}
								formatValue={(v) => `${v}px`}
								parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
								disabled={webcamControlsDisabled}
							/>
						</div>

						{(webcamRegion.shape === "rectangle" || webcamRegion.shape === "square") && (
							<div className="mt-2 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
								<SliderControl
									label={tSettings("webcam.roundness")}
									value={webcamRegion.borderRadius}
									defaultValue={12}
									min={0}
									max={50}
									step={1}
									onChange={(v) => onWebcamRegionChange?.({ borderRadius: v })}
									formatValue={(v) => `${v}px`}
									parseInput={(t) => parseFloat(t.replace(/px$/, ""))}
									disabled={webcamControlsDisabled}
								/>
							</div>
						)}
					</div>

					{/*
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
						<div className="mb-2 flex items-center justify-between">
							<div>
								<div className="text-xs font-medium text-slate-300">Webcam health</div>
								<div className="mt-0.5 text-[10px] text-slate-500">
									Live preview quality and fallback state
								</div>
							</div>
							<Gauge className="h-4 w-4 text-[#F59E0B]" />
						</div>
						<div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Preview mode</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.previewMode ?? webcamPreviewMode).replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Target FPS</div>
								<div className="mt-1 font-semibold">
									{Math.round(webcamHealthMetrics?.targetFps ?? 0)}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Observed FPS</div>
								<div className="mt-1 font-semibold">
									{(webcamHealthMetrics?.observedFps ?? 0).toFixed(1)}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Segmentation FPS</div>
								<div className="mt-1 font-semibold">
									{(webcamHealthMetrics?.segmentationFps ?? 0).toFixed(1)}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Dropped ratio</div>
								<div className="mt-1 font-semibold">
									{Math.round((webcamHealthMetrics?.droppedFrameRatio ?? 0) * 100)}%
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Fallback</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.effectFallbackState ?? "none").replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Preview tier</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.previewQualityTier ?? "full-preview").replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Configured mode</div>
								<div className="mt-1 font-semibold capitalize">
									{webcamHealthMetrics?.configuredBackgroundMode ?? "none"}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Applied mode</div>
								<div className="mt-1 font-semibold capitalize">
									{webcamHealthMetrics?.appliedBackgroundMode ?? "none"}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Segmentation size</div>
								<div className="mt-1 font-semibold">
									{webcamHealthMetrics?.segmentationWorkingWidth &&
									webcamHealthMetrics?.segmentationWorkingHeight
										? `${webcamHealthMetrics.segmentationWorkingWidth}×${webcamHealthMetrics.segmentationWorkingHeight}`
										: "n/a"}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Render scale</div>
								<div className="mt-1 font-semibold">
									{webcamHealthMetrics?.renderResolutionScale
										? `${webcamHealthMetrics.renderResolutionScale.toFixed(2)}x`
										: "n/a"}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Segmentation provider</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.segmentationProviderStatus ?? "not-required").replace(
										/-/g,
										" ",
									)}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Drift</div>
								<div className="mt-1 font-semibold">
									{`${Math.round(webcamHealthMetrics?.driftMs ?? 0)}ms`}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Render latency</div>
								<div className="mt-1 font-semibold">
									{`${Math.round(webcamHealthMetrics?.renderLatencyMs ?? 0)}ms`}
								</div>
							</div>
							<div className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2">
								<div className="text-slate-500">Frame queue</div>
								<div className="mt-1 font-semibold">
									{Math.round(webcamHealthMetrics?.frameQueueDepth ?? 0)}
								</div>
							</div>
						</div>
						{webcamHealthMetrics?.fallbackReason ? (
							<div className="mt-2 rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-2 text-[10px] text-slate-400">
								{webcamHealthMetrics.fallbackReason}
							</div>
						) : null}
					</div>
					*/}
				</SettingsSection>

				{showAdvancedWebcam && (
					<SettingsSection
						title="Advanced"
						description="Fine-tune opacity, framing, color response, and optional raw path overrides"
						accentColor="blue"
						className="animate-in fade-in slide-in-from-top-2 duration-200"
					>
						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<SliderControl
								label={tSettings("webcam.opacity")}
								value={webcamRegion.opacity}
								defaultValue={1}
								min={0.1}
								max={1}
								step={0.05}
								onChange={(v) => onWebcamRegionChange?.({ opacity: v })}
								formatValue={(v) => `${Math.round(v * 100)}%`}
								parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
								disabled={webcamControlsDisabled}
							/>
						</div>

						<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
							<SliderControl
								label="Portrait scale"
								value={resolvedWebcamEffects.portraitScale}
								defaultValue={1}
								min={0.9}
								max={1.3}
								step={0.01}
								onChange={(value) =>
									onWebcamEffectsChange?.({ portraitScale: value, presetId: "custom" })
								}
								formatValue={(value) => `${Math.round(value * 100)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
								disabled={webcamControlsDisabled}
							/>
						</div>

						<div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
							<div>
								<div className="text-xs font-medium text-slate-300">Subtle avoidance</div>
								<div className="mt-0.5 text-[10px] text-slate-500">
									Move the webcam away from cursor hotspots when possible
								</div>
							</div>
							<Switch
								checked={resolvedWebcamEffects.subtleAvoidance}
								onCheckedChange={(checked) =>
									onWebcamEffectsChange?.({ subtleAvoidance: checked, presetId: "custom" })
								}
								disabled={webcamControlsDisabled}
								className="data-[state=checked]:bg-[#F59E0B] scale-90"
							/>
						</div>

						{resolvedWebcamEffects.backgroundMode === "image" && (
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors duration-200">
								<label className="mb-1 block text-[11px] font-medium text-slate-300">
									Background image path
								</label>
								<input
									type="text"
									value={resolvedWebcamEffects.backgroundImagePath ?? ""}
									disabled={webcamControlsDisabled}
									onChange={(event) =>
										onWebcamEffectsChange?.({
											backgroundImagePath: event.target.value,
											presetId: "custom",
										})
									}
									placeholder="/path/to/image.png"
									className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-xs text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-[#3b82f6]/50"
								/>
							</div>
						)}

						<div className="grid grid-cols-2 gap-2">
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label="Exposure"
									value={resolvedWebcamEffects.exposure}
									defaultValue={0}
									min={-0.6}
									max={0.6}
									step={0.02}
									onChange={(value) =>
										onWebcamEffectsChange?.({ exposure: value, presetId: "custom" })
									}
									formatValue={(value) => value.toFixed(2)}
									parseInput={(text) => parseFloat(text)}
									disabled={webcamControlsDisabled}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label="Contrast"
									value={resolvedWebcamEffects.contrast}
									defaultValue={1}
									min={0.7}
									max={1.6}
									step={0.02}
									onChange={(value) =>
										onWebcamEffectsChange?.({ contrast: value, presetId: "custom" })
									}
									formatValue={(value) => value.toFixed(2)}
									parseInput={(text) => parseFloat(text)}
									disabled={webcamControlsDisabled}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label="Saturation"
									value={resolvedWebcamEffects.saturation}
									defaultValue={1}
									min={0.2}
									max={1.8}
									step={0.02}
									onChange={(value) =>
										onWebcamEffectsChange?.({ saturation: value, presetId: "custom" })
									}
									formatValue={(value) => value.toFixed(2)}
									parseInput={(text) => parseFloat(text)}
									disabled={webcamControlsDisabled}
								/>
							</div>
							<div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
								<SliderControl
									label="Warmth"
									value={resolvedWebcamEffects.warmth}
									defaultValue={0}
									min={-1}
									max={1}
									step={0.02}
									onChange={(value) =>
										onWebcamEffectsChange?.({ warmth: value, presetId: "custom" })
									}
									formatValue={(value) => value.toFixed(2)}
									parseInput={(text) => parseFloat(text)}
									disabled={webcamControlsDisabled}
								/>
							</div>
						</div>
					</SettingsSection>
				)}
			</DisabledSettingsGroup>
		</TabContent>
	);
}
