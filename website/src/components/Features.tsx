import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const features = [
	{
		title: "Auto Zoom",
		description:
			"Smart zoom follows your clicks and interactions automatically. Focus your audience on what matters — no manual keyframing needed.",
		image: "/images/preview2.png",
		align: "right" as const,
	},
	{
		title: "Cursor Effects",
		description:
			"Smooth tracking, click highlights, motion blur, and a cinematic sway animation. Every interaction feels intentional and polished.",
		image: "/images/CursorLoop.gif",
		align: "left" as const,
	},
	{
		title: "Cursor Sway",
		description:
			"Natural, organic cursor movement that makes screen recordings feel human. Subtle sway removes the robotic look of raw captures.",
		image: "/images/CursorSwayDemo.gif",
		align: "right" as const,
	},
	{
		title: "Custom Backgrounds",
		description:
			"Wallpapers, gradients, solid colors, or your own brand assets. Drop your recording onto any background in seconds.",
		image: "/images/preview3.png",
		align: "left" as const,
	},
	{
		title: "Timeline Editor",
		description:
			"Drag-and-drop timeline with zoom, trim, speed control, and annotation layers. Full non-destructive editing at your fingertips.",
		image: "/images/preview4.png",
		align: "right" as const,
	},
	{
		title: "Export MP4 & GIF",
		description:
			"GPU-accelerated rendering pipeline. Export crisp MP4 or optimized GIF with custom frame rates and quality settings.",
		image: "/images/demo.gif",
		align: "left" as const,
	},
];

function FeatureSpotlight({
	title,
	description,
	image,
	align,
	index,
}: {
	title: string;
	description: string;
	image: string;
	align: "left" | "right";
	index: number;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (prefersReducedMotion() || !ref.current) return;

		const ctx = gsap.context(() => {
			const textEl = ref.current!.querySelector(".feature-text");
			const imgEl = ref.current!.querySelector(".feature-img");

			gsap.fromTo(
				textEl,
				{ opacity: 0, y: 40 },
				{
					opacity: 1,
					y: 0,
					duration: 0.8,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ref.current,
						start: "top 82%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				imgEl,
				{ opacity: 0, y: 50, scale: 0.97 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 0.9,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ref.current,
						start: "top 80%",
						once: true,
					},
				},
			);
		}, ref);

		return () => ctx.revert();
	}, []);

	return (
		<div
			ref={ref}
			className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
				index > 0 ? "mt-20 lg:mt-28" : ""
			}`}
		>
			<div
				className={`feature-text will-animate ${align === "right" ? "lg:order-1" : "lg:order-2"}`}
			>
				<span className="inline-block text-[12px] font-medium tracking-[0.2em] uppercase text-brand-500 mb-4">
					0{index + 1}
				</span>
				<h3 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white mb-4">
					{title}
				</h3>
				<p className="text-[15px] md:text-[16px] text-white/30 leading-relaxed max-w-[440px]">
					{description}
				</p>
			</div>

			<div
				className={`feature-img will-animate ${align === "right" ? "lg:order-2" : "lg:order-1"}`}
			>
				<div className="relative group rounded-xl overflow-hidden border border-white/[0.05] bg-black">
					<img
						src={image}
						alt={title}
						className="w-full h-auto block transition-transform duration-700 ease-out group-hover:scale-[1.03]"
						loading="lazy"
					/>
					<div className="absolute inset-0 bg-brand-500/0 group-hover:bg-brand-500/[0.02] transition-colors duration-500 pointer-events-none" />
				</div>
			</div>
		</div>
	);
}

export function Features() {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".features-eyebrow",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: { trigger: ".features-eyebrow", start: "top 85%", once: true },
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
					scrollTrigger: { trigger: ".features-headline", start: "top 85%", once: true },
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
					scrollTrigger: { trigger: ".features-copy", start: "top 85%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="features" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-6xl mx-auto">
				<div className="text-center mb-20 lg:mb-24">
					<p className="features-eyebrow section-eyebrow mb-4 will-animate">Features</p>
					<h2 className="features-headline section-headline mb-5 will-animate">
						Everything you need.
						<br />
						<span className="text-white/20">Nothing you don&apos;t.</span>
					</h2>
					<p className="features-copy section-copy max-w-md mx-auto will-animate">
						Record, edit, and export polished screen recordings. All in one app, all for free.
					</p>
				</div>

				{features.map((feature, index) => (
					<FeatureSpotlight
						key={feature.title}
						title={feature.title}
						description={feature.description}
						image={feature.image}
						align={feature.align}
						index={index}
					/>
				))}
			</div>
		</section>
	);
}
