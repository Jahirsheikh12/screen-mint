import { app, BrowserWindow, desktopCapturer, ipcMain } from "electron";
import {
	type CaptureSourceRequest,
	IPC_CHANNELS,
	type IpcSelectedSource,
} from "../../src/electron-ipc/contracts";
import type { SelectedArea } from "../../src/lib/recording/session";

export type SelectedSource = IpcSelectedSource;

export type NativeMacWindowSource = {
	id: string;
	name: string;
	display_id?: string;
	appName?: string;
	windowTitle?: string;
	bundleId?: string;
	appIcon?: string | null;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};

type CaptureSourceHandlerOptions = {
	brandName: string;
	appNameAliases: string[];
	allowOwnWindowCapture: boolean;
	getScreen: () => typeof import("electron").screen;
	getSelectedSource: () => SelectedSource | null;
	setSelectedSource: (source: SelectedSource | null) => void;
	getUserExplicitlySelectedSource: () => boolean;
	setUserExplicitlySelectedSource: (selected: boolean) => void;
	getSelectedArea: () => SelectedArea | null;
	setSelectedArea: (area: SelectedArea | null) => void;
	notifySelectedAreaChanged: () => void;
	getSelectedAreaForSource: (source?: SelectedSource | null) => SelectedArea | null;
	stopWindowBoundsCapture: () => void;
	getSourceSelectorWindow: () => BrowserWindow | null;
	getNativeMacWindowSources: () => Promise<NativeMacWindowSource[]>;
};

function normalizeDesktopSourceName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasUsableSourceThumbnail(
	thumbnail:
		| {
				isEmpty: () => boolean;
				getSize: () => { width: number; height: number };
		  }
		| null
		| undefined,
) {
	if (!thumbnail || thumbnail.isEmpty()) {
		return false;
	}

	const size = thumbnail.getSize();
	return size.width > 1 && size.height > 1;
}

export function registerCaptureSourceIpcHandlers(options: CaptureSourceHandlerOptions) {
	ipcMain.handle(IPC_CHANNELS.capture.getSources, async (_, opts?: CaptureSourceRequest) => {
		const includeScreens = Array.isArray(opts?.types) ? opts.types.includes("screen") : true;
		const includeWindows = Array.isArray(opts?.types) ? opts.types.includes("window") : true;
		const electronTypes = [
			...(includeScreens ? ["screen" as const] : []),
			...(includeWindows ? ["window" as const] : []),
		];
		const electronSources =
			electronTypes.length > 0
				? await desktopCapturer.getSources({
						...opts,
						types: electronTypes,
					})
				: [];
		const ownWindowNames = new Set(
			[
				app.getName(),
				options.brandName,
				...BrowserWindow.getAllWindows().flatMap((win) => {
					const title = win.getTitle().trim();
					return title ? [title] : [];
				}),
			]
				.map((name) => normalizeDesktopSourceName(name))
				.filter(Boolean),
		);
		const ownAppName = normalizeDesktopSourceName(app.getName());

		const allDisplays = options.getScreen().getAllDisplays();
		const primaryDisplayId = options.getScreen().getPrimaryDisplay().id;
		const displayInfoMap = new Map(allDisplays.map((display) => [String(display.id), display]));

		const screenSources = electronSources
			.filter((source) => source.id.startsWith("screen:"))
			.map((source) => {
				const info = displayInfoMap.get(String(source.display_id));
				return {
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
					width: info?.size.width,
					height: info?.size.height,
					scaleFactor: info?.scaleFactor,
					isPrimary: info ? info.id === primaryDisplayId : undefined,
					isInternal: info?.internal,
				};
			});

		if (process.platform !== "darwin" || !includeWindows) {
			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (
						options.allowOwnWindowCapture &&
						options.appNameAliases.some((alias) => normalizedName.includes(alias))
					) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
				}));

			return [...screenSources, ...windowSources];
		}

		try {
			const nativeWindowSources = await options.getNativeMacWindowSources();
			const electronWindowSourceMap = new Map(
				electronSources
					.filter((source) => source.id.startsWith("window:"))
					.map((source) => [source.id, source] as const),
			);

			const mergedWindowSources = nativeWindowSources
				.filter((source) => {
					const normalizedWindowName = normalizeDesktopSourceName(
						source.windowTitle ?? source.name,
					);
					const normalizedAppName = normalizeDesktopSourceName(source.appName ?? "");

					if (
						!options.allowOwnWindowCapture &&
						normalizedAppName &&
						normalizedAppName === ownAppName
					) {
						return false;
					}

					if (
						options.allowOwnWindowCapture &&
						(options.appNameAliases.includes(normalizedAppName) ||
							options.appNameAliases.some((alias) => normalizedWindowName?.includes(alias)))
					) {
						return true;
					}

					if (!normalizedWindowName) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedWindowName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => {
					const electronWindowSource = electronWindowSourceMap.get(source.id);
					return {
						id: source.id,
						name: source.name,
						display_id: source.display_id ?? electronWindowSource?.display_id ?? "",
						thumbnail: electronWindowSource?.thumbnail
							? electronWindowSource.thumbnail.toDataURL()
							: null,
						appIcon:
							source.appIcon ??
							(electronWindowSource?.appIcon ? electronWindowSource.appIcon.toDataURL() : null),
						appName: source.appName,
						windowTitle: source.windowTitle,
					};
				})
				.filter((source) => Boolean(source.thumbnail));

			return [...screenSources, ...mergedWindowSources];
		} catch (error) {
			console.warn("Falling back to Electron window enumeration on macOS:", error);

			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (
						options.allowOwnWindowCapture &&
						options.appNameAliases.some((alias) => normalizedName.includes(alias))
					) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (
							normalizedName === ownName ||
							normalizedName.includes(ownName) ||
							ownName.includes(normalizedName)
						) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
				}));

			return [...screenSources, ...windowSources];
		}
	});

	ipcMain.handle(IPC_CHANNELS.capture.selectSource, (_, source: SelectedSource) => {
		options.setSelectedSource(source);
		options.setUserExplicitlySelectedSource(true);
		if (!options.getSelectedAreaForSource(source)) {
			options.setSelectedArea(null);
		}
		options.notifySelectedAreaChanged();
		options.stopWindowBoundsCapture();
		const sourceSelectorWin = options.getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.close();
		}
		return options.getSelectedSource();
	});

	ipcMain.handle(IPC_CHANNELS.capture.autoSelectCursorDisplay, async () => {
		if (options.getUserExplicitlySelectedSource() && options.getSelectedSource()) {
			return { success: true, source: options.getSelectedSource() };
		}
		try {
			const cursor = options.getScreen().getCursorScreenPoint();
			const targetDisplay = options.getScreen().getDisplayNearestPoint(cursor);
			const sources = await desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: { width: 1, height: 1 },
				fetchWindowIcons: false,
			});
			const match =
				sources.find((source) => Number(source.display_id) === targetDisplay.id) ?? sources[0];
			if (!match) {
				return { success: false };
			}
			options.setSelectedSource({
				id: match.id,
				name: match.name,
				display_id: String(targetDisplay.id),
			});
			options.setSelectedArea(null);
			options.notifySelectedAreaChanged();
			return { success: true, source: options.getSelectedSource() };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle(IPC_CHANNELS.capture.getSelectedSource, () => {
		return options.getSelectedSource();
	});

	ipcMain.handle(IPC_CHANNELS.capture.setSelectedArea, (_, area: SelectedArea | null) => {
		options.setSelectedArea(area);
		options.notifySelectedAreaChanged();
		return { success: true, area: options.getSelectedArea() };
	});

	ipcMain.handle(IPC_CHANNELS.capture.getSelectedArea, () => {
		return { success: true, area: options.getSelectedArea() };
	});

	ipcMain.handle(IPC_CHANNELS.capture.clearSelectedArea, () => {
		options.setSelectedArea(null);
		options.notifySelectedAreaChanged();
		return { success: true };
	});
}
