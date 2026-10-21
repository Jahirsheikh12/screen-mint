import { Menu, X } from "lucide-react";
import { motion, useScroll } from "motion/react";
import { useState } from "react";
import { REPO_URL } from "../lib/links";
import { CREEM_ENABLED } from "../lib/sponsors";

const NAV_LINKS = [
	{ label: "Features", href: "#features" },
	{ label: "How it works", href: "#how-it-works" },
	{ label: "Download", href: "#download" },
	{ label: "Sponsor", href: "#sponsor" },
	...(CREEM_ENABLED ? [{ label: "Support via Card", href: "#sponsor" }] : []),
	{ label: "FAQ", href: "#faq" },
];

export function Navbar() {
	const [open, setOpen] = useState(false);
	const { scrollYProgress } = useScroll();

	return (
		<header className="fixed inset-x-0 top-0 z-50 border-b border-paper/10 bg-ink/85 font-body text-paper backdrop-blur-md">
			<nav className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 md:px-8">
				<a href="#" className="flex items-center gap-2.5" aria-label="ScreenMint home">
					<img src="/images/screenmint-64.png" alt="" width={24} height={24} className="h-6 w-6" />
					<span className="text-[15px] font-semibold tracking-[-0.01em]">ScreenMint</span>
				</a>

				<div className="hidden items-center gap-7 md:flex">
					{NAV_LINKS.map((link) => (
						<a
							key={link.label}
							href={link.href}
							className="text-[14px] text-paper/60 transition-colors hover:text-paper"
						>
							{link.label}
						</a>
					))}
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[14px] text-paper/60 transition-colors hover:text-paper"
					>
						GitHub
					</a>
				</div>

				<div className="flex items-center gap-2">
					<a
						href="#download"
						className="flex h-8 items-center rounded-[4px] bg-reel px-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-[#ffc54d]"
					>
						Download
					</a>
					<button
						type="button"
						onClick={() => setOpen(!open)}
						aria-label={open ? "Close menu" : "Open menu"}
						aria-expanded={open}
						aria-controls="mobile-nav"
						className="flex h-9 w-9 items-center justify-center text-paper/70 hover:text-paper md:hidden"
					>
						{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</nav>

			{open ? (
				<div id="mobile-nav" className="border-t border-paper/10 px-5 pb-4 md:hidden">
					{[...NAV_LINKS, { label: "GitHub", href: REPO_URL }].map((link) => (
						<a
							key={link.label}
							href={link.href}
							onClick={() => setOpen(false)}
							{...(link.href.startsWith("http")
								? { target: "_blank", rel: "noopener noreferrer" }
								: {})}
							className="block border-b border-paper/[0.06] py-3 text-[16px] text-paper/75 last:border-0 hover:text-paper"
						>
							{link.label}
						</a>
					))}
				</div>
			) : null}

			{/* Scroll playhead */}
			<motion.div
				aria-hidden="true"
				style={{ scaleX: scrollYProgress }}
				className="absolute inset-x-0 -bottom-px h-px origin-left bg-reel"
			/>
		</header>
	);
}
