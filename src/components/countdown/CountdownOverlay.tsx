import { useCallback, useEffect, useRef, useState } from "react";

export function CountdownOverlay() {
	const [countdown, setCountdown] = useState<number | null>(null);
	const initialCountRef = useRef<number | null>(null);
	const [fading, setFading] = useState(false);

	useEffect(() => {
		const cleanup = window.electronAPI.onCountdownTick((seconds: number) => {
			if (initialCountRef.current === null) {
				initialCountRef.current = seconds;
			}
			setCountdown(seconds);
		});

		return cleanup;
	}, []);

	const handleCancel = useCallback(() => {
		window.electronAPI.cancelCountdown();
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleCancel();
			}
		},
		[handleCancel],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Trigger fade-out when countdown reaches 1 (ring will animate to empty)
	useEffect(() => {
		if (countdown === 1) {
			const timer = setTimeout(() => setFading(true), 800);
			return () => clearTimeout(timer);
		}
	}, [countdown]);

	if (countdown === null) {
		return null;
	}

	// SVG ring parameters
	const size = 160;
	const strokeWidth = 4;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	const initialCount = initialCountRef.current ?? countdown;
	// Progress depletes: countdown=3 → 66%, countdown=2 → 33%, countdown=1 → 0%
	const progress = (countdown - 1) / initialCount;
	const dashOffset = circumference * (1 - Math.max(0, progress));

	return (
		<div
			className="fixed inset-0 flex items-center justify-center select-none cursor-pointer"
			onClick={handleCancel}
			onKeyDown={(e) => e.key === "Escape" && handleCancel()}
			style={{
				opacity: fading ? 0 : 1,
				transition: "opacity 200ms ease-out",
			}}
		>
			<div
				className="relative flex items-center justify-center rounded-3xl"
				style={{
					width: 180,
					height: 180,
					background: "rgba(10, 15, 13, 0.9)",
					backdropFilter: "blur(20px)",
				}}
			>
				{/* Emerald ring */}
				<svg
					width={size}
					height={size}
					className="absolute"
					style={{ transform: "rotate(-90deg)" }}
				>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="rgba(16, 185, 129, 0.15)"
						strokeWidth={strokeWidth}
					/>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="#10B981"
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={dashOffset}
						style={{ transition: "stroke-dashoffset 1s linear" }}
					/>
				</svg>
				<span
					className="text-white font-bold tabular-nums relative z-10"
					style={{
						fontSize: "100px",
						lineHeight: 1,
						textShadow: "0 0 30px rgba(16,185,129,0.3)",
					}}
				>
					{countdown}
				</span>
			</div>
		</div>
	);
}
