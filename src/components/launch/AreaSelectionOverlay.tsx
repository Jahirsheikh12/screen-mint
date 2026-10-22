import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// The outline is drawn just outside the area, so it never shows up in the recording
// (needed where the overlay can't be hidden from capture, e.g. Linux).
const OUTLINE_GAP = 3;

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

/** The display this overlay window was opened on (set by the main process). */
function getOverlayDisplayId(fallback: unknown): number {
	const fromUrl = Number(new URLSearchParams(window.location.search).get("displayId"));
	return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Number(fallback);
}

/**
 * Screen position of the overlay's top-left. Normally the display origin, but read from the
 * window itself so the outline always matches what gets recorded.
 */
function getOverlayOrigin() {
	return { x: window.screenX, y: window.screenY };
}

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
				// The window is reused; pick up an area chosen in the HUD meanwhile (e.g. a preset).
				void window.electronAPI.getSelectedArea().then((result) => {
					const area = result.success ? result.area : null;
					if (!area) return;
					setDisplay((current) => {
						if (current && area.displayId === current.id) {
							setRect(
								clampRect(
									{
										x: area.bounds.x - getOverlayOrigin().x,
										y: area.bounds.y - getOverlayOrigin().y,
										width: area.bounds.width,
										height: area.bounds.height,
									},
									current,
								),
							);
						}
						return current;
					});
				});
			}
		});
		return () => {
			off?.();
		};
	}, []);
	const widthRef = useRef<HTMLInputElement>(null);
	const heightRef = useRef<HTMLInputElement>(null);
	const xRef = useRef<HTMLInputElement>(null);
	const yRef = useRef<HTMLInputElement>(null);

	// ── Initialise display info and restore existing area ─────────────────
	useEffect(() => {
		let cancelled = false;
		const refreshDisplay = async () => {
			const info = await window.electronAPI.getDisplayInfo();
			if (cancelled) return;
			const source = await window.electronAPI.getSelectedSource();
			if (cancelled) return;
			const displayId = getOverlayDisplayId(source?.display_id);
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

			const displayId = getOverlayDisplayId(source?.display_id);
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
							x: existing.bounds.x - getOverlayOrigin().x,
							y: existing.bounds.y - getOverlayOrigin().y,
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
				let width = Math.abs(dx);
				let height = Math.abs(dy);
				const lockedRatio = aspectLock?.ratio ?? (shiftKey ? 16 / 9 : null);
				if (lockedRatio) {
					// Follow whichever direction the pointer moved further.
					if (width / Math.max(1, height) > lockedRatio) height = Math.round(width / lockedRatio);
					else width = Math.round(height * lockedRatio);
				}
				setRect(
					clampRect(
						{
							x: dx < 0 ? drag.ox - width : drag.ox,
							y: dy < 0 ? drag.oy - height : drag.oy,
							width,
							height,
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
		void (async () => {
			// Cancelling discards edits, including a size preset that was only being previewed.
			await window.electronAPI.cancelAreaEdit();
			await window.electronAPI.closeAreaOverlay();
		})();
	}, []);

	const confirmSelection = useCallback(() => {
		if (!display) return;
		void (async () => {
			const area = normalizeSelectedArea(
				{
					x: getOverlayOrigin().x + rect.x,
					y: getOverlayOrigin().y + rect.y,
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
			if (e.target instanceof HTMLInputElement) return;

			e.preventDefault();
			const step = e.shiftKey ? 10 : 1;
			const deltas: Record<string, { dx: number; dy: number }> = {
				ArrowLeft: { dx: -step, dy: 0 },
				ArrowRight: { dx: step, dy: 0 },
				ArrowUp: { dx: 0, dy: -step },
				ArrowDown: { dx: 0, dy: step },
			};
			const delta = deltas[e.key];
			if (delta && e.altKey) {
				// Alt + arrows resize from the bottom-right corner.
				setRect((r) =>
					clampRect({ ...r, width: r.width + delta.dx, height: r.height + delta.dy }, display),
				);
			} else if (delta) {
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
		// X/Y are shown relative to the display, even if the window sits below the menu bar.
		const origin = getOverlayOrigin();
		if (xRef.current && document.activeElement !== xRef.current) {
			xRef.current.value = String(Math.round(rect.x + origin.x - (display?.x ?? origin.x)));
		}
		if (yRef.current && document.activeElement !== yRef.current) {
			yRef.current.value = String(Math.round(rect.y + origin.y - (display?.y ?? origin.y)));
		}
	}, [rect.width, rect.height, rect.x, rect.y, display]);

	// ── Apply manual size from inputs ─────────────────────────────────────
	const applySize = useCallback(
		(w: number, h: number) => {
			if (!display) return;
			const nw = clamp(Math.round(w), MIN_SIZE, display.width);
			const nh = clamp(Math.round(h), MIN_SIZE, display.height);
			// Resize around the current centre so the area stays where the user put it.
			setRect((r) =>
				clampRect(
					{
						width: nw,
						height: nh,
						x: Math.round(r.x + r.width / 2 - nw / 2),
						y: Math.round(r.y + r.height / 2 - nh / 2),
					},
					display,
				),
			);
		},
		[display],
	);

	const applyPosition = useCallback(
		(x: number, y: number) => {
			if (!display) return;
			setRect((r) => clampRect({ ...r, x: Math.round(x), y: Math.round(y) }, display));
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
		(axis: "w" | "h" | "x" | "y") => {
			const ref = { w: widthRef, h: heightRef, x: xRef, y: yRef }[axis];
			const origin = getOverlayOrigin();
			const offsetX = origin.x - (display?.x ?? origin.x);
			const offsetY = origin.y - (display?.y ?? origin.y);
			const current = { w: rect.width, h: rect.height, x: rect.x + offsetX, y: rect.y + offsetY }[
				axis
			];
			const val = Number.parseInt(ref.current?.value ?? "", 10);
			const valid = Number.isFinite(val) && (axis === "x" || axis === "y" ? val >= 0 : val > 0);
			if (!valid) {
				if (ref.current) ref.current.value = String(Math.round(current));
				return;
			}
			if (axis === "x" || axis === "y") {
				applyPosition(axis === "x" ? val - offsetX : rect.x, axis === "y" ? val - offsetY : rect.y);
				return;
			}
			const ratio = aspectLock?.ratio;
			if (axis === "w") applySize(val, ratio ? val / ratio : rect.height);
			else applySize(ratio ? val * ratio : rect.width, val);
		},
		[applyPosition, applySize, aspectLock, display, rect.width, rect.height, rect.x, rect.y],
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
	const outline = useMemo(
		() => ({
			x: rect.x - OUTLINE_GAP,
			y: rect.y - OUTLINE_GAP,
			width: rect.width + OUTLINE_GAP * 2,
			height: rect.height + OUTLINE_GAP * 2,
		}),
		[rect],
	);

	const bracketPaths = useMemo(() => {
		const { x, y, width: w, height: h } = outline;
		const L = BRACKET_LEN;
		return [
			`M${x},${y + L} L${x},${y} L${x + L},${y}`,
			`M${x + w - L},${y} L${x + w},${y} L${x + w},${y + L}`,
			`M${x},${y + h - L} L${x},${y + h} L${x + L},${y + h}`,
			`M${x + w - L},${y + h} L${x + w},${y + h} L${x + w},${y + h - L}`,
		];
	}, [outline]);

	// ── SVG edge midpoint bars ────────────────────────────────────────────
	const edgeBars = useMemo(() => {
		const { x, y, width: w, height: h } = outline;
		const hl = EDGE_BAR_LEN / 2;
		return [
			{ x1: x + w / 2 - hl, y1: y, x2: x + w / 2 + hl, y2: y },
			{ x1: x + w / 2 - hl, y1: y + h, x2: x + w / 2 + hl, y2: y + h },
			{ x1: x, y1: y + h / 2 - hl, x2: x, y2: y + h / 2 + hl },
			{ x1: x + w, y1: y + h / 2 - hl, x2: x + w, y2: y + h / 2 + hl },
		];
	}, [outline]);

	// ── Control panel position (clamped to viewport) ──────────────────────
	const panelPos = useMemo(() => {
		const vw = display?.width ?? window.innerWidth;
		const vh = display?.height ?? window.innerHeight;
		const gap = 16;
		// The bar wraps onto a second row when the display is narrower than its natural width.
		const pw = Math.min(820, vw - gap * 2);
		const ph = pw < 820 ? 100 : 60;

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
					<title>{t("area.selectedAreaTitle", "Selected recording area")}</title>
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
						x={outline.x}
						y={outline.y}
						width={outline.width}
						height={outline.height}
						fill="none"
						stroke="#F59E0B"
						strokeWidth={2}
					/>
					{/* Corner brackets */}
					<g fill="none" stroke="#F59E0B" strokeWidth={BRACKET_W} strokeLinecap="square">
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
					x={outline.x}
					y={outline.y}
					width={outline.width}
					height={outline.height}
					fill="none"
					stroke="#F59E0B"
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
				<g fill="none" stroke="#F59E0B" strokeWidth={BRACKET_W} strokeLinecap="square">
					{bracketPaths.map((d) => (
						<path key={d} d={d} />
					))}
				</g>

				{/* Edge midpoint bars */}
				<g stroke="#F59E0B" strokeWidth={3} strokeLinecap="square">
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
					className="pointer-events-none rounded-lg bg-raised/90 px-3 py-1.5 text-body font-medium tabular-nums text-fg backdrop-blur-3xl shadow-popover"
				>
					{Math.round(rect.width)} <span className="mx-1 text-fg-subtle">&times;</span>{" "}
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
						maxWidth: "calc(100vw - 32px)",
					}}
					className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-raised/90 px-3 py-2 text-label text-fg shadow-panel backdrop-blur-3xl"
					onPointerDown={(e) => e.stopPropagation()}
				>
					{/* Dimension inputs (W × H) */}
					{display && (
						<div className="flex items-center gap-1">
							<label className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption hover:bg-fill-hover transition-colors focus-within:bg-fill-hover focus-within:ring-1 focus-within:ring-accent">
								<span className="font-medium text-fg-subtle">{t("area.widthShort", "W")}</span>
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
									className="w-10 bg-transparent text-right font-medium tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</label>
							<span className="text-fg-disabled text-micro select-none font-medium">&times;</span>
							<label className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption hover:bg-fill-hover transition-colors focus-within:bg-fill-hover focus-within:ring-1 focus-within:ring-accent">
								<span className="font-medium text-fg-subtle">{t("area.heightShort", "H")}</span>
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
									className="w-10 bg-transparent text-right font-medium tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</label>
						</div>
					)}

					{/* Position inputs (X, Y from the display's top-left) */}
					{display && (
						<div className="flex items-center gap-1" title={t("area.position", "Position")}>
							{(["x", "y"] as const).map((axis) => (
								<label
									key={axis}
									className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption hover:bg-fill-hover transition-colors focus-within:bg-fill-hover focus-within:ring-1 focus-within:ring-accent"
								>
									<span className="font-medium text-fg-subtle">{axis.toUpperCase()}</span>
									<input
										ref={axis === "x" ? xRef : yRef}
										type="number"
										min={0}
										aria-label={`${t("area.position", "Position")} ${axis.toUpperCase()}`}
										defaultValue={Math.round(axis === "x" ? rect.x : rect.y)}
										onBlur={() => commitInput(axis)}
										onKeyDown={(e) => {
											if (e.key === "Enter") (e.target as HTMLInputElement).blur();
											if (e.key.startsWith("Arrow")) e.stopPropagation();
										}}
										className="w-10 bg-transparent text-right font-medium tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</label>
							))}
						</div>
					)}

					<div className="h-4 w-px bg-line-strong mx-1" />

					{/* Aspect ratio presets */}
					<div className="flex items-center p-0.5 rounded-md bg-fill-hover">
						{ASPECT_PRESETS.map((preset) => {
							const active =
								(preset.ratio == null && aspectLock == null) || aspectLock?.label === preset.label;
							return (
								<button
									key={preset.id}
									type="button"
									onClick={() => applyAspectPreset(preset)}
									className={`rounded px-2 py-1 text-caption font-medium transition-colors ${
										active
											? "bg-control text-fg shadow-sm"
											: "text-fg-subtle hover:bg-fill-hover hover:text-fg"
									}`}
								>
									{preset.ratio == null ? t("area.any", "Free") : preset.label}
								</button>
							);
						})}
					</div>

					<div className="h-4 w-px bg-line-strong mx-1" />

					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={closeOverlay}
							className="flex items-center gap-1.5 rounded-md border border-transparent bg-fill-hover px-3 py-1 text-fg-muted transition-colors hover:bg-fill-hover hover:text-fg"
						>
							<X size={13} />
							<span className="font-medium">{t("area.cancelSelection")}</span>
						</button>
						<button
							type="button"
							onClick={confirmSelection}
							className="flex items-center gap-1.5 rounded-md border border-transparent bg-accent px-3.5 py-1 font-semibold text-on-accent shadow-sm transition-colors hover:bg-accent-hover"
						>
							<Check size={13} />
							<span>{t("area.confirmSelection")}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
