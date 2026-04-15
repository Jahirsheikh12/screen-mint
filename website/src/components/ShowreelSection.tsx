import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const showcaseItems = [
	{
		title: "Cursor Effects",
		description: "Smooth tracking with click highlights and motion blur",
		image: "/images/CursorLoop.gif",
	},
	{
		title: "Cursor Sway",
		description: "Organic movement that makes recordings feel alive",
		image: "/images/CursorSwayDemo.gif",
	},
	{
		title: "Export Quality",
		description: "GPU-accelerated MP4 and GIF rendering",
		image: "/images/demo.gif",
	},
];

export function ShowreelSection() {
	const sectionRef = useRef<HTMLDivElement>(null);
	const stickyRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const spacerRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		const section = sectionRef.current;
		const sticky = stickyRef.current;
		const track = trackRef.current;
		const spacer = spacerRef.current;
		if (!section || !sticky || !track || !spacer) return;

		const LEAD_IN = window.innerHeight * 0.5;
		const SLOWNESS = 1.8; // >1 means more scroll distance per px of horizontal travel

		const updateSpacer = () => {
			const distance = track.scrollWidth - window.innerWidth;
			spacer.style.height = `${Math.max(0, distance) * SLOWNESS + LEAD_IN}px`;
		};
		updateSpacer();
		window.addEventListener("resize", updateSpacer);

		if (prefersReducedMotion()) {
			return () => window.removeEventListener("resize", updateSpacer);
		}

		gsap.set(sticky, { opacity: 0 });

		const ctx = gsap.context(() => {
			/* Fade in sticky content */
			gsap.to(sticky, {
				opacity: 1,
				ease: "none",
				scrollTrigger: {
					trigger: section,
					start: "top 90%",
					end: "top 20%",
					scrub: true,
				},
			});

			/* Horizontal scroll */
			const scrollTween = gsap.to(track, {
				x: () => -(track.scrollWidth - window.innerWidth),
				ease: "none",
				scrollTrigger: {
					trigger: section,
					start: () => `top top-=${LEAD_IN}`,
					end: "bottom bottom",
					scrub: 1.5,
					invalidateOnRefresh: true,
					onUpdate: (self) => {
						const progress = self.progress;
						const idx = Math.min(
							showcaseItems.length - 1,
							Math.floor(progress * showcaseItems.length),
						);
						setActiveIndex(idx);
					},
				},
			});

			/* Card scale effect as they pass through center */
			const cards = track.querySelectorAll(".showreel-card");
			cards.forEach((card) => {
				gsap.fromTo(
					card,
					{ scale: 0.95, opacity: 0.7 },
					{
						scale: 1,
						opacity: 1,
						ease: "none",
						scrollTrigger: {
							trigger: card,
							containerAnimation: scrollTween,
							start: "left 80%",
							end: "left 50%",
							scrub: true,
						},
					},
				);
				gsap.fromTo(
					card,
					{ scale: 1, opacity: 1 },
					{
						scale: 0.95,
						opacity: 0.7,
						ease: "none",
						scrollTrigger: {
							trigger: card,
							containerAnimation: scrollTween,
							start: "left 30%",
							end: "left 10%",
							scrub: true,
						},
					},
				);
			});
		});

		return () => {
			window.removeEventListener("resize", updateSpacer);
			ctx.revert();
		};
	}, []);

	return (
		<>
			{/* Divider */}
			<div className="pt-20 md:pt-28 px-6">
				<div className="section-divider max-w-6xl mx-auto" />
			</div>

			{/* Scroll section */}
			<div ref={sectionRef} className="relative">
				{/* Sticky viewport */}
				<div
					ref={stickyRef}
					className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center"
				>
					<div className="px-[max(24px,calc((100vw-1152px)/2))] mb-6">
						<p className="section-eyebrow mb-3">Showreel</p>
						<h2 className="section-headline">See it in action</h2>
					</div>

					<div ref={trackRef} className="flex gap-6 pl-[max(24px,calc((100vw-1152px)/2))]">
						{showcaseItems.map((item) => (
							<div
								key={item.title}
								className="showreel-card group flex-shrink-0 w-[75vw] max-w-[960px]"
							>
								<div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-[#121212] transition-all duration-500 group-hover:border-brand-500/15">
									<div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d0d0d] border-b border-white/[0.05]">
										<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] transition-colors group-hover:bg-[#ff5f57]" />
										<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] transition-colors group-hover:bg-[#febc2e]" />
										<div className="w-2.5 h-2.5 rounded-full bg-white/[0.06] transition-colors group-hover:bg-[#28c840]" />
										<span className="ml-2 text-[10px] text-white/10 font-mono">{item.title}</span>
									</div>
									<div className="relative aspect-video overflow-hidden">
										<img
											src={item.image}
											alt={item.title}
											className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
											loading="lazy"
										/>
									</div>
								</div>
								<div className="mt-4 px-1">
									<h3 className="text-[16px] font-semibold text-white/80 mb-1">{item.title}</h3>
									<p className="text-[14px] text-white/25">{item.description}</p>
								</div>
							</div>
						))}
						<div className="flex-shrink-0 w-[10vw]" />
					</div>

					{/* Progress dots */}
					<div className="flex items-center justify-center gap-2 mt-8">
						{showcaseItems.map((item, i) => (
							<div
								key={item.title}
								className={`h-1.5 rounded-full transition-all duration-500 ${
									i === activeIndex ? "w-8 bg-brand-500" : "w-1.5 bg-white/10"
								}`}
							/>
						))}
					</div>
				</div>

				{/* Spacer */}
				<div ref={spacerRef} />
			</div>
		</>
	);
}
