import { CONTRIBUTING_URL, LICENSE_URL, REPO_URL } from "../lib/links";

export function Footer() {
	return (
		<footer className="border-t border-white/[0.04] bg-[#1d1d1f]">
			<div className="max-w-6xl mx-auto px-6 py-12">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
					{/* Logo & description */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2.5">
							<div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="white"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<polygon points="10 8 16 12 10 16 10 8" fill="white" stroke="none" />
								</svg>
							</div>
							<span className="text-sm font-bold text-white/80">ScreenMint</span>
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
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
					<p className="text-[11px] text-white/15">Built with Electron, React, and PIXI.js</p>
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
								"linear-gradient(180deg, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.15) 40%, rgba(16, 185, 129, 0.04) 75%, transparent 100%)",
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
