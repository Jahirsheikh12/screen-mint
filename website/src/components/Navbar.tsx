import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Heart, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { REPO_URL } from "../lib/links";
import { CREEM_ENABLED, GITHUB_SPONSORS_URL } from "../lib/sponsors";
import { Button } from "./ui/button";

const NAV_LINKS = [
	{ label: "Features", href: "#features" },
	{ label: "How it works", href: "#how-it-works" },
	{ label: "Sponsor", href: "#sponsor" },
	...(CREEM_ENABLED ? [{ label: "Support via Card", href: "#sponsor" }] : []),
	{ label: "Download", href: "#download" },
	{ label: "FAQ", href: "#faq" },
	{ label: "GitHub", href: REPO_URL, external: true },
] as const;

const SECTION_IDS = ["features", "how-it-works", "sponsor", "download", "faq"];

export function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [activeSection, setActiveSection] = useState("");
	const navRef = useRef<HTMLElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);
	const mobileMenuRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);

	/* ── Scroll detection ── */
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	/* ── Active section detection via ScrollTrigger ── */
	useEffect(() => {
		const triggers: ScrollTrigger[] = [];
		for (const id of SECTION_IDS) {
			const el = document.getElementById(id);
			if (!el) continue;
			const st = ScrollTrigger.create({
				trigger: el,
				start: "top 40%",
				end: "bottom 40%",
				onToggle: (self) => {
					if (self.isActive) setActiveSection(id);
				},
			});
			triggers.push(st);
		}
		return () => triggers.forEach((t) => t.kill());
	}, []);

	/* ── GSAP capsule morph ── */
	useEffect(() => {
		if (!innerRef.current || !navRef.current || !bgRef.current) return;
		const dur = prefersReducedMotion() ? 0 : 0.5;
		const ease = "power3.inOut";

		if (scrolled) {
			gsap.to(navRef.current, { paddingTop: 8, duration: dur, ease });
			gsap.to(innerRef.current, {
				maxWidth: 800,
				paddingLeft: 20,
				paddingRight: 20,
				height: 50,
				duration: dur,
				ease,
			});
			gsap.to(bgRef.current, {
				opacity: 1,
				borderBottomColor: "rgba(255,255,255,0.06)",
				duration: dur,
				ease,
			});
		} else {
			gsap.to(navRef.current, { paddingTop: 16, duration: dur, ease });
			gsap.to(innerRef.current, {
				maxWidth: 920,
				paddingLeft: 28,
				paddingRight: 28,
				height: 56,
				duration: dur,
				ease,
			});
			gsap.to(bgRef.current, {
				opacity: 1,
				borderBottomColor: "rgba(255,255,255,0)",
				duration: dur,
				ease,
			});
		}
	}, [scrolled]);

	/* ── Mobile menu GSAP animation ── */
	useEffect(() => {
		const menu = mobileMenuRef.current;
		const backdrop = backdropRef.current;
		if (!menu || !backdrop) return;

		if (mobileOpen) {
			gsap.set(menu, { display: "block" });
			gsap.set(backdrop, { display: "block" });
			gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3 });
			gsap.fromTo(
				menu,
				{ opacity: 0, y: -12, scale: 0.97 },
				{ opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" },
			);
			const links = menu.querySelectorAll(".mobile-nav-link");
			gsap.fromTo(
				links,
				{ opacity: 0, x: -12 },
				{ opacity: 1, x: 0, duration: 0.3, stagger: 0.04, ease: "power2.out", delay: 0.1 },
			);
		} else {
			gsap.to(menu, {
				opacity: 0,
				y: -8,
				duration: 0.2,
				ease: "power2.in",
				onComplete: () => {
					gsap.set(menu, { display: "none" });
				},
			});
			gsap.to(backdrop, {
				opacity: 0,
				duration: 0.2,
				onComplete: () => {
					gsap.set(backdrop, { display: "none" });
				},
			});
		}
	}, [mobileOpen]);

	const closeMobile = () => setMobileOpen(false);

	return (
		<nav
			ref={navRef}
			className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4"
			style={{ paddingTop: 16 }}
		>
			<div
				ref={innerRef}
				className="relative w-full flex items-center justify-between"
				style={{ maxWidth: 920, paddingLeft: 28, paddingRight: 28, height: 56, borderRadius: 999 }}
			>
				{/* Glass background */}
				<div
					ref={bgRef}
					className="absolute inset-0 pointer-events-none"
					style={{
						opacity: 1,
						background: "rgba(18, 18, 18, 0.72)",
						backdropFilter: "blur(40px) saturate(180%)",
						WebkitBackdropFilter: "blur(40px) saturate(180%)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						borderRadius: 999,
					}}
				/>

				{/* Logo */}
				<a href="#" className="relative z-10 flex items-center gap-2.5 group">
					<img
						src="/images/screenmint-mark.png"
						alt="ScreenMint mark"
						className="h-9 w-auto object-contain drop-shadow-[0_6px_16px_rgba(0,108,255,0.28)]"
						loading="eager"
					/>
					<span className="text-[15px] font-semibold tracking-[-0.02em] text-white/90 group-hover:text-white transition-colors">
						Screen<span className="text-brand-400">Mint</span>
					</span>
				</a>

				{/* Desktop nav */}
				<div className="relative z-10 hidden md:flex items-center gap-0.5">
					{NAV_LINKS.map((link) => {
						const sectionId = link.href.replace("#", "");
						const isActive = activeSection === sectionId;
						const isExternal = "external" in link && link.external;
						return (
							<a
								key={link.label}
								href={link.href}
								{...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
								className={`relative px-3 py-1.5 text-[13px] rounded-full transition-colors duration-300 ${
									isActive
										? "text-white bg-white/[0.06]"
										: "text-white/40 hover:text-white hover:bg-white/[0.04]"
								}`}
							>
								{link.label}
								{isActive && (
									<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
								)}
							</a>
						);
					})}

					<Button
						asChild
						className="ml-2 h-auto rounded-full bg-brand-500 px-4 py-1.5 text-[13px] font-semibold text-[#121212] shadow-none transition-all duration-200 hover:bg-brand-400 hover:text-[#121212] active:scale-[0.97] [&_svg]:size-3.5"
					>
						<a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer">
							<Heart className="w-3.5 h-3.5" strokeWidth={2.5} />
							Sponsor
						</a>
					</Button>
				</div>

				{/* Mobile hamburger */}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="relative z-10 md:hidden h-auto w-auto rounded-none bg-transparent p-2 text-white/50 shadow-none transition-colors hover:bg-transparent hover:text-white focus-visible:ring-0 [&_svg]:size-5"
					onClick={() => setMobileOpen(!mobileOpen)}
					aria-label="Toggle menu"
				>
					{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
				</Button>
			</div>

			{/* Mobile backdrop */}
			<div
				ref={backdropRef}
				className="md:hidden fixed inset-0 bg-[#121212]/70 z-40"
				style={{ display: "none" }}
				onClick={closeMobile}
			/>

			{/* Mobile menu */}
			<div
				ref={mobileMenuRef}
				className="md:hidden absolute top-20 left-4 right-4 rounded-2xl px-5 py-4 flex flex-col gap-1 z-50"
				style={{
					display: "none",
					background: "rgba(18, 18, 18, 0.94)",
					backdropFilter: "blur(40px) saturate(180%)",
					WebkitBackdropFilter: "blur(40px) saturate(180%)",
					border: "1px solid rgba(255, 255, 255, 0.08)",
				}}
			>
				{NAV_LINKS.map((link) => {
					const isExternal = "external" in link && link.external;
					return (
						<a
							key={link.label}
							href={link.href}
							{...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
							onClick={closeMobile}
							className="mobile-nav-link block px-3 py-2.5 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
						>
							{link.label}
						</a>
					);
				})}
				<div className="pt-2">
					<Button
						asChild
						className="mobile-nav-link block h-auto w-full rounded-full bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-[#121212] shadow-none hover:bg-brand-500 hover:text-[#121212]"
					>
						<a
							href={GITHUB_SPONSORS_URL}
							target="_blank"
							rel="noopener noreferrer"
							onClick={closeMobile}
						>
							Sponsor ScreenMint
						</a>
					</Button>
				</div>
			</div>
		</nav>
	);
}
