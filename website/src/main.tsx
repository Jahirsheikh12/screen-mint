import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis smooth scroll
const lenis = new Lenis({
	duration: 1.2,
	easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
	smoothWheel: true,
	touchMultiplier: 1.5,
});

// Connect Lenis to GSAP ScrollTrigger
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
	lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// Make lenis globally accessible for anchor scrollTo
(window as unknown as { lenis: Lenis }).lenis = lenis;

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
