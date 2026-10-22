import { Check, MessageSquare, MousePointer2, ZoomIn } from "lucide-react";
import {
	AnimatePresence,
	motion,
	type Transition,
	useInView,
	useReducedMotion,
} from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { EASE_OUT } from "../lib/motion";
import { Media, RecordingBar, Shot, Window } from "./ProductUI";

/** Section heading: the heading carries its own weight, with one supporting line. */
export function SectionTitle({
	title,
	children,
	align = "center",
}: {
	title: string;
	children?: ReactNode;
	align?: "center" | "left";
}) {
	const centered = align === "center";
	return (
		<div className={centered ? "mx-auto max-w-[760px] text-center" : "max-w-[560px]"}>
			<h2 className="text-balance font-display text-[clamp(2.125rem,4.2vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
				{title}
			</h2>
			{children ? (
				<p
					className={`mt-5 text-pretty text-[18px] leading-[1.6] text-white/55 ${centered ? "mx-auto max-w-[600px]" : ""}`}
				>
					{children}
				</p>
			) : null}
		</div>
	);
}

function FeatureTitle({ title, children }: { title: string; children: ReactNode }) {
	return (
		<>
			<h3 className="text-balance font-display text-[clamp(1.75rem,3vw,2.375rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
				{title}
			</h3>
			<p className="mt-4 text-pretty text-[17px] leading-[1.6] text-white/55">{children}</p>
		</>
	);
}

export function Details({
	items,
	className = "mt-12",
}: {
	items: { title: string; body: string }[];
	className?: string;
}) {
	return (
		<dl className={`mx-auto grid ${className} max-w-[1000px] gap-x-12 gap-y-6 sm:grid-cols-3`}>
			{items.map((item) => (
				<div key={item.title} className="border-t border-white/[0.08] pt-5">
					<dt className="text-[15px] font-semibold text-white">{item.title}</dt>
					<dd className="mt-1.5 text-[15px] leading-relaxed text-white/50">{item.body}</dd>
				</div>
			))}
		</dl>
	);
}

/** Abstract wallpapers that ship with the app (public/wallpapers), copied at web size. */
const WALLPAPERS = [
	{ id: "black-liquid", label: "Black liquid" },
	{ id: "red-abstract", label: "Red abstract" },
	{ id: "purple-folds", label: "Purple folds" },
	{ id: "geometric-gradients", label: "Geometric gradients" },
	{ id: "green-blue-waves", label: "Green and blue waves" },
	{ id: "pink-curves", label: "Pink curves" },
];

/** The background feature, working: pick a built-in wallpaper and the framed recording sits on it. */
function BackgroundDemo() {
	const [active, setActive] = useState(0);
	const ref = useRef<HTMLDivElement>(null);
	// Only the first wallpaper loads up front; the rest arrive as the section approaches.
	const near = useInView(ref, { once: true, margin: "400px" });
	const reduceMotion = useReducedMotion();

	return (
		<div ref={ref}>
			<div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-ink-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_40px_80px_-40px_rgba(0,0,0,0.9)] sm:aspect-[16/10]">
				{WALLPAPERS.map((w, i) =>
					near || i === 0 ? (
						<img
							key={w.id}
							src={`/images/wallpapers/${w.id}.webp`}
							alt=""
							aria-hidden="true"
							decoding="async"
							className="absolute inset-0 h-full w-full object-cover transition-opacity ease-out"
							style={{
								opacity: i === active ? 1 : 0,
								transitionDuration: reduceMotion ? "0ms" : "450ms",
							}}
						/>
					) : null,
				)}
				<div className="absolute inset-0 flex items-center justify-center p-[7%]">
					<img
						src="/images/preview2.png"
						alt={`The ScreenMint editor framed on the ${WALLPAPERS[active].label.toLowerCase()} background`}
						width={1111}
						height={953}
						loading="lazy"
						decoding="async"
						className="h-full w-auto max-w-full object-contain [filter:drop-shadow(0_24px_32px_rgba(0,0,0,0.5))]"
					/>
				</div>
			</div>

			<div
				role="group"
				aria-label="Background"
				className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
			>
				{WALLPAPERS.map((w, i) => (
					<button
						key={w.id}
						type="button"
						aria-pressed={i === active}
						aria-label={`${w.label} background`}
						onClick={() => setActive(i)}
						className={`h-12 w-12 overflow-hidden rounded-[12px] transition-[box-shadow,transform] duration-200 active:scale-95 sm:h-14 sm:w-14 ${
							i === active
								? "shadow-[0_0_0_2px_#121212,0_0_0_4px_#ffb21a]"
								: "shadow-[0_0_0_1px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
						}`}
					>
						<img
							src={`/images/wallpapers/thumbs/${w.id}.webp`}
							alt=""
							width={56}
							height={56}
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover"
						/>
					</button>
				))}
			</div>
			<p className="mt-4 text-center text-[13.5px] text-white/55">
				A few of the backgrounds that come with ScreenMint. Try one.
			</p>
		</div>
	);
}

const CURSOR_TAKES = [
	{
		label: "Smooth cursor",
		body: "Shaky movement is evened out after you record, and each click gets a highlight.",
		src: "/images/CursorLoop.mp4",
		poster: "/images/CursorLoop-poster.jpg",
		alt: "A smoothed cursor gliding across a browser window",
	},
	{
		label: "Cursor sway",
		body: "A light sway as the pointer travels, so it moves like a hand is behind it.",
		src: "/images/CursorSwayDemo.mp4",
		poster: "/images/CursorSwayDemo-poster.jpg",
		alt: "A cursor with a light sway moving over a terminal window",
	},
];

function CursorFeature() {
	const [active, setActive] = useState(0);
	const take = CURSOR_TAKES[active];

	return (
		<div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
			<div>
				<FeatureTitle title="A cursor people can actually follow.">
					Raw recordings make the pointer jitter and jump. ScreenMint cleans up its path so viewers
					never lose it.
				</FeatureTitle>
				<div className="mt-8 flex flex-col gap-2" role="group" aria-label="Cursor examples">
					{CURSOR_TAKES.map((t, i) => (
						<button
							key={t.label}
							type="button"
							aria-pressed={i === active}
							onClick={() => setActive(i)}
							className={`rounded-[12px] px-5 py-4 text-left transition-colors ${
								i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
							}`}
						>
							<span className="flex items-center gap-2.5 text-[16px] font-semibold text-white">
								<span
									className={`h-1.5 w-1.5 rounded-full transition-colors ${i === active ? "bg-reel" : "bg-white/25"}`}
								/>
								{t.label}
							</span>
							<span className="mt-1 block pl-4 text-[15px] leading-relaxed text-white/50">
								{t.body}
							</span>
						</button>
					))}
				</div>
			</div>

			<div>
				<Window title={`ScreenMint export · ${take.label}`}>
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={take.src}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25, ease: EASE_OUT }}
						>
							<Media src={take.src} poster={take.poster} alt={take.alt} />
						</motion.div>
					</AnimatePresence>
				</Window>
			</div>
		</div>
	);
}

export function Chapters() {
	return (
		<section id="features" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto max-w-[1120px]">
				<SectionTitle title="Everything a good demo needs, done for you.">
					Record once. ScreenMint takes care of the zooms, the cursor and the framing, and you can
					fine-tune any of it afterwards.
				</SectionTitle>

				<div id="auto-zoom" className="mt-20 md:mt-28">
					<div className="mx-auto max-w-[680px] text-center">
						<FeatureTitle title="Zooms that follow your clicks.">
							While you record, ScreenMint notes where you click. In the editor, those moments
							become smooth zooms you can move, resize or remove.
						</FeatureTitle>
					</div>
					<div className="mx-auto mt-10 max-w-[1000px]">
						<Shot
							src="/images/preview4.png"
							alt="The ScreenMint editor: a preview above a timeline with a 3.5× zoom block"
							width={1111}
							height={951}
						/>
					</div>
					<Details
						items={[
							{
								title: "Made from your clicks",
								body: "No keyframes to set. Zooms land where the action happened.",
							},
							{
								title: "1.25× to 5×",
								body: "Choose how close each zoom goes, from a gentle push to a close-up.",
							},
							{
								title: "Motion blur",
								body: "Fast pans get a soft blur, so moves look smooth instead of jumpy.",
							},
						]}
					/>
				</div>

				<div id="cursor" className="mt-28 md:mt-40">
					<CursorFeature />
				</div>

				<div id="backgrounds" className="mt-28 md:mt-40">
					<div className="mx-auto max-w-[680px] text-center">
						<FeatureTitle title="Make every recording look like yours.">
							Set your recording on a wallpaper, gradient, solid color or your own image, then tune
							the shadow, padding and corners.
						</FeatureTitle>
					</div>
					<div className="mx-auto mt-10 max-w-[1000px]">
						<BackgroundDemo />
					</div>
					<Details
						items={[
							{
								title: "Backgrounds",
								body: "Built-in wallpapers, gradients and colors, or upload your own image.",
							},
							{
								title: "Frame",
								body: "Shadow, padding and roundness, adjusted with sliders.",
							},
							{
								title: "Annotations",
								body: "Call things out on their own track in the timeline.",
							},
						]}
					/>
				</div>
			</div>
		</section>
	);
}

/** One shared cycle for the three step figures, so the loops stay in step with each other. */
const CYCLE = 6;
const INK = "#121212";
const MUTED = "rgba(255,255,255,0.5)";

/** Loop only while the figure is on screen, and never for people who asked for reduced motion. */
function useLoop() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { margin: "-80px" });
	const reduceMotion = useReducedMotion();
	return [ref, inView && !reduceMotion] as const;
}

/** A keyframe track over the shared cycle; `times` are fractions of it. */
function loop(
	playing: boolean,
	times: number[],
	ease: Transition["ease"] = "easeInOut",
): Transition {
	return playing ? { duration: CYCLE, times, ease, repeat: Infinity } : { duration: 0 };
}

/** The recording bar: a cursor glides to Record, clicks, and the take starts. */
function RecordSketch() {
	const [ref, playing] = useLoop();
	return (
		<div ref={ref} className="relative">
			{/* The "recording" pill that appears once Record is pressed */}
			<div className="absolute inset-x-0 -top-12 flex justify-center">
				<motion.span
					initial={false}
					animate={
						playing ? { opacity: [0, 0, 1, 1, 0, 0], y: [6, 6, 0, 0, 0, 6] } : { opacity: 0 }
					}
					transition={loop(playing, [0, 0.36, 0.42, 0.82, 0.88, 1])}
					className="flex items-center gap-1.5 rounded-full bg-[#2b2b30] px-3 py-1 text-[12px] font-semibold tracking-[0.02em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_24px_-10px_rgba(0,0,0,0.8)]"
				>
					<motion.span
						animate={playing ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
						transition={playing ? { duration: 1, repeat: Infinity } : { duration: 0 }}
						className="h-1.5 w-1.5 rounded-full bg-[#ff5a4e]"
					/>
					REC
				</motion.span>
			</div>

			<RecordingBar compact />

			{/* Pointer and click ripple, anchored on the Record button */}
			<div className="pointer-events-none absolute left-[54%] top-[44%]">
				<motion.span
					initial={false}
					animate={
						playing ? { opacity: [0, 0.7, 0, 0], scale: [0.3, 0.3, 1.8, 1.8] } : { opacity: 0 }
					}
					transition={loop(playing, [0, 0.34, 0.5, 1], "easeOut")}
					className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-white/70"
				/>
				<motion.span
					initial={false}
					animate={
						playing
							? {
									opacity: [0, 1, 1, 1, 1, 0, 0],
									x: [64, 56, 0, 0, 0, 0, 64],
									y: [44, 40, 0, 0, 0, 0, 44],
									scale: [1, 1, 1, 0.8, 1, 1, 1],
								}
							: { opacity: 0 }
					}
					transition={loop(playing, [0, 0.08, 0.3, 0.34, 0.38, 0.86, 1])}
					className="absolute left-0 top-0 block"
				>
					<MousePointer2 className="h-5 w-5 fill-white text-ink drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
				</motion.span>
			</div>
		</div>
	);
}

/**
 * A slice of the ScreenMint timeline. The playhead sweeps across on a loop, and the 2.0× zoom
 * block and the annotation light up exactly while the playhead is over them.
 */
function TimelineSketch() {
	const [ref, playing] = useLoop();
	// The playhead runs from 3% to 97% over the first 85% of the cycle. A block spanning a..b%
	// is under it from t = (a - 3) / 94 * 0.85 to t = (b - 3) / 94 * 0.85.
	const zoomOn = {
		backgroundColor: "rgba(255,178,26,0.2)",
		color: "#ffb21a",
		boxShadow: "inset 0 0 0 1px rgba(255,178,26,0.5)",
	};
	const zoomOff = {
		backgroundColor: "rgba(255,255,255,0.06)",
		color: "rgba(255,255,255,0.6)",
		boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
	};
	const frames = (on: Record<string, string>, off: Record<string, string>) =>
		Object.fromEntries(
			Object.keys(on).map((k) => [k, [off[k], off[k], on[k], on[k], off[k], off[k]]]),
		);

	return (
		<div
			ref={ref}
			role="img"
			aria-label="A timeline with a 2× zoom block and an annotation"
			className="w-full max-w-[340px]"
		>
			<div className="flex justify-between text-[11px] tabular-nums text-white/55">
				<span>0:00</span>
				<span>0:01</span>
				<span>0:02</span>
				<span>0:03</span>
			</div>
			<div className="relative mt-2 space-y-2">
				<div className="h-9 rounded-[8px] bg-white/[0.04]">
					<motion.div
						initial={false}
						animate={playing ? frames(zoomOn, zoomOff) : zoomOn}
						transition={loop(playing, [0, 0.13, 0.15, 0.54, 0.56, 1], "linear")}
						className="ml-[18%] flex h-full w-[46%] items-center justify-center gap-1.5 rounded-[8px] text-[12px] font-semibold"
					>
						<ZoomIn className="h-3.5 w-3.5" />
						2.0×
					</motion.div>
				</div>
				<div className="h-9 rounded-[8px] bg-white/[0.04]">
					<motion.div
						initial={false}
						animate={
							playing
								? frames(
										{ backgroundColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,1)" },
										{ backgroundColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.75)" },
									)
								: { backgroundColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.75)" }
						}
						transition={loop(playing, [0, 0.32, 0.34, 0.7, 0.72, 1], "linear")}
						className="ml-[40%] flex h-full w-[42%] items-center justify-center gap-1.5 rounded-[8px] text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
					>
						<MessageSquare className="h-3.5 w-3.5" />
						Annotation
					</motion.div>
				</div>
				<motion.div
					initial={false}
					animate={
						playing
							? { left: ["3%", "97%", "97%", "3%", "3%"], opacity: [1, 1, 0, 0, 1] }
							: { left: "38%", opacity: 1 }
					}
					transition={loop(playing, [0, 0.85, 0.9, 0.95, 1], "linear")}
					className="absolute -top-2 bottom-0 w-px bg-white"
				>
					<span className="absolute -left-[4px] -top-1 h-2 w-[9px] rounded-[2px] bg-white" />
				</motion.div>
			</div>
		</div>
	);
}

/** The export controls: Good quality slides in, then Export video runs and saves. */
function ExportSketch() {
	const [ref, playing] = useLoop();
	const seg = "relative flex-1 py-1.5 text-center text-[12.5px] font-medium";
	const pick = [0, 0.08, 0.16, 0.92, 1];
	const overlay = "absolute inset-0 flex items-center justify-center gap-1.5";
	return (
		<div
			ref={ref}
			role="img"
			aria-label="Export settings with Good quality, MP4 selected and an Export video button"
			className="w-full max-w-[300px]"
		>
			<p className="text-[12px] font-medium text-white/55">Export quality</p>
			<div className="relative mt-2 flex rounded-[9px] bg-white/[0.05] p-1">
				<motion.span
					aria-hidden="true"
					initial={false}
					animate={{ x: playing ? ["0%", "0%", "100%", "100%", "0%"] : "100%" }}
					transition={loop(playing, pick)}
					className="absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-[7px] bg-white"
				/>
				<motion.span
					initial={false}
					animate={{ color: playing ? [INK, INK, MUTED, MUTED, INK] : MUTED }}
					transition={loop(playing, pick)}
					className={seg}
				>
					Medium
				</motion.span>
				<motion.span
					initial={false}
					animate={{ color: playing ? [MUTED, MUTED, INK, INK, MUTED] : INK }}
					transition={loop(playing, pick)}
					className={seg}
				>
					Good
				</motion.span>
				<span className={`${seg} text-white/50`}>Source</span>
			</div>
			<p className="mt-4 text-[12px] font-medium text-white/55">Format</p>
			<div className="mt-2 flex gap-2">
				<span className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-white/[0.08] py-2 text-[13px] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
					<Check className="h-3.5 w-3.5 text-white" />
					MP4
				</span>
				<span className="flex flex-1 items-center justify-center rounded-[9px] bg-white/[0.03] py-2 text-[13px] font-semibold text-white/55">
					GIF
				</span>
			</div>
			<motion.div
				initial={false}
				animate={{ scale: playing ? [1, 1, 0.96, 1, 1] : 1 }}
				transition={loop(playing, [0, 0.24, 0.27, 0.3, 1])}
				className="mt-4"
			>
				<span className="btn-primary relative h-10 w-full overflow-hidden text-[14px]">
					{/* Export progress fills the button, then it reports the save */}
					<motion.span
						aria-hidden="true"
						initial={false}
						animate={{ scaleX: playing ? [0, 0, 1, 1, 0, 0] : 0 }}
						transition={loop(playing, [0, 0.3, 0.72, 0.9, 0.93, 1])}
						className="absolute inset-0 origin-left bg-black/15"
					/>
					<motion.span
						initial={false}
						animate={{ opacity: playing ? [1, 1, 0, 0, 1, 1] : 1 }}
						transition={loop(playing, [0, 0.29, 0.31, 0.9, 0.93, 1])}
						className="relative"
					>
						Export video
					</motion.span>
					<motion.span
						initial={false}
						animate={{ opacity: playing ? [0, 0, 1, 1, 0, 0] : 0 }}
						transition={loop(playing, [0, 0.29, 0.31, 0.7, 0.73, 1])}
						className={overlay}
					>
						Exporting…
					</motion.span>
					<motion.span
						initial={false}
						animate={{ opacity: playing ? [0, 0, 1, 1, 0, 0] : 0 }}
						transition={loop(playing, [0, 0.7, 0.73, 0.9, 0.93, 1])}
						className={overlay}
					>
						<Check className="h-4 w-4" />
						Saved
					</motion.span>
				</span>
			</motion.div>
		</div>
	);
}

const STEPS = [
	{
		title: "Record",
		body: "Pick a display or a window and press Record. Your mic and system audio come along where your OS allows.",
		figure: <RecordSketch />,
	},
	{
		title: "Polish",
		body: "Zooms and cursor smoothing are laid out for you. Move, trim or add anything on the timeline.",
		figure: <TimelineSketch />,
	},
	{
		title: "Export",
		body: "Save an MP4 or GIF to your computer. No account, no watermark, no upload.",
		figure: <ExportSketch />,
	},
];

export function HowItWorks() {
	return (
		<section id="how-it-works" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto max-w-[1120px]">
				<SectionTitle title="From take to finished video in three steps." />
				<ol className="mt-14 grid overflow-hidden rounded-[24px] bg-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] md:mt-16 md:grid-cols-[1fr_1.35fr_1fr]">
					{STEPS.map((step, i) => (
						<li
							key={step.title}
							className={`relative min-w-0 px-6 pb-8 pt-7 md:px-8 ${
								i > 0 ? "border-t border-white/[0.07] md:border-l md:border-t-0" : ""
							}`}
						>
							{/* The track that runs through all three steps */}
							<div className="flex items-center gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold tabular-nums text-ink">
									{i + 1}
								</span>
								<span className="h-px flex-1 bg-white/[0.12]" />
							</div>
							<div className="flex h-[260px] items-center justify-center">{step.figure}</div>
							<h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">
								{step.title}
							</h3>
							<p className="mt-2 text-[16px] leading-relaxed text-white/55">{step.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}

const SPECS = [
	{ title: "Display or window", body: "Record a whole display or just one window." },
	{
		title: "Mic and system audio",
		body: "Capture your voice and your computer's sound, where your OS allows.",
	},
	{ title: "Trim, speed and crop", body: "Cut the slow parts and tidy the frame on the timeline." },
	{ title: "Annotations", body: "Point things out on their own timeline track." },
	{ title: "MP4 or GIF", body: "GPU-accelerated export for players, docs and chat." },
	{ title: "Reopen any project", body: "Projects save as .screenmint files you can edit later." },
	{
		title: "Native capture",
		body: "ScreenCaptureKit on macOS, Windows.Graphics.Capture on Windows.",
	},
	{
		title: "Private by default",
		body: "No account, no upload, no telemetry. Everything stays on your machine.",
	},
];

export function Specs() {
	return (
		<section className="px-5 pt-24 md:px-8 md:pt-28">
			<div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
				<SectionTitle title="The details are covered too." align="left">
					The small things that make a recording tool pleasant to use every day.
				</SectionTitle>
				<ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
					{SPECS.map((spec) => (
						<li key={spec.title} className="flex gap-3.5">
							<Check className="mt-1 h-4 w-4 shrink-0 text-white/55" strokeWidth={2.5} />
							<span>
								<span className="block text-[16px] font-semibold text-white">{spec.title}</span>
								<span className="mt-1 block text-[15px] leading-relaxed text-white/50">
									{spec.body}
								</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
