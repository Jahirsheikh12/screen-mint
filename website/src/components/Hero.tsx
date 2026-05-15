import gsap from "gsap";
import { Download, Heart, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { REPO_URL } from "../lib/links";
import { GITHUB_SPONSORS_URL } from "../lib/sponsors";
import { PixelWave } from "./PixelWave";
import { Badge } from "./ui/badge";

const WORDS = ["incredible", "cinematic", "stunning", "polished"];
const CYCLE_MS = 3000;

function PlatformIcons() {
	return (
		<div className="flex items-center gap-3 text-white/20 transition-colors duration-500 group-hover/plat:text-white/35">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
				<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
			</svg>
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

	const handleScreenshotMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (prefersReducedMotion()) return;
		const wrap = screenshotWrapRef.current;
		if (!wrap) return;
		tiltActive.current = true;

		const rect = wrap.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width - 0.5;
		const y = (e.clientY - rect.top) / rect.height - 0.5;

		gsap.to(wrap, {
			rotateY: x * 8, // Increased tilt
			rotateX: -y * 6 + 2, // Increased tilt
			duration: 0.6,
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
			duration: 1.2,
			ease: "elastic.out(1, 0.4)",
			overwrite: "auto",
		});
	}, []);

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

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

			tl.fromTo(gridRef.current, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out" }, 0);
			tl.fromTo(glowRef.current, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.6, ease: "power2.out" }, 0);

			tl.fromTo(badgeRef.current, { opacity: 0, y: 16, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7 }, 0.25);

			tl.fromTo(line1Ref.current, { y: "105%" }, { y: "0%", duration: 0.9 }, 0.45);
			tl.fromTo(line2Ref.current, { y: "105%" }, { y: "0%", duration: 0.9 }, 0.6);

			tl.fromTo(wordRef.current, { y: "110%", opacity: 0 }, { y: "0%", opacity: 1, duration: 0.7, ease: "power3.out" }, 0.8);

			tl.fromTo(subRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 1.0);

			if (ctaRef.current) {
				tl.fromTo(ctaRef.current.children, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 1.05);
			}

			tl.fromTo(platformRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.15);

			tl.fromTo(
				screenshotWrapRef.current,
				{ opacity: 0, y: 160, scale: 0.85 },
				{ opacity: 1, y: 0, scale: 1, duration: 1.4, ease: "power3.out" },
				1.4,
			);

			tl.call(() => { borderWrapRef.current?.classList.add("active"); }, [], 1.6);

			const floats = [floatRecRef.current, floatZoomRef.current, floatTimelineRef.current].filter(Boolean);
			if (floats.length > 0) {
				tl.fromTo(
					floats,
					{ opacity: 0, y: 20, scale: 0.9 },
					{ opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
					1.8,
				);
			}

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
		<section ref={sectionRef} className="relative min-h-screen flex flex-col items-center px-6 pt-36 pb-20 overflow-x-clip bg-black">
			{/* ── Background ── */}
			<PixelWave ref={gridRef} className="absolute inset-0 pointer-events-none opacity-0" />
			<div className="hero-noise absolute inset-0 pointer-events-none" />
			<div ref={glowRef} className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none opacity-0" />

			{/* ── Content ── */}
			<div ref={contentRef} className="relative z-10 max-w-[1000px] mx-auto text-center">
				{/* Badge */}
				<div ref={badgeRef} className="mb-10 opacity-0 flex justify-center">
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="group relative flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 text-[13px] text-white/50 tracking-wide shadow-2xl transition-all duration-300 hover:bg-[#111]/90 hover:border-brand-500/30 hover:text-white/80"
					>
						<Badge className="relative flex h-2 w-2 rounded-full border-0 bg-transparent p-0 shadow-none">
							<span className="animate-ping absolute inset-0 rounded-full bg-brand-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
						</Badge>
						<span className="font-medium">Open Source</span>
						<span className="h-4 w-px bg-white/[0.08]" />
						<span className="text-brand-400/90 font-semibold group-hover:text-brand-400 transition-colors duration-300 flex items-center gap-1.5">
							Star on GitHub
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand-400/60 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all duration-300">
								<path d="M3 8h10M9 4l4 4-4 4" />
							</svg>
						</span>
					</a>
				</div>

				{/* Headline */}
				<h1 className="hero-headline text-[56px] md:text-[80px] lg:text-[96px] font-bold tracking-[-0.04em] leading-[1.05] mb-8 drop-shadow-2xl">
					<span className="block overflow-hidden pb-[0.2em] -mb-[0.2em]">
						<span ref={line1Ref} className="block will-change-transform text-white/95">
							Screen recordings
						</span>
					</span>
					<span className="block overflow-hidden mt-2 pb-[0.2em] -mb-[0.2em]">
						<span ref={line2Ref} className="block will-change-transform">
							<span className="text-white/40 font-semibold tracking-[-0.02em]">that look</span>{" "}
							<span className="hero-keyword-slot relative inline-block text-brand-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
								<span ref={wordRef} className="hero-keyword block">
									{WORDS[wordIdx]}
								</span>
							</span>
						</span>
					</span>
				</h1>

				{/* Subtitle */}
				<p ref={subRef} className="text-[17px] md:text-[20px] text-white/40 leading-relaxed font-medium mx-auto max-w-[640px] mb-12 opacity-0 drop-shadow-md">
					Auto-zoom, cursor effects, custom backgrounds &amp; a full timeline editor.
					<br className="hidden sm:block" />
					Record once — polish to perfection.
				</p>

				{/* CTAs */}
				<div ref={ctaRef} className="flex items-center justify-center gap-4 flex-wrap">
					<a
						ref={primaryBtnRef}
						href="#download"
						onMouseMove={handleBtnMouseMove}
						onMouseLeave={handleBtnMouseLeave}
						className="group relative flex items-center justify-center gap-2.5 px-8 py-4 bg-brand-500 rounded-full text-white font-semibold text-[16px] tracking-wide shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)] transition-all duration-300 hover:shadow-[0_0_60px_-10px_rgba(245,158,11,0.7)] hover:bg-brand-400"
					>
						<span className="absolute inset-0 rounded-full border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] pointer-events-none" />
						<Download className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={2.5} />
						<span className="relative z-10">Download for Free</span>
					</a>

					<a 
                        href={GITHUB_SPONSORS_URL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-white/70 font-semibold text-[16px] transition-all duration-300 hover:bg-white/[0.08] hover:text-white"
                    >
						<Heart className="w-5 h-5 transition-all duration-300 group-hover:text-pink-500 group-hover:scale-110" strokeWidth={2} />
						Sponsor
					</a>
				</div>

				{/* Platform availability */}
				<div ref={platformRef} className="flex items-center justify-center gap-3 mt-8 opacity-0 group/plat">
					<PlatformIcons />
					<span className="text-[12px] text-white/20 tracking-widest font-semibold uppercase">
						macOS &middot; Windows &middot; Linux
					</span>
				</div>
			</div>

			{/* ── Screenshot Stage ── */}
			<div
				className="hero-screenshot-wrap relative z-10 mt-24 w-full max-w-[1200px] mx-auto opacity-0"
				ref={screenshotWrapRef}
				onMouseMove={handleScreenshotMouseMove}
				onMouseLeave={handleScreenshotMouseLeave}
				style={{ transformStyle: "preserve-3d", transform: "rotateX(2deg)" }}
			>
				{/* Glow behind screenshot */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-brand-500/10 blur-[140px] rounded-full pointer-events-none" />

				{/* Floating UI elements */}
				<div ref={floatRecRef} className="hero-float hero-float--rec opacity-0 absolute -top-8 -left-8 z-20 flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
					<span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
					<span className="font-mono text-[13px] tracking-widest text-red-400 font-bold">REC</span>
					<span className="font-mono text-[13px] tracking-widest text-white/50">00:42</span>
				</div>
				<div ref={floatZoomRef} className="hero-float hero-float--zoom opacity-0 absolute top-[15%] -right-10 z-20 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
					<div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-500/20 text-brand-400">
                        <MousePointer2 className="w-4 h-4" strokeWidth={2.5} />
                    </div>
					<span className="text-[14px] font-semibold text-white/90">Auto-zoom</span>
				</div>
				<div ref={floatTimelineRef} className="hero-float hero-float--timeline opacity-0 absolute bottom-12 -left-12 z-20 flex flex-col gap-2 p-4 rounded-2xl bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <span className="text-[11px] font-bold tracking-widest text-white/40 uppercase mb-1">Timeline</span>
					<div className="flex items-center gap-1.5">
						<div className="w-12 h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
						<div className="w-8 h-1.5 rounded-full bg-orange-400/80" />
						<div className="w-10 h-1.5 rounded-full bg-amber-300/60" />
					</div>
				</div>

				{/* Animated border beam wrapper */}
				<div ref={borderWrapRef} className="hero-border-wrap relative rounded-2xl p-[1px] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/20 to-white/5 rounded-2xl" />
					<div className="hero-border-inner relative bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
						<div className="hero-screenshot relative">
							{/* Window chrome - macOS style */}
							<div className="flex items-center justify-between px-4 h-12 bg-[#111]/90 backdrop-blur-md border-b border-white/[0.05]">
								<div className="flex items-center gap-2">
									<span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] shadow-sm" />
									<span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] shadow-sm" />
									<span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] shadow-sm" />
								</div>
								<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/40">
										<rect x="2" y="3" width="20" height="14" rx="2" />
										<line x1="8" y1="21" x2="16" y2="21" />
										<line x1="12" y1="17" x2="12" y2="21" />
									</svg>
									<span className="text-[11px] text-white/50 font-semibold tracking-wide">ScreenMint</span>
								</div>
								<div className="w-14" />
							</div>

							{/* Image */}
							<img
								src="/images/preview.png"
								alt="ScreenMint editor with timeline, zoom effects, and cursor customization"
								className="w-full h-auto block"
								loading="eager"
							/>

							{/* Gloss overlay */}
							<div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none mix-blend-overlay" />
						</div>
					</div>
				</div>

				{/* Bottom fade into background */}
				<div className="absolute -bottom-px left-0 w-full h-32 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
			</div>
		</section>
	);
}
