import { CONTRIBUTING_URL, LICENSE_URL, REPO_URL } from "../lib/links";

export function Footer() {
	return (
		<footer className="border-t border-white/[0.04] bg-black">
			<div className="max-w-6xl mx-auto px-6 py-12">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
					{/* Logo & description */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2.5">
							<div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
								<img
									src="/images/screenmint-logo.svg"
									alt="ScreenMint logo"
									className="h-6 w-6 object-contain"
									loading="lazy"
								/>
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
