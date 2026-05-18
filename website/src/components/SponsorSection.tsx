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
	SPONSOR_TIERS,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const TIER_ICONS = [Star, Zap, Rocket] as const;

function SpotlightCard({ children, className = "", ...props }: React.ComponentProps<typeof Card>) {
	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
		e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
	};

	return (
		<Card
			className={`sponsor-spotlight-card ${className}`}
			onMouseMove={handleMouseMove}
			{...props}
		>
			{children}
		</Card>
	);
}

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
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.8,
					ease: "power3.out",
					scrollTrigger: { trigger: ".sponsor-heading", start: "top 95%", once: true },
				},
			);

			gsap.fromTo(
				".sponsor-bento > *",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.8,
					stagger: 0.15,
					ease: "power3.out",
					scrollTrigger: { trigger: ".sponsor-bento", start: "top 90%", once: true },
				},
			);

			gsap.fromTo(
				".sponsor-creem-strip",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.8,
					ease: "power3.out",
					scrollTrigger: { trigger: ".sponsor-creem-strip", start: "top 95%", once: true },
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
					<div className="mb-12 flex justify-center">
						<div
							className={`inline-flex items-center gap-4 rounded-full border px-5 py-2.5 backdrop-blur-md ${
								supportState.status === "success"
									? "border-brand-500/30 bg-brand-500/10 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
									: "border-white/10 bg-white/5"
							}`}
						>
							<div>
								<p className="text-[14px] font-medium text-white">
									{supportState.status === "success" ? (
										<>
											<span className="text-brand-400">Support Received:</span> Thank you for supporting ScreenMint{supportProduct ? ` with ${supportProduct.name}` : ""}!
										</>
									) : (
										<>Checkout Cancelled. No worries!</>
									)}
								</p>
								<a
									href={SUPPORT_EMAIL_HREF}
									className="text-[12px] text-white/50 transition-colors hover:text-white"
								>
									{supportState.status === "success" ? "Need billing help?" : "Having issues? Contact us."}
								</a>
							</div>
							<div className="h-6 w-[1px] bg-white/10 mx-2" />
							<button
								type="button"
								onClick={() => setDismissedSupportState(true)}
								className="text-[12px] font-semibold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
							>
								Dismiss
							</button>
						</div>
					</div>
				) : null}

				{/* Section heading */}
				<div className="sponsor-heading will-animate text-center mb-16">
					<p className="sponsor-eyebrow mb-4">Community Supported</p>
					<h2 className="section-headline">
						Help keep ScreenMint shipping<span className="text-brand-500">.</span>
					</h2>
				</div>

				{/* Bento Grid */}
				<div className="sponsor-bento will-animate mb-16">
					{/* Main Bento Cell */}
					<SpotlightCard className="sponsor-bento-main flex flex-col justify-center p-8 md:p-12 text-inherit">
						<div className="sponsor-card-content flex flex-col h-full">
							<div className="mb-8 flex flex-wrap items-center justify-between gap-4">
								<div className="flex items-center gap-3">
									<div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/10 shadow-glow-sm">
										<Heart className="w-6 h-6 text-brand-400" strokeWidth={2.5} />
										<div className="absolute inset-0 animate-ping rounded-2xl border border-brand-500/40"></div>
									</div>
									<div>
										<p className="sponsor-eyebrow mb-0.5">Primary Support</p>
										<p className="text-[15px] font-bold tracking-tight text-white">GitHub Sponsors</p>
									</div>
								</div>
								<Badge className="border-brand-500/20 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 shadow-none font-medium text-[11px] uppercase tracking-widest hidden sm:inline-flex">
									Recommended
								</Badge>
							</div>

							<h3 className="sponsor-main-heading mb-5 max-w-2xl">
								Support the roadmap without changing what makes ScreenMint special.
							</h3>

							<p className="text-[16px] text-white/40 leading-relaxed max-w-2xl mb-10 flex-grow">
								Sponsorship keeps the project sustainable without turning the app into a paid product.
								It helps fund bug fixes, platform support, and future releases without gating the app
								behind accounts, telemetry, or paywalls.
							</p>

							<div>
								<Button
									asChild
									className="h-auto rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-8 py-4 text-[15px] font-bold text-[#121212] shadow-glow-sm transition-all duration-300 hover:shadow-glow-md hover:scale-[1.02] active:scale-[0.98]"
								>
									<a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer">
										<Heart className="w-4 h-4 mr-2" strokeWidth={2.5} />
										Sponsor on GitHub
									</a>
								</Button>
							</div>
						</div>
					</SpotlightCard>

					{/* Side Bento Cells for Tiers */}
					<div className="sponsor-bento-side">
						{SPONSOR_TIERS.map((tier, i) => {
							const Icon = TIER_ICONS[i];
							const isPopular = i === 1;
							return (
								<a
									key={tier.name}
									href={GITHUB_SPONSORS_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="group block flex-1"
								>
									<SpotlightCard
										className={`h-full p-6 text-inherit ${
											isPopular ? "border-brand-500/30 bg-brand-500/[0.04]" : ""
										}`}
									>
										<div className="sponsor-card-content flex flex-col h-full justify-center">
											<div className="flex items-start justify-between mb-4">
												<div
													className={`flex items-center justify-center w-12 h-12 rounded-xl ${
														isPopular
															? "bg-brand-500/15 border border-brand-500/30"
															: "bg-white/[0.03] border border-white/[0.06]"
													} transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-500/20 group-hover:border-brand-500/40`}
												>
													<Icon
														className={`w-6 h-6 ${
															isPopular ? "text-brand-400" : "text-white/40 group-hover:text-brand-300"
														} transition-colors duration-300`}
														strokeWidth={1.5}
													/>
												</div>
												{isPopular && (
													<Badge className="border-0 bg-brand-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#121212] shadow-glow-sm">
														Popular
													</Badge>
												)}
											</div>
											<h4 className="text-[20px] font-bold tracking-tight text-white mb-2">
												{tier.name}
											</h4>
											<p className="text-[13px] leading-relaxed text-white/30">
												{tier.description}
											</p>
										</div>
									</SpotlightCard>
								</a>
							);
						})}
					</div>
				</div>

				{/* Creem section (One-time support) */}
				{CREEM_ENABLED ? (
					<div className="sponsor-creem-strip will-animate">
						<div className="flex flex-col justify-center shrink-0 w-[280px] md:w-72 pr-6 md:pr-10">
							<p className="sponsor-eyebrow mb-3 text-white/40">Support via Card</p>
							<h4 className="text-[24px] font-bold tracking-tight text-white mb-3">One-time Support</h4>
							<p className="text-[14px] leading-relaxed text-white/30">
								Prefer a single card checkout instead of recurring GitHub sponsors? Pick an option here.
							</p>
						</div>
						
						{CREEM_PRODUCTS.map((product) => (
							<a
								key={product.id}
								href={product.checkoutUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="group shrink-0"
							>
								<div className="creem-card h-full flex flex-col">
									<div className="flex items-start justify-between gap-3 mb-5">
										<p className="text-[10px] font-bold uppercase tracking-widest text-white/30 group-hover:text-brand-400/70 transition-colors">
											{product.label}
										</p>
										<Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/70 shadow-none group-hover:border-brand-500/30 group-hover:bg-brand-500/10 group-hover:text-brand-300 transition-all duration-300">
											{product.price}
										</Badge>
									</div>
									<h4 className="text-[18px] font-bold tracking-tight text-white mb-2">
										{product.name}
									</h4>
									<p className="text-[13px] leading-relaxed text-white/30 flex-grow">
										{product.description}
									</p>
								</div>
							</a>
						))}
					</div>
				) : null}
			</div>
		</section>
	);
}

