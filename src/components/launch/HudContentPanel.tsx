import type { HudMode, HudSettings } from "@/hooks/useHudState";
import styles from "./LaunchWindow.module.css";
import { RecordButton } from "./RecordButton";
import { AreaTab } from "./tabs/AreaTab";
import { DeviceTab } from "./tabs/DeviceTab";
import { DisplayTab } from "./tabs/DisplayTab";
import { WindowTab } from "./tabs/WindowTab";

type HudContentPanelProps = {
	mode: HudMode;
	visible: boolean;
	recording: boolean;
	countdownActive: boolean;
	hasSelectedSource: boolean;
	elapsed: number;
	hudSettings: HudSettings;
	onToggleRecording: () => void;
	onOpenSourceSelector: () => void;
	onUpdateSettings: (update: Partial<HudSettings>) => void;
	onSelectSource: (source: { id: string; name: string; display_id: string }) => void;
	onSetMode: (mode: HudMode) => void;
};

export function HudContentPanel({
	mode,
	visible,
	recording,
	countdownActive,
	hasSelectedSource,
	elapsed,
	hudSettings,
	onToggleRecording,
	onOpenSourceSelector,
	onUpdateSettings,
	onSelectSource,
	onSetMode,
}: HudContentPanelProps) {
	const handleSelectSource = (source: { id: string; name: string; display_id: string }) => {
		onSelectSource(source);
	};

	return (
		<div
			className={`${styles.electronNoDrag} transition-all duration-300 ease-out`}
			style={{
				maxHeight: visible ? 300 : 0,
				opacity: visible ? 1 : 0,
				overflow: "hidden",
			}}
		>
			<div className="px-4 pt-3 pb-2">
				{/* Tab content */}
				<div className="min-h-[90px]">
					{mode === "display" && (
						<DisplayTab disabled={recording} onSelectSource={handleSelectSource} />
					)}
					{mode === "window" && (
						<WindowTab
							disabled={recording}
							onSelectSource={handleSelectSource}
							onFallbackToDisplay={() => onSetMode("display")}
						/>
					)}
					{mode === "area" && <AreaTab disabled={recording} />}
					{mode === "device" && <DeviceTab />}
				</div>

				{/* Record button */}
				<div className="flex justify-center pt-2 pb-1">
					<RecordButton
						recording={recording}
						countdownActive={countdownActive}
						hasSelectedSource={hasSelectedSource}
						elapsed={elapsed}
						hudSettings={hudSettings}
						onToggleRecording={onToggleRecording}
						onOpenSourceSelector={onOpenSourceSelector}
						onUpdateSettings={onUpdateSettings}
					/>
				</div>
			</div>
		</div>
	);
}
