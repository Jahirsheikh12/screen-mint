import { Camera, Languages, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { FaPause, FaPlay, FaRegStopCircle } from "react-icons/fa";
// import { FaFolderOpen } from "react-icons/fa6"; // re-enable when file options are restored
import { FiMinus, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";
import {
	MdCropFree,
	MdDevices,
	MdMic,
	MdMicOff,
	MdMonitor,
	MdVideocam,
	MdVideocamOff,
	// MdVideoFile, // re-enable when file options are restored
	MdVolumeOff,
	MdVolumeUp,
	MdWindow,
} from "react-icons/md";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import type { MobileCapturePairingState } from "@/electron-ipc/contracts";
import type { CameraDeviceOption, HudMode, HudSettings } from "@/hooks/useHudState";
import type { AppLocale } from "@/i18n/config";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/i18n/config";
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
import { Tooltip, useTooltip } from "../ui/tooltip";
import { notifyHudDropdownToggle } from "./hudDropdownExpansion";
import styles from "./LaunchWindow.module.css";
import { SettingsDropdown } from "./SettingsDropdown";

type HudToolbarProps = {
	mode: HudMode;
	contentPanelVisible: boolean;
	onTabClick: (mode: HudMode) => void;
	recording: boolean;
	/** What the active tab will record, shown as the tab's tooltip. */
	sourceLabel?: string;
	paused: boolean;
	elapsed: number;
	onToggleRecording: () => void;
	onTogglePause: () => void;
	onRetakeRecording: () => void;
	onDeleteRecording: () => void;
	microphoneEnabled: boolean;
	setMicrophoneEnabled: (enabled: boolean) => void;
	microphoneDeviceId: string | undefined;
	setMicrophoneDeviceId: (deviceId: string | undefined) => void;
	systemAudioEnabled: boolean;
	setSystemAudioEnabled: (enabled: boolean) => void;
	webcamEnabled: boolean;
	setWebcamEnabled: (enabled: boolean) => void;
	cameraSession: {
		enabled: boolean;
		sourceType?: "local-device" | "mobile";
		deviceId?: string;
		previewVisible: boolean;
		previewMirrored: boolean;
		previewSize: "small" | "medium" | "large";
		previewCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
		previewShape: "rounded-rect" | "circle";
	};
	setCameraDeviceId: (deviceId?: string) => void;
	setMobileCameraEnabled: (enabled: boolean) => void;
	setCameraPreviewVisible: (visible: boolean) => void;
	setCameraPreviewMirrored: (mirrored: boolean) => void;
	setCameraPreviewSize: (size: "small" | "medium" | "large") => void;
	setCameraPreviewCorner: (
		corner: "top-left" | "top-right" | "bottom-left" | "bottom-right",
	) => void;
	setCameraPreviewShape: (shape: "rounded-rect" | "circle") => void;
	cameraDevices: CameraDeviceOption[];
	mobileCaptureState: MobileCapturePairingState;
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
	actionBusy: boolean;
	showQuickRecord: boolean;
	quickRecordDisabled: boolean;
	onQuickRecord: () => void;
	screenshotDisabled: boolean;
	screenshotBusy: boolean;
	onCaptureScreenshot: () => void;
	showScreenshot?: boolean;
};

const MODE_ICONS: Record<HudMode, React.ComponentType<{ size?: number; className?: string }>> = {
	display: MdMonitor,
	window: MdWindow,
	area: MdCropFree,
	device: MdDevices,
};

const DROPDOWN_CLASSES =
	"border border-line-strong bg-raised text-fg shadow-none data-[state=open]:!animate-none data-[state=closed]:!animate-none";
const DEFAULT_CAMERA_VALUE = "__default_camera__";

const ND = styles.electronNoDrag;

export function HudToolbar({
	mode,
	contentPanelVisible,
	onTabClick,
	recording,
	sourceLabel,
	paused,
	elapsed,
	onToggleRecording,
	onTogglePause,
	onRetakeRecording,
	onDeleteRecording,
	microphoneEnabled,
	setMicrophoneEnabled,
	microphoneDeviceId,
	setMicrophoneDeviceId,
	systemAudioEnabled,
	setSystemAudioEnabled,
	webcamEnabled,
	setWebcamEnabled,
	cameraSession,
	setCameraDeviceId,
	setMobileCameraEnabled,
	setCameraPreviewVisible,
	setCameraPreviewMirrored,
	setCameraPreviewSize,
	setCameraPreviewCorner,
	setCameraPreviewShape,
	cameraDevices,
	mobileCaptureState,
	showMicControls,
	micDevices,
	selectedMicDeviceId,
	setSelectedMicDeviceId,
	audioLevel,
	// onOpenVideoFile, // re-enable when file options are restored
	// onOpenProject, // re-enable when file options are restored
	onHide,
	onClose,
	hudSettings,
	platform,
	countdownDelay,
	setCountdownDelay,
	onUpdateSettings,
	actionBusy,
	showQuickRecord,
	quickRecordDisabled,
	onQuickRecord,
	screenshotDisabled,
	screenshotBusy,
	onCaptureScreenshot,
	showScreenshot = false,
}: HudToolbarProps) {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");

	// Tooltips for dropdown triggers — Radix `asChild` forbids wrapping, so use the hook form.
	const cameraTooltip = useTooltip({
		content:
			cameraSession.sourceType === "mobile"
				? t("recording.mobileCamera")
				: webcamEnabled
					? t("recording.disableWebcam")
					: t("recording.selectCamera"),
		side: "top",
	});
	const micTooltip = useTooltip({
		content: microphoneEnabled ? t("recording.disableMicrophone") : t("recording.enableMicrophone"),
		side: "top",
	});
	const mobileQrDataUrl = mobileCaptureState.qrSvg
		? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mobileCaptureState.qrSvg)}`
		: null;
	const mobileConnected =
		cameraSession.sourceType === "mobile" && mobileCaptureState.status === "connected";
	const languageTooltip = useTooltip({
		content: t("recording.language"),
		side: "top",
	});

	// Latch the compact recording bar while a stop is in flight: `recording` can
	// flip to false before the HUD window actually fades out, which would
	// otherwise flash the idle toolbar for a frame. Stay compact until the
	// finalize work (`actionBusy`) clears.
	const [showCompact, setShowCompact] = useState(recording);

	// Space pauses or resumes while the HUD has focus, as its tooltip says.
	useEffect(() => {
		if (!recording) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== "Space" || event.repeat) return;
			const target = event.target as HTMLElement | null;
			// Focused controls keep their own Space behaviour.
			if (target?.closest("button, input, textarea, select, [contenteditable=true]")) return;
			event.preventDefault();
			onTogglePause();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [recording, onTogglePause]);
	useEffect(() => {
		if (recording) {
			setShowCompact(true);
		} else if (!actionBusy) {
			setShowCompact(false);
		}
	}, [recording, actionBusy]);
	const finalizing = showCompact && !recording;

	const tabs: HudMode[] = ["display", "window", "area"];
	const cameraDropdownValue =
		cameraSession.sourceType === "mobile"
			? "__mobile__"
			: webcamEnabled
				? (cameraSession.deviceId ?? DEFAULT_CAMERA_VALUE)
				: "__off__";
	const cameraDeviceOptions = cameraDevices.filter((device) => device.deviceId);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	/* ── Recording state: compact bar (also latched during finalize) ── */
	if (showCompact) {
		const pauseLabel = paused ? t("recording.resumeRecording") : t("recording.pauseRecording");
		const compactBusy = actionBusy || finalizing;
		return (
			<div
				key="hud-recording"
				className={`${styles.hudToolbarEnter} flex flex-nowrap items-center gap-1.5 whitespace-nowrap px-2.5 py-[7px]`}
			>
				{/* Timer chip */}
				<div
					className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 transition-opacity duration-200 ${
						paused
							? "bg-accent/[0.08] border border-accent/[0.12]"
							: "bg-danger/[0.08] border border-danger/[0.1]"
					} ${compactBusy ? "opacity-60" : "opacity-100"}`}
				>
					<div
						className={`h-[7px] w-[7px] rounded-full ${paused ? "bg-accent" : "bg-danger"} ${paused || compactBusy ? "" : styles.recordingPulse}`}
					/>
					<span className="text-label font-mono font-semibold tabular-nums tracking-wide text-fg-muted">
						{formatTime(elapsed)}
					</span>
				</div>

				<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

				{/* Control buttons */}
				<div
					className={`${ND} flex shrink-0 items-center gap-1 transition-opacity duration-200 ${compactBusy ? "opacity-40 pointer-events-none" : "opacity-100"}`}
				>
					{/* Pause / Resume — icon-only to stay i18n-safe */}
					<Tooltip content={pauseLabel} side="top" shortcut="Space">
						<button
							type="button"
							onClick={onTogglePause}
							disabled={compactBusy}
							aria-label={pauseLabel}
							className={`flex items-center justify-center rounded-lg w-7 h-7 transition-all ${
								paused
									? "bg-accent/[0.1] text-accent-fg hover:bg-accent/[0.18]"
									: "bg-fill-subtle text-fg-subtle hover:bg-fill-hover hover:text-fg-muted"
							} ${compactBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
						>
							{paused ? <FaPlay size={10} /> : <FaPause size={10} />}
						</button>
					</Tooltip>

					{/* Retake */}
					<Tooltip content={t("recording.retakeRecording")} side="top">
						<button
							type="button"
							onClick={onRetakeRecording}
							disabled={compactBusy}
							aria-label={t("recording.retakeRecording")}
							className={`flex items-center justify-center rounded-lg w-7 h-7 text-fg-muted transition-all hover:bg-fill-hover hover:text-fg ${compactBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
						>
							<FiRotateCcw size={12} strokeWidth={2.75} />
						</button>
					</Tooltip>

					{/* Delete */}
					<Tooltip content={t("recording.deleteRecording")} side="top">
						<button
							type="button"
							onClick={onDeleteRecording}
							disabled={compactBusy}
							aria-label={t("recording.deleteRecording")}
							className={`flex items-center justify-center rounded-lg w-7 h-7 text-fg transition-all hover:bg-danger/[0.12] hover:text-danger-fg ${compactBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
						>
							<FiTrash2 size={12} strokeWidth={2.75} />
						</button>
					</Tooltip>
				</div>

				<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

				{/* Stop button — prominent (switches to "Finalising…" while busy) */}
				<button
					type="button"
					onClick={onToggleRecording}
					disabled={compactBusy}
					aria-label={t("recording.stopRecording")}
					className={`${ND} flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-caption font-semibold transition-all ${
						compactBusy
							? "cursor-not-allowed bg-fill-hover text-fg"
							: "cursor-pointer bg-danger/[0.12] text-danger-fg hover:bg-danger/[0.22] hover:text-danger-fg"
					}`}
				>
					{compactBusy ? (
						<span
							className="h-[10px] w-[10px] rounded-full border-[1.5px] border-line-strong border-t-fg animate-spin"
							aria-hidden="true"
						/>
					) : (
						<FaRegStopCircle size={10} />
					)}
					<span className="max-w-[120px] truncate">
						{compactBusy ? t("recording.finalizing") : t("recording.stopRecording")}
					</span>
				</button>

				{/* Minimize */}
				<Tooltip content={t("recording.hideHud")} side="top">
					<button
						type="button"
						onClick={onHide}
						aria-label={t("recording.hideHud")}
						className={`${ND} flex items-center justify-center rounded-lg w-7 h-7 text-fg-subtle transition-colors hover:bg-fill-hover hover:text-fg cursor-pointer ml-0.5`}
					>
						<FiMinus size={12} strokeWidth={3} />
					</button>
				</Tooltip>
			</div>
		);
	}

	/* ── Idle state: full toolbar ── */
	return (
		<div
			key="hud-idle"
			className={`${styles.hudToolbarEnter} whitespace-nowrap`}
			style={{
				display: "flex",
				flexWrap: "nowrap",
				alignItems: "center",
				gap: 6,
				padding: "6px 10px",
				minHeight: 48,
			}}
		>
			{/* Close button */}
			<Tooltip content={t("recording.closeApp")} side="top">
				<button
					type="button"
					onClick={onClose}
					aria-label={t("recording.closeApp")}
					className={`${ND} flex items-center justify-center rounded-lg p-2 text-fg-subtle hover:text-danger-fg hover:bg-fill-hover transition-colors cursor-pointer`}
				>
					<FiX size={14} strokeWidth={2.75} />
				</button>
			</Tooltip>

			<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

			{/* Segmented tab control */}
			<div className={`${ND} flex shrink-0 items-center rounded-[10px] bg-fill-subtle p-[3px]`}>
				{tabs.map((tab) => {
					const Icon = MODE_ICONS[tab];
					const isActive = mode === tab && contentPanelVisible;
					return (
						<button
							key={tab}
							type="button"
							onClick={() => onTabClick(tab)}
							disabled={recording}
							title={mode === tab ? sourceLabel : undefined}
							className={`flex shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 py-[6px] text-caption font-medium transition-all ${
								isActive ? "bg-fill-hover text-fg" : "text-fg-muted hover:text-fg"
							} cursor-pointer`}
						>
							<Icon size={13} className="shrink-0" />
							<span className="max-w-[88px] truncate">{t(`tabs.${tab}`)}</span>
						</button>
					);
				})}
			</div>

			<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

			{showQuickRecord && (
				<>
					<button
						type="button"
						onClick={onQuickRecord}
						disabled={quickRecordDisabled}
						title={t("recording.startRecording")}
						className={`${ND} flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-caption font-semibold transition-all ${
							quickRecordDisabled
								? "cursor-not-allowed bg-danger/15 text-danger-fg"
								: "cursor-pointer bg-danger text-on-danger hover:bg-danger/90"
						}`}
					>
						<BsRecordCircle size={12} className="shrink-0" />
						<span className="max-w-[88px] truncate">{t("recording.record")}</span>
					</button>

					<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />
				</>
			)}

			{/* Media controls */}
			<div className={`${ND} flex shrink-0 items-center`}>
				{/* Camera dropdown */}
				<DropdownMenu onOpenChange={notifyHudDropdownToggle}>
					<DropdownMenuTrigger asChild>
						<button
							ref={cameraTooltip.triggerRef as React.Ref<HTMLButtonElement>}
							type="button"
							onMouseEnter={cameraTooltip.onMouseEnter}
							onMouseLeave={cameraTooltip.onMouseLeave}
							aria-label={t("recording.selectCamera")}
							className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
								webcamEnabled
									? "text-fg bg-fill-hover"
									: "text-fg-muted hover:text-fg hover:bg-fill-hover"
							}`}
						>
							{webcamEnabled ? <MdVideocam size={15} /> : <MdVideocamOff size={15} />}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="center"
						className={`min-w-[220px] ${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}
					>
						<DropdownMenuLabel className="text-caption text-fg-subtle font-medium">
							{t("recording.selectCamera")}
						</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={cameraDropdownValue}
							onValueChange={(value) => {
								if (value === "__mobile__") {
									setMobileCameraEnabled(true);
									return;
								}
								if (value === "__off__") {
									setCameraDeviceId(undefined);
									return;
								}
								if (value === DEFAULT_CAMERA_VALUE) {
									setWebcamEnabled(true);
									return;
								}
								setCameraDeviceId(value);
							}}
						>
							<DropdownMenuRadioItem value="__off__" className="text-label">
								{t("recording.cameraOff")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="__mobile__" className="text-label">
								<span className="inline-flex items-center gap-2">
									<Smartphone size={13} />
									{t("recording.mobileCamera")}
									{mobileConnected && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
								</span>
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value={DEFAULT_CAMERA_VALUE} className="text-label">
								{t("recording.defaultCamera")}
							</DropdownMenuRadioItem>
							{cameraDeviceOptions.map((device) => (
								<DropdownMenuRadioItem
									key={device.deviceId || DEFAULT_CAMERA_VALUE}
									value={device.deviceId || DEFAULT_CAMERA_VALUE}
									className="text-label"
								>
									{device.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
						{cameraDevices.length === 0 && (
							<DropdownMenuItem disabled className="text-label text-fg-disabled">
								{t("recording.noCameraFound")}
							</DropdownMenuItem>
						)}
						{cameraSession.sourceType === "mobile" && (
							<>
								<DropdownMenuSeparator className="bg-fill-hover" />
								<div className="px-2 py-2">
									<div className="flex items-center justify-between gap-3">
										<div className="min-w-0">
											<div className="text-label font-semibold text-fg">
												{t("recording.mobilePairingTitle")}
											</div>
											<div className="mt-0.5 truncate text-caption text-fg-subtle">
												{mobileCaptureState.status === "connected"
													? t("recording.mobileConnected")
													: mobileCaptureState.status === "phone-opened"
														? t("recording.mobilePhoneOpened")
														: mobileCaptureState.status === "error"
															? (mobileCaptureState.error ?? t("recording.mobilePairingError"))
															: t("recording.mobileWaiting")}
											</div>
										</div>
										<button
											type="button"
											className="rounded-md bg-fill-hover px-2 py-1 text-caption text-fg-muted hover:bg-fill-pressed"
											onClick={() => setMobileCameraEnabled(true)}
										>
											{t("recording.mobileReconnect")}
										</button>
									</div>
									{mobileQrDataUrl && (
										<div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] gap-2">
											<img
												src={mobileQrDataUrl}
												alt={t("recording.mobileQrAlt")}
												className="h-[72px] w-[72px] rounded-md bg-fixed-white p-1"
											/>
											<div className="min-w-0 text-caption leading-4 text-fg-subtle">
												<div>{t("recording.mobileScanHint")}</div>
												<div className="mt-1 truncate text-fg-subtle">
													{mobileCaptureState.pairingUrl}
												</div>
											</div>
										</div>
									)}
									<div className="mt-2 text-micro leading-3 text-fg-subtle">
										{t("recording.mobilePrivacyHint")}
									</div>
								</div>
							</>
						)}
						<DropdownMenuSeparator className="bg-fill-hover" />
						<DropdownMenuCheckboxItem
							checked={!cameraSession.previewVisible}
							onCheckedChange={(checked) => setCameraPreviewVisible(!checked)}
							disabled={!cameraSession.enabled}
							className="text-label"
						>
							{t("recording.hideCameraPreview")}
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={cameraSession.previewMirrored}
							onCheckedChange={(checked) => setCameraPreviewMirrored(Boolean(checked))}
							disabled={!cameraSession.enabled}
							className="text-label"
						>
							{t("recording.mirrorCameraPreview")}
						</DropdownMenuCheckboxItem>
						<DropdownMenuSeparator className="bg-fill-hover" />
						<DropdownMenuLabel className="text-caption font-medium text-fg-subtle">
							{t("recording.previewSize")}
						</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={cameraSession.previewSize}
							onValueChange={(value) => setCameraPreviewSize(value as "small" | "medium" | "large")}
						>
							<DropdownMenuRadioItem value="small" className="text-label">
								{t("recording.previewSmall")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="medium" className="text-label">
								{t("recording.previewMedium")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="large" className="text-label">
								{t("recording.previewLarge")}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator className="bg-fill-hover" />
						<DropdownMenuLabel className="text-caption font-medium text-fg-subtle">
							{t("recording.previewCorner")}
						</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={cameraSession.previewCorner}
							onValueChange={(value) =>
								setCameraPreviewCorner(
									value as "top-left" | "top-right" | "bottom-left" | "bottom-right",
								)
							}
						>
							<DropdownMenuRadioItem value="top-left" className="text-label">
								{t("recording.cornerTopLeft")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="top-right" className="text-label">
								{t("recording.cornerTopRight")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="bottom-left" className="text-label">
								{t("recording.cornerBottomLeft")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="bottom-right" className="text-label">
								{t("recording.cornerBottomRight")}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator className="bg-fill-hover" />
						<DropdownMenuLabel className="text-caption font-medium text-fg-subtle">
							{t("recording.previewShape")}
						</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={cameraSession.previewShape}
							onValueChange={(value) => setCameraPreviewShape(value as "rounded-rect" | "circle")}
						>
							<DropdownMenuRadioItem value="rounded-rect" className="text-label">
								{t("recording.shapeRoundedRect")}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="circle" className="text-label">
								{t("recording.shapeCircle")}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Microphone dropdown */}
				<DropdownMenu onOpenChange={notifyHudDropdownToggle}>
					<DropdownMenuTrigger asChild>
						<button
							ref={micTooltip.triggerRef as React.Ref<HTMLButtonElement>}
							type="button"
							onMouseEnter={micTooltip.onMouseEnter}
							onMouseLeave={micTooltip.onMouseLeave}
							aria-label={
								microphoneEnabled
									? t("recording.disableMicrophone")
									: t("recording.enableMicrophone")
							}
							className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
								microphoneEnabled
									? "text-fg bg-fill-hover"
									: "text-fg-muted hover:text-fg hover:bg-fill-hover"
							}`}
						>
							{microphoneEnabled ? <MdMic size={15} /> : <MdMicOff size={15} />}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="center"
						className={`min-w-[240px] ${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}
					>
						<DropdownMenuCheckboxItem
							checked={microphoneEnabled}
							onCheckedChange={(checked) => {
								if (!recording) setMicrophoneEnabled(Boolean(checked));
							}}
							className="text-label"
						>
							{t("recording.enableMicrophone")}
						</DropdownMenuCheckboxItem>
						<DropdownMenuSeparator className="bg-fill-hover" />
						<DropdownMenuLabel className="text-caption text-fg-subtle font-medium">
							{t("recording.microphone")}
						</DropdownMenuLabel>
						{micDevices.map((device) => (
							<DropdownMenuItem
								key={device.deviceId}
								onSelect={() => {
									setSelectedMicDeviceId(device.deviceId);
									setMicrophoneDeviceId(device.deviceId);
								}}
								className={`text-label cursor-pointer ${
									(microphoneDeviceId || selectedMicDeviceId) === device.deviceId
										? "text-fg font-medium"
										: "text-fg-subtle"
								}`}
							>
								{device.label}
							</DropdownMenuItem>
						))}
						{showMicControls && (
							<>
								<DropdownMenuSeparator className="bg-fill-hover" />
								<div className="px-2 py-1.5">
									<AudioLevelMeter level={audioLevel} className="w-full" />
								</div>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* System audio toggle */}
				<Tooltip
					content={
						systemAudioEnabled
							? t("recording.disableSystemAudio")
							: t("recording.enableSystemAudio")
					}
					side="top"
				>
					<button
						type="button"
						onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
						aria-label={
							systemAudioEnabled
								? t("recording.disableSystemAudio")
								: t("recording.enableSystemAudio")
						}
						className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors cursor-pointer ${
							systemAudioEnabled
								? "text-fg bg-fill-hover"
								: "text-fg-muted hover:text-fg hover:bg-fill-hover"
						}`}
					>
						{systemAudioEnabled ? <MdVolumeUp size={15} /> : <MdVolumeOff size={15} />}
					</button>
				</Tooltip>
			</div>

			<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

			{/* Right utilities */}
			<div className={`${ND} flex shrink-0 items-center`}>
				{showScreenshot ? (
					<Tooltip content={t("recording.captureScreenshot")} side="top">
						<button
							type="button"
							onClick={onCaptureScreenshot}
							disabled={screenshotDisabled || screenshotBusy}
							aria-label={t("recording.captureScreenshot")}
							className={`flex items-center justify-center rounded-lg w-8 h-8 transition-colors ${
								screenshotDisabled || screenshotBusy
									? "cursor-not-allowed text-fg-disabled"
									: "cursor-pointer text-fg-muted hover:text-fg hover:bg-fill-hover"
							}`}
						>
							{screenshotBusy ? (
								<span
									className="h-[13px] w-[13px] rounded-full border-[1.5px] border-line-strong border-t-fg animate-spin"
									aria-hidden="true"
								/>
							) : (
								<Camera size={14} strokeWidth={2.5} />
							)}
						</button>
					</Tooltip>
				) : null}

				{/* File options temporarily hidden — keep wired for future re-enable */}
				{/*
				<button
					type="button"
					onClick={onOpenVideoFile}
					title={t("recording.openVideoFile")}
					className="flex items-center justify-center rounded-lg w-8 h-8 text-fg-disabled hover:text-fg-subtle hover:bg-fill-subtle transition-colors cursor-pointer"
				>
					<MdVideoFile size={14} />
				</button>
				<button
					type="button"
					onClick={onOpenProject}
					title={t("recording.openProject")}
					className="flex items-center justify-center rounded-lg w-8 h-8 text-fg-disabled hover:text-fg-subtle hover:bg-fill-subtle transition-colors cursor-pointer"
				>
					<FaFolderOpen size={12} />
				</button>
				*/}

				{/* Language selector */}
				<DropdownMenu onOpenChange={notifyHudDropdownToggle}>
					<DropdownMenuTrigger asChild>
						<button
							ref={languageTooltip.triggerRef as React.Ref<HTMLButtonElement>}
							type="button"
							onMouseEnter={languageTooltip.onMouseEnter}
							onMouseLeave={languageTooltip.onMouseLeave}
							aria-label={t("recording.language")}
							className="flex items-center justify-center rounded-lg w-8 h-8 text-fg-subtle hover:text-fg hover:bg-fill-hover transition-colors cursor-pointer"
						>
							<Languages size={13} strokeWidth={2.5} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="end"
						className={`min-w-[90px] ${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}
					>
						{SUPPORTED_LOCALES.map((code) => (
							<DropdownMenuItem
								key={code}
								onSelect={() => setLocale(code as AppLocale)}
								className={`text-label cursor-pointer ${
									locale === code ? "text-fg font-medium" : "text-fg-subtle"
								}`}
							>
								{LOCALE_LABELS[code] ?? code}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<Tooltip content={t("recording.hideHud")} side="top">
					<button
						type="button"
						onClick={onHide}
						aria-label={t("recording.hideHud")}
						className="flex items-center justify-center rounded-lg w-8 h-8 text-fg-subtle hover:text-fg hover:bg-fill-hover transition-colors cursor-pointer"
					>
						<FiMinus size={14} strokeWidth={3} />
					</button>
				</Tooltip>
			</div>

			<div className="h-4 w-px bg-fill-hover mx-0.5 shrink-0" />

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
