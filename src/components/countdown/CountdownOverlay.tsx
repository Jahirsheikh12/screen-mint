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
							border: "1.5px solid rgba(245, 158, 11, 0.4)",
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
						background:
							"radial-gradient(circle at 30% 30%, rgba(30, 30, 30, 0.95), rgba(10, 10, 10, 0.98))",
						backdropFilter: "blur(24px)",
						boxShadow:
							"0 0 60px rgba(245, 158, 11, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 20px 40px rgba(0, 0, 0, 0.5)",
					}}
				/>

				{/* Ambient glow behind ring */}
				<div
					className="absolute rounded-full"
					style={{
						width: 162,
						height: 162,
						background: "transparent",
						boxShadow: "0 0 40px rgba(245, 158, 11, 0.1), 0 0 80px rgba(245, 158, 11, 0.05)",
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
						stroke="rgba(245, 158, 11, 0.08)"
						strokeWidth={strokeWidth}
					/>
					{/* Progress arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="url(#countdown-gradient)"
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={dashOffset}
						style={{
							transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
							filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))",
						}}
					/>
					{/* Gradient for the arc */}
					<defs>
						<linearGradient id="countdown-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stopColor="#FBBF24" />
							<stop offset="50%" stopColor="#F59E0B" />
							<stop offset="100%" stopColor="#D97706" />
						</linearGradient>
					</defs>
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
								stroke="#F59E0B"
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
						background: "#FBBF24",
						boxShadow: "0 0 12px rgba(245, 158, 11, 0.8), 0 0 4px rgba(245, 158, 11, 0.6)",
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
							color: "#fff",
							fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif",
							textShadow: "0 0 30px rgba(245, 158, 11, 0.25), 0 2px 4px rgba(0, 0, 0, 0.3)",
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
						bottom: -32,
						left: "50%",
						transform: "translateX(-50%)",
						fontSize: 11,
						color: "rgba(255, 255, 255, 0.3)",
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
