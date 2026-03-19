import { useCallback, useEffect, useState } from "react";

export function CountdownOverlay() {
	const [countdown, setCountdown] = useState<number | null>(null);

	useEffect(() => {
		const cleanup = window.electronAPI.onCountdownTick((seconds: number) => {
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

	if (countdown === null) {
		return null;
	}

	// SVG ring parameters
	const size = 160;
	const strokeWidth = 4;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	// Assume max countdown is 5 seconds; deplete ring as countdown progresses
	const maxCount = 5;
	const progress = countdown / maxCount;
	const dashOffset = circumference * (1 - progress);

	return (
		<div
			className="fixed inset-0 flex items-center justify-center select-none cursor-pointer"
			onClick={handleCancel}
			onKeyDown={(e) => e.key === "Escape" && handleCancel()}
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
						style={{ transition: "stroke-dashoffset 0.9s linear" }}
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
