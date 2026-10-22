import { ArrowUpRight, Heart } from "lucide-react";
import { useMemo, useState } from "react";
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
import { SectionTitle } from "./Chapters";

/** Support options as one list: amount, name and what it funds, one row each. */
function TierList({
	items,
}: {
	items: { key: string; amount: string; name: string; body: string; href: string }[];
}) {
	return (
		<ul className="mx-auto max-w-[820px] divide-y divide-white/[0.07] border-y border-white/[0.07]">
			{items.map((item) => (
				<li key={item.key}>
					<a
						href={item.href}
						target="_blank"
						rel="noopener noreferrer"
						className="group grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-5 py-5 transition-colors sm:grid-cols-[5.5rem_9rem_1fr_auto]"
					>
						<span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-white">
							{item.amount}
						</span>
						<span className="text-[16px] font-semibold text-white">{item.name}</span>
						<span className="col-span-2 col-start-2 row-start-2 mt-1 text-[15px] leading-relaxed text-white/55 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0">
							{item.body}
						</span>
						<ArrowUpRight className="col-start-3 row-start-1 h-4 w-4 self-center text-white/40 transition-colors group-hover:text-white sm:col-start-4" />
					</a>
				</li>
			))}
		</ul>
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
		<section id="sponsor" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto max-w-[1120px]">
				{supportState && !dismissedSupportState ? (
					<div
						role="status"
						className={`mb-12 flex flex-col gap-3 rounded-[14px] px-5 py-4 sm:flex-row sm:items-center ${
							supportState.status === "success"
								? "bg-reel/[0.08] shadow-[inset_0_0_0_1px_rgba(255,178,26,0.35)]"
								: "bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
						}`}
					>
						<div className="flex-1">
							<p className="text-[15px] font-semibold text-white">
								{supportState.status === "success"
									? `Thank you for supporting ScreenMint${supportProduct ? ` with ${supportProduct.name}` : ""}.`
									: "Checkout cancelled. No worries."}
							</p>
							<a
								href={SUPPORT_EMAIL_HREF}
								className="text-[14px] text-white/55 underline-offset-4 hover:text-white hover:underline"
							>
								{supportState.status === "success"
									? "Need billing help?"
									: "Having issues? Contact us."}
							</a>
						</div>
						<button
							type="button"
							onClick={() => setDismissedSupportState(true)}
							className="btn-secondary h-9 self-start px-4 text-[14px] sm:self-center"
						>
							Dismiss
						</button>
					</div>
				) : null}

				<SectionTitle title="Free, because people chip in.">
					{SPONSOR_MISSION} No paywalls, no accounts, no telemetry.
				</SectionTitle>

				<div className="mt-12">
					<TierList
						items={SPONSOR_TIERS.map((tier) => {
							const [amount, ...name] = tier.name.split(" ");
							return {
								key: tier.name,
								amount,
								name: name.join(" "),
								body: tier.description,
								href: GITHUB_SPONSORS_URL,
							};
						})}
					/>
				</div>

				{CREEM_ENABLED ? (
					<div className="mt-10">
						<h3 className="text-center text-[18px] font-semibold text-white">
							Prefer a one-time card payment?
						</h3>
						<div className="mt-5">
							<TierList
								items={CREEM_PRODUCTS.map((product) => ({
									key: product.id,
									amount: product.price,
									name: product.name.replace("ScreenMint ", ""),
									body: product.description,
									href: product.checkoutUrl,
								}))}
							/>
						</div>
					</div>
				) : null}

				<div className="mt-10 flex justify-center">
					<a
						href={GITHUB_SPONSORS_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="btn-secondary h-12 px-6 text-[16px]"
					>
						<Heart className="h-[17px] w-[17px]" />
						Sponsor on GitHub
					</a>
				</div>
			</div>
		</section>
	);
}
