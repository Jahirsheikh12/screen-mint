import type { RowDefinition } from "dnd-timeline";
import { useRow, useTimelineContext } from "dnd-timeline";
import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface RowProps extends RowDefinition {
	children: React.ReactNode;
	label?: string;
	hint?: string;
	isEmpty?: boolean;
	labelColor?: string;
	onAddEffect?: (clickTimeMs?: number) => void;
	addLabel?: string;
	variant?: "default" | "clip" | "zoom";
}

export default function Row({
	id,
	children,
	label,
	hint,
	isEmpty,
	labelColor = "#666",
	onAddEffect,
	addLabel,
	variant = "default",
}: RowProps) {
	const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({ id });
	const { sidebarWidth, range, pixelsToValue } = useTimelineContext();
	const [isHovered, setIsHovered] = useState(false);
	const [isOverItem, setIsOverItem] = useState(false);
	const [mouseX, setMouseX] = useState(0);
	const lastMouseClientX = useRef(0);
	const rowRef = useRef<HTMLDivElement>(null);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!onAddEffect || !rowRef.current) return;
			// Check if mouse is over an existing timeline item or a context menu is open
			const target = e.target as HTMLElement;
			setIsOverItem(
				target.closest("[data-timeline-item]") !== null ||
					document.body.hasAttribute("data-context-menu-open"),
			);
			const rect = rowRef.current.getBoundingClientRect();
			setMouseX(e.clientX - rect.left);
			lastMouseClientX.current = e.clientX;
		},
		[onAddEffect],
	);

	const handleAddClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (!onAddEffect || !rowRef.current) return;

			// Calculate the time position from the click location
			const rect = rowRef.current.getBoundingClientRect();
			const clickX = lastMouseClientX.current - rect.left - sidebarWidth;
			if (clickX >= 0) {
				const relativeMs = pixelsToValue(clickX);
				const clickTimeMs = Math.max(0, range.start + relativeMs);
				onAddEffect(clickTimeMs);
			} else {
				onAddEffect();
			}
		},
		[onAddEffect, sidebarWidth, range.start, pixelsToValue],
	);

	const bgClass =
		variant === "zoom"
			? "border-b border-[#1a1a2e] bg-[#12121f] relative group/row"
			: variant === "clip"
				? "border-b border-[#1a1810] bg-[#141210] relative group/row"
				: "border-b border-[#18181b] bg-[#141416] relative group/row";

	return (
		<div
			ref={rowRef}
			className={bgClass}
			style={{ ...rowWrapperStyle, minHeight: variant === "clip" ? 52 : 48, marginBottom: 2 }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onMouseMove={handleMouseMove}
		>
			{label && (
				<div
					className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-widest z-20 pointer-events-none select-none"
					style={{ color: labelColor, writingMode: "horizontal-tb" }}
				>
					{label}
				</div>
			)}
			{isEmpty && hint && !isHovered && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
					<span
						className={`text-[11px] font-medium ${variant === "zoom" ? "text-indigo-400/30" : "text-white/15"}`}
					>
						{hint}
					</span>
				</div>
			)}
			{/* "+" hover card - hidden when hovering over an existing item */}
			{isHovered && !isOverItem && onAddEffect && (
				<div
					className="absolute top-1/2 -translate-y-1/2 z-30 pointer-events-auto animate-in fade-in zoom-in-90 duration-150"
					style={{ left: `${Math.max(40, mouseX - 28)}px` }}
				>
					<button
						type="button"
						onClick={handleAddClick}
						className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm border border-white/15 text-white/70 hover:text-white hover:bg-white/20 hover:border-white/25 transition-all shadow-lg cursor-pointer"
					>
						<Plus className="w-3 h-3" />
						<span className="text-[10px] font-medium">{addLabel || "Add"}</span>
					</button>
				</div>
			)}
			<div ref={setNodeRef} style={rowStyle}>
				{children}
			</div>
		</div>
	);
}
