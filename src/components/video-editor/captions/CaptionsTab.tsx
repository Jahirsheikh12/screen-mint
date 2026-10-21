import { Captions, Loader2, MoveDiagonal, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { ColorPicker } from "../ColorPicker";
import {
	createUserCaptionPreset,
	deleteUserCaptionPreset,
	getBuiltInCaptionPresets,
	loadUserCaptionPresets,
	samePresetStyle,
	saveUserCaptionPreset,
} from "../captionPresets";
import { parseCaptionTranscript } from "../captionTranscript";
import { SliderControl } from "../SliderControl";
import {
	CAPTION_STYLE_PRESETS,
	type CaptionAnimationMode,
	type CaptionGenerationOptions,
	type CaptionGenerationProgress,
	type CaptionModel,
	type CaptionModelStatus,
	type CaptionPosition,
	type CaptionRegion,
	type CaptionSegment,
	type CaptionSettings,
	type CaptionStyle,
	type CaptionStylePreset,
	type CaptionUserPreset,
	DEFAULT_CAPTION_GENERATION_OPTIONS,
} from "../types";

const ANIMATION_MODES: {
	value: CaptionAnimationMode;
	i18nKey: string;
	fallback: string;
	description: string;
}[] = [
	{
		value: "static",
		i18nKey: "editor.captions.animation.static",
		fallback: "Static",
		description: "No animation",
	},
	{
		value: "fade",
		i18nKey: "editor.captions.animation.fade",
		fallback: "Fade",
		description: "Fade in/out per segment",
	},
	{
		value: "pop",
		i18nKey: "editor.captions.animation.pop",
		fallback: "Pop",
		description: "Scale-in bounce",
	},
	{
		value: "rise",
		i18nKey: "editor.captions.animation.rise",
		fallback: "Rise",
		description: "Slide up while fading in",
	},
	{
		value: "active-word",
		i18nKey: "editor.captions.animation.activeWord",
		fallback: "Active word",
		description: "Highlight current word",
	},
	{
		value: "typewriter",
		i18nKey: "editor.captions.animation.typewriter",
		fallback: "Typewriter",
		description: "Reveal words one at a time",
	},
	{
		value: "karaoke-fill",
		i18nKey: "editor.captions.animation.karaokeFill",
		fallback: "Karaoke fill",
		description: "Progressive color fill",
	},
];

const POSITION_OPTIONS: CaptionPosition[] = ["top", "center", "bottom"];
const POSITION_LABELS: Record<CaptionPosition, string> = {
	top: "Top",
	center: "Center",
	bottom: "Bottom",
};
const FONT_FAMILIES: { label: string; value: string }[] = [
	{ label: "System", value: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif' },
	{ label: "Inter", value: "Inter, system-ui, sans-serif" },
	{ label: "Arial", value: "Arial, sans-serif" },
	{ label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
	{ label: "Georgia", value: "Georgia, serif" },
	{ label: "Courier", value: '"Courier New", Courier, monospace' },
];

export interface CaptionsTabProps {
	captionRegions: CaptionRegion[];
	captionSettings: CaptionSettings;
	captionGenerationOptions?: CaptionGenerationOptions;
	captionGenerationProgress?: CaptionGenerationProgress | null;
	captionModelStatus?: CaptionModelStatus | null;
	onDeleteCaptionModel?: (model: CaptionModel) => void;
	onCustomWhisperFile?: (kind: "model" | "executable", action: "choose" | "clear") => void;
	isTranscribing?: boolean;
	selectedCaptionId?: string | null;
	isEditingCaptionPosition: boolean;
	onToggleCaptionPositionEditing: (next: boolean) => void;
	onCaptionSettingsChange: (settings: Partial<CaptionSettings>) => void;
	onCaptionStyleChange: (style: Partial<CaptionStyle>) => void;
	onCaptionStylePresetChange?: (preset: CaptionStylePreset) => void;
	onApplyCaptionPreset: (preset: CaptionUserPreset) => void;
	onCaptionGenerationOptionsChange?: (options: Partial<CaptionGenerationOptions>) => void;
	onCaptionTextChange?: (id: string, text: string) => void;
	onCaptionDelete?: (id: string) => void;
	onDeleteAllCaptions?: () => void;
	onCaptionSplit?: (id: string) => void;
	onCaptionMergeNext?: (id: string) => void;
	onSelectCaption?: (id: string | null) => void;
	onAutoTranscribe?: () => void;
	onCancelCaptionGeneration?: () => void;
	onCaptionExport?: (format: "srt" | "vtt" | "txt") => void;
	onCaptionImport?: (segments: CaptionSegment[], mode: "replace" | "append") => void;
	hasUsableCaptionAudio: boolean;
	supportsAppleSpeech: boolean;
}

export function CaptionsTab(props: CaptionsTabProps) {
	const { t } = useI18n();
	const {
		captionRegions,
		captionSettings,
		captionGenerationOptions,
		captionGenerationProgress,
		captionModelStatus,
		onDeleteCaptionModel,
		onCustomWhisperFile,
		isTranscribing = false,
		selectedCaptionId,
		isEditingCaptionPosition,
		onToggleCaptionPositionEditing,
		onCaptionSettingsChange,
		onCaptionStyleChange,
		onApplyCaptionPreset,
		onCaptionGenerationOptionsChange,
		onCaptionTextChange,
		onCaptionDelete,
		onDeleteAllCaptions,
		onCaptionSplit,
		onCaptionMergeNext,
		onSelectCaption,
		onAutoTranscribe,
		onCancelCaptionGeneration,
		onCaptionExport,
		onCaptionImport,
		hasUsableCaptionAudio,
		supportsAppleSpeech,
	} = props;

	const [userPresets, setUserPresets] = useState<CaptionUserPreset[]>(() =>
		loadUserCaptionPresets(),
	);
	const [isNamingPreset, setIsNamingPreset] = useState(false);
	const [presetName, setPresetName] = useState("");
	const [importMessage, setImportMessage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const builtInPresets = useMemo(() => getBuiltInCaptionPresets(), []);
	const allPresets = useMemo(
		() => [...builtInPresets, ...userPresets],
		[builtInPresets, userPresets],
	);

	const activePresetId = useMemo(() => {
		const match = allPresets.find(
			(preset) =>
				samePresetStyle(preset.style, captionSettings.style) &&
				preset.animationMode === captionSettings.animationMode,
		);
		return match?.id ?? null;
	}, [allPresets, captionSettings.style, captionSettings.animationMode]);

	const handleSavePreset = useCallback(() => {
		const name = presetName.trim();
		if (!name) return;
		const preset = createUserCaptionPreset(
			name,
			captionSettings.style,
			captionSettings.animationMode,
		);
		const next = saveUserCaptionPreset(preset);
		setUserPresets(next);
		setIsNamingPreset(false);
		setPresetName("");
	}, [presetName, captionSettings.style, captionSettings.animationMode]);

	const handleDeletePreset = useCallback((id: string) => {
		setUserPresets(deleteUserCaptionPreset(id));
	}, []);

	const handleFileImport = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;
			try {
				const content = await file.text();
				const format = file.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
				const segments = parseCaptionTranscript(content, format);
				if (segments.length === 0) {
					setImportMessage(
						t("editor.captions.import.invalidFile", "Couldn't read any cues from that file."),
					);
					return;
				}
				const mode: "replace" | "append" =
					captionRegions.length === 0
						? "replace"
						: window.confirm(
									t(
										"editor.captions.import.confirmReplace",
										"Replace existing captions? Click Cancel to append instead.",
									),
								)
							? "replace"
							: "append";
				onCaptionImport?.(segments, mode);
				setImportMessage(
					t("editor.captions.import.success", "Imported {{count}} cues", {
						count: segments.length,
					}),
				);
			} catch {
				setImportMessage(
					t("editor.captions.import.invalidFile", "Couldn't read any cues from that file."),
				);
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
		},
		[captionRegions.length, onCaptionImport, t],
	);

	useEffect(() => {
		if (!importMessage) return;
		const timer = window.setTimeout(() => setImportMessage(null), 3500);
		return () => window.clearTimeout(timer);
	}, [importMessage]);

	const selectedBackend =
		captionGenerationOptions?.preferredBackend ??
		DEFAULT_CAPTION_GENERATION_OPTIONS.preferredBackend;
	const isAppleSpeechSelected = selectedBackend === "apple-speech";

	return (
		<div className="pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-both">
			<CaptionsHeader
				title={t("editor.captions.title", "Captions")}
				description={t(
					"editor.captions.tabDescription",
					"Generate, style, and animate captions for your export",
				)}
				count={captionRegions.length}
				enabled={captionSettings.enabled}
				onToggle={(enabled) => onCaptionSettingsChange({ enabled })}
			/>

			<CaptionPreviewCard
				style={captionSettings.style}
				animationMode={captionSettings.animationMode}
			/>

			<Section
				title={t("editor.captions.section.presets", "Presets")}
				description={t(
					"editor.captions.section.presetsDesc",
					"Tap a preset to instantly restyle your captions",
				)}
			>
				<div className="grid grid-cols-2 gap-1.5">
					{allPresets.map((preset) => (
						<PresetCard
							key={preset.id}
							preset={preset}
							isActive={preset.id === activePresetId}
							isCustom={!preset.id.startsWith("built-in-")}
							onClick={() => onApplyCaptionPreset(preset)}
							onDelete={() => handleDeletePreset(preset.id)}
						/>
					))}
					{isNamingPreset ? (
						<div className="col-span-2 flex items-center gap-1.5 p-2 rounded-lg border border-accent/30 bg-accent/5">
							<input
								autoFocus
								value={presetName}
								onChange={(e) => setPresetName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSavePreset();
									if (e.key === "Escape") {
										setIsNamingPreset(false);
										setPresetName("");
									}
								}}
								placeholder={t("editor.captions.presets.nameYourPreset", "Preset name")}
								className="flex-1 h-8 rounded-lg bg-fill-subtle border border-line-strong px-2 text-label text-fg outline-none"
							/>
							<Button
								type="button"
								onClick={handleSavePreset}
								disabled={!presetName.trim()}
								className="h-8 px-3 rounded-lg bg-accent text-on-accent text-caption font-semibold hover:bg-accent-hover"
							>
								{t("editor.captions.presets.save", "Save")}
							</Button>
							<Button
								variant="outline"
								type="button"
								onClick={() => {
									setIsNamingPreset(false);
									setPresetName("");
								}}
								className="h-8 w-8 rounded-lg bg-sunken text-fg-muted hover:bg-fill-hover"
							>
								<X className="w-3.5 h-3.5" />
							</Button>
						</div>
					) : (
						<Button
							variant="outline"
							type="button"
							onClick={() => setIsNamingPreset(true)}
							className="col-span-2 h-9 rounded-lg border border-dashed border-line-strong bg-fill-subtle text-caption text-fg-muted hover:bg-fill-subtle hover:text-fg"
						>
							<Save className="w-3.5 h-3.5 mr-1.5" />
							{t("editor.captions.presets.saveAs", "Save current style as preset")}
						</Button>
					)}
				</div>
			</Section>

			<Section
				title={t("editor.captions.section.animation", "Animation")}
				description={t("editor.captions.section.animationDesc", "How captions appear as they play")}
			>
				<div className="grid grid-cols-3 gap-1.5">
					{ANIMATION_MODES.map((mode) => (
						<button
							key={mode.value}
							type="button"
							onClick={() => onCaptionSettingsChange({ animationMode: mode.value })}
							title={t(`${mode.i18nKey}Desc`, mode.description)}
							className={cn(
								"min-h-11 min-w-0 rounded-lg border px-1 py-1 text-center text-micro font-semibold leading-tight transition-colors duration-150 flex flex-col items-center justify-center gap-0.5 break-words [hyphens:auto]",
								captionSettings.animationMode === mode.value
									? "border-accent bg-gradient-to-b from-accent/15 to-accent/5 text-on-accent"
									: "border-line bg-fill-subtle text-fg-muted hover:border-line-strong",
							)}
						>
							<span className="max-w-full">{t(mode.i18nKey, mode.fallback)}</span>
						</button>
					))}
				</div>
			</Section>

			<Section
				title={t("editor.captions.section.position", "Position")}
				description={t(
					"editor.captions.section.positionDesc",
					"Pin captions to a preset position or drag freely on the preview",
				)}
			>
				<div className="rounded-lg bg-fill-subtle border border-line p-2.5 space-y-2">
					<div className="grid grid-cols-4 gap-1.5">
						{POSITION_OPTIONS.map((pos) => {
							const isActive =
								captionSettings.position === pos && !captionSettings.positionOverride;
							return (
								<Button
									variant="outline"
									key={pos}
									type="button"
									onClick={() => {
										onCaptionSettingsChange({ position: pos, positionOverride: null });
										onToggleCaptionPositionEditing(false);
									}}
									className={cn(
										"min-h-8 min-w-0 px-1 py-1 leading-tight break-words rounded-lg border text-micro font-semibold capitalize transition-colors",
										isActive
											? "border-accent/50 bg-accent/12 text-accent-fg"
											: "border-line bg-fill-subtle text-fg-muted hover:border-line-strong",
									)}
								>
									{t(`editor.captions.positions.${pos}`, POSITION_LABELS[pos])}
								</Button>
							);
						})}
						<Button
							variant="outline"
							type="button"
							onClick={() => onToggleCaptionPositionEditing(!isEditingCaptionPosition)}
							className={cn(
								"min-h-8 min-w-0 px-1 py-1 leading-tight break-words rounded-lg border text-micro font-semibold transition-colors flex items-center justify-center gap-1",
								isEditingCaptionPosition
									? "border-accent/50 bg-accent/12 text-accent-fg"
									: "border-line bg-fill-subtle text-fg-muted hover:border-line-strong",
							)}
						>
							<MoveDiagonal className="w-3 h-3" />
							{t("editor.captions.positions.free", "Free")}
						</Button>
					</div>
					{captionSettings.positionOverride && (
						<Button
							variant="outline"
							type="button"
							onClick={() => onCaptionSettingsChange({ positionOverride: null })}
							className="w-full h-8 rounded-lg border border-line bg-fill-subtle text-micro font-semibold text-fg-muted hover:border-line-strong flex items-center justify-center gap-1"
						>
							<RotateCcw className="w-3 h-3" />
							{t("editor.captions.positions.reset", "Reset to preset")}
						</Button>
					)}
					<SliderControl
						label={t("editor.captions.safeArea", "Safe Area")}
						value={captionSettings.safeAreaInset}
						defaultValue={8}
						min={2}
						max={20}
						step={1}
						onChange={(v) => onCaptionSettingsChange({ safeAreaInset: v })}
						formatValue={(v) => `${v}%`}
						parseInput={(val) => parseFloat(val.replace(/%$/, ""))}
					/>
					<SliderControl
						label={t("editor.captions.maxWidth", "Max Width")}
						value={captionSettings.maxWidthPercent}
						defaultValue={85}
						min={40}
						max={95}
						step={1}
						onChange={(v) => onCaptionSettingsChange({ maxWidthPercent: v })}
						formatValue={(v) => `${v}%`}
						parseInput={(val) => parseFloat(val.replace(/%$/, ""))}
					/>
					<SliderControl
						label={t("editor.captions.rows", "Rows")}
						value={captionSettings.maxLines}
						defaultValue={2}
						min={1}
						max={4}
						step={1}
						onChange={(v) => onCaptionSettingsChange({ maxLines: Math.round(v) })}
						formatValue={(v) => `${Math.round(v)}`}
						parseInput={(val) => Number.parseInt(val, 10)}
					/>
				</div>
			</Section>

			<Section
				title={t("editor.captions.section.style", "Style")}
				description={t("editor.captions.section.styleDesc", "Fine-tune typography and effects")}
			>
				<StyleControls
					style={captionSettings.style}
					animationMode={captionSettings.animationMode}
					maxWordsPerLine={captionSettings.maxWordsPerLine}
					onStyleChange={onCaptionStyleChange}
					onSettingsChange={onCaptionSettingsChange}
				/>
			</Section>

			<Section
				title={t("editor.captions.section.transcription", "Transcription")}
				description={t(
					"editor.captions.section.transcriptionDesc",
					"Generate captions from your recording audio",
				)}
			>
				<div className="p-2.5 rounded-lg bg-fill-subtle border border-line space-y-2">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-label font-medium text-fg-muted">
								{t("editor.captions.localTranscript", "Local Transcript")}
							</div>
							<div className="text-micro text-fg-subtle mt-0.5">
								{!hasUsableCaptionAudio
									? t(
											"editor.captions.noAudioAvailable",
											"No microphone or video audio was found for this recording",
										)
									: captionModelStatus?.downloadedModels.length
										? t("editor.captions.modelsReady", "Models ready: {{models}}", {
												models: captionModelStatus.downloadedModels.join(", "),
											})
										: t("editor.captions.noLocalModel", "No local Whisper model downloaded yet")}
							</div>
						</div>
						{isTranscribing && (
							<div className="text-micro uppercase tracking-wider text-accent-fg">
								{captionGenerationProgress?.message || t("editor.captions.working", "Working...")}
							</div>
						)}
					</div>
					{onDeleteCaptionModel &&
					!isTranscribing &&
					captionModelStatus?.downloadedModels.length ? (
						<div className="flex flex-wrap gap-1.5">
							{captionModelStatus.downloadedModels.map((model) => (
								<button
									key={model}
									type="button"
									onClick={() => onDeleteCaptionModel(model)}
									className="rounded-md border border-line-strong bg-fill-subtle px-2 py-1 text-micro text-fg-muted hover:border-danger/30 hover:text-danger-fg"
								>
									{t("editor.captions.deleteModel", "Delete {{model}} model", {
										model: t(
											`editor.captions.model${model[0].toUpperCase()}${model.slice(1)}`,
											model,
										),
									})}
								</button>
							))}
						</div>
					) : null}

					<div className="grid grid-cols-3 gap-2">
						<select
							value={selectedBackend}
							onChange={(event) =>
								onCaptionGenerationOptionsChange?.({
									preferredBackend: event.target.value as "auto" | "whisper.cpp" | "apple-speech",
								})
							}
							className="h-9 rounded-md border border-line bg-sunken px-3 text-label text-fg outline-none"
						>
							<option value="auto">{t("editor.captions.backendAuto", "Automatic")}</option>
							<option value="whisper.cpp">{t("editor.captions.backendWhisper", "Whisper")}</option>
							{supportsAppleSpeech && (
								<option value="apple-speech">
									{t("editor.captions.backendAppleSpeech", "Apple Speech")}
								</option>
							)}
						</select>
						<select
							value={captionGenerationOptions?.model ?? DEFAULT_CAPTION_GENERATION_OPTIONS.model}
							disabled={isAppleSpeechSelected || Boolean(captionModelStatus?.customModelPath)}
							title={
								captionModelStatus?.customModelPath
									? t("editor.captions.customModelInUse", "Using your custom model")
									: undefined
							}
							onChange={(event) =>
								onCaptionGenerationOptionsChange?.({
									model: event.target.value as "base" | "small" | "medium",
								})
							}
							className="h-9 rounded-md border border-line bg-sunken px-3 text-label text-fg outline-none disabled:opacity-50"
						>
							<option value="base">{t("editor.captions.modelBase", "Base")}</option>
							<option value="small">{t("editor.captions.modelSmall", "Small")}</option>
							<option value="medium">{t("editor.captions.modelMedium", "Medium")}</option>
						</select>
						<select
							value={
								captionModelStatus?.availableSourceAudios.includes(
									captionGenerationOptions?.preferredSourceAudio ?? "microphone",
								)
									? (captionGenerationOptions?.preferredSourceAudio ?? "microphone")
									: "mixed"
							}
							onChange={(event) =>
								onCaptionGenerationOptionsChange?.({
									preferredSourceAudio: event.target.value as "microphone" | "mixed",
								})
							}
							className="h-9 rounded-md border border-line bg-sunken px-3 text-label text-fg outline-none"
						>
							{captionModelStatus?.availableSourceAudios.includes("microphone") && (
								<option value="microphone">
									{t("editor.captions.sourceMicrophone", "Microphone")}
								</option>
							)}
							<option value="mixed">{t("editor.captions.sourceMixed", "Mixed Audio")}</option>
						</select>
					</div>

					{onCustomWhisperFile && !isAppleSpeechSelected ? (
						<div className="space-y-1.5 rounded-lg border border-line bg-fill-subtle p-2">
							{(
								[
									["model", captionModelStatus?.customModelPath ?? null],
									["executable", captionModelStatus?.customExecutablePath ?? null],
								] as const
							).map(([kind, filePath]) => (
								<div key={kind} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
									<span className="min-w-0 flex-1 basis-32">
										<span className="block break-words text-caption font-medium text-fg-muted">
											{kind === "model"
												? t("editor.captions.customModel", "Custom model file")
												: t("editor.captions.customProgram", "Whisper program")}
										</span>
										<span
											className="block truncate text-micro text-fg-subtle"
											title={filePath ?? undefined}
										>
											{filePath
												? filePath.split(/[\\/]/).pop()
												: kind === "model"
													? t("editor.captions.customModelNone", "Not set — uses the size above")
													: t(
															"editor.captions.customProgramNone",
															"Not set — set up automatically",
														)}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-1">
										<button
											type="button"
											disabled={isTranscribing}
											onClick={() => onCustomWhisperFile(kind, "choose")}
											className="rounded-md border border-line-strong bg-fill-subtle px-2 py-1 text-micro text-fg-muted transition hover:border-accent/40 hover:text-accent-fg disabled:opacity-50"
										>
											{t("editor.captions.customChoose", "Choose…")}
										</button>
										{filePath ? (
											<button
												type="button"
												disabled={isTranscribing}
												onClick={() => onCustomWhisperFile(kind, "clear")}
												className="rounded-md border border-line-strong bg-fill-subtle px-2 py-1 text-micro text-fg-muted transition hover:border-danger/30 hover:text-danger-fg disabled:opacity-50"
											>
												{t("editor.captions.customRemove", "Remove")}
											</button>
										) : null}
									</span>
								</div>
							))}
						</div>
					) : null}

					<input
						type="text"
						value={captionGenerationOptions?.language ?? "auto"}
						onChange={(event) =>
							onCaptionGenerationOptionsChange?.({
								language: event.target.value || "auto",
							})
						}
						placeholder={t("editor.captions.languagePlaceholder", "Language (auto)")}
						className="w-full h-9 rounded-md border border-line bg-sunken px-3 text-label text-fg outline-none"
					/>
					<textarea
						value={captionGenerationOptions?.prompt ?? ""}
						disabled={isAppleSpeechSelected}
						onChange={(event) => onCaptionGenerationOptionsChange?.({ prompt: event.target.value })}
						placeholder={t(
							"editor.captions.promptPlaceholder",
							"Optional prompt to bias names or terminology",
						)}
						className="w-full min-h-[64px] rounded-md border border-line bg-sunken px-3 py-2 text-label text-fg outline-none resize-none"
					/>

					<Button
						variant="outline"
						type="button"
						onClick={onAutoTranscribe}
						disabled={isTranscribing || !hasUsableCaptionAudio}
						className="w-full h-9 rounded-lg border border-accent/30 bg-accent/10 text-accent-fg hover:bg-accent/20 text-label font-semibold"
					>
						{isTranscribing ? (
							<>
								<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								{captionGenerationProgress?.message ||
									t("editor.captions.transcribing", "Transcribing...")}
							</>
						) : (
							<>
								<Captions className="w-3.5 h-3.5 mr-1.5" />
								{t("editor.captions.generateTranscript", "Generate Transcript")}
							</>
						)}
					</Button>

					{isTranscribing && (
						<Button
							type="button"
							onClick={onCancelCaptionGeneration}
							className="w-full h-8 rounded-lg border border-danger/30 bg-danger/10 text-danger-fg hover:bg-danger/20 text-label font-semibold"
						>
							{t("editor.captions.cancelGeneration", "Cancel Generation")}
						</Button>
					)}
				</div>
			</Section>

			<Section
				title={t("editor.captions.section.importExport", "Import / Export")}
				description={t(
					"editor.captions.section.importExportDesc",
					"Bring in external transcripts or save your own",
				)}
			>
				<div className="p-2.5 rounded-lg bg-fill-subtle border border-line space-y-2">
					<input
						ref={fileInputRef}
						type="file"
						accept=".srt,.vtt"
						onChange={handleFileImport}
						className="hidden"
					/>
					<Button
						variant="outline"
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="w-full h-8 rounded-lg border border-line bg-fill-subtle text-caption font-semibold text-fg hover:border-line-strong"
					>
						<Upload className="w-3.5 h-3.5 mr-1.5" />
						{t("editor.captions.import.button", "Import SRT / VTT")}
					</Button>
					{importMessage && (
						<div className="text-micro text-accent-fg text-center">{importMessage}</div>
					)}
					<div className="grid grid-cols-3 gap-1.5">
						<Button
							variant="outline"
							type="button"
							onClick={() => onCaptionExport?.("srt")}
							disabled={captionRegions.length === 0}
							className="min-h-8 h-auto whitespace-normal rounded-lg border border-line bg-fill-subtle px-1 py-1 text-micro leading-tight text-fg-muted hover:border-line-strong disabled:opacity-40"
						>
							{t("editor.captions.exportSrt", "Export SRT")}
						</Button>
						<Button
							variant="outline"
							type="button"
							onClick={() => onCaptionExport?.("vtt")}
							disabled={captionRegions.length === 0}
							className="min-h-8 h-auto whitespace-normal rounded-lg border border-line bg-fill-subtle px-1 py-1 text-micro leading-tight text-fg-muted hover:border-line-strong disabled:opacity-40"
						>
							{t("editor.captions.exportVtt", "Export VTT")}
						</Button>
						<Button
							variant="outline"
							type="button"
							onClick={() => onCaptionExport?.("txt")}
							disabled={captionRegions.length === 0}
							className="min-h-8 h-auto whitespace-normal rounded-lg border border-line bg-fill-subtle px-1 py-1 text-micro leading-tight text-fg-muted hover:border-line-strong disabled:opacity-40"
						>
							{t("editor.captions.exportTxt", "Export TXT")}
						</Button>
					</div>
				</div>
			</Section>

			{captionRegions.length > 0 && (
				<Section
					title={t("editor.captions.section.list", "Caption list")}
					description={t(
						"editor.captions.section.listDesc",
						"Edit, split, or reorder individual caption segments",
					)}
				>
					<div className="rounded-lg bg-fill-subtle border border-line overflow-hidden">
						<div className="flex items-center justify-between px-3 py-2 border-b border-line">
							<label className="text-label font-medium text-fg-muted">
								{captionRegions.length} {t("editor.captions.list.count", "segments")}
							</label>
							<Button
								type="button"
								onClick={onDeleteAllCaptions}
								className="h-6 px-2 rounded-lg border border-danger/20 bg-danger/10 text-danger-fg hover:bg-danger/15 text-micro"
							>
								<Trash2 className="w-3 h-3 mr-1" />
								{t("editor.captions.clearAll", "Clear All")}
							</Button>
						</div>
						<CaptionList
							captions={captionRegions}
							selectedCaptionId={selectedCaptionId}
							onSelectCaption={onSelectCaption}
							onCaptionTextChange={onCaptionTextChange}
							onCaptionDelete={onCaptionDelete}
							onCaptionSplit={onCaptionSplit}
							onCaptionMergeNext={onCaptionMergeNext}
						/>
					</div>
				</Section>
			)}
		</div>
	);
}

function CaptionsHeader({
	title,
	description,
	count,
	enabled,
	onToggle,
}: {
	title: string;
	description: string;
	count: number;
	enabled: boolean;
	onToggle: (next: boolean) => void;
}) {
	return (
		<div className="mb-4 pb-3 border-b border-line">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-body font-semibold text-fg tracking-tight">{title}</span>
						{count > 0 && (
							<span className="text-micro uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full text-accent-fg bg-accent/10 border border-accent/20">
								{count}
							</span>
						)}
					</div>
					<p className="text-caption text-fg-subtle mt-1 leading-relaxed">{description}</p>
				</div>
				<Switch checked={enabled} onCheckedChange={onToggle} className="shrink-0 mt-1" />
			</div>
		</div>
	);
}

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-6">
			<div className="mb-2.5 px-0.5">
				<h3 className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.08em] text-fg-subtle">
					{title}
				</h3>
				{description && (
					<p className="mt-1 text-caption leading-relaxed text-fg-subtle">{description}</p>
				)}
			</div>
			<div className="flex flex-col gap-1.5">{children}</div>
		</section>
	);
}

function CaptionPreviewCard({
	style,
	animationMode,
}: {
	style: CaptionStyle;
	animationMode: CaptionAnimationMode;
}) {
	const { t } = useI18n();
	// Simulate playback of a sample sentence so users see animation live.
	const words = useMemo(() => ["Quick", "brown", "fox", "jumps", "over", "lazy", "dog"], []);
	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		const totalMs = words.length * 500 + 800;
		let frame = 0;
		const start = performance.now();
		const loop = (now: number) => {
			setElapsed(((now - start) % totalMs) / totalMs);
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	}, [words.length]);

	const perWord = 1 / words.length;
	const activeIndex = Math.min(words.length - 1, Math.floor(elapsed / perWord));
	const wordProgress = (elapsed - activeIndex * perWord) / perWord;

	const bgColor =
		style.backgroundOpacity > 0 && style.backgroundColor !== "transparent"
			? hexToRgba(style.backgroundColor, style.backgroundOpacity)
			: "transparent";

	const blockOpacity =
		animationMode === "fade"
			? elapsed < 0.08
				? elapsed / 0.08
				: elapsed > 0.92
					? (1 - elapsed) / 0.08
					: 1
			: 1;
	const blockScale = animationMode === "pop" && elapsed < 0.1 ? 0.9 + (elapsed / 0.1) * 0.1 : 1;

	return (
		<div className="mb-4">
			<div
				className="relative w-full aspect-video rounded-lg overflow-hidden border border-line flex items-center justify-center"
				style={{
					background: "linear-gradient(135deg, #1a1a1e 0%, #0e0e11 50%, #1a1a1e 100%)",
				}}
			>
				<div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect width=%2260%22 height=%2260%22 fill=%22none%22 stroke=%22%23fff%22 stroke-width=%220.5%22/></svg>')]" />
				<div
					className="flex flex-wrap justify-center gap-x-2 px-4 py-2 mx-4 max-w-[80%]"
					style={{
						fontFamily: style.fontFamily,
						fontSize: 18,
						fontWeight: style.fontWeight,
						fontStyle: style.fontStyle,
						letterSpacing: `${style.letterSpacing}px`,
						color: style.color,
						backgroundColor: bgColor,
						borderRadius: `${style.borderRadius}px`,
						textTransform: style.textTransform,
						opacity: blockOpacity,
						transform: `scale(${blockScale})`,
						textShadow:
							style.outlineWidth > 0
								? `${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor}, -${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor}, ${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor}, -${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor}`
								: style.shadowBlur > 0
									? `0 ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
									: "none",
						transition: "opacity 80ms linear, transform 80ms linear",
					}}
				>
					{words.map((word, index) => {
						const isActive = index === activeIndex;
						const isPast = index < activeIndex;
						const isVisible = animationMode === "typewriter" ? index <= activeIndex : true;
						if (!isVisible) return null;
						if (animationMode === "karaoke-fill") {
							const progress = isActive ? wordProgress : isPast ? 1 : 0;
							const gradient = `linear-gradient(90deg, ${style.highlightColor} 0%, ${style.highlightColor} ${progress * 100}%, ${style.color} ${progress * 100}%, ${style.color} 100%)`;
							return (
								<span
									key={word}
									style={{
										backgroundImage: gradient,
										WebkitBackgroundClip: "text",
										backgroundClip: "text",
										color: "transparent",
									}}
								>
									{word}
								</span>
							);
						}
						if (animationMode === "active-word") {
							return (
								<span
									key={word}
									style={{
										color: isActive
											? style.highlightColor
											: isPast
												? style.color
												: hexToRgba(style.color, 0.58),
										transform: isActive ? "scale(1.06)" : "scale(1)",
										transition: "transform 120ms ease, color 120ms ease",
									}}
								>
									{word}
								</span>
							);
						}
						return <span key={word}>{word}</span>;
					})}
				</div>
				<div className="absolute bottom-2 left-2 text-micro uppercase tracking-wider text-fixed-white/40">
					{t("editor.captionsTab.livePreview", "Live preview")}
				</div>
			</div>
		</div>
	);
}

function PresetCard({
	preset,
	isActive,
	isCustom,
	onClick,
	onDelete,
}: {
	preset: CaptionUserPreset;
	isActive: boolean;
	isCustom: boolean;
	onClick: () => void;
	onDelete: () => void;
}) {
	const { t } = useI18n();
	const { style } = preset;
	const bgColor =
		style.backgroundOpacity > 0 && style.backgroundColor !== "transparent"
			? hexToRgba(style.backgroundColor, style.backgroundOpacity)
			: "transparent";
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"relative group h-16 rounded-lg border overflow-hidden flex flex-col items-center justify-center gap-0.5 transition-all",
				isActive
					? "border-accent/60 bg-accent/10"
					: "border-line bg-fill-subtle hover:border-line-strong",
			)}
		>
			{/* Captions draw over video, so the sample sits on a dark chip in both themes. */}
			<div className="flex max-w-[90%] rounded bg-scrim/85 px-1.5 py-1">
				<div
					className="px-2 py-0.5 max-w-full truncate"
					style={{
						fontFamily: style.fontFamily,
						fontSize: 11,
						fontWeight: style.fontWeight,
						fontStyle: style.fontStyle,
						color: style.color,
						backgroundColor: bgColor,
						borderRadius: Math.min(6, style.borderRadius),
						textTransform: style.textTransform,
					}}
				>
					{t("editor.captionsTab.aa", "Aa")}
				</div>
			</div>
			<div className="text-micro text-fg-subtle truncate max-w-full px-2">{preset.name}</div>
			{isCustom && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded bg-scrim/60 text-fg-muted hover:text-danger-fg"
				>
					<X className="w-2.5 h-2.5" />
				</button>
			)}
		</button>
	);
}

function StyleControls({
	style,
	animationMode,
	maxWordsPerLine,
	onStyleChange,
	onSettingsChange,
}: {
	style: CaptionStyle;
	animationMode: CaptionAnimationMode;
	maxWordsPerLine: number;
	onStyleChange: (partial: Partial<CaptionStyle>) => void;
	onSettingsChange: (partial: Partial<CaptionSettings>) => void;
}) {
	const { t } = useI18n();
	const highlightColorRelevant =
		animationMode === "active-word" ||
		animationMode === "karaoke-fill" ||
		animationMode === "typewriter";
	return (
		<div className="space-y-1.5">
			<StyleCard title={t("editor.captionsTab.font", "Font")}>
				<div className="grid grid-cols-2 gap-1.5 mb-2">
					<select
						value={style.fontFamily}
						onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
						className="col-span-2 h-8 rounded-md border border-line bg-sunken px-2 text-caption text-fg outline-none"
					>
						{FONT_FAMILIES.map((font) => (
							<option key={font.label} value={font.value}>
								{font.label}
							</option>
						))}
					</select>
				</div>
				<SliderControl
					label={t("editor.captionsTab.size", "Size")}
					value={style.fontSize}
					defaultValue={28}
					min={14}
					max={72}
					step={1}
					onChange={(v) => onStyleChange({ fontSize: v })}
					formatValue={(v) => `${v}px`}
					parseInput={(val) => parseFloat(val.replace(/px$/, ""))}
				/>
				<div className="grid grid-cols-1 gap-1.5 mt-2">
					<WeightPicker
						value={style.fontWeight}
						onChange={(v) => onStyleChange({ fontWeight: v })}
					/>
					<button
						type="button"
						onClick={() =>
							onStyleChange({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })
						}
						className={cn(
							"h-8 rounded-lg border text-caption italic",
							style.fontStyle === "italic"
								? "border-accent/50 bg-accent/12 text-accent-fg"
								: "border-line bg-fill-subtle text-fg-muted hover:border-line-strong",
						)}
					>
						{t("editor.captionsTab.italic", "Italic")}
					</button>
				</div>
				<div className="mt-2 grid grid-cols-2 gap-1.5">
					<SliderControl
						label={t("editor.captionsTab.spacing", "Spacing")}
						value={style.letterSpacing}
						defaultValue={0}
						min={-2}
						max={8}
						step={0.25}
						onChange={(v) => onStyleChange({ letterSpacing: v })}
						formatValue={(v) => `${v}`}
						parseInput={(val) => parseFloat(val)}
					/>
					<SliderControl
						label={t("editor.captionsTab.line", "Line")}
						value={style.lineHeight}
						defaultValue={1.3}
						min={1}
						max={2}
						step={0.05}
						onChange={(v) => onStyleChange({ lineHeight: v })}
						formatValue={(v) => v.toFixed(2)}
						parseInput={(val) => parseFloat(val)}
					/>
				</div>
				<button
					type="button"
					onClick={() =>
						onStyleChange({
							textTransform: style.textTransform === "uppercase" ? "none" : "uppercase",
						})
					}
					className={cn(
						"mt-2 w-full h-8 rounded-lg border text-caption font-semibold",
						style.textTransform === "uppercase"
							? "border-accent/50 bg-accent/12 text-accent-fg"
							: "border-line bg-fill-subtle text-fg-muted hover:border-line-strong",
					)}
				>
					UPPERCASE
				</button>
			</StyleCard>

			<StyleCard title={t("editor.captionsTab.color", "Color")}>
				<label className="text-micro text-fg-muted block mb-1">
					{t("editor.captionsTab.text", "Text")}
				</label>
				<ColorPicker
					color={style.color}
					onChange={(color) => onStyleChange({ color: color.hex })}
					colors={[
						"#FFFFFF",
						"#FFD700",
						"#00FF88",
						"#FF6B6B",
						"#00BFFF",
						"#FF69B4",
						"#000000",
						"#F59E0B",
					]}
				/>
				{highlightColorRelevant && (
					<>
						<label className="text-micro text-fg-muted block mt-2 mb-1">
							{t("editor.captionsTab.highlight", "Highlight")}
						</label>
						<ColorPicker
							color={style.highlightColor}
							onChange={(color) => onStyleChange({ highlightColor: color.hex })}
							colors={[
								"#F59E0B",
								"#FFD700",
								"#00FF88",
								"#FF6B6B",
								"#00BFFF",
								"#FF69B4",
								"#FFFFFF",
								"#000000",
							]}
						/>
					</>
				)}
				<label className="text-micro text-fg-muted block mt-2 mb-1">
					{t("editor.captionsTab.background", "Background")}
				</label>
				<ColorPicker
					color={style.backgroundColor === "transparent" ? "#000000" : style.backgroundColor}
					onChange={(color) => onStyleChange({ backgroundColor: color.hex })}
					colors={[
						"#000000",
						"#1E1E24",
						"#F59E0B",
						"#3B82F6",
						"#22C55E",
						"#EF4444",
						"#8B5CF6",
						"#FFFFFF",
					]}
				/>
				<div className="mt-2 grid grid-cols-2 gap-1.5">
					<SliderControl
						label={t("editor.captionsTab.opacity", "Opacity")}
						value={style.backgroundOpacity}
						defaultValue={0.7}
						min={0}
						max={1}
						step={0.05}
						onChange={(v) => onStyleChange({ backgroundOpacity: v })}
						formatValue={(v) => `${Math.round(v * 100)}%`}
						parseInput={(val) => parseFloat(val.replace(/%$/, "")) / 100}
					/>
					<SliderControl
						label={t("editor.captionsTab.radius", "Radius")}
						value={style.borderRadius}
						defaultValue={6}
						min={0}
						max={32}
						step={1}
						onChange={(v) => onStyleChange({ borderRadius: v })}
						formatValue={(v) => `${v}px`}
						parseInput={(val) => parseFloat(val.replace(/px$/, ""))}
					/>
				</div>
			</StyleCard>

			<StyleCard title={t("editor.captionsTab.outlineShadow", "Outline & Shadow")}>
				<SliderControl
					label={t("editor.captionsTab.outline", "Outline")}
					value={style.outlineWidth}
					defaultValue={0}
					min={0}
					max={8}
					step={0.5}
					onChange={(v) => onStyleChange({ outlineWidth: v })}
					formatValue={(v) => `${v}px`}
					parseInput={(val) => parseFloat(val.replace(/px$/, ""))}
				/>
				{style.outlineWidth > 0 && (
					<div className="mt-1">
						<label className="text-micro text-fg-muted block mb-1">
							{t("editor.captionsTab.outlineColor", "Outline color")}
						</label>
						<ColorPicker
							color={style.outlineColor}
							onChange={(color) => onStyleChange({ outlineColor: color.hex })}
							colors={["#000000", "#FFFFFF", "#F59E0B", "#3B82F6", "#EF4444"]}
						/>
					</div>
				)}
				<div className="mt-2 grid grid-cols-2 gap-1.5">
					<SliderControl
						label={t("editor.captionsTab.shadowBlur", "Shadow blur")}
						value={style.shadowBlur}
						defaultValue={0}
						min={0}
						max={40}
						step={1}
						onChange={(v) => onStyleChange({ shadowBlur: v })}
						formatValue={(v) => `${v}px`}
						parseInput={(val) => parseFloat(val.replace(/px$/, ""))}
					/>
					<SliderControl
						label={t("editor.captionsTab.shadowY", "Shadow Y")}
						value={style.shadowOffsetY}
						defaultValue={0}
						min={-10}
						max={10}
						step={1}
						onChange={(v) => onStyleChange({ shadowOffsetY: v })}
						formatValue={(v) => `${v}px`}
						parseInput={(val) => parseFloat(val.replace(/px$/, ""))}
					/>
				</div>
				{style.shadowBlur > 0 && (
					<div className="mt-1">
						<label className="text-micro text-fg-muted block mb-1">
							{t("editor.captionsTab.shadowColor", "Shadow color")}
						</label>
						<ColorPicker
							color={style.shadowColor}
							onChange={(color) => onStyleChange({ shadowColor: color.hex })}
							colors={["#000000", "#FFFFFF", "#F59E0B", "#00FF88", "#3B82F6"]}
						/>
					</div>
				)}
			</StyleCard>

			<StyleCard title={t("editor.captionsTab.layout", "Layout")}>
				<SliderControl
					label={t("editor.captionsTab.wordsPerLine", "Words per line")}
					value={maxWordsPerLine}
					defaultValue={6}
					min={1}
					max={12}
					step={1}
					onChange={(v) => onSettingsChange({ maxWordsPerLine: v })}
					formatValue={(v) => `${v}`}
					parseInput={(val) => parseFloat(val)}
				/>
			</StyleCard>
		</div>
	);
}

function StyleCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="p-2.5 rounded-lg bg-fill-subtle border border-line">
			<div className="text-micro uppercase tracking-wider text-fg-subtle mb-1.5">{title}</div>
			{children}
		</div>
	);
}

function WeightPicker({
	value,
	onChange,
}: {
	value: CaptionStyle["fontWeight"];
	onChange: (v: CaptionStyle["fontWeight"]) => void;
}) {
	const { t } = useI18n();
	const options: { value: CaptionStyle["fontWeight"]; label: string }[] = [
		{ value: "normal", label: t("editor.captionsTab.regular", "Regular") },
		{ value: "bold", label: t("editor.captionsTab.bold", "Bold") },
		{ value: "800", label: t("editor.captionsTab.black", "Black") },
	];
	return (
		<div className="grid grid-cols-3 gap-0.5 h-8 rounded-lg bg-fill-subtle p-0.5 border border-line">
			{options.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => onChange(opt.value)}
					className={cn(
						"text-micro font-semibold rounded-md transition-colors",
						value === opt.value ? "bg-control text-fg shadow-sm" : "text-fg-muted hover:text-fg",
					)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

function CaptionList({
	captions,
	selectedCaptionId,
	onSelectCaption,
	onCaptionTextChange,
	onCaptionDelete,
	onCaptionSplit,
	onCaptionMergeNext,
}: {
	captions: CaptionRegion[];
	selectedCaptionId?: string | null;
	onSelectCaption?: (id: string | null) => void;
	onCaptionTextChange?: (id: string, text: string) => void;
	onCaptionDelete?: (id: string) => void;
	onCaptionSplit?: (id: string) => void;
	onCaptionMergeNext?: (id: string) => void;
}) {
	const { t } = useI18n();
	return (
		<div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto custom-scrollbar p-1.5">
			{captions.map((caption) => {
				const isSelected = selectedCaptionId === caption.id;
				return (
					<div
						key={caption.id}
						onClick={() => onSelectCaption?.(caption.id)}
						className={cn(
							"flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all",
							isSelected
								? "border-accent/40 bg-accent/10"
								: "border-line bg-fill-subtle hover:bg-sunken",
						)}
					>
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between mb-1">
								<span className="text-micro text-fg-subtle font-mono">
									{(caption.startMs / 1000).toFixed(2)}s – {(caption.endMs / 1000).toFixed(2)}s
								</span>
							</div>
							<textarea
								value={caption.text}
								onChange={(e) => onCaptionTextChange?.(caption.id, e.target.value)}
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => {
									if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
										e.preventDefault();
										onCaptionSplit?.(caption.id);
									}
								}}
								className="w-full min-h-[48px] text-body leading-snug text-fg bg-transparent border-none outline-none resize-none"
								placeholder={t("editor.captionsTab.captionText", "Caption text...")}
							/>
							<div className="flex gap-1.5 mt-1">
								<Button
									variant="outline"
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										onCaptionSplit?.(caption.id);
									}}
									className="h-6 px-2 rounded-lg border border-line bg-fill-subtle text-micro text-fg-muted hover:border-line-strong"
								>
									{t("editor.captionsTab.split", "Split")}
								</Button>
								<Button
									variant="outline"
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										onCaptionMergeNext?.(caption.id);
									}}
									className="h-6 px-2 rounded-lg border border-line bg-fill-subtle text-micro text-fg-muted hover:border-line-strong"
								>
									{t("editor.captionsTab.mergeNext", "Merge next")}
								</Button>
							</div>
						</div>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onCaptionDelete?.(caption.id);
							}}
							className="shrink-0 p-1 text-fg-subtle hover:text-danger-fg rounded-md hover:bg-danger/10"
						>
							<X className="w-3 h-3" />
						</button>
					</div>
				);
			})}
		</div>
	);
}

function hexToRgba(hex: string, alpha: number): string {
	const clean = hex.replace("#", "");
	if (clean.length === 3) {
		const [r, g, b] = clean.split("").map((c) => Number.parseInt(c + c, 16));
		if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	if (clean.length !== 6) return hex;
	const r = Number.parseInt(clean.slice(0, 2), 16);
	const g = Number.parseInt(clean.slice(2, 4), 16);
	const b = Number.parseInt(clean.slice(4, 6), 16);
	if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Ensure unused imports are retained for type-only uses.
export type { CaptionStylePreset } from "../types";

void CAPTION_STYLE_PRESETS;
