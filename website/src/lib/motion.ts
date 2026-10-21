export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fade-up once when a block scrolls into view. Spread onto any `motion.*` element. */
export const reveal = {
	initial: { opacity: 0, y: 16 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, margin: "-60px" },
	transition: { duration: 0.6, ease: EASE_OUT },
} as const;
