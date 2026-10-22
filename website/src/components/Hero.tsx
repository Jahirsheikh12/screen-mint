import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { REPO_URL } from "../lib/links";
import { detectPlatform, PLATFORM_LABELS, type Platform } from "../lib/platform";
import { AppleIcon, GitHubIcon, LinuxIcon, WindowsIcon } from "./BrandIcons";
import { Media, RecordingBar, Window } from "./ProductUI";

const PLATFORMS = [
	{ id: "macos", label: "macOS", Icon: AppleIcon },
	{ id: "windows", label: "Windows", Icon: WindowsIcon },
	{ id: "linux", label: "Linux", Icon: LinuxIcon },
] as const;

export function Hero() {
	const [platform, setPlatform] = useState<Platform>("unknown");
	const stageRef = useRef<HTMLDivElement>(null);
	// The page's one scroll moment: the demo window settles to full size as it comes up.
	const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start end", "start 20%"] });
	const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

	useEffect(() => setPlatform(detectPlatform()), []);

	const current = PLATFORMS.find((p) => p.id === platform);
	const others = PLATFORMS.filter((p) => p.id !== platform);

	return (
		<section id="top" className="px-5 pt-28 md:px-8 md:pt-32">
			<div className="mx-auto max-w-[1080px] text-center">
				<h1 className="text-balance font-display text-[clamp(2.5rem,6vw,4.625rem)] font-semibold leading-[1.03] tracking-[-0.038em] text-white">
					Polished screen recordings, without the editing.
				</h1>

				<p className="mx-auto mt-5 max-w-[760px] text-pretty text-[18px] leading-[1.6] text-white/60 md:text-[19px]">
					ScreenMint zooms in where you click and smooths your cursor, for free.
				</p>

				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<a href="#download" className="btn-primary h-12 w-full px-6 text-[16px] sm:w-auto">
						{current ? <current.Icon className="h-[17px] w-[17px]" /> : null}
						{current ? `Download for ${PLATFORM_LABELS[platform]}` : "Download for free"}
					</a>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="btn-secondary h-12 w-full px-6 text-[16px] sm:w-auto"
					>
						<GitHubIcon className="h-[17px] w-[17px]" />
						View source
					</a>
				</div>

				<p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13.5px] text-white/55">
					<span className="basis-full text-center sm:basis-auto">
						Free and open source, MIT licensed
					</span>
					<span aria-hidden="true" className="hidden h-3 w-px bg-white/20 sm:block" />
					<span>{current ? "Also on" : "For"}</span>
					{others.map((p) => (
						<a
							key={p.id}
							href="#download"
							className="flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
						>
							<p.Icon className="h-3.5 w-3.5" />
							{p.label}
						</a>
					))}
				</p>
			</div>

			<div ref={stageRef} className="relative mx-auto mt-12 max-w-[1120px] md:mt-14">
				<motion.div style={{ scale }} className="origin-top">
					<RecordingBar className="absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:flex" />
					<Window title="ScreenMint export">
						<Media
							src="/images/demo.mp4"
							poster="/images/demo-poster.jpg"
							alt="A ScreenMint export: the view zooms in on each click automatically"
						/>
					</Window>
				</motion.div>
			</div>
		</section>
	);
}
