import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../hooks/useGSAP";

export function DemoSection() {
	const sectionRef = useRef<HTMLElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const progressRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (
			prefersReducedMotion() ||
			!sectionRef.current ||
			!containerRef.current
		)
			return;

		const ctx = gsap.context(() => {
			// Heading animations
			gsap.fromTo(
				".demo-eyebrow",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".demo-eyebrow",
						start: "top 85%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".demo-headline",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".demo-headline",
						start: "top 85%",
						once: true,
					},
				},
			);

			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: sectionRef.current,
					start: "top top",
					end: "+=150%",
					pin: true,
					scrub: 1,
				},
			});

			// Progress bar scrub
			tl.fromTo(
				progressRef.current,
				{ scaleX: 0 },
				{ scaleX: 1, ease: "none" },
			);

			// Raw label fades out
			tl.fromTo(
				".demo-label-raw",
				{ opacity: 1 },
				{ opacity: 0, duration: 0.3 },
				0.25,
			);

			// Polished label fades in
			tl.fromTo(
				".demo-label-polished",
				{ opacity: 0, y: 10 },
				{ opacity: 1, y: 0, duration: 0.3 },
				0.35,
			);

			// Before layer clips away
			tl.fromTo(
				".demo-before",
				{ clipPath: "inset(0 0 0 0)" },
				{
					clipPath: "inset(0 100% 0 0)",
					duration: 0.5,
					ease: "power2.inOut",
				},
				0.25,
			);

			// Polished layer border glow
			tl.fromTo(
				".demo-after-border",
				{ opacity: 0 },
				{ opacity: 1, duration: 0.3 },
				0.6,
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			id="how-it-works"
			className="relative min-h-screen flex items-center justify-center px-6"
		>
			<div className="max-w-5xl w-full mx-auto">
				{/* Heading */}
				<div className="text-center mb-16">
					<p className="demo-eyebrow section-eyebrow mb-4 will-animate">
						How it works
					</p>
					<h2 className="demo-headline section-headline mb-4 will-animate">
						From raw to{" "}
						<span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
							remarkable
						</span>
					</h2>
					<p className="section-copy will-animate">
						Scroll to see the transformation
					</p>
				</div>

				{/* Before / After container */}
				<div
					ref={containerRef}
					className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
				>
					{/* After (polished) layer */}
					<div className="aspect-video bg-[#0a0a0a] flex items-center justify-center relative">
						<div
							className="absolute inset-0"
							style={{
								background:
									"radial-gradient(ellipse at 60% 40%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)",
							}}
						/>

						<div className="relative text-center z-10">
							<div className="demo-label-polished flex flex-col items-center gap-3">
								<div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#10B981"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</div>
								<div>
									<div className="text-xl md:text-2xl font-bold text-[#f5f5f7]/80 mb-1">
										Polished Output
									</div>
									<p className="text-[#86868b] text-sm">
										Auto-zoom, cursor effects, custom
										background applied
									</p>
								</div>
							</div>
						</div>

						{/* Green glow border */}
						<div className="demo-after-border absolute inset-0 rounded-2xl border border-brand-500/20 pointer-events-none" />
					</div>

					{/* Before (raw) layer */}
					<div className="demo-before absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
						<div className="text-center">
							<div className="demo-label-raw flex flex-col items-center gap-3">
								<div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="white"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										opacity="0.3"
									>
										<rect
											x="2"
											y="3"
											width="20"
											height="14"
											rx="2"
										/>
										<line
											x1="8"
											y1="21"
											x2="16"
											y2="21"
										/>
										<line
											x1="12"
											y1="17"
											x2="12"
											y2="21"
										/>
									</svg>
								</div>
								<div>
									<div className="text-xl md:text-2xl font-bold text-[#f5f5f7]/40 mb-1">
										Raw Recording
									</div>
									<p className="text-[#86868b]/50 text-sm">
										Plain screen capture, no effects
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Scrub progress bar */}
					<div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.06]">
						<div
							ref={progressRef}
							className="h-full origin-left"
							style={{
								background:
									"linear-gradient(90deg, #059669, #10B981, #34d399)",
								transform: "scaleX(0)",
							}}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
