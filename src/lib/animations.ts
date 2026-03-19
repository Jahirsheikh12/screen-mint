import gsap from "gsap";
import { useEffect, useRef } from "react";

// Durations
export const DURATION = {
	fast: 0.2,
	normal: 0.35,
	slow: 0.6,
} as const;

// Easings
export const EASE = {
	out: "power2.out",
	inOut: "power3.inOut",
	bounce: "back.out(1.7)",
} as const;

// Check reduced motion preference
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// GSAP hook with automatic cleanup
export function useGSAP(
	callback: (ctx: gsap.Context) => void,
	deps: React.DependencyList = [],
	scope?: React.RefObject<HTMLElement | null>,
) {
	const ctxRef = useRef<gsap.Context | null>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			callback(ctx!);
		}, scope?.current ?? undefined);
		ctxRef.current = ctx;

		return () => {
			ctx.revert();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return ctxRef;
}

// Reusable animation presets
export const animations = {
	fadeIn(target: gsap.TweenTarget, options?: gsap.TweenVars) {
		if (prefersReducedMotion()) return null;
		return gsap.fromTo(
			target,
			{ opacity: 0 },
			{ opacity: 1, duration: DURATION.normal, ease: EASE.out, ...options },
		);
	},

	slideUp(target: gsap.TweenTarget, options?: gsap.TweenVars) {
		if (prefersReducedMotion()) return null;
		return gsap.fromTo(
			target,
			{ opacity: 0, y: 8 },
			{ opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.out, ...options },
		);
	},

	scaleIn(target: gsap.TweenTarget, options?: gsap.TweenVars) {
		if (prefersReducedMotion()) return null;
		return gsap.fromTo(
			target,
			{ opacity: 0, scale: 0.95 },
			{ opacity: 1, scale: 1, duration: DURATION.fast, ease: EASE.out, ...options },
		);
	},

	staggerChildren(
		targets: gsap.TweenTarget,
		options?: gsap.TweenVars & { staggerAmount?: number },
	) {
		if (prefersReducedMotion()) return null;
		const { staggerAmount = 0.05, ...rest } = options ?? {};
		return gsap.fromTo(
			targets,
			{ opacity: 0, y: 8 },
			{
				opacity: 1,
				y: 0,
				duration: DURATION.normal,
				ease: EASE.out,
				stagger: staggerAmount,
				...rest,
			},
		);
	},
};
