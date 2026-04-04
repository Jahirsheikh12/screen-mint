import { forwardRef, useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function getSpacing(width: number): { spacing: number; radius: number } {
	if (width >= 1024) return { spacing: 40, radius: 1.5 };
	if (width >= 768) return { spacing: 48, radius: 1.3 };
	return { spacing: 56, radius: 1.2 };
}

export const PixelWave = forwardRef<HTMLDivElement, { className?: string }>(
	({ className }, ref) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const rafId = useRef(0);

		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const parent = canvas.parentElement;
			if (!parent) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			let width = 0;
			let height = 0;
			let dpr = 1;
			let spacing = 40;
			let radius = 1.5;
			let cols = 0;
			let rows = 0;

			// Precomputed mask center
			let cx = 0;
			let cy = 0;
			let invEllipseX = 0;
			let invEllipseY = 0;

			function resize() {
				const rect = parent.getBoundingClientRect();
				width = rect.width;
				height = rect.height;
				dpr = Math.min(window.devicePixelRatio, 2);

				canvas.width = width * dpr;
				canvas.height = height * dpr;

				const s = getSpacing(width);
				spacing = s.spacing;
				radius = s.radius;
				cols = Math.ceil(width / spacing);
				rows = Math.ceil(height / spacing);

				// Radial mask params (match original CSS: ellipse 55% 50% at 50% 40%)
				cx = width / 2;
				cy = height * 0.4;
				invEllipseX = 1 / (width * 0.55);
				invEllipseY = 1 / (height * 0.5);
			}

			function computeMask(x: number, y: number): number {
				const dx = (x - cx) * invEllipseX;
				const dy = (y - cy) * invEllipseY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				return Math.max(0, 1 - smoothstep(0.15, 1.0, dist));
			}

			function draw(timestamp: number) {
				const time = timestamp / 1000;
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = "rgb(245, 158, 11)";

				const halfSpacing = spacing / 2;

				for (let row = 0; row < rows; row++) {
					for (let col = 0; col < cols; col++) {
						const baseX = col * spacing + halfSpacing;
						const baseY = row * spacing + halfSpacing;

						const mask = computeMask(baseX, baseY);
						if (mask < 0.01) continue;

						// 3 overlapping sine waves for organic ripple
						const w1 = Math.sin(baseX * 0.015 + time * 0.8) * 8;
						const w2 = Math.sin((baseX + baseY) * 0.01 + time * 0.6) * 5;
						const w3 = Math.sin(baseY * 0.012 - time * 0.4) * 4;
						const displacement = w1 + w2 + w3;

						const drawY = baseY + displacement;

						// Opacity varies with displacement for depth
						const normalized = (displacement + 17) / 34;
						const alpha = (0.15 + normalized * 0.25) * mask;

						ctx.globalAlpha = alpha;
						ctx.beginPath();
						ctx.arc(baseX * dpr, drawY * dpr, radius * dpr, 0, Math.PI * 2);
						ctx.fill();
					}
				}

				ctx.globalAlpha = 1;
				rafId.current = requestAnimationFrame(draw);
			}

			function drawStatic() {
				draw(0);
				cancelAnimationFrame(rafId.current);
			}

			resize();

			// Observe the parent div, NOT the canvas, to avoid infinite resize loops
			const observer = new ResizeObserver(() => {
				resize();
				if (prefersReducedMotion()) drawStatic();
			});
			observer.observe(parent);

			if (prefersReducedMotion()) {
				drawStatic();
			} else {
				rafId.current = requestAnimationFrame(draw);
			}

			return () => {
				cancelAnimationFrame(rafId.current);
				observer.disconnect();
			};
		}, []);

		return (
			<div ref={ref} className={className}>
				<canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
			</div>
		);
	},
);

PixelWave.displayName = "PixelWave";
