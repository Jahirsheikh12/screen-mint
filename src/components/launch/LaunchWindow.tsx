import { ChevronDown } from "lucide-react";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { resolveHudWebcamPreviewLayout } from "@/components/video-editor/webcamRenderPlan";
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
import { subscribeHudDropdownOpen } from "./hudDropdownExpansion";
import styles from "./LaunchWindow.module.css";
import { AreaTab } from "./tabs/AreaTab";
import { DeviceTab } from "./tabs/DeviceTab";
import { DisplayTab } from "./tabs/DisplayTab";
import { WindowTab } from "./tabs/WindowTab";

const DROPDOWN_CLASSES =
	"border-white/10 bg-[#1c1c1e] text-white/90 shadow-none data-[state=open]:!animate-none data-[state=closed]:!animate-none";
const HUD_INTERACTIVE_SELECTOR = "[data-hud-interactive]";
const HUD_DRAG_BLOCK_SELECTOR =
	"button, a, input, select, textarea, [role='button'], [role='menuitem'], [data-hud-no-drag]";

function pointHitsHudInteractiveElement(clientX: number, clientY: number): boolean {
	return document
		.elementsFromPoint(clientX, clientY)
		.some((element) => element.closest(HUD_INTERACTIVE_SELECTOR));
}

function hasHoveredHudInteractiveElement(): boolean {
	return document.querySelector(`${HUD_INTERACTIVE_SELECTOR}:hover`) !== null;
}

function blocksHudDrag(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(HUD_DRAG_BLOCK_SELECTOR) !== null;
}

export function LaunchWindow() {
	const hud = useHudState();
	const t = useScopedT("launch");

	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [hudDropdownOpen, setHudDropdownOpen] = useState(false);
	const pausedAtRef = useRef<number | null>(null);
	const totalPausedRef = useRef(0);
	const compactHudRef = useRef<HTMLDivElement | null>(null);
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
	const lastSyncedLayoutRef = useRef<{ width: number; height: number } | null>(null);
	const mousePassthroughRef = useRef<boolean | null>(null);
	const hudDragPointerIdRef = useRef<number | null>(null);

	const setHudMousePassthrough = useCallback((enabled: boolean) => {
		if (mousePassthroughRef.current === enabled) {
			return;
		}

		mousePassthroughRef.current = enabled;
		void window.electronAPI?.setHudMousePassthrough?.(enabled);
	}, []);

	// Sync mic device id
	useEffect(() => {
		if (hud.selectedMicDeviceId && hud.selectedMicDeviceId !== "default") {
			hud.setMicrophoneDeviceId(hud.selectedMicDeviceId);
		}
	}, [hud.selectedMicDeviceId, hud.setMicrophoneDeviceId]);

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

	// Auto-hide overlay when recording or countdown starts
	useEffect(() => {
		if (hud.recording || hud.countdownActive) {
			hud.resizeHudWindow(false);
		}
	}, [hud.recording, hud.countdownActive, hud.resizeHudWindow]);

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

	const handlePermissionDenied = useCallback(() => {
		hud.resizeHudWindow(false);
	}, [hud.resizeHudWindow]);

	const endHudDrag = useCallback(
		(target?: Element | null, pointerId?: number) => {
			if (hudDragPointerIdRef.current === null) {
				return;
			}

			if (target && typeof pointerId === "number" && target.hasPointerCapture?.(pointerId)) {
				target.releasePointerCapture(pointerId);
			}

			hudDragPointerIdRef.current = null;
			window.electronAPI?.endHudDrag?.();
			setHudMousePassthrough(false);
		},
		[setHudMousePassthrough],
	);

	const handleHudDragPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0 || hud.contentPanelVisible || blocksHudDrag(event.target)) {
				return;
			}

			hudDragPointerIdRef.current = event.pointerId;
			event.currentTarget.setPointerCapture(event.pointerId);
			setHudMousePassthrough(false);
			window.electronAPI?.startHudDrag?.({
				screenX: event.screenX,
				screenY: event.screenY,
			});
		},
		[hud.contentPanelVisible, setHudMousePassthrough],
	);

	const handleHudDragPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (hudDragPointerIdRef.current !== event.pointerId) {
				return;
			}

			if ((event.buttons & 1) === 0) {
				endHudDrag(event.currentTarget, event.pointerId);
				return;
			}

			window.electronAPI?.moveHudDrag?.({
				screenX: event.screenX,
				screenY: event.screenY,
			});
		},
		[endHudDrag],
	);

	const handleHudDragPointerUp = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (hudDragPointerIdRef.current !== event.pointerId) {
				return;
			}

			endHudDrag(event.currentTarget, event.pointerId);
		},
		[endHudDrag],
	);

	const handleTabClick = useCallback(
		(tab: HudMode) => {
			if (hud.recording) return;

			if (hud.mode === tab && hud.contentPanelVisible) {
				hud.resizeHudWindow(false);
			} else {
				hud.setMode(tab);
				hud.resizeHudWindow(true);
			}
		},
		[hud.mode, hud.recording, hud.contentPanelVisible, hud.setMode, hud.resizeHudWindow],
	);

	const shouldShowOverlay = hud.contentPanelVisible && !hud.recording && !hud.countdownActive;
	// Immediately suppress overlay during recording/countdown — no useEffect delay
	const forceHideOverlay = hud.recording || hud.countdownActive;

	// Track overlay mount/unmount with exit animation (user-initiated dismiss only)
	const [overlayMounted, setOverlayMounted] = useState(false);
	const [overlayExiting, setOverlayExiting] = useState(false);
	const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (forceHideOverlay) {
			// Clean up animation state — visual hide is handled by showOverlay below
			if (exitTimeoutRef.current) {
				clearTimeout(exitTimeoutRef.current);
				exitTimeoutRef.current = null;
			}
			setOverlayMounted(false);
			setOverlayExiting(false);
			return;
		}

		if (shouldShowOverlay) {
			if (exitTimeoutRef.current) {
				clearTimeout(exitTimeoutRef.current);
				exitTimeoutRef.current = null;
			}
			setOverlayExiting(false);
			setOverlayMounted(true);
		} else if (overlayMounted) {
			setOverlayExiting(true);
			exitTimeoutRef.current = setTimeout(() => {
				setOverlayMounted(false);
				setOverlayExiting(false);
				exitTimeoutRef.current = null;
			}, 180);
		}
		return () => {
			if (exitTimeoutRef.current) {
				clearTimeout(exitTimeoutRef.current);
				exitTimeoutRef.current = null;
			}
		};
	}, [shouldShowOverlay, forceHideOverlay, overlayMounted]);

	// Key fix: forceHideOverlay bypasses overlayMounted — no 1-frame flicker
	const showOverlay = !forceHideOverlay && overlayMounted;
	const showAreaQuickRecord = !hud.recording && hud.mode === "area" && hud.hasSelectedArea;
	const isRecordDisabled =
		hud.countdownActive ||
		hud.recordingBusy ||
		!hud.hasSelectedSource ||
		(hud.mode === "area" && !hud.hasSelectedArea);
	const hudWebcamPreviewLayout = resolveHudWebcamPreviewLayout(hud.cameraSession);

	useEffect(() => subscribeHudDropdownOpen(setHudDropdownOpen), []);

	useLayoutEffect(() => {
		const compactHud = compactHudRef.current;
		if (!compactHud) {
			return;
		}

		let frameId: number | null = null;
		const syncCompactLayout = () => {
			frameId = null;

			const rect = compactHud.getBoundingClientRect();
			const width = Math.ceil(rect.width);
			const height = Math.ceil(rect.height);
			if (width <= 0 || height <= 0) {
				return;
			}

			const previousLayout = lastSyncedLayoutRef.current;
			if (previousLayout && previousLayout.width === width && previousLayout.height === height) {
				return;
			}

			lastSyncedLayoutRef.current = { width, height };
			void window.electronAPI.syncHudCompactLayout({ width, height });
		};

		const scheduleSync = () => {
			if (frameId !== null) {
				return;
			}

			frameId = window.requestAnimationFrame(syncCompactLayout);
		};

		scheduleSync();

		const observer = new ResizeObserver(scheduleSync);
		observer.observe(compactHud);
		window.addEventListener("resize", scheduleSync);

		return () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			observer.disconnect();
			window.removeEventListener("resize", scheduleSync);
		};
	}, []);

	useEffect(() => {
		if (showOverlay || hudDropdownOpen) {
			setHudMousePassthrough(false);
			return;
		}

		let frameId: number | null = null;
		const syncFromPoint = (clientX?: number, clientY?: number) => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}

			frameId = window.requestAnimationFrame(() => {
				frameId = null;
				const overInteractive =
					typeof clientX === "number" && typeof clientY === "number"
						? pointHitsHudInteractiveElement(clientX, clientY)
						: hasHoveredHudInteractiveElement();
				setHudMousePassthrough(!overInteractive);
			});
		};

		const handleMouseMove = (event: MouseEvent) => {
			syncFromPoint(event.clientX, event.clientY);
		};

		const handleMouseLeave = () => {
			setHudMousePassthrough(true);
		};

		const handleBlur = () => {
			setHudMousePassthrough(true);
		};

		syncFromPoint();
		const observer = new MutationObserver(() => syncFromPoint());
		observer.observe(document.body, {
			attributeFilter: ["data-hud-interactive"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		window.addEventListener("mousemove", handleMouseMove, true);
		document.addEventListener("mouseleave", handleMouseLeave);
		window.addEventListener("blur", handleBlur);

		return () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			observer.disconnect();
			window.removeEventListener("mousemove", handleMouseMove, true);
			document.removeEventListener("mouseleave", handleMouseLeave);
			window.removeEventListener("blur", handleBlur);
			setHudMousePassthrough(false);
		};
	}, [hudDropdownOpen, setHudMousePassthrough, showOverlay]);

	return (
		<div className="fixed inset-0 pointer-events-none">
			{/* Fullscreen overlay backdrop */}
			{showOverlay && (
				<div
					className={`pointer-events-auto absolute inset-0 flex items-center justify-center ${overlayExiting ? styles.backdropFadeOut : styles.backdropFade}`}
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
						data-hud-interactive=""
						className={`rounded-2xl border w-full mx-8 ${overlayExiting ? styles.overlayExit : styles.overlayEnter} ${styles.electronNoDrag}`}
						style={{
							maxWidth: hud.mode === "window" ? "800px" : "680px",
							background:
								"linear-gradient(180deg, rgba(30,30,32,0.94) 0%, rgba(22,22,24,0.96) 100%)",
							borderColor: "rgba(255,255,255,0.07)",
							backdropFilter: "blur(40px) saturate(160%)",
							WebkitBackdropFilter: "blur(40px) saturate(160%)",
						}}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={undefined}
					>
						{/* Tab content */}
						{hud.mode === "display" && (
							<DisplayTab
								disabled={hud.recording}
								onSelectSource={handleSelectSource}
								onPermissionDenied={handlePermissionDenied}
							/>
						)}
						{hud.mode === "window" && (
							<WindowTab
								disabled={hud.recording}
								onSelectSource={handleSelectSource}
								onFallbackToDisplay={() => {
									hud.setMode("display");
								}}
								onPermissionDenied={handlePermissionDenied}
							/>
						)}
						{hud.mode === "area" && (
							<AreaTab disabled={hud.recording} onPermissionDenied={handlePermissionDenied} />
						)}
						{hud.mode === "device" && <DeviceTab />}

						{/* Divider */}
						{hud.mode !== "device" && hud.mode !== "area" && (
							<div className="mx-6 h-px bg-white/[0.05]" />
						)}

						{/* Record button — unified pill with inline dropdown trigger.
						    Area mode uses the dedicated Quick Record button in HudToolbar. */}
						{hud.mode !== "area" && (
							<div className="flex justify-center py-5 px-6">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											disabled={isRecordDisabled}
											className={`flex items-center gap-2.5 rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all ${
												isRecordDisabled
													? "bg-red-500/15 text-white/30 cursor-not-allowed"
													: "bg-red-500 text-white hover:bg-red-600 cursor-pointer"
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
										className={`min-w-[240px] ${DROPDOWN_CLASSES} ${styles.hudScrollArea}`}
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
						)}
					</div>
				</div>
			)}

			<div
				ref={compactHudRef}
				className="fixed bottom-0 left-1/2 z-20 flex w-fit -translate-x-1/2 flex-col gap-3 pt-14 pb-3 pointer-events-none"
				style={{ alignItems: hudWebcamPreviewLayout.selfAlign }}
			>
				{/* Camera preview — floating above toolbar */}
				{hud.cameraSession.enabled &&
					hud.cameraSession.previewVisible &&
					hud.cameraPreviewStream && (
						<div
							data-hud-interactive=""
							className={`${styles.electronNoDrag} pointer-events-auto`}
							style={{
								order: hudWebcamPreviewLayout.order,
								alignSelf: hudWebcamPreviewLayout.selfAlign,
								borderRadius: 16,
								border: "1px solid rgba(255,255,255,0.1)",
								background: "#161618",
								padding: 6,
							}}
						>
							<div
								className="relative overflow-hidden bg-black"
								style={{
									width: hudWebcamPreviewLayout.width,
									height: hudWebcamPreviewLayout.height,
									borderRadius: hudWebcamPreviewLayout.borderRadius,
								}}
							>
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
					)}

				{/* Bottom toolbar */}
				<div className={`flex justify-center pointer-events-none ${styles.hudToolbarEnter}`}>
					<div
						data-hud-interactive=""
						className={`${styles.hudBar} w-fit max-w-full pointer-events-auto`}
						onPointerDown={handleHudDragPointerDown}
						onPointerMove={handleHudDragPointerMove}
						onPointerUp={handleHudDragPointerUp}
						onPointerCancel={handleHudDragPointerUp}
						style={{
							borderRadius: 14,
							background: hud.recording ? "#1d1416" : "#1d1d20",
							border: hud.recording
								? "1px solid rgba(239,68,68,0.22)"
								: "1px solid rgba(255,255,255,0.14)",
						}}
					>
						<HudToolbar
							mode={hud.mode}
							contentPanelVisible={hud.contentPanelVisible}
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
							setWebcamEnabled={hud.setWebcamEnabled}
							cameraSession={hud.cameraSession}
							setCameraDeviceId={hud.setCameraDeviceId}
							setMobileCameraEnabled={hud.setMobileCameraEnabled}
							setCameraPreviewVisible={hud.setCameraPreviewVisible}
							setCameraPreviewMirrored={hud.setCameraPreviewMirrored}
							setCameraPreviewSize={hud.setCameraPreviewSize}
							setCameraPreviewCorner={hud.setCameraPreviewCorner}
							setCameraPreviewShape={hud.setCameraPreviewShape}
							cameraDevices={hud.cameraDevices}
							mobileCaptureState={hud.mobileCaptureState}
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
							showQuickRecord={showAreaQuickRecord}
							quickRecordDisabled={isRecordDisabled}
							onQuickRecord={hud.toggleRecording}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
