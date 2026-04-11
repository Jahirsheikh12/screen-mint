import type { Span } from "dnd-timeline";
import { useItem } from "dnd-timeline";
import { Camera, Gauge, MessageSquare, Music, Scissors, Trash2, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import glassStyles from "./ItemGlass.module.css";
import WaveformCanvas from "./WaveformCanvas";

interface ItemProps {
	id: string;
	span: Span;
	rowId: string;
	children: React.ReactNode;
	isSelected?: boolean;
	onSelect?: () => void;
	onDelete?: () => void;
	zoomDepth?: number;
	speedValue?: number;
	variant?: "zoom" | "trim" | "annotation" | "speed" | "audio" | "camera" | "caption" | "clip";
	clipDuration?: string;
	clipSpeed?: string;
	waveformData?: Float32Array | null;
	sourceStartMs?: number;
	sourceEndMs?: number;
	sourceDurationMs?: number;
}

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
	1: "1.25×",
	2: "1.5×",
	3: "1.8×",
	4: "2.2×",
	5: "3.5×",
	6: "5×",
};

function formatMs(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
	}
	return `${seconds.toFixed(1)}s`;
}

export default function Item({
	id,
	span,
	rowId,
	isSelected = false,
	onSelect,
	onDelete,
	zoomDepth = 1,
	speedValue,
	variant = "zoom",
	clipDuration,
	clipSpeed,
	waveformData,
	sourceStartMs,
	sourceEndMs,
	sourceDurationMs,
	children,
}: ItemProps) {
	const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
		id,
		span,
		data: { rowId },
	});

	const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (!onDelete) return;
			e.preventDefault();
			e.stopPropagation();
			onSelect?.();
			document.body.setAttribute("data-context-menu-open", "true");
			setContextMenu({ x: e.clientX, y: e.clientY });
		},
		[onDelete, onSelect],
	);

	const closeMenu = useCallback(() => {
		setContextMenu(null);
		document.body.removeAttribute("data-context-menu-open");
	}, []);

	// Close on outside click, scroll, or escape
	useEffect(() => {
		if (!contextMenu) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				closeMenu();
			}
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeMenu();
		};
		window.addEventListener("mousedown", handleClick);
		window.addEventListener("keydown", handleKey);
		window.addEventListener("scroll", closeMenu, true);
		return () => {
			window.removeEventListener("mousedown", handleClick);
			window.removeEventListener("keydown", handleKey);
			window.removeEventListener("scroll", closeMenu, true);
		};
	}, [contextMenu, closeMenu]);

	const isZoom = variant === "zoom";
	const isTrim = variant === "trim";
	const isSpeed = variant === "speed";
	const isAudio = variant === "audio";
	const isCamera = variant === "camera";
	const isCaption = variant === "caption";
	const isClip = variant === "clip";

	const glassClass = isClip
		? glassStyles.glassClip
		: isZoom
			? glassStyles.glassGreen
			: isTrim
				? glassStyles.glassRed
				: isSpeed
					? glassStyles.glassAmber
					: isCamera
						? glassStyles.glassBlue
						: isAudio
							? glassStyles.glassPurple
							: isCaption
								? glassStyles.glassCyan
								: glassStyles.glassYellow;

	const endCapColor = isClip
		? "#f59e0b"
		: isZoom
			? "#F59E0B"
			: isTrim
				? "#ef4444"
				: isSpeed
					? "#d97706"
					: isCamera
						? "#3b82f6"
						: isAudio
							? "#a855f7"
							: isCaption
								? "#f97316"
								: "#B4A046";

	const timeLabel = useMemo(
		() => `${formatMs(span.start)} – ${formatMs(span.end)}`,
		[span.start, span.end],
	);

	const MIN_ITEM_PX = 6;
	const safeItemStyle = { ...itemStyle, minWidth: MIN_ITEM_PX };

	return (
		<div
			ref={setNodeRef}
			style={safeItemStyle}
			{...listeners}
			{...attributes}
			onPointerDownCapture={() => onSelect?.()}
			onContextMenu={handleContextMenu}
			className="group"
			data-timeline-item
		>
			{/* Right-click context menu with backdrop to block Row hover events */}
			{contextMenu &&
				createPortal(
					<div className="fixed inset-0 z-[9998]" onMouseDown={closeMenu}>
						<div
							ref={menuRef}
							className="fixed z-[9999] min-w-[140px] rounded-lg bg-[#1c1c1e] border border-white/10 shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
							style={{ left: contextMenu.x, top: contextMenu.y }}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<button
								type="button"
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
								onMouseDown={(e) => {
									e.stopPropagation();
									onDelete?.();
									closeMenu();
								}}
							>
								<Trash2 className="w-3.5 h-3.5" />
								Delete
							</button>
						</div>
					</div>,
					document.body,
				)}
			<div style={{ ...itemContentStyle, minWidth: 24 }}>
				<div
					className={cn(
						glassClass,
						"w-full h-full overflow-hidden flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing relative",
						isSelected && glassStyles.selected,
					)}
					style={{ height: isClip ? 44 : 40, color: "#fff", minWidth: 24 }}
					onClick={(event) => {
						event.stopPropagation();
						onSelect?.();
					}}
				>
					<div
						className={cn(glassStyles.zoomEndCap, glassStyles.left)}
						style={{
							cursor: "col-resize",
							pointerEvents: "auto",
							width: 8,
							opacity: 0.9,
							background: endCapColor,
						}}
						title="Resize left"
					/>
					<div
						className={cn(glassStyles.zoomEndCap, glassStyles.right)}
						style={{
							cursor: "col-resize",
							pointerEvents: "auto",
							width: 8,
							opacity: 0.9,
							background: endCapColor,
						}}
						title="Resize right"
					/>
					{/* Waveform visualization for clips with audio */}
					{isClip &&
						waveformData &&
						sourceStartMs != null &&
						sourceEndMs != null &&
						sourceDurationMs != null &&
						sourceDurationMs > 0 && (
							<WaveformCanvas
								waveformData={waveformData}
								sourceStartMs={sourceStartMs}
								sourceEndMs={sourceEndMs}
								sourceDurationMs={sourceDurationMs}
							/>
						)}
					{/* Content */}
					<div
						className="relative z-10 flex flex-col items-center justify-center text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none overflow-hidden"
						style={isClip && waveformData ? { textShadow: "0 1px 3px rgba(0,0,0,0.7)" } : undefined}
					>
						{isClip ? (
							<div className="flex items-center gap-2">
								<span
									className={`text-[11px] font-medium ${waveformData ? "text-white/70" : "text-white/40"}`}
								>
									{children}
								</span>
								{clipDuration && (
									<span className="text-[12px] font-semibold tracking-tight whitespace-nowrap">
										{clipDuration}
									</span>
								)}
								{clipSpeed && (
									<span
										className={`text-[11px] whitespace-nowrap ${waveformData ? "text-white/70" : "text-white/50"}`}
									>
										⏱ {clipSpeed}
									</span>
								)}
								{!clipDuration && !clipSpeed && (
									<span className="text-[9px] tabular-nums tracking-tight whitespace-nowrap opacity-50">
										{timeLabel}
									</span>
								)}
							</div>
						) : (
							<>
								<div className="flex items-center gap-1.5">
									{isZoom ? (
										<>
											<ZoomIn className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
												{ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
											</span>
										</>
									) : isTrim ? (
										<>
											<Scissors className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
												Trim
											</span>
										</>
									) : isSpeed ? (
										<>
											<Gauge className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
												{speedValue !== undefined ? `${speedValue}×` : "Speed"}
											</span>
										</>
									) : isAudio ? (
										<>
											<Music className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight truncate max-w-full">
												{children}
											</span>
										</>
									) : isCamera ? (
										<>
											<Camera className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
												{children}
											</span>
										</>
									) : (
										<>
											<MessageSquare className="w-3.5 h-3.5 shrink-0" />
											<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
												{children}
											</span>
										</>
									)}
								</div>
								<span
									className={`text-[9px] tabular-nums tracking-tight whitespace-nowrap transition-opacity ${
										isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"
									}`}
								>
									{timeLabel}
								</span>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
