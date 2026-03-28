import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { useScopedT } from "@/contexts/I18nContext";
import { normalizeSelectedArea } from "@/lib/recording/session";

type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type DisplayInfo = {
	id: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

const MIN_SIZE = 100;
const HANDLE_SIZE = 10;
function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clampRect(rect: Rect, bounds: { width: number; height: number }) {
	const width = clamp(rect.width, MIN_SIZE, bounds.width);
	const height = clamp(rect.height, MIN_SIZE, bounds.height);
	const x = clamp(rect.x, 0, Math.max(0, bounds.width - width));
	const y = clamp(rect.y, 0, Math.max(0, bounds.height - height));
	return { x, y, width, height };
}

export function AreaSelectionOverlay() {
	const t = useScopedT("launch");
	const [rect, setRect] = useState<Rect>({
		x: 120,
		y: 120,
		width: 800,
		height: 450,
	});
	const [dragging, setDragging] = useState<string | null>(null);
	const [display, setDisplay] = useState<DisplayInfo | null>(null);
	const dragStart = useRef({ mouseX: 0, mouseY: 0, rect });

	useEffect(() => {
		void (async () => {
			const [source, displayInfo, selectedAreaResult] = await Promise.all([
				window.electronAPI.getSelectedSource(),
				window.electronAPI.getDisplayInfo(),
				window.electronAPI.getSelectedArea(),
			]);

			const displayId = Number(source?.display_id);
			const selectedDisplay =
				displayInfo.success && Number.isFinite(displayId)
					? (displayInfo.displays.find((candidate) => candidate.id === displayId) ?? null)
					: null;

			const targetDisplay = selectedDisplay ?? {
				id: Number.isFinite(displayId) ? displayId : 0,
				x: 0,
				y: 0,
				width: window.innerWidth,
				height: window.innerHeight,
			};
			setDisplay(targetDisplay);

			const existingArea = selectedAreaResult.success ? (selectedAreaResult.area ?? null) : null;
			if (existingArea && existingArea.displayId === targetDisplay.id) {
				setRect(
					clampRect(
						{
							x: existingArea.bounds.x - targetDisplay.x,
							y: existingArea.bounds.y - targetDisplay.y,
							width: existingArea.bounds.width,
							height: existingArea.bounds.height,
						},
						targetDisplay,
					),
				);
				return;
			}

			setRect(
				clampRect(
					{
						x: Math.round(targetDisplay.width * 0.15),
						y: Math.round(targetDisplay.height * 0.18),
						width: Math.round(targetDisplay.width * 0.5),
						height: Math.round(targetDisplay.height * 0.42),
					},
					targetDisplay,
				),
			);
		})();
	}, []);

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
		if (!dragging || !display) return;

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
						next.width = start.width - dx;
					}
					if (dragging.includes("e")) {
						next.width = start.width + dx;
					}
					if (dragging.includes("n")) {
						next.y = start.y + dy;
						next.height = start.height - dy;
					}
					if (dragging.includes("s")) {
						next.height = start.height + dy;
					}
				}

				return clampRect(next, display);
			});
		};

		const handleMouseUp = () => setDragging(null);

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [display, dragging]);

	const closeOverlay = useCallback(() => {
		void window.electronAPI.closeAreaOverlay();
	}, []);

	const confirmSelection = useCallback(() => {
		if (!display) return;

		void (async () => {
			const area = normalizeSelectedArea(
				{
					x: display.x + rect.x,
					y: display.y + rect.y,
					width: rect.width,
					height: rect.height,
				},
				display,
				display.id,
			);
			await window.electronAPI.setSelectedArea(area);
			await window.electronAPI.closeAreaOverlay();
		})();
	}, [display, rect]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeOverlay();
				return;
			}

			if (e.key === "Enter") {
				confirmSelection();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [closeOverlay, confirmSelection]);

	const handles = useMemo(
		() => [
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
		],
		[rect.height, rect.width],
	);

	const isCorner = (id: string) => id.length === 2;

	const controlsTop = useMemo(() => {
		const viewportHeight = display?.height ?? window.innerHeight;
		const estimatedHeight = display ? 116 : 72;
		const aboveTop = rect.y - estimatedHeight - 16;
		if (aboveTop >= 16) {
			return aboveTop;
		}

		return Math.min(viewportHeight - estimatedHeight - 16, rect.y + rect.height + 16);
	}, [display, rect.height, rect.y]);

	const applySize = useCallback(
		(nextWidth: number, nextHeight: number) => {
			if (!display) return;

			const width = Math.min(display.width, Math.max(MIN_SIZE, Math.round(nextWidth)));
			const height = Math.min(display.height, Math.max(MIN_SIZE, Math.round(nextHeight)));
			setRect((current) =>
				clampRect(
					{
						...current,
						width,
						height,
						x: Math.round((display.width - width) / 2),
						y: Math.round((display.height - height) / 2),
					},
					display,
				),
			);
		},
		[display],
	);

	return (
		<div className="fixed inset-0 select-none">
			<svg className="absolute inset-0 h-full w-full pointer-events-none">
				<defs>
					<mask id="area-mask">
						<rect width="100%" height="100%" fill="white" />
						<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" />
					</mask>
				</defs>
				<rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#area-mask)" />
			</svg>

			<div
				style={{
					position: "absolute",
					left: rect.x,
					top: rect.y,
					width: rect.width,
					height: rect.height,
					border: "2px solid rgba(245, 158, 11, 0.7)",
					cursor: dragging === "move" ? "grabbing" : "grab",
					boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)",
				}}
				onMouseDown={(e) => handleMouseDown(e, "move")}
			>
				{handles.map((handle) => (
					<div
						key={handle.id}
						style={{
							position: "absolute",
							left: handle.x,
							top: handle.y,
							width: HANDLE_SIZE,
							height: HANDLE_SIZE,
							background: "#F59E0B",
							borderRadius: isCorner(handle.id) ? "50%" : 2,
							cursor: handle.cursor,
							border: "2px solid rgba(255,255,255,0.9)",
							boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
						}}
						onMouseDown={(e) => handleMouseDown(e, handle.id)}
					/>
				))}

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

			<div
				style={{
					position: "absolute",
					left: rect.x + rect.width / 2,
					top: controlsTop,
					transform: "translateX(-50%)",
				}}
				className="flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[20px] border border-[rgba(245,158,11,0.16)] bg-[linear-gradient(180deg,rgba(8,13,11,0.97)_0%,rgba(8,11,10,0.94)_100%)] px-3 py-2.5 text-xs text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
			>
				<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
					<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/38">
						Size
					</span>
					<span className="font-semibold tabular-nums text-white/92 leading-none">
						{t("area.areaSize", "{{width}} x {{height}}", {
							width: Math.round(rect.width),
							height: Math.round(rect.height),
						})}
					</span>
				</div>

				{display && (
					<div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5">
						<label className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-black/20 px-2 py-1 text-[11px] text-white/62">
							<span className="font-semibold tracking-[0.12em] text-white/38">W</span>
							<input
								type="number"
								min={MIN_SIZE}
								max={display.width}
								value={Math.round(rect.width)}
								onChange={(event) => applySize(Number(event.target.value), rect.height)}
								className="w-14 bg-transparent text-right font-semibold text-white outline-none"
							/>
						</label>
						<label className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-black/20 px-2 py-1 text-[11px] text-white/62">
							<span className="font-semibold tracking-[0.12em] text-white/38">H</span>
							<input
								type="number"
								min={MIN_SIZE}
								max={display.height}
								value={Math.round(rect.height)}
								onChange={(event) => applySize(rect.width, Number(event.target.value))}
								className="w-14 bg-transparent text-right font-semibold text-white outline-none"
							/>
						</label>
					</div>
				)}

				<div className="h-7 w-px bg-white/10" />

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={closeOverlay}
						className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-white/72 transition-colors hover:bg-white/[0.09] hover:text-white"
					>
						<FiX size={13} />
						<span className="font-medium">{t("area.cancelSelection")}</span>
					</button>
					<button
						type="button"
						onClick={confirmSelection}
						className="flex items-center gap-1.5 rounded-xl bg-[#F59E0B] px-3.5 py-1.5 font-semibold text-[#1a0f00] transition-colors hover:bg-[#fbbf24]"
					>
						<FiCheck size={13} />
						<span>{t("area.confirmSelection")}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
