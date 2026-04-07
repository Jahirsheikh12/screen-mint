import gsap from "gsap";
import { useEffect, useRef } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { prefersReducedMotion } from "../hooks/useGSAP";
import { SPONSOR_FAQS } from "../lib/sponsors";

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
			"This is macOS Gatekeeper blocking an unsigned app. First move ScreenMint.app into /Applications, then open Terminal and run: xattr -cr /Applications/ScreenMint.app — this removes the quarantine flag from the final install location and lets the app launch normally.",
	},
	{
		question: "How do I contribute?",
		answer:
			"We welcome contributions! Check out our GitHub repository and the CONTRIBUTING.md file for guidelines. Bug reports, feature requests, translations, and code — everything helps.",
	},
	...SPONSOR_FAQS,
];

export function FAQ() {
	const sectionRef = useRef<HTMLElement>(null);

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
				".faq-col-left .faq-item-wrap",
				{ opacity: 0, x: -20 },
				{
					opacity: 1,
					x: 0,
					duration: 0.5,
					stagger: 0.06,
					ease: "power2.out",
					scrollTrigger: { trigger: ".faq-grid", start: "top 85%", once: true },
				},
			);

			gsap.fromTo(
				".faq-col-right .faq-item-wrap",
				{ opacity: 0, x: 20 },
				{
					opacity: 1,
					x: 0,
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
				<div className="faq-grid grid md:grid-cols-2 gap-4">
					<div className="faq-col-left">
						<Accordion type="single" collapsible className="space-y-2">
							{leftColumn.map((faq) => {
								const originalIndex = faqs.indexOf(faq);
								return (
									<div key={faq.question} className="faq-item-wrap will-animate">
										<AccordionItem
											value={`faq-${originalIndex}`}
											className="rounded-xl border-0 data-[state=open]:bg-white/[0.03] data-[state=open]:border data-[state=open]:border-white/[0.06] px-5 md:px-6 transition-colors"
										>
											<AccordionTrigger className="py-5 text-[14px] md:text-[15px] font-medium text-white/50 hover:text-white/70 hover:no-underline data-[state=open]:text-white gap-4 [&>svg]:text-white/20 [&[data-state=open]>svg]:text-brand-500">
												<div className="flex items-start gap-4 text-left">
													<span className="text-[12px] font-mono text-white/10 mt-0.5 flex-shrink-0 tabular-nums">
														{String(originalIndex + 1).padStart(2, "0")}
													</span>
													<span>{faq.question}</span>
												</div>
											</AccordionTrigger>
											<AccordionContent className="text-[13px] text-white/25 leading-relaxed pl-10 pr-4">
												{faq.answer}
											</AccordionContent>
										</AccordionItem>
									</div>
								);
							})}
						</Accordion>
					</div>

					<div className="faq-col-right">
						<Accordion type="single" collapsible className="space-y-2">
							{rightColumn.map((faq) => {
								const originalIndex = faqs.indexOf(faq);
								return (
									<div key={faq.question} className="faq-item-wrap will-animate">
										<AccordionItem
											value={`faq-${originalIndex}`}
											className="rounded-xl border-0 data-[state=open]:bg-white/[0.03] data-[state=open]:border data-[state=open]:border-white/[0.06] px-5 md:px-6 transition-colors"
										>
											<AccordionTrigger className="py-5 text-[14px] md:text-[15px] font-medium text-white/50 hover:text-white/70 hover:no-underline data-[state=open]:text-white gap-4 [&>svg]:text-white/20 [&[data-state=open]>svg]:text-brand-500">
												<div className="flex items-start gap-4 text-left">
													<span className="text-[12px] font-mono text-white/10 mt-0.5 flex-shrink-0 tabular-nums">
														{String(originalIndex + 1).padStart(2, "0")}
													</span>
													<span>{faq.question}</span>
												</div>
											</AccordionTrigger>
											<AccordionContent className="text-[13px] text-white/25 leading-relaxed pl-10 pr-4">
												{faq.answer}
											</AccordionContent>
										</AccordionItem>
									</div>
								);
							})}
						</Accordion>
					</div>
				</div>
			</div>
		</section>
	);
}
