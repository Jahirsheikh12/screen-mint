import { SPONSOR_FAQS } from "./sponsors";

export type Faq = { question: string; answer: string };

/** Product questions. Shared by the FAQ section and the FAQPage structured data. */
export const PRODUCT_FAQS: Faq[] = [
	{
		question: "Is ScreenMint really free?",
		answer:
			"Yes, completely free and open source under the MIT license. No trials, no watermarks, no hidden fees. You get the full app with every feature included.",
	},
	{
		question: "Does ScreenMint add a watermark?",
		answer:
			"No. Every export is clean, with no ScreenMint logo or watermark, whichever format you choose.",
	},
	{
		question: "What platforms are supported?",
		answer:
			"ScreenMint runs on macOS (12.3+), Windows (10+), and Linux. Each platform uses native capture APIs for the best possible performance — ScreenCaptureKit on macOS, Windows.Graphics.Capture on Windows, and Chromium's getDisplayMedia on Linux.",
	},
	{
		question: "Do I need an account?",
		answer:
			"No. Download the app and start recording. There is nothing to sign up for and nothing to log in to.",
	},
	{
		question: "Can ScreenMint record system audio and my microphone?",
		answer:
			"Yes. ScreenMint can capture your microphone and your computer's sound together, where your operating system supports it.",
	},
	{
		question: "How does the auto-zoom feature work?",
		answer:
			"ScreenMint tracks your mouse clicks and interactions during recording. In the editor, it automatically generates smooth zoom keyframes that follow your cursor, so your audience always sees exactly what you're doing — no manual keyframing needed.",
	},
	{
		question: "Can I edit a recording later?",
		answer:
			"Yes. ScreenMint saves editable projects as .screenmint files, so you can reopen a recording and change zooms, styling or trims at any time.",
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
];

export const FAQ_GROUPS: { title: string; items: readonly Faq[] }[] = [
	{ title: "Using ScreenMint", items: PRODUCT_FAQS },
	{ title: "Sponsoring", items: SPONSOR_FAQS },
];
