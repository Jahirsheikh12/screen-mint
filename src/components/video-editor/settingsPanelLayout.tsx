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
	return (
		<div
			className={cn(
				"mb-6 relative rounded-xl border border-line-strong bg-sunken p-4 pt-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md overflow-hidden",
				className,
			)}
		>
			<div
				className={cn(
					"absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r to-transparent opacity-60",
					accentColor === "amber" && "from-accent",
					accentColor === "blue" && "from-info",
					accentColor === "red" && "from-danger",
				)}
			/>
			<div className="mb-4 pl-1">
				<h3 className="text-caption font-bold uppercase tracking-[0.15em] text-fg-muted flex items-center gap-2">
					{title}
				</h3>
				{description && (
					<p className="text-micro text-fg-subtle mt-1.5 leading-relaxed font-medium">
						{description}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-3">{children}</div>
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

export function DisabledSettingsGroup({
	disabled,
	children,
	className,
}: {
	disabled: boolean;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			aria-disabled={disabled}
			className={cn(disabled && "pointer-events-none select-none opacity-45", className)}
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
		amber: "text-accent-fg bg-accent/10 border border-accent/20",
		blue: "text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20",
	};

	return (
		<div className="mb-6 pb-4 border-b border-line relative">
			<div className="absolute bottom-0 left-0 w-1/3 h-[1px] bg-gradient-to-r from-accent/50 to-transparent" />
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<span className="text-title font-bold text-fg tracking-tight">{title}</span>
					{badge && (
						<span
							className={cn(
								"text-micro uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
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
				<p className="text-label text-fg-muted mt-1.5 leading-relaxed font-medium">{description}</p>
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
				"relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ease-out group",
				isActive
					? "bg-accent/10 text-accent-fg shadow-[inset_0_0_12px_rgba(245,158,11,0.2)] border border-accent/20"
					: "text-fg-muted hover:text-fg hover:bg-fill-subtle border border-transparent",
			)}
		>
			<Icon
				className={cn(
					"w-5 h-5 transition-transform duration-300",
					isActive && "scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]",
				)}
			/>
		</button>
	);
}
