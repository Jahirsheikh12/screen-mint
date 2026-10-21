import type React from "react";
import { useTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SettingsSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("mb-6", className)}>
			<div className="mb-2.5 px-0.5">
				<h3 className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.08em] text-fg-subtle">
					{title}
				</h3>
				{description && (
					<p className="mt-1 text-caption leading-relaxed text-fg-subtle">{description}</p>
				)}
			</div>
			<div className="flex flex-col gap-2">{children}</div>
		</section>
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
		amber: "text-accent-fg bg-accent/10",
		blue: "text-info-fg bg-info/10",
	};

	return (
		<div className="mb-4 pb-3 border-b border-line">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<span className="text-title font-semibold text-fg">{title}</span>
					{badge && (
						<span
							className={cn(
								"text-micro uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded",
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
				<p className="mt-1 text-label leading-relaxed text-fg-muted">{description}</p>
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
			aria-label={label}
			aria-pressed={isActive}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			className={cn(
				"relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-fast ease-standard",
				isActive
					? "bg-accent/12 text-accent-fg"
					: "text-fg-subtle hover:bg-fill-hover hover:text-fg",
			)}
		>
			<Icon className="h-[18px] w-[18px]" />
		</button>
	);
}
