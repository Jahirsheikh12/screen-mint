import { motion } from "motion/react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { reveal } from "../lib/motion";
import { SPONSOR_FAQS, SUPPORT_EMAIL_HREF } from "../lib/sponsors";
import { Slate } from "./Chapters";

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
			"This is macOS Gatekeeper blocking an unsigned app. First move ScreenMint.app into /Applications, then open Terminal and run: xattr -rd com.apple.quarantine /Applications/ScreenMint.app — this removes the quarantine flag from the final install location and lets the app launch normally.",
	},
	{
		question: "How do I contribute?",
		answer:
			"We welcome contributions! Check out our GitHub repository and the CONTRIBUTING.md file for guidelines. Bug reports, feature requests, translations, and code — everything helps.",
	},
	...SPONSOR_FAQS,
];

export function FAQ() {
	return (
		<section id="faq" className="px-5 py-20 md:px-8 md:py-28">
			<div className="mx-auto max-w-[1240px]">
				<motion.div {...reveal}>
					<Slate label="FAQ" timecode={`${faqs.length} questions`} />
				</motion.div>

				<div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-14">
					<motion.div {...reveal} className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
						<h2 className="font-display text-[clamp(2.5rem,4.6vw,4.25rem)] font-normal leading-[0.98] tracking-[-0.02em] text-paper">
							Before you <em className="whitespace-nowrap text-reel">hit record.</em>
						</h2>
						<p className="mt-6 text-[17px] leading-[1.6] text-paper/60">
							Still stuck?{" "}
							<a
								href={SUPPORT_EMAIL_HREF}
								className="text-paper underline decoration-paper/25 underline-offset-[5px] hover:decoration-reel"
							>
								Send an email
							</a>
							.
						</p>
					</motion.div>

					<motion.div {...reveal} className="lg:col-span-8">
						<Accordion type="single" collapsible className="border-t border-paper/15">
							{faqs.map((faq, i) => (
								<AccordionItem
									key={faq.question}
									value={faq.question}
									className="border-b border-paper/10"
								>
									<AccordionTrigger className="gap-6 py-5 text-left text-[17px] font-medium text-paper/85 hover:text-paper hover:no-underline data-[state=open]:text-paper md:text-[18px] [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-paper/40 [&[data-state=open]>svg]:text-reel">
										<span className="flex gap-5">
											<span className="w-7 shrink-0 pt-[5px] font-mono text-[12px] tabular-nums text-paper/40">
												{String(i + 1).padStart(2, "0")}
											</span>
											{faq.question}
										</span>
									</AccordionTrigger>
									<AccordionContent className="pb-6 pl-12 pr-10 text-[16px] leading-[1.65] text-paper/60">
										{faq.answer}
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
