import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const stats = [
	{ value: "60", suffix: "FPS", label: "Recording quality" },
	{ value: "GPU", suffix: "", label: "Accelerated export" },
	{ value: "0", suffix: "", prefix: "$", label: "Forever free" },
	{ value: "100", suffix: "%", label: "Open source" },
];

export function StatsBar() {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".stat-item",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					stagger: 0.1,
					ease: "power2.out",
					scrollTrigger: {
						trigger: sectionRef.current,
						start: "top 85%",
						once: true,
					},
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} className="relative py-20 px-6">
			<div className="cinematic-divider max-w-5xl mx-auto mb-20" />
			<div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
				{stats.map((stat) => (
					<div key={stat.label} className="stat-item text-center will-animate">
						<div className="text-3xl md:text-4xl font-bold tracking-tight stat-glow text-[#f5f5f7] mb-2">
							{stat.prefix}
							<span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
								{stat.value}
							</span>
							{stat.suffix ? (
								<span className="text-brand-400 text-xl md:text-2xl ml-1">{stat.suffix}</span>
							) : null}
						</div>
						<p className="text-[13px] text-white/25 tracking-wide">{stat.label}</p>
					</div>
				))}
			</div>
		</section>
	);
}
