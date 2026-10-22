import { Check, Copy, Download as DownloadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DOWNLOAD_LINKS, REPO_URL } from "../lib/links";
import {
	detectMacArchitecture,
	detectPlatform,
	type MacArchitecture,
	type Platform,
} from "../lib/platform";
import { AppleIcon, GitHubIcon, LinuxIcon, WindowsIcon } from "./BrandIcons";
import { SectionTitle } from "./Chapters";

const XATTR_COMMAND = "xattr -rd com.apple.quarantine /Applications/ScreenMint.app";

const allPlatforms = [
	{
		id: "mac-arm",
		name: "macOS",
		chip: "Apple Silicon",
		href: DOWNLOAD_LINKS.macAppleSilicon,
		note: "M1 or newer · .dmg",
		Icon: AppleIcon,
	},
	{
		id: "mac-intel",
		name: "macOS",
		chip: "Intel",
		href: DOWNLOAD_LINKS.macIntel,
		note: "macOS 12.3+ · .dmg",
		Icon: AppleIcon,
	},
	{
		id: "windows",
		name: "Windows",
		chip: "x64",
		href: DOWNLOAD_LINKS.windows,
		note: "Windows 10+ · .exe",
		Icon: WindowsIcon,
	},
	{
		id: "linux",
		name: "Linux",
		chip: "x64",
		href: DOWNLOAD_LINKS.linux,
		note: "Modern distros · .AppImage",
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

	return (
		<section id="download" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto max-w-[1120px]">
				<SectionTitle title="Download ScreenMint">
					The full app, free on every platform. Builds come straight from the latest GitHub release,
					and there is nothing to sign up for.
				</SectionTitle>

				<ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{allPlatforms.map((p) => {
						const isRecommended = p.id === recommendedId;
						return (
							<li key={p.id}>
								<a
									href={p.href}
									className={`group flex h-full flex-col rounded-[16px] p-5 transition-colors ${
										isRecommended
											? "bg-reel/[0.08] shadow-[inset_0_0_0_1px_rgba(255,178,26,0.55)]"
											: "bg-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] hover:bg-ink-3"
									}`}
								>
									<span className="flex items-center justify-between">
										<p.Icon className="h-6 w-6 text-white" />
										{isRecommended ? (
											<span className="rounded-full bg-reel/15 px-2.5 py-1 text-[12px] font-medium text-reel">
												Your computer
											</span>
										) : null}
									</span>
									<span className="mt-6 text-[18px] font-semibold tracking-[-0.01em] text-white">
										{p.name} <span className="font-normal text-white/50">{p.chip}</span>
									</span>
									<span className="mt-1 text-[14px] text-white/55">{p.note}</span>
									<span
										className={`mt-6 h-10 text-[14px] ${isRecommended ? "btn-primary" : "btn-secondary"}`}
									>
										<DownloadIcon className="h-4 w-4" />
										Download
									</span>
								</a>
							</li>
						);
					})}
				</ul>
				<p className="mt-5 text-center text-[14px] text-white/55">
					Need an older version or another file?{" "}
					<a
						href={`${REPO_URL}/releases`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-white underline decoration-white/25 underline-offset-[5px] transition-colors hover:decoration-reel"
					>
						All releases on GitHub
					</a>
				</p>

				{platform === "macos" ? (
					<div className="mt-4 flex flex-col gap-4 rounded-[16px] bg-ink-2 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] md:flex-row md:items-center md:gap-8">
						<div className="md:w-[320px] md:shrink-0">
							<p className="text-[15px] font-semibold text-white">
								macOS says the app can&apos;t be opened?
							</p>
							<p className="mt-1 text-[14px] leading-relaxed text-white/50">
								Move ScreenMint to Applications, then run this once in Terminal.
							</p>
						</div>
						<div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[10px] bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
							<code className="min-w-0 flex-1 px-4 py-3 font-mono text-[13px] leading-relaxed text-white/85">
								{XATTR_COMMAND}
							</code>
							<button
								type="button"
								onClick={handleCopyXattr}
								aria-label={xattrCopied ? "Command copied" : "Copy command"}
								className="flex w-12 shrink-0 items-center justify-center border-l border-white/[0.08] text-white/55 transition-colors hover:text-white"
							>
								{xattrCopied ? (
									<Check className="h-4 w-4 text-white" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>
				) : null}
			</div>
		</section>
	);
}

/** The page's last word before the footer: one clear way to start. */
export function ClosingCta() {
	return (
		<section className="px-5 pb-28 pt-28 md:px-8 md:pb-40 md:pt-40">
			<div className="relative mx-auto flex max-w-[1120px] flex-col items-center overflow-hidden rounded-[28px] bg-ink-2 px-6 py-16 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] md:py-24">
				{/* One of ScreenMint's own wallpapers, dimmed so the copy keeps AA contrast */}
				<img
					src="/images/wallpapers/black-liquid.webp"
					alt=""
					aria-hidden="true"
					loading="lazy"
					decoding="async"
					className="absolute inset-0 h-full w-full object-cover"
				/>
				<div aria-hidden="true" className="absolute inset-0 bg-ink/[0.78]" />
				<img
					src="/images/screenmint-180.png"
					alt=""
					width={72}
					height={72}
					className="relative h-[72px] w-[72px]"
				/>
				<h2 className="relative mt-8 text-balance font-display text-[clamp(2.125rem,4.2vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
					Your next demo, minus the editing.
				</h2>
				<p className="relative mt-5 max-w-[520px] text-pretty text-[18px] leading-[1.6] text-white/70">
					Free and open source on macOS, Windows and Linux.
				</p>
				<div className="relative mt-9 flex flex-col gap-3 sm:flex-row">
					<a href="#download" className="btn-primary h-12 px-6 text-[16px]">
						<DownloadIcon className="h-[17px] w-[17px]" />
						Download for free
					</a>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="btn-secondary h-12 px-6 text-[16px]"
					>
						<GitHubIcon className="h-[17px] w-[17px]" />
						View source
					</a>
				</div>
			</div>
		</section>
	);
}
