import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { DOWNLOAD_LINKS, REPO_URL } from "../lib/links";

type Platform = "macos" | "windows" | "linux" | "unknown";
type MacArchitecture = "apple-silicon" | "intel" | "unknown";

const XATTR_COMMAND = "xattr -cr /Applications/ScreenMint.app";

function detectPlatform(): Platform {
	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes("mac")) return "macos";
	if (ua.includes("win")) return "windows";
	if (ua.includes("linux")) return "linux";
	return "unknown";
}

async function detectMacArchitecture(): Promise<MacArchitecture> {
	type NavigatorWithUAData = Navigator & {
		userAgentData?: {
			getHighEntropyValues?: (
				hints: string[],
			) => Promise<{ architecture?: string; platform?: string }>;
		};
	};

	const typedNavigator = navigator as NavigatorWithUAData;

	try {
		const highEntropyValues = await typedNavigator.userAgentData?.getHighEntropyValues?.([
			"architecture",
			"platform",
		]);
		const architecture = highEntropyValues?.architecture?.toLowerCase();

		if (architecture?.includes("arm")) return "apple-silicon";
		if (architecture?.includes("x86")) return "intel";
	} catch {
		// Fall back to user agent sniffing below.
	}

	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes("arm") || ua.includes("aarch64") || ua.includes("apple silicon")) {
		return "apple-silicon";
	}

	return "unknown";
}

const platforms = [
	{
		id: "mac-arm",
		name: "Apple Silicon",
		os: "macOS",
		href: DOWNLOAD_LINKS.macAppleSilicon,
		note: "M1 / M2 / M3 / M4",
		icon: (
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
		),
	},
	{
		id: "mac-intel",
		name: "Intel Mac",
		os: "macOS",
		href: DOWNLOAD_LINKS.macIntel,
		note: "macOS 12+",
		icon: (
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
		),
	},
	{
		id: "windows",
		name: "Windows",
		os: "Windows",
		href: DOWNLOAD_LINKS.windows,
		note: "Windows 10+",
		icon: (
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
				<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
			</svg>
		),
	},
	{
		id: "linux",
		name: "Linux",
		os: "Linux",
		href: DOWNLOAD_LINKS.linux,
		note: "AppImage",
		icon: (
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12.504 0c-.155 0-.311.002-.465.006C8.754.083 5.94 1.654 4.476 4.236c-1.45 2.554-1.572 5.676-.335 8.554.071.165.138.333.21.497l.01.02c.008.016.02.035.03.055L6.3 17.05c.182.336.393.652.63.943.126.154.263.3.407.437l.014.013c.098.092.2.18.306.264l.026.021c.083.066.17.128.258.187l.022.015c.081.053.165.103.251.15l.021.012c.077.042.157.08.238.116l.019.009c.084.036.17.069.257.099l.019.007c.08.027.162.051.245.073l.019.005c.084.021.17.04.257.055l.018.003c.09.015.182.026.274.035l.02.002c.09.008.18.013.272.016h.019c.092.002.185.002.278-.002l.026-.002c.091-.005.182-.014.272-.027l.028-.004c.086-.014.171-.032.255-.054l.025-.007c.085-.024.168-.052.25-.083l.021-.008c.085-.034.168-.072.249-.113l.017-.009c.085-.044.167-.093.247-.145l.013-.009c.086-.056.169-.117.249-.183l.009-.007c.089-.072.174-.15.255-.232l.003-.003c.105-.108.202-.224.29-.346.25-.344.458-.714.625-1.107l1.903-3.696.01-.02c.073-.144.141-.293.204-.445 1.236-2.879 1.115-6-.335-8.555C18.073 1.656 15.259.085 11.973.006 11.815.002 11.66 0 11.504 0h1zm0 0" />
			</svg>
		),
	},
];

function getRecommendedId(
	platform: Platform,
	macArch: MacArchitecture,
): string | null {
	if (platform === "macos") {
		if (macArch === "apple-silicon") return "mac-arm";
		if (macArch === "intel") return "mac-intel";
		return "mac-arm";
	}
	if (platform === "windows") return "windows";
	if (platform === "linux") return "linux";
	return null;
}

export function Download() {
	const [platform, setPlatform] = useState<Platform>("unknown");
	const [macArch, setMacArch] = useState<MacArchitecture>("unknown");
	const [xattrCopied, setXattrCopied] = useState(false);
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const detected = detectPlatform();
		setPlatform(detected);
		if (detected === "macos") {
			void detectMacArchitecture().then(setMacArch);
		}
	}, []);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".dl-heading",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: { trigger: ".dl-heading", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".dl-card",
				{ opacity: 0, y: 25 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					stagger: 0.08,
					ease: "power2.out",
					scrollTrigger: { trigger: ".dl-grid", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".dl-footer",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: { trigger: ".dl-footer", start: "top 90%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	const handleCopyXattr = async () => {
		try {
			await navigator.clipboard.writeText(XATTR_COMMAND);
			setXattrCopied(true);
			setTimeout(() => setXattrCopied(false), 2000);
		} catch {
			// clipboard not available
		}
	};

	const recommendedId = getRecommendedId(platform, macArch);

	return (
		<section ref={sectionRef} id="download" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-4xl mx-auto">
				{/* Heading */}
				<div className="dl-heading text-center mb-14 will-animate">
					<p className="section-eyebrow mb-4">Download</p>
					<h2 className="section-headline mb-4">
						Start recording<span className="text-brand-500">.</span>
					</h2>
					<p className="text-[15px] text-white/30 max-w-md mx-auto leading-relaxed">
						Free and open source. No account, no watermarks, no limits.
					</p>
				</div>

				{/* Platform grid */}
				<div className="dl-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
					{platforms.map((p) => {
						const isRecommended = p.id === recommendedId;
						return (
							<a
								key={p.id}
								href={p.href}
								className={`dl-card group relative flex flex-col items-center gap-3 rounded-2xl p-6 md:p-8 text-center transition-all duration-300 will-animate ${
									isRecommended
										? "border border-brand-500/20 bg-brand-500/[0.04] hover:bg-brand-500/[0.08]"
										: "border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
								}`}
							>
								{isRecommended ? (
									<span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
										Recommended
									</span>
								) : null}

								<div
									className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
										isRecommended
											? "bg-brand-500/10 text-brand-400"
											: "bg-white/[0.04] text-white/40 group-hover:text-white/70"
									}`}
								>
									{p.icon}
								</div>

								<div>
									<p className={`text-[15px] font-semibold ${isRecommended ? "text-white" : "text-white/70"}`}>
										{p.name}
									</p>
									<p className="text-[11px] text-white/20 mt-0.5">{p.note}</p>
								</div>

								<div className={`mt-auto pt-2 text-[12px] font-medium ${isRecommended ? "text-brand-400" : "text-white/25 group-hover:text-white/50"} transition-colors duration-300 flex items-center gap-1.5`}>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="transition-transform duration-300 group-hover:translate-y-0.5"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="7 10 12 15 17 10" />
										<line x1="12" y1="15" x2="12" y2="3" />
									</svg>
									Download
								</div>
							</a>
						);
					})}
				</div>

				{/* macOS Gatekeeper tip */}
				<div className="dl-footer rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 md:p-6 will-animate">
					<div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
						<div className="flex items-center gap-3 flex-shrink-0">
							<div className="w-8 h-8 rounded-lg bg-amber-500/8 border border-amber-500/10 flex items-center justify-center">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
								</svg>
							</div>
							<div>
								<p className="text-[13px] font-medium text-white/60">macOS Gatekeeper</p>
								<p className="text-[11px] text-white/20">Run in Terminal to unblock</p>
							</div>
						</div>

						<div className="command-block flex-1 flex items-center justify-between rounded-lg bg-black border border-white/[0.04] px-4 py-2.5">
							<code className="text-[12px] text-brand-400/80 font-mono">
								<span className="text-white/10 mr-2">$</span>
								{XATTR_COMMAND}
							</code>
							<button
								type="button"
								onClick={handleCopyXattr}
								className="command-copy ml-4 p-1.5 rounded text-white/20 hover:text-white/40 hover:bg-white/[0.03] transition-all flex-shrink-0"
								title="Copy xattr command"
							>
								{xattrCopied ? (
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<rect x="9" y="9" width="13" height="13" rx="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								)}
							</button>
						</div>
					</div>
				</div>

				{/* Badges */}
				<div className="flex items-center justify-center gap-3 flex-wrap mt-8">
					<span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-500/10 bg-brand-500/[0.04] text-brand-400 text-[11px] font-medium">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
						Open Source
					</span>
					<span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] text-white/25 text-[11px] font-medium">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
						No Watermarks
					</span>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] text-white/25 text-[11px] font-medium hover:text-white/50 transition-colors duration-300"
					>
						<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
						</svg>
						Star on GitHub
					</a>
				</div>
			</div>
		</section>
	);
}
