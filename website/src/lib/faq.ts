import { SPONSOR_FAQS } from "./sponsors";

export type Faq = { question: string; answer: string };

/** Product questions in themed groups, shown in the FAQ section. */
export const FAQ_GROUPS: { id: string; title: string; items: Faq[] }[] = [
	{
		id: "faq-basics",
		title: "The basics",
		items: [
			{
				question: "Is ScreenMint really free?",
				answer:
					"Yes. ScreenMint is free and open source under the MIT license. Every feature is included, with no trial, no watermark and no hidden fees.",
			},
			{
				question: "Does ScreenMint add a watermark?",
				answer: "No. Exports are clean in every format, with no ScreenMint logo or watermark.",
			},
			{
				question: "Do I need an account?",
				answer:
					"No. Download the app and start recording. There is nothing to sign up for and nothing to log in to.",
			},
			{
				question: "What platforms are supported?",
				answer:
					"macOS 12.3 or later, Windows 10 or later, and Linux. On each one, ScreenMint records with the operating system's own screen capture.",
			},
		],
	},
	{
		id: "faq-recording",
		title: "Recording and editing",
		items: [
			{
				question: "Can ScreenMint record system audio and my microphone?",
				answer:
					"Yes. It can record your microphone and your computer's sound together, where your operating system allows it.",
			},
			{
				question: "How does the auto-zoom feature work?",
				answer:
					"ScreenMint tracks your clicks while you record. The editor turns them into smooth zooms that follow your cursor, so viewers always see what you are doing, with no manual keyframing.",
			},
			{
				question: "Can I customize the cursor appearance?",
				answer:
					"Yes. You can turn on smooth cursor movement, click highlights, motion blur and a natural sway.",
			},
			{
				question: "Can I edit a recording later?",
				answer:
					"Yes. ScreenMint saves editable projects as .screenmint files, so you can reopen a recording and change zooms, styling or trims at any time.",
			},
			{
				question: "What export formats are available?",
				answer:
					"MP4 (H.264) or GIF, both rendered on your GPU for fast exports. You choose the resolution, frame rate and quality.",
			},
		],
	},
	{
		id: "faq-privacy",
		title: "Privacy, install and contributing",
		items: [
			{
				question: "Is my data sent anywhere?",
				answer:
					"No. ScreenMint runs entirely on your computer, and your recordings, projects and exports never leave it. There is no account, no telemetry and no analytics.",
			},
			{
				question: "macOS says the app can't be opened?",
				answer:
					"That is macOS Gatekeeper blocking an unsigned app. Move ScreenMint.app into /Applications, then run this once in Terminal: xattr -rd com.apple.quarantine /Applications/ScreenMint.app",
			},
			{
				question: "How do I contribute?",
				answer:
					"Start with the GitHub repository and its CONTRIBUTING.md guide. Bug reports, feature requests, translations and code all help.",
			},
		],
	},
];

/** Every question on the page (the sponsoring ones sit in the sponsor section), for FAQPage data. */
export const ALL_FAQS: readonly Faq[] = [
	...FAQ_GROUPS.flatMap((group) => group.items),
	...SPONSOR_FAQS,
];
