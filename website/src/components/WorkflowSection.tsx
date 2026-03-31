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
	const lineRef = useRef<SVGLineElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".workflow-eyebrow",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: { trigger: ".workflow-eyebrow", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".workflow-headline",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: { trigger: ".workflow-headline", start: "top 85%", once: true },
				},
			);

			/* Connecting line draws in */
			if (lineRef.current) {
				const lineLength = lineRef.current.getTotalLength?.() || 1000;
				gsap.set(lineRef.current, { strokeDasharray: lineLength, strokeDashoffset: lineLength });
				gsap.to(lineRef.current, {
					strokeDashoffset: 0,
					duration: 1.2,
					ease: "power2.inOut",
					scrollTrigger: { trigger: ".workflow-steps", start: "top 80%", once: true },
				});
			}

			/* Cards stagger in */
			gsap.fromTo(
				".workflow-step",
				{ opacity: 0, y: 40, scale: 0.95 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 0.7,
					stagger: 0.12,
					ease: "power2.out",
					scrollTrigger: { trigger: ".workflow-steps", start: "top 80%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="how-it-works" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-5xl mx-auto">
				<div className="text-center mb-16">
					<p className="workflow-eyebrow section-eyebrow mb-4 will-animate">Workflow</p>
					<h2 className="workflow-headline section-headline will-animate">
						Four steps to{" "}
						<span className="text-gradient">
							perfection
						</span>
					</h2>
				</div>

				{/* Steps with connecting line */}
				<div className="relative">
					{/* Connecting line (desktop only) */}
					<svg
						className="hidden md:block absolute top-[52px] left-0 right-0 w-full h-1 pointer-events-none"
						preserveAspectRatio="none"
					>
						<line
							ref={lineRef}
							x1="12.5%"
							y1="50%"
							x2="87.5%"
							y2="50%"
							stroke="rgba(245, 158, 11, 0.15)"
							strokeWidth="1"
							strokeDasharray="4 4"
						/>
					</svg>

					<div className="workflow-steps grid grid-cols-1 md:grid-cols-4 gap-6">
						{steps.map((step) => {
							const Icon = step.icon;
							return (
								<div
									key={step.number}
									className="workflow-step will-animate group relative"
								>
									{/* Step number + icon */}
									<div className="flex flex-col items-center mb-6">
										<span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-500/10 border border-brand-500/20 text-[11px] font-bold text-brand-400 mb-3">
											{step.number}
										</span>
										<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:bg-brand-500/[0.06] group-hover:border-brand-500/15 transition-all duration-500">
											<Icon className="w-5 h-5 text-white/30 group-hover:text-brand-400 transition-colors duration-300" strokeWidth={1.5} />
										</div>
									</div>

									{/* Card content */}
									<div className="text-center rounded-2xl p-5 bg-white/[0.02] border border-white/[0.04] group-hover:bg-white/[0.03] group-hover:border-white/[0.08] transition-all duration-500">
										<h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-400 transition-colors duration-300">
											{step.title}
										</h3>
										<p className="text-[13px] text-white/25 leading-relaxed">
											{step.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
