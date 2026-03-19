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
			"You can export as MP4 (H.264) or GIF. Both use GPU-accelerated rendering for fast exports. You can customize resolution, frame rate, and quality settings. MP4 exports include all effects, zoom, and annotations.",
	},
	{
		question: "Can I customize the cursor appearance?",
		answer:
			"Absolutely. ScreenMint offers cursor effects including smooth tracking, click highlights, motion blur, and a unique sway animation that makes recordings feel natural and polished. All effects are configurable in the editor.",
	},
	{
		question: "Is my data sent anywhere?",
		answer:
			"No. ScreenMint runs entirely on your machine. Your recordings, projects, and exports never leave your computer. There are no accounts, no telemetry, no analytics — just a local app.",
	},
	{
		question: "macOS says the app can't be opened. What do I do?",
		answer:
			'This is macOS Gatekeeper blocking unsigned apps downloaded from the internet. Open Terminal and run: xattr -cr /Applications/ScreenMint.app — this removes the quarantine flag and lets the app launch normally. You can find this command in the Download section above.',
	},
	{
		question: "How do I contribute to the project?",
		answer:
			"We welcome contributions! Check out our GitHub repository and the CONTRIBUTING.md file for guidelines. Whether it's bug reports, feature requests, translations, or code contributions — everything helps.",
	},
];

function FAQItem({
	question,
	answer,
	isOpen,
	onToggle,
}: {
	question: string;
	answer: string;
	isOpen: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="border-b border-white/[0.06] last:border-b-0">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between py-6 text-left group"
			>
				<span className="text-[16px] md:text-[17px] font-semibold text-[#f5f5f7] pr-8 group-hover:text-brand-400 transition-colors duration-300">
					{question}
				</span>
				<div
					className={`w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0 transition-all duration-400 ${
						isOpen ? "bg-brand-500/10 rotate-45" : ""
					}`}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke={isOpen ? "#10B981" : "#86868b"}
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="transition-colors duration-300"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</div>
			</button>
			<div className={`faq-answer ${isOpen ? "open" : ""}`}>
				<div>
					<p className="text-[14px] md:text-[15px] text-[#86868b] leading-relaxed pb-6 pr-12">
						{answer}
					</p>
				</div>
			</div>
		</div>
	);
}

export function FAQ() {
	const sectionRef = useRef<HTMLElement>(null);
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	useEffect(() => {
		if (prefersReducedMotion()) return;

		const ctx = gsap.context(() => {
			gsap.fromTo(
				".faq-eyebrow",
				{ opacity: 0, y: 20 },
				{
					opacity: 1,
					y: 0,
					duration: 0.6,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".faq-eyebrow",
						start: "top 85%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".faq-headline",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".faq-headline",
						start: "top 85%",
						once: true,
					},
				},
			);

			gsap.fromTo(
				".faq-list",
				{ opacity: 0, y: 30 },
				{
					opacity: 1,
					y: 0,
					duration: 0.7,
					ease: "power2.out",
					scrollTrigger: {
						trigger: ".faq-list",
						start: "top 85%",
						once: true,
					},
				},
			);
		}, sectionRef);

		return () => ctx.revert();
	}, []);

	return (
		<section ref={sectionRef} id="faq" className="relative py-32 md:py-40 px-6">
			{/* Divider */}
			<div className="section-divider max-w-6xl mx-auto mb-32" />

			<div className="max-w-3xl mx-auto">
				{/* Heading */}
				<div className="text-center mb-16">
					<p className="faq-eyebrow section-eyebrow mb-4 will-animate">
						FAQ
					</p>
					<h2 className="faq-headline section-headline will-animate">
						Questions? Answers.
					</h2>
				</div>

				{/* FAQ list */}
				<div className="faq-list rounded-2xl bg-[#2d2d2f]/30 border border-white/[0.06] px-8 md:px-10 will-animate">
					{faqs.map((faq, index) => (
						<FAQItem
							key={faq.question}
							question={faq.question}
							answer={faq.answer}
							isOpen={openIndex === index}
							onToggle={() =>
								setOpenIndex(
									openIndex === index ? null : index,
								)
							}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
