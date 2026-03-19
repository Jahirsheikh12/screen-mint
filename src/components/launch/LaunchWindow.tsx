import { Eye, EyeOff, Languages, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";
import { MdMic, MdMicOff, MdMonitor, MdVideoFile, MdVolumeOff, MdVolumeUp } from "react-icons/md";
import { useI18n } from "@/contexts/I18nContext";
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { useScopedT } from "../../contexts/I18nContext";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { Button } from "../ui/button";
import { ContentClamp } from "../ui/content-clamp";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import styles from "./LaunchWindow.module.css";

export function LaunchWindow() {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");

	const LOCALE_LABELS: Record<string, string> = { en: "EN", es: "ES", "zh-CN": "中文" };
	const {
		recording,
		countdownActive,
		toggleRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		countdownDelay,
		setCountdownDelay,
	} = useScreenRecorder();
	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const showMicControls = microphoneEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } =
		useMicrophoneDevices(microphoneEnabled);
	const { level } = useAudioLevelMeter({
		enabled: showMicControls,
		deviceId: microphoneDeviceId,
	});

	useEffect(() => {
		if (selectedDeviceId && selectedDeviceId !== "default") {
			setMicrophoneDeviceId(selectedDeviceId);
		}
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) setRecordingStart(Date.now());
			timer = setInterval(() => {
				if (recordingStart) {
					setElapsed(Math.floor((Date.now() - recordingStart) / 1000));
				}
			}, 1000);
		} else {
			setRecordingStart(null);
			setElapsed(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	const [selectedSource, setSelectedSource] = useState("Screen");
	const [hasSelectedSource, setHasSelectedSource] = useState(false);
	const [recordingsDirectory, setRecordingsDirectory] = useState<string | null>(null);
	const [hideHudFromCapture, setHideHudFromCapture] = useState(true);
	const [platform, setPlatform] = useState<string | null>(null);

	useEffect(() => {
		const checkSelectedSource = async () => {
			if (window.electronAPI) {
				const source = await window.electronAPI.getSelectedSource();
				if (source) {
					setSelectedSource(source.name);
					setHasSelectedSource(true);
				} else {
					setSelectedSource("Screen");
					setHasSelectedSource(false);
				}
			}
		};

		void checkSelectedSource();
		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadPlatform = async () => {
			try {
				const nextPlatform = await window.electronAPI.getPlatform();
				if (!cancelled) {
					setPlatform(nextPlatform);
				}
			} catch (error) {
				console.error("Failed to load platform:", error);
			}
		};

		void loadPlatform();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadHudCaptureProtection = async () => {
			try {
				const result = await window.electronAPI.getHudOverlayCaptureProtection();
				if (!cancelled && result.success) {
					setHideHudFromCapture(result.enabled);
				}
			} catch (error) {
				console.error("Failed to load HUD capture protection state:", error);
			}
		};

		void loadHudCaptureProtection();

		return () => {
			cancelled = true;
		};
	}, []);

	const openSourceSelector = () => {
		window.electronAPI?.openSourceSelector();
	};

	const openVideoFile = async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled) {
			return;
		}

		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	};

	const openProjectFile = async () => {
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) {
			return;
		}
		await window.electronAPI.switchToEditor();
	};

	const sendHudOverlayHide = () => {
		window.electronAPI?.hudOverlayHide?.();
	};

	const sendHudOverlayClose = () => {
		window.electronAPI?.hudOverlayClose?.();
	};

	const toggleHudCaptureProtection = async () => {
		const nextValue = !hideHudFromCapture;

		setHideHudFromCapture(nextValue);

		try {
			const result = await window.electronAPI.setHudOverlayCaptureProtection(nextValue);

			if (!result.success) {
				setHideHudFromCapture(!nextValue);
				return;
			}

			setHideHudFromCapture(result.enabled);
		} catch (error) {
			console.error("Failed to update HUD capture protection:", error);
			setHideHudFromCapture(!nextValue);
		}
	};

	const chooseRecordingsDirectory = async () => {
		const result = await window.electronAPI.chooseRecordingsDirectory();
		if (result.canceled) {
			return;
		}
		if (result.success && result.path) {
			setRecordingsDirectory(result.path);
		}
	};

	useEffect(() => {
		const loadRecordingsDirectory = async () => {
			const result = await window.electronAPI.getRecordingsDirectory();
			if (result.success) {
				setRecordingsDirectory(result.path);
			}
		};

		void loadRecordingsDirectory();
	}, []);

	const recordingsDirectoryName = recordingsDirectory
		? recordingsDirectory.split(/[\\/]/).filter(Boolean).pop() || recordingsDirectory
		: "recordings";
	const dividerClass = "mx-1 h-5 w-px shrink-0 bg-white/10";
	const supportsHudCaptureProtection = platform !== "linux";

	const toggleMicrophone = () => {
		if (!recording) {
			setMicrophoneEnabled(!microphoneEnabled);
		}
	};

	return (
		<div className="flex h-full w-full items-end justify-center bg-transparent px-3 pb-3 pt-2 overflow-hidden">
			<div className="flex flex-col items-center gap-2 mx-auto overflow-visible">
				{showMicControls && (
					<div
						className={`flex items-center gap-2 rounded-2xl border border-[rgba(16,185,129,0.12)] bg-[rgba(10,15,13,0.94)] px-3 py-2 shadow-xl backdrop-blur-xl ${styles.electronNoDrag}`}
					>
						<select
							value={microphoneDeviceId || selectedDeviceId}
							onChange={(event) => {
								setSelectedDeviceId(event.target.value);
								setMicrophoneDeviceId(event.target.value);
							}}
							className={`max-w-[230px] rounded-lg border border-[rgba(16,185,129,0.12)] bg-[#111C18] px-3 py-1 text-xs text-slate-100 outline-none ${styles.micSelect}`}
						>
							{devices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
						<AudioLevelMeter level={level} className="w-24" />
					</div>
				)}

				{/* Main HUD bar — entire bar is draggable, interactive elements opt out */}
				<div
					className={styles.hudBar}
					style={{
						borderRadius: 20,
						background: "linear-gradient(135deg, rgba(17,28,24,0.97) 0%, rgba(10,15,13,0.96) 100%)",
						backdropFilter: "blur(20px) saturate(140%)",
						WebkitBackdropFilter: "blur(20px) saturate(140%)",
						border: "1px solid rgba(16,185,129,0.12)",
						boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(16,185,129,0.08)",
						minHeight: 48,
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						padding: "8px 14px",
						maxWidth: "100%",
					}}
				>
					{/* Source selector */}
					<Button
						variant="link"
						size="sm"
						className={`gap-1.5 text-white/80 bg-transparent hover:bg-transparent px-0 text-xs ${styles.electronNoDrag}`}
						onClick={openSourceSelector}
						disabled={recording}
						title={selectedSource}
					>
						<MdMonitor size={14} className="text-white/60" />
						<ContentClamp truncateLength={6}>{selectedSource}</ContentClamp>
					</Button>

					<div className={dividerClass} />

					{/* Audio controls */}
					<div className={`flex items-center gap-0.5 ${styles.electronNoDrag}`}>
						{supportsHudCaptureProtection && (
							<Button
								variant="link"
								size="icon"
								onClick={() => void toggleHudCaptureProtection()}
								title={
									hideHudFromCapture
										? t("recording.showHudInVideo")
										: t("recording.hideHudFromVideo")
								}
								className="text-white/80 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors"
							>
								{hideHudFromCapture ? (
									<EyeOff size={15} className="text-white/35" />
								) : (
									<Eye size={15} className="text-[#10B981]" />
								)}
							</Button>
						)}
						<Button
							variant="link"
							size="icon"
							onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
							disabled={recording}
							title={
								systemAudioEnabled
									? t("recording.disableSystemAudio")
									: t("recording.enableSystemAudio")
							}
							className="text-white/80 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors"
						>
							{systemAudioEnabled ? (
								<MdVolumeUp size={15} className="text-[#10B981]" />
							) : (
								<MdVolumeOff size={15} className="text-white/35" />
							)}
						</Button>
						<Button
							variant="link"
							size="icon"
							onClick={toggleMicrophone}
							disabled={recording}
							title={
								microphoneEnabled
									? t("recording.disableMicrophone")
									: t("recording.enableMicrophone")
							}
							className="text-white/80 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors"
						>
							{microphoneEnabled ? (
								<MdMic size={15} className="text-[#10B981]" />
							) : (
								<MdMicOff size={15} className="text-white/35" />
							)}
						</Button>
					</div>

					<div className={dividerClass} />

					{/* Countdown delay */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="link"
								size="sm"
								disabled={recording || countdownActive}
								title={t("recording.countdownDelay")}
								className={`gap-1 px-1.5 text-xs text-white/70 hover:bg-white/5 rounded-lg ${styles.electronNoDrag}`}
							>
								<Timer size={14} />
								<span>{countdownDelay > 0 ? `${countdownDelay}s` : t("recording.noDelay")}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							side="top"
							align="center"
							className="min-w-[80px] max-h-none overflow-visible border-white/10 bg-[rgba(17,28,24,0.97)] text-white/90 backdrop-blur-xl"
						>
							{[0, 3, 5, 10].map((delay) => (
								<DropdownMenuItem
									key={delay}
									onSelect={() => setCountdownDelay(delay)}
									className={`cursor-pointer text-xs ${
										countdownDelay === delay ? "font-medium text-white" : "text-white/60"
									}`}
								>
									{delay === 0 ? t("recording.noDelay") : `${delay}s`}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Record button */}
					<Button
						variant="link"
						size="sm"
						onClick={hasSelectedSource ? toggleRecording : openSourceSelector}
						disabled={countdownActive || (!hasSelectedSource && !recording)}
						className={`gap-1.5 text-white bg-transparent hover:bg-white/5 rounded-lg px-2 text-xs ${styles.electronNoDrag}`}
					>
						{recording ? (
							<>
								<FaRegStopCircle size={14} className="text-red-400" />
								<span className="text-red-400 font-medium tabular-nums">{formatTime(elapsed)}</span>
							</>
						) : (
							<>
								<BsRecordCircle
									size={14}
									className={hasSelectedSource ? "text-white/85" : "text-white/35"}
								/>
								<span className={hasSelectedSource ? "text-white/80" : "text-white/35"}>
									{t("recording.record")}
								</span>
							</>
						)}
					</Button>

					{/* Folder path */}
					<Button
						variant="link"
						size="sm"
						onClick={chooseRecordingsDirectory}
						disabled={recording}
						title={
							recordingsDirectory
								? t("recording.recordingFolder", undefined, { path: recordingsDirectory })
								: t("recording.chooseRecordingsFolder")
						}
						className={`text-white/50 hover:text-white/70 hover:bg-transparent px-1 text-[11px] underline decoration-white/30 underline-offset-2 ${styles.electronNoDrag}`}
					>
						<ContentClamp truncateLength={18}>
							{t("recording.folderPath", undefined, { name: recordingsDirectoryName })}
						</ContentClamp>
					</Button>

					<div className="ml-auto flex items-center gap-0.5">
						<div className={dividerClass} />
						<Button
							variant="link"
							size="icon"
							onClick={openVideoFile}
							disabled={recording}
							title={t("recording.openVideoFile")}
							className={`text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors ${styles.electronNoDrag}`}
						>
							<MdVideoFile size={15} />
						</Button>
						<Button
							variant="link"
							size="icon"
							onClick={openProjectFile}
							disabled={recording}
							title={t("recording.openProject")}
							className={`text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors ${styles.electronNoDrag}`}
						>
							<FaFolderOpen size={14} />
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="link"
									size="icon"
									title="Language"
									className={`text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors ${styles.electronNoDrag}`}
								>
									<Languages size={14} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								align="end"
								className="min-w-[90px] bg-[rgba(17,28,24,0.97)] border-white/10 text-white/90 backdrop-blur-xl"
							>
								{SUPPORTED_LOCALES.map((code) => (
									<DropdownMenuItem
										key={code}
										onSelect={() => setLocale(code as AppLocale)}
										className={`text-xs cursor-pointer ${
											locale === code ? "text-white font-medium" : "text-white/60"
										}`}
									>
										{LOCALE_LABELS[code] ?? code}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						<div className={dividerClass} />
						<Button
							variant="link"
							size="icon"
							onClick={sendHudOverlayHide}
							title={t("recording.hideHud")}
							className={`text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors ${styles.electronNoDrag}`}
						>
							<FiMinus size={15} />
						</Button>
						<Button
							variant="link"
							size="icon"
							onClick={sendHudOverlayClose}
							title={t("recording.closeApp")}
							className={`text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg h-8 w-8 transition-colors ${styles.electronNoDrag}`}
						>
							<FiX size={15} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
