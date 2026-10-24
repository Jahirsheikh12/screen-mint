import { MotionConfig } from "motion/react";
import { renderToString } from "react-dom/server";
import App from "./App";
import { ALL_FAQS } from "./lib/faq";
import { LICENSE_URL, REPO_URL } from "./lib/links";

const SITE_URL = "https://screen-mint.vercel.app/";
const DESCRIPTION =
	"Record your screen and get a polished video automatically: zooms that follow your clicks, a smooth cursor and clean backgrounds. Free, MIT-licensed, no account or watermark.";

/** The landing page as static HTML, for crawlers that never run JavaScript. */
export function render() {
	return renderToString(
		<MotionConfig reducedMotion="user">
			<App />
		</MotionConfig>,
	);
}

/** schema.org data built from the same content the page renders, so the two cannot drift. */
export function structuredData() {
	return {
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "WebSite", name: "ScreenMint", url: SITE_URL },
			{
				"@type": "SoftwareApplication",
				name: "ScreenMint",
				description: DESCRIPTION,
				url: SITE_URL,
				image: `${SITE_URL}images/og.jpg`,
				applicationCategory: "MultimediaApplication",
				operatingSystem: "macOS 14+, Windows 10+, Linux",
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				license: LICENSE_URL,
				downloadUrl: `${REPO_URL}/releases/latest`,
				sameAs: [REPO_URL],
			},
			{
				"@type": "FAQPage",
				mainEntity: ALL_FAQS.map((faq) => ({
					"@type": "Question",
					name: faq.question,
					acceptedAnswer: { "@type": "Answer", text: faq.answer },
				})),
			},
		],
	};
}
