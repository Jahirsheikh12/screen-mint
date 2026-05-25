import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { useScopedT } from "@/contexts/I18nContext";
import { normalizeSelectedArea } from "@/lib/recording/session";

type Rect = { x: number; y: number; width: number; height: number };
type DisplayInfo = { id: number; x: number; y: number; width: number; height: number };

const MIN_SIZE = 100;
const HANDLE_HIT = 20;
const BRACKET_LEN = 16;
const BRACKET_W = 2.5;
const EDGE_BAR_LEN = 24;
const DEAD_ZONE = 5;

function clamp(v: number, lo: number, hi: number) {
	return Math.min(hi, Math.max(lo, v));
}

function clampRect(r: Rect, bounds: { width: number; height: number }): Rect {
	const w = clamp(r.width, MIN_SIZE, bounds.width);
	const h = clamp(r.height, MIN_SIZE, bounds.height);
	return {
		x: clamp(r.x, 0, Math.max(0, bounds.width - w)),
		y: clamp(r.y, 0, Math.max(0, bounds.height - h)),
		width: w,
		height: h,
	};
}

type DragState =
	| { kind: "idle" }
	| { kind: "move"; ox: number; oy: number; start: Rect }
	| { kind: "resize"; handle: string; ox: number; oy: number; start: Rect }
	| { kind: "draw-pending"; ox: number; oy: number; savedRect: Rect }
	| { kind: "draw"; ox: number; oy: number };

const IDLE: DragState = { kind: "idle" };

function isDragActive(d: DragState) {
	return d.kind !== "idle" && d.kind !== "draw-pending";
}

type AspectLock = { ratio: number; label: string } | null;

const ASPECT_PRESETS: { id: string; label: string; ratio: number | null }[] = [
	{ id: "free", label: "Free", ratio: null },
	{ id: "16:9", label: "16:9", ratio: 16 / 9 },
	{ id: "4:3", label: "4:3", ratio: 4 / 3 },
	{ id: "1:1", label: "1:1", ratio: 1 },
	{ id: "9:16", label: "9:16", ratio: 9 / 16 },
];

type Phase = "selecting" | "locked";

export function AreaSelectionOverlay() {
	const t = useScopedT("launch");
	const [rect, setRect] = useState<Rect>({ x: 120, y: 120, width: 800, height: 450 });
	const [display, setDisplay] = useState<DisplayInfo | null>(null);
	const [drag, setDrag] = useState<DragState>(IDLE);
	const [shiftKey, setShiftKey] = useState(false);
	const [aspectLock, setAspectLock] = useState<AspectLock>(null);
	const [phase, setPhase] = useState<Phase>("selecting");

	useEffect(() => {
		const off = window.electronAPI.onAreaOverlayPhase?.((nextPhase) => {
			setPhase(nextPhase);
			if (nextPhase === "selecting") {
				setDrag(IDLE);
			}
		});
		return () => {
			off?.();
		};
	}, []);
	const widthRef = useRef<HTMLInputElement>(null);
	const heightRef = useRef<HTMLInputElement>(null);

	// ── Initialise display info and restore existing area ─────────────────
	useEffect(() => {
		let cancelled = false;
		const refreshDisplay = async () => {
			const info = await window.electronAPI.getDisplayInfo();
			if (cancelled) return;
			const source = await window.electronAPI.getSelectedSource();
			if (cancelled) return;
			const displayId = Number(source?.display_id);
			const found =
				info.success && Number.isFinite(displayId)
					? (info.displays.find((d) => d.id === displayId) ?? null)
					: null;
			if (found) {
				setDisplay((prev) => {
					if (
						prev &&
						prev.id === found.id &&
						prev.x === found.x &&
						prev.y === found.y &&
						prev.width === found.width &&
						prev.height === found.height
					) {
						return prev;
					}
					return found;
				});
			}
		};

		const onResize = () => {
			void refreshDisplay();
		};
		window.addEventListener("resize", onResize);

		void (async () => {
			const [source, info, areaRes] = await Promise.all([
				window.electronAPI.getSelectedSource(),
				window.electronAPI.getDisplayInfo(),
				window.electronAPI.getSelectedArea(),
			]);
			if (cancelled) return;

			const displayId = Number(source?.display_id);
			const found =
				info.success && Number.isFinite(displayId)
					? (info.displays.find((d) => d.id === displayId) ?? null)
					: null;
			const disp: DisplayInfo = found ?? {
				id: Number.isFinite(displayId) ? displayId : 0,
				x: 0,
				y: 0,
				width: window.innerWidth,
				height: window.innerHeight,
			};
			setDisplay(disp);

			const existing = areaRes.success ? (areaRes.area ?? null) : null;
			if (existing && existing.displayId === disp.id) {
				setRect(
					clampRect(
						{
							x: existing.bounds.x - disp.x,
							y: existing.bounds.y - disp.y,
							width: existing.bounds.width,
							height: existing.bounds.height,
						},
						disp,
					),
				);
				return;
			}

			setRect(
				clampRect(
					{
						width: Math.round(disp.width * 0.5),
						height: Math.round(disp.height * 0.42),
						x: Math.round(disp.width * 0.25),
						y: Math.round(disp.height * 0.29),
					},
					disp,
				),
			);
		})();
		return () => {
			cancelled = true;
			window.removeEventListener("resize", onResize);
		};
	}, []);

	// ── Pointer move / up during drag ─────────────────────────────────────
	useEffect(() => {
		if (drag.kind === "idle" || !display) return;

		const onMove = (e: PointerEvent) => {
			const dx = e.clientX - drag.ox;
			const dy = e.clientY - drag.oy;

			if (drag.kind === "draw-pending") {
				if (Math.hypot(dx, dy) > DEAD_ZONE) {
					setDrag({ kind: "draw", ox: drag.ox, oy: drag.oy });
				}
				return;
			}

			if (drag.kind === "move") {
				const s = drag.start;
				setRect(clampRect({ x: s.x + dx, y: s.y + dy, width: s.width, height: s.height }, display));
				return;
			}

			if (drag.kind === "resize") {
				const s = drag.start;
				const h = drag.handle;
				const next = { ...s };
				const rightEdge = s.x + s.width;
				const bottomEdge = s.y + s.height;

				// Anchor the opposite edge to prevent rect inversion
				if (h.includes("w")) {
					next.x = Math.min(s.x + dx, rightEdge - MIN_SIZE);
					next.width = rightEdge - next.x;
				}
				if (h.includes("e")) {
					next.width = Math.max(MIN_SIZE, s.width + dx);
				}
				if (h.includes("n")) {
					next.y = Math.min(s.y + dy, bottomEdge - MIN_SIZE);
					next.height = bottomEdge - next.y;
				}
				if (h.includes("s")) {
					next.height = Math.max(MIN_SIZE, s.height + dy);
				}

				// Aspect ratio lock — sticky preset takes precedence, shift+corner falls back to 16:9
				const lockedRatio = aspectLock?.ratio ?? (shiftKey && h.length === 2 ? 16 / 9 : null);
				if (lockedRatio) {
					if (next.width / next.height > lockedRatio) {
						next.width = Math.round(next.height * lockedRatio);
						if (h.includes("w")) next.x = rightEdge - next.width;
					} else {
						next.height = Math.round(next.width / lockedRatio);
						if (h.includes("n")) next.y = bottomEdge - next.height;
					}
				}

				setRect(clampRect(next, display));
				return;
			}

			if (drag.kind === "draw") {
				setRect(
					clampRect(
						{
							x: Math.min(drag.ox, e.clientX),
							y: Math.min(drag.oy, e.clientY),
							width: Math.abs(dx),
							height: Math.abs(dy),
						},
						display,
					),
				);
			}
		};

		const onUp = () => {
			if (drag.kind === "draw-pending") {
				setRect(drag.savedRect);
			}
			setDrag(IDLE);
		};

		// End drag if window loses focus
		const onBlur = () => {
			if (drag.kind === "draw-pending") {
				setRect(drag.savedRect);
			}
			setDrag(IDLE);
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("blur", onBlur);
		};
	}, [aspectLock, display, drag, shiftKey]);

	// ── Track Shift key for aspect-ratio lock ─────────────────────────────
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftKey(true);
		};
		const up = (e: KeyboardEvent) => {
			if (e.key === "Shift") setShiftKey(false);
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, []);

	// ── Close / confirm ───────────────────────────────────────────────────
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
			setPhase("locked");
			await window.electronAPI.lockAreaOverlay();
		})();
	}, [display, rect]);

	// ── Keyboard: Escape, Enter, Arrow keys ───────────────────────────────
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeOverlay();
				return;
			}
			if (e.key === "Enter") {
				confirmSelection();
				return;
			}
			if (!display || !e.key.startsWith("Arrow")) return;

			e.preventDefault();
			const step = e.shiftKey ? 10 : 1;
			const deltas: Record<string, { dx: number; dy: number }> = {
				ArrowLeft: { dx: -step, dy: 0 },
				ArrowRight: { dx: step, dy: 0 },
				ArrowUp: { dx: 0, dy: -step },
				ArrowDown: { dx: 0, dy: step },
			};
			const delta = deltas[e.key];
			if (delta) {
				setRect((r) => clampRect({ ...r, x: r.x + delta.dx, y: r.y + delta.dy }, display));
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [closeOverlay, confirmSelection, display]);

	// ── Sync dimension inputs when not focused ────────────────────────────
	useEffect(() => {
		if (widthRef.current && document.activeElement !== widthRef.current) {
			widthRef.current.value = String(Math.round(rect.width));
		}
		if (heightRef.current && document.activeElement !== heightRef.current) {
			heightRef.current.value = String(Math.round(rect.height));
		}
	}, [rect.width, rect.height]);

	// ── Apply manual size from inputs ─────────────────────────────────────
	const applySize = useCallback(
		(w: number, h: number) => {
			if (!display) return;
			const nw = clamp(Math.round(w), MIN_SIZE, display.width);
			const nh = clamp(Math.round(h), MIN_SIZE, display.height);
			setRect((r) =>
				clampRect(
					{
						...r,
						width: nw,
						height: nh,
						x: Math.round((display.width - nw) / 2),
						y: Math.round((display.height - nh) / 2),
					},
					display,
				),
			);
		},
		[display],
	);

	const applyAspectPreset = useCallback(
		(preset: { id: string; label: string; ratio: number | null }) => {
			if (preset.ratio == null) {
				setAspectLock(null);
				return;
			}
			setAspectLock({ ratio: preset.ratio, label: preset.label });
			if (!display) return;
			setRect((r) => {
				let w = r.width;
				let h = Math.round(w / preset.ratio!);
				if (h > display.height) {
					h = display.height;
					w = Math.round(h * preset.ratio!);
				}
				const cx = r.x + r.width / 2;
				const cy = r.y + r.height / 2;
				return clampRect(
					{
						x: Math.round(cx - w / 2),
						y: Math.round(cy - h / 2),
						width: w,
						height: h,
					},
					display,
				);
			});
		},
		[display],
	);

	const commitInput = useCallback(
		(axis: "w" | "h") => {
			const ref = axis === "w" ? widthRef : heightRef;
			const val = Number.parseInt(ref.current?.value ?? "", 10);
			if (Number.isFinite(val) && val > 0) {
				applySize(axis === "w" ? val : rect.width, axis === "h" ? val : rect.height);
			} else if (ref.current) {
				ref.current.value = String(Math.round(axis === "w" ? rect.width : rect.height));
			}
		},
		[applySize, rect.width, rect.height],
	);

	// ── Pointer-down handlers ─────────────────────────────────────────────
	const onBackgroundDown = useCallback(
		(e: React.PointerEvent) => {
			if ((e.target as HTMLElement).closest("[data-panel]")) return;
			e.preventDefault();
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			setDrag({
				kind: "draw-pending",
				ox: e.clientX,
				oy: e.clientY,
				savedRect: rect,
			});
		},
		[rect],
	);

	const onMoveDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			e.stopPropagation();
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			setDrag({
				kind: "move",
				ox: e.clientX,
				oy: e.clientY,
				start: { ...rect },
			});
		},
		[rect],
	);

	const onHandleDown = useCallback(
		(e: React.PointerEvent, handle: string) => {
			e.preventDefault();
			e.stopPropagation();
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
			setDrag({
				kind: "resize",
				handle,
				ox: e.clientX,
				oy: e.clientY,
				start: { ...rect },
			});
		},
		[rect],
	);

	// ── Corner handles ────────────────────────────────────────────────────
	const cornerHandles = useMemo(() => {
		const hh = HANDLE_HIT / 2;
		return [
			{ id: "nw", left: rect.x - hh, top: rect.y - hh, cursor: "nwse-resize" },
			{
				id: "ne",
				left: rect.x + rect.width - hh,
				top: rect.y - hh,
				cursor: "nesw-resize",
			},
			{
				id: "sw",
				left: rect.x - hh,
				top: rect.y + rect.height - hh,
				cursor: "nesw-resize",
			},
			{
				id: "se",
				left: rect.x + rect.width - hh,
				top: rect.y + rect.height - hh,
				cursor: "nwse-resize",
			},
		] as const;
	}, [rect.x, rect.y, rect.width, rect.height]);

	// ── Edge strip handles (full edge coverage, no gaps) ──────────────────
	const edgeStrips = useMemo(() => {
		const hh = HANDLE_HIT / 2;
		return [
			{
				id: "n",
				left: rect.x + hh,
				top: rect.y - hh,
				width: Math.max(0, rect.width - HANDLE_HIT),
				height: HANDLE_HIT,
				cursor: "ns-resize",
			},
			{
				id: "s",
				left: rect.x + hh,
				top: rect.y + rect.height - hh,
				width: Math.max(0, rect.width - HANDLE_HIT),
				height: HANDLE_HIT,
				cursor: "ns-resize",
			},
			{
				id: "w",
				left: rect.x - hh,
				top: rect.y + hh,
				width: HANDLE_HIT,
				height: Math.max(0, rect.height - HANDLE_HIT),
				cursor: "ew-resize",
			},
			{
				id: "e",
				left: rect.x + rect.width - hh,
				top: rect.y + hh,
				width: HANDLE_HIT,
				height: Math.max(0, rect.height - HANDLE_HIT),
				cursor: "ew-resize",
			},
		] as const;
	}, [rect.x, rect.y, rect.width, rect.height]);

	// ── SVG corner bracket paths ──────────────────────────────────────────
	const bracketPaths = useMemo(() => {
		const { x, y, width: w, height: h } = rect;
		const L = BRACKET_LEN;
		return [
			`M${x},${y + L} L${x},${y} L${x + L},${y}`,
			`M${x + w - L},${y} L${x + w},${y} L${x + w},${y + L}`,
			`M${x},${y + h - L} L${x},${y + h} L${x + L},${y + h}`,
			`M${x + w - L},${y + h} L${x + w},${y + h} L${x + w},${y + h - L}`,
		];
	}, [rect]);

	// ── SVG edge midpoint bars ────────────────────────────────────────────
	const edgeBars = useMemo(() => {
		const { x, y, width: w, height: h } = rect;
		const hl = EDGE_BAR_LEN / 2;
		return [
			{ x1: x + w / 2 - hl, y1: y, x2: x + w / 2 + hl, y2: y },
			{ x1: x + w / 2 - hl, y1: y + h, x2: x + w / 2 + hl, y2: y + h },
			{ x1: x, y1: y + h / 2 - hl, x2: x, y2: y + h / 2 + hl },
			{ x1: x + w, y1: y + h / 2 - hl, x2: x + w, y2: y + h / 2 + hl },
		];
	}, [rect]);

	// ── Control panel position (clamped to viewport) ──────────────────────
	const panelPos = useMemo(() => {
		const vw = display?.width ?? window.innerWidth;
		const vh = display?.height ?? window.innerHeight;
		const pw = 720;
		const ph = 60;
		const gap = 16;

		const left = clamp(rect.x + rect.width / 2, pw / 2 + gap, vw - pw / 2 - gap);
		const above = rect.y - ph - gap;
		const top = above >= gap ? above : Math.min(vh - ph - gap, rect.y + rect.height + gap);
		return { left, top };
	}, [display, rect]);

	const active = isDragActive(drag);
	const showPanel = drag.kind !== "draw" && drag.kind !== "draw-pending";

	if (phase === "locked") {
		return (
			<div className="fixed inset-0" style={{ pointerEvents: "none", background: "transparent" }}>
				<svg className="absolute inset-0 h-full w-full">
					<title>Selected recording area</title>
					<defs>
						<mask id="area-mask-locked">
							<rect width="100%" height="100%" fill="white" />
							<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" />
						</mask>
					</defs>
					{/* Dark mask over the non-recorded area — same visual as selection phase */}
					<rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#area-mask-locked)" />
					{/* Selection border */}
					<rect
						x={rect.x}
						y={rect.y}
						width={rect.width}
						height={rect.height}
						fill="none"
						stroke="#0A84FF"
						strokeWidth={2}
					/>
					{/* Corner brackets */}
					<g fill="none" stroke="#0A84FF" strokeWidth={BRACKET_W} strokeLinecap="square">
						{bracketPaths.map((d) => (
							<path key={d} d={d} />
						))}
					</g>
				</svg>
			</div>
		);
	}

	return (
		<div
			className="fixed inset-0 select-none"
			style={{
				cursor: drag.kind === "draw" || drag.kind === "draw-pending" ? "crosshair" : undefined,
			}}
			onPointerDown={onBackgroundDown}
		>
			{/* ── SVG: overlay mask + selection visuals ─────────────── */}
			<svg className="absolute inset-0 h-full w-full pointer-events-none">
				<defs>
					<mask id="area-mask">
						<rect width="100%" height="100%" fill="white" />
						<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" />
					</mask>
				</defs>

				{/* Dark overlay */}
				<rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#area-mask)" />

				{/* Edge guide lines (visible during active drag) */}
				{active && (
					<g stroke="rgba(245,158,11,0.2)" strokeWidth={1} strokeDasharray="6 4">
						{/* Vertical guides (left & right edges) */}
						<line x1={rect.x} y1={0} x2={rect.x} y2={rect.y} />
						<line x1={rect.x} y1={rect.y + rect.height} x2={rect.x} y2="100%" />
						<line x1={rect.x + rect.width} y1={0} x2={rect.x + rect.width} y2={rect.y} />
						<line
							x1={rect.x + rect.width}
							y1={rect.y + rect.height}
							x2={rect.x + rect.width}
							y2="100%"
						/>
						{/* Horizontal guides (top & bottom edges) */}
						<line x1={0} y1={rect.y} x2={rect.x} y2={rect.y} />
						<line x1={rect.x + rect.width} y1={rect.y} x2="100%" y2={rect.y} />
						<line x1={0} y1={rect.y + rect.height} x2={rect.x} y2={rect.y + rect.height} />
						<line
							x1={rect.x + rect.width}
							y1={rect.y + rect.height}
							x2="100%"
							y2={rect.y + rect.height}
						/>
					</g>
				)}

				{/* Selection border */}
				<rect
					x={rect.x}
					y={rect.y}
					width={rect.width}
					height={rect.height}
					fill="none"
					stroke="#0A84FF"
					strokeWidth={2}
				/>

				{/* Rule-of-thirds grid */}
				<g stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 4">
					<line
						x1={rect.x + rect.width / 3}
						y1={rect.y}
						x2={rect.x + rect.width / 3}
						y2={rect.y + rect.height}
					/>
					<line
						x1={rect.x + (rect.width * 2) / 3}
						y1={rect.y}
						x2={rect.x + (rect.width * 2) / 3}
						y2={rect.y + rect.height}
					/>
					<line
						x1={rect.x}
						y1={rect.y + rect.height / 3}
						x2={rect.x + rect.width}
						y2={rect.y + rect.height / 3}
					/>
					<line
						x1={rect.x}
						y1={rect.y + (rect.height * 2) / 3}
						x2={rect.x + rect.width}
						y2={rect.y + (rect.height * 2) / 3}
					/>
				</g>

				{/* Corner brackets */}
				<g fill="none" stroke="#0A84FF" strokeWidth={BRACKET_W} strokeLinecap="square">
					{bracketPaths.map((d) => (
						<path key={d} d={d} />
					))}
				</g>

				{/* Edge midpoint bars */}
				<g stroke="#0A84FF" strokeWidth={3} strokeLinecap="square">
					{edgeBars.map((l) => (
						<line key={`${l.x1}-${l.y1}-${l.x2}-${l.y2}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
					))}
				</g>
			</svg>

			{/* ── Interactive: move handle (interior) ──────────────── */}
			<div
				style={{
					position: "absolute",
					left: rect.x + HANDLE_HIT / 2,
					top: rect.y + HANDLE_HIT / 2,
					width: Math.max(0, rect.width - HANDLE_HIT),
					height: Math.max(0, rect.height - HANDLE_HIT),
					cursor: drag.kind === "move" ? "grabbing" : "grab",
				}}
				onPointerDown={onMoveDown}
			/>

			{/* ── Interactive: edge strip handles ──────────────────── */}
			{edgeStrips.map((strip) => (
				<div
					key={strip.id}
					style={{
						position: "absolute",
						left: strip.left,
						top: strip.top,
						width: strip.width,
						height: strip.height,
						cursor: strip.cursor,
					}}
					onPointerDown={(e) => onHandleDown(e, strip.id)}
				/>
			))}

			{/* ── Interactive: corner handles ──────────────────────── */}
			{cornerHandles.map((corner) => (
				<div
					key={corner.id}
					style={{
						position: "absolute",
						left: corner.left,
						top: corner.top,
						width: HANDLE_HIT,
						height: HANDLE_HIT,
						cursor: corner.cursor,
					}}
					onPointerDown={(e) => onHandleDown(e, corner.id)}
				/>
			))}

			{/* ── Center dimension badge (during active drag) ──────── */}
			{active && (
				<div
					style={{
						position: "absolute",
						left: rect.x + rect.width / 2,
						top: rect.y + rect.height / 2,
						transform: "translate(-50%, -50%)",
					}}
					className="pointer-events-none rounded-lg bg-[rgba(28,28,30,0.85)] px-3 py-1.5 text-[13px] font-medium tabular-nums text-white backdrop-blur-3xl shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-white/10"
				>
					{Math.round(rect.width)} <span className="mx-1 text-white/50">&times;</span>{" "}
					{Math.round(rect.height)}
				</div>
			)}

			{/* ── Control panel ─────────────────────────────────────── */}
			{showPanel && (
				<div
					data-panel
					style={{
						position: "absolute",
						left: panelPos.left,
						top: panelPos.top,
						transform: "translateX(-50%)",
					}}
					className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-[rgba(28,28,30,0.85)] px-3 py-2 text-xs text-white shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-3xl"
					onPointerDown={(e) => e.stopPropagation()}
				>
					{/* Dimension inputs (W × H) */}
					{display && (
						<div className="flex items-center gap-1">
							<label className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] hover:bg-white/10 transition-colors focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-[#0A84FF]">
								<span className="font-medium text-white/50">W</span>
								<input
									ref={widthRef}
									type="number"
									min={MIN_SIZE}
									max={display.width}
									defaultValue={Math.round(rect.width)}
									onBlur={() => commitInput("w")}
									onKeyDown={(e) => {
										if (e.key === "Enter") (e.target as HTMLInputElement).blur();
										if (e.key.startsWith("Arrow")) e.stopPropagation();
									}}
									className="w-10 bg-transparent text-right font-medium tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</label>
							<span className="text-white/30 text-[10px] select-none font-medium">&times;</span>
							<label className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] hover:bg-white/10 transition-colors focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-[#0A84FF]">
								<span className="font-medium text-white/50">H</span>
								<input
									ref={heightRef}
									type="number"
									min={MIN_SIZE}
									max={display.height}
									defaultValue={Math.round(rect.height)}
									onBlur={() => commitInput("h")}
									onKeyDown={(e) => {
										if (e.key === "Enter") (e.target as HTMLInputElement).blur();
										if (e.key.startsWith("Arrow")) e.stopPropagation();
									}}
									className="w-10 bg-transparent text-right font-medium tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</label>
						</div>
					)}

					{/* Position chip */}
					<div className="flex items-center gap-1.5 px-2 py-1">
						<span className="text-[11px] font-medium text-white/50">Pos</span>
						<span className="font-medium tabular-nums text-white/90">
							{Math.round(rect.x)}, {Math.round(rect.y)}
						</span>
					</div>

					<div className="h-4 w-px bg-white/10 mx-1" />

					{/* Aspect ratio presets */}
					<div className="flex items-center p-0.5 rounded-md bg-black/20 border border-white/5">
						{ASPECT_PRESETS.map((preset) => {
							const active =
								(preset.ratio == null && aspectLock == null) || aspectLock?.label === preset.label;
							return (
								<button
									key={preset.id}
									type="button"
									onClick={() => applyAspectPreset(preset)}
									className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
										active
											? "bg-white/15 text-white shadow-sm"
											: "text-white/50 hover:bg-white/10 hover:text-white/90"
									}`}
								>
									{preset.label}
								</button>
							);
						})}
					</div>

					<div className="h-4 w-px bg-white/10 mx-1" />

					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={closeOverlay}
							className="flex items-center gap-1.5 rounded-md border border-transparent bg-white/5 px-3 py-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
						>
							<FiX size={13} />
							<span className="font-medium">{t("area.cancelSelection")}</span>
						</button>
						<button
							type="button"
							onClick={confirmSelection}
							className="flex items-center gap-1.5 rounded-md border border-transparent bg-[#0A84FF] px-3.5 py-1 font-medium text-white shadow-sm transition-colors hover:bg-[#007AFF]"
						>
							<FiCheck size={13} />
							<span>{t("area.confirmSelection")}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
