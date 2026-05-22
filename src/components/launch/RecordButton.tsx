import { ChevronDown } from "lucide-react";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { useScopedT } from "@/contexts/I18nContext";
import type { AfterRecordingAction, HudSettings } from "@/hooks/useHudState";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import styles from "./LaunchWindow.module.css";

type RecordButtonProps = {
	recording: boolean;
	countdownActive: boolean;
	hasSelectedSource: boolean;
	elapsed: number;
	hudSettings: HudSettings;
	onToggleRecording: () => void;
	onOpenSourceSelector: () => void;
	onUpdateSettings: (update: Partial<HudSettings>) => void;
};

export function RecordButton({
	recording,
	countdownActive,
	hasSelectedSource,
	elapsed,
	hudSettings,
	onToggleRecording,
	onOpenSourceSelector,
	onUpdateSettings,
}: RecordButtonProps) {
	const t = useScopedT("launch");

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	const handleMainClick = () => {
		if (hasSelectedSource || recording) {
			onToggleRecording();
		} else {
			onOpenSourceSelector();
		}
	};

	const isDisabled = countdownActive || (!hasSelectedSource && !recording);

	if (recording) {
		return (
			<button
				type="button"
				onClick={onToggleRecording}
				className="flex items-center gap-2.5 rounded-xl bg-red-500/15 px-6 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/25 transition-all cursor-pointer border border-red-500/20"
			>
				<FaRegStopCircle size={15} />
				<span className="tabular-nums font-semibold">{formatTime(elapsed)}</span>
			</button>
		);
	}

	return (
		<div className="flex items-center">
			{/* Main record button */}
			<button
				type="button"
				onClick={handleMainClick}
				disabled={isDisabled}
				className={`flex items-center gap-2.5 rounded-l-xl px-6 py-2.5 text-sm font-medium transition-all ${
					isDisabled
						? "bg-purple-600/30 text-white/40 cursor-not-allowed"
						: "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-400 cursor-pointer"
				}`}
			>
				<BsRecordCircle size={14} />
				<span>{t("recording.startRecording")}</span>
			</button>

			{/* Dropdown chevron — visually connected */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						disabled={isDisabled}
						className={`flex items-center rounded-r-xl px-2.5 py-2.5 transition-all border-l ${
							isDisabled
								? "bg-purple-600/30 text-white/40 cursor-not-allowed border-purple-500/20"
								: "bg-gradient-to-r from-purple-500 to-purple-400 text-white hover:from-purple-400 hover:to-purple-300 border-purple-400/30 cursor-pointer"
						}`}
					>
						<ChevronDown size={14} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="top"
					align="center"
					className={`min-w-[240px] border-white/10 bg-[rgba(17,28,24,0.97)] text-white/90 backdrop-blur-xl data-[state=open]:!animate-none data-[state=closed]:!animate-none ${styles.hudScrollArea}`}
				>
					<DropdownMenuRadioGroup
						value={hudSettings.afterRecordingAction}
						onValueChange={(value) =>
							onUpdateSettings({
								afterRecordingAction: value as AfterRecordingAction,
							})
						}
					>
						<DropdownMenuRadioItem value="create-project" className="text-xs">
							{t("afterRecording.createProject")}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="export-clipboard" className="text-xs">
							{t("afterRecording.exportClipboard")}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="export-share-link" className="text-xs">
							{t("afterRecording.exportShareLink")}
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="export-save-file" className="text-xs">
							{t("afterRecording.exportSaveFile")}
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator className="bg-white/10" />
					<DropdownMenuCheckboxItem
						checked={hudSettings.autoCreateZooms}
						onCheckedChange={(checked) => onUpdateSettings({ autoCreateZooms: Boolean(checked) })}
						className="text-xs"
					>
						{t("afterRecording.autoCreateZooms")}
					</DropdownMenuCheckboxItem>
					<DropdownMenuSeparator className="bg-white/10" />
					<DropdownMenuItem disabled className="text-xs text-white/30">
						Quick export settings...
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
