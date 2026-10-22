import Lenis from "lenis";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const NAV_OFFSET = -88;

/** Smooth scrolling for everyone except people who asked for reduced motion. */
export const lenis =
	typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
		? new Lenis({ autoRaf: true, lerp: 0.1 })
		: null;

// Same-page #links glide instead of jumping (navbar, hero, footer alike).
if (lenis) {
	document.addEventListener("click", (event) => {
		const link = (event.target as Element | null)?.closest?.("a[href^='#']");
		// The skip link must move keyboard focus natively, not just scroll.
		if (!link || link.hasAttribute("data-skip-link")) return;
		const hash = link.getAttribute("href") ?? "#";
		const target = hash === "#" || hash === "#top" ? 0 : document.querySelector(hash);
		if (target === null) return;
		event.preventDefault();
		// A link in the mobile menu fires while the menu has Lenis stopped; restart it first so
		// the menu closing (which also restarts it) does not cancel this scroll.
		lenis.start();
		lenis.scrollTo(target as HTMLElement | number, { offset: target === 0 ? 0 : NAV_OFFSET });
		history.replaceState(null, "", hash === "#" ? location.pathname + location.search : hash);
	});
}
