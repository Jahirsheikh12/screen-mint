import { useCallback, useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";

type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const MIN_SIZE = 100;
const HANDLE_SIZE = 10;

export function AreaSelectionOverlay() {
	const [rect, setRect] = useState<Rect>({
		x: 200,
		y: 200,
		width: 800,
		height: 450,
	});
	const [dragging, setDragging] = useState<string | null>(null);
	const dragStart = useRef({ mouseX: 0, mouseY: 0, rect: { ...rect } });

	const handleMouseDown = useCallback(
		(e: React.MouseEvent, handle: string) => {
			e.preventDefault();
			e.stopPropagation();
			setDragging(handle);
			dragStart.current = {
				mouseX: e.clientX,
				mouseY: e.clientY,
				rect: { ...rect },
			};
		},
		[rect],
	);

	useEffect(() => {
		if (!dragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			const dx = e.clientX - dragStart.current.mouseX;
			const dy = e.clientY - dragStart.current.mouseY;
			const start = dragStart.current.rect;

			setRect(() => {
				const next = { ...start };

				if (dragging === "move") {
					next.x = start.x + dx;
					next.y = start.y + dy;
				} else {
					if (dragging.includes("w")) {
						next.x = start.x + dx;
						next.width = Math.max(MIN_SIZE, start.width - dx);
					}
					if (dragging.includes("e")) {
						next.width = Math.max(MIN_SIZE, start.width + dx);
					}
					if (dragging.includes("n")) {
						next.y = start.y + dy;
						next.height = Math.max(MIN_SIZE, start.height - dy);
					}
					if (dragging.includes("s")) {
						next.height = Math.max(MIN_SIZE, start.height + dy);
					}
				}

				return next;
			});
		};

		const handleMouseUp = () => setDragging(null);

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragging]);

	// Close on Escape
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				void window.electronAPI.closeAreaOverlay();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handles = [
		{ id: "nw", x: -HANDLE_SIZE / 2, y: -HANDLE_SIZE / 2, cursor: "nwse-resize" },
		{
			id: "ne",
			x: rect.width - HANDLE_SIZE / 2,
			y: -HANDLE_SIZE / 2,
			cursor: "nesw-resize",
		},
		{
			id: "sw",
			x: -HANDLE_SIZE / 2,
			y: rect.height - HANDLE_SIZE / 2,
			cursor: "nesw-resize",
		},
		{
			id: "se",
			x: rect.width - HANDLE_SIZE / 2,
			y: rect.height - HANDLE_SIZE / 2,
			cursor: "nwse-resize",
		},
		{
			id: "n",
			x: rect.width / 2 - HANDLE_SIZE / 2,
			y: -HANDLE_SIZE / 2,
			cursor: "ns-resize",
		},
		{
			id: "s",
			x: rect.width / 2 - HANDLE_SIZE / 2,
			y: rect.height - HANDLE_SIZE / 2,
			cursor: "ns-resize",
		},
		{
			id: "w",
			x: -HANDLE_SIZE / 2,
			y: rect.height / 2 - HANDLE_SIZE / 2,
			cursor: "ew-resize",
		},
		{
			id: "e",
			x: rect.width - HANDLE_SIZE / 2,
			y: rect.height / 2 - HANDLE_SIZE / 2,
			cursor: "ew-resize",
		},
	];

	const isCorner = (id: string) => id.length === 2;

	return (
		<div className="fixed inset-0 select-none">
			{/* Dark backdrop with cutout */}
			<svg className="absolute inset-0 w-full h-full pointer-events-none">
				<defs>
					<mask id="area-mask">
						<rect width="100%" height="100%" fill="white" />
						<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" />
					</mask>
				</defs>
				<rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#area-mask)" />
			</svg>

			{/* Selection rectangle */}
			<div
				style={{
					position: "absolute",
					left: rect.x,
					top: rect.y,
					width: rect.width,
					height: rect.height,
					border: "2px solid rgba(16, 185, 129, 0.7)",
					cursor: dragging === "move" ? "grabbing" : "grab",
					boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)",
				}}
				onMouseDown={(e) => handleMouseDown(e, "move")}
			>
				{/* Drag handles */}
				{handles.map((h) => (
					<div
						key={h.id}
						style={{
							position: "absolute",
							left: h.x,
							top: h.y,
							width: HANDLE_SIZE,
							height: HANDLE_SIZE,
							background: "#10B981",
							borderRadius: isCorner(h.id) ? "50%" : 2,
							cursor: h.cursor,
							border: "2px solid rgba(255,255,255,0.9)",
							boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
						}}
						onMouseDown={(e) => handleMouseDown(e, h.id)}
					/>
				))}

				{/* Crosshair guides */}
				<div
					style={{
						position: "absolute",
						left: "33.33%",
						top: 0,
						width: 1,
						height: "100%",
						background: "rgba(255,255,255,0.08)",
						pointerEvents: "none",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: "66.66%",
						top: 0,
						width: 1,
						height: "100%",
						background: "rgba(255,255,255,0.08)",
						pointerEvents: "none",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 0,
						top: "33.33%",
						width: "100%",
						height: 1,
						background: "rgba(255,255,255,0.08)",
						pointerEvents: "none",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 0,
						top: "66.66%",
						width: "100%",
						height: 1,
						background: "rgba(255,255,255,0.08)",
						pointerEvents: "none",
					}}
				/>
			</div>

			{/* Info panel — positioned above the selection */}
			<div
				style={{
					position: "absolute",
					left: rect.x + rect.width / 2,
					top: Math.max(8, rect.y - 44),
					transform: "translateX(-50%)",
				}}
				className="flex items-center gap-3 rounded-lg bg-[rgba(10,15,13,0.95)] px-4 py-2 text-white text-xs backdrop-blur-xl border border-[rgba(16,185,129,0.2)] shadow-lg whitespace-nowrap"
			>
				<span className="font-medium tabular-nums">
					{Math.round(rect.width)} x {Math.round(rect.height)}
				</span>
				<span className="text-white/30">px</span>
			</div>

			{/* Close button */}
			<button
				type="button"
				onClick={() => void window.electronAPI.closeAreaOverlay()}
				className="fixed top-5 right-5 flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(10,15,13,0.9)] text-white/60 hover:text-white border border-white/10 cursor-pointer transition-colors shadow-lg"
			>
				<FiX size={16} />
			</button>
		</div>
	);
}
