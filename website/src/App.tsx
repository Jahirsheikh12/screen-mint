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
			<Navbar />
			<main className="site font-body">
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
