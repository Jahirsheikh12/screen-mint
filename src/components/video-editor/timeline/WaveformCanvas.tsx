import { useCallback, useEffect, useRef } from "react";

interface WaveformCanvasProps {
	waveformData: Float32Array;
	sourceStartMs: number;
	sourceEndMs: number;
	sourceDurationMs: number;
}

export default function WaveformCanvas({
	waveformData,
	sourceStartMs,
	sourceEndMs,
	sourceDurationMs,
}: WaveformCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas || sourceDurationMs <= 0) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const displayWidth = canvas.offsetWidth;
		const displayHeight = canvas.offsetHeight;

		if (displayWidth <= 0 || displayHeight <= 0) return;

		canvas.width = Math.round(displayWidth * dpr);
		canvas.height = Math.round(displayHeight * dpr);
		ctx.scale(dpr, dpr);

		ctx.clearRect(0, 0, displayWidth, displayHeight);

		// Slice waveform data to the segment's source time range
		const totalSamples = waveformData.length;
		const startIdx = Math.floor((sourceStartMs / sourceDurationMs) * totalSamples);
		const endIdx = Math.ceil((sourceEndMs / sourceDurationMs) * totalSamples);
		const sliceLength = Math.max(1, endIdx - startIdx);

		// Leave padding for end caps (8px each side) and some vertical margin
		const padX = 10;
		const drawWidth = Math.max(1, displayWidth - padX * 2);
		const maxBarHeight = displayHeight * 0.7;
		const centerY = displayHeight / 2;

		// Draw bars — use 2px wide bars with 1px gap for a clean look
		const barWidth = 1.5;
		const barGap = 1;
		const barStep = barWidth + barGap;
		const barCount = Math.max(1, Math.floor(drawWidth / barStep));

		ctx.fillStyle = "rgba(245, 158, 11, 0.3)";

		for (let i = 0; i < barCount; i++) {
			// Map bar index to sample index within the slice
			const sampleIdx = startIdx + Math.round((i / barCount) * sliceLength);
			const clampedIdx = Math.min(Math.max(0, sampleIdx), totalSamples - 1);
			const amplitude = waveformData[clampedIdx];

			// Minimum bar height for visual continuity
			const barHeight = Math.max(1.5, amplitude * maxBarHeight);
			const x = padX + i * barStep;

			ctx.beginPath();
			ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 0.75);
			ctx.fill();
		}
	}, [waveformData, sourceStartMs, sourceEndMs, sourceDurationMs]);

	// Draw on mount and when data changes
	useEffect(() => {
		draw();
	}, [draw]);

	// Redraw on resize
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const observer = new ResizeObserver(() => {
			draw();
		});

		observer.observe(canvas);
		return () => observer.disconnect();
	}, [draw]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 w-full h-full pointer-events-none"
			style={{ zIndex: 1 }}
		/>
	);
}
