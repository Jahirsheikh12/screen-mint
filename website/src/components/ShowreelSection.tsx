import gsap from "gsap";
import { useEffect, useRef } from "react";
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

	useEffect(() => {
		const section = sectionRef.current;
		const sticky = stickyRef.current;
		const track = trackRef.current;
		const spacer = spacerRef.current;
		if (!section || !sticky || !track || !spacer) return;

		const updateSpacer = () => {
			const distance = track.scrollWidth - window.innerWidth;
			spacer.style.height = `${Math.max(0, distance)}px`;
		};
		updateSpacer();
		window.addEventListener("resize", updateSpacer);

		if (prefersReducedMotion()) {
			return () => window.removeEventListener("resize", updateSpacer);
		}

		// Start hidden so cards don't peek in before animation starts
		gsap.set(sticky, { opacity: 0 });

		const ctx = gsap.context(() => {
			// Fade in the sticky content as the section approaches the viewport.
			// Fully visible right when "top top" fires so the horizontal scroll
			// and the reveal happen seamlessly.
			gsap.to(sticky, {
				opacity: 1,
				ease: "none",
				scrollTrigger: {
					trigger: section,
					start: "top 95%",
					end: "top top",
					scrub: true,
				},
			});

			// Horizontal scroll driven by vertical scroll
			gsap.to(track, {
				x: () => -(track.scrollWidth - window.innerWidth),
				ease: "none",
				scrollTrigger: {
					trigger: section,
					start: "top top",
					end: "bottom bottom",
					scrub: 1,
					invalidateOnRefresh: true,
				},
			});
		});

		return () => {
			window.removeEventListener("resize", updateSpacer);
			ctx.revert();
		};
	}, []);

	return (
		<>
			{/* Divider — in normal flow above the scroll section */}
			<div className="pt-20 md:pt-28 px-6">
				<div className="section-divider max-w-6xl mx-auto" />
			</div>

			{/* Scroll section */}
			<div ref={sectionRef} className="relative">
				{/* Sticky viewport — heading + cards stick together */}
				<div
					ref={stickyRef}
					className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center"
				>
					<div className="px-[max(24px,calc((100vw-1152px)/2))] mb-6">
						<p className="section-eyebrow mb-3">Showreel</p>
						<h2 className="section-headline">See it in action</h2>
					</div>

					<div
						ref={trackRef}
						className="flex gap-6 pl-[max(24px,calc((100vw-1152px)/2))]"
					>
						{showcaseItems.map((item) => (
							<div
								key={item.title}
								className="group flex-shrink-0 w-[70vw] max-w-[900px]"
							>
								<div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-black">
									<div className="flex items-center gap-2 px-4 py-2.5 bg-black border-b border-white/[0.04]">
										<div className="w-2 h-2 rounded-full bg-white/[0.06]" />
										<div className="w-2 h-2 rounded-full bg-white/[0.06]" />
										<div className="w-2 h-2 rounded-full bg-white/[0.06]" />
										<span className="ml-2 text-[10px] text-white/10 font-mono">
											{item.title}
										</span>
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
									<h3 className="text-[16px] font-semibold text-white/80 mb-1">
										{item.title}
									</h3>
									<p className="text-[14px] text-white/20">{item.description}</p>
								</div>
							</div>
						))}
						<div className="flex-shrink-0 w-[10vw]" />
					</div>
				</div>

				{/* Spacer — height set dynamically to match horizontal scroll distance */}
				<div ref={spacerRef} />
			</div>
		</>
	);
}
