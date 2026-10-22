import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { SPONSOR_FAQS, SUPPORT_EMAIL_HREF } from "../lib/sponsors";
import { SectionTitle } from "./Chapters";

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
		<section id="faq" className="px-5 pt-28 md:px-8 md:pt-40">
			<div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
				<div className="lg:sticky lg:top-28 lg:self-start">
					<SectionTitle title="Questions and answers" align="left">
						Something else on your mind?{" "}
						<a
							href={SUPPORT_EMAIL_HREF}
							className="text-white underline decoration-white/25 underline-offset-[5px] transition-colors hover:decoration-reel"
						>
							Send an email
						</a>
						.
					</SectionTitle>
				</div>

				<Accordion type="single" collapsible className="border-t border-white/[0.08]">
					{faqs.map((faq) => (
						<AccordionItem
							key={faq.question}
							value={faq.question}
							className="border-b border-white/[0.08]"
						>
							<AccordionTrigger className="gap-6 py-5 text-left text-[17px] font-semibold text-white/85 transition-colors hover:text-white hover:no-underline data-[state=open]:text-white [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-white/40">
								{faq.question}
							</AccordionTrigger>
							<AccordionContent className="max-w-[62ch] pb-6 pr-8 text-[16px] leading-[1.65] text-white/55">
								{faq.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</section>
	);
}
