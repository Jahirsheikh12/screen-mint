import { AlertTriangle, ChevronDown, ChevronUp, Gauge, Sparkles, Upload } from "lucide-react";
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
import {
	CAMERA_ZOOM_SCALE_DISABLED,
	DEFAULT_WEBCAM_SOURCE_CROP,
	getRecommendedWebcamDefaults,
	MAX_WEBCAM_SOURCE_CROP,
	type WebcamSourceCrop,
} from "../types";

const WEBCAM_CROP_SIDES: readonly (keyof WebcamSourceCrop)[] = ["top", "bottom", "left", "right"];

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
	/** Linked webcam footage for this video, if any. */
	webcamPath?: string | null;
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
				container: "border-accent/20 bg-accent/10",
				title: "text-fg",
				body: "text-fg-muted",
			};
		case "info":
			return {
				container: "border-accent/20 bg-accent/10",
				title: "text-fg",
				body: "text-fg-muted",
			};
		case "neutral":
		default:
			return {
				container: "border-line bg-sunken",
				title: "text-fg",
				body: "text-fg-muted",
			};
	}
}

export function WebcamSettingsTab({
	tSettings,
	aspectRatio,
	webcamMissing,
	missingWebcamPath,
	webcamPath,
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
	const hasWebcamCrop = WEBCAM_CROP_SIDES.some(
		(side) => resolvedWebcamEffects.sourceCrop[side] > 0,
	);
	const webcamEffectCapability = useMemo(
		() =>
			resolveWebcamEffectCapability({
				effects: resolvedWebcamEffects,
				healthMetrics: webcamHealthMetrics,
			}),
		[resolvedWebcamEffects, webcamHealthMetrics],
	);
	const webcamStatusKey =
		webcamEffectCapability.fallbackState !== "none"
			? webcamEffectCapability.fallbackState
			: resolvedWebcamEffects.backgroundMode === "none"
				? "raw"
				: "active";
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
			toast.error(
				tSettings("webcamTab.pickImageFailed", "Failed to select webcam background image."),
			);
		}
	};

	return (
		<TabContent>
			<TabHeader
				title={tSettings("webcam.title")}
				description={tSettings(
					"webcamTab.configureYourWebcamOverlay",
					"Configure your webcam overlay display",
				)}
				badge={selectedCameraLayout ? tSettings("webcam.layoutBadge") : undefined}
				badgeColor="amber"
			/>

			{webcamMissing && (
				<div className="rounded-lg border border-accent/25 bg-accent/10 p-3 text-label text-fg mb-4">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
						<div className="min-w-0">
							<div className="font-semibold text-fg">{tSettings("webcam.missingTitle")}</div>
							<div className="mt-1 text-fg-muted">{tSettings("webcam.missingDescription")}</div>
							{missingWebcamPath && (
								<div className="mt-2 truncate rounded-md bg-sunken px-2 py-1 font-mono text-micro text-fg-muted">
									{missingWebcamPath}
								</div>
							)}
							<div className="mt-3 grid grid-cols-2 gap-2">
								<Button
									variant="outline"
									type="button"
									onClick={onRelinkMissingWebcam}
									className="h-8 rounded-lg border border-accent/30 bg-accent/15 text-micro font-semibold text-fg hover:bg-accent/25 transition-colors duration-200"
								>
									{tSettings("webcam.relink")}
								</Button>
								<Button
									variant="outline"
									type="button"
									onClick={onRemoveMissingWebcam}
									className="h-8 rounded-lg border border-line-strong bg-fill-subtle text-micro font-semibold text-fg hover:bg-fill-hover transition-colors duration-200"
								>
									{tSettings("webcam.remove")}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{!webcamMissing && (
				<SettingsSection
					title={tSettings("webcamTab.webcamFootage", "Webcam Footage")}
					description={
						webcamPath
							? tSettings("webcamTab.footageLinked", "Footage linked to this video")
							: tSettings("webcamTab.noFootage", "No webcam footage linked to this video")
					}
				>
					{webcamPath && (
						<div className="truncate rounded-lg border border-line bg-fill-subtle px-2.5 py-2 font-mono text-micro text-fg-muted">
							{webcamPath.split(/[\\/]/).pop()}
						</div>
					)}
					<div className={cn("grid gap-2", webcamPath ? "grid-cols-2" : "grid-cols-1")}>
						<Button
							variant="outline"
							type="button"
							onClick={onRelinkMissingWebcam}
							className="h-8 rounded-lg border border-accent/25 bg-accent/10 text-micro font-semibold text-accent-fg hover:bg-accent/18"
						>
							<Upload className="mr-1.5 h-3 w-3" />
							{webcamPath
								? tSettings("webcamTab.replaceFootage", "Replace footage")
								: tSettings("webcamTab.uploadFootage", "Upload footage")}
						</Button>
						{webcamPath && (
							<Button
								variant="outline"
								type="button"
								onClick={onRemoveMissingWebcam}
								className="h-8 rounded-lg border border-line-strong bg-fill-subtle text-micro font-semibold text-fg hover:bg-fill-hover"
							>
								{tSettings("webcamTab.removeFootage", "Remove footage")}
							</Button>
						)}
					</div>
				</SettingsSection>
			)}

			<SettingsSection
				title={tSettings("webcamTab.display", "Display")}
				description={tSettings("webcamTab.showOrHideYour", "Show or hide your webcam overlay")}
			>
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						variant="outline"
						type="button"
						onClick={onResetRecommendedWebcam}
						disabled={webcamControlsDisabled}
						className="h-8 rounded-lg border border-accent/25 bg-accent/10 text-micro font-semibold text-accent-fg hover:bg-accent/18 transition-colors duration-200"
					>
						{tSettings("webcam.resetRecommended")}
					</Button>
					{selectedCameraLayout ? (
						<Button
							variant="outline"
							type="button"
							onClick={onResetSelectedCameraLayout}
							disabled={webcamControlsDisabled}
							className="h-8 rounded-lg border border-accent/25 bg-accent/10 text-micro font-semibold text-accent-fg hover:bg-accent/18 transition-colors duration-200"
						>
							{tSettings("webcam.resetLayout")}
						</Button>
					) : (
						<div className="h-8 rounded-lg border border-line bg-fill-subtle px-2 text-micro font-medium text-fg-subtle flex items-center justify-center">
							{tSettings("webcam.recommendedDefaults")}
						</div>
					)}
				</div>

				<DisabledSettingsGroup disabled={webcamControlsDisabled}>
					{selectedCameraLayout && (
						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
							<label className="text-label font-medium text-fg-muted mb-2 block">
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
										variant="outline"
										key={mode}
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => onCameraLayoutChange?.(selectedCameraLayout.id, { mode })}
										className={cn(
											"h-9 rounded-lg border shadow-sm transition-all duration-200 justify-center",
											selectedCameraLayout.mode === mode
												? "border-accent/50 bg-accent/12 text-accent-fg"
												: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover",
										)}
									>
										<span className="text-label font-semibold">{label}</span>
									</Button>
								))}
							</div>
							<div className="mt-3 grid grid-cols-1 gap-2">
								<div className="rounded-lg border border-line bg-fill-subtle p-2">
									<SliderControl
										label={tSettings("webcamTab.transitionIn", "Transition in")}
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
								<div className="rounded-lg border border-line bg-fill-subtle p-2">
									<SliderControl
										label={tSettings("webcamTab.transitionOut", "Transition out")}
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
								<div className="rounded-lg border border-line bg-fill-subtle p-2">
									<label className="mb-2 block text-label font-medium text-fg-muted">
										{tSettings("webcamTab.motionPreset", "Motion preset")}
									</label>
									<div className="grid grid-cols-3 gap-1.5">
										{(["focused", "smooth", "instant"] as const).map((preset) => (
											<Button
												variant="outline"
												key={preset}
												type="button"
												disabled={webcamControlsDisabled}
												onClick={() =>
													onCameraLayoutChange?.(selectedCameraLayout.id, {
														motionPreset: preset,
													})
												}
												className={cn(
													"h-8 rounded-lg border text-micro transition-all duration-200",
													(selectedCameraLayout.motionPreset ?? "focused") === preset
														? "border-accent/40 bg-accent/10 text-accent-fg"
														: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover",
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

				<div className="flex items-center justify-between p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
					<div>
						<div className="text-label font-medium text-fg-muted">
							{tSettings("webcam.showWebcam")}
						</div>
						<div className="text-micro text-fg-subtle mt-0.5">
							{tSettings("webcamTab.displayWebcamInThe", "Display webcam in the export")}
						</div>
					</div>
					<Switch checked={showWebcam} onCheckedChange={onShowWebcamChange} />
				</div>

				<DisabledSettingsGroup disabled={webcamControlsDisabled}>
					<div className="flex items-center justify-between p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<div>
							<div className="text-label font-medium text-fg-muted">
								{tSettings("webcam.mirrorCamera")}
							</div>
							<div className="text-micro text-fg-subtle mt-0.5">
								{tSettings(
									"webcamTab.horizontallyFlipTheWebcam",
									"Horizontally flip the webcam feed",
								)}
							</div>
						</div>
						<Switch
							checked={mirrorWebcam}
							onCheckedChange={onMirrorWebcamChange}
							disabled={webcamControlsDisabled}
						/>
					</div>
				</DisabledSettingsGroup>
			</SettingsSection>

			<DisabledSettingsGroup disabled={webcamControlsDisabled}>
				<SettingsSection
					title={tSettings("webcamTab.positionSize", "Position & Size")}
					description={tSettings(
						"webcamTab.placeAndResizeYour",
						"Place and resize your webcam on the canvas",
					)}
				>
					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<label className="text-label font-medium text-fg-muted mb-2 block">
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
									variant="outline"
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
										"h-8 rounded-lg border text-micro transition-all duration-200",
										webcamRegion.anchor === preset.anchor
											? "border-accent/40 bg-accent/10 text-accent-fg shadow-sm"
											: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover",
									)}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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

					<div className="space-y-1 p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
						<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
							<span className="min-w-0 break-words text-label font-medium text-fg-muted">
								{tSettings("webcamTab.crop", "Crop")}
							</span>
							<button
								type="button"
								onClick={() => onWebcamEffectsChange?.({ sourceCrop: DEFAULT_WEBCAM_SOURCE_CROP })}
								disabled={webcamControlsDisabled || !hasWebcamCrop}
								className="shrink-0 text-micro font-medium text-accent-fg transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								{tSettings("webcamTab.resetCrop", "Reset")}
							</button>
						</div>
						{WEBCAM_CROP_SIDES.map((side) => (
							<SliderControl
								key={side}
								label={tSettings(`webcamTab.cropSides.${side}`)}
								value={Math.round(resolvedWebcamEffects.sourceCrop[side] * 100)}
								defaultValue={0}
								min={0}
								max={MAX_WEBCAM_SOURCE_CROP * 100}
								step={1}
								onChange={(v) =>
									onWebcamEffectsChange?.({
										sourceCrop: { ...resolvedWebcamEffects.sourceCrop, [side]: v / 100 },
									})
								}
								formatValue={(v) => `${Math.round(v)}%`}
								parseInput={(t) => parseFloat(t.replace(/%$/, ""))}
								disabled={webcamControlsDisabled}
							/>
						))}
					</div>

					<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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
						<p className="mt-2 text-micro leading-relaxed text-fg-subtle">
							{tSettings("webcam.cameraDuringZoomHint")}
						</p>
					</div>
				</SettingsSection>

				<SettingsSection
					title={tSettings("webcamTab.appearance", "Appearance")}
					description={tSettings(
						"webcamTab.matchTheWebcamLook",
						"Match the webcam look and treatment to the rest of your edit",
					)}
				>
					<div className="rounded-lg border border-line bg-fill-subtle p-3">
						<div className="mb-2 flex items-center justify-between">
							<div>
								<div className="text-caption font-semibold text-fg">
									{tSettings("webcamTab.studioPresets", "Studio presets")}
								</div>
								<div className="mt-0.5 text-micro text-fg-subtle">
									{tSettings(
										"webcamTab.startFromATuned",
										"Start from a tuned webcam style and refine from there",
									)}
								</div>
							</div>
							<Sparkles className="h-4 w-4 text-accent-fg" />
						</div>
						<div className="grid grid-cols-2 gap-1.5">
							{webcamStylePresets.map((preset) => (
								<Button
									variant="outline"
									key={preset.id}
									type="button"
									disabled={webcamControlsDisabled}
									onClick={() => onApplyWebcamPreset?.(preset.id)}
									className={cn(
										"h-9 rounded-lg border px-2 text-micro font-semibold transition-all duration-200",
										resolvedWebcamEffects.presetId === preset.id
											? "border-accent/40 bg-gradient-to-r from-accent/20 to-accent-hover/10 text-accent-fg shadow-sm"
											: "border-line bg-sunken text-fg-muted hover:bg-fill-hover",
									)}
								>
									{tSettings(`webcamTab.presets.${preset.id}`, preset.label)}
								</Button>
							))}
						</div>
					</div>

					<div className="rounded-lg border border-line bg-fill-subtle p-3">
						<div className="mb-3 flex items-center justify-between">
							<div>
								<div className="text-caption font-semibold text-fg">
									{tSettings("webcamTab.backgroundTreatment", "Background treatment")}
								</div>
								<div className="mt-0.5 text-micro text-fg-subtle">
									{tSettings(
										"webcamTab.chooseHowTheWebcam",
										"Choose how the webcam background is separated and styled",
									)}
								</div>
							</div>
							<Gauge className="h-4 w-4 text-accent-fg" />
						</div>

						<div
							className={cn(
								"mb-3 rounded-lg border px-3 py-2.5",
								webcamTreatmentStatusClasses.container,
							)}
						>
							<div className={cn("text-caption font-semibold", webcamTreatmentStatusClasses.title)}>
								{tSettings(
									`webcamTab.status.${webcamStatusKey}.title`,
									webcamEffectCapability.statusTitle,
								)}
							</div>
							<div
								className={cn(
									"mt-0.5 text-micro leading-relaxed",
									webcamTreatmentStatusClasses.body,
								)}
							>
								{tSettings(
									`webcamTab.status.${webcamStatusKey}.description`,
									webcamEffectCapability.statusDescription,
								)}
							</div>
							{webcamEffectCapability.configuredBackgroundMode !==
							webcamEffectCapability.appliedBackgroundMode ? (
								<div className="mt-2 text-micro text-fg-muted">
									Applied in preview:{" "}
									<span className="font-medium capitalize text-fg">
										{webcamEffectCapability.appliedBackgroundMode}
									</span>
								</div>
							) : null}
						</div>

						<div className="mb-3 rounded-lg border border-line bg-fill-subtle p-2.5">
							<div className="mb-2 text-caption font-medium text-fg-muted">
								{tSettings("webcamTab.previewMode", "Preview mode")}
							</div>
							<div className="grid grid-cols-3 gap-1.5">
								{(
									[
										["exact", "Exact Match"],
										["performance", "Performance"],
										["power-saving", "Power Saving"],
									] as const
								).map(([mode, label]) => (
									<Button
										variant="outline"
										key={mode}
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => onWebcamPreviewModeChange?.(mode)}
										className={cn(
											"h-8 rounded-lg border text-micro transition-all duration-200",
											webcamPreviewMode === mode
												? "border-accent/40 bg-accent/12 text-accent-fg"
												: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover",
										)}
									>
										{tSettings(`webcamTab.mode.${mode}`, label)}
									</Button>
								))}
							</div>
							<div className="mt-2 text-micro text-fg-subtle">
								{webcamPreviewMode === "exact"
									? tSettings(
											"webcamTab.exactHint",
											"Preview uses export-reference webcam rendering and warns instead of silently downgrading.",
										)
									: webcamPreviewMode === "performance"
										? tSettings(
												"webcamTab.performanceHint",
												"Keeps webcam preview smooth with deterministic reduced-cost rendering.",
											)
										: tSettings(
												"webcamTab.powerSavingHint",
												"Minimizes webcam preview CPU/GPU cost with simplified treatment.",
											)}
							</div>
							{exactPreviewNeedsWarning ? (
								<div className="mt-2 rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-2 text-micro text-fg">
									{tSettings(
										"webcamTab.exactMatchIsCurrently",
										"Exact Match is currently under load. Export stays deterministic, but preview is struggling right now. Switch to Performance mode if you want smoother editing.",
									)}
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
							<TabsList className="mb-3 grid h-9 w-full grid-cols-4 rounded-lg border border-line bg-fill-subtle p-0.5">
								{(["none", "blur", "solid", "image"] as const).map((mode) => (
									<TabsTrigger
										key={mode}
										value={mode}
										disabled={webcamControlsDisabled}
										className="rounded-lg text-micro font-semibold capitalize text-fg-muted transition-all duration-200 data-[state=active]:bg-control data-[state=active]:text-fg data-[state=active]:shadow-sm"
									>
										{mode}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						{resolvedWebcamEffects.backgroundMode === "solid" && (
							<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
								<label className="mb-1 block text-caption font-medium text-fg-muted">
									{tSettings("webcamTab.backgroundColor", "Background color")}
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
							<div className="space-y-2 rounded-lg border border-line bg-fill-subtle p-2.5">
								<div className="flex items-center justify-between gap-2">
									<div>
										<div className="text-caption font-medium text-fg">
											{tSettings("webcamTab.backgroundImage", "Background image")}
										</div>
										<div className="mt-0.5 text-micro text-fg-subtle">
											{tSettings(
												"webcamTab.pickAnImageTo",
												"Pick an image to place behind the presenter cutout",
											)}
										</div>
									</div>
									<Button
										variant="outline"
										type="button"
										disabled={webcamControlsDisabled}
										onClick={() => void handlePickWebcamBackgroundImage()}
										className="h-8 rounded-lg border border-accent/25 bg-accent/10 px-2.5 text-micro font-semibold text-accent-fg hover:bg-accent/18"
									>
										<Upload className="mr-1.5 h-3 w-3" />
										{tSettings("webcamTab.browse", "Browse")}
									</Button>
								</div>
								<div className="truncate rounded-lg border border-line bg-fill-subtle px-2.5 py-2 text-micro text-fg-muted">
									{resolvedWebcamEffects.backgroundImagePath ??
										tSettings("webcamTab.noImage", "No image selected")}
								</div>
								{resolvedWebcamEffects.backgroundImagePath ? (
									<div className="flex justify-end">
										<Button
											variant="outline"
											type="button"
											disabled={webcamControlsDisabled}
											onClick={() =>
												onWebcamEffectsChange?.({
													backgroundImagePath: "",
													presetId: "custom",
												})
											}
											className="h-7 rounded-lg border border-line bg-fill-subtle px-2.5 text-micro font-semibold text-fg-muted hover:bg-fill-hover"
										>
											{tSettings("webcamTab.clearImage", "Clear image")}
										</Button>
									</div>
								) : null}
							</div>
						)}

						{resolvedWebcamEffects.backgroundMode === "blur" && (
							<div className="rounded-lg border border-line bg-fill-subtle p-2.5">
								<SliderControl
									label={tSettings("webcamTab.backgroundBlur", "Background blur")}
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
							<div className="mt-2 rounded-lg border border-line bg-fill-subtle p-2.5">
								<SliderControl
									label={tSettings("webcamTab.edgeFeather", "Edge feather")}
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
							<div className="mt-2 rounded-lg border border-dashed border-line bg-fill-subtle px-3 py-2 text-micro text-fg-subtle">
								{tSettings(
									"webcamTab.edgeFeatherBecomesAvailable",
									"Edge feather becomes available when webcam background treatment is active in preview.",
								)}
							</div>
						) : null}
					</div>

					<div className="rounded-lg border border-line bg-fill-subtle p-3">
						<div className="mb-2 text-caption font-semibold text-fg">
							{tSettings("webcamTab.frameStyling", "Frame styling")}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{(["circle", "square", "rectangle"] as const).map((shape) => (
								<Button
									variant="outline"
									key={shape}
									type="button"
									disabled={webcamControlsDisabled}
									onClick={() => onWebcamRegionChange?.({ shape })}
									className={cn(
										"h-9 rounded-lg border shadow-sm transition-all duration-200 justify-center",
										webcamRegion.shape === shape
											? "border-accent/50 bg-accent/12 text-accent-fg"
											: "border-line bg-sunken text-fg-muted hover:bg-fill-hover",
									)}
								>
									<span className="text-micro font-semibold capitalize">{shape}</span>
								</Button>
							))}
						</div>

						<div className="mt-2 rounded-lg border border-line bg-fill-subtle p-2.5">
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
							<div className="mt-2 rounded-lg border border-line bg-fill-subtle p-2.5">
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
					<div className="rounded-lg border border-line bg-fill-subtle p-3">
						<div className="mb-2 flex items-center justify-between">
							<div>
								<div className="text-label font-medium text-fg-muted">{tSettings("webcamTab.webcamHealth", "Webcam health")}</div>
								<div className="mt-0.5 text-micro text-fg-subtle">
									{tSettings("webcamTab.livePreviewQualityAnd", "Live preview quality and fallback state")}
								</div>
							</div>
							<Gauge className="h-4 w-4 text-accent-fg" />
						</div>
						<div className="grid grid-cols-2 gap-2 text-caption text-fg-muted">
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.previewMode", "Preview mode")}</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.previewMode ?? webcamPreviewMode).replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.targetFps", "Target FPS")}</div>
								<div className="mt-1 font-semibold">
									{Math.round(webcamHealthMetrics?.targetFps ?? 0)}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.observedFps", "Observed FPS")}</div>
								<div className="mt-1 font-semibold">
									{(webcamHealthMetrics?.observedFps ?? 0).toFixed(1)}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.segmentationFps", "Segmentation FPS")}</div>
								<div className="mt-1 font-semibold">
									{(webcamHealthMetrics?.segmentationFps ?? 0).toFixed(1)}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.droppedRatio", "Dropped ratio")}</div>
								<div className="mt-1 font-semibold">
									{Math.round((webcamHealthMetrics?.droppedFrameRatio ?? 0) * 100)}%
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.fallback", "Fallback")}</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.effectFallbackState ?? "none").replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.previewTier", "Preview tier")}</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.previewQualityTier ?? "full-preview").replace(/-/g, " ")}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.configuredMode", "Configured mode")}</div>
								<div className="mt-1 font-semibold capitalize">
									{webcamHealthMetrics?.configuredBackgroundMode ?? "none"}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.appliedMode", "Applied mode")}</div>
								<div className="mt-1 font-semibold capitalize">
									{webcamHealthMetrics?.appliedBackgroundMode ?? "none"}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.segmentationSize", "Segmentation size")}</div>
								<div className="mt-1 font-semibold">
									{webcamHealthMetrics?.segmentationWorkingWidth &&
									webcamHealthMetrics?.segmentationWorkingHeight
										? `${webcamHealthMetrics.segmentationWorkingWidth}×${webcamHealthMetrics.segmentationWorkingHeight}`
										: "n/a"}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.renderScale", "Render scale")}</div>
								<div className="mt-1 font-semibold">
									{webcamHealthMetrics?.renderResolutionScale
										? `${webcamHealthMetrics.renderResolutionScale.toFixed(2)}x`
										: "n/a"}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.segmentationProvider", "Segmentation provider")}</div>
								<div className="mt-1 font-semibold capitalize">
									{(webcamHealthMetrics?.segmentationProviderStatus ?? "not-required").replace(
										/-/g,
										" ",
									)}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.drift", "Drift")}</div>
								<div className="mt-1 font-semibold">
									{`${Math.round(webcamHealthMetrics?.driftMs ?? 0)}ms`}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.renderLatency", "Render latency")}</div>
								<div className="mt-1 font-semibold">
									{`${Math.round(webcamHealthMetrics?.renderLatencyMs ?? 0)}ms`}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="text-fg-subtle">{tSettings("webcamTab.frameQueue", "Frame queue")}</div>
								<div className="mt-1 font-semibold">
									{Math.round(webcamHealthMetrics?.frameQueueDepth ?? 0)}
								</div>
							</div>
						</div>
						{webcamHealthMetrics?.fallbackReason ? (
							<div className="mt-2 rounded-lg border border-line bg-fill-subtle px-2.5 py-2 text-micro text-fg-muted">
								{webcamHealthMetrics.fallbackReason}
							</div>
						) : null}
					</div>
					*/}
				</SettingsSection>

				<div className="mb-3 rounded-lg border border-line bg-fill-subtle px-3 py-2.5 transition-colors duration-200 hover:border-line-strong">
					<button
						type="button"
						onClick={onToggleAdvancedWebcam}
						disabled={webcamControlsDisabled}
						className="flex w-full items-center justify-between text-left disabled:cursor-not-allowed"
					>
						<div>
							<div className="text-label font-semibold text-fg">
								{showAdvancedWebcam
									? tSettings("webcam.hideAdvanced")
									: tSettings("webcam.showAdvanced")}
							</div>
							<div className="mt-0.5 text-micro text-fg-subtle">
								{tSettings(
									"webcamTab.fineTuneOpacityFraming2",
									"Fine-tune opacity, framing, color response, and optional raw path overrides.",
								)}
							</div>
						</div>
						{showAdvancedWebcam ? (
							<ChevronUp className="h-4 w-4 text-fg-muted" />
						) : (
							<ChevronDown className="h-4 w-4 text-fg-muted" />
						)}
					</button>
				</div>

				{showAdvancedWebcam && (
					<SettingsSection
						title={tSettings("webcamTab.advanced", "Advanced")}
						description={tSettings(
							"webcamTab.fineTuneOpacityFraming",
							"Fine-tune opacity, framing, color response, and optional raw path overrides",
						)}
						className="animate-in fade-in slide-in-from-top-2 duration-200"
					>
						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
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

						<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
							<SliderControl
								label={tSettings("webcamTab.portraitScale", "Portrait scale")}
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

						<div className="flex items-center justify-between rounded-lg border border-line bg-fill-subtle p-2.5">
							<div>
								<div className="text-label font-medium text-fg-muted">
									{tSettings("webcamTab.subtleAvoidance", "Subtle avoidance")}
								</div>
								<div className="mt-0.5 text-micro text-fg-subtle">
									{tSettings(
										"webcamTab.moveTheWebcamAway",
										"Move the webcam away from cursor hotspots when possible",
									)}
								</div>
							</div>
							<Switch
								checked={resolvedWebcamEffects.subtleAvoidance}
								onCheckedChange={(checked) =>
									onWebcamEffectsChange?.({ subtleAvoidance: checked, presetId: "custom" })
								}
								disabled={webcamControlsDisabled}
							/>
						</div>

						{resolvedWebcamEffects.backgroundMode === "image" && (
							<div className="p-2.5 rounded-lg bg-fill-subtle border border-line hover:border-line-strong transition-colors duration-200">
								<label className="mb-1 block text-caption font-medium text-fg-muted">
									{tSettings("webcamTab.backgroundImagePath", "Background image path")}
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
									className="h-9 w-full rounded-md border border-line bg-sunken px-3 text-label text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent/50"
								/>
							</div>
						)}

						<div className="grid grid-cols-2 gap-2">
							<div className="p-2.5 rounded-lg bg-fill-subtle border border-line">
								<SliderControl
									label={tSettings("webcamTab.exposure", "Exposure")}
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
							<div className="p-2.5 rounded-lg bg-fill-subtle border border-line">
								<SliderControl
									label={tSettings("webcamTab.contrast", "Contrast")}
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
							<div className="p-2.5 rounded-lg bg-fill-subtle border border-line">
								<SliderControl
									label={tSettings("webcamTab.saturation", "Saturation")}
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
							<div className="p-2.5 rounded-lg bg-fill-subtle border border-line">
								<SliderControl
									label={tSettings("webcamTab.warmth", "Warmth")}
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
