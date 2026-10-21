import type { RowDefinition } from "dnd-timeline";
import { useRow, useTimelineContext } from "dnd-timeline";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface RowProps extends RowDefinition {
	children: React.ReactNode;
	label?: string;
	hint?: string;
	isEmpty?: boolean;
	labelColor?: string;
	onAddEffect?: (clickTimeMs?: number) => void;
	addLabel?: string;
	variant?: "default" | "clip" | "zoom";
	icon?: LucideIcon;
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
	icon: Icon,
}: RowProps) {
	const { t } = useI18n();
	const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({ id });
	const { sidebarWidth, range, pixelsToValue } = useTimelineContext();
	const iconPadding = sidebarWidth;
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
			? "bg-surface/80 border-b border-line relative group/row backdrop-blur-sm"
			: variant === "clip"
				? "bg-surface/80 border-b border-line relative group/row backdrop-blur-sm"
				: "bg-surface/80 border-b border-line relative group/row backdrop-blur-sm";

	return (
		<div
			ref={rowRef}
			className={bgClass}
			style={{
				...rowWrapperStyle,
				minHeight: variant === "clip" ? 52 : 48,
				marginBottom: 6,
				marginTop: 2,
				paddingLeft: iconPadding,
			}}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onMouseMove={handleMouseMove}
		>
			{Icon && (
				<div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none">
					<div className="w-8 h-8 rounded-full border border-line bg-fill-subtle flex items-center justify-center shadow-sm">
						<Icon className="w-3.5 h-3.5 text-fg-subtle group-hover/row:text-fg-muted transition-colors" />
					</div>
				</div>
			)}
			{label && (
				<div
					className="absolute left-[44px] top-1/2 -translate-y-1/2 text-micro font-medium tracking-wide z-20 pointer-events-none select-none opacity-40 group-hover/row:opacity-70 transition-opacity"
					style={{ color: labelColor }}
				>
					{label}
				</div>
			)}
			{isEmpty && hint && !isHovered && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
					<span
						className={`text-caption font-medium ${variant === "zoom" ? "text-indigo-400/30" : "text-fg-disabled"}`}
					>
						{hint}
					</span>
				</div>
			)}
			{/* "+" hover card - hidden when hovering over an existing item */}
			{isHovered && !isOverItem && onAddEffect && (
				<div
					className="absolute top-1/2 -translate-y-1/2 z-30 pointer-events-auto animate-in fade-in zoom-in-90 duration-150"
					style={{ left: `${Math.max(iconPadding + 8, mouseX - 28)}px` }}
				>
					<button
						type="button"
						onClick={handleAddClick}
						className="flex items-center gap-1 px-2 py-1 rounded-md bg-fill-hover backdrop-blur-sm border border-line-strong text-fg-muted hover:text-fg hover:bg-fill-pressed hover:border-line-strong transition-all shadow-lg cursor-pointer"
					>
						<Plus className="w-3 h-3" />
						<span className="text-micro font-medium">
							{addLabel || t("timeline.items.add", "Add")}
						</span>
					</button>
				</div>
			)}
			<div ref={setNodeRef} style={rowStyle}>
				{children}
			</div>
		</div>
	);
}
