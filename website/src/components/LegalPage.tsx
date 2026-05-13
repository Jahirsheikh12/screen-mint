import {
	buildFundingPageHref,
	type FundingPage,
	getFundingPageContent,
	SUPPORT_EMAIL,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function LegalPage({ page }: { page: FundingPage }) {
	const content = getFundingPageContent(page);

	return (
		<div className="min-h-screen bg-[#121212] px-6 pb-16 pt-12 text-white">
			<div className="mx-auto max-w-4xl">
				<div className="mb-10 flex flex-wrap items-center justify-between gap-4">
					<Button
						asChild
						variant="outline"
						className="h-auto rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] font-normal text-white/60 shadow-none transition-colors hover:bg-white/[0.02] hover:text-white [&_svg]:size-3.5"
					>
						<a href="/">
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
								<path d="m15 18-6-6 6-6" />
							</svg>
							Back to ScreenMint
						</a>
					</Button>
					<a
						href={SUPPORT_EMAIL_HREF}
						className="text-[13px] text-white/35 transition-colors hover:text-white/65"
					>
						{SUPPORT_EMAIL}
					</a>
				</div>

				<Card className="rounded-[32px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(18,17,15,0.94)_0%,rgba(9,9,11,0.98)_100%)] p-8 shadow-none md:p-10 text-inherit">
					<p className="section-eyebrow mb-4">ScreenMint</p>
					<h1 className="section-headline mb-4">{content.title}</h1>
					<p className="section-copy max-w-2xl">{content.description}</p>

					<div className="mt-10 grid gap-4 md:grid-cols-4">
						{(["terms", "privacy", "refund", "support"] as const).map((item) => (
							<a
								key={item}
								href={buildFundingPageHref(item)}
								className={`rounded-2xl border px-4 py-3 text-[13px] transition-colors ${
									item === page
										? "border-brand-500/25 bg-brand-500/[0.08] text-brand-300"
										: "border-white/[0.06] bg-white/[0.02] text-white/45 hover:text-white/70"
								}`}
							>
								{getFundingPageContent(item).title}
							</a>
						))}
					</div>

					<div className="mt-10 flex flex-col gap-8">
						{content.sections.map((section) => (
							<Card
								key={section.title}
								className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-none md:p-7 text-inherit"
							>
								<h2 className="text-[22px] font-semibold tracking-[-0.03em] text-white">
									{section.title}
								</h2>
								<div className="mt-4 flex flex-col gap-3">
									{section.body.map((paragraph) => (
										<p key={paragraph} className="text-[15px] leading-relaxed text-white/32">
											{paragraph}
										</p>
									))}
								</div>
							</Card>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}
