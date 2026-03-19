import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { REPO_URL } from "../lib/links";

export function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const navRef = useRef<HTMLElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// Smooth GSAP capsule resize animation
	useEffect(() => {
		if (!innerRef.current || !navRef.current || !bgRef.current) return;

		const skipAnim = prefersReducedMotion();
		const dur = skipAnim ? 0 : 0.6;
		const ease = "power3.inOut";

		if (scrolled) {
			// Compact capsule on scroll
			gsap.to(navRef.current, {
				paddingTop: 10,
				duration: dur,
				ease,
			});
			gsap.to(innerRef.current, {
				maxWidth: 820,
				paddingLeft: 24,
				paddingRight: 24,
				height: 52,
				duration: dur,
				ease,
			});
			gsap.to(bgRef.current, {
				opacity: 1,
				scale: 1,
				duration: dur,
				ease,
			});
		} else {
			// Wider capsule at top
			gsap.to(navRef.current, {
				paddingTop: 16,
				duration: dur,
				ease,
			});
			gsap.to(innerRef.current, {
				maxWidth: 900,
				paddingLeft: 28,
				paddingRight: 28,
				height: 56,
				duration: dur,
				ease,
			});
			gsap.to(bgRef.current, {
				opacity: 1,
				scale: 1,
				duration: dur,
				ease,
			});
		}
	}, [scrolled]);

	return (
		<nav
			ref={navRef}
			className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4"
			style={{ paddingTop: 16 }}
		>
			<div
				ref={innerRef}
				className="relative w-full flex items-center justify-between"
				style={{
					maxWidth: 900,
					paddingLeft: 28,
					paddingRight: 28,
					height: 56,
					borderRadius: 999,
				}}
			>
				{/* Glass background layer — always visible as capsule */}
				<div
					ref={bgRef}
					className="absolute inset-0 pointer-events-none"
					style={{
						opacity: 1,
						background: "rgba(29, 29, 31, 0.8)",
						backdropFilter: "blur(24px) saturate(180%)",
						WebkitBackdropFilter: "blur(24px) saturate(180%)",
						border: "1px solid rgba(255, 255, 255, 0.06)",
						borderRadius: 999,
					}}
				/>

				{/* Logo */}
				<a
					href="#"
					className="relative z-10 flex items-center gap-2 group"
				>
					<div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center transition-shadow group-hover:shadow-glow-sm">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<circle cx="12" cy="12" r="10" />
							<polygon
								points="10 8 16 12 10 16 10 8"
								fill="white"
								stroke="none"
							/>
						</svg>
					</div>
					<span className="text-[15px] font-bold tracking-tight">
						ScreenMint
					</span>
				</a>

				{/* Desktop nav */}
				<div className="relative z-10 hidden md:flex items-center gap-1">
					<a
						href="#features"
						className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/[0.04]"
					>
						Features
					</a>
					<a
						href="#how-it-works"
						className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/[0.04]"
					>
						How it works
					</a>
					<a
						href="#download"
						className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/[0.04]"
					>
						Download
					</a>
					<a
						href="#faq"
						className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/[0.04]"
					>
						FAQ
					</a>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="px-3 py-1.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/[0.04]"
					>
						GitHub
					</a>

					<a
						href="#download"
						className="ml-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-[13px] font-semibold hover:bg-white/90 active:scale-[0.97] transition-all"
					>
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						Download
					</a>
				</div>

				{/* Mobile hamburger */}
				<button
					type="button"
					className="relative z-10 md:hidden p-2 text-white/50 hover:text-white"
					onClick={() => setMobileOpen(!mobileOpen)}
					aria-label="Toggle menu"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						{mobileOpen ? (
							<>
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</>
						) : (
							<>
								<line x1="4" y1="8" x2="20" y2="8" />
								<line x1="4" y1="16" x2="20" y2="16" />
							</>
						)}
					</svg>
				</button>
			</div>

			{/* Mobile menu */}
			{mobileOpen && (
				<div
					className="md:hidden absolute top-20 left-4 right-4 rounded-2xl px-5 py-4 space-y-1"
					style={{
						background: "rgba(29, 29, 31, 0.95)",
						backdropFilter: "blur(24px)",
						WebkitBackdropFilter: "blur(24px)",
						border: "1px solid rgba(255, 255, 255, 0.06)",
					}}
				>
					<a
						href="#features"
						onClick={() => setMobileOpen(false)}
						className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04]"
					>
						Features
					</a>
					<a
						href="#how-it-works"
						onClick={() => setMobileOpen(false)}
						className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04]"
					>
						How it works
					</a>
					<a
						href="#download"
						onClick={() => setMobileOpen(false)}
						className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04]"
					>
						Download
					</a>
					<a
						href="#faq"
						onClick={() => setMobileOpen(false)}
						className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04]"
					>
						FAQ
					</a>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => setMobileOpen(false)}
						className="block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04]"
					>
						GitHub
					</a>
					<div className="pt-2">
						<a
							href="#download"
							onClick={() => setMobileOpen(false)}
							className="block text-center px-4 py-2.5 rounded-full bg-white text-black text-sm font-semibold"
						>
							Download Free
						</a>
					</div>
				</div>
			)}
		</nav>
	);
}
