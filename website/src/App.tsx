import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { Download } from "./components/Download";
import { FAQ } from "./components/FAQ";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { LegalPage } from "./components/LegalPage";
import { Navbar } from "./components/Navbar";
import { ShowreelSection } from "./components/ShowreelSection";
import { SponsorSection } from "./components/SponsorSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { getFundingPageFromSearch } from "./lib/sponsors";
import { CursorTrail } from "./components/CursorTrail";

export default function App() {
	const page =
		typeof window === "undefined" ? null : getFundingPageFromSearch(window.location.search);

	useEffect(() => {
		return () => {
			ScrollTrigger.getAll().forEach((t) => t.kill());
		};
	}, []);

	if (page) {
		return <LegalPage page={page} />;
	}

	return (
		<>
			<Navbar />
			<main>
				<Hero />
				<Features />
				<ShowreelSection />
				<WorkflowSection />
				<SponsorSection />
				<Download />
				<FAQ />
			</main>
			<Footer />
			<CursorTrail />
		</>
	);
}
