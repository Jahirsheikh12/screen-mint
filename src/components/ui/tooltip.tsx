import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
	content: ReactNode;
	/** Keyboard shortcut hint shown in a dimmer style */
	shortcut?: string;
	side?: TooltipSide;
	/** Delay in ms before showing (default: 400) */
	delayMs?: number;
	children: ReactNode;
	className?: string;
}

// ── Singleton state: only one tooltip visible at a time ──
let activeTooltipEl: HTMLDivElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeOwner: object | null = null;

function getHiddenTransform(side: TooltipSide): string {
	switch (side) {
		case "top":
			return "translateX(-50%) translateY(-2px)";
		case "bottom":
			return "translateX(-50%) translateY(2px)";
		case "left":
			return "translateX(-2px) translateY(-50%)";
		case "right":
			return "translateX(2px) translateY(-50%)";
	}
}

function getVisibleTransform(side: TooltipSide): string {
	switch (side) {
		case "top":
		case "bottom":
			return "translateX(-50%) translateY(0)";
		case "left":
		case "right":
			return "translateX(0) translateY(-50%)";
	}
}

function getArrowStyle(side: TooltipSide): string {
	const base = [
		"position:absolute",
		"width:8px",
		"height:8px",
		"background:rgb(var(--raised))",
		"border:1px solid var(--line-strong)",
		"transform:rotate(45deg)",
	];
	switch (side) {
		case "top":
			base.push(
				"bottom:-4px",
				"left:50%",
				"margin-left:-4px",
				"border-left:none",
				"border-top:none",
			);
			break;
		case "bottom":
			base.push(
				"top:-4px",
				"left:50%",
				"margin-left:-4px",
				"border-right:none",
				"border-bottom:none",
			);
			break;
		case "left":
			base.push(
				"right:-4px",
				"top:50%",
				"margin-top:-4px",
				"border-left:none",
				"border-bottom:none",
			);
			break;
		case "right":
			base.push("left:-4px", "top:50%", "margin-top:-4px", "border-right:none", "border-top:none");
			break;
	}
	return base.join(";");
}

function dismissActiveTooltip() {
	if (activeTimer) {
		clearTimeout(activeTimer);
		activeTimer = null;
	}
	if (activeTooltipEl) {
		const s = (activeTooltipEl.dataset.side as TooltipSide) ?? "top";
		activeTooltipEl.style.opacity = "0";
		activeTooltipEl.style.transform = getHiddenTransform(s);
		const el = activeTooltipEl;
		setTimeout(() => el.remove(), 120);
		activeTooltipEl = null;
	}
	activeOwner = null;
}

interface TooltipHandlerOptions {
	content: ReactNode;
	shortcut?: string;
	side: TooltipSide;
	delayMs: number;
	triggerRef: React.RefObject<HTMLElement | null>;
}

function useTooltipHandlers({
	content,
	shortcut,
	side,
	delayMs,
	triggerRef,
}: TooltipHandlerOptions) {
	const ownerRef = useRef({});

	const show = useCallback(() => {
		dismissActiveTooltip();

		activeOwner = ownerRef.current;
		activeTimer = setTimeout(() => {
			const trigger = triggerRef.current;
			if (!trigger || activeOwner !== ownerRef.current) return;

			const rect = trigger.getBoundingClientRect();

			const el = document.createElement("div");
			el.dataset.side = side;
			el.style.cssText = [
				"position:fixed",
				"z-index:99999",
				"pointer-events:none",
				"opacity:0",
				`transform:${getHiddenTransform(side)}`,
				"transition:opacity 120ms ease-out, transform 120ms ease-out",
			].join(";");

			const pill = document.createElement("div");
			pill.style.cssText = [
				"display:inline-flex",
				"align-items:center",
				"gap:6px",
				"white-space:nowrap",
				"border-radius:6px",
				"background:rgb(var(--raised) / 0.97)",
				"backdrop-filter:blur(12px)",
				"-webkit-backdrop-filter:blur(12px)",
				"border:1px solid var(--line)",
				"padding:4px 10px",
				"box-shadow:var(--shadow-popover)",
				"font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
			].join(";");

			const label = document.createElement("span");
			label.style.cssText =
				"font-size:12px;font-weight:500;color:rgb(var(--fg));line-height:1.3;letter-spacing:-0.01em";
			label.textContent = typeof content === "string" ? content : "";
			pill.appendChild(label);

			if (shortcut) {
				const badge = document.createElement("span");
				badge.style.cssText = [
					"font-size:10px",
					"font-weight:500",
					"font-family:SF Mono,ui-monospace,monospace",
					"color:rgb(var(--fg-subtle))",
					"background:var(--fill-hover)",
					"border-radius:3px",
					"padding:1px 5px",
					"line-height:1.4",
				].join(";");
				badge.textContent = shortcut;
				pill.appendChild(badge);
			}

			el.appendChild(pill);

			const arrow = document.createElement("div");
			arrow.style.cssText = getArrowStyle(side);
			el.appendChild(arrow);

			document.body.appendChild(el);

			const tooltipRect = el.getBoundingClientRect();
			let x: number;
			let y: number;

			switch (side) {
				case "top":
					x = rect.left + rect.width / 2;
					y = rect.top - tooltipRect.height - 6;
					break;
				case "bottom":
					x = rect.left + rect.width / 2;
					y = rect.bottom + 6;
					break;
				case "left":
					x = rect.left - tooltipRect.width - 6;
					y = rect.top + rect.height / 2;
					break;
				case "right":
					x = rect.right + 6;
					y = rect.top + rect.height / 2;
					break;
			}

			if (side === "top" || side === "bottom") {
				const actualLeft = Math.max(
					tooltipRect.width / 2 + 4,
					Math.min(x, window.innerWidth - tooltipRect.width / 2 - 4),
				);
				el.style.left = `${actualLeft}px`;
				el.style.top = `${Math.max(4, y)}px`;
				if (actualLeft !== x) {
					arrow.style.marginLeft = `calc(-4px + ${x - actualLeft}px)`;
				}
			} else {
				const actualTop = Math.max(
					tooltipRect.height / 2 + 4,
					Math.min(y, window.innerHeight - tooltipRect.height / 2 - 4),
				);
				el.style.left = `${Math.max(4, x)}px`;
				el.style.top = `${actualTop}px`;
				if (actualTop !== y) {
					arrow.style.marginTop = `calc(-4px + ${y - actualTop}px)`;
				}
			}

			requestAnimationFrame(() => {
				el.style.opacity = "1";
				el.style.transform = getVisibleTransform(side);
			});

			activeTooltipEl = el;
			activeTimer = null;
		}, delayMs);
	}, [delayMs, side, content, shortcut, triggerRef]);

	const hide = useCallback(() => {
		if (activeOwner === ownerRef.current) {
			dismissActiveTooltip();
		}
	}, []);

	useEffect(() => {
		return () => {
			if (activeOwner === ownerRef.current) {
				dismissActiveTooltip();
			}
		};
	}, []);

	return { show, hide, ownerRef };
}

/**
 * Hook for adding tooltip behavior to any element without a wrapper div.
 * Returns onMouseEnter/onMouseLeave handlers and a ref to attach to the element.
 */
export function useTooltip({
	content,
	shortcut,
	side = "top",
	delayMs = 400,
}: {
	content: ReactNode;
	shortcut?: string;
	side?: TooltipSide;
	delayMs?: number;
}) {
	const triggerRef = useRef<HTMLElement>(null);
	const { show, hide } = useTooltipHandlers({ content, shortcut, side, delayMs, triggerRef });
	return { triggerRef, onMouseEnter: show, onMouseLeave: hide };
}

/**
 * Lightweight tooltip with singleton pattern — only one tooltip
 * can be visible at a time. Uses direct DOM manipulation to
 * avoid re-render flicker.
 *
 * Style: macOS-native-inspired dark tooltip with arrow caret.
 */
export function Tooltip({
	content,
	shortcut,
	side = "top",
	delayMs = 400,
	children,
	className,
}: TooltipProps) {
	const triggerRef = useRef<HTMLDivElement>(null);
	const { show, hide } = useTooltipHandlers({ content, shortcut, side, delayMs, triggerRef });

	return (
		<div
			ref={triggerRef}
			className={cn("inline-flex", className)}
			onMouseEnter={show}
			onMouseLeave={hide}
		>
			{children}
		</div>
	);
}
