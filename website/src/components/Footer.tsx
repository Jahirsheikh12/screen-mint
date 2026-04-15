import { CONTRIBUTING_URL, LICENSE_URL, REPO_URL } from "../lib/links";
import {
	buildFundingPageHref,
	CREEM_ENABLED,
	GITHUB_SPONSORS_URL,
	SUPPORT_EMAIL,
	SUPPORT_EMAIL_HREF,
} from "../lib/sponsors";

export function Footer() {
	return (
		<footer className="border-t border-white/[0.06] bg-[#121212]">
			<div className="max-w-6xl mx-auto px-6 py-12">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
					{/* Logo & description */}
					<div className="flex flex-col gap-3">
						<div className="inline-flex w-fit items-center gap-3 rounded-[22px] bg-[linear-gradient(180deg,rgba(18,17,15,0.92)_0%,rgba(10,10,12,0.96)_100%)] px-4 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
							<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
								<img
									src="/images/screenmint-mark.svg"
									alt="ScreenMint mark"
									className="h-8 w-8 object-contain"
									loading="lazy"
								/>
							</span>
							<span className="text-[18px] font-semibold tracking-[-0.03em] text-[#f4ebdd]">
								Screen<span className="text-[#d1a86a]">Mint</span>
							</span>
						</div>
						<p className="text-[12px] text-white/20 max-w-[280px] leading-relaxed">
							Free, open-source screen recorder and editor. Record once, polish to perfection.
						</p>
					</div>

					{/* Links */}
					<div className="flex gap-12">
						<div className="flex flex-col gap-2.5">
							<span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">
								Product
							</span>
							<a
								href="#features"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Features
							</a>
							<a
								href="#download"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Download
							</a>
							<a
								href="#how-it-works"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								How it works
							</a>
						</div>

						<div className="flex flex-col gap-2.5">
							<span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">
								Community
							</span>
							<a
								href={GITHUB_SPONSORS_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Sponsor
							</a>
							<a
								href={REPO_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								GitHub
							</a>
							<a
								href={LICENSE_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								License
							</a>
							<a
								href={CONTRIBUTING_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Contributing
							</a>
						</div>

						<div className="flex flex-col gap-2.5">
							<span className="text-[11px] text-white/25 uppercase tracking-wider font-medium">
								Support
							</span>
							{CREEM_ENABLED ? (
								<a
									href="#sponsor"
									className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
								>
									Support via Card
								</a>
							) : null}
							<a
								href={buildFundingPageHref("terms")}
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Terms
							</a>
							<a
								href={buildFundingPageHref("privacy")}
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Privacy
							</a>
							<a
								href={buildFundingPageHref("refund")}
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Refund
							</a>
							<a
								href={buildFundingPageHref("support")}
								className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
							>
								Support
							</a>
						</div>
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
					<div className="flex flex-col items-center gap-1 md:items-start">
						<p className="text-[11px] text-white/15">Built with Electron, React, and PIXI.js</p>
						<a
							href={SUPPORT_EMAIL_HREF}
							className="text-[11px] text-white/22 transition-colors hover:text-white/45"
						>
							Support: {SUPPORT_EMAIL}
						</a>
					</div>
					<p className="text-[11px] text-white/15">
						&copy; {new Date().getFullYear()} ScreenMint. Open source under MIT License.
					</p>
				</div>
			</div>

			{/* Large fading brand text */}
			<div className="relative overflow-hidden pt-12 pb-8">
				<div className="flex justify-center select-none pointer-events-none">
					<span
						className="text-[clamp(5rem,16vw,13rem)] font-black tracking-[-0.04em] leading-none"
						style={{
							background:
								"linear-gradient(180deg, rgba(245, 158, 11, 0.35) 0%, rgba(245, 158, 11, 0.15) 40%, rgba(245, 158, 11, 0.04) 75%, transparent 100%)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						ScreenMint
					</span>
				</div>
			</div>
		</footer>
	);
}
