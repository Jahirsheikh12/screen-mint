import {
	buildFundingPageHref,
	type FundingPage,
	getFundingPageContent,
	SUPPORT_EMAIL,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";

export function LegalPage({ page }: { page: FundingPage }) {
	const content = getFundingPageContent(page);

	return (
		<div className="min-h-screen bg-black px-6 pb-16 pt-12 text-white">
			<div className="mx-auto max-w-4xl">
				<div className="mb-10 flex flex-wrap items-center justify-between gap-4">
					<a
						href="/"
						className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-white/60 transition-colors hover:text-white"
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
							<path d="m15 18-6-6 6-6" />
						</svg>
						Back to ScreenMint
					</a>
					<a
						href={SUPPORT_EMAIL_HREF}
						className="text-[13px] text-white/35 transition-colors hover:text-white/65"
					>
						{SUPPORT_EMAIL}
					</a>
				</div>

				<div className="rounded-[32px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(18,17,15,0.94)_0%,rgba(9,9,11,0.98)_100%)] p-8 md:p-10">
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

					<div className="mt-10 space-y-8">
						{content.sections.map((section) => (
							<section
								key={section.title}
								className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-7"
							>
								<h2 className="text-[22px] font-semibold tracking-[-0.03em] text-white">
									{section.title}
								</h2>
								<div className="mt-4 space-y-3">
									{section.body.map((paragraph) => (
										<p key={paragraph} className="text-[15px] leading-relaxed text-white/32">
											{paragraph}
										</p>
									))}
								</div>
							</section>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
