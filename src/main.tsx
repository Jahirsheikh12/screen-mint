import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/I18nContext.tsx";
import "./index.css";
import { applyTheme, readThemePreference } from "./lib/theme.ts";

document.documentElement.dataset.platform = /mac/i.test(navigator.platform) ? "macos" : "other";

// Set transparent background immediately for overlay windows — before React renders,
// preventing the white flash that occurs when the default white body is briefly visible.
{
	const overlayTypes = [
		"hud-overlay",
		"source-selector",
		"countdown",
		"area-overlay",
		"speaker-notes",
		"update-toast",
	];
	const wt = new URLSearchParams(window.location.search).get("windowType") || "";
	if (overlayTypes.includes(wt)) {
		document.documentElement.style.background = "transparent";
		document.body.style.background = "transparent";
		const root = document.getElementById("root");
		if (root) root.style.background = "transparent";
	} else if (wt === "editor") {
		applyTheme(readThemePreference());
	}
	if (wt === "hud-overlay") {
		document.documentElement.style.overflow = "hidden";
		document.body.style.overflow = "hidden";
	}
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<I18nProvider>
			<App />
		</I18nProvider>
	</React.StrictMode>,
);
