import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

const features = [
	{
		title: "Auto Zoom",
		description:
			"Smart zoom follows your clicks and interactions automatically. Focus your audience on what matters — no manual keyframing needed.",
		image: "/images/preview2.png",
	},
	{
		title: "Cursor Effects",
		description:
			"Smooth tracking, click highlights, motion blur, and a cinematic sway animation. Every interaction feels intentional and polished.",
		image: "/images/CursorLoop.gif",
	},
	{
		title: "Cursor Sway",
		description:
			"Natural, organic cursor movement that makes screen recordings feel human. Subtle sway removes the robotic look of raw captures.",
		image: "/images/CursorSwayDemo.gif",
	},
	{
		title: "Custom Backgrounds",
		description:
			"Wallpapers, gradients, solid colors, or your own brand assets. Drop your recording onto any background in seconds.",
		image: "/images/preview3.png",
	},
	{
		title: "Timeline Editor",
		description:
			"Drag-and-drop timeline with zoom, trim, speed control, and annotation layers. Full non-destructive editing at your fingertips.",
		image: "/images/preview4.png",
	},
	{
		title: "Export MP4 & GIF",
		description:
			"GPU-accelerated rendering pipeline. Export crisp MP4 or optimized GIF with custom frame rates and quality settings.",
		image: "/images/demo.gif",
	},
];

/* Bento grid spans: row1=[7,5], row2=[4,4,4], row3=[12] */
const GRID_CLASSES = [
	"md:col-span-7",
	"md:col-span-5",
	"md:col-span-4",
	"md:col-span-4",
	"md:col-span-4",
	"md:col-span-12",
];

function FeatureCard({
	title,
	description,
	image,
	index,
	gridClass,
}: {
	title: string;
	description: string;
	image: string;
	index: number;
	gridClass: string;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (prefersReducedMotion() || !ref.current) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				ref.current,
				{ opacity: 0, y: 40, scale: 0.97 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 0.8,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ref.current,
						start: "top 85%",
						once: true,
					},
				},
			);
		}, ref);

		return () => ctx.revert();
	}, []);

	const isFullWidth = index === 5;

	return (
		<Card
			ref={ref}
			className={`feature-card col-span-12 ${gridClass} rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group will-animate shadow-none text-inherit`}
		>
			{/* Image */}
			<div className={`relative overflow-hidden ${isFullWidth ? "max-h-[400px]" : "aspect-video"}`}>
				<img
					src={image}
					alt={title}
					className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
					loading="lazy"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

				{/* Feature number badge */}
				<Badge className="absolute top-4 left-4 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 p-0 text-[11px] font-semibold text-brand-400 shadow-none backdrop-blur-sm">
					0{index + 1}
				</Badge>
			</div>

			{/* Content */}
			<div className="p-6">
				<h3 className="text-[18px] md:text-[20px] font-semibold tracking-[-0.02em] text-white mb-2 group-hover:text-brand-400 transition-colors duration-300">
					{title}
				</h3>
				<p className="text-[14px] text-white/30 leading-relaxed max-w-[480px]">{description}</p>
			</div>
		</Card>
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
				<div className="text-center mb-16 lg:mb-20">
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

				{/* Bento grid */}
				<div className="grid grid-cols-12 gap-4">
					{features.map((feature, index) => (
						<FeatureCard
							key={feature.title}
							title={feature.title}
							description={feature.description}
							image={feature.image}
							index={index}
							gridClass={GRID_CLASSES[index]}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
