import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import type {
	AppBusyState,
	UpdaterBusyStateUpdate,
	UpdaterCheckSource,
	UpdaterInstallMode,
	UpdaterState,
} from "../src/lib/updater/types";
import { DEFAULT_APP_BUSY_STATE } from "../src/lib/updater/types";

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_UPDATE_CHECK_DELAY_MS = 15 * 1000;
const GITHUB_OWNER = "Jahirsheikh12";
const GITHUB_REPO = "screen-mint";

type UpdaterPreferences = {
	automaticDownloads: boolean;
	lastCheckAt: string | null;
	lastLaunchedVersion: string | null;
	lastShownWhatsNewVersion: string | null;
	pendingWhatsNewVersion: string | null;
	pendingWhatsNewReleaseName: string | null;
	pendingWhatsNewReleaseNotes: string | null;
};

type AppAdapter = {
	getVersion: () => string;
	getPath: (name: "userData") => string;
	isPackaged: boolean;
	openPath: (targetPath: string) => Promise<string>;
	quit: () => void;
};

type UpdaterBackend = {
	autoDownload: boolean;
	autoInstallOnAppQuit: boolean;
	allowPrerelease?: boolean;
	fullChangelog?: boolean;
	checkForUpdates: () => Promise<unknown>;
	downloadUpdate: () => Promise<unknown>;
	on: (event: string, handler: (...args: unknown[]) => void) => void;
};

type UpdaterOptions = {
	appAdapter?: AppAdapter;
	updaterBackend?: UpdaterBackend;
	windowProvider?: () => BrowserWindow[];
	now?: () => number;
	checkIntervalMs?: number;
	initialCheckDelayMs?: number;
};

function normalizeReleaseNotes(notes: unknown): string | null {
	if (typeof notes === "string") {
		const normalized = notes.trim();
		return normalized.length > 0 ? normalized : null;
	}

	if (!Array.isArray(notes)) {
		return null;
	}

	const normalized = notes
		.map((entry) => {
			if (!entry || typeof entry !== "object") {
				return "";
			}

			const note = (entry as { note?: unknown }).note;
			return typeof note === "string" ? note.trim() : "";
		})
		.filter(Boolean)
		.join("\n\n")
		.trim();

	return normalized.length > 0 ? normalized : null;
}

function createReleaseUrl(version: string | null): string {
	return version
		? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${version}`
		: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
}

function parseVersion(version: string): { segments: number[]; prerelease: string | null } {
	const normalized = version.trim().replace(/^v/i, "");
	const [coreVersion, prerelease] = normalized.split("-", 2);
	const segments = coreVersion.split(".").map((segment) => {
		const parsed = Number.parseInt(segment, 10);
		return Number.isFinite(parsed) ? parsed : 0;
	});

	return {
		segments,
		prerelease: prerelease?.trim() || null,
	};
}

function compareVersions(left: string, right: string): number {
	const parsedLeft = parseVersion(left);
	const parsedRight = parseVersion(right);
	const length = Math.max(parsedLeft.segments.length, parsedRight.segments.length);

	for (let index = 0; index < length; index += 1) {
		const leftSegment = parsedLeft.segments[index] ?? 0;
		const rightSegment = parsedRight.segments[index] ?? 0;
		if (leftSegment !== rightSegment) {
			return leftSegment > rightSegment ? 1 : -1;
		}
	}

	if (parsedLeft.prerelease === parsedRight.prerelease) {
		return 0;
	}

	if (!parsedLeft.prerelease) {
		return 1;
	}

	if (!parsedRight.prerelease) {
		return -1;
	}

	return parsedLeft.prerelease.localeCompare(parsedRight.prerelease);
}

function cloneBusyState(busy: AppBusyState): AppBusyState {
	return { ...busy };
}

function createDefaultPreferences(): UpdaterPreferences {
	return {
		automaticDownloads: false,
		lastCheckAt: null,
		lastLaunchedVersion: null,
		lastShownWhatsNewVersion: null,
		pendingWhatsNewVersion: null,
		pendingWhatsNewReleaseName: null,
		pendingWhatsNewReleaseNotes: null,
	};
}

export function isUpdaterBusy(busy: AppBusyState): boolean {
	return busy.recording || busy.exporting || busy.transcribing;
}

export function isAutoDownloadSupported(
	platform: NodeJS.Platform,
	env: NodeJS.ProcessEnv,
): boolean {
	if (platform === "darwin") {
		return true;
	}

	if (platform === "win32") {
		return true;
	}

	if (platform === "linux") {
		return typeof env.APPIMAGE === "string" && env.APPIMAGE.length > 0;
	}

	return false;
}

function supportsInAppInstall(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): boolean {
	return (
		platform === "win32" ||
		(platform === "linux" && typeof env.APPIMAGE === "string" && env.APPIMAGE.length > 0)
	);
}

function createMacInstallerDownloadUrl(version: string): string {
	const arch = process.arch === "arm64" ? "arm64" : "x64";
	return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/ScreenMint-${arch}.dmg`;
}

export function isUpdateCheckSupported(
	platform: NodeJS.Platform,
	options: { isPackaged: boolean; env: NodeJS.ProcessEnv },
): boolean {
	if (!options.isPackaged) {
		return false;
	}

	if (options.env["VITE_DEV_SERVER_URL"]) {
		return false;
	}

	if (options.env["SCREENMINT_DISABLE_UPDATER"] === "1") {
		return false;
	}

	if (options.env["APPIMAGE"] === "" && platform === "linux") {
		return true;
	}

	return true;
}

export class ScreenMintUpdater {
	private readonly appAdapter: AppAdapter;
	private readonly updaterBackend: UpdaterBackend;
	private readonly windowProvider: () => BrowserWindow[];
	private readonly now: () => number;
	private readonly checkIntervalMs: number;
	private readonly initialCheckDelayMs: number;
	private readonly settingsPath: string;
	private readonly updatesDirectory: string;

	private readonly busyState: AppBusyState = cloneBusyState(DEFAULT_APP_BUSY_STATE);
	private readonly state: UpdaterState;

	private preferences = createDefaultPreferences();
	private initialized = false;
	private startupCheckTimer: ReturnType<typeof setTimeout> | null = null;
	private periodicCheckTimer: ReturnType<typeof setInterval> | null = null;
	private pendingRestartToast = false;
	private sessionDeferredVersion: string | null = null;

	constructor(options: UpdaterOptions = {}) {
		this.appAdapter = options.appAdapter ?? {
			getVersion: () => app.getVersion(),
			getPath: (name: "userData") => app.getPath(name),
			isPackaged: app.isPackaged,
			openPath: (targetPath: string) => shell.openPath(targetPath),
			quit: () => app.quit(),
		};
		this.updaterBackend = options.updaterBackend ?? (autoUpdater as unknown as UpdaterBackend);
		this.windowProvider = options.windowProvider ?? (() => BrowserWindow.getAllWindows());
		this.now = options.now ?? (() => Date.now());
		this.checkIntervalMs = options.checkIntervalMs ?? UPDATE_CHECK_INTERVAL_MS;
		this.initialCheckDelayMs = options.initialCheckDelayMs ?? INITIAL_UPDATE_CHECK_DELAY_MS;
		this.settingsPath = path.join(this.appAdapter.getPath("userData"), "updater-settings.json");
		this.updatesDirectory = path.join(this.appAdapter.getPath("userData"), "updates");
		this.state = this.buildInitialState();
	}

	private buildInitialState(): UpdaterState {
		const currentVersion = this.appAdapter.getVersion();
		const canCheck = this.computeCanCheck();
		const canDownload = canCheck && this.computeCanDownload();

		return {
			status: "idle",
			currentVersion,
			latestVersion: null,
			releaseName: null,
			releaseNotes: null,
			progress: null,
			message: null,
			error: null,
			checkedAt: null,
			downloadedAt: null,
			manualDownloadUrl: canCheck ? createReleaseUrl(null) : null,
			downloadedFilePath: null,
			canCheck,
			canDownload,
			canInstall: false,
			installMode: "none",
			autoDownloadEnabled: false,
			checkSource: null,
			showUpdatePrompt: false,
			sessionDeferredVersion: null,
			showWhatsNew: false,
			whatsNewVersion: null,
			whatsNewReleaseName: null,
			whatsNewReleaseNotes: null,
			busy: cloneBusyState(this.busyState),
		};
	}

	private computeCanCheck(): boolean {
		const isFirstRun =
			process.platform === "win32" &&
			process.argv.some((arg) => arg === "--squirrel-firstrun" || arg === "/firstrun");

		return (
			!isFirstRun &&
			isUpdateCheckSupported(process.platform, {
				isPackaged: this.appAdapter.isPackaged,
				env: process.env,
			})
		);
	}

	private computeCanDownload(): boolean {
		return isAutoDownloadSupported(process.platform, process.env);
	}

	private computeInstallMode(): UpdaterInstallMode {
		if (supportsInAppInstall(process.platform, process.env)) {
			return "in-app";
		}

		if (process.platform === "darwin") {
			return "external-installer";
		}

		return "none";
	}

	private shouldUseManualDownloadFlow(): boolean {
		return !this.computeCanDownload() && process.platform !== "darwin";
	}

	private shouldShowUpdatePrompt(version: string | null, source: UpdaterCheckSource): boolean {
		if (!version) {
			return false;
		}

		if (source === "manual") {
			return true;
		}

		return this.sessionDeferredVersion !== version;
	}

	private buildWhatsNewState(): Partial<UpdaterState> {
		const currentVersion = this.appAdapter.getVersion();
		const pendingVersion = this.preferences.pendingWhatsNewVersion;
		const lastShownVersion = this.preferences.lastShownWhatsNewVersion;
		const lastLaunchedVersion = this.preferences.lastLaunchedVersion;

		if (
			pendingVersion &&
			compareVersions(currentVersion, pendingVersion) >= 0 &&
			lastShownVersion !== pendingVersion
		) {
			return {
				showWhatsNew: true,
				whatsNewVersion: pendingVersion,
				whatsNewReleaseName: this.preferences.pendingWhatsNewReleaseName,
				whatsNewReleaseNotes: this.preferences.pendingWhatsNewReleaseNotes,
			};
		}

		if (
			lastLaunchedVersion &&
			compareVersions(currentVersion, lastLaunchedVersion) > 0 &&
			lastShownVersion !== currentVersion
		) {
			return {
				showWhatsNew: true,
				whatsNewVersion: currentVersion,
				whatsNewReleaseName: `ScreenMint ${currentVersion}`,
				whatsNewReleaseNotes: null,
			};
		}

		return {
			showWhatsNew: false,
			whatsNewVersion: null,
			whatsNewReleaseName: null,
			whatsNewReleaseNotes: null,
		};
	}

	private setState(patch: Partial<UpdaterState>): UpdaterState {
		const nextInstallMode =
			patch.installMode ??
			(this.state.installMode === "none" ? this.computeInstallMode() : this.state.installMode);

		Object.assign(this.state, patch, {
			busy: cloneBusyState(this.busyState),
			canCheck: this.computeCanCheck(),
			canDownload: this.computeCanCheck() && this.computeCanDownload(),
			autoDownloadEnabled: this.preferences.automaticDownloads,
			installMode: nextInstallMode,
			sessionDeferredVersion: this.sessionDeferredVersion,
		});
		this.broadcastState();
		return this.getState();
	}

	private broadcastState(): void {
		const payload = this.getState();
		for (const window of this.windowProvider()) {
			if (!window.isDestroyed()) {
				window.webContents.send("updater-state-changed", payload);
			}
		}
	}

	private attachUpdaterListeners(): void {
		this.updaterBackend.on("checking-for-update", () => {
			this.setState({
				status: "checking",
				progress: null,
				error: null,
				message: null,
				canInstall: false,
				downloadedAt: null,
				downloadedFilePath: null,
				showUpdatePrompt: false,
				installMode: this.computeInstallMode(),
			});
		});

		this.updaterBackend.on("update-available", (info) => {
			const updateInfo = info as UpdateInfo;
			const latestVersion = typeof updateInfo.version === "string" ? updateInfo.version : null;
			const releaseName =
				typeof updateInfo.releaseName === "string" ? updateInfo.releaseName : null;
			const releaseNotes = normalizeReleaseNotes(updateInfo.releaseNotes);

			if (this.shouldUseManualDownloadFlow()) {
				this.setState({
					status: "manual-download-required",
					latestVersion,
					releaseName,
					releaseNotes,
					progress: null,
					error: null,
					message: "A new version is available to download.",
					canInstall: false,
					manualDownloadUrl: createReleaseUrl(latestVersion),
					showUpdatePrompt: this.shouldShowUpdatePrompt(latestVersion, this.state.checkSource),
					installMode: "none",
				});
				return;
			}

			this.setState({
				status: "available",
				latestVersion,
				releaseName,
				releaseNotes,
				progress: null,
				error: null,
				message: "A new version is ready to download.",
				canInstall: false,
				manualDownloadUrl: createReleaseUrl(latestVersion),
				showUpdatePrompt: this.shouldShowUpdatePrompt(latestVersion, this.state.checkSource),
				installMode: this.computeInstallMode(),
			});
		});

		this.updaterBackend.on("update-not-available", () => {
			this.pendingRestartToast = false;
			this.setState({
				status: "no-update",
				latestVersion: this.state.currentVersion,
				progress: null,
				error: null,
				message: "ScreenMint is up to date.",
				canInstall: false,
				downloadedAt: null,
				manualDownloadUrl: createReleaseUrl(null),
				downloadedFilePath: null,
				showUpdatePrompt: false,
				installMode: "none",
			});
		});

		this.updaterBackend.on("download-progress", (progress) => {
			const progressInfo = progress as ProgressInfo;
			this.setState({
				status: "downloading",
				progress: Math.max(0, Math.min(100, progressInfo.percent ?? 0)),
				error: null,
				message: "Downloading update in the background.",
				canInstall: false,
				showUpdatePrompt: true,
			});
		});

		this.updaterBackend.on("update-downloaded", (info) => {
			const updateInfo = info as UpdateInfo;
			this.pendingRestartToast = isUpdaterBusy(this.busyState);
			const installMode = this.computeInstallMode();
			this.setState({
				status: "downloaded",
				latestVersion:
					typeof updateInfo.version === "string" ? updateInfo.version : this.state.latestVersion,
				progress: 100,
				error: null,
				message:
					installMode === "external-installer"
						? this.pendingRestartToast
							? "Update downloaded. Open Installer will be available when ScreenMint is idle."
							: "Update downloaded. Open Installer to finish updating."
						: this.pendingRestartToast
							? "Update downloaded. Restart will be available when ScreenMint is idle."
							: "Update downloaded and ready to install.",
				canInstall: !isUpdaterBusy(this.busyState),
				downloadedAt: new Date(this.now()).toISOString(),
				showUpdatePrompt: true,
				installMode,
			});
		});

		this.updaterBackend.on("error", (error) => {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.setState({
				status: "error",
				progress: null,
				error: errorMessage,
				message: "Unable to complete the update request.",
				canInstall: false,
				showUpdatePrompt: false,
			});
		});
	}

	private async loadPreferences(): Promise<void> {
		try {
			const raw = await fs.readFile(this.settingsPath, "utf-8");
			const parsed = JSON.parse(raw) as Partial<UpdaterPreferences>;
			this.preferences = {
				automaticDownloads:
					typeof parsed.automaticDownloads === "boolean" ? parsed.automaticDownloads : false,
				lastCheckAt: typeof parsed.lastCheckAt === "string" ? parsed.lastCheckAt : null,
				lastLaunchedVersion:
					typeof parsed.lastLaunchedVersion === "string" ? parsed.lastLaunchedVersion : null,
				lastShownWhatsNewVersion:
					typeof parsed.lastShownWhatsNewVersion === "string"
						? parsed.lastShownWhatsNewVersion
						: null,
				pendingWhatsNewVersion:
					typeof parsed.pendingWhatsNewVersion === "string" ? parsed.pendingWhatsNewVersion : null,
				pendingWhatsNewReleaseName:
					typeof parsed.pendingWhatsNewReleaseName === "string"
						? parsed.pendingWhatsNewReleaseName
						: null,
				pendingWhatsNewReleaseNotes:
					typeof parsed.pendingWhatsNewReleaseNotes === "string"
						? parsed.pendingWhatsNewReleaseNotes
						: null,
			};
		} catch {
			this.preferences = createDefaultPreferences();
		}
	}

	private async savePreferences(): Promise<void> {
		try {
			await fs.writeFile(this.settingsPath, JSON.stringify(this.preferences, null, 2), "utf-8");
		} catch (error) {
			console.error("Failed to persist updater settings:", error);
		}
	}

	private scheduleAutomaticChecks(): void {
		if (!this.state.canCheck) {
			return;
		}

		this.clearCheckTimers();
		this.startupCheckTimer = setTimeout(() => {
			void this.checkForUpdates("automatic");
			this.periodicCheckTimer = setInterval(() => {
				void this.checkForUpdates("automatic");
			}, this.checkIntervalMs);
			this.periodicCheckTimer.unref?.();
		}, this.initialCheckDelayMs);
		this.startupCheckTimer.unref?.();
	}

	private clearCheckTimers(): void {
		if (this.startupCheckTimer) {
			clearTimeout(this.startupCheckTimer);
			this.startupCheckTimer = null;
		}

		if (this.periodicCheckTimer) {
			clearInterval(this.periodicCheckTimer);
			this.periodicCheckTimer = null;
		}
	}

	async init(): Promise<void> {
		if (this.initialized) {
			return;
		}

		this.initialized = true;
		await this.loadPreferences();
		const whatsNewState = this.buildWhatsNewState();
		this.preferences.lastLaunchedVersion = this.appAdapter.getVersion();
		await this.savePreferences();
		this.updaterBackend.autoDownload = false;
		this.updaterBackend.autoInstallOnAppQuit = supportsInAppInstall(process.platform, process.env);
		if ("allowPrerelease" in this.updaterBackend) {
			this.updaterBackend.allowPrerelease = false;
		}
		if ("fullChangelog" in this.updaterBackend) {
			this.updaterBackend.fullChangelog = false;
		}
		this.attachUpdaterListeners();
		this.setState({
			status: "idle",
			manualDownloadUrl: this.state.canCheck ? createReleaseUrl(null) : null,
			message: this.state.canCheck ? null : "Updates are available in packaged builds only.",
			installMode: this.computeInstallMode(),
			...whatsNewState,
		});
		this.scheduleAutomaticChecks();
	}

	getState(): UpdaterState {
		return {
			...this.state,
			busy: cloneBusyState(this.busyState),
		};
	}

	getAppVersion(): string {
		return this.state.currentVersion;
	}

	async checkForUpdates(source: UpdaterCheckSource = "manual"): Promise<UpdaterState> {
		if (!this.state.canCheck) {
			return this.setState({
				status: "error",
				error: "Updates are available in packaged builds only.",
				message: "Updates are available in packaged builds only.",
				checkSource: source,
			});
		}

		if (source === "automatic" && isUpdaterBusy(this.busyState)) {
			return this.getState();
		}

		if (source === "manual" && this.state.latestVersion) {
			if (
				this.state.status === "available" ||
				this.state.status === "downloading" ||
				this.state.status === "downloaded" ||
				this.state.status === "manual-download-required"
			) {
				this.sessionDeferredVersion = null;
				return this.setState({
					checkSource: source,
					showUpdatePrompt: true,
				});
			}
		}

		if (this.state.status === "checking") {
			return this.getState();
		}

		this.preferences.lastCheckAt = new Date(this.now()).toISOString();
		void this.savePreferences();
		this.setState({
			checkSource: source,
			checkedAt: this.preferences.lastCheckAt,
			error: null,
		});

		try {
			await this.updaterBackend.checkForUpdates();
			return this.getState();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return this.setState({
				status: "error",
				error: errorMessage,
				message: "Unable to check for updates right now.",
			});
		}
	}

	async downloadUpdate(source: "automatic" | "manual" = "manual"): Promise<UpdaterState> {
		if (process.platform === "darwin") {
			return await this.downloadExternalMacInstaller(source);
		}

		if (!this.state.canDownload) {
			return this.setState({
				status: "manual-download-required",
				message: "Download the latest release manually for this platform.",
				manualDownloadUrl: createReleaseUrl(this.state.latestVersion),
			});
		}

		if (isUpdaterBusy(this.busyState)) {
			return this.setState({
				status: "available",
				message: "Wait until recording, export, or transcription is finished to download.",
				showUpdatePrompt: true,
			});
		}

		if (this.state.status === "downloading" || this.state.status === "downloaded") {
			return this.getState();
		}

		try {
			this.sessionDeferredVersion = null;
			this.setState({
				showUpdatePrompt: true,
			});
			await this.updaterBackend.downloadUpdate();
			return this.getState();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return this.setState({
				status: "error",
				error: errorMessage,
				message: "Unable to download the update right now.",
			});
		}
	}

	private async downloadExternalMacInstaller(
		_source: "automatic" | "manual",
	): Promise<UpdaterState> {
		if (!this.state.latestVersion) {
			return this.setState({
				status: "manual-download-required",
				message: "Download the latest release manually for this version.",
				manualDownloadUrl: createReleaseUrl(null),
				installMode: "none",
			});
		}

		if (isUpdaterBusy(this.busyState)) {
			return this.setState({
				status: "available",
				message: "Wait until recording, export, or transcription is finished to download.",
				showUpdatePrompt: true,
			});
		}

		const version = this.state.latestVersion;
		const installerUrl = createMacInstallerDownloadUrl(version);
		const arch = process.arch === "arm64" ? "arm64" : "x64";
		const installerPath = path.join(this.updatesDirectory, `ScreenMint-${version}-${arch}.dmg`);
		const partialInstallerPath = `${installerPath}.download`;

		try {
			await fs.mkdir(this.updatesDirectory, { recursive: true });
			await fs.access(installerPath);

			return this.setState({
				status: "downloaded",
				progress: 100,
				message: "Update downloaded. Open Installer to finish updating.",
				canInstall: !isUpdaterBusy(this.busyState),
				downloadedAt: new Date(this.now()).toISOString(),
				downloadedFilePath: installerPath,
				manualDownloadUrl: installerUrl,
				installMode: "external-installer",
			});
		} catch {
			// Continue to download when the cached installer is unavailable.
		}

		try {
			this.sessionDeferredVersion = null;
			this.setState({
				status: "downloading",
				progress: 0,
				message: "Downloading update in the background.",
				error: null,
				canInstall: false,
				downloadedFilePath: null,
				manualDownloadUrl: installerUrl,
				showUpdatePrompt: true,
				installMode: "external-installer",
			});

			const response = await fetch(installerUrl);
			if (!response.ok) {
				throw new Error(`Failed to download macOS installer (${response.status})`);
			}

			const installerBuffer = Buffer.from(await response.arrayBuffer());
			await fs.writeFile(partialInstallerPath, installerBuffer);
			await fs.rename(partialInstallerPath, installerPath);

			return this.setState({
				status: "downloaded",
				progress: 100,
				message: isUpdaterBusy(this.busyState)
					? "Update downloaded. Open Installer will be available when ScreenMint is idle."
					: "Update downloaded. Open Installer to finish updating.",
				canInstall: !isUpdaterBusy(this.busyState),
				downloadedAt: new Date(this.now()).toISOString(),
				downloadedFilePath: installerPath,
				manualDownloadUrl: installerUrl,
				showUpdatePrompt: true,
				installMode: "external-installer",
			});
		} catch (error) {
			await fs.rm(partialInstallerPath, { force: true }).catch(() => undefined);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return this.setState({
				status: "manual-download-required",
				error: errorMessage,
				message: "Automatic download failed. Download the latest version manually.",
				manualDownloadUrl: installerUrl,
				canInstall: false,
				downloadedFilePath: null,
				showUpdatePrompt: true,
				installMode: "none",
			});
		}
	}

	async dismissUpdate(): Promise<UpdaterState> {
		return await this.updateLaterForSession();
	}

	async updateLaterForSession(): Promise<UpdaterState> {
		this.sessionDeferredVersion = this.state.latestVersion;
		return this.setState({
			showUpdatePrompt: false,
		});
	}

	async dismissWhatsNew(): Promise<UpdaterState> {
		const shownVersion = this.state.whatsNewVersion;
		if (shownVersion) {
			this.preferences.lastShownWhatsNewVersion = shownVersion;
			if (this.preferences.pendingWhatsNewVersion === shownVersion) {
				this.preferences.pendingWhatsNewVersion = null;
				this.preferences.pendingWhatsNewReleaseName = null;
				this.preferences.pendingWhatsNewReleaseNotes = null;
			}
			await this.savePreferences();
		}

		return this.setState({
			showWhatsNew: false,
			whatsNewVersion: null,
			whatsNewReleaseName: null,
			whatsNewReleaseNotes: null,
		});
	}

	async setBusyState(update: UpdaterBusyStateUpdate): Promise<UpdaterState> {
		this.busyState.recording =
			typeof update.recording === "boolean" ? update.recording : this.busyState.recording;
		this.busyState.exporting =
			typeof update.exporting === "boolean" ? update.exporting : this.busyState.exporting;
		this.busyState.transcribing =
			typeof update.transcribing === "boolean" ? update.transcribing : this.busyState.transcribing;

		if (
			!isUpdaterBusy(this.busyState) &&
			this.pendingRestartToast &&
			this.state.status === "downloaded"
		) {
			this.pendingRestartToast = false;
			return this.setState({
				canInstall: true,
				message:
					this.state.installMode === "external-installer"
						? "Update downloaded. Open Installer to finish updating."
						: "Update downloaded and ready to install.",
			});
		}

		return this.setState({
			canInstall: this.state.status === "downloaded" && !isUpdaterBusy(this.busyState),
		});
	}

	private async queueWhatsNewForNextLaunch(): Promise<void> {
		if (!this.state.latestVersion) {
			return;
		}

		this.preferences.pendingWhatsNewVersion = this.state.latestVersion;
		this.preferences.pendingWhatsNewReleaseName = this.state.releaseName;
		this.preferences.pendingWhatsNewReleaseNotes = this.state.releaseNotes;
		await this.savePreferences();
	}

	async installUpdateAndRestart(): Promise<{ success: boolean; reason?: string }> {
		if (this.state.status !== "downloaded") {
			return { success: false, reason: "not-downloaded" };
		}

		if (isUpdaterBusy(this.busyState)) {
			return { success: false, reason: "busy" };
		}

		if (this.state.installMode === "external-installer") {
			if (!this.state.downloadedFilePath) {
				return { success: false, reason: "missing-installer" };
			}

			const openResult = await this.appAdapter.openPath(this.state.downloadedFilePath);
			if (openResult) {
				return { success: false, reason: "open-failed" };
			}

			await this.queueWhatsNewForNextLaunch();
			setTimeout(() => {
				this.appAdapter.quit();
			}, 1200).unref?.();
			return { success: true };
		}

		await this.queueWhatsNewForNextLaunch();
		this.appAdapter.quit();
		return { success: true };
	}
}

let updaterSingleton: ScreenMintUpdater | null = null;

export function getScreenMintUpdater(): ScreenMintUpdater {
	if (!updaterSingleton) {
		updaterSingleton = new ScreenMintUpdater();
	}

	return updaterSingleton;
}
