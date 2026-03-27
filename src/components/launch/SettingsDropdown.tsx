import { Settings } from "lucide-react";
import { useScopedT } from "@/contexts/I18nContext";
import type { HudSettings } from "@/hooks/useHudState";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
	"border-white/[0.08] bg-[rgba(28,28,30,0.97)] text-white/90 backdrop-blur-2xl shadow-xl shadow-black/40";

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

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title="Settings"
					className={`flex items-center justify-center rounded-lg w-8 h-8 text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors cursor-pointer ${styles.electronNoDrag}`}
				>
					<Settings size={14} />
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
					className="text-xs"
				>
					{t("settings.hideDesktopIcons")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.hideDockIcon}
					onCheckedChange={(checked) => onUpdateSettings({ hideDockIcon: Boolean(checked) })}
					disabled={!isMac}
					className="text-xs"
				>
					{t("settings.hideDockIcon")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.highlightArea}
					onCheckedChange={(checked) => onUpdateSettings({ highlightArea: Boolean(checked) })}
					className="text-xs"
				>
					{t("settings.highlightArea")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuCheckboxItem
					checked={hudSettings.openQuickShare}
					onCheckedChange={(checked) => onUpdateSettings({ openQuickShare: Boolean(checked) })}
					className="text-xs"
				>
					{t("settings.openQuickShare")}
				</DropdownMenuCheckboxItem>

				<DropdownMenuSeparator className="bg-white/[0.08]" />

				<DropdownMenuCheckboxItem
					checked={hudSettings.speakerNotesEnabled}
					onCheckedChange={(checked) => onUpdateSettings({ speakerNotesEnabled: Boolean(checked) })}
					disabled={!supportsSpeakerNotes}
					className="text-xs"
				>
					{t("settings.speakerNotes")}
				</DropdownMenuCheckboxItem>

				{/* Recording countdown */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger disabled={recording} className="text-xs">
						{t("settings.recordingCountdown")}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
						<DropdownMenuRadioGroup
							value={String(countdownDelay)}
							onValueChange={(value) => setCountdownDelay(Number(value))}
						>
							<DropdownMenuRadioItem value="0" className="text-xs">
								{t("recording.noDelay")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="3" className="text-xs">
								3s
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="5" className="text-xs">
								5s
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="10" className="text-xs">
								10s
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				{/* Advanced */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className="text-xs">
						{t("settings.advanced")}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className={`${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger className="text-xs">
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
									<DropdownMenuRadioItem value="auto" className="text-xs">
										{t("settings.qualityAuto")}
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="high" className="text-xs">
										{t("settings.qualityHigh")}
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="medium" className="text-xs">
										{t("settings.qualityMedium")}
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuSub>
							<DropdownMenuSubTrigger className="text-xs">
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
									<DropdownMenuRadioItem value="30" className="text-xs">
										30 FPS
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="60" className="text-xs">
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
							className="text-xs"
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
						className="text-xs"
					>
						{t("settings.hideHudFromCapture")}
					</DropdownMenuCheckboxItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
