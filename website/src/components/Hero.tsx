import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

export function Hero() {
	const sectionRef = useRef<HTMLElement>(null);
	const headlineRef = useRef<HTMLHeadingElement>(null);
	const badgeRef = useRef<HTMLDivElement>(null);
	const subRef = useRef<HTMLParagraphElement>(null);
	const ctaRef = useRef<HTMLDivElement>(null);
	const screenshotRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

			tl.fromTo(
				badgeRef.current,
				{ opacity: 0, y: 20 },
				{ opacity: 1, y: 0, duration: 0.7 },
				0,
			);

			if (headlineRef.current) {
				const words = headlineRef.current.querySelectorAll(".word");
				tl.fromTo(
					words,
					{ opacity: 0, y: 40, rotateX: -15 },
					{
						opacity: 1,
						y: 0,
						rotateX: 0,
						duration: 0.8,
						stagger: 0.05,
					},
					0.15,
				);
			}

			tl.fromTo(
				subRef.current,
				{ opacity: 0, y: 20 },
				{ opacity: 1, y: 0, duration: 0.7 },
				0.45,
			);

			tl.fromTo(
				ctaRef.current,
				{ opacity: 0, y: 20 },
				{ opacity: 1, y: 0, duration: 0.7 },
				0.6,
			);

			tl.fromTo(
				screenshotRef.current,
				{ opacity: 0, y: 80, scale: 0.92 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 1.2,
					ease: "power2.out",
				},
				0.7,
			);

			// Parallax screenshot on scroll
			gsap.to(screenshotRef.current, {
				y: -80,
				ease: "none",
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

	const headline = "Screen recordings that look incredible";

	return (
		<section
			ref={sectionRef}
			className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-24 overflow-hidden"
			style={{ background: "linear-gradient(180deg, #000000 0%, #1d1d1f 100%)" }}
		>
			{/* Subtle ambient glow */}
			<div
				className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[700px] rounded-full pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse at center, rgba(16, 185, 129, 0.06) 0%, transparent 65%)",
				}}
			/>

			<div className="relative z-10 max-w-[980px] mx-auto text-center">
				{/* Badge */}
				<div ref={badgeRef} className="mb-6 will-animate">
					<span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] text-[13px] text-white/50 backdrop-blur-sm">
						<span className="w-1.5 h-1.5 rounded-full bg-brand-500 pulse-ring" />
						Free &amp; Open Source
					</span>
				</div>

				{/* Headline */}
				<h1
					ref={headlineRef}
					className="text-[clamp(2.75rem,6.5vw,5.5rem)] font-bold tracking-[-0.04em] leading-[1.05] mb-6"
					style={{ perspective: "1000px" }}
				>
					{headline.split(" ").map((word, i) => (
						<span key={i} className="word inline-block mr-[0.2em] will-animate">
							{word === "incredible" ? (
								<span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500 bg-clip-text text-transparent">
									{word}
								</span>
							) : (
								word
							)}
						</span>
					))}
				</h1>

				{/* Sub */}
				<p
					ref={subRef}
					className="text-[17px] md:text-[21px] text-[#86868b] max-w-2xl mx-auto mb-10 leading-relaxed will-animate"
				>
					Auto-zoom, cursor effects, custom backgrounds, annotations, and a
					full timeline editor. Record once, polish to perfection.
				</p>

				{/* CTAs */}
				<div
					ref={ctaRef}
					className="flex items-center justify-center gap-4 flex-wrap will-animate"
				>
					<a
						href="#download"
						className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-brand-500 text-white font-semibold text-[15px] hover:bg-brand-400 active:scale-[0.97] transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="transition-transform duration-300 group-hover:translate-y-0.5"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						Download for Free
					</a>
					<a
						href="https://github.com/Jahirsheikh12/screenmint"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full border border-white/[0.12] text-white/70 font-medium text-[15px] hover:border-white/25 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
						</svg>
						Star on GitHub
					</a>
				</div>
			</div>

			{/* App screenshot */}
			<div
				ref={screenshotRef}
				className="relative z-10 mt-20 w-full max-w-5xl mx-auto will-animate"
			>
				<div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/60">
					<img
						src="/images/preview.png"
						alt="ScreenMint editor with auto-zoom, cursor effects, and custom backgrounds"
						className="w-full h-auto block"
						loading="eager"
					/>
				</div>

				{/* Bottom fade */}
				<div
					className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
					style={{
						background:
							"linear-gradient(to top, #1d1d1f, transparent)",
					}}
				/>
			</div>
		</section>
	);
}
