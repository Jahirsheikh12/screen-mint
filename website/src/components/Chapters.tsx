import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { EASE_OUT, reveal } from "../lib/motion";
import { Viewer } from "./Viewer";

/** Mono slate line: label, a stretch of ruler, and a timecode. */
export function Slate({ label, timecode }: { label: string; timecode: string }) {
	return (
		<div className="flex items-end gap-4 font-mono text-[12px] uppercase tracking-[0.06em] text-paper/50">
			<span className="shrink-0 text-paper/80">{label}</span>
			<span className="ruler mb-[3px] h-[10px] flex-1 opacity-60" />
			<span className="shrink-0 tabular-nums">{timecode}</span>
		</div>
	);
}

type Take = { label: string; src: string; poster?: string; alt: string; viewer: string };

type Scene = {
	slate: string;
	timecode: string;
	title: string;
	titleEm: string;
	body: string;
	takes: Take[];
	shots: { title: string; body: string }[];
};

const SCENES: Scene[] = [
	{
		slate: "Sc. 01 · Auto zoom",
		timecode: "00:00:12:00",
		title: "Follow every",
		titleEm: "click.",
		body: "While you record, ScreenMint notes where you click. Afterwards it zooms in on those moments and eases back out, so people can actually read what you did.",
		takes: [
			{
				label: "Timeline",
				src: "/images/preview4.png",
				viewer: "Timeline",
				alt: "A 3.5× zoom block on the ScreenMint timeline, under the preview",
			},
		],
		shots: [
			{
				title: "Yours to adjust",
				body: "Every zoom lands on the timeline as a block you can move, stretch or delete.",
			},
			{ title: "Pick the depth", body: "Anywhere from a gentle 1.25× to a close-up 5×." },
			{ title: "Motion blur", body: "Fast pans pick up a soft blur, like a real camera move." },
		],
	},
	{
		slate: "Sc. 02 · Cursor",
		timecode: "00:00:31:08",
		title: "A pointer you can",
		titleEm: "follow.",
		body: "Raw captures make the cursor jitter and jump. ScreenMint smooths its path after the fact and makes every click easy to spot.",
		takes: [
			{
				label: "Smooth cursor",
				src: "/images/CursorLoop.mp4",
				poster: "/images/CursorLoop-poster.jpg",
				viewer: "Take 1",
				alt: "A smoothed cursor gliding across a browser window",
			},
			{
				label: "Cursor sway",
				src: "/images/CursorSwayDemo.mp4",
				poster: "/images/CursorSwayDemo-poster.jpg",
				viewer: "Take 2",
				alt: "A cursor with a light sway moving over a terminal window",
			},
		],
		shots: [
			{ title: "Steady path", body: "Small wobbles are filtered out; the moves you meant stay." },
			{ title: "Visible clicks", body: "A highlight marks exactly when and where you pressed." },
			{ title: "Natural sway", body: "A little weight in the motion, as if a hand is behind it." },
		],
	},
	{
		slate: "Sc. 03 · Style & export",
		timecode: "00:00:47:16",
		title: "Make it look",
		titleEm: "like yours.",
		body: "Put the recording on a wallpaper, gradient, solid color or your own image, frame it, then export. No watermark, no upload, no account.",
		takes: [
			{
				label: "Inspector",
				src: "/images/preview2.png",
				viewer: "Inspector",
				alt: "Background, shadow, roundness, padding and export quality controls in the editor",
			},
		],
		shots: [
			{ title: "Frame it", body: "Tune shadow, padding and corner roundness until it sits right." },
			{ title: "Mark it up", body: "Annotations get their own track for pointing things out." },
			{
				title: "Ship it",
				body: "MP4 for players, GIF for docs and chat. It stays on your machine.",
			},
		],
	},
];

function SceneBlock({ scene, index }: { scene: Scene; index: number }) {
	const [active, setActive] = useState(0);
	const take = scene.takes[active];
	const flip = index % 2 === 1;

	return (
		<article className="mx-auto max-w-[1240px] py-20 md:py-28">
			<motion.div {...reveal}>
				<Slate label={scene.slate} timecode={scene.timecode} />
			</motion.div>

			<div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-14">
				<motion.div
					{...reveal}
					className={`lg:col-span-4 lg:self-start lg:sticky lg:top-28 ${flip ? "lg:order-2" : ""}`}
				>
					<h2 className="font-display text-[clamp(2.5rem,4.6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-paper">
						{scene.title} <em className="whitespace-nowrap text-reel">{scene.titleEm}</em>
					</h2>
					<p className="mt-6 text-[17px] leading-[1.6] text-paper/60">{scene.body}</p>

					<ol className="mt-9 border-t border-paper/10">
						{scene.shots.map((shot, i) => (
							<li
								key={shot.title}
								className="grid grid-cols-[2.25rem_1fr] border-b border-paper/10 py-4"
							>
								<span className="pt-[3px] font-mono text-[12px] text-reel">0{i + 1}</span>
								<span>
									<span className="block text-[16px] font-medium text-paper">{shot.title}</span>
									<span className="mt-1 block text-[15px] leading-relaxed text-paper/55">
										{shot.body}
									</span>
								</span>
							</li>
						))}
					</ol>
				</motion.div>

				<motion.div {...reveal} className={`lg:col-span-8 ${flip ? "lg:order-1" : ""}`}>
					{scene.takes.length > 1 ? (
						<div className="mb-4 flex gap-6 border-b border-paper/10">
							{scene.takes.map((t, i) => (
								<button
									key={t.label}
									type="button"
									aria-pressed={i === active}
									onClick={() => setActive(i)}
									className={`-mb-px border-b pb-3 font-mono text-[12px] uppercase tracking-[0.06em] transition-colors ${
										i === active
											? "border-reel text-reel"
											: "border-transparent text-paper/50 hover:text-paper"
									}`}
								>
									Take {i + 1} · {t.label}
								</button>
							))}
						</div>
					) : null}

					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={take.src}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<Viewer src={take.src} poster={take.poster} label={take.viewer} alt={take.alt} />
						</motion.div>
					</AnimatePresence>
				</motion.div>
			</div>
		</article>
	);
}

export function Chapters() {
	return (
		<section id="features" className="px-5 md:px-8">
			{SCENES.map((scene, i) => (
				<SceneBlock key={scene.slate} scene={scene} index={i} />
			))}
		</section>
	);
}

const CLIPS = [
	{
		code: "Rec",
		title: "Record",
		body: "Pick a display or a window and hit record. Mic and system audio come along where your OS allows.",
		width: "lg:w-[30%]",
		tone: "border-reel/50 bg-reel/[0.12]",
	},
	{
		code: "Edit",
		title: "Polish",
		body: "Zooms are laid out from your clicks and the cursor is smoothed for you. Change anything on the timeline.",
		width: "lg:w-[44%]",
		tone: "border-paper/25 bg-paper/[0.06]",
	},
	{
		code: "Out",
		title: "Export",
		body: "Save an MP4 or GIF to your machine.",
		width: "lg:w-[26%]",
		tone: "border-paper/15 bg-ink-3",
	},
];

export function HowItWorks() {
	const reduceMotion = useReducedMotion();

	return (
		<section id="how-it-works" className="px-5 pt-24 md:px-8 md:pt-36">
			<div className="mx-auto max-w-[1240px]">
				<motion.div {...reveal} className="max-w-2xl">
					<p className="font-mono text-[12px] uppercase tracking-[0.06em] text-paper/50">
						How it works
					</p>
					<h2 className="mt-4 font-display text-[clamp(2.5rem,4.6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-paper">
						One take, <em className="whitespace-nowrap text-reel">three passes.</em>
					</h2>
				</motion.div>

				<motion.div {...reveal} className="mt-12">
					<div className="flex items-end gap-3 font-mono text-[11px] text-paper/40">
						<span className="w-8 shrink-0">V1</span>
						<div className="ruler h-[14px] flex-1" />
					</div>
					<div className="relative mt-2 flex flex-col gap-2 lg:flex-row lg:gap-1 lg:pl-11">
						{CLIPS.map((clip, i) => (
							<div
								key={clip.title}
								className={`relative rounded-[4px] border px-5 py-5 lg:min-h-[13rem] ${clip.width} ${clip.tone}`}
							>
								<span className="absolute inset-y-2 left-1 w-[3px] rounded-full bg-paper/20" />
								<span className="absolute inset-y-2 right-1 w-[3px] rounded-full bg-paper/20" />
								<p className="font-mono text-[11px] uppercase tracking-[0.08em] text-paper/50">
									0{i + 1} · {clip.code}
								</p>
								<h3 className="mt-3 font-display text-[30px] leading-none text-paper">
									{clip.title}
								</h3>
								<p className="mt-3 max-w-[26rem] text-[15px] leading-relaxed text-paper/60">
									{clip.body}
								</p>
							</div>
						))}

						{reduceMotion ? null : (
							<motion.div
								aria-hidden="true"
								initial={{ left: "2.75rem" }}
								whileInView={{ left: "100%" }}
								viewport={{ once: true, margin: "-120px" }}
								transition={{ duration: 5, ease: EASE_OUT, delay: 0.3 }}
								className="pointer-events-none absolute -top-5 bottom-0 hidden w-px bg-reel lg:block"
							>
								<span className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-[2px] bg-reel" />
							</motion.div>
						)}
					</div>
					<p className="mt-4 text-[14px] text-paper/45 lg:pl-11">
						No account, no watermark, no upload.
					</p>
				</motion.div>
			</div>
		</section>
	);
}
