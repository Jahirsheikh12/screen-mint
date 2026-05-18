import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

gsap.registerPlugin(ScrollTrigger);

const showcaseItems = [
	{
		title: "Cursor Effects",
		description:
			"Smooth tracking with click highlights and motion blur that feels organic and natural.",
		image: "/images/CursorLoop.gif",
	},
	{
		title: "Cursor Sway",
		description:
			"Organic movement that makes recordings feel alive, eliminating rigid straight lines.",
		image: "/images/CursorSwayDemo.gif",
	},
	{
		title: "Export Quality",
		description:
			"GPU-accelerated MP4 and GIF rendering for pristine, lossless output without the wait.",
		image: "/images/demo.gif",
	},
];

export function ShowreelSection() {
	const containerRef = useRef<HTMLDivElement>(null);
	const textRefs = useRef<(HTMLDivElement | null)[]>([]);
	const mediaRefs = useRef<(HTMLImageElement | null)[]>([]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		if (prefersReducedMotion()) {
			return;
		}

		const ctx = gsap.context(() => {
			const numItems = showcaseItems.length;

			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: container,
					start: "top top",
					end: "bottom bottom",
					scrub: 0.5, // Snappy scrub delay
					// Snap exactly to the center of each item
					snap: {
						snapTo: 1 / (numItems - 1),
						duration: { min: 0.2, max: 0.5 },
						delay: 0.1,
						ease: "power2.inOut",
					},
				},
			});

			// Hide all but the first initially
			gsap.set(textRefs.current[0], { autoAlpha: 1, y: 0 });
			gsap.set(textRefs.current.slice(1), { autoAlpha: 0, y: 40 });
			gsap.set(mediaRefs.current[0], { autoAlpha: 1, scale: 1 });
			gsap.set(mediaRefs.current.slice(1), { autoAlpha: 0, scale: 1.05 });

			// Build a perfectly symmetric timeline
			// Total duration will be (numItems - 1)
			// Item 0 is centered at time 0.0
			// Item 1 is centered at time 1.0
			// Item 2 is centered at time 2.0
			for (let i = 0; i < numItems - 1; i++) {
				const transCenter = i + 0.5; // e.g. 0.5 for Transition 0->1
				const transDurationMedia = 0.6; // Crossfade duration
				const transDurationText = 0.3; // Text in/out duration (shorter to sequence them)

				// FADE OUT CURRENT (i)
				// Text fades out BEFORE the center
				tl.to(
					textRefs.current[i],
					{ autoAlpha: 0, y: -40, duration: transDurationText, ease: "power2.in" },
					transCenter - transDurationText, // e.g. 0.5 - 0.3 = 0.2
				);
				// Media starts crossfading
				tl.to(
					mediaRefs.current[i],
					{ autoAlpha: 0, scale: 0.95, duration: transDurationMedia, ease: "power2.inOut" },
					transCenter - transDurationMedia / 2, // e.g. 0.5 - 0.3 = 0.2
				);

				// FADE IN NEXT (i + 1)
				// Text fades in AFTER the center, ensuring NO overlap
				tl.fromTo(
					textRefs.current[i + 1],
					{ autoAlpha: 0, y: 40 },
					{ autoAlpha: 1, y: 0, duration: transDurationText, ease: "power2.out" },
					transCenter, // e.g. 0.5
				);
				// Media crossfades concurrently
				tl.fromTo(
					mediaRefs.current[i + 1],
					{ autoAlpha: 0, scale: 1.05 },
					{ autoAlpha: 1, scale: 1, duration: transDurationMedia, ease: "power2.inOut" },
					transCenter - transDurationMedia / 2, // e.g. 0.2
				);
			}

			// Ensure timeline extends to exactly (numItems - 1)
			tl.to({}, { duration: 0.01 }, numItems - 1);
		}, container);

		return () => ctx.revert();
	}, []);

	return (
		<>
			{/* Divider */}
			<div className="pt-20 md:pt-32 px-6">
				<div className="section-divider max-w-6xl mx-auto" />
			</div>

			{/* Height adjusted for exactly 3 items to feel responsive without excessive scrolling */}
			<div ref={containerRef} className="relative w-full h-[300vh]">
				{/* Sticky viewport */}
				<div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center bg-[#121212]">
					{/* Background ambient glow matching the hero section slightly */}
					<div className="absolute top-1/2 right-[20%] w-[800px] h-[800px] -translate-y-1/2 rounded-full bg-brand-500/[0.03] blur-[120px] pointer-events-none" />

					{/* Expanded Max-Width for a wider preview grid */}
					<div className="max-w-[1600px] w-full mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-12 items-center h-full max-h-[900px] py-16 relative z-10">
						
						{/* Left Column: Typography / Content (Now narrower: col-span-4) */}
						<div className="lg:col-span-4 flex flex-col justify-center relative h-[300px] lg:h-[400px]">
							<div className="absolute top-0 left-0 w-full text-left">
								<p className="section-eyebrow mb-6 tracking-widest text-brand-500/80">Showreel</p>

								{/* Dynamic Text Items Overlaying Each Other */}
								<div className="relative w-full h-full mt-4">
									{showcaseItems.map((item, i) => (
										<div
											key={item.title}
											ref={(el) => {
												textRefs.current[i] = el;
											}}
											className="absolute top-0 left-0 w-full opacity-0 invisible translate-y-10"
										>
											<div className="text-brand-500 font-mono text-sm mb-6 font-semibold tracking-[0.2em] opacity-90">
												0{i + 1} <span className="opacity-40">/ 0{showcaseItems.length}</span>
											</div>
											<h2 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.05]">
												{item.title}
											</h2>
											<p className="text-lg md:text-xl text-white/50 max-w-[400px] leading-relaxed">
												{item.description}
											</p>
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Right Column: Media Display (Now wider: col-span-8) */}
						<div className="lg:col-span-8 relative h-[45vh] min-h-[350px] lg:h-[75vh] lg:min-h-[550px] w-full flex items-center justify-center">
							{/* Cinematic wrapper with animated border equivalent styling */}
							<div className="w-full h-full relative rounded-2xl md:rounded-[36px] p-[1px] overflow-hidden group">
								{/* Border Gradient (static but elegant) */}
								<div className="absolute inset-0 bg-gradient-to-br from-brand-500/30 via-white/5 to-brand-500/10 opacity-70" />

								{/* Outer glowing drop shadow behind the card */}
								<div className="absolute inset-0 bg-brand-500/10 blur-3xl rounded-[36px] -z-10" />

								{/* Inner Window Container */}
								<div className="relative w-full h-full rounded-2xl md:rounded-[35px] bg-[#050505] overflow-hidden flex flex-col shadow-2xl">
									{/* Window Chrome / Header */}
									<div className="flex items-center gap-2.5 px-6 py-4 bg-[#0a0a0a] border-b border-white/[0.04]">
										<div className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] border border-[#e0443e]" />
										<div className="w-3.5 h-3.5 rounded-full bg-[#febc2e] border border-[#d89f24]" />
										<div className="w-3.5 h-3.5 rounded-full bg-[#28c840] border border-[#22ab35]" />
										<div className="ml-auto text-[11px] font-mono text-white/20 uppercase tracking-widest">
											Preview
										</div>
									</div>

									{/* Media Viewport */}
									<div className="relative flex-1 w-full h-full bg-[#030303] overflow-hidden">
										{showcaseItems.map((item, i) => (
											<img
												key={item.title}
												ref={(el) => {
													mediaRefs.current[i] = el;
												}}
												src={item.image}
												alt={item.title}
												className="absolute inset-0 w-full h-full object-cover opacity-0 invisible"
												loading={i === 0 ? "eager" : "lazy"}
											/>
										))}
										
										{/* Subtle inner shadow / vignette over the media */}
										<div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] pointer-events-none" />
										
										{/* Glass reflection overlay */}
										<div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08] pointer-events-none mix-blend-overlay" />
									</div>
								</div>
							</div>
						</div>

					</div>
				</div>
			</div>
		</>
	);
}
