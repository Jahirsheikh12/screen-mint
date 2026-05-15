import gsap from "gsap";
import { Circle, Send, Sliders, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const steps = [
	{
		number: "01",
		title: "Record",
		description: "Capture your screen at 60 FPS with native APIs. macOS, Windows, and Linux.",
		icon: Circle,
	},
	{
		number: "02",
		title: "Edit",
		description: "Trim, zoom, add cursor effects, annotations, and backgrounds on the timeline.",
		icon: Sliders,
	},
	{
		number: "03",
		title: "Export",
		description: "GPU-accelerated rendering to MP4 or GIF. Crisp quality, fast exports.",
		icon: Upload,
	},
	{
		number: "04",
		title: "Share",
		description: "Your polished recording is ready. No watermarks, no limits, no account.",
		icon: Send,
	},
];

export function WorkflowSection() {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			/* Heading */
			gsap.fromTo(
				".wf-head",
				{ opacity: 0, y: 24 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power3.out",
					scrollTrigger: { trigger: ".wf-head", start: "top 85%", once: true },
				},
			);

			/* Step cards stagger */
			gsap.fromTo(
				".wf-step",
				{ opacity: 0, y: 32 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					stagger: 0.1,
					ease: "power3.out",
					scrollTrigger: { trigger: ".wf-steps", start: "top 82%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="how-it-works" className="relative py-24 md:py-32 px-6 overflow-hidden">
			{/* Ambient Background Glow */}
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/5 blur-[100px] rounded-full pointer-events-none"></div>

			<div className="section-divider max-w-6xl mx-auto mb-24 relative z-10" />

			<div className="max-w-6xl mx-auto relative z-10">
				{/* Heading */}
				<div className="wf-head text-center mb-20">
					<p className="section-eyebrow mb-4">How it works</p>
					<h2 className="section-headline">
						Four steps to <span className="text-gradient">perfection</span>
					</h2>
				</div>

				{/* Steps Container */}
				<div className="wf-steps relative">
					{/* Connecting Beam (Desktop only) */}
					<div className="hidden lg:block absolute top-1/2 left-[10%] w-[80%] h-[1px] -translate-y-1/2 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent">
						<div className="absolute top-0 left-[20%] w-[60%] h-full bg-gradient-to-r from-transparent via-amber-500/20 to-transparent animate-pulse"></div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative z-10">
						{steps.map((step, i) => {
							const Icon = step.icon;
							return (
								<div key={step.number} className="wf-step group relative h-full">
									{/* Hover Glow Behind Card */}
									<div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/20 to-orange-600/0 rounded-[1.75rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
									
									<div className="relative h-full p-8 rounded-[1.5rem] bg-[#0a0a0a]/90 border border-white/[0.06] backdrop-blur-xl transition-all duration-500 group-hover:bg-[#0f0f0f]/90 group-hover:border-amber-500/30 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)] overflow-hidden flex flex-col">
										
										{/* Background Watermark Number */}
										<div className="absolute -bottom-4 -right-2 text-[120px] font-black tracking-tighter text-white/[0.02] group-hover:text-amber-500/[0.04] transition-colors duration-700 pointer-events-none select-none leading-none">
											{step.number}
										</div>

										{/* Icon Dock */}
										<div className="w-14 h-14 mb-8 rounded-[1rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/40 group-hover:text-amber-500 group-hover:scale-110 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all duration-500 shadow-inner relative z-10">
											<Icon className="w-6 h-6 stroke-[1.5]" />
										</div>

										{/* Content */}
										<div className="relative z-10 flex-1 flex flex-col">
											<div className="flex items-center gap-3 mb-3">
												<span className="text-[11px] font-bold tracking-widest text-amber-500/60 uppercase group-hover:text-amber-500 transition-colors duration-300">Step {step.number}</span>
											</div>
											<h3 className="text-[18px] font-semibold text-white/90 mb-3 group-hover:text-white transition-colors duration-300">
												{step.title}
											</h3>
											<p className="text-[14px] leading-relaxed text-white/40 group-hover:text-white/60 transition-colors duration-500">
												{step.description}
											</p>
										</div>
									</div>

									{/* Mobile Connector Arrow */}
									{i < steps.length - 1 && (
										<div className="sm:hidden absolute -bottom-5 left-1/2 -translate-x-1/2 z-0 text-white/[0.08] animate-pulse">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M12 5v14M19 12l-7 7-7-7"/>
											</svg>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
