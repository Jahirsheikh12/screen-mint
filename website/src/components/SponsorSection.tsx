import gsap from "gsap";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { GITHUB_SPONSORS_URL, SPONSOR_SUPPORT_COPY, SPONSOR_TIERS } from "../lib/sponsors";

export function SponsorSection() {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".sponsor-heading",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: { trigger: ".sponsor-heading", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".sponsor-card",
				{ opacity: 0, y: 24 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					stagger: 0.08,
					ease: "power2.out",
					scrollTrigger: { trigger: ".sponsor-grid", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".sponsor-cta",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: { trigger: ".sponsor-cta", start: "top 90%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="sponsor" className="relative px-6 py-20 md:py-28">
			<div className="section-divider mx-auto mb-20 max-w-6xl" />

			<div className="mx-auto max-w-6xl">
				<div className="sponsor-heading will-animate text-center">
					<p className="section-eyebrow mb-4">Sponsor</p>
					<h2 className="section-headline mb-5">
						Help keep ScreenMint shipping<span className="text-brand-500">.</span>
					</h2>
					<p className="section-copy mx-auto max-w-2xl">
						{SPONSOR_SUPPORT_COPY} Sponsorship keeps the project sustainable without turning the app
						into a paid product.
					</p>
				</div>

				<div className="sponsor-grid mt-12 grid gap-4 md:grid-cols-3">
					{SPONSOR_TIERS.map((tier) => (
						<div
							key={tier.name}
							className="sponsor-card will-animate rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
						>
							<p className="text-[12px] font-medium uppercase tracking-[0.18em] text-brand-400">
								GitHub Sponsors
							</p>
							<h3 className="mt-4 text-[24px] font-semibold tracking-[-0.03em] text-white">
								{tier.name}
							</h3>
							<p className="mt-3 text-[14px] leading-relaxed text-white/30">{tier.description}</p>
						</div>
					))}
				</div>

				<div className="sponsor-cta will-animate mt-10 rounded-3xl border border-brand-500/14 bg-[linear-gradient(180deg,rgba(245,158,11,0.08)_0%,rgba(10,10,12,0.82)_100%)] p-7 md:p-8">
					<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
						<div className="max-w-2xl">
							<p className="text-[17px] font-medium text-white">
								Support the roadmap without changing what makes ScreenMint special.
							</p>
							<p className="mt-2 text-[14px] leading-relaxed text-white/30">
								Sponsorship helps fund bug fixes, platform support, and future releases. It does not
								gate the app behind accounts, telemetry, or paywalls.
							</p>
						</div>
						<a
							href={GITHUB_SPONSORS_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 text-[14px] font-semibold text-black transition-colors duration-300 hover:bg-brand-400"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m12 21-1.45-1.32C5.4 15.02 2 11.93 2 8.13 2 5.04 4.42 3 7.3 3c1.64 0 3.22.81 4.2 2.09C12.48 3.81 14.06 3 15.7 3 18.58 3 21 5.04 21 8.13c0 3.8-3.4 6.89-8.55 11.55z" />
							</svg>
							Sponsor ScreenMint
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
