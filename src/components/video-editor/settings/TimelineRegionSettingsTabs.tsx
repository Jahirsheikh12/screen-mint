import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsSection, TabContent, TabHeader } from "../settingsPanelLayout";
import type { PlaybackSpeed, ZoomDepth, ZoomMode } from "../types";
import { SPEED_OPTIONS } from "../types";

type SettingsTranslator = (key: string, fallback?: string) => string;

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

interface ZoomSettingsTabProps {
	tSettings: SettingsTranslator;
	selectedZoomDepth?: ZoomDepth | null;
	selectedZoomMode?: ZoomMode | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	onZoomModeChange?: (mode: ZoomMode) => void;
	zoomEnabled: boolean;
	trimEnabled: boolean;
	onZoomDelete: () => void;
	onTrimDelete: () => void;
}

export function ZoomSettingsTab({
	tSettings,
	selectedZoomDepth,
	selectedZoomMode,
	onZoomDepthChange,
	onZoomModeChange,
	zoomEnabled,
	trimEnabled,
	onZoomDelete,
	onTrimDelete,
}: ZoomSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("zoom.level")}
				description={tSettings(
					"regionsTab.chooseMagnificationLevelFor",
					"Choose magnification level for zoom regions",
				)}
				badge={
					zoomEnabled && selectedZoomDepth
						? ZOOM_DEPTH_OPTIONS.find((option) => option.depth === selectedZoomDepth)?.label
						: undefined
				}
			/>

			<SettingsSection
				title={tSettings("regionsTab.zoomDepth", "Zoom Depth")}
				description={tSettings(
					"regionsTab.selectHowMuchTo",
					"Select how much to magnify the zoomed area",
				)}
			>
				<div className="grid grid-cols-2 gap-1.5">
					{(
						[
							{ value: "cursor-follow", label: tSettings("regionsTab.auto", "Auto") },
							{ value: "static", label: tSettings("regionsTab.manual", "Manual") },
						] as const
					).map((option) => {
						const isActive = selectedZoomMode === option.value;
						return (
							<Button
								key={option.value}
								type="button"
								disabled={!zoomEnabled}
								onClick={() => onZoomModeChange?.(option.value)}
								className={cn(
									"h-10 rounded-xl border shadow-sm transition-all justify-center",
									"duration-200 ease-out",
									zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
									isActive
										? "border-accent bg-gradient-to-br from-accent to-accent-hover text-on-accent shadow-lg shadow-accent/25"
										: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:border-line-strong hover:text-fg",
								)}
							>
								<span className="text-label font-semibold">{option.label}</span>
							</Button>
						);
					})}
				</div>
				{zoomEnabled && selectedZoomMode && (
					<p className="text-micro leading-relaxed text-fg-subtle">
						{selectedZoomMode === "cursor-follow"
							? tSettings(
									"regionsTab.autoHint",
									"Camera recenters when the cursor nears the edge of the zoomed view",
								)
							: tSettings("regionsTab.manualHint", "Set a fixed focus point for this zoom")}
					</p>
				)}
				<div className="grid grid-cols-3 gap-1.5">
					{ZOOM_DEPTH_OPTIONS.map((option) => {
						const isActive = selectedZoomDepth === option.depth;
						return (
							<Button
								key={option.depth}
								type="button"
								disabled={!zoomEnabled}
								onClick={() => onZoomDepthChange?.(option.depth)}
								className={cn(
									"h-10 rounded-xl border shadow-sm transition-all justify-center",
									"duration-200 ease-out",
									zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
									isActive
										? "border-accent bg-gradient-to-br from-accent to-accent-hover text-on-accent shadow-lg shadow-accent/25"
										: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:border-line-strong hover:text-fg",
								)}
							>
								<span className="text-label font-semibold">{option.label}</span>
							</Button>
						);
					})}
				</div>
				{!zoomEnabled && (
					<div className="flex items-center justify-center py-3 px-4 rounded-xl bg-fill-subtle border border-dashed border-line">
						<p className="text-micro text-fg-subtle text-center">
							{tSettings("zoom.selectRegion")}
						</p>
					</div>
				)}
				{zoomEnabled && (
					<Button
						onClick={onZoomDelete}
						variant="destructive"
						size="sm"
						className="w-full gap-2 bg-danger/8 text-danger-fg border border-danger/15 hover:bg-danger/15 hover:border-danger/25 transition-all duration-200 h-9 text-label rounded-xl"
					>
						<Trash2 className="w-3.5 h-3.5" />
						{tSettings("zoom.deleteZoom")}
					</Button>
				)}
			</SettingsSection>

			{trimEnabled && (
				<SettingsSection
					title={tSettings("regionsTab.trimRegion", "Trim Region")}
					description={tSettings(
						"regionsTab.removeTheSelectedTrim",
						"Remove the selected trim region from the timeline",
					)}
					accentColor="red"
				>
					<Button
						onClick={onTrimDelete}
						variant="destructive"
						size="sm"
						className="w-full gap-2 bg-danger/8 text-danger-fg border border-danger/15 hover:bg-danger/15 hover:border-danger/25 transition-all duration-200 h-9 text-label rounded-xl"
					>
						<Trash2 className="w-3.5 h-3.5" />
						{tSettings("trim.deleteRegion")}
					</Button>
				</SettingsSection>
			)}
		</TabContent>
	);
}

interface SpeedSettingsTabProps {
	tSettings: SettingsTranslator;
	selectedSpeedId?: string | null;
	selectedSpeedValue?: PlaybackSpeed | null;
	onSpeedChange?: (speed: PlaybackSpeed) => void;
	onSpeedDelete?: (id: string) => void;
}

export function SpeedSettingsTab({
	tSettings,
	selectedSpeedId,
	selectedSpeedValue,
	onSpeedChange,
	onSpeedDelete,
}: SpeedSettingsTabProps) {
	return (
		<TabContent>
			<TabHeader
				title={tSettings("speed.playbackSpeed")}
				description={tSettings(
					"regionsTab.adjustPlaybackSpeedFor",
					"Adjust playback speed for selected timeline regions",
				)}
				badge={
					selectedSpeedId && selectedSpeedValue
						? (SPEED_OPTIONS.find((option) => option.speed === selectedSpeedValue)?.label ??
							`${selectedSpeedValue}×`)
						: undefined
				}
				badgeColor="amber"
			/>

			<SettingsSection
				title={tSettings("regionsTab.speedPresets", "Speed Presets")}
				description={tSettings(
					"regionsTab.chooseASpeedMultiplier",
					"Choose a speed multiplier for the selected region",
				)}
				accentColor="amber"
			>
				<div className="grid grid-cols-3 gap-1.5">
					{SPEED_OPTIONS.map((option) => {
						const isActive = selectedSpeedValue === option.speed;
						return (
							<Button
								key={option.speed}
								type="button"
								disabled={!selectedSpeedId}
								onClick={() => onSpeedChange?.(option.speed)}
								className={cn(
									"h-10 rounded-xl border shadow-sm transition-all justify-center",
									"duration-200 ease-out",
									selectedSpeedId ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
									isActive
										? "border-accent-hover bg-gradient-to-br from-accent-hover to-accent-hover text-fg shadow-lg shadow-accent-hover/25"
										: "border-line bg-fill-subtle text-fg-muted hover:bg-fill-hover hover:border-line-strong hover:text-fg",
								)}
							>
								<span className="text-label font-semibold">{option.label}</span>
							</Button>
						);
					})}
				</div>
				{!selectedSpeedId && (
					<div className="flex items-center justify-center py-3 px-4 rounded-xl bg-fill-subtle border border-dashed border-line">
						<p className="text-micro text-fg-subtle text-center">
							{tSettings("speed.selectRegion")}
						</p>
					</div>
				)}
				{selectedSpeedId && (
					<Button
						onClick={() => selectedSpeedId && onSpeedDelete?.(selectedSpeedId)}
						variant="destructive"
						size="sm"
						className="w-full gap-2 bg-danger/8 text-danger-fg border border-danger/15 hover:bg-danger/15 hover:border-danger/25 transition-all duration-200 h-9 text-label rounded-xl"
					>
						<Trash2 className="w-3.5 h-3.5" />
						{tSettings("speed.deleteRegion")}
					</Button>
				)}
			</SettingsSection>
		</TabContent>
	);
}
