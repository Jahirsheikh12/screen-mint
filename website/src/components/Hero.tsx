import gsap from "gsap";
import { Download, Heart, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { REPO_URL } from "../lib/links";
import { GITHUB_SPONSORS_URL } from "../lib/sponsors";
import { PixelWave } from "./PixelWave";

const WORDS = ["incredible", "cinematic", "stunning", "polished"];
const CYCLE_MS = 3000;

/* ─── Platform availability icons ─── */
function PlatformIcons() {
	return (
		<div className="flex items-center gap-3 text-white/20 transition-colors duration-500 group-hover/plat:text-white/35">
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
	const badgeRef = useRef<HTMLDivElement>(null);
	const line1Ref = useRef<HTMLSpanElement>(null);
	const line2Ref = useRef<HTMLSpanElement>(null);
	const wordRef = useRef<HTMLSpanElement>(null);
	const subRef = useRef<HTMLParagraphElement>(null);
	const ctaRef = useRef<HTMLDivElement>(null);
	const platformRef = useRef<HTMLDivElement>(null);
	const screenshotWrapRef = useRef<HTMLDivElement>(null);
	const borderWrapRef = useRef<HTMLDivElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const floatRecRef = useRef<HTMLDivElement>(null);
	const floatZoomRef = useRef<HTMLDivElement>(null);
	const floatTimelineRef = useRef<HTMLDivElement>(null);
	const primaryBtnRef = useRef<HTMLAnchorElement>(null);

	const [wordIdx, setWordIdx] = useState(0);
	const cycling = useRef(false);
	const tiltActive = useRef(false);

	/* ── Word rotation: clean vertical slide ── */
	const cycleWord = useCallback(() => {
		if (!wordRef.current || cycling.current || prefersReducedMotion()) return;
		cycling.current = true;

		const el = wordRef.current;
		gsap.to(el, {
			y: "-110%",
			opacity: 0,
			duration: 0.35,
			ease: "power3.in",
			onComplete: () => {
				setWordIdx((i) => (i + 1) % WORDS.length);
				gsap.set(el, { y: "110%" });
				gsap.to(el, {
					y: "0%",
					opacity: 1,
					duration: 0.45,
					ease: "power3.out",
					onComplete: () => {
						cycling.current = false;
					},
				});
			},
		});
	}, []);

	useEffect(() => {
		if (prefersReducedMotion()) return;
		const id = setInterval(cycleWord, CYCLE_MS);
		return () => clearInterval(id);
	}, [cycleWord]);

	/* ── Screenshot 3D tilt on mouse move ── */
	const handleScreenshotMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (prefersReducedMotion()) return;
		const wrap = screenshotWrapRef.current;
		if (!wrap) return;
		tiltActive.current = true;

		const rect = wrap.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
		const y = (e.clientY - rect.top) / rect.height - 0.5;

		gsap.to(wrap, {
			rotateY: x * 6,
			rotateX: -y * 4 + 2,
			duration: 0.4,
			ease: "power2.out",
			overwrite: "auto",
		});
	}, []);

	const handleScreenshotMouseLeave = useCallback(() => {
		if (!tiltActive.current) return;
		tiltActive.current = false;
		const wrap = screenshotWrapRef.current;
		if (!wrap) return;

		gsap.to(wrap, {
			rotateY: 0,
			rotateX: 2,
			duration: 0.8,
			ease: "elastic.out(1, 0.5)",
			overwrite: "auto",
		});
	}, []);

	/* ── Magnetic CTA button ── */
	const handleBtnMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		if (prefersReducedMotion()) return;
		const btn = primaryBtnRef.current;
		if (!btn) return;

		const rect = btn.getBoundingClientRect();
		const x = e.clientX - rect.left - rect.width / 2;
		const y = e.clientY - rect.top - rect.height / 2;

		gsap.to(btn, {
			x: x * 0.15,
			y: y * 0.15,
			scale: 1.03,
			duration: 0.3,
			ease: "power2.out",
			overwrite: "auto",
		});
	}, []);

	const handleBtnMouseLeave = useCallback(() => {
		const btn = primaryBtnRef.current;
		if (!btn) return;

		gsap.to(btn, {
			x: 0,
			y: 0,
			scale: 1,
			duration: 0.5,
			ease: "elastic.out(1, 0.6)",
			overwrite: "auto",
		});
	}, []);

	/* ── GSAP entrance choreography ── */
	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

			/* Grid + glow fade in */
			tl.fromTo(
				gridRef.current,
				{ opacity: 0 },
				{ opacity: 1, duration: 1.2, ease: "power2.out" },
				0,
			);
			tl.fromTo(
				glowRef.current,
				{ opacity: 0, scale: 0.7 },
				{ opacity: 1, scale: 1, duration: 1.6, ease: "power2.out" },
				0,
			);

			/* Badge */
			tl.fromTo(
				badgeRef.current,
				{ opacity: 0, y: 16, filter: "blur(6px)" },
				{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7 },
				0.25,
			);

			/* Headline line 1: clip reveal from bottom */
			tl.fromTo(line1Ref.current, { y: "105%" }, { y: "0%", duration: 0.9 }, 0.45);

			/* Headline line 2: clip reveal from bottom */
			tl.fromTo(line2Ref.current, { y: "105%" }, { y: "0%", duration: 0.9 }, 0.6);

			/* Keyword */
			tl.fromTo(
				wordRef.current,
				{ y: "110%", opacity: 0 },
				{ y: "0%", opacity: 1, duration: 0.7, ease: "power3.out" },
				0.8,
			);

			/* Subtitle */
			tl.fromTo(subRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 1.0);

			/* CTAs */
			if (ctaRef.current) {
				tl.fromTo(
					ctaRef.current.children,
					{ opacity: 0, y: 16 },
					{ opacity: 1, y: 0, duration: 0.6, stagger: 0.08 },
					1.05,
				);
			}

			/* Platform icons */
			tl.fromTo(platformRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.15);

			/* Screenshot — dramatic entrance */
			tl.fromTo(
				screenshotWrapRef.current,
				{ opacity: 0, y: 160, scale: 0.85 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 1.4,
					ease: "power3.out",
				},
				1.4,
			);

			/* Border beam ignition */
			tl.call(
				() => {
					borderWrapRef.current?.classList.add("active");
				},
				[],
				1.6,
			);

			/* Floating elements stagger in */
			const floats = [floatRecRef.current, floatZoomRef.current, floatTimelineRef.current].filter(
				Boolean,
			);
			if (floats.length > 0) {
				tl.fromTo(
					floats,
					{ opacity: 0, y: 20, scale: 0.9 },
					{
						opacity: 1,
						y: 0,
						scale: 1,
						duration: 0.6,
						stagger: 0.1,
						ease: "power3.out",
					},
					1.8,
				);
			}

			/* ── Scroll parallax ──
			 * Both triggers start at the very top of the section and use an
			 * instant scrub. This avoids two problems:
			 *   1. A "delayed start" trigger (e.g. "30% top") + scrub lerp causes
			 *      the screenshot to suddenly snap to a new y when the trigger
			 *      first engages, leaving a visible gap above the image.
			 *   2. `scrub: <number>` on top of Lenis smooth-scroll double-eases
			 *      and feels jittery. Lenis already smooths the scroll value, so
			 *      `scrub: true` (instant) tracks cleanly.
			 * `immediateRender: false` keeps the entrance timeline's y/scale
			 * baseline intact — the parallax tween only takes over once it
			 * actually receives a scroll update.
			 */
			gsap.to(contentRef.current, {
				y: -120,
				opacity: 0,
				scale: 0.97,
				ease: "none",
				immediateRender: false,
				scrollTrigger: {
					trigger: sectionRef.current,
					start: "top top",
					end: "50% top",
					scrub: true,
				},
			});

			gsap.to(screenshotWrapRef.current, {
				yPercent: -8,
				ease: "none",
				immediateRender: false,
				scrollTrigger: {
					trigger: sectionRef.current,
					start: "top top",
					end: "bottom top",
					scrub: true,
				},
			});

		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			className="relative min-h-screen flex flex-col items-center px-6 pt-36 pb-20 overflow-x-clip"
		>
			{/* ── Background ── */}

			{/* Animated pixel wave */}
			<PixelWave ref={gridRef} className="absolute inset-0 pointer-events-none opacity-0" />

			{/* Noise grain */}
			<div className="hero-noise absolute inset-0 pointer-events-none" />

			{/* Central glow */}
			<div ref={glowRef} className="hero-glow absolute pointer-events-none opacity-0" />

			{/* ── Content ── */}
			<div ref={contentRef} className="relative z-10 max-w-[900px] mx-auto text-center">
				{/* Badge */}
				<div ref={badgeRef} className="mb-8 opacity-0">
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="hero-badge group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.03] text-[12px] text-white/40 tracking-wide backdrop-blur-sm"
					>
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inset-0 rounded-full bg-brand-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
						</span>
						Open Source
						<span className="h-3.5 w-px bg-white/[0.08]" />
						<span className="text-brand-400/80 font-medium group-hover:text-brand-300 transition-colors duration-300">
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
							className="text-white/20 group-hover:text-white/45 group-hover:translate-x-0.5 transition-all duration-300"
						>
							<path d="M3 8h10M9 4l4 4-4 4" />
						</svg>
					</a>
				</div>

				{/* Headline */}
				<h1 className="hero-headline mb-7">
					{/* Line 1 */}
					<span className="block overflow-hidden">
						<span ref={line1Ref} className="block will-change-transform">
							Screen recordings
						</span>
					</span>
					{/* Line 2 with rotating keyword */}
					<span className="block overflow-hidden mt-1">
						<span ref={line2Ref} className="block will-change-transform">
							<span className="hero-text-dim">that look</span>{" "}
							<span className="hero-keyword-slot">
								<span ref={wordRef} className="hero-keyword">
									{WORDS[wordIdx]}
								</span>
							</span>
						</span>
					</span>
				</h1>

				{/* Subtitle */}
				<p ref={subRef} className="hero-sub mx-auto mb-10 opacity-0">
					Auto-zoom, cursor effects, custom backgrounds &amp; a full timeline editor.
					<br className="hidden sm:block" />
					Record once — polish to perfection.
				</p>

				{/* CTAs */}
				<div ref={ctaRef} className="flex items-center justify-center gap-3.5 flex-wrap">
					<a
						ref={primaryBtnRef}
						href="#download"
						className="hero-btn-primary group"
						onMouseMove={handleBtnMouseMove}
						onMouseLeave={handleBtnMouseLeave}
					>
						<span className="hero-btn-bg" />
						<span className="hero-btn-shine" />
						<Download
							className="relative z-10 w-[15px] h-[15px] transition-transform duration-300 group-hover:translate-y-0.5"
							strokeWidth={2.5}
						/>
						<span className="relative z-10">Download for Free</span>
					</a>

					<a
						href={GITHUB_SPONSORS_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="hero-btn-ghost group"
					>
						<Heart
							className="w-4 h-4 transition-all duration-300 group-hover:text-brand-400/80 group-hover:scale-110"
							strokeWidth={2}
						/>
						Sponsor
					</a>
				</div>

				{/* Platform availability */}
				<div
					ref={platformRef}
					className="flex items-center justify-center gap-2.5 mt-7 opacity-0 group/plat"
				>
					<PlatformIcons />
					<span className="text-[11px] text-white/15 tracking-wider font-medium">
						macOS &middot; Windows &middot; Linux
					</span>
				</div>
			</div>

			{/* ── Screenshot Stage ── */}
			<div
				className="hero-screenshot-wrap relative z-10 mt-20 w-full max-w-[1100px] mx-auto opacity-0"
				ref={screenshotWrapRef}
				onMouseMove={handleScreenshotMouseMove}
				onMouseLeave={handleScreenshotMouseLeave}
				style={{ transformStyle: "preserve-3d", transform: "rotateX(2deg)" }}
			>
				{/* Glow behind screenshot */}
				<div className="hero-screenshot-glow" />

				{/* Floating UI elements */}
				<div ref={floatRecRef} className="hero-float hero-float--rec opacity-0">
					<span className="hero-rec-dot" />
					<span className="font-mono text-[11px] tracking-wider text-red-400/80">REC</span>
					<span className="font-mono text-[11px] tracking-wider text-white/30">00:42</span>
				</div>
				<div ref={floatZoomRef} className="hero-float hero-float--zoom opacity-0">
					<MousePointer2 className="w-3.5 h-3.5 text-brand-400/70" strokeWidth={2} />
					<span className="text-white/45">Auto-zoom</span>
				</div>
				<div ref={floatTimelineRef} className="hero-float hero-float--timeline opacity-0">
					<div className="flex items-center gap-1">
						<div className="hero-mini-bar w-8 bg-brand-500/60" />
						<div className="hero-mini-bar w-5 bg-orange-400/50" />
						<div className="hero-mini-bar w-6 bg-amber-300/40" />
					</div>
					<span className="text-white/35 text-[11px]">Timeline</span>
				</div>

				{/* Animated border beam wrapper */}
				<div ref={borderWrapRef} className="hero-border-wrap">
					<div className="hero-border-inner">
						<div className="hero-screenshot">
							{/* Window chrome */}
							<div className="hero-chrome">
								<div className="flex items-center gap-[6px]">
									<span className="w-[10px] h-[10px] rounded-full bg-white/[0.07]" />
									<span className="w-[10px] h-[10px] rounded-full bg-white/[0.07]" />
									<span className="w-[10px] h-[10px] rounded-full bg-white/[0.07]" />
								</div>
								<div className="flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-white/[0.04]">
									<svg
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										className="text-brand-500/40"
									>
										<rect x="2" y="3" width="20" height="14" rx="2" />
										<line x1="8" y1="21" x2="16" y2="21" />
										<line x1="12" y1="17" x2="12" y2="21" />
									</svg>
									<span className="text-[10px] text-white/[0.12] font-mono tracking-widest">
										ScreenMint
									</span>
								</div>
								<div className="w-[52px]" />
							</div>

							{/* Image */}
							<img
								src="/images/preview.png"
								alt="ScreenMint editor with timeline, zoom effects, and cursor customization"
								className="w-full h-auto block"
								loading="eager"
							/>

							{/* Gloss overlay */}
							<div className="hero-gloss" />
						</div>
					</div>
				</div>

				{/* Bottom fade into background */}
				<div className="hero-screenshot-fade" />
			</div>
		</section>
	);
}
