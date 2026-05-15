import gsap from "gsap";
import { ChevronDown, Heart, Shield, Copy, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { DOWNLOAD_LINKS, REPO_URL } from "../lib/links";
import { GITHUB_SPONSORS_URL, SPONSOR_MISSION } from "../lib/sponsors";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type Platform = "macos" | "windows" | "linux" | "unknown";
type MacArchitecture = "apple-silicon" | "intel" | "unknown";

const XATTR_COMMAND = "xattr -rd com.apple.quarantine /Applications/ScreenMint.app";

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
			getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }>;
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
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
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
			<svg role="img" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
				<title>Linux</title>
				<path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z"/>
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

	const handleCopyXattr = async (e: React.MouseEvent) => {
		e.stopPropagation();
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
		<section ref={sectionRef} id="download" className="relative py-20 md:py-32 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-24" />

			<div className="max-w-3xl mx-auto relative z-10">
				{/* ── Heading ── */}
				<div className="dl-head text-center mb-14">
					<p className="section-eyebrow mb-4">Download</p>
					<h2 className="section-headline mb-5">
						Start recording<span className="text-brand-500">.</span>
					</h2>
					<p className="text-[16px] text-white/40 max-w-lg mx-auto leading-relaxed">
						Free, open source, and cross-platform. No account required.
					</p>
				</div>

				{/* ── Recommended platform (prominent) ── */}
				{recommended && (
					<div className="dl-rec mb-8 relative group">
						<div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
						<a href={recommended.href} className="relative block outline-none">
							<div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl transition-all duration-500 group-hover:bg-white/[0.04] group-hover:border-amber-500/30">
								<div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10 shrink-0 group-hover:scale-105 transition-transform duration-500">
									{recommended.icon}
								</div>
								<div className="flex-1 text-center sm:text-left">
									<div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
										<span className="text-xl sm:text-2xl font-bold text-white tracking-tight">{recommended.name}</span>
										<span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">Recommended</span>
									</div>
									<p className="text-white/40 text-sm">{recommended.note}</p>
								</div>
								<div className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 text-black font-semibold shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] group-hover:scale-105 group-active:scale-95 shrink-0 mt-4 sm:mt-0 w-full sm:w-auto justify-center">
									<DownloadIcon className="w-5 h-5" />
									<span>Download Free</span>
								</div>
							</div>
						</a>
					</div>
				)}

				{/* ── Other platforms ── */}
				<div className="dl-others grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
					{others.map((p) => (
						<a key={p.id} href={p.href} className="dl-other group relative outline-none">
							<div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
							<div className="relative h-full flex flex-col items-center text-center p-6 rounded-[1.25rem] bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 group-hover:border-white/[0.12] group-hover:-translate-y-1 group-hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
								<div className="w-12 h-12 mb-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/50 group-hover:text-white group-hover:scale-110 group-hover:bg-white/[0.08] transition-all duration-500 shadow-inner">
									{p.icon}
								</div>
								<h3 className="text-[15px] font-semibold text-white/80 group-hover:text-white transition-colors duration-300 mb-1.5">{p.name}</h3>
								<p className="text-[12px] text-white/30 mb-6 group-hover:text-white/50 transition-colors duration-300">{p.note}</p>
								<div className="mt-auto flex items-center gap-1.5 text-[12px] font-medium text-white/20 group-hover:text-amber-500 transition-colors duration-300">
									<DownloadIcon className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
									Download
								</div>
							</div>
						</a>
					))}
				</div>

				{/* ── Bottom section: Gatekeeper + Sponsor ── */}
				<div className="dl-bottom-wrap flex flex-col gap-4">
					{/* macOS Gatekeeper */}
					{platform === "macos" ? (
						<div className="dl-bottom">
							<div className="group rounded-[1.25rem] bg-[#0a0a0a]/80 border border-white/[0.06] overflow-hidden transition-all duration-500 hover:border-white/[0.15] hover:bg-[#0f0f0f]">
								<button onClick={() => setGatekeeperOpen(!gatekeeperOpen)} className="w-full flex items-center gap-4 p-5 sm:p-6 text-left bg-transparent cursor-pointer outline-none">
									<div className="w-10 h-10 rounded-[0.8rem] bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shrink-0 border border-blue-500/20">
										<Shield className="w-5 h-5 stroke-[1.8]" />
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="text-[14px] font-semibold text-white/80 group-hover:text-white transition-colors duration-300">macOS Gatekeeper</h4>
										<p className="text-[13px] text-white/40 mt-0.5 truncate">Move ScreenMint to /Applications and run command if needed</p>
									</div>
									<ChevronDown className={`w-5 h-5 text-white/30 transition-transform duration-500 ${gatekeeperOpen ? "rotate-180 text-white/60" : "group-hover:text-white/60"}`} />
								</button>
								
								<div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${gatekeeperOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
									<div className="overflow-hidden">
										<div className="p-5 sm:p-6 pt-0">
											<div className="relative rounded-xl bg-black border border-white/[0.08] p-4 pt-10 font-mono text-[13px] overflow-hidden group/term shadow-inner">
												<div className="absolute top-0 left-0 w-full h-8 bg-[#1a1a1a] border-b border-white/[0.05] flex items-center px-4 gap-2">
													<div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] shadow-[0_0_8px_rgba(255,95,86,0.3)]"></div>
													<div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] shadow-[0_0_8px_rgba(255,189,46,0.3)]"></div>
													<div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] shadow-[0_0_8px_rgba(39,201,63,0.3)]"></div>
													<div className="ml-2 text-[10px] text-white/20 font-sans tracking-widest uppercase">Terminal</div>
												</div>
												<div className="flex items-center justify-between gap-4 relative z-10">
													<code className="text-brand-400 flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide py-1">
														<span className="text-white/20 mr-3 select-none">$</span>
														{XATTR_COMMAND}
													</code>
													<button onClick={handleCopyXattr} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-white/[0.05] text-white/40 hover:text-white hover:bg-white/[0.1] transition-all duration-300" title="Copy command">
														{xattrCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					) : null}

					{/* Sponsor nudge */}
					<div className="dl-bottom group rounded-[1.25rem] bg-white/[0.02] border border-pink-500/10 hover:border-pink-500/20 hover:bg-pink-500/[0.02] transition-all duration-500 overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 sm:p-6 gap-5">
						<div className="flex items-start sm:items-center gap-4">
							<div className="w-10 h-10 rounded-[0.8rem] bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:scale-110 group-hover:bg-pink-500/20 transition-all duration-500 shrink-0 border border-pink-500/20">
								<Heart className="w-5 h-5 fill-pink-500/20 stroke-[1.8] group-hover:fill-pink-500/40 transition-colors" />
							</div>
							<div>
								<h4 className="text-[14px] font-semibold text-white/80 group-hover:text-white transition-colors duration-300 mb-0.5">Support Open Source</h4>
								<p className="text-[13px] text-white/40 max-w-[450px] leading-relaxed group-hover:text-white/50 transition-colors">{SPONSOR_MISSION}</p>
							</div>
						</div>
						<a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-pink-500/10 text-pink-400 text-[13px] font-semibold hover:bg-pink-500 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 border border-pink-500/20 hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]">
							<Heart className="w-3.5 h-3.5 fill-current" />
							Sponsor Project
						</a>
					</div>
				</div>

				{/* ── Badges ── */}
				<div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mt-14">
					<Badge className="bg-white/[0.03] hover:bg-white/[0.06] text-white/60 border-white/[0.08] shadow-none py-1.5 px-4 rounded-full transition-colors duration-300 font-medium text-[12px] gap-1.5">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polyline points="20 6 9 17 4 12" /></svg>
						Open Source
					</Badge>
					<Badge className="bg-white/[0.03] hover:bg-white/[0.06] text-white/60 border-white/[0.08] shadow-none py-1.5 px-4 rounded-full transition-colors duration-300 font-medium text-[12px] gap-1.5">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polyline points="20 6 9 17 4 12" /></svg>
						No Watermarks
					</Badge>
					<Button asChild variant="ghost" className="h-auto bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.08] shadow-none py-1.5 px-4 rounded-full transition-all duration-300 font-medium text-[12px] gap-1.5">
						<a href={REPO_URL} target="_blank" rel="noopener noreferrer">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							Star on GitHub
						</a>
					</Button>
				</div>
			</div>
		</section>
	);
}
