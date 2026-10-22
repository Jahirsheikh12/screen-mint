import { Chapters, HowItWorks, Specs } from "./components/Chapters";
import { ClosingCta, Download } from "./components/Download";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { LegalPage } from "./components/LegalPage";
import { Navbar } from "./components/Navbar";
import { SponsorSection } from "./components/SponsorSection";
import { getFundingPageFromSearch } from "./lib/sponsors";

export default function App() {
	const page =
		typeof window === "undefined" ? null : getFundingPageFromSearch(window.location.search);

	if (page) {
		return <LegalPage page={page} />;
	}

	return (
		<>
			<a
				href="#main"
				data-skip-link
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-reel focus:px-4 focus:py-2 focus:font-body focus:text-[14px] focus:font-semibold focus:text-ink"
			>
				Skip to content
			</a>
			<Navbar />
			<main id="main" tabIndex={-1} className="site font-body outline-none">
				<Hero />
				<Chapters />
				<HowItWorks />
				<Specs />
				<Download />
				<SponsorSection />
				<FAQ />
				<ClosingCta />
			</main>
			<Footer />
		</>
	);
}
