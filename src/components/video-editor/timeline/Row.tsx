import type { RowDefinition } from "dnd-timeline";
import { useRow } from "dnd-timeline";
import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface RowProps extends RowDefinition {
	children: React.ReactNode;
	label?: string;
	hint?: string;
	isEmpty?: boolean;
	labelColor?: string;
	onAddEffect?: () => void;
	addLabel?: string;
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
}: RowProps) {
	const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({ id });
	const [isHovered, setIsHovered] = useState(false);
	const [mouseX, setMouseX] = useState(0);
	const rowRef = useRef<HTMLDivElement>(null);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!onAddEffect || !rowRef.current) return;
			const rect = rowRef.current.getBoundingClientRect();
			setMouseX(e.clientX - rect.left);
		},
		[onAddEffect],
	);

	return (
		<div
			ref={rowRef}
			className="border-b border-[#18181b] bg-[#18181b] relative group/row"
			style={{ ...rowWrapperStyle, minHeight: 48, marginBottom: 4 }}
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
					<span className="text-[11px] text-white/15 font-medium">{hint}</span>
				</div>
			)}
			{/* "+" hover card */}
			{isHovered && onAddEffect && (
				<div
					className="absolute top-1/2 -translate-y-1/2 z-30 pointer-events-auto animate-in fade-in zoom-in-90 duration-150"
					style={{ left: `${Math.max(40, mouseX - 28)}px` }}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onAddEffect();
						}}
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
