import gsap from "gsap";
import { ChevronDown, Heart, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { DOWNLOAD_LINKS, REPO_URL } from "../lib/links";
import { GITHUB_SPONSORS_URL, SPONSOR_MISSION } from "../lib/sponsors";

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

/* ── Platform definitions ── */
const allPlatforms = [
	{
		id: "mac-arm",
		name: "Apple Silicon",
		href: DOWNLOAD_LINKS.macAppleSilicon,
		note: "M1 / M2 / M3 / M4",
		icon: (
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
		),
	},
	{
		id: "mac-intel",
		name: "Intel Mac",
		href: DOWNLOAD_LINKS.macIntel,
		note: "macOS 12+",
		icon: (
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
				<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
			</svg>
		),
	},
	{
		id: "windows",
		name: "Windows",
		href: DOWNLOAD_LINKS.windows,
		note: "Windows 10+",
		icon: (
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
			</svg>
		),
	},
	{
		id: "linux",
		name: "Linux",
		href: DOWNLOAD_LINKS.linux,
		note: "AppImage",
		icon: (
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12.504 0c-.155 0-.311.002-.465.006C8.754.083 5.94 1.654 4.476 4.236c-1.45 2.554-1.572 5.676-.335 8.554.071.165.138.333.21.497l.01.02c.008.016.02.035.03.055L6.3 17.05c.182.336.393.652.63.943.126.154.263.3.407.437l.014.013c.098.092.2.18.306.264l.026.021c.083.066.17.128.258.187l.022.015c.081.053.165.103.251.15l.021.012c.077.042.157.08.238.116l.019.009c.084.036.17.069.257.099l.019.007c.08.027.162.051.245.073l.019.005c.084.021.17.04.257.055l.018.003c.09.015.182.026.274.035l.02.002c.09.008.18.013.272.016h.019c.092.002.185.002.278-.002l.026-.002c.091-.005.182-.014.272-.027l.028-.004c.086-.014.171-.032.255-.054l.025-.007c.085-.024.168-.052.25-.083l.021-.008c.085-.034.168-.072.249-.113l.017-.009c.085-.044.167-.093.247-.145l.013-.009c.086-.056.169-.117.249-.183l.009-.007c.089-.072.174-.15.255-.232l.003-.003c.105-.108.202-.224.29-.346.25-.344.458-.714.625-1.107l1.903-3.696.01-.02c.073-.144.141-.293.204-.445 1.236-2.879 1.115-6-.335-8.555C18.073 1.656 15.259.085 11.973.006 11.815.002 11.66 0 11.504 0h1zm0 0" />
			</svg>
		),
	},
];

function getRecommendedId(platform: Platform, macArch: MacArchitecture): string | null {
	if (platform === "macos") {
		if (macArch === "apple-silicon") return "mac-arm";
		if (macArch === "intel") return "mac-intel";
		return null;
	}
	if (platform === "windows") return "windows";
	if (platform === "linux") return "linux";
	return null;
}

/* ── Download icon ── */
function DownloadIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	);
}

export function Download() {
	const [platform, setPlatform] = useState<Platform>("unknown");
	const [macArch, setMacArch] = useState<MacArchitecture>("unknown");
	const [xattrCopied, setXattrCopied] = useState(false);
	const [gatekeeperOpen, setGatekeeperOpen] = useState(false);
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const detected = detectPlatform();
		setPlatform(detected);
		if (detected === "macos") {
			void detectMacArchitecture().then(setMacArch);
			setGatekeeperOpen(true);
		}
	}, []);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".dl-head",
				{ opacity: 0, y: 24 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power3.out",
					scrollTrigger: { trigger: ".dl-head", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".dl-rec",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power3.out",
					scrollTrigger: { trigger: ".dl-rec", start: "top 88%", once: true },
				},
			);

			gsap.fromTo(
				".dl-other",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.5,
					stagger: 0.06,
					ease: "power3.out",
					scrollTrigger: { trigger: ".dl-others", start: "top 88%", once: true },
				},
			);

			gsap.fromTo(
				".dl-bottom",
				{ opacity: 0, y: 16 },
				{
					opacity: 1,
					y: 0,
					duration: 0.5,
					stagger: 0.08,
					ease: "power3.out",
					scrollTrigger: { trigger: ".dl-bottom-wrap", start: "top 90%", once: true },
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
	const recommended = allPlatforms.find((p) => p.id === recommendedId);
	const others = allPlatforms.filter((p) => p.id !== recommendedId);

	return (
		<section ref={sectionRef} id="download" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-3xl mx-auto">
				{/* ── Heading ── */}
				<div className="dl-head text-center mb-12">
					<p className="section-eyebrow mb-4">Download</p>
					<h2 className="section-headline mb-4">
						Start recording<span className="text-brand-500">.</span>
					</h2>
					<p className="text-[15px] text-white/30 max-w-md mx-auto leading-relaxed">
						Free, open source, and cross-platform. No account required.
					</p>
				</div>

				{/* ── Recommended platform (prominent) ── */}
				{recommended && (
					<a href={recommended.href} className="dl-rec dl-card-rec group block mb-4">
						<div className="flex items-center gap-5">
							<div className="dl-card-rec-icon">{recommended.icon}</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2.5 mb-1">
									<span className="text-[16px] font-semibold text-white">{recommended.name}</span>
									<span className="dl-rec-badge">Recommended</span>
								</div>
								<p className="text-[13px] text-white/30">{recommended.note}</p>
							</div>
							<div className="dl-card-rec-dl group-hover:translate-y-0.5 transition-transform duration-300">
								<DownloadIcon />
								<span>Download</span>
							</div>
						</div>
					</a>
				)}

				{/* ── Other platforms ── */}
				<div className="dl-others grid grid-cols-3 gap-3 mb-8">
					{others.map((p) => (
						<a key={p.id} href={p.href} className="dl-other dl-card-alt group">
							<div className="dl-card-alt-icon">{p.icon}</div>
							<p className="text-[14px] font-medium text-white/65 group-hover:text-white/90 transition-colors duration-300">
								{p.name}
							</p>
							<p className="text-[11px] text-white/20 mb-3">{p.note}</p>
							<div className="mt-auto flex items-center gap-1.5 text-[11px] font-medium text-white/20 group-hover:text-white/45 transition-colors duration-300">
								<DownloadIcon className="transition-transform duration-300 group-hover:translate-y-0.5" />
								Download
							</div>
						</a>
					))}
				</div>

				{/* ── Bottom section: Gatekeeper + Sponsor ── */}
				<div className="dl-bottom-wrap space-y-3">
					{/* macOS Gatekeeper */}
					{platform === "macos" ? (
						<div className="dl-bottom">
							<button
								type="button"
								onClick={() => setGatekeeperOpen(!gatekeeperOpen)}
								className="dl-gatekeeper-card w-full text-left"
							>
								<div className="flex items-center gap-3">
									<div className="dl-gatekeeper-icon">
										<Shield className="w-4 h-4 text-brand-400/60" strokeWidth={1.8} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-[13px] font-medium text-white/50">macOS Gatekeeper</p>
										<p className="text-[11px] text-white/20 mt-0.5">
											Unsigned app — run this Terminal command to unblock
										</p>
									</div>
									<ChevronDown
										className={`w-4 h-4 text-white/15 flex-shrink-0 transition-transform duration-300 ${gatekeeperOpen ? "rotate-180" : ""}`}
										strokeWidth={2}
									/>
								</div>

								{/* Expandable command */}
								<div
									className={`dl-gatekeeper-expand ${gatekeeperOpen ? "dl-gatekeeper-expand--open" : ""}`}
								>
									<div className="overflow-hidden">
										<div className="dl-gatekeeper-cmd mt-4" onClick={(e) => e.stopPropagation()}>
											<code className="text-[13px] text-brand-400/80 font-mono flex-1">
												<span className="text-white/15 mr-2 select-none">$</span>
												{XATTR_COMMAND}
											</code>
											<button
												type="button"
												onClick={handleCopyXattr}
												className="dl-gatekeeper-copy"
												title="Copy command"
											>
												{xattrCopied ? (
													<svg
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="#F59E0B"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<polyline points="20 6 9 17 4 12" />
													</svg>
												) : (
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
														<rect x="9" y="9" width="13" height="13" rx="2" />
														<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
													</svg>
												)}
											</button>
										</div>
									</div>
								</div>
							</button>
						</div>
					) : null}

					{/* Sponsor nudge */}
					<div className="dl-bottom dl-sponsor-card">
						<div className="flex items-center gap-3">
							<div className="dl-sponsor-icon">
								<Heart className="w-4 h-4 text-brand-400/60" strokeWidth={1.8} />
							</div>
							<p className="flex-1 text-[13px] text-white/25 leading-relaxed">{SPONSOR_MISSION}</p>
							<a
								href={GITHUB_SPONSORS_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="dl-sponsor-btn group"
							>
								<Heart
									className="w-3 h-3 transition-transform duration-300 group-hover:scale-110"
									strokeWidth={2.5}
								/>
								Sponsor
							</a>
						</div>
					</div>
				</div>

				{/* ── Badges ── */}
				<div className="flex items-center justify-center gap-2 flex-wrap mt-10">
					<span className="dl-badge dl-badge--brand">
						<svg
							width="9"
							height="9"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
						Open Source
					</span>
					<span className="dl-badge dl-badge--muted">
						<svg
							width="9"
							height="9"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
						No Watermarks
					</span>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="dl-badge dl-badge--muted hover:text-white/45 transition-colors duration-300"
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
