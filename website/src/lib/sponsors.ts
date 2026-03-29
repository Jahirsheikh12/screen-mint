export type FundingPage = "privacy" | "refund" | "support" | "terms";
export type SupportStatus = "cancelled" | "success";
export type SupportProvider = "creem";

export type CreemProduct = {
	id: string;
	checkoutUrl: string;
	description: string;
	label: string;
	name: string;
	price: string;
};

export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/Jahirsheikh12";
export const SUPPORT_EMAIL = "jahirsheikh211@gmail.com";
export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;

export const SUPPORT_RETURN_QUERY_PARAM = "support";
export const SUPPORT_PROVIDER_QUERY_PARAM = "provider";
export const SUPPORT_PRODUCT_QUERY_PARAM = "product";

export const CREEM_PRODUCTS: CreemProduct[] = [
	{
		id: "supporter",
		name: "ScreenMint Supporter",
		price: "$10",
		label: "One-time support",
		description:
			"Helps fund bug fixes, product polish, and faster progress on the free open-source app.",
		checkoutUrl: "",
	},
	{
		id: "backer",
		name: "ScreenMint Backer",
		price: "$25",
		label: "One-time support",
		description:
			"Supports release QA, cross-platform maintenance, and the next round of recording workflow improvements.",
		checkoutUrl: "",
	},
	{
		id: "release-boost",
		name: "ScreenMint Release Boost",
		price: "$50",
		label: "One-time support",
		description:
			"Meaningful support for larger updates, stabilization work, and future releases without adding paywalls.",
		checkoutUrl: "",
	},
] as const;

export const CREEM_ENABLED = CREEM_PRODUCTS.every(
	(product) => product.checkoutUrl.trim().length > 0,
);

export const SPONSOR_MISSION =
	"ScreenMint stays free because sponsors help fund bug fixes, polish, and steady open-source releases.";

export const SPONSOR_SUPPORT_COPY =
	"Support open-source development and help fund new features, bug fixes, and future releases.";

export const SPONSOR_TIERS = [
	{
		name: "$5 Supporter",
		description:
			"A simple vote for more polish, more fixes, and more time spent improving ScreenMint.",
	},
	{
		name: "$12 Backer",
		description:
			"Helps fund steady maintenance, release QA, and the next round of workflow upgrades.",
	},
	{
		name: "$25 Sponsor",
		description:
			"Meaningful support for bigger features, faster iteration, and long-term project momentum.",
	},
] as const;

export const SPONSOR_FAQS = [
	{
		question: "Why does ScreenMint have sponsorships?",
		answer:
			"ScreenMint is free and open source, and sponsorships help fund the time needed for bug fixes, performance work, platform support, and new releases.",
	},
	{
		question: "Will ScreenMint stay free?",
		answer:
			"Yes. Sponsorship keeps development sustainable, but the core app remains free and open source for everyone.",
	},
	{
		question: "Do sponsors control the roadmap?",
		answer:
			"No. Sponsors help keep the project moving, but sponsorship does not guarantee feature delivery, support SLAs, or roadmap control.",
	},
	{
		question: "Can I stay anonymous?",
		answer:
			"Yes. Sponsors are treated as private by default unless you explicitly choose to be public through GitHub Sponsors.",
	},
	{
		question: "What if I want to support without GitHub?",
		answer:
			"You can use the one-time card support option on the website when it is available. GitHub Sponsors remains the primary home for recurring support.",
	},
	{
		question: "What happens if I cancel my sponsorship?",
		answer:
			"Nothing breaks. ScreenMint stays free and open source, and your sponsorship simply stops renewing according to GitHub Sponsors settings.",
	},
] as const;

const FUNDING_PAGES: Record<
	FundingPage,
	{ description: string; sections: Array<{ body: string[]; title: string }>; title: string }
> = {
	privacy: {
		title: "Privacy Policy",
		description:
			"How ScreenMint handles website visitors, support purchases, and sponsor interactions.",
		sections: [
			{
				title: "What We Collect",
				body: [
					"ScreenMint itself does not require an account and does not add telemetry to the desktop app.",
					"When you contact support or complete a support purchase through a third-party provider, the provider may share details such as your name, email address, and transaction status so the purchase can be fulfilled.",
				],
			},
			{
				title: "How Information Is Used",
				body: [
					"We use support and sponsorship details only to respond to support requests, confirm purchases, send acknowledgments, and keep the project sustainable.",
					"We do not sell customer data or use ad-tracking platforms on the website.",
				],
			},
			{
				title: "Third-Party Providers",
				body: [
					"GitHub Sponsors and Creem process payments on their own platforms and apply their own privacy policies and compliance rules.",
					"If you have a billing or payment-method question, you may need to work with the payment provider directly.",
				],
			},
		],
	},
	refund: {
		title: "Refund Policy",
		description:
			"How refund requests are handled for one-time support purchases and sponsor payments.",
		sections: [
			{
				title: "GitHub Sponsors",
				body: [
					"GitHub Sponsors payments are managed by GitHub under GitHub Sponsors billing policies.",
					"Monthly and one-time GitHub sponsorship changes are handled through your GitHub billing settings.",
				],
			},
			{
				title: "Creem One-Time Support",
				body: [
					"Creem support purchases are intended as one-time support for the ongoing development of the free open-source app.",
					"Refunds are generally only considered for duplicate charges, accidental double purchases, or clear billing errors reported within 7 days.",
				],
			},
			{
				title: "How To Request Help",
				body: [
					`Email ${SUPPORT_EMAIL} with your purchase email, payment date, and the reason for the request.`,
					"If a payment provider requires the request to be handled in their dashboard, we will point you to the correct process.",
				],
			},
		],
	},
	support: {
		title: "Support",
		description: "How to contact ScreenMint for billing, refund, and general project questions.",
		sections: [
			{
				title: "Contact",
				body: [
					`Email ${SUPPORT_EMAIL} for billing questions, support-purchase issues, and general project inquiries.`,
					"We aim to respond as quickly as possible, but support purchases do not create a guaranteed SLA or a private support contract.",
				],
			},
			{
				title: "What Support Covers",
				body: [
					"Support requests can include billing questions, duplicate charge reports, and clarification around website support options.",
					"Feature requests, roadmap ideas, and bug reports are still best shared through GitHub issues so the project stays open and transparent.",
				],
			},
		],
	},
	terms: {
		title: "Terms of Support",
		description:
			"Simple terms for using the website, sponsoring the project, and making support purchases.",
		sections: [
			{
				title: "Project Access",
				body: [
					"ScreenMint is distributed as free open-source software under the MIT License.",
					"Sponsorship or support purchases help fund development but do not grant ownership, exclusivity, or guaranteed product decisions.",
				],
			},
			{
				title: "Support Purchases",
				body: [
					"One-time support purchases are acknowledgments of support for the project and do not create a consulting agreement, support SLA, or custom feature contract.",
					"Recurring sponsorship is handled through GitHub Sponsors and follows GitHub's sponsorship terms and billing policies.",
				],
			},
			{
				title: "Availability",
				body: [
					"The website and payment links may change over time, and support options may be removed, delayed, or paused if a provider is unavailable.",
					"If a provider is unavailable, GitHub Sponsors remains the primary support path whenever it is active.",
				],
			},
		],
	},
};

export function buildFundingPageHref(page: FundingPage): string {
	return `/?page=${page}`;
}

export function getFundingPageFromSearch(search: string): FundingPage | null {
	const page = new URLSearchParams(search).get("page");
	if (page === "privacy" || page === "refund" || page === "support" || page === "terms") {
		return page;
	}

	return null;
}

export function getFundingPageContent(page: FundingPage) {
	return FUNDING_PAGES[page];
}

export function getSupportReturnState(search: string): {
	productId: string | null;
	provider: SupportProvider;
	status: SupportStatus;
} | null {
	const params = new URLSearchParams(search);
	const status = params.get(SUPPORT_RETURN_QUERY_PARAM);
	const provider = params.get(SUPPORT_PROVIDER_QUERY_PARAM);
	const productId = params.get(SUPPORT_PRODUCT_QUERY_PARAM);

	if (provider === "creem" && (status === "success" || status === "cancelled")) {
		return {
			status,
			provider,
			productId,
		};
	}

	return null;
}

export function getCreemProductById(productId: string | null) {
	if (!productId) return null;
	return CREEM_PRODUCTS.find((product) => product.id === productId) ?? null;
}
