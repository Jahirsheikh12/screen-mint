import { Languages } from "lucide-react";
import { FaPause, FaPlay, FaRegStopCircle } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";
import {
	MdCropFree,
	MdDevices,
	MdMic,
	MdMicOff,
	MdMonitor,
	MdVideocam,
	MdVideocamOff,
	MdVideoFile,
	MdVolumeOff,
	MdVolumeUp,
	MdWindow,
} from "react-icons/md";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import type { CameraDeviceOption, HudMode, HudSettings } from "@/hooks/useHudState";
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import styles from "./LaunchWindow.module.css";
import { SettingsDropdown } from "./SettingsDropdown";

type HudToolbarProps = {
	mode: HudMode;
	onTabClick: (mode: HudMode) => void;
	recording: boolean;
	paused: boolean;
	elapsed: number;
	onToggleRecording: () => void;
	onTogglePause: () => void;
	microphoneEnabled: boolean;
	setMicrophoneEnabled: (enabled: boolean) => void;
	microphoneDeviceId: string | undefined;
	setMicrophoneDeviceId: (deviceId: string | undefined) => void;
	systemAudioEnabled: boolean;
	setSystemAudioEnabled: (enabled: boolean) => void;
	webcamEnabled: boolean;
	cameraSession: {
		enabled: boolean;
		deviceId?: string;
		previewVisible: boolean;
		previewMirrored: boolean;
	};
	setCameraDeviceId: (deviceId?: string) => void;
	setCameraPreviewVisible: (visible: boolean) => void;
	setCameraPreviewMirrored: (mirrored: boolean) => void;
	cameraDevices: CameraDeviceOption[];
	showMicControls: boolean;
	micDevices: Array<{ deviceId: string; label: string }>;
	selectedMicDeviceId: string;
	setSelectedMicDeviceId: (id: string) => void;
	audioLevel: number;
	onOpenVideoFile: () => void;
	onOpenProject: () => void;
	onHide: () => void;
	onClose: () => void;
	hudSettings: HudSettings;
	platform: string | null;
	countdownDelay: number;
	setCountdownDelay: (delay: number) => void;
	onUpdateSettings: (update: Partial<HudSettings>) => void;
};

const MODE_ICONS: Record<HudMode, React.ComponentType<{ size?: number; className?: string }>> = {
	display: MdMonitor,
	window: MdWindow,
	area: MdCropFree,
	device: MdDevices,
};

const DROPDOWN_CLASSES =
	"border-white/[0.08] bg-[rgba(28,28,30,0.97)] text-white/90 backdrop-blur-2xl shadow-xl shadow-black/40";

const LOCALE_LABELS: Record<string, string> = { en: "EN", es: "ES", "zh-CN": "\u4E2D\u6587" };

const ND = styles.electronNoDrag;

export function HudToolbar({
	mode,
	onTabClick,
	recording,
	paused,
	elapsed,
	onToggleRecording,
	onTogglePause,
	microphoneEnabled,
	setMicrophoneEnabled,
	microphoneDeviceId,
	setMicrophoneDeviceId,
	systemAudioEnabled,
	setSystemAudioEnabled,
	webcamEnabled,
	cameraSession,
	setCameraDeviceId,
	setCameraPreviewVisible,
	setCameraPreviewMirrored,
	cameraDevices,
	showMicControls,
	micDevices,
	selectedMicDeviceId,
	setSelectedMicDeviceId,
	audioLevel,
	onOpenVideoFile,
	onOpenProject,
	onHide,
	onClose,
	hudSettings,
	platform,
	countdownDelay,
	setCountdownDelay,
	onUpdateSettings,
}: HudToolbarProps) {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");

	const tabs: HudMode[] = ["display", "window", "area", "device"];

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	/* ── Recording state: compact bar ── */
	if (recording) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 10,
					padding: "8px 14px",
					minHeight: 48,
				}}
			>
				{/* Recording indicator + timer */}
				<div className="flex items-center gap-2.5">
					<div
						className={`h-[9px] w-[9px] rounded-full ${paused ? "bg-yellow-500" : "bg-red-500"} ${paused ? "" : styles.recordingPulse}`}
					/>
					<span className="text-[13px] font-mono font-semibold tabular-nums tracking-wider text-white/90">
						{formatTime(elapsed)}
					</span>
				</div>

				<div className="h-4 w-px bg-white/[0.08]" />

				{/* Pause / Resume button */}
				<button
					type="button"
					onClick={onTogglePause}
					className={`${ND} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
						paused
							? "bg-yellow-500/[0.12] text-yellow-400 hover:bg-yellow-500/[0.2] border border-yellow-500/[0.15]"
							: "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80 border border-white/[0.06]"
					}`}
				>
					{paused ? <FaPlay size={9} /> : <FaPause size={9} />}
					<span>{paused ? "Resume" : "Pause"}</span>
				</button>

				{/* Stop button */}
				<button
					type="button"
					onClick={onToggleRecording}
					className={`${ND} flex items-center gap-1.5 rounded-full bg-red-500/[0.1] px-3 py-1.5 text-[11px] font-medium text-red-400 transition-all hover:bg-red-500/[0.18] border border-red-500/[0.12] cursor-pointer`}
				>
					<FaRegStopCircle size={10} />
					<span>{t("recording.stopRecording")}</span>
				</button>

				{/* Minimize */}
				<button
					type="button"
					onClick={onHide}
					title={t("recording.hideHud")}
					className={`${ND} flex items-center justify-center rounded-md p-1.5 text-white/20 hover:text-white/45 hover:bg-white/[0.06] transition-colors cursor-pointer`}
				>
					<FiMinus size={13} />
				</button>
			</div>
		);
	}

	/* ── Idle state: full toolbar ── */
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				padding: "6px 10px",
				minHeight: 48,
			}}
		>
			{/* Close button */}
			<button
				type="button"
				onClick={onClose}
				title={t("recording.closeApp")}
				className={`${ND} flex items-center justify-center rounded-lg p-2 text-white/25 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer`}
			>
				<FiX size={14} />
			</button>

			<div className="h-4 w-px bg-white/[0.06] mx-0.5" />

			{/* Segmented tab control */}
			<div className={`${ND} flex items-center rounded-[10px] bg-white/[0.04] p-[3px]`}>
				{tabs.map((tab) => {
					const Icon = MODE_ICONS[tab];
					const isActive = mode === tab;
					return (
						<button
							key={tab}
							type="button"
							onClick={() => onTabClick(tab)}
							disabled={recording}
							className={`flex items-center gap-1.5 rounded-[7px] px-2.5 py-[6px] text-[11px] font-medium transition-all ${
								isActive
									? "bg-white/[0.1] text-white/90 shadow-sm"
									: "text-white/35 hover:text-white/60"
							} cursor-pointer`}
						>
							<Icon size={13} />
							<span>{t(`tabs.${tab}`)}</span>
						</button>
					);
				})}
			</div>

			<div className="h-4 w-px bg-white/[0.06] mx-0.5" />

			{/* Media controls */}
			<div className={`${ND} flex items-center`}>
				{/* Camera dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							title={t("recording.selectCamera")}
							className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
								webcamEnabled
									? "text-white/90 bg-white/[0.08]"
									: "text-white/30 hover:text-white/50 hover:bg-white/[0.05]"
							}`}
						>
							{webcamEnabled ? <MdVideocam size={15} /> : <MdVideocamOff size={15} />}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="center"
						className={`min-w-[220px] ${DROPDOWN_CLASSES}`}
					>
						<DropdownMenuLabel className="text-[11px] text-white/45 font-medium">
							{t("recording.selectCamera")}
						</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={cameraSession.deviceId ?? "__off__"}
							onValueChange={(value) => setCameraDeviceId(value === "__off__" ? undefined : value)}
						>
							<DropdownMenuRadioItem value="__off__" className="text-xs">
								{t("recording.cameraOff")}
							</DropdownMenuRadioItem>
							{cameraDevices.map((device) => (
								<DropdownMenuRadioItem
									key={device.deviceId}
									value={device.deviceId}
									className="text-xs"
								>
									{device.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
						{cameraDevices.length === 0 && (
							<DropdownMenuItem disabled className="text-xs text-white/30">
								{t("recording.noCameraFound")}
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator className="bg-white/[0.08]" />
						<DropdownMenuCheckboxItem
							checked={!cameraSession.previewVisible}
							onCheckedChange={(checked) => setCameraPreviewVisible(!checked)}
							disabled={!cameraSession.enabled}
							className="text-xs"
						>
							{t("recording.hideCameraPreview")}
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={cameraSession.previewMirrored}
							onCheckedChange={(checked) => setCameraPreviewMirrored(Boolean(checked))}
							disabled={!cameraSession.enabled}
							className="text-xs"
						>
							{t("recording.mirrorCameraPreview")}
						</DropdownMenuCheckboxItem>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Microphone dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							title={
								microphoneEnabled
									? t("recording.disableMicrophone")
									: t("recording.enableMicrophone")
							}
							className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
								microphoneEnabled
									? "text-white/90 bg-white/[0.08]"
									: "text-white/30 hover:text-white/50 hover:bg-white/[0.05]"
							}`}
						>
							{microphoneEnabled ? <MdMic size={15} /> : <MdMicOff size={15} />}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="center"
						className={`min-w-[240px] ${DROPDOWN_CLASSES}`}
					>
						<DropdownMenuCheckboxItem
							checked={microphoneEnabled}
							onCheckedChange={(checked) => {
								if (!recording) setMicrophoneEnabled(Boolean(checked));
							}}
							className="text-xs"
						>
							{t("recording.enableMicrophone")}
						</DropdownMenuCheckboxItem>
						<DropdownMenuSeparator className="bg-white/[0.08]" />
						<DropdownMenuLabel className="text-[11px] text-white/45 font-medium">
							{t("recording.microphone")}
						</DropdownMenuLabel>
						{micDevices.map((device) => (
							<DropdownMenuItem
								key={device.deviceId}
								onSelect={() => {
									setSelectedMicDeviceId(device.deviceId);
									setMicrophoneDeviceId(device.deviceId);
								}}
								className={`text-xs cursor-pointer ${
									(microphoneDeviceId || selectedMicDeviceId) === device.deviceId
										? "text-white font-medium"
										: "text-white/50"
								}`}
							>
								{device.label}
							</DropdownMenuItem>
						))}
						{showMicControls && (
							<>
								<DropdownMenuSeparator className="bg-white/[0.08]" />
								<div className="px-2 py-1.5">
									<AudioLevelMeter level={audioLevel} className="w-full" />
								</div>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* System audio toggle */}
				<button
					type="button"
					onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
					title={
						systemAudioEnabled
							? t("recording.disableSystemAudio")
							: t("recording.enableSystemAudio")
					}
					className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
						systemAudioEnabled
							? "text-white/90 bg-white/[0.08]"
							: "text-white/30 hover:text-white/50 hover:bg-white/[0.05]"
					}`}
				>
					{systemAudioEnabled ? <MdVolumeUp size={15} /> : <MdVolumeOff size={15} />}
				</button>
			</div>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Right utilities */}
			<div className={`${ND} flex items-center`}>
				<button
					type="button"
					onClick={onOpenVideoFile}
					title={t("recording.openVideoFile")}
					className="flex items-center justify-center rounded-lg w-8 h-8 text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors cursor-pointer"
				>
					<MdVideoFile size={14} />
				</button>
				<button
					type="button"
					onClick={onOpenProject}
					title={t("recording.openProject")}
					className="flex items-center justify-center rounded-lg w-8 h-8 text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors cursor-pointer"
				>
					<FaFolderOpen size={12} />
				</button>

				{/* Language selector */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							title="Language"
							className="flex items-center justify-center rounded-lg w-8 h-8 text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors cursor-pointer"
						>
							<Languages size={13} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="end"
						className={`min-w-[90px] ${DROPDOWN_CLASSES}`}
					>
						{SUPPORTED_LOCALES.map((code) => (
							<DropdownMenuItem
								key={code}
								onSelect={() => setLocale(code as AppLocale)}
								className={`text-xs cursor-pointer ${
									locale === code ? "text-white font-medium" : "text-white/50"
								}`}
							>
								{LOCALE_LABELS[code] ?? code}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<button
					type="button"
					onClick={onHide}
					title={t("recording.hideHud")}
					className="flex items-center justify-center rounded-lg w-8 h-8 text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors cursor-pointer"
				>
					<FiMinus size={14} />
				</button>
			</div>

			<div className="h-4 w-px bg-white/[0.06] mx-0.5" />

			{/* Settings gear */}
			<SettingsDropdown
				hudSettings={hudSettings}
				platform={platform}
				recording={recording}
				countdownDelay={countdownDelay}
				setCountdownDelay={setCountdownDelay}
				onUpdateSettings={onUpdateSettings}
			/>
		</div>
	);
}
