import { useEffect, useRef } from "react";

class Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
	color: string;

	constructor(x: number, y: number, vx: number, vy: number, color: string) {
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
		this.maxLife = Math.random() * 30 + 40; // 40-70 frames of life
		this.life = this.maxLife;
		this.size = Math.random() * 2 + 1.5; // 1.5 to 3.5 radius
		this.color = color;
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;
		this.life--;
		// Slight drag
		this.vx *= 0.95;
		this.vy *= 0.95;
		// Drift slightly upwards
		this.vy -= 0.05;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const opacity = Math.max(0, this.life / this.maxLife);
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.size * opacity, 0, Math.PI * 2);
		
		// Convert hex/rgb to rgba for fading
		ctx.fillStyle = `rgba(245, 158, 11, ${opacity * 0.8})`; // #f59e0b with opacity
		ctx.fill();
	}
}

export function CursorTrail() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const particlesRef = useRef<Particle[]>([]);
	const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0 });
	const isMovingRef = useRef(false);
	const timeoutRef = useRef<number | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		window.addEventListener("resize", resize);
		resize();

		const handleMouseMove = (e: MouseEvent) => {
			const dx = e.clientX - mouseRef.current.x;
			const dy = e.clientY - mouseRef.current.y;
			
			// Calculate velocity
			mouseRef.current.vx = dx;
			mouseRef.current.vy = dy;
			mouseRef.current.x = e.clientX;
			mouseRef.current.y = e.clientY;

			isMovingRef.current = true;
			
			if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
			timeoutRef.current = window.setTimeout(() => {
				isMovingRef.current = false;
			}, 50);

			// Spawn particles on movement
			// The faster the movement, the more particles
			const speed = Math.sqrt(dx * dx + dy * dy);
			const spawnCount = Math.min(Math.floor(speed / 5) + 1, 5); // cap at 5 per frame

			for (let i = 0; i < spawnCount; i++) {
				// Add some randomness to velocity
				const vx = (dx * 0.1) + (Math.random() - 0.5) * 2;
				const vy = (dy * 0.1) + (Math.random() - 0.5) * 2;
				
				particlesRef.current.push(
					new Particle(
						e.clientX + (Math.random() - 0.5) * 10,
						e.clientY + (Math.random() - 0.5) * 10,
						vx,
						vy,
						"#f59e0b"
					)
				);
			}
		};

		window.addEventListener("mousemove", handleMouseMove);

		const animate = () => {
			// Clear canvas completely
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const particles = particlesRef.current;

			// Update and draw particles
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				p.update();
				
				if (p.life <= 0) {
					particles.splice(i, 1);
				} else {
					p.draw(ctx);
				}
			}

			animationFrameId = requestAnimationFrame(animate);
		};

		animate();

		return () => {
			window.removeEventListener("resize", resize);
			window.removeEventListener("mousemove", handleMouseMove);
			cancelAnimationFrame(animationFrameId);
			if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
			style={{ mixBlendMode: "screen" }}
		/>
	);
}
