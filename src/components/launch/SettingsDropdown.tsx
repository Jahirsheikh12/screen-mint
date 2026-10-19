import { Settings } from "lucide-react";
import { useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { HudSettings } from "@/hooks/useHudState";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTooltip } from "../ui/tooltip";
import { notifyHudDropdownToggle } from "./hudDropdownExpansion";
import styles from "./LaunchWindow.module.css";

type SettingsDropdownProps = {
	hudSettings: HudSettings;
	platform: string | null;
	recording: boolean;
	countdownDelay: number;
	setCountdownDelay: (delay: number) => void;
	onUpdateSettings: (update: Partial<HudSettings>) => void;
};

const DROPDOWN_CLASSES =
	"border-white/10 bg-[#1c1c1e] text-white/90 shadow-none data-[state=open]:!animate-none data-[state=closed]:!animate-none";

// Override the global Radix `accent` (which resolves to a near-white in light mode)
// with a dark-friendly hover so menu text stays readable on the HUD's dark popover.
const ITEM_HOVER =
	"focus:!bg-white/[0.08] focus:!text-white data-[state=open]:!bg-white/[0.08] data-[state=open]:!text-white";

export function SettingsDropdown({
	hudSettings,
	platform,
	recording,
	countdownDelay,
	setCountdownDelay,
	onUpdateSettings,
}: SettingsDropdownProps) {
	const t = useScopedT("launch");
	const isMac = platform === "darwin";
	const supportsHudCaptureProtection = platform !== "linux";
	const supportsSpeakerNotes = platform !== null;
	const settingsTooltip = useTooltip({ content: "Settings", side: "top" });
	const [recordingsDir, setRecordingsDir] = useState<string | null>(null);

	const handleOpenChange = (open: boolean) => {
		notifyHudDropdownToggle(open);
		if (open) {
			void window.electronAPI
				.getRecordingsDirectory()
				.then((result) => setRecordingsDir(result.success ? result.path : null));
		}
	};

	return (
		<DropdownMenu onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<button
					ref={settingsTooltip.triggerRef as React.RefObject<HTMLButtonElement>}
					onMouseEnter={settingsTooltip.onMouseEnter}
					onMouseLeave={settingsTooltip.onMouseLeave}
					type="button"
					aria-label="Settings"
					className={`flex items-center justify-center rounded-lg w-8 h-8 text-white/55 hover:text-white/95 hover:bg-white/[0.08] transition-colors cursor-pointer ${styles.electronNoDrag}`}
				>
					<Settings size={14} strokeWidth={2.5} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="top"
				align="end"
				className={`min-w-[280px] ${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}
			>
				<DropdownMenuCheckboxItem
					checked={hudSettings.hideDesktopIcons}
					onCheckedChange={(checked) => onUpdateSettings({ hideDesktopIcons: Boolean(checked) })}
					disabled={!isMac}
					className={`text-xs ${ITEM_HOVER}`}
				>
					{t("settings.hideDesktopIcons")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.hideDockIcon}
					onCheckedChange={(checked) => onUpdateSettings({ hideDockIcon: Boolean(checked) })}
					disabled={!isMac}
					className={`text-xs ${ITEM_HOVER}`}
				>
					{t("settings.hideDockIcon")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.highlightArea}
					onCheckedChange={(checked) => onUpdateSettings({ highlightArea: Boolean(checked) })}
					className={`text-xs ${ITEM_HOVER}`}
				>
					{t("settings.highlightArea")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.openQuickShare}
					onCheckedChange={(checked) => onUpdateSettings({ openQuickShare: Boolean(checked) })}
					className={`text-xs ${ITEM_HOVER}`}
				>
					{t("settings.openQuickShare")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuSeparator className="bg-white/[0.08]" />

				<DropdownMenuCheckboxItem
					checked={hudSettings.speakerNotesEnabled}
					onCheckedChange={(checked) => onUpdateSettings({ speakerNotesEnabled: Boolean(checked) })}
					disabled={!supportsSpeakerNotes}
					className={`text-xs ${ITEM_HOVER}`}
				>
					{t("settings.speakerNotes")}
				</DropdownMenuCheckboxItem>

				{/* Recording countdown */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger disabled={recording} className={`text-xs ${ITEM_HOVER}`}>
						{t("settings.recordingCountdown")}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
						<DropdownMenuRadioGroup
							value={String(countdownDelay)}
							onValueChange={(value) => setCountdownDelay(Number(value))}
						>
							<DropdownMenuRadioItem value="0" className={`text-xs ${ITEM_HOVER}`}>
								{t("recording.noDelay")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="3" className={`text-xs ${ITEM_HOVER}`}>
								3s
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="5" className={`text-xs ${ITEM_HOVER}`}>
								5s
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="10" className={`text-xs ${ITEM_HOVER}`}>
								10s
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				{/* Advanced */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className={`text-xs ${ITEM_HOVER}`}>
						{t("settings.advanced")}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger className={`text-xs ${ITEM_HOVER}`}>
								{t("settings.recordingQuality")}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
								<DropdownMenuRadioGroup
									value={hudSettings.recordingQuality}
									onValueChange={(value) =>
										onUpdateSettings({
											recordingQuality: value as "auto" | "high" | "medium",
										})
									}
								>
									<DropdownMenuRadioItem value="auto" className={`text-xs ${ITEM_HOVER}`}>
										{t("settings.qualityAuto")}
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="high" className={`text-xs ${ITEM_HOVER}`}>
										{t("settings.qualityHigh")}
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="medium" className={`text-xs ${ITEM_HOVER}`}>
										{t("settings.qualityMedium")}
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuSub>
							<DropdownMenuSubTrigger className={`text-xs ${ITEM_HOVER}`}>
								{t("settings.fps")}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
								<DropdownMenuRadioGroup
									value={String(hudSettings.recordingFps)}
									onValueChange={(value) =>
										onUpdateSettings({
											recordingFps: Number(value) as 30 | 60,
										})
									}
								>
									<DropdownMenuRadioItem value="30" className={`text-xs ${ITEM_HOVER}`}>
										30 FPS
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="60" className={`text-xs ${ITEM_HOVER}`}>
										60 FPS
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuSeparator className="bg-white/[0.08]" />

						<DropdownMenuCheckboxItem
							checked={hudSettings.hardwareAcceleration}
							onCheckedChange={(checked) =>
								onUpdateSettings({ hardwareAcceleration: Boolean(checked) })
							}
							className={`text-xs ${ITEM_HOVER}`}
						>
							{t("settings.hardwareAcceleration")}
						</DropdownMenuCheckboxItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSeparator className="bg-white/[0.08]" />

				{supportsHudCaptureProtection && (
					<DropdownMenuCheckboxItem
						checked={hudSettings.hiddenFromCapture}
						onCheckedChange={(checked) => {
							const enabled = Boolean(checked);
							onUpdateSettings({ hiddenFromCapture: enabled });
							void window.electronAPI.setHudOverlayCaptureProtection(enabled);
						}}
						className={`text-xs ${ITEM_HOVER}`}
					>
						{t("settings.hideHudFromCapture")}
					</DropdownMenuCheckboxItem>
				)}

				<DropdownMenuSeparator className="bg-white/[0.08]" />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className={`text-xs ${ITEM_HOVER}`}>
						Recordings folder
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="max-w-[260px]">
						{recordingsDir && (
							<div className="px-2 py-1.5 text-[10px] text-white/50 break-all">{recordingsDir}</div>
						)}
						<DropdownMenuItem
							disabled={recording}
							onSelect={() => {
								void window.electronAPI.chooseRecordingsDirectory().then((result) => {
									if (result.success && result.path) setRecordingsDir(result.path);
								});
							}}
							className={`text-xs ${ITEM_HOVER}`}
						>
							Choose folder…
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => void window.electronAPI.openRecordingsFolder()}
							className={`text-xs ${ITEM_HOVER}`}
						>
							Open folder
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
