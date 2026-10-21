import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { formatTimecode } from "../lib/timecode";

/**
 * Editor-style frame. Videos get a running timecode and a playhead synced to playback;
 * stills get a caption strip.
 */
export function Viewer({
	src,
	poster,
	label,
	alt,
	className = "",
}: {
	src: string;
	poster?: string;
	label: string;
	alt: string;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const isVideo = src.endsWith(".mp4");
	const videoRef = useRef<HTMLVideoElement>(null);
	const headRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		let frame = 0;
		const tick = () => {
			const progress = video.duration ? video.currentTime / video.duration : 0;
			if (headRef.current) headRef.current.style.left = `${progress * 100}%`;
			if (timeRef.current) timeRef.current.textContent = formatTimecode(video.currentTime);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);

	return (
		<figure className={`viewer overflow-hidden rounded-[6px] ${className}`}>
			<div className="flex items-center gap-3 border-b border-paper/10 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-paper/45">
				<span className="text-paper/70">{label}</span>
				{isVideo ? (
					<span className="ml-auto flex items-center gap-1.5 text-reel">
						<span className="h-1.5 w-1.5 rounded-full bg-reel" />
						Play
					</span>
				) : null}
			</div>

			<div className="relative bg-black">
				{isVideo ? (
					<video
						ref={videoRef}
						src={src}
						poster={poster}
						autoPlay={!reduceMotion}
						controls={!!reduceMotion}
						muted
						loop
						playsInline
						aria-label={alt}
						className="block aspect-video w-full object-cover"
					/>
				) : (
					<img src={src} alt={alt} loading="lazy" className="block h-auto w-full" />
				)}
			</div>

			{isVideo ? (
				<div className="flex items-center gap-4 border-t border-paper/10 px-3.5 py-2.5">
					<span ref={timeRef} className="font-mono text-[11px] tabular-nums text-paper/60">
						00:00:00:00
					</span>
					<div className="relative h-3 flex-1">
						<div className="ruler absolute inset-x-0 bottom-0 h-3 opacity-70" />
						<div ref={headRef} className="absolute -top-0.5 bottom-0 w-px bg-reel">
							<span className="absolute -left-[3px] -top-0.5 h-1.5 w-[7px] rounded-[1px] bg-reel" />
						</div>
					</div>
				</div>
			) : (
				<figcaption className="border-t border-paper/10 px-3.5 py-2.5 text-[13px] text-paper/55">
					{alt}
				</figcaption>
			)}
		</figure>
	);
}
