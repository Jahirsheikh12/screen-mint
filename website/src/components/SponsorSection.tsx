import { ArrowUpRight, Bug, Code2, Heart, Languages, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { CONTRIBUTING_URL, REPO_URL } from "../lib/links";
import {
	CREEM_ENABLED,
	CREEM_PRODUCTS,
	GITHUB_SPONSORS_URL,
	getCreemProductById,
	getSupportReturnState,
	SPONSOR_FAQS,
	SPONSOR_MISSION,
	SPONSOR_TIERS,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";
import { Details, SectionTitle } from "./Chapters";

/** Ways to help that cost nothing. */
const OTHER_HELP = [
	{
		label: "Star the repo",
		body: "Helps other people find ScreenMint.",
		href: REPO_URL,
		Icon: Star,
	},
	{
		label: "Report a bug",
		body: "Tell us what broke and how to see it.",
		href: `${REPO_URL}/issues/new/choose`,
		Icon: Bug,
	},
	{
		label: "Translate the app",
		body: "Add or improve a language.",
		href: `${REPO_URL}/blob/main/TRANSLATION_GUIDE.md`,
		Icon: Languages,
	},
	{
		label: "Contribute code",
		body: "Start with the contributing guide.",
		href: CONTRIBUTING_URL,
		Icon: Code2,
	},
];

/** A price, its name and what it funds. `period` is shown after the amount ("/month"). */
function PriceRow({
	amount,
	period,
	name,
	body,
}: {
	amount: string;
	period?: string;
	name: string;
	body: string;
}) {
	return (
		<div className="grid grid-cols-[5.5rem_1fr] gap-x-5 py-5 sm:grid-cols-[7rem_1fr]">
			<p className="whitespace-nowrap">
				<span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-white">
					{amount}
				</span>
				{period ? <span className="ml-1 text-[14px] text-white/45">{period}</span> : null}
			</p>
			<div>
				<p className="text-[16px] font-semibold text-white">{name}</p>
				<p className="mt-1 text-[15px] leading-relaxed text-white/55">{body}</p>
			</div>
		</div>
	);
}

export function SponsorSection() {
	const [dismissedSupportState, setDismissedSupportState] = useState(false);
	// Read after mount: the page is pre-rendered without a URL, so render must not depend on it.
	const [supportState, setSupportState] = useState<ReturnType<typeof getSupportReturnState>>(null);
	useEffect(() => setSupportState(getSupportReturnState(window.location.search)), []);
	const supportProduct = getCreemProductById(supportState?.productId ?? null);

	return (
		<section id="sponsor" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto max-w-[1120px]">
				{supportState && !dismissedSupportState ? (
					<div
						role="status"
						className={`mx-auto mb-12 flex max-w-[1000px] flex-col gap-3 rounded-[14px] px-5 py-4 sm:flex-row sm:items-center ${
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

				{/* One way to pay, one button: the amounts are a price list, not separate links */}
				<div className="mx-auto mt-12 grid max-w-[1000px] overflow-hidden rounded-[22px] bg-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
					<div className="flex flex-col p-7 md:p-10">
						<h3 className="text-[20px] font-semibold leading-[1.3] tracking-[-0.02em] text-white">
							Sponsor monthly on GitHub
						</h3>
						<p className="mt-3 text-pretty text-[16px] leading-[1.6] text-white/55">
							Choose an amount on GitHub Sponsors. It renews each month, and you can cancel any time
							from GitHub.
						</p>
						<div className="mt-8 lg:mt-auto lg:pt-10">
							<a
								href={GITHUB_SPONSORS_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="btn-secondary h-12 w-full px-6 text-[16px] sm:w-auto"
							>
								<Heart className="h-[17px] w-[17px]" />
								Sponsor on GitHub
								<ArrowUpRight className="h-4 w-4 text-white/50" />
							</a>
							<p className="mt-3 text-[14px] text-white/45">Payments are handled by GitHub.</p>
						</div>
					</div>

					<div className="border-t border-white/[0.07] px-7 py-3 md:px-10 md:py-5 lg:border-l lg:border-t-0">
						<div className="divide-y divide-white/[0.07]">
							{SPONSOR_TIERS.map((tier) => {
								const [amount, ...name] = tier.name.split(" ");
								return (
									<PriceRow
										key={tier.name}
										amount={amount}
										period="/month"
										name={name.join(" ")}
										body={tier.description}
									/>
								);
							})}
						</div>
					</div>
				</div>

				{CREEM_ENABLED ? (
					<div className="mx-auto mt-4 max-w-[1000px] rounded-[22px] bg-ink-2 px-7 py-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] md:px-10">
						<h3 className="text-[18px] font-semibold text-white">Or give once by card</h3>
						<ul className="mt-2 divide-y divide-white/[0.07]">
							{CREEM_PRODUCTS.map((product) => (
								<li key={product.id}>
									<a
										href={product.checkoutUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="group flex items-center gap-4"
									>
										<div className="flex-1">
											<PriceRow
												amount={product.price}
												name={product.name.replace("ScreenMint ", "")}
												body={product.description}
											/>
										</div>
										<ArrowUpRight className="h-4 w-4 shrink-0 text-white/40 transition-colors group-hover:text-white" />
									</a>
								</li>
							))}
						</ul>
					</div>
				) : null}

				<div className="mx-auto mt-16 max-w-[1000px]">
					<h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">
						No budget? Help another way.
					</h3>
					<ul className="mt-5 grid overflow-hidden rounded-[16px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] sm:grid-cols-2 lg:grid-cols-4">
						{OTHER_HELP.map(({ label, body, href, Icon }) => (
							<li
								key={label}
								className="border-white/[0.07] [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l lg:border-t-0 lg:[&:not(:first-child)]:border-l"
							>
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className="group flex h-full flex-col p-5 transition-colors hover:bg-white/[0.03]"
								>
									<span className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
										<Icon className="h-4 w-4 text-white/55" />
										{label}
										<ArrowUpRight className="ml-auto h-4 w-4 text-white/35 transition-colors group-hover:text-white" />
									</span>
									<span className="mt-1.5 text-[14px] leading-relaxed text-white/50">{body}</span>
								</a>
							</li>
						))}
					</ul>
				</div>

				<div className="mx-auto mt-16 max-w-[1000px]">
					<h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">
						Before you sponsor
					</h3>
				</div>
				<Details
					className="mt-5"
					items={SPONSOR_FAQS.map((faq) => ({ title: faq.question, body: faq.answer }))}
				/>
			</div>
		</section>
	);
}
