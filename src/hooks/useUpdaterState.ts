import { useEffect, useState } from "react";
import type { UpdaterState } from "@/lib/updater/types";
import { DEFAULT_APP_BUSY_STATE } from "@/lib/updater/types";

const DEFAULT_UPDATER_STATE: UpdaterState = {
	status: "idle",
	currentVersion: "0.0.0",
	latestVersion: null,
	releaseName: null,
	releaseNotes: null,
	progress: null,
	message: null,
	error: null,
	checkedAt: null,
	downloadedAt: null,
	manualDownloadUrl: null,
	downloadedFilePath: null,
	canCheck: false,
	canDownload: false,
	canInstall: false,
	installMode: "none",
	autoDownloadEnabled: true,
	checkSource: null,
	showUpdatePrompt: false,
	sessionDeferredVersion: null,
	showWhatsNew: false,
	whatsNewVersion: null,
	whatsNewReleaseName: null,
	whatsNewReleaseNotes: null,
	busy: DEFAULT_APP_BUSY_STATE,
	experimentalUpdatesEnabled: false,
};

export function useUpdaterState() {
	const [state, setState] = useState<UpdaterState>(DEFAULT_UPDATER_STATE);

	useEffect(() => {
		let cancelled = false;

		void window.electronAPI
			.getUpdaterState()
			.then((nextState) => {
				if (!cancelled) {
					setState(nextState);
				}
			})
			.catch(() => {
				// Keep defaults if the updater is unavailable in this build.
			});

		const unsubscribe = window.electronAPI.onUpdaterStateChanged((nextState) => {
			setState(nextState);
		});

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);

	return state;
}
