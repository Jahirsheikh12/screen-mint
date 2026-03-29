import gsap from "gsap";
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
					<div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
						<div className="rounded-[28px] border border-white/[0.06] bg-black/20 p-6">
							<p className="text-[12px] font-medium uppercase tracking-[0.18em] text-brand-400">
								Sponsor on GitHub
							</p>
							<p className="mt-3 text-[17px] font-medium text-white">
								Support the roadmap without changing what makes ScreenMint special.
							</p>
							<p className="mt-2 text-[14px] leading-relaxed text-white/30">
								GitHub Sponsors stays the primary home for recurring support. It helps fund bug
								fixes, platform support, and future releases without gating the app behind accounts,
								telemetry, or paywalls.
							</p>
							<a
								href={GITHUB_SPONSORS_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 text-[14px] font-semibold text-black transition-colors duration-300 hover:bg-brand-400"
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

						{CREEM_ENABLED ? (
							<div className="rounded-[28px] border border-white/[0.06] bg-black/20 p-6">
								<p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/45">
									Support via Card
								</p>
								<p className="mt-3 text-[14px] leading-relaxed text-white/30">
									Prefer a one-time card checkout instead of GitHub? Use one of these Creem support
									options.
								</p>
								<div className="mt-5 grid gap-3">
									{CREEM_PRODUCTS.map((product) => (
										<a
											key={product.id}
											href={product.checkoutUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:border-brand-500/25 hover:bg-brand-500/[0.05]"
										>
											<div className="flex items-start justify-between gap-4">
												<div>
													<p className="text-[13px] font-medium uppercase tracking-[0.16em] text-white/40">
														{product.label}
													</p>
													<h3 className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-white">
														{product.name}
													</h3>
													<p className="mt-2 text-[13px] leading-relaxed text-white/28">
														{product.description}
													</p>
												</div>
												<span className="rounded-full border border-brand-500/18 bg-brand-500/[0.08] px-3 py-1 text-[12px] font-semibold text-brand-300">
													{product.price}
												</span>
											</div>
										</a>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
