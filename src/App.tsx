import { lazy, Suspense, useEffect, useState } from "react";
import { AnnouncementToasts } from "@/components/announcements/AnnouncementToasts";
import { Toaster } from "@/components/ui/sonner";
import { UpdaterDialogs } from "@/components/updater/UpdaterDialogs";
import { CountdownOverlay } from "./components/countdown/CountdownOverlay";
import { ExportWorker } from "./components/export-worker/ExportWorker";
import { AreaSelectionOverlay } from "./components/launch/AreaSelectionOverlay";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import { SpeakerNotesWindow } from "./components/launch/SpeakerNotesWindow";
import { useI18n } from "./contexts/I18nContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

const VideoEditor = lazy(() => import("./components/video-editor/VideoEditor"));
const ShortcutsConfigDialog = lazy(() =>
	import("./components/video-editor/ShortcutsConfigDialog").then((module) => ({
		default: module.ShortcutsConfigDialog,
	})),
);

function AppLoadingScreen({ label }: { label: string }) {
	return (
		<div className="flex h-full w-full items-center justify-center bg-[#0a0a0b] text-white">
			<div
				className="flex flex-col items-center gap-5"
				style={{ animation: "app-loading-enter 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
			>
				<div className="relative" style={{ animation: "app-icon-float 3s ease-in-out infinite" }}>
					<img
						src="/app-icons/screenmint-128.png"
						alt="ScreenMint"
						className="h-16 w-16 rounded-2xl"
						style={{
							filter: "drop-shadow(0 0 24px rgba(245,158,11,0.15))",
						}}
					/>
				</div>
				<div className="flex flex-col items-center gap-2">
					<h1 className="text-lg font-semibold tracking-tight text-white/90">ScreenMint</h1>
					<p className="text-[13px] text-white/35">{label}</p>
				</div>
				{/* Minimal loading bar */}
				<div className="w-24 h-[2px] rounded-full bg-white/[0.06] overflow-hidden mt-1">
					<div
						className="h-full rounded-full bg-white/20"
						style={{
							animation: "app-loading-bar 1.5s ease-in-out infinite",
						}}
					/>
				</div>
			</div>
			<style>
				{`
					@keyframes app-loading-enter {
						from { opacity: 0; transform: translateY(12px) scale(0.96); }
						to { opacity: 1; transform: translateY(0) scale(1); }
					}
					@keyframes app-icon-float {
						0%, 100% { transform: translateY(0); }
						50% { transform: translateY(-4px); }
					}
					@keyframes app-loading-bar {
						0% { width: 0%; margin-left: 0%; }
						50% { width: 60%; margin-left: 20%; }
						100% { width: 0%; margin-left: 100%; }
					}
				`}
			</style>
		</div>
	);
}

function EditorLoadingSurface() {
	return <div className="h-screen w-screen bg-[#0c0c0f]" aria-hidden="true" />;
}

// Read windowType synchronously so the very first render picks the correct component
// — avoids a frame of AppLoadingScreen / white flash for overlay windows.
const INITIAL_WINDOW_TYPE = new URLSearchParams(window.location.search).get("windowType") || "";

export default function App() {
	const [windowType] = useState(INITIAL_WINDOW_TYPE);
	const { t } = useI18n();

	useEffect(() => {
		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, []);

	useEffect(() => {
		document.title =
			windowType === "editor"
				? t("app.editorTitle", "ScreenMint Editor")
				: t("app.name", "ScreenMint");
	}, [windowType, t]);

	let content: JSX.Element;
	switch (windowType) {
		case "hud-overlay":
			content = <LaunchWindow />;
			break;
		case "source-selector":
			content = <SourceSelector />;
			break;
		case "countdown":
			content = <CountdownOverlay />;
			break;
		case "area-overlay":
			content = <AreaSelectionOverlay />;
			break;
		case "speaker-notes":
			content = <SpeakerNotesWindow />;
			break;
		case "export-worker":
			content = <ExportWorker />;
			break;
		case "editor":
			content = (
				<ShortcutsProvider>
					<Suspense fallback={<EditorLoadingSurface />}>
						<VideoEditor />
						<ShortcutsConfigDialog />
						<AnnouncementToasts />
					</Suspense>
				</ShortcutsProvider>
			);
			break;
		default:
			content = <AppLoadingScreen label={t("app.subtitle", "Screen recording and editing")} />;
			break;
	}

	return (
		<>
			{content}
			<UpdaterDialogs windowType={windowType} />
			<Toaster theme="dark" className="pointer-events-auto" />
		</>
	);
}
