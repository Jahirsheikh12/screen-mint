import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { REPO_URL } from "../lib/links";

/* ─── Rotating keyword in the headline ─── */
const WORDS = ["incredible", "cinematic", "stunning", "polished"];

function useWordCycle(words: string[], interval = 3200) {
	const [idx, setIdx] = useState(0);
	const [phase, setPhase] = useState<"in" | "out">("in");

	useEffect(() => {
		const id = setInterval(() => {
			setPhase("out");
			setTimeout(() => {
				setIdx((i) => (i + 1) % words.length);
				setPhase("in");
			}, 350);
		}, interval);
		return () => clearInterval(id);
	}, [words.length, interval]);

	return { word: words[idx], phase };
}

/* ─── Smooth mouse position (lerped) ─── */
function useSmoothMouse() {
	const pos = useRef({ x: 0, y: 0 });
	const target = useRef({ x: 0, y: 0 });
	const raf = useRef(0);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const onMove = (e: MouseEvent) => {
			target.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
			target.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener("mousemove", onMove);

		const tick = () => {
			pos.current.x += (target.current.x - pos.current.x) * 0.06;
			pos.current.y += (target.current.y - pos.current.y) * 0.06;
			raf.current = requestAnimationFrame(tick);
		};
		raf.current = requestAnimationFrame(tick);

		return () => {
			window.removeEventListener("mousemove", onMove);
			cancelAnimationFrame(raf.current);
		};
	}, []);

	return pos;
}

/* ─── Platform icons ─── */
function PlatformIcons() {
	return (
		<div className="flex items-center gap-3 text-white/20">
			{/* macOS */}
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
			{/* Windows */}
			<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
				<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
			</svg>
			{/* Linux */}
			<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587.26 1.24.43 1.922.512 0 0 .545.07.935-.03.01-.002.02 0 .03-.002a.6.6 0 00.14-.023c.69.14 1.43.14 2.16-.08.18-.055.36-.14.53-.232.17.06.34.1.52.12.7.082 1.47-.07 1.78-.51.27-.375-.08-.93-.49-1.62-.33-.56-.65-1.16-.63-1.77.02-.05.04-.09.06-.13.06-.11.14-.23.23-.35.34-.49.77-.86.87-1.57.06-.37-.02-.8-.22-1.27-.05-.12-.12-.25-.19-.38-.14-.27-.31-.56-.37-.85-.04-.17-.05-.37-.02-.57.11-.74.05-1.55-.27-2.29-.19-.47-.47-.91-.79-1.34-.33-.47-.7-.95-.96-1.46-.26-.51-.44-1.07-.35-1.69.08-.5.03-1.03-.09-1.55C14.36 1.22 13.53 0 12.504 0z" />
			</svg>
		</div>
	);
}

export function Hero() {
	const sectionRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const headlineRef = useRef<HTMLHeadingElement>(null);
	const badgeRef = useRef<HTMLDivElement>(null);
	const subRef = useRef<HTMLParagraphElement>(null);
	const ctaRef = useRef<HTMLDivElement>(null);
	const screenshotWrapRef = useRef<HTMLDivElement>(null);
	const screenshotRef = useRef<HTMLDivElement>(null);
	const auroraRef = useRef<HTMLDivElement>(null);

	const mouse = useSmoothMouse();
	const { word, phase } = useWordCycle(WORDS);

	/* ── 3D tilt on screenshot via requestAnimationFrame ── */
	useEffect(() => {
		if (prefersReducedMotion()) return;
		const el = screenshotRef.current;
		if (!el) return;

		let active = true;
		const tick = () => {
			if (!active) return;
			const mx = mouse.current.x;
			const my = mouse.current.y;
			el.style.transform = `perspective(1200px) rotateY(${mx * 4}deg) rotateX(${my * -3}deg) scale3d(1.01, 1.01, 1)`;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		return () => {
			active = false;
		};
	}, [mouse]);

	/* ── Aurora movement ── */
	useEffect(() => {
		if (prefersReducedMotion()) return;
		const el = auroraRef.current;
		if (!el) return;

		let active = true;
		const tick = () => {
			if (!active) return;
			const mx = mouse.current.x;
			const my = mouse.current.y;
			el.style.transform = `translate(${mx * 40}px, ${my * 25}px)`;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		return () => {
			active = false;
		};
	}, [mouse]);

	/* ── GSAP cinematic entrance ── */
	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			const tl = gsap.timeline({
				defaults: { ease: "power4.out", duration: 1.2 },
			});

			/* Aurora glow */
			tl.fromTo(
				auroraRef.current,
				{ opacity: 0, scale: 0.6 },
				{ opacity: 1, scale: 1, duration: 2.5, ease: "power2.out" },
				0,
			);

			/* Badge drops in */
			tl.fromTo(
				badgeRef.current,
				{ opacity: 0, y: 24, filter: "blur(12px)" },
				{ opacity: 1, y: 0, filter: "blur(0px)", duration: 1 },
				0.3,
			);

			/* Headline words stagger up with 3D rotation */
			if (headlineRef.current) {
				const words = headlineRef.current.querySelectorAll(".hero-word");
				tl.fromTo(
					words,
					{ opacity: 0, y: 60, rotateX: 50 },
					{
						opacity: 1,
						y: 0,
						rotateX: 0,
						duration: 1.2,
						stagger: 0.04,
						ease: "power4.out",
					},
					0.45,
				);
			}

			/* Subtitle */
			tl.fromTo(
				subRef.current,
				{ opacity: 0, y: 20 },
				{ opacity: 1, y: 0, duration: 1 },
				0.9,
			);

			/* CTAs */
			if (ctaRef.current) {
				const buttons = ctaRef.current.children;
				tl.fromTo(
					buttons,
					{ opacity: 0, y: 24 },
					{ opacity: 1, y: 0, duration: 0.9, stagger: 0.1 },
					1.05,
				);
			}

			/* Screenshot — dramatic rise from below */
			tl.fromTo(
				screenshotWrapRef.current,
				{ opacity: 0, y: 180, scale: 0.88 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 1.8,
					ease: "power3.out",
				},
				1.15,
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	/* ── Helper: wrap each word for stagger animation ── */
	function WordSpan({ children }: { children: string }) {
		return (
			<>
				{children.split(" ").map((w, i) => (
					<span
						key={`${w}-${i}`}
						className="hero-word inline-block will-animate"
						style={{ perspective: "600px" }}
					>
						{w}
						{i < children.split(" ").length - 1 ? "\u00A0" : ""}
					</span>
				))}
			</>
		);
	}

	return (
		<section
			ref={sectionRef}
			className="relative min-h-screen flex flex-col items-center px-6 pt-36 pb-20 overflow-hidden"
		>
			{/* ── Background layers ── */}
			<div className="hero-grid absolute inset-0 pointer-events-none" />
			<div className="absolute inset-0 hero-noise pointer-events-none" />

			{/* ── Aurora — dramatic gradient glow ── */}
			<div
				ref={auroraRef}
				className="hero-aurora absolute pointer-events-none"
				style={{ top: "5%", left: "50%", marginLeft: "-500px" }}
			>
				<div className="hero-aurora-core" />
			</div>

			{/* ── Horizontal light beams ── */}
			<div className="hero-beam hero-beam-1 absolute pointer-events-none" />
			<div className="hero-beam hero-beam-2 absolute pointer-events-none" />

			{/* ── Content ── */}
			<div ref={contentRef} className="relative z-10 max-w-[880px] mx-auto text-center">
				{/* Badge */}
				<div ref={badgeRef} className="mb-8 opacity-0">
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="hero-badge group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] text-[12px] text-white/40 tracking-wide backdrop-blur-sm transition-all duration-500"
					>
						<span className="w-1.5 h-1.5 rounded-full bg-brand-500 pulse-ring" />
						Open Source
						<span className="h-3 w-px bg-white/8" />
						<span className="text-brand-400/80 font-medium group-hover:text-brand-300 transition-colors">
							Star on GitHub
						</span>
						<svg
							width="10"
							height="10"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							className="text-white/25 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all duration-300"
						>
							<path d="M3 8h10M9 4l4 4-4 4" />
						</svg>
					</a>
				</div>

				{/* Headline */}
				<h1
					ref={headlineRef}
					className="text-[clamp(3rem,7.5vw,5.75rem)] font-extrabold tracking-[-0.045em] leading-[1.0] mb-6"
				>
					<span className="block">
						<WordSpan>Screen recordings</WordSpan>
					</span>
					<span className="block mt-1">
						<WordSpan>that look </WordSpan>
						<span
							className={`hero-keyword inline-block bg-clip-text text-transparent ${
								phase === "out" ? "hero-keyword-out" : "hero-keyword-in"
							}`}
						>
							{word}
						</span>
					</span>
				</h1>

				{/* Subtitle */}
				<p
					ref={subRef}
					className="text-[16px] md:text-[18px] text-white/30 max-w-[520px] mx-auto mb-10 leading-[1.7] opacity-0"
				>
					Auto-zoom, cursor effects, custom backgrounds &amp; a full timeline
					editor. Record once — polish to perfection.
				</p>

				{/* CTAs */}
				<div ref={ctaRef} className="flex items-center justify-center gap-3.5 flex-wrap">
					<a
						href="#download"
						className="hero-btn-primary group relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-semibold text-[15px] overflow-hidden transition-all duration-500"
					>
						<span className="hero-btn-bg absolute inset-0" />
						<span className="hero-btn-shine absolute inset-0 pointer-events-none" />
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="relative z-10 transition-transform duration-300 group-hover:translate-y-0.5"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						<span className="relative z-10">Download for Free</span>
					</a>

					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="hero-btn-ghost group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full border border-white/[0.07] text-white/45 font-medium text-[15px] transition-all duration-500 hover:border-white/15 hover:text-white/70 hover:bg-white/[0.03]"
					>
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="transition-transform duration-300 group-hover:rotate-[-8deg]"
						>
							<circle cx="12" cy="12" r="10" />
							<polygon points="10 8 16 12 10 16 10 8" />
						</svg>
						See it in action
					</a>
				</div>

				{/* Platform availability */}
				<div className="flex items-center justify-center gap-2 mt-6">
					<PlatformIcons />
					<span className="text-[11px] text-white/15 tracking-wide">
						macOS, Windows &amp; Linux
					</span>
				</div>
			</div>

			{/* ── Screenshot hero image ── */}
			<div
				ref={screenshotWrapRef}
				className="relative z-10 mt-14 w-full max-w-[1080px] mx-auto opacity-0"
			>
				{/* Animated gradient border */}
				<div className="hero-border-glow absolute -inset-px rounded-2xl pointer-events-none z-0" />

				<div
					ref={screenshotRef}
					className="hero-screenshot relative rounded-2xl overflow-hidden border border-white/[0.06] will-change-transform"
					style={{ transformStyle: "preserve-3d" }}
				>
					{/* Window chrome */}
					<div className="flex items-center px-4 py-2.5 bg-[#080808] border-b border-white/[0.04]">
						<div className="flex items-center gap-1.5">
							<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] group-hover:bg-[#ff5f57] transition-colors" />
							<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] group-hover:bg-[#febc2e] transition-colors" />
							<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] group-hover:bg-[#28c840] transition-colors" />
						</div>
						<div className="flex-1 flex justify-center">
							<div className="flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-white/[0.03]">
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-500/50">
									<rect x="2" y="3" width="20" height="14" rx="2" />
									<line x1="8" y1="21" x2="16" y2="21" />
									<line x1="12" y1="17" x2="12" y2="21" />
								</svg>
								<span className="text-[10px] text-white/15 font-mono tracking-wider">
									ScreenMint
								</span>
							</div>
						</div>
						<div className="w-[44px]" />
					</div>

					{/* Image */}
					<img
						src="/images/preview.png"
						alt="ScreenMint editor with timeline, zoom effects, and cursor customization"
						className="w-full h-auto block"
						loading="eager"
					/>

					{/* Gloss overlay */}
					<div className="hero-gloss absolute inset-0 pointer-events-none" />
				</div>

				{/* Bottom fade to black */}
				<div
					className="absolute inset-x-0 bottom-0 h-52 pointer-events-none z-20 rounded-b-2xl"
					style={{
						background: "linear-gradient(to top, #000000 5%, transparent)",
					}}
				/>

				{/* Glow puddle beneath */}
				<div className="hero-glow-puddle absolute -bottom-24 left-1/2 -translate-x-1/2 pointer-events-none" />
			</div>

			{/* ── Scroll cue ── */}
			<div className="hero-scroll-cue absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
				<div className="hero-scroll-mouse">
					<div className="hero-scroll-dot" />
				</div>
			</div>
		</section>
	);
}
