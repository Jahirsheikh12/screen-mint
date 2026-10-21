import { ArrowDown, Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { DOWNLOAD_LINKS } from "../lib/links";
import { reveal } from "../lib/motion";
import {
	detectMacArchitecture,
	detectPlatform,
	type MacArchitecture,
	type Platform,
} from "../lib/platform";
import { AppleIcon, LinuxIcon, WindowsIcon } from "./BrandIcons";
import { Slate } from "./Chapters";

const XATTR_COMMAND = "xattr -rd com.apple.quarantine /Applications/ScreenMint.app";

const allPlatforms = [
	{
		id: "mac-arm",
		name: "macOS, Apple Silicon",
		href: DOWNLOAD_LINKS.macAppleSilicon,
		note: "M1 and newer · .dmg",
		Icon: AppleIcon,
	},
	{
		id: "mac-intel",
		name: "macOS, Intel",
		href: DOWNLOAD_LINKS.macIntel,
		note: "macOS 12.3+ · .dmg",
		Icon: AppleIcon,
	},
	{
		id: "windows",
		name: "Windows",
		href: DOWNLOAD_LINKS.windows,
		note: "Windows 10+ · .exe",
		Icon: WindowsIcon,
	},
	{
		id: "linux",
		name: "Linux",
		href: DOWNLOAD_LINKS.linux,
		note: "x64 · .AppImage",
		Icon: LinuxIcon,
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

export function Download() {
	const [platform, setPlatform] = useState<Platform>("unknown");
	const [macArch, setMacArch] = useState<MacArchitecture>("unknown");
	const [xattrCopied, setXattrCopied] = useState(false);

	useEffect(() => {
		const detected = detectPlatform();
		setPlatform(detected);
		if (detected === "macos") void detectMacArchitecture().then(setMacArch);
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
	const queue = [...allPlatforms].sort(
		(a, b) => Number(b.id === recommendedId) - Number(a.id === recommendedId),
	);

	return (
		<section id="download" className="px-5 py-20 md:px-8 md:py-28">
			<div className="mx-auto max-w-[1240px]">
				<motion.div {...reveal}>
					<Slate label="Download" timecode="Latest release" />
				</motion.div>

				<div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-14">
					<motion.div {...reveal} className="lg:col-span-5">
						<h2 className="font-display text-[clamp(2.5rem,4.6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-paper">
							Grab the <em className="whitespace-nowrap text-reel">final cut.</em>
						</h2>
						<p className="mt-6 max-w-[28rem] text-[17px] leading-[1.6] text-paper/60">
							Every build is the full app, straight from the latest GitHub release. Nothing to sign
							up for.
						</p>

						{platform === "macos" ? (
							<div className="mt-10 max-w-[30rem]">
								<p className="text-[15px] font-medium text-paper">
									macOS says the app can&apos;t be opened?
								</p>
								<p className="mt-1 text-[14px] leading-relaxed text-paper/55">
									Move ScreenMint to /Applications, then run this once in Terminal.
								</p>
								<div className="mt-3 flex items-stretch overflow-hidden rounded-[4px] border border-paper/[0.12] bg-black/40">
									<code className="min-w-0 flex-1 break-all px-4 py-3 leading-relaxed font-mono text-[12.5px] text-paper/85">
										<span className="mr-2 select-none text-reel">$</span>
										{XATTR_COMMAND}
									</code>
									<button
										type="button"
										onClick={handleCopyXattr}
										aria-label="Copy command"
										className="flex w-11 shrink-0 items-center justify-center border-l border-paper/[0.12] text-paper/55 transition-colors hover:text-paper"
									>
										{xattrCopied ? (
											<Check className="h-4 w-4 text-reel" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
						) : null}
					</motion.div>

					<motion.div {...reveal} className="lg:col-span-7">
						<div className="grid grid-cols-[1fr_auto] border-b border-paper/15 pb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-paper/40">
							<span>Build</span>
							<span>Get</span>
						</div>
						<ul>
							{queue.map((p) => {
								const isRecommended = p.id === recommendedId;
								return (
									<li key={p.id}>
										<a
											href={p.href}
											className={`group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-paper/10 py-5 pl-4 pr-1 transition-colors hover:bg-paper/[0.03] ${
												isRecommended ? "bg-reel/[0.07]" : ""
											}`}
										>
											<p.Icon className="h-5 w-5 text-paper/70" />
											<span>
												<span className="block text-[17px] font-medium text-paper">
													{p.name}
													{isRecommended ? (
														<span className="ml-3 font-mono text-[11px] uppercase tracking-[0.08em] text-reel">
															This computer
														</span>
													) : null}
												</span>
												<span className="mt-0.5 block font-mono text-[12px] text-paper/45">
													{p.note}
												</span>
											</span>
											<span
												className={`flex h-10 w-10 items-center justify-center rounded-[4px] transition-colors ${
													isRecommended
														? "bg-reel text-ink"
														: "border border-paper/15 text-paper/60 group-hover:border-reel group-hover:text-reel"
												}`}
											>
												<ArrowDown className="h-[18px] w-[18px]" />
												<span className="sr-only">Download {p.name}</span>
											</span>
										</a>
									</li>
								);
							})}
						</ul>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
