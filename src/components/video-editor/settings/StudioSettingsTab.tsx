import {
	Bug,
	Check,
	GraduationCap,
	Laptop,
	type LucideIcon,
	MousePointerClick,
	RefreshCw,
	Rocket,
	Smartphone,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { SCENE_PRESETS } from "../scenePresets";
import { TabContent, TabHeader } from "../settingsPanelLayout";
import type { ScenePresetId } from "../types";

interface StudioSettingsTabProps {
	activePresetId?: ScenePresetId;
	hasCursorTelemetry: boolean;
	hasExistingZooms: boolean;
	onApplyPreset: (presetId: ScenePresetId) => void;
	onAutoBeautify: () => void;
	onRegenerateZooms: () => void;
}

type PresetVisual = {
	icon: LucideIcon;
	accent: string;
	glow: string;
	chips: string[];
};

const PRESET_VISUALS: Record<Exclude<ScenePresetId, "custom">, PresetVisual> = {
	"saas-launch": {
		icon: Rocket,
		accent: "from-teal-300 via-success to-accent",
		glow: "shadow-teal-500/10",
		chips: ["Hero", "Browser"],
	},
	"product-demo": {
		icon: Laptop,
		accent: "from-sky-300 via-cyan-300 to-orange-300",
		glow: "shadow-sky-500/10",
		chips: ["Guided", "Clicks"],
	},
	tutorial: {
		icon: GraduationCap,
		accent: "from-teal-300 via-success to-lime-300",
		glow: "shadow-teal-500/10",
		chips: ["Readable", "Keys"],
	},
	"social-vertical": {
		icon: Smartphone,
		accent: "from-fuchsia-300 via-rose-300 to-orange-300",
		glow: "shadow-fuchsia-500/10",
		chips: ["9:16", "Hook"],
	},
	"bug-report-clean": {
		icon: Bug,
		accent: "from-slate-200 via-sky-200 to-accent",
		glow: "shadow-slate-500/10",
		chips: ["Sharp", "Team"],
	},
};

function getPresetVisual(id: ScenePresetId): PresetVisual {
	return (
		PRESET_VISUALS[id as Exclude<ScenePresetId, "custom">] ?? {
			icon: Sparkles,
			accent: "from-accent to-orange-400",
			glow: "",
			chips: ["Custom"],
		}
	);
}

export function StudioSettingsTab({
	activePresetId,
	hasCursorTelemetry,
	hasExistingZooms,
	onApplyPreset,
	onAutoBeautify,
	onRegenerateZooms,
}: StudioSettingsTabProps) {
	const tSettings = useScopedT("settings");
	const zoomState = hasCursorTelemetry
		? hasExistingZooms
			? {
					label: tSettings("studioTab.preserveZooms", "Preserve zooms"),
					tone: "text-cyan-200 border-cyan-300/20 bg-cyan-300/10",
				}
			: {
					label: tSettings("studioTab.smartZoomReady", "Smart zoom ready"),
					tone: "text-success-fg border-success/20 bg-success/10",
				}
		: {
				label: tSettings("studioTab.noCursorData", "No cursor data"),
				tone: "text-fg-muted border-line bg-fill-subtle",
			};

	return (
		<TabContent className="space-y-4">
			<TabHeader
				title={tSettings("studioTab.studio", "Studio")}
				description={tSettings(
					"studioTab.creatorGradeRecipesFor",
					"Creator-grade recipes for screen videos",
				)}
				badge={tSettings("studioTab.new", "New")}
				badgeColor="amber"
			/>

			<section className="overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-black/20">
				<div className="relative p-3">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_42%),linear-gradient(135deg,rgba(45,212,191,0.1),transparent_38%)]" />
					<div className="relative">
						<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
							<div className="flex min-w-0 items-center gap-2">
								<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/12 text-accent-fg ring-1 ring-accent/15">
									<WandSparkles className="h-4 w-4" />
								</span>
								<div>
									<div className="text-body font-semibold text-fg">
										{tSettings("studioTab.autoBeautify", "Auto Beautify")}
									</div>
									<div className="mt-0.5 text-micro text-fg-muted">
										{tSettings("studioTab.pickTheRightRecipe", "Pick the right recipe and motion")}
									</div>
								</div>
							</div>
							<span
								className={cn(
									"max-w-full rounded-full border px-2 py-1 text-center text-micro font-semibold uppercase leading-tight tracking-wide shadow-sm",
									zoomState.tone,
								)}
							>
								{zoomState.label}
							</span>
						</div>

						<div className="grid grid-cols-[1fr_auto] gap-2">
							<Button
								type="button"
								onClick={onAutoBeautify}
								className="h-9 justify-center gap-2 rounded-lg bg-accent text-label font-semibold text-on-accent shadow-sm hover:bg-accent-hover"
							>
								<Sparkles className="h-3.5 w-3.5" />
								{tSettings("studioTab.apply", "Apply")}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={!hasCursorTelemetry}
								onClick={onRegenerateZooms}
								className="h-9 w-9 rounded-lg border-line bg-fill-subtle p-0 text-fg hover:bg-fill-hover"
								title={tSettings("studioTab.regenerateSmartZooms", "Regenerate smart zooms")}
							>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</div>

						<div className="mt-3 grid grid-cols-2 gap-2">
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="flex items-center gap-1.5 text-micro text-fg-muted">
									<MousePointerClick className="h-3 w-3" />
									{tSettings("studioTab.cursorData", "Cursor data")}
								</div>
								<div className="mt-1 text-caption font-semibold text-fg">
									{hasCursorTelemetry
										? tSettings("studioTab.ready", "Ready")
										: tSettings("studioTab.missing", "Missing")}
								</div>
							</div>
							<div className="rounded-lg border border-line bg-fill-subtle px-2.5 py-2">
								<div className="flex items-center gap-1.5 text-micro text-fg-muted">
									<RefreshCw className="h-3 w-3" />
									{tSettings("studioTab.zooms", "Zooms")}
								</div>
								<div className="mt-1 text-caption font-semibold text-fg">
									{hasExistingZooms
										? tSettings("studioTab.keepCurrent", "Keep current")
										: tSettings("studioTab.canCreate", "Can create")}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section>
				<div className="mb-2 flex items-end justify-between">
					<div>
						<h3 className="text-caption font-semibold tracking-wide text-fg">
							{tSettings("studioTab.looks", "Looks")}
						</h3>
						<p className="mt-0.5 text-micro text-fg-subtle">
							{tSettings(
								"studioTab.opinionatedStylesNotGeneric",
								"Opinionated styles, not generic settings",
							)}
						</p>
					</div>
					{activePresetId && (
						<span className="shrink-0 rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-micro font-semibold uppercase tracking-wide text-accent-fg shadow-sm">
							{tSettings("studioTab.active", "Active")}
						</span>
					)}
				</div>

				<div className="grid grid-cols-1 gap-2">
					{SCENE_PRESETS.map((preset) => {
						const isActive = activePresetId === preset.id;
						const visual = getPresetVisual(preset.id);
						const Icon = visual.icon;

						return (
							<button
								key={preset.id}
								type="button"
								onClick={() => onApplyPreset(preset.id)}
								className={cn(
									"group relative overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200",
									"bg-fill-subtle hover:-translate-y-0.5 hover:border-line-strong",
									isActive
										? cn("border-accent/60 shadow-lg", visual.glow)
										: "border-line hover:border-line-strong",
								)}
							>
								<div
									className={cn(
										"absolute inset-y-0 left-0 w-1 bg-gradient-to-b opacity-80",
										visual.accent,
									)}
								/>
								<div className="flex items-center gap-2.5 pl-1">
									<span
										className={cn(
											"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[#08110f] shadow-sm transition-transform duration-200 group-",
											visual.accent,
										)}
									>
										<Icon className="h-4 w-4" />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<div className="truncate text-label font-semibold text-fg">
												{tSettings(`studioTab.presets.${preset.id}`, preset.label)}
											</div>
											{isActive && (
												<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
													<Check className="h-3 w-3" />
												</span>
											)}
										</div>
										<div className="mt-1 flex flex-wrap gap-1">
											{visual.chips.map((chip) => (
												<span
													key={chip}
													className="rounded-md border border-line bg-fill-subtle px-1.5 py-0.5 text-micro font-medium text-fg-muted"
												>
													{tSettings(`studioTab.chip${chip}`, chip)}
												</span>
											))}
										</div>
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</section>
		</TabContent>
	);
}
