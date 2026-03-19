import { useEffect, useRef } from "react";
import gsap from "gsap";

export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useGSAP(
	callback: () => void,
	deps: React.DependencyList = [],
	scope?: React.RefObject<HTMLElement | null>,
) {
	const ctxRef = useRef<gsap.Context | null>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			callback();
		}, scope?.current ?? undefined);
		ctxRef.current = ctx;

		return () => {
			ctx.revert();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return ctxRef;
}
