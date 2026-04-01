export type UpdaterStatus =
	| "idle"
	| "checking"
	| "available"
	| "downloading"
	| "downloaded"
	| "no-update"
	| "error"
	| "manual-download-required";

export type UpdaterCheckSource = "automatic" | "manual" | null;
export type UpdaterInstallMode = "none" | "in-app" | "external-installer";

export interface AppBusyState {
	recording: boolean;
	exporting: boolean;
	transcribing: boolean;
}

export interface UpdaterState {
	status: UpdaterStatus;
	currentVersion: string;
	latestVersion: string | null;
	releaseName: string | null;
	releaseNotes: string | null;
	progress: number | null;
	message: string | null;
	error: string | null;
	checkedAt: string | null;
	downloadedAt: string | null;
	manualDownloadUrl: string | null;
	downloadedFilePath: string | null;
	canCheck: boolean;
	canDownload: boolean;
	canInstall: boolean;
	installMode: UpdaterInstallMode;
	autoDownloadEnabled: boolean;
	checkSource: UpdaterCheckSource;
	showUpdatePrompt: boolean;
	sessionDeferredVersion: string | null;
	showWhatsNew: boolean;
	whatsNewVersion: string | null;
	whatsNewReleaseName: string | null;
	whatsNewReleaseNotes: string | null;
	busy: AppBusyState;
}

export interface UpdaterBusyStateUpdate extends Partial<AppBusyState> {}

export const DEFAULT_APP_BUSY_STATE: AppBusyState = {
	recording: false,
	exporting: false,
	transcribing: false,
};
