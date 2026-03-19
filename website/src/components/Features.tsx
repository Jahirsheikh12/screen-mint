import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "../hooks/useGSAP";

const features = [
	{
		title: "Auto Zoom",
		description:
			"Smart zoom follows your clicks and interactions. Focus your audience on what matters, automatically.",
		image: "/images/preview2.png",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
				<line x1="11" y1="8" x2="11" y2="14" />
				<line x1="8" y1="11" x2="14" y2="11" />
			</svg>
		),
	},
	{
		title: "Cursor Effects",
		description:
			"Smooth tracking, click highlights, motion blur, and sway animation. Make every click feel cinematic.",
		image: "/images/CursorLoop.gif",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
				<path d="m13 13 6 6" />
			</svg>
		),
	},
	{
		title: "Cursor Sway",
		description:
			"Natural cursor movement with organic sway animation that makes recordings feel human and polished.",
		image: "/images/CursorSwayDemo.gif",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
			</svg>
		),
	},
	{
		title: "Custom Backgrounds",
		description:
			"Wallpapers, gradients, solid colors — or upload your own. Your recording, your brand.",
		image: "/images/preview3.png",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<circle cx="9" cy="9" r="2" />
				<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
			</svg>
		),
	},
	{
		title: "Timeline Editor",
		description:
			"Drag-and-drop timeline with zoom, trim, speed, and annotation layers. Non-destructive editing.",
		image: "/images/preview4.png",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect x="2" y="7" width="20" height="10" rx="2" />
				<line x1="6" y1="7" x2="6" y2="17" />
				<line x1="10" y1="7" x2="10" y2="17" />
				<line x1="14" y1="7" x2="14" y2="17" />
				<line x1="18" y1="7" x2="18" y2="17" />
			</svg>
		),
	},
	{
		title: "Export MP4 & GIF",
		description:
			"GPU-accelerated rendering. Export crisp MP4 or optimized GIF with custom frame rates and quality.",
		image: "/images/demo.gif",
		icon: (
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		),
	},
];

export function Features() {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			// Heading animation
			gsap.fromTo(
				".features-eyebrow",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-eyebrow",
						start: "top 85%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".features-headline",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-headline",
						start: "top 85%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".features-copy",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-copy",
						start: "top 85%",
						once: true,
					},
				},
			);

			// Cards batch animation
			ScrollTrigger.batch(".feature-card", {
				onEnter: (elements) => {
					gsap.fromTo(
						elements,
						{ opacity: 0, y: 40, scale: 0.97 },
						{
							opacity: 1,
							y: 0,
							scale: 1,
							duration: 0.7,
							ease: "power2.out",
							stagger: 0.1,
						},
					);
				},
				start: "top 88%",
				once: true,
			});
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			id="features"
			className="relative py-32 md:py-40 px-6"
		>
			{/* Divider */}
			<div className="section-divider max-w-6xl mx-auto mb-32" />

			<div className="max-w-6xl mx-auto">
				{/* Heading */}
				<div className="text-center mb-20">
					<p className="features-eyebrow section-eyebrow mb-4 will-animate">
						Features
					</p>
					<h2 className="features-headline section-headline mb-6 will-animate">
						Everything you need.
						<br />
						Nothing you don&apos;t.
					</h2>
					<p className="features-copy section-copy max-w-lg mx-auto will-animate">
						Record, edit, and export polished screen recordings. All
						in one app, all for free.
					</p>
				</div>

				{/* Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="feature-card group rounded-2xl bg-[#2d2d2f]/50 border border-white/[0.06] overflow-hidden hover:bg-[#2d2d2f]/80 transition-all duration-500 will-animate"
						>
							{/* Image / GIF preview */}
							<div className="relative aspect-[16/10] bg-[#0a0a0a] overflow-hidden">
								<img
									src={feature.image}
									alt={feature.title}
									className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
									loading="lazy"
								/>
								<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#2d2d2f]/80 to-transparent pointer-events-none" />
							</div>

							{/* Content */}
							<div className="p-6">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/15 flex items-center justify-center text-brand-400 group-hover:text-brand-300 transition-colors duration-300 flex-shrink-0">
										{feature.icon}
									</div>
									<h3 className="text-[16px] font-semibold text-[#f5f5f7]">
										{feature.title}
									</h3>
								</div>
								<p className="text-[14px] text-[#86868b] leading-relaxed">
									{feature.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
