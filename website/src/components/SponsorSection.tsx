import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { reveal } from "../lib/motion";
import {
	CREEM_ENABLED,
	CREEM_PRODUCTS,
	GITHUB_SPONSORS_URL,
	getCreemProductById,
	getSupportReturnState,
	SPONSOR_MISSION,
	SPONSOR_TIERS,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";
import { Slate } from "./Chapters";

/** One line of end credits: role, dotted leader, amount. */
function CreditLine({
	href,
	role,
	amount,
	note,
}: {
	href: string;
	role: string;
	amount: string;
	note: string;
}) {
	return (
		<li>
			<a href={href} target="_blank" rel="noopener noreferrer" className="group block py-5">
				<span className="flex items-baseline gap-3">
					<span className="font-display text-[28px] leading-none text-paper transition-colors group-hover:text-reel">
						{role}
					</span>
					<span className="mb-1 flex-1 border-b border-dotted border-paper/25" />
					<span className="font-mono text-[15px] tabular-nums text-paper/80">{amount}</span>
				</span>
				<span className="mt-2 block max-w-[34rem] text-[15px] leading-relaxed text-paper/50">
					{note}
				</span>
			</a>
		</li>
	);
}

export function SponsorSection() {
	const [dismissedSupportState, setDismissedSupportState] = useState(false);
	const supportState = useMemo(() => {
		if (typeof window === "undefined") return null;
		return getSupportReturnState(window.location.search);
	}, []);
	const supportProduct = getCreemProductById(supportState?.productId ?? null);

	return (
		<section id="sponsor" className="px-5 py-20 md:px-8 md:py-28">
			<div className="mx-auto max-w-[1240px]">
				{supportState && !dismissedSupportState ? (
					<div
						role="status"
						className={`mb-12 flex flex-col gap-3 rounded-[4px] border px-5 py-4 sm:flex-row sm:items-center ${
							supportState.status === "success"
								? "border-reel/30 bg-reel/[0.08]"
								: "border-paper/15 bg-paper/[0.04]"
						}`}
					>
						<div className="flex-1">
							<p className="text-[15px] font-medium text-paper">
								{supportState.status === "success"
									? `Thank you for supporting ScreenMint${supportProduct ? ` with ${supportProduct.name}` : ""}.`
									: "Checkout cancelled. No worries."}
							</p>
							<a
								href={SUPPORT_EMAIL_HREF}
								className="text-[13px] text-paper/55 underline-offset-4 hover:text-paper hover:underline"
							>
								{supportState.status === "success"
									? "Need billing help?"
									: "Having issues? Contact us."}
							</a>
						</div>
						<button
							type="button"
							onClick={() => setDismissedSupportState(true)}
							className="self-start font-mono text-[12px] uppercase tracking-[0.06em] text-paper/50 hover:text-paper sm:self-center"
						>
							Dismiss
						</button>
					</div>
				) : null}

				<motion.div {...reveal}>
					<Slate label="Sponsor" timecode="Credits" />
				</motion.div>

				<div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-14">
					<motion.div {...reveal} className="lg:col-span-5">
						<h2 className="font-display text-[clamp(2.5rem,4.6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-paper">
							Fund the <em className="whitespace-nowrap text-reel">next cut.</em>
						</h2>
						<p className="mt-6 max-w-[28rem] text-[17px] leading-[1.6] text-paper/60">
							{SPONSOR_MISSION}{" "}
							<span className="text-paper">No paywalls, no accounts, no telemetry.</span>
						</p>
						<a
							href={GITHUB_SPONSORS_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-9 inline-flex h-12 items-center gap-2.5 rounded-[4px] bg-reel px-5 text-[16px] font-semibold text-ink transition-colors hover:bg-[#ffc54d]"
						>
							<Heart className="h-[17px] w-[17px]" strokeWidth={2.25} />
							Sponsor on GitHub
						</a>
					</motion.div>

					<motion.div {...reveal} className="lg:col-span-7">
						<p className="font-mono text-[11px] uppercase tracking-[0.08em] text-paper/40">
							On GitHub Sponsors
						</p>
						<ul className="mt-1 divide-y divide-paper/10">
							{SPONSOR_TIERS.map((tier) => {
								const [amount, ...role] = tier.name.split(" ");
								return (
									<CreditLine
										key={tier.name}
										href={GITHUB_SPONSORS_URL}
										role={role.join(" ")}
										amount={amount}
										note={tier.description}
									/>
								);
							})}
						</ul>

						{CREEM_ENABLED ? (
							<>
								<p className="mt-10 font-mono text-[11px] uppercase tracking-[0.08em] text-paper/40">
									One time, by card
								</p>
								<ul className="mt-1 divide-y divide-paper/10">
									{CREEM_PRODUCTS.map((product) => (
										<CreditLine
											key={product.id}
											href={product.checkoutUrl}
											role={product.name.replace("ScreenMint ", "")}
											amount={product.price}
											note={product.description}
										/>
									))}
								</ul>
							</>
						) : null}
					</motion.div>
				</div>
			</div>
		</section>
	);
}
