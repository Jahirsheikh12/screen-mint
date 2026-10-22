import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { REPO_URL } from "../lib/links";
import { EASE_OUT, lenis } from "../lib/motion";
import { CREEM_ENABLED } from "../lib/sponsors";
import { GitHubIcon } from "./BrandIcons";

const NAV_LINKS = [
	{ label: "Features", href: "#features" },
	{ label: "How it works", href: "#how-it-works" },
	{ label: "Sponsor", href: "#sponsor" },
	...(CREEM_ENABLED ? [{ label: "Support via Card", href: "#sponsor" }] : []),
	{ label: "FAQ", href: "#faq" },
];

const SECTION_IDS = ["features", "how-it-works", "download", "sponsor", "faq"];

export function Navbar() {
	const [floating, setFloating] = useState(false);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState("");

	useEffect(() => {
		const onScroll = () => {
			setFloating(window.scrollY > 24);
			// Back in the hero, no section is current; the observer below never sees the hero.
			if (window.scrollY < window.innerHeight * 0.5) setActive("");
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// The section crossing the middle of the viewport is the active one.
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
			},
			{ rootMargin: "-45% 0px -50% 0px" },
		);
		for (const id of SECTION_IDS) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, []);

	// The mobile sheet freezes the page behind it and closes on Escape.
	useEffect(() => {
		if (!open) return;
		lenis?.stop();
		document.body.style.overflow = "hidden";
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		window.addEventListener("keydown", onKey);
		return () => {
			lenis?.start();
			document.body.style.overflow = "";
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const bar = floating && !open;

	return (
		<header className="fixed inset-x-0 top-0 z-50 px-3 font-body text-paper md:px-6">
			<div
				className={`mx-auto transition-[max-width,margin,padding,background-color,box-shadow] duration-500 ease-out ${
					bar
						? "mt-3 max-w-[1040px] rounded-[14px] bg-[#1a1a1c]/80 px-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl md:px-4"
						: "mt-0 max-w-[1200px] bg-transparent px-2"
				}`}
			>
				<nav className="grid h-14 grid-cols-[1fr_auto] items-center md:grid-cols-[1fr_auto_1fr]">
					<a
						href="#top"
						className="flex items-center gap-2.5 justify-self-start"
						aria-label="ScreenMint home"
					>
						<img
							src="/images/screenmint-64.png"
							alt=""
							width={26}
							height={26}
							className="h-[26px] w-[26px]"
						/>
						<span className="text-[16px] font-semibold tracking-[-0.01em]">ScreenMint</span>
					</a>

					<div className="hidden items-center gap-1 md:flex">
						{NAV_LINKS.map((link) => {
							const isActive = active === link.href.slice(1);
							return (
								<a
									key={link.label}
									href={link.href}
									aria-current={isActive ? "true" : undefined}
									className={`rounded-[8px] px-3 py-1.5 text-[14px] transition-colors ${
										isActive ? "text-white" : "text-white/55 hover:text-white"
									}`}
								>
									{link.label}
								</a>
							);
						})}
					</div>

					<div className="flex items-center gap-1.5 justify-self-end">
						<a
							href={REPO_URL}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="ScreenMint on GitHub"
							className="hidden h-9 w-9 items-center justify-center rounded-[8px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white sm:flex"
						>
							<GitHubIcon className="h-[18px] w-[18px]" />
						</a>
						<a href="#download" className="btn-primary h-9 rounded-[8px] px-3.5 text-[14px]">
							Download
						</a>
						<button
							type="button"
							onClick={() => setOpen(!open)}
							aria-label={open ? "Close menu" : "Open menu"}
							aria-expanded={open}
							aria-controls="mobile-nav"
							className="flex h-9 w-9 items-center justify-center rounded-[8px] text-white/75 hover:text-white md:hidden"
						>
							{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
						</button>
					</div>
				</nav>
			</div>

			<AnimatePresence>
				{open ? (
					<motion.div
						id="mobile-nav"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 -z-10 flex flex-col bg-ink px-6 pb-8 pt-24 md:hidden"
					>
						<nav className="flex flex-col">
							{[...NAV_LINKS, { label: "GitHub", href: REPO_URL }].map((link, i) => (
								<motion.a
									key={link.label}
									href={link.href}
									onClick={() => setOpen(false)}
									{...(link.href.startsWith("http")
										? { target: "_blank", rel: "noopener noreferrer" }
										: {})}
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4, delay: 0.04 + i * 0.04, ease: EASE_OUT }}
									className="border-b border-white/[0.07] py-4 text-[26px] font-semibold tracking-[-0.02em] text-white"
								>
									{link.label}
								</motion.a>
							))}
						</nav>
						<a
							href="#download"
							onClick={() => setOpen(false)}
							className="btn-primary mt-auto h-12 text-[16px]"
						>
							Download ScreenMint
						</a>
					</motion.div>
				) : null}
			</AnimatePresence>
		</header>
	);
}
