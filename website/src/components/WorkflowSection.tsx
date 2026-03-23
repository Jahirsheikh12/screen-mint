import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const steps = [
	{
		number: "01",
		title: "Record",
		description: "Capture your screen at 60 FPS with native APIs. macOS, Windows, and Linux.",
	},
	{
		number: "02",
		title: "Edit",
		description: "Trim, zoom, add cursor effects, annotations, and backgrounds on the timeline.",
	},
	{
		number: "03",
		title: "Export",
		description: "GPU-accelerated rendering to MP4 or GIF. Crisp quality, fast exports.",
	},
	{
		number: "04",
		title: "Share",
		description: "Your polished recording is ready. No watermarks, no limits, no account.",
	},
];

export function WorkflowSection() {
	const sectionRef = useRef<HTMLElement>(null);

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

			gsap.fromTo(
				".workflow-step",
				{ opacity: 0, y: 40 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					stagger: 0.1,
					ease: "power2.out",
					scrollTrigger: { trigger: ".workflow-steps", start: "top 80%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-5xl mx-auto">
				<div className="text-center mb-16">
					<p className="workflow-eyebrow section-eyebrow mb-4 will-animate">Workflow</p>
					<h2 className="workflow-headline section-headline will-animate">
						Four steps to{" "}
						<span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
							perfection
						</span>
					</h2>
				</div>

				<div className="workflow-steps grid grid-cols-1 md:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden">
					{steps.map((step) => (
						<div
							key={step.number}
							className="workflow-step bg-black p-7 md:p-8 will-animate group hover:bg-white/[0.02] transition-colors duration-500"
						>
							<div className="text-[11px] font-medium tracking-[0.2em] text-brand-500/60 mb-5">
								{step.number}
							</div>
							<h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-400 transition-colors duration-300">
								{step.title}
							</h3>
							<p className="text-[13px] text-white/20 leading-relaxed">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
