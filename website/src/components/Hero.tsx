import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { REPO_URL } from "../lib/links";
import { EASE_OUT } from "../lib/motion";
import { detectPlatform, PLATFORM_LABELS, type Platform } from "../lib/platform";
import { formatTimecode } from "../lib/timecode";
import { AppleIcon, LinuxIcon, WindowsIcon } from "./BrandIcons";
import { Viewer } from "./Viewer";

const PLATFORM_ICONS = { macos: AppleIcon, windows: WindowsIcon, linux: LinuxIcon } as const;

const enter = (delay: number) => ({
	initial: { opacity: 0, y: 18 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.8, delay, ease: EASE_OUT },
});

/** A record light with a timecode that runs from page load. */
function RecCounter() {
	const reduceMotion = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (reduceMotion) return;
		const start = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			if (ref.current) ref.current.textContent = formatTimecode((now - start) / 1000);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [reduceMotion]);

	return (
		<span className="inline-flex items-center gap-2.5 font-mono text-[12px] tracking-[0.06em] text-paper/55">
			<span className="h-2 w-2 rounded-full bg-[#ff4d2e] motion-safe:animate-pulse" />
			REC
			<span ref={ref} className="tabular-nums text-paper/80">
				00:00:00:00
			</span>
		</span>
	);
}

export function Hero() {
	const [platform, setPlatform] = useState<Platform>("unknown");

	useEffect(() => setPlatform(detectPlatform()), []);

	const PlatformIcon = platform === "unknown" ? null : PLATFORM_ICONS[platform];

	return (
		<section className="px-5 pt-28 md:px-8 md:pt-36">
			<div className="mx-auto max-w-[1240px]">
				<motion.div {...enter(0)}>
					<RecCounter />
				</motion.div>

				<motion.h1
					{...enter(0.06)}
					className="mt-6 font-display text-[clamp(3.25rem,8.6vw,8rem)] font-normal leading-[0.9] tracking-[-0.03em] text-paper"
				>
					<span className="block">Record it rough.</span>
					<em className="block text-reel lg:pl-[1.5em]">Ship it polished.</em>
				</motion.h1>

				<div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
					<div>
						<motion.p {...enter(0.14)} className="text-[18px] leading-[1.55] text-paper/60">
							ScreenMint is a free, open-source screen recorder that does the editor&apos;s job for
							you:{" "}
							<span className="text-paper">
								zooms on your clicks, a steady cursor, and a backdrop that fits.
							</span>
						</motion.p>

						<motion.div
							{...enter(0.2)}
							className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"
						>
							<a
								href="#download"
								className="flex h-12 items-center gap-2.5 rounded-[4px] bg-reel px-5 text-[16px] font-semibold text-ink transition-colors hover:bg-[#ffc54d]"
							>
								{PlatformIcon ? <PlatformIcon className="h-[17px] w-[17px]" /> : null}
								{platform === "unknown"
									? "Download free"
									: `Download for ${PLATFORM_LABELS[platform]}`}
							</a>
							<a
								href={REPO_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="group inline-flex items-center gap-1 text-[16px] text-paper/80 underline decoration-paper/25 underline-offset-[6px] transition-colors hover:text-paper hover:decoration-reel"
							>
								Source on GitHub
								<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
							</a>
						</motion.div>

						<motion.p
							{...enter(0.24)}
							className="mt-8 font-mono text-[12px] tracking-[0.04em] text-paper/40"
						>
							macOS 12.3+ / Windows 10+ / Linux · MIT licensed
						</motion.p>
					</div>

					<motion.div
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 1, delay: 0.25, ease: EASE_OUT }}
					>
						<Viewer
							src="/images/demo.mp4"
							poster="/images/demo-poster.jpg"
							label="Export"
							alt="A ScreenMint export: the view zooms in on each click automatically"
						/>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
