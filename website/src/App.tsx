import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { DemoSection } from "./components/DemoSection";
import { Download } from "./components/Download";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";

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
				<DemoSection />
				<Download />
				<FAQ />
			</main>
			<Footer />
		</>
	);
}
