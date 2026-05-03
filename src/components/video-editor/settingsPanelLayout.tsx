import type React from "react";
import { useTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SettingsSection({
	title,
	description,
	children,
	className,
	accentColor = "amber",
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	accentColor?: "amber" | "blue" | "red";
}) {
	const borderMap = {
		amber: "border-l-amber-500/60",
		blue: "border-l-blue-500/60",
		red: "border-l-red-500/60",
	};

	return (
		<div className={cn("mb-5 last:mb-2", className)}>
			<div className={cn("mb-2 pl-2.5 border-l-2", borderMap[accentColor])}>
				<h3 className="text-[11px] font-semibold text-slate-200 tracking-wide">{title}</h3>
				{description && (
					<p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
				)}
			</div>
			<div className="flex flex-col gap-1.5">{children}</div>
		</div>
	);
}

export function TabContent({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-both",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function TabHeader({
	title,
	description,
	badge,
	badgeColor = "amber",
	trailing,
}: {
	title: string;
	description?: string;
	badge?: string;
	badgeColor?: "amber" | "blue";
	trailing?: React.ReactNode;
}) {
	const badgeColorMap = {
		amber: "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20",
		blue: "text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20",
	};

	return (
		<div className="mb-5 pb-3 border-b border-white/[0.06]">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[13px] font-semibold text-white tracking-tight">{title}</span>
					{badge && (
						<span
							className={cn(
								"text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
								badgeColorMap[badgeColor],
							)}
						>
							{badge}
						</span>
					)}
				</div>
				{trailing}
			</div>
			{description && (
				<p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{description}</p>
			)}
		</div>
	);
}

export function SidebarTabButton({
	icon: Icon,
	label,
	isActive,
	onClick,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	const { triggerRef, onMouseEnter, onMouseLeave } = useTooltip({
		content: label,
		side: "right",
		delayMs: 300,
	});

	return (
		<button
			ref={triggerRef as React.Ref<HTMLButtonElement>}
			type="button"
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			className={cn(
				"relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ease-out group",
				isActive
					? "bg-gradient-to-br from-[#F59E0B] to-[#d97706] text-white shadow-lg shadow-[#F59E0B]/25 scale-105"
					: "text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] hover:scale-105 active:scale-95",
			)}
		>
			<Icon
				className={cn(
					"w-[18px] h-[18px] transition-transform duration-300",
					isActive && "drop-shadow-sm",
				)}
			/>
			{isActive && (
				<div className="absolute inset-0 rounded-lg bg-[#F59E0B]/10 animate-pulse pointer-events-none" />
			)}
		</button>
	);
}
