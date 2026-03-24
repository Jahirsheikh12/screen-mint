import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { useScopedT } from "@/contexts/I18nContext";
import type { AfterRecordingAction, HudMode } from "@/hooks/useHudState";
import { useHudState } from "@/hooks/useHudState";
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
import { HudToolbar } from "./HudToolbar";
import styles from "./LaunchWindow.module.css";
import { DeviceTab } from "./tabs/DeviceTab";
import { DisplayTab } from "./tabs/DisplayTab";
import { WindowTab } from "./tabs/WindowTab";

const DROPDOWN_CLASSES =
	"border-white/[0.08] bg-[rgba(28,28,30,0.97)] text-white/90 backdrop-blur-2xl shadow-xl shadow-black/40";

export function LaunchWindow() {
	const hud = useHudState();
	const t = useScopedT("launch");

	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const pausedAtRef = useRef<number | null>(null);
	const totalPausedRef = useRef(0);
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);

	// Sync mic device id
	useEffect(() => {
		if (hud.selectedMicDeviceId && hud.selectedMicDeviceId !== "default") {
			hud.setMicrophoneDeviceId(hud.selectedMicDeviceId);
		}
	}, [hud.selectedMicDeviceId, hud.setMicrophoneDeviceId]);

	// Auto-open display overlay on launch
	const hasAutoOpened = useRef(false);
	useEffect(() => {
		if (hasAutoOpened.current) return;
		hasAutoOpened.current = true;
		hud.setMode("display");
		hud.resizeHudWindow(true);
	}, [hud.setMode, hud.resizeHudWindow]);

	// Track pause transitions to accumulate paused duration
	useEffect(() => {
		if (!hud.recording) return;
		if (hud.paused) {
			pausedAtRef.current = Date.now();
		} else if (pausedAtRef.current) {
			totalPausedRef.current += Date.now() - pausedAtRef.current;
			pausedAtRef.current = null;
		}
	}, [hud.paused, hud.recording]);

	// Elapsed timer — freezes while paused
	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (hud.recording) {
			if (!recordingStart) {
				setRecordingStart(Date.now());
				totalPausedRef.current = 0;
				pausedAtRef.current = null;
			}
			timer = setInterval(() => {
				if (recordingStart && !hud.paused) {
					const totalPaused =
						totalPausedRef.current + (pausedAtRef.current ? Date.now() - pausedAtRef.current : 0);
					setElapsed(Math.floor((Date.now() - recordingStart - totalPaused) / 1000));
				}
			}, 1000);
		} else {
			setRecordingStart(null);
			setElapsed(0);
			totalPausedRef.current = 0;
			pausedAtRef.current = null;
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [hud.recording, hud.paused, recordingStart]);

	// Camera preview stream
	useEffect(() => {
		const preview = cameraPreviewRef.current;
		if (!preview) return;

		preview.srcObject = hud.cameraPreviewStream;
		if (hud.cameraPreviewStream) {
			void preview.play().catch(() => {
				// Autoplay can fail briefly while the stream is attaching.
			});
		}

		return () => {
			if (preview.srcObject === hud.cameraPreviewStream) {
				preview.srcObject = null;
			}
		};
	}, [hud.cameraPreviewStream]);

	// Auto-hide overlay when recording starts
	useEffect(() => {
		if (hud.recording) {
			hud.resizeHudWindow(false);
		}
	}, [hud.recording, hud.resizeHudWindow]);

	useEffect(() => {
		if (
			hud.hudSettings.highlightArea &&
			hud.recording &&
			!hud.paused &&
			hud.sessionState.captureMode === "area" &&
			hud.selectedArea
		) {
			void window.electronAPI.createHighlightOverlay(hud.selectedArea.bounds);
			return;
		}

		void window.electronAPI.closeHighlightOverlay();
	}, [
		hud.hudSettings.highlightArea,
		hud.paused,
		hud.recording,
		hud.selectedArea,
		hud.sessionState.captureMode,
	]);

	const openVideoFile = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled) return;

		if (result.success && result.path) {
			hud.setCameraDeviceId(undefined);
			await window.electronAPI.clearCurrentWebcamPath();
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	}, [hud.setCameraDeviceId]);

	const openProjectFile = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) return;
		hud.setCameraDeviceId(undefined);
		await window.electronAPI.clearCurrentWebcamPath();
		await window.electronAPI.switchToEditor();
	}, [hud.setCameraDeviceId]);

	const sendHudOverlayHide = useCallback(() => {
		window.electronAPI?.hudOverlayHide?.();
	}, []);

	const sendHudOverlayClose = useCallback(() => {
		window.electronAPI?.hudOverlayClose?.();
	}, []);

	const handleSelectSource = useCallback(
		(source: { id: string; name: string; display_id: string }) => {
			void window.electronAPI.selectSource(source);
		},
		[],
	);

	const handleDismissOverlay = useCallback(() => {
		hud.resizeHudWindow(false);
	}, [hud.resizeHudWindow]);

	const handleTabClick = useCallback(
		(tab: HudMode) => {
			if (hud.recording) return;

			if (tab === "area") {
				void (async () => {
					hud.setMode(tab);
					hud.resizeHudWindow(false);
					try {
						let selectedSource = await window.electronAPI.getSelectedSource();
						if (!selectedSource?.id?.startsWith("screen:")) {
							const sources = await window.electronAPI.getSources({
								types: ["screen"],
							});
							if (sources.length === 0) {
								return;
							}
							selectedSource = sources[0];
							await window.electronAPI.selectSource(selectedSource);
						}

						const displayId = Number(selectedSource.display_id);
						await window.electronAPI.createAreaOverlay(
							Number.isFinite(displayId) ? displayId : undefined,
						);
					} catch {
						// ignore source fetch errors
					}
				})();
				return;
			}

			if (hud.mode === tab && hud.contentPanelVisible) {
				hud.resizeHudWindow(false);
			} else {
				hud.setMode(tab);
				hud.resizeHudWindow(true);
			}
		},
		[hud.mode, hud.recording, hud.contentPanelVisible, hud.setMode, hud.resizeHudWindow],
	);

	const showOverlay = hud.contentPanelVisible && !hud.recording;
	const isRecordDisabled =
		hud.countdownActive ||
		hud.recordingBusy ||
		!hud.hasSelectedSource ||
		(hud.mode === "area" && !hud.hasSelectedArea);

	return (
		<div className="fixed inset-0">
			{/* Fullscreen overlay backdrop */}
			{showOverlay && (
				<div
					className={`absolute inset-0 flex items-center justify-center ${styles.backdropFade}`}
					style={{
						background:
							"radial-gradient(ellipse at center bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.65) 100%)",
						paddingBottom: "100px",
					}}
					onClick={handleDismissOverlay}
					onKeyDown={undefined}
				>
					{/* Overlay content card */}
					<div
						className={`rounded-2xl border w-full mx-8 ${styles.overlayEnter} ${styles.electronNoDrag}`}
						style={{
							maxWidth: hud.mode === "window" ? "800px" : "680px",
							background:
								"linear-gradient(180deg, rgba(30,30,32,0.94) 0%, rgba(22,22,24,0.96) 100%)",
							borderColor: "rgba(255,255,255,0.07)",
							boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.05)",
							backdropFilter: "blur(40px) saturate(160%)",
							WebkitBackdropFilter: "blur(40px) saturate(160%)",
						}}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={undefined}
					>
						{/* Tab content */}
						{hud.mode === "display" && (
							<DisplayTab disabled={hud.recording} onSelectSource={handleSelectSource} />
						)}
						{hud.mode === "window" && (
							<WindowTab
								disabled={hud.recording}
								onSelectSource={handleSelectSource}
								onFallbackToDisplay={() => {
									hud.setMode("display");
								}}
							/>
						)}
						{hud.mode === "device" && <DeviceTab />}

						{/* Divider */}
						{hud.mode !== "device" && <div className="mx-6 h-px bg-white/[0.05]" />}

						{/* Record button — unified pill with inline dropdown trigger */}
						<div className="flex justify-center py-5 px-6">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										disabled={isRecordDisabled}
										className={`flex items-center gap-2.5 rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all ${
											isRecordDisabled
												? "bg-red-500/15 text-white/30 cursor-not-allowed"
												: "bg-red-500 text-white hover:bg-red-600 cursor-pointer shadow-lg shadow-red-500/20"
										}`}
									>
										<BsRecordCircle size={13} />
										<span>{t("recording.startRecording")}</span>
										<div
											className={`h-4 w-px ml-1 ${isRecordDisabled ? "bg-white/[0.08]" : "bg-white/25"}`}
										/>
										<ChevronDown size={13} className={isRecordDisabled ? "" : "text-white/70"} />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									side="top"
									align="center"
									className={`min-w-[240px] ${DROPDOWN_CLASSES}`}
								>
									{/* Start recording action at top */}
									<DropdownMenuItem
										disabled={isRecordDisabled}
										onSelect={() => hud.toggleRecording()}
										className="text-xs font-semibold"
									>
										<BsRecordCircle size={12} className="mr-2 text-red-400" />
										{t("recording.startRecording")}
									</DropdownMenuItem>
									<DropdownMenuSeparator className="bg-white/[0.08]" />
									<DropdownMenuRadioGroup
										value={hud.hudSettings.afterRecordingAction}
										onValueChange={(value) =>
											hud.updateHudSettings({
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
									<DropdownMenuSeparator className="bg-white/[0.08]" />
									<DropdownMenuCheckboxItem
										checked={hud.hudSettings.autoCreateZooms}
										onCheckedChange={(checked) =>
											hud.updateHudSettings({
												autoCreateZooms: Boolean(checked),
											})
										}
										className="text-xs"
									>
										{t("afterRecording.autoCreateZooms")}
									</DropdownMenuCheckboxItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			)}

			{/* Camera preview — floating above toolbar */}
			{hud.cameraSession.enabled && hud.cameraSession.previewVisible && hud.cameraPreviewStream && (
				<div className="fixed bottom-[76px] left-1/2 -translate-x-1/2 mb-3 z-10">
					<div
						className={styles.electronNoDrag}
						style={{
							borderRadius: 16,
							border: "1px solid rgba(255,255,255,0.08)",
							background: "rgba(18,18,20,0.9)",
							padding: 6,
							boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
							backdropFilter: "blur(20px)",
							WebkitBackdropFilter: "blur(20px)",
						}}
					>
						<div className="relative h-[84px] w-[140px] overflow-hidden rounded-[12px] bg-black">
							<video
								ref={cameraPreviewRef}
								autoPlay
								playsInline
								muted
								className="h-full w-full object-cover"
								style={{
									transform: hud.cameraSession.previewMirrored ? "scaleX(-1)" : undefined,
								}}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Bottom toolbar */}
			<div
				className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-full transition-all duration-300 ${
					hud.recording ? "max-w-[520px] px-2" : "max-w-[720px] px-4"
				}`}
			>
				<div
					className={`${styles.hudBar} ${hud.recording ? styles.recordingGlow : ""}`}
					style={{
						borderRadius: 14,
						background: hud.recording
							? "linear-gradient(180deg, rgba(30,18,18,0.88) 0%, rgba(22,16,16,0.92) 100%)"
							: "linear-gradient(180deg, rgba(28,28,30,0.82) 0%, rgba(20,20,22,0.88) 100%)",
						backdropFilter: "blur(40px) saturate(180%)",
						WebkitBackdropFilter: "blur(40px) saturate(180%)",
						border: hud.recording
							? "1px solid rgba(239,68,68,0.12)"
							: "1px solid rgba(255,255,255,0.07)",
						boxShadow: hud.recording
							? undefined
							: "0 8px 40px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.04)",
					}}
				>
					<HudToolbar
						mode={hud.mode}
						onTabClick={handleTabClick}
						recording={hud.recording}
						paused={hud.paused}
						elapsed={elapsed}
						onToggleRecording={hud.toggleRecording}
						onTogglePause={hud.togglePause}
						onRetakeRecording={hud.retakeRecording}
						onDeleteRecording={hud.deleteRecording}
						microphoneEnabled={hud.microphoneEnabled}
						setMicrophoneEnabled={hud.setMicrophoneEnabled}
						microphoneDeviceId={hud.microphoneDeviceId}
						setMicrophoneDeviceId={hud.setMicrophoneDeviceId}
						systemAudioEnabled={hud.systemAudioEnabled}
						setSystemAudioEnabled={hud.setSystemAudioEnabled}
						webcamEnabled={hud.webcamEnabled}
						cameraSession={hud.cameraSession}
						setCameraDeviceId={hud.setCameraDeviceId}
						setCameraPreviewVisible={hud.setCameraPreviewVisible}
						setCameraPreviewMirrored={hud.setCameraPreviewMirrored}
						cameraDevices={hud.cameraDevices}
						showMicControls={hud.showMicControls}
						micDevices={hud.micDevices}
						selectedMicDeviceId={hud.selectedMicDeviceId}
						setSelectedMicDeviceId={hud.setSelectedMicDeviceId}
						audioLevel={hud.audioLevel}
						onOpenVideoFile={openVideoFile}
						onOpenProject={openProjectFile}
						onHide={sendHudOverlayHide}
						onClose={sendHudOverlayClose}
						hudSettings={hud.hudSettings}
						platform={hud.platform}
						countdownDelay={hud.countdownDelay}
						setCountdownDelay={hud.setCountdownDelay}
						onUpdateSettings={hud.updateHudSettings}
						actionBusy={hud.recordingBusy}
					/>
				</div>
			</div>
		</div>
	);
}
