import { useCallback, useEffect, useRef, useState } from "react";

interface CountdownState {
	current: number | null;
	previous: number | null;
	initialCount: number | null;
	phase: "idle" | "entering" | "active" | "exiting";
}

export function CountdownOverlay() {
	const [state, setState] = useState<CountdownState>({
		current: null,
		previous: null,
		initialCount: null,
		phase: "idle",
	});
	const [ripples, setRipples] = useState<number[]>([]);
	const rippleIdRef = useRef(0);

	useEffect(() => {
		const cleanup = window.electronAPI.onCountdownTick((seconds: number) => {
			setState((prev) => {
				const initialCount = prev.initialCount ?? seconds;
				return {
					current: seconds,
					previous: prev.current,
					initialCount,
					phase: prev.phase === "idle" ? "entering" : "active",
				};
			});

			// Spawn a ripple on each tick
			const id = rippleIdRef.current++;
			setRipples((prev) => [...prev, id]);
			setTimeout(() => {
				setRipples((prev) => prev.filter((r) => r !== id));
			}, 1000);
		});

		return cleanup;
	}, []);

	const handleCancel = useCallback(() => {
		window.electronAPI.cancelCountdown();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [handleCancel]);

	// Fade out on last tick
	useEffect(() => {
		if (state.current === 1) {
			const timer = setTimeout(() => {
				setState((prev) => ({ ...prev, phase: "exiting" }));
			}, 750);
			return () => clearTimeout(timer);
		}
	}, [state.current]);

	if (state.current === null) return null;

	const { current, initialCount, phase } = state;
	const total = initialCount ?? current;

	// Ring math
	const size = 160;
	const strokeWidth = 3;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = (current - 1) / total;
	const dashOffset = circumference * (1 - Math.max(0, progress));

	return (
		<div
			className="fixed inset-0 flex items-center justify-center select-none cursor-pointer"
			onClick={handleCancel}
			onKeyDown={(e) => e.key === "Escape" && handleCancel()}
			style={{
				opacity: phase === "exiting" ? 0 : 1,
				transition: "opacity 250ms ease-out",
			}}
		>
			{/* Outer container */}
			<div
				className="relative flex items-center justify-center"
				style={{ width: 190, height: 190 }}
			>
				{/* Ripple rings */}
				{ripples.map((id) => (
					<div
						key={id}
						className="absolute inset-0 rounded-full"
						style={{
							border: "1.5px solid rgb(var(--accent) / 0.4)",
							animation: "countdown-ripple 1s ease-out forwards",
						}}
					/>
				))}

				{/* Glassmorphic backdrop */}
				<div
					className="absolute rounded-full"
					style={{
						width: 170,
						height: 170,
						background: "rgb(var(--surface) / 0.92)",
						backdropFilter: "blur(24px)",
						boxShadow: "var(--shadow-dialog)",
					}}
				/>

				{/* SVG progress ring */}
				<svg
					width={size}
					height={size}
					className="absolute"
					style={{ transform: "rotate(-90deg)" }}
				>
					{/* Track */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="rgb(var(--track) / 0.1)"
						strokeWidth={strokeWidth}
					/>
					{/* Progress arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="rgb(var(--accent))"
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={dashOffset}
						style={{
							transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
						}}
					/>
				</svg>

				{/* Tick markers around the ring */}
				<svg width={size} height={size} className="absolute" style={{ opacity: 0.15 }}>
					{Array.from({ length: 12 }, (_, i) => {
						const angle = (i / 12) * 360 - 90;
						const rad = (angle * Math.PI) / 180;
						const outerR = radius + 1;
						const innerR = radius - 6;
						return (
							<line
								key={i}
								x1={size / 2 + outerR * Math.cos(rad)}
								y1={size / 2 + outerR * Math.sin(rad)}
								x2={size / 2 + innerR * Math.cos(rad)}
								y2={size / 2 + innerR * Math.sin(rad)}
								stroke="rgb(var(--fg))"
								strokeWidth={i % 3 === 0 ? 1.5 : 0.5}
								strokeLinecap="round"
							/>
						);
					})}
				</svg>

				{/* Dot at the leading edge of the arc */}
				<div
					className="absolute"
					style={{
						width: 7,
						height: 7,
						borderRadius: "50%",
						background: "rgb(var(--accent))",
						top: "50%",
						left: "50%",
						transform: `rotate(${360 * (1 - progress) - 90}deg) translate(${radius}px) translate(-50%, -50%)`,
						transformOrigin: "0 0",
						transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)",
					}}
				/>

				{/* Number display with morphing animation */}
				<div className="relative z-10 flex items-center justify-center">
					<span
						key={current}
						style={{
							fontSize: 80,
							fontWeight: 700,
							lineHeight: 1,
							color: "rgb(var(--fg))",
							fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif",
							animation: "countdown-number-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
							letterSpacing: "-0.02em",
						}}
					>
						{current}
					</span>
				</div>

				{/* Subtle "Press Esc" hint */}
				<div
					className="absolute"
					style={{
						bottom: -22,
						left: "50%",
						transform: "translateX(-50%)",
						padding: "2px 8px",
						borderRadius: 999,
						background: "rgb(var(--surface) / 0.85)",
						fontSize: 11,
						color: "rgb(var(--fg-subtle))",
						fontWeight: 500,
						letterSpacing: "0.05em",
						whiteSpace: "nowrap",
					}}
				>
					ESC
				</div>
			</div>

			{/* Keyframe animations */}
			<style>
				{`
					@keyframes countdown-ripple {
						0% {
							transform: scale(1);
							opacity: 0.6;
						}
						100% {
							transform: scale(1.5);
							opacity: 0;
						}
					}

					@keyframes countdown-number-in {
						0% {
							opacity: 0;
							transform: scale(0.5);
							filter: blur(8px);
						}
						60% {
							opacity: 1;
							filter: blur(0px);
						}
						100% {
							opacity: 1;
							transform: scale(1);
							filter: blur(0px);
						}
					}
				`}
			</style>
		</div>
	);
}
