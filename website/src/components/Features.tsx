import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

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
				{ opacity: 0, y: 20, scale: 0.98 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 0.8,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ref.current,
						start: "top 95%",
						once: true,
					},
				},
			);
		}, ref);

		return () => ctx.revert();
	}, []);

	const isFullWidth = index === 5;

	return (
		<div
			ref={ref}
			className={`col-span-12 ${gridClass} group relative flex flex-col overflow-hidden rounded-[2rem] bg-[#0a0a0a]/80 border border-white/[0.05] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-brand-500/30 hover:bg-[#0f0f0f]/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-2xl hover:shadow-black/60 will-animate`}
		>
			{/* Hover Radial Glow Inside Card */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"></div>

			{/* Image Area */}
			<div
				className={`relative w-full ${isFullWidth ? "h-[300px] md:h-[400px]" : "h-[220px] md:h-[260px]"} overflow-hidden bg-black/50`}
			>
				{/* Image with subtle zoom on hover */}
				<img
					src={image}
					alt={title}
					className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
					loading="lazy"
				/>

				{/* Gradient Mask to fade image into card background */}
				<div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-[#0a0a0a]/30 to-transparent group-hover:from-[#0f0f0f]/95 transition-colors duration-500 pointer-events-none" />

				{/* Premium Glowing Pill Badge */}
				<div className="absolute top-5 left-5 z-10 flex items-center justify-center px-3.5 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-lg group-hover:bg-brand-500/20 group-hover:border-brand-500/40 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-500">
					<span className="text-[11px] font-bold tracking-widest text-white/70 uppercase group-hover:text-brand-400 transition-colors duration-500">
						{index + 1 < 10 ? `0${index + 1}` : index + 1}
					</span>
				</div>
			</div>

			{/* Text Content Area */}
			<div className="relative z-10 flex flex-col p-6 md:p-8 pt-0 mt-[-20px] md:mt-[-40px]">
				<h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.02em] text-white/90 mb-3 group-hover:text-white transition-colors duration-300 drop-shadow-md">
					{title}
				</h3>
				<p className="text-[14px] md:text-[15px] text-white/40 leading-relaxed max-w-[500px] group-hover:text-white/60 transition-colors duration-500">
					{description}
				</p>
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
				{ opacity: 0, y: 15 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-eyebrow",
						start: "top 95%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".features-headline",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-headline",
						start: "top 95%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".features-copy",
				{ opacity: 0, y: 15 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".features-copy",
						start: "top 95%",
						once: true,
					},
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			id="features"
			className="relative py-24 md:py-32 px-6 overflow-hidden"
		>
			{/* Ambient Background Glows */}
			<div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-brand-500/5 blur-[120px] rounded-full pointer-events-none"></div>
			<div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

			<div className="section-divider max-w-6xl mx-auto mb-24 relative z-10" />

			<div className="max-w-6xl mx-auto relative z-10">
				<div className="text-center mb-16 lg:mb-24">
					<p className="features-eyebrow section-eyebrow mb-4 will-animate">Features</p>
					<h2 className="features-headline section-headline mb-6 will-animate">
						Everything you need.
						<br />
						<span className="text-white/20">Nothing you don&apos;t.</span>
					</h2>
					<p className="features-copy section-copy max-w-[540px] mx-auto will-animate">
						Record, edit, and export polished screen recordings. All in one app, all for free.
						Designed for creators who care about the details.
					</p>
				</div>

				{/* Premium Bento grid */}
				<div className="grid grid-cols-12 gap-5 md:gap-6 lg:gap-8">
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
