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
		accent: "from-teal-300 via-emerald-300 to-amber-300",
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
		accent: "from-teal-300 via-green-300 to-lime-300",
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
		accent: "from-slate-200 via-sky-200 to-amber-200",
		glow: "shadow-slate-500/10",
		chips: ["Sharp", "Team"],
	},
};

function getPresetVisual(id: ScenePresetId): PresetVisual {
	return (
		PRESET_VISUALS[id as Exclude<ScenePresetId, "custom">] ?? {
			icon: Sparkles,
			accent: "from-amber-300 to-orange-400",
			glow: "shadow-amber-500/10",
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
	const zoomState = hasCursorTelemetry
		? hasExistingZooms
			? { label: "Preserve zooms", tone: "text-cyan-200 border-cyan-300/20 bg-cyan-300/10" }
			: {
					label: "Smart zoom ready",
					tone: "text-emerald-200 border-emerald-300/20 bg-emerald-300/10",
				}
		: { label: "No cursor data", tone: "text-slate-400 border-white/[0.08] bg-white/[0.04]" };

	return (
		<TabContent className="space-y-4">
			<TabHeader
				title="Studio"
				description="Creator-grade recipes for screen videos"
				badge="New"
				badgeColor="amber"
			/>

			<section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#111715] shadow-lg shadow-black/20">
				<div className="relative p-3">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_42%),linear-gradient(135deg,rgba(45,212,191,0.1),transparent_38%)]" />
					<div className="relative">
						<div className="mb-3 flex items-start justify-between gap-3">
							<div className="flex items-center gap-2">
								<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300/12 text-amber-200 ring-1 ring-amber-200/15">
									<WandSparkles className="h-4 w-4" />
								</span>
								<div>
									<div className="text-[13px] font-semibold text-white">Auto Beautify</div>
									<div className="mt-0.5 text-[10px] text-slate-400">
										Pick the right recipe and motion
									</div>
								</div>
							</div>
							<span
								className={cn(
									"shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide shadow-sm",
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
								className="h-9 justify-center gap-2 rounded-lg bg-[#F59E0B] text-xs font-semibold text-white shadow-lg shadow-amber-500/20 hover:bg-[#d97706]"
							>
								<Sparkles className="h-3.5 w-3.5" />
								Apply
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={!hasCursorTelemetry}
								onClick={onRegenerateZooms}
								className="h-9 w-9 rounded-lg border-white/[0.08] bg-white/[0.04] p-0 text-slate-200 hover:bg-white/[0.08]"
								title="Regenerate smart zooms"
							>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</div>

						<div className="mt-3 grid grid-cols-2 gap-2">
							<div className="rounded-lg border border-white/5 bg-black/15 px-2.5 py-2">
								<div className="flex items-center gap-1.5 text-[10px] text-slate-400">
									<MousePointerClick className="h-3 w-3" />
									Cursor data
								</div>
								<div className="mt-1 text-[11px] font-semibold text-slate-100">
									{hasCursorTelemetry ? "Ready" : "Missing"}
								</div>
							</div>
							<div className="rounded-lg border border-white/5 bg-black/15 px-2.5 py-2">
								<div className="flex items-center gap-1.5 text-[10px] text-slate-400">
									<RefreshCw className="h-3 w-3" />
									Zooms
								</div>
								<div className="mt-1 text-[11px] font-semibold text-slate-100">
									{hasExistingZooms ? "Keep current" : "Can create"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section>
				<div className="mb-2 flex items-end justify-between">
					<div>
						<h3 className="text-[11px] font-semibold tracking-wide text-slate-200">Looks</h3>
						<p className="mt-0.5 text-[10px] text-slate-500">
							Opinionated styles, not generic settings
						</p>
					</div>
					{activePresetId && (
						<span className="shrink-0 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fde68a] shadow-sm shadow-[#F59E0B]/10">
							Active
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
									"group relative overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200",
									"bg-white/[0.035] hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)]",
									isActive
										? cn("border-[#F59E0B]/60 shadow-lg", visual.glow)
										: "border-white/5 hover:border-white/[0.14]",
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
											"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[#08110f] shadow-sm transition-transform duration-200 group-hover:scale-105",
											visual.accent,
										)}
									>
										<Icon className="h-4 w-4" />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<div className="truncate text-[12px] font-semibold text-slate-100">
												{preset.label}
											</div>
											{isActive && (
												<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-white">
													<Check className="h-3 w-3" />
												</span>
											)}
										</div>
										<div className="mt-1 flex flex-wrap gap-1">
											{visual.chips.map((chip) => (
												<span
													key={chip}
													className="rounded-md border border-white/5 bg-black/15 px-1.5 py-0.5 text-[9px] font-medium text-slate-400"
												>
													{chip}
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
