import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGSAP";

const faqs = [
	{
		question: "Is ScreenMint really free?",
		answer:
			"Yes, completely free and open source under the MIT license. No trials, no watermarks, no hidden fees. You get the full app with every feature included.",
	},
	{
		question: "What platforms are supported?",
		answer:
			"ScreenMint runs on macOS (12+), Windows (10+), and Linux. Each platform uses native capture APIs for the best possible performance — ScreenCaptureKit on macOS, Windows.Graphics.Capture on Windows, and Chromium's getDisplayMedia on Linux.",
	},
	{
		question: "How does the auto-zoom feature work?",
		answer:
			"ScreenMint tracks your mouse clicks and interactions during recording. In the editor, it automatically generates smooth zoom keyframes that follow your cursor, so your audience always sees exactly what you're doing — no manual keyframing needed.",
	},
	{
		question: "What export formats are available?",
		answer:
			"You can export as MP4 (H.264) or GIF. Both use GPU-accelerated rendering for fast exports. You can customize resolution, frame rate, and quality settings.",
	},
	{
		question: "Can I customize the cursor appearance?",
		answer:
			"Absolutely. ScreenMint offers cursor effects including smooth tracking, click highlights, motion blur, and a unique sway animation that makes recordings feel natural and polished.",
	},
	{
		question: "Is my data sent anywhere?",
		answer:
			"No. ScreenMint runs entirely on your machine. Your recordings, projects, and exports never leave your computer. There are no accounts, no telemetry, no analytics.",
	},
	{
		question: "macOS says the app can't be opened?",
		answer:
			"This is macOS Gatekeeper blocking unsigned apps. Open Terminal and run: xattr -cr /Applications/ScreenMint.app — this removes the quarantine flag and lets the app launch normally.",
	},
	{
		question: "How do I contribute?",
		answer:
			"We welcome contributions! Check out our GitHub repository and the CONTRIBUTING.md file for guidelines. Bug reports, feature requests, translations, and code — everything helps.",
	},
];

function FAQItem({
	question,
	answer,
	index,
	isOpen,
	onToggle,
}: {
	question: string;
	answer: string;
	index: number;
	isOpen: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`faq-item group w-full text-left rounded-xl p-5 md:p-6 transition-all duration-300 ${
				isOpen
					? "bg-white/[0.03] border border-white/[0.06]"
					: "bg-transparent border border-transparent hover:bg-white/[0.02]"
			}`}
		>
			<div className="flex items-start gap-4">
				<span className="text-[12px] font-mono text-white/10 mt-0.5 flex-shrink-0 tabular-nums">
					{String(index + 1).padStart(2, "0")}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-4">
						<h3
							className={`text-[14px] md:text-[15px] font-medium transition-colors duration-300 ${
								isOpen ? "text-white" : "text-white/50 group-hover:text-white/70"
							}`}
						>
							{question}
						</h3>
						<div
							className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
								isOpen ? "bg-brand-500/15 rotate-45" : "bg-white/[0.04]"
							}`}
						>
							<svg
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke={isOpen ? "#F59E0B" : "rgba(255,255,255,0.2)"}
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="transition-colors duration-300"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</div>
					</div>
					<div className={`faq-answer ${isOpen ? "open" : ""}`}>
						<div>
							<p className="text-[13px] text-white/25 leading-relaxed pt-3 pr-8">
								{answer}
							</p>
						</div>
					</div>
				</div>
			</div>
		</button>
	);
}

export function FAQ() {
	const sectionRef = useRef<HTMLElement>(null);
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".faq-heading",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: { trigger: ".faq-heading", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".faq-item",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.5,
					stagger: 0.06,
					ease: "power2.out",
					scrollTrigger: { trigger: ".faq-grid", start: "top 85%", once: true },
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	const leftColumn = faqs.filter((_, i) => i % 2 === 0);
	const rightColumn = faqs.filter((_, i) => i % 2 === 1);

	return (
		<section ref={sectionRef} id="faq" className="relative py-20 md:py-28 px-6">
			<div className="section-divider max-w-6xl mx-auto mb-20" />

			<div className="max-w-5xl mx-auto">
				{/* Heading */}
				<div className="faq-heading text-center mb-14 will-animate">
					<p className="section-eyebrow mb-4">FAQ</p>
					<h2 className="section-headline">
						Got questions<span className="text-brand-500">?</span>
					</h2>
				</div>

				{/* Two-column FAQ grid */}
				<div className="faq-grid grid md:grid-cols-2 gap-2">
					<div className="flex flex-col gap-2">
						{leftColumn.map((faq) => {
							const originalIndex = faqs.indexOf(faq);
							return (
								<FAQItem
									key={faq.question}
									question={faq.question}
									answer={faq.answer}
									index={originalIndex}
									isOpen={openIndex === originalIndex}
									onToggle={() =>
										setOpenIndex(openIndex === originalIndex ? null : originalIndex)
									}
								/>
							);
						})}
					</div>
					<div className="flex flex-col gap-2">
						{rightColumn.map((faq) => {
							const originalIndex = faqs.indexOf(faq);
							return (
								<FAQItem
									key={faq.question}
									question={faq.question}
									answer={faq.answer}
									index={originalIndex}
									isOpen={openIndex === originalIndex}
									onToggle={() =>
										setOpenIndex(openIndex === originalIndex ? null : originalIndex)
									}
								/>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
