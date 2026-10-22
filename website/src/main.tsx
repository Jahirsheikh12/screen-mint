import { MotionConfig } from "motion/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/motion";
import { getFundingPageFromSearch } from "./lib/sponsors";

const container = document.getElementById("root")!;
const app = (
	<React.StrictMode>
		<MotionConfig reducedMotion="user">
			<App />
		</MotionConfig>
	</React.StrictMode>
);

// The landing page is pre-rendered at build time, so hydrate it. Legal pages (?page=…) and the dev
// server have no matching markup, so they render from scratch.
if (container.hasChildNodes() && !getFundingPageFromSearch(window.location.search)) {
	ReactDOM.hydrateRoot(container, app);
} else {
	container.textContent = "";
	ReactDOM.createRoot(container).render(app);
}
