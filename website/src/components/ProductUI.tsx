import { CircleDot, Folder, GripVertical, Minus, Monitor, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** A desktop window around product media: quiet title bar, the media below. */
export function Window({
	title,
	children,
	className = "",
}: {
	title: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<figure className={`window overflow-hidden rounded-[14px] ${className}`}>
			<div className="relative flex h-9 items-center border-b border-white/[0.06] px-3.5">
				<span className="flex gap-2" aria-hidden="true">
					<span className="h-3 w-3 rounded-full bg-white/[0.13]" />
					<span className="h-3 w-3 rounded-full bg-white/[0.13]" />
					<span className="h-3 w-3 rounded-full bg-white/[0.13]" />
				</span>
				<span className="absolute inset-x-24 truncate text-center text-[12.5px] font-medium text-white/55">
					{title}
				</span>
			</div>
			{children}
		</figure>
	);
}

/** Product media: a looping muted video, or a still. */
export function Media({
	src,
	poster,
	alt,
	priority = false,
}: {
	src: string;
	poster?: string;
	alt: string;
	/** The first-viewport video loads right away; others fetch only their metadata until they play. */
	priority?: boolean;
}) {
	const reduceMotion = useReducedMotion();
	const videoRef = useRef<HTMLVideoElement>(null);
	const [reduced, setReduced] = useState(false);

	// Decide playback after mount, so the pre-rendered markup and the first client render match.
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		setReduced(!!reduceMotion);
		if (reduceMotion) video.pause();
		else
			void video.play().catch(() => {
				// The browser may refuse autoplay; the poster frame stays up.
			});
	}, [reduceMotion]);

	if (src.endsWith(".mp4")) {
		return (
			<video
				ref={videoRef}
				src={src}
				poster={poster}
				controls={reduced}
				muted
				loop
				playsInline
				preload={priority ? "auto" : "metadata"}
				width={1280}
				height={720}
				aria-label={alt}
				className="block aspect-video h-auto w-full bg-black object-cover"
			/>
		);
	}

	return <img src={src} alt={alt} loading="lazy" className="block h-auto w-full" />;
}

/** An editor screenshot. The PNGs carry their own window frame, so they sit bare with a shadow. */
export function Shot({
	src,
	alt,
	width,
	height,
}: {
	src: string;
	alt: string;
	width: number;
	height: number;
}) {
	return (
		<img
			src={src}
			alt={alt}
			width={width}
			height={height}
			loading="lazy"
			decoding="async"
			className="mx-auto block h-auto w-full [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.55))]"
		/>
	);
}

/** ScreenMint's floating recording bar, rebuilt from the app (see public/images/preview3.png). */
export function RecordingBar({
	compact = false,
	className = "",
}: {
	compact?: boolean;
	className?: string;
}) {
	const item = `flex items-center gap-2 font-semibold text-white ${compact ? "px-2.5 text-[13px]" : "px-3.5 text-[14px]"}`;
	return (
		<div
			role="img"
			aria-label="The ScreenMint recording bar: choose a display, record, or open a project"
			className={`flex shrink-0 items-center rounded-[14px] bg-[#2b2b30]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md ${compact ? "h-11 px-1" : "h-12 pl-2 pr-1.5"} ${className}`}
		>
			{compact ? null : <GripVertical className="h-4 w-4 text-white/35" />}
			<span className={item}>
				<Monitor className="h-[17px] w-[17px]" />
				Display
			</span>
			<span className="h-6 w-px bg-white/15" />
			<span className={item}>
				<CircleDot className="h-[17px] w-[17px] text-[#ff5a4e]" />
				Record
			</span>
			<span className="h-6 w-px bg-white/15" />
			<span className={item}>
				<Folder className="h-[17px] w-[17px]" />
				Open
			</span>
			{compact ? null : (
				<>
					<span className="h-6 w-px bg-white/15" />
					<span className="flex items-center gap-1 px-2 text-white/60">
						<Minus className="h-4 w-4" />
						<X className="h-4 w-4" />
					</span>
				</>
			)}
		</div>
	);
}
