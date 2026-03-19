import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const commands = [
	{
		label: "macOS (DMG)",
		command: "open /Applications/ScreenMint.app",
	},
	{
		label: "Windows (EXE)",
		command: "start ScreenMint-windows-x64.exe",
	},
	{
		label: "Linux (AppImage)",
		command: "chmod +x ScreenMint-linux-x64.AppImage && ./ScreenMint-linux-x64.AppImage",
	},
];

const XATTR_COMMAND = "xattr -cr /Applications/ScreenMint.app";

export function QuickStart() {
	const sectionRef = useRef<HTMLElement>(null);
	const [activeTab, setActiveTab] = useState(0);
	const [copied, setCopied] = useState(false);
	const [xattrCopied, setXattrCopied] = useState(false);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".quickstart-card",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: sectionRef.current,
						start: "top 75%",
						once: true,
					},
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(commands[activeTab].command);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard not available
		}
	};

	const handleCopyXattr = async () => {
		try {
			await navigator.clipboard.writeText(XATTR_COMMAND);
			setXattrCopied(true);
			setTimeout(() => setXattrCopied(false), 2000);
		} catch {
			// clipboard not available
		}
	};

	return (
		<section ref={sectionRef} className="relative py-28 md:py-36 px-6">
			<div className="max-w-2xl mx-auto">
				<div className="quickstart-card">
					{/* Heading */}
					<div className="text-center mb-10">
						<p className="text-brand-400 text-sm font-medium tracking-wide uppercase mb-4">
							Quick Start
						</p>
						<h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
							Up and running in seconds
						</h2>
						<p className="text-white/35 text-base">
							Download the latest build, then launch the matching binary for your platform.
						</p>
					</div>

					{/* Tabs */}
					<div className="flex items-center gap-1 mb-3 px-1">
						{commands.map((cmd, i) => (
							<button
								key={cmd.label}
								type="button"
								onClick={() => setActiveTab(i)}
								className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
									activeTab === i
										? "bg-white/[0.08] text-white"
										: "text-white/30 hover:text-white/50"
								}`}
							>
								{cmd.label}
							</button>
						))}
					</div>

					{/* Command block */}
					<div className="command-block relative rounded-xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
						<div className="flex items-center justify-between px-5 py-4">
							<code className="text-[14px] text-brand-400 font-mono">
								<span className="text-white/20 mr-2">$</span>
								{commands[activeTab].command}
							</code>

							<button
								type="button"
								onClick={handleCopy}
								className="command-copy ml-4 p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all flex-shrink-0"
								title="Copy command"
							>
								{copied ? (
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#10B981"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg
										width="16"
										height="16"
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

					{/* macOS xattr bypass command */}
					<div className="mt-6 rounded-xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
						<div className="px-5 pt-4 pb-2">
							<div className="flex items-center gap-2 mb-2">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="#10B981"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
								</svg>
								<span className="text-[13px] font-medium text-white/70">
									macOS Gatekeeper Bypass
								</span>
							</div>
							<p className="text-[12px] text-white/30 leading-relaxed mb-3">
								macOS may block ScreenMint from opening because it&apos;s downloaded from the
								internet. Run this command in Terminal to remove the quarantine flag and allow the
								app to launch.
							</p>
						</div>
						<div className="command-block flex items-center justify-between px-5 py-3 bg-black/40 border-t border-white/[0.04]">
							<code className="text-[13px] text-brand-400 font-mono">
								<span className="text-white/20 mr-2">$</span>
								{XATTR_COMMAND}
							</code>
							<button
								type="button"
								onClick={handleCopyXattr}
								className="command-copy ml-4 p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all flex-shrink-0"
								title="Copy xattr command"
							>
								{xattrCopied ? (
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#10B981"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg
										width="16"
										height="16"
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

					{/* Note */}
					<p className="text-center text-[12px] text-white/20 mt-5">
						Or{" "}
						<a
							href="#download"
							className="text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors"
						>
							download the installer
						</a>{" "}
						for your platform below.
					</p>
				</div>
			</div>
		</section>
	);
}
