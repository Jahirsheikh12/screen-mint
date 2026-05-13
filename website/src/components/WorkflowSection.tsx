import gsap from "gsap";
import { Circle, Send, Sliders, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { Card } from "./ui/card";

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
		<section ref={sectionRef} id="how-it-works" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-5xl mx-auto">
				{/* Heading */}
				<div className="wf-head text-center mb-16">
					<p className="section-eyebrow mb-4">How it works</p>
					<h2 className="section-headline">
						Four steps to <span className="text-gradient">perfection</span>
					</h2>
				</div>

				{/* Steps */}
				<div className="wf-steps grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{steps.map((step, i) => {
						const Icon = step.icon;
						return (
							<div key={step.number} className="wf-step group relative">
								<Card className="wf-card shadow-none text-inherit">
									{/* Number + icon row */}
									<div className="flex items-center justify-between mb-5">
										<span className="wf-number">{step.number}</span>
										<div className="wf-icon">
											<Icon
												className="w-[18px] h-[18px] text-white/25 group-hover:text-brand-400 transition-colors duration-400"
												strokeWidth={1.5}
											/>
										</div>
									</div>

									{/* Title */}
									<h3 className="text-[17px] font-semibold text-white/90 mb-2 group-hover:text-white transition-colors duration-300">
										{step.title}
									</h3>

									{/* Description */}
									<p className="text-[13px] leading-relaxed text-white/25 group-hover:text-white/35 transition-colors duration-400">
										{step.description}
									</p>
								</Card>

								{/* Arrow connector (hidden on last + mobile) */}
								{i < steps.length - 1 && (
									<div className="hidden lg:flex absolute -right-[10px] top-1/2 -translate-y-1/2 z-10 text-white/[0.08]">
										<svg
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
										>
											<path d="M5 3l5 5-5 5" />
										</svg>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
