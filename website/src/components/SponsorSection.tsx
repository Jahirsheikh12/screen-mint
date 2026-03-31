import gsap from "gsap";
import { Heart, Rocket, Star, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import {
	CREEM_ENABLED,
	CREEM_PRODUCTS,
	GITHUB_SPONSORS_URL,
	getCreemProductById,
	getSupportReturnState,
	SPONSOR_SUPPORT_COPY,
	SPONSOR_TIERS,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";

const TIER_ICONS = [Star, Zap, Rocket] as const;

export function SponsorSection() {
	const sectionRef = useRef<HTMLElement>(null);
	const [dismissedSupportState, setDismissedSupportState] = useState(false);
	const supportState = useMemo(() => {
		if (typeof window === "undefined") return null;
		return getSupportReturnState(window.location.search);
	}, []);
	const supportProduct = getCreemProductById(supportState?.productId ?? null);

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
				".sponsor-hero-cta",
				{ opacity: 0, y: 30, scale: 0.97 },
				{
					opacity: 1,
					y: 0,
					scale: 1,
					duration: 0.8,
					ease: "power2.out",
					scrollTrigger: { trigger: ".sponsor-hero-cta", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".sponsor-card",
				{ opacity: 0, y: 24 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					stagger: 0.1,
					ease: "power2.out",
					scrollTrigger: { trigger: ".sponsor-grid", start: "top 85%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="sponsor" className="relative px-6 py-20 md:py-28">
			<div className="section-divider mx-auto mb-20 max-w-6xl" />

			<div className="mx-auto max-w-6xl">
				{/* Support return state banner */}
				{supportState && !dismissedSupportState ? (
					<div
						className={`mb-8 rounded-2xl border px-5 py-4 ${
							supportState.status === "success"
								? "border-brand-500/20 bg-brand-500/[0.06]"
								: "border-white/[0.08] bg-white/[0.03]"
						}`}
					>
						<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<p className="text-[12px] font-medium uppercase tracking-[0.18em] text-brand-400">
									{supportState.status === "success" ? "Support Received" : "Checkout Cancelled"}
								</p>
								<p className="mt-2 text-[16px] text-white">
									{supportState.status === "success"
										? `Thank you for supporting ScreenMint${supportProduct ? ` with ${supportProduct.name}` : ""}.`
										: "No problem. GitHub Sponsors is still the main way to support the project."}
								</p>
								<p className="mt-2 text-[14px] leading-relaxed text-white/30">
									{supportState.status === "success"
										? "Your support helps fund fixes, release work, and future development. If you need billing help, use the support email below."
										: "If you had a billing or checkout problem, reach out and we can help."}
								</p>
								<a
									href={SUPPORT_EMAIL_HREF}
									className="mt-3 inline-flex text-[13px] text-white/55 transition-colors hover:text-white"
								>
									Contact support
								</a>
							</div>
							<button
								type="button"
								onClick={() => setDismissedSupportState(true)}
								className="self-start rounded-full border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/45 transition-colors hover:text-white/70"
							>
								Dismiss
							</button>
						</div>
					</div>
				) : null}

				{/* Section heading */}
				<div className="sponsor-heading will-animate text-center mb-12">
					<p className="section-eyebrow mb-4">Sponsor</p>
					<h2 className="section-headline mb-5">
						Help keep ScreenMint shipping<span className="text-brand-500">.</span>
					</h2>
					<p className="section-copy mx-auto max-w-2xl">
						{SPONSOR_SUPPORT_COPY} Sponsorship keeps the project sustainable without turning the app
						into a paid product.
					</p>
				</div>

				{/* Hero CTA card */}
				<div className="sponsor-hero-cta will-animate mb-10 rounded-3xl border border-brand-500/15 bg-gradient-to-b from-brand-500/[0.08] to-transparent p-8 md:p-10 text-center">
					<div className="flex justify-center mb-5">
						<div className="relative">
							<Heart className="w-10 h-10 text-brand-500" strokeWidth={1.5} />
							<div className="absolute inset-0 animate-ping">
								<Heart className="w-10 h-10 text-brand-500/30" strokeWidth={1.5} />
							</div>
						</div>
					</div>
					<h3 className="text-[22px] md:text-[26px] font-bold tracking-[-0.03em] text-white mb-3">
						Support the roadmap without changing what makes ScreenMint special.
					</h3>
					<p className="text-[15px] text-white/30 leading-relaxed max-w-xl mx-auto mb-6">
						GitHub Sponsors stays the primary home for recurring support. It helps fund bug
						fixes, platform support, and future releases without gating the app behind accounts,
						telemetry, or paywalls.
					</p>
					<a
						href={GITHUB_SPONSORS_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-[15px] font-semibold text-black transition-all duration-300 hover:bg-brand-400 hover:shadow-glow-md active:scale-[0.97]"
					>
						<Heart className="w-4 h-4" strokeWidth={2.5} />
						Sponsor on GitHub
					</a>
				</div>

				{/* Tier cards */}
				<div className="sponsor-grid grid gap-4 md:grid-cols-3 mb-8">
					{SPONSOR_TIERS.map((tier, i) => {
						const Icon = TIER_ICONS[i];
						const isPopular = i === 1;
						return (
							<a
								key={tier.name}
								href={GITHUB_SPONSORS_URL}
								target="_blank"
								rel="noopener noreferrer"
								className={`sponsor-card will-animate relative rounded-2xl border p-6 transition-all duration-500 group hover:-translate-y-1 ${
									isPopular
										? "border-brand-500/20 bg-brand-500/[0.04] hover:border-brand-500/30 hover:bg-brand-500/[0.06]"
										: "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
								}`}
							>
								{/* Gradient top accent */}
								<div
									className={`absolute top-0 left-4 right-4 h-px ${
										isPopular
											? "bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"
											: "bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
									}`}
								/>

								{isPopular && (
									<span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
										Popular
									</span>
								)}

								<div className="flex items-center gap-3 mb-4">
									<div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
										isPopular ? "bg-brand-500/10 border border-brand-500/20" : "bg-white/[0.04] border border-white/[0.06]"
									}`}>
										<Icon className={`w-4 h-4 ${isPopular ? "text-brand-400" : "text-white/30 group-hover:text-white/60"} transition-colors`} strokeWidth={1.5} />
									</div>
									<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-400/70">
										GitHub Sponsors
									</p>
								</div>

								<h3 className="text-[22px] font-semibold tracking-[-0.03em] text-white mb-2">
									{tier.name}
								</h3>
								<p className="text-[14px] leading-relaxed text-white/30">{tier.description}</p>
							</a>
						);
					})}
				</div>

				{/* Creem section */}
				{CREEM_ENABLED ? (
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
						<p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45 mb-4">
							Support via Card
						</p>
						<p className="text-[14px] leading-relaxed text-white/30 mb-6 max-w-xl">
							Prefer a one-time card checkout instead of GitHub? Use one of these Creem support
							options.
						</p>
						<div className="grid gap-3 md:grid-cols-3">
							{CREEM_PRODUCTS.map((product) => (
								<a
									key={product.id}
									href={product.checkoutUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-brand-500/25 hover:bg-brand-500/[0.04] hover:-translate-y-1"
								>
									<div className="flex items-start justify-between gap-3 mb-3">
										<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
											{product.label}
										</p>
										<span className="rounded-full border border-brand-500/18 bg-brand-500/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-brand-300">
											{product.price}
										</span>
									</div>
									<h4 className="text-[16px] font-semibold tracking-[-0.02em] text-white mb-2">
										{product.name}
									</h4>
									<p className="text-[13px] leading-relaxed text-white/25">
										{product.description}
									</p>
								</a>
							))}
						</div>
					</div>
				) : null}
			</div>
		</section>
	);
}
