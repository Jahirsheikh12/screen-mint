import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { Download } from "./components/Download";
import { FAQ } from "./components/FAQ";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Navbar } from "./components/Navbar";
import { ShowreelSection } from "./components/ShowreelSection";
import { WorkflowSection } from "./components/WorkflowSection";

export default function App() {
	useEffect(() => {
		return () => {
			ScrollTrigger.getAll().forEach((t) => t.kill());
		};
	}, []);

	return (
		<>
			<Navbar />
			<main>
				<Hero />
				<Features />
				<ShowreelSection />
				<WorkflowSection />
				<Download />
				<FAQ />
			</main>
			<Footer />
		</>
	);
}
