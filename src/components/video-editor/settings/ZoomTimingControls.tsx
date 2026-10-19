import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SliderControl } from "../SliderControl";
import {
	DEFAULT_ZOOM_TIMING,
	ZOOM_TRANSITION_EASING_OPTIONS,
	type ZoomTimingSettings,
	type ZoomTransitionEasing,
} from "../types";

interface ZoomTimingControlsProps {
	zoomTiming: ZoomTimingSettings;
	connectZooms: boolean;
	onZoomTimingChange?: (timing: ZoomTimingSettings) => void;
}

const formatMs = (value: number) => `${Math.round(value)}ms`;
const parseMs = (text: string) => {
	const value = parseFloat(text.replace(/ms$/, ""));
	return Number.isFinite(value) ? value : null;
};

export function ZoomTimingControls({
	zoomTiming,
	connectZooms,
	onZoomTimingChange,
}: ZoomTimingControlsProps) {
	const update = (patch: Partial<ZoomTimingSettings>) =>
		onZoomTimingChange?.({ ...zoomTiming, ...patch });

	const durationSlider = (
		key:
			| "zoomInDurationMs"
			| "zoomInOverlapMs"
			| "zoomOutDurationMs"
			| "connectedZoomGapMs"
			| "connectedZoomDurationMs",
		label: string,
		max: number,
	) => (
		<SliderControl
			label={label}
			value={zoomTiming[key]}
			defaultValue={DEFAULT_ZOOM_TIMING[key]}
			min={0}
			max={max}
			step={10}
			onChange={(value) => update({ [key]: value })}
			formatValue={formatMs}
			parseInput={parseMs}
		/>
	);

	const easingSelect = (
		key: "zoomInEasing" | "zoomOutEasing" | "connectedZoomEasing",
		label: string,
	) => (
		<div className="flex items-center justify-between gap-3">
			<span className="text-xs font-medium text-slate-300">{label}</span>
			<Select
				value={zoomTiming[key]}
				onValueChange={(value) => update({ [key]: value as ZoomTransitionEasing })}
			>
				<SelectTrigger className="h-8 w-32 bg-white/5 border-white/10 text-xs text-slate-200 hover:bg-white/10">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="bg-[#1a1a1f] border-white/10 z-[100]">
					{ZOOM_TRANSITION_EASING_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value} className="text-xs">
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);

	return (
		<div className="space-y-3 rounded-xl border border-white/5 bg-black/40 p-2.5">
			{durationSlider("zoomInDurationMs", "Zoom In Duration", 3000)}
			{durationSlider("zoomInOverlapMs", "Zoom In Overlap", 2000)}
			{easingSelect("zoomInEasing", "Zoom In Curve")}
			{durationSlider("zoomOutDurationMs", "Zoom Out Duration", 3000)}
			{easingSelect("zoomOutEasing", "Zoom Out Curve")}
			{connectZooms && (
				<>
					{durationSlider("connectedZoomGapMs", "Connected Zoom Gap", 5000)}
					{durationSlider("connectedZoomDurationMs", "Connected Zoom Duration", 3000)}
					{easingSelect("connectedZoomEasing", "Connected Pan Curve")}
				</>
			)}
		</div>
	);
}
