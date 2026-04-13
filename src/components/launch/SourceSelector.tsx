import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiMonitor, FiSearch, FiSquare, FiX } from "react-icons/fi";
import { CaptureAccessNotice } from "@/components/launch/CaptureAccessNotice";
import { useScopedT } from "../../contexts/I18nContext";
import { useCaptureSourceAccess } from "../../hooks/useCaptureSourceAccess";
import styles from "./SourceSelector.module.css";

type ProcessedDesktopSource = {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	sourceType?: "screen" | "window";
	appName?: string;
	windowTitle?: string;
	width?: number;
	height?: number;
	scaleFactor?: number;
	isPrimary?: boolean;
	isInternal?: boolean;
};

type DesktopSource = {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	originalName: string;
	sourceType: "screen" | "window";
	appName?: string;
	windowTitle?: string;
	width?: number;
	height?: number;
	isPrimary?: boolean;
	isInternal?: boolean;
};

type TabKey = "screens" | "windows";

const DISPLAY_CARD_MIN = 260;
const WINDOW_CARD_MIN = 220;

function parseSourceMetadata(source: ProcessedDesktopSource) {
	if (source.sourceType === "window" && (source.appName || source.windowTitle)) {
		return {
			sourceType: "window" as const,
			appName: source.appName,
			windowTitle: source.windowTitle ?? source.name,
			displayName: source.windowTitle ?? source.name,
		};
	}

	const sourceType: "screen" | "window" = source.id.startsWith("window:") ? "window" : "screen";
	if (sourceType === "window") {
		const [appNamePart, ...windowTitleParts] = source.name.split(" — ");
		const appName = appNamePart?.trim() || undefined;
		const windowTitle = windowTitleParts.join(" — ").trim() || source.name.trim();
		return {
			sourceType,
			appName,
			windowTitle,
			displayName: windowTitle,
		};
	}

	return {
		sourceType,
		appName: undefined,
		windowTitle: undefined,
		displayName: source.name,
	};
}

function filterByQuery(list: DesktopSource[], query: string): DesktopSource[] {
	if (!query) return list;
	const q = query.trim().toLowerCase();
	if (!q) return list;
	return list.filter(
		(s) =>
			s.name.toLowerCase().includes(q) ||
			s.appName?.toLowerCase().includes(q) ||
			s.originalName.toLowerCase().includes(q),
	);
}

function SkeletonGrid({ variant }: { variant: TabKey }) {
	if (variant === "screens") {
		return (
			<div className={`${styles.skeletonGrid} ${styles.skeletonGridScreens}`}>
				{Array.from({ length: 4 }, (_, i) => `sk-d-${i}`).map((key) => (
					<div key={key} className={styles.skeletonDisplay}>
						<div className={styles.skeletonDisplayBezel}>
							<div className={styles.skeletonDisplayScreen} />
						</div>
						<div className={styles.skeletonDisplayMeta} />
					</div>
				))}
			</div>
		);
	}
	return (
		<div className={`${styles.skeletonGrid} ${styles.skeletonGridWindows}`}>
			{Array.from({ length: 6 }, (_, i) => `sk-w-${i}`).map((key) => (
				<div key={key} className={styles.skeletonWindow}>
					<div className={styles.skeletonWindowChrome} />
					<div className={styles.skeletonWindowThumb} />
					<div className={styles.skeletonWindowMeta} />
				</div>
			))}
		</div>
	);
}

type DisplayCardProps = {
	source: DesktopSource;
	selected: boolean;
	focused: boolean;
	onClick: () => void;
	onDoubleClick: () => void;
	primaryLabel: string;
};

function DisplayCard({
	source,
	selected,
	focused,
	onClick,
	onDoubleClick,
	primaryLabel,
}: DisplayCardProps) {
	const resolution =
		source.width && source.height ? `${source.width} × ${source.height}` : null;

	return (
		<button
			type="button"
			className={`${styles.displayCard} ${selected ? styles.displayCardSelected : ""} ${
				focused && !selected ? styles.displayCardFocused : ""
			}`}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		>
			<div className={styles.displayBezel}>
				<div className={styles.displayScreen}>
					{source.thumbnail ? (
						<img
							src={source.thumbnail}
							alt={source.name}
							className={styles.displayThumb}
							draggable={false}
						/>
					) : (
						<div className={styles.displayThumbPlaceholder}>
							<FiMonitor size={28} />
						</div>
					)}
				</div>
				<div className={styles.displayCheck}>
					<FiCheck size={13} strokeWidth={3.5} />
				</div>
			</div>
			<div className={styles.displayStand} />
			<div className={styles.displayBase} />
			<div className={styles.displayMeta}>
				<span className={styles.displayName}>{source.name}</span>
				{source.isPrimary && <span className={styles.displayBadgePrimary}>{primaryLabel}</span>}
				{resolution && <span className={styles.displayResolution}>{resolution}</span>}
			</div>
		</button>
	);
}

type WindowCardProps = {
	source: DesktopSource;
	selected: boolean;
	focused: boolean;
	onClick: () => void;
	onDoubleClick: () => void;
	untitledLabel: string;
};

function WindowCard({
	source,
	selected,
	focused,
	onClick,
	onDoubleClick,
	untitledLabel,
}: WindowCardProps) {
	const appName = source.appName ?? source.name;
	const titleLine = source.windowTitle && source.windowTitle !== appName ? source.windowTitle : "";

	return (
		<button
			type="button"
			className={`${styles.windowCard} ${selected ? styles.windowCardSelected : ""} ${
				focused && !selected ? styles.windowCardFocused : ""
			}`}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		>
			<div className={styles.windowChromeBar}>
				<span className={`${styles.chromeDot} ${styles.chromeDotRed}`} />
				<span className={`${styles.chromeDot} ${styles.chromeDotYellow}`} />
				<span className={`${styles.chromeDot} ${styles.chromeDotGreen}`} />
				<span className={styles.windowChromeTitle}>{titleLine || appName}</span>
			</div>
			<div className={styles.windowThumbWrap}>
				{source.thumbnail ? (
					<img
						src={source.thumbnail}
						alt={source.name}
						className={styles.windowThumb}
						draggable={false}
					/>
				) : (
					<div className={styles.windowThumbPlaceholder}>
						<div className={styles.windowPlaceholderIcon}>
							{source.appIcon ? (
								<img src={source.appIcon} alt="" />
							) : (
								<FiSquare size={20} />
							)}
						</div>
					</div>
				)}
				<div className={styles.windowCheck}>
					<FiCheck size={12} strokeWidth={3.5} />
				</div>
			</div>
			<div className={styles.windowMeta}>
				{source.appIcon ? (
					<img src={source.appIcon} alt="" className={styles.windowAppIcon} />
				) : (
					<div className={styles.windowAppIconFallback}>
						<FiSquare size={11} />
					</div>
				)}
				<div className={styles.windowTextBlock}>
					<span className={styles.windowAppName}>{appName || untitledLabel}</span>
					{titleLine && <span className={styles.windowTitle}>{titleLine}</span>}
				</div>
			</div>
		</button>
	);
}

export function SourceSelector() {
	const t = useScopedT("launch");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<TabKey>("screens");
	const [search, setSearch] = useState("");
	const [focusIndex, setFocusIndex] = useState(0);
	const gridRef = useRef<HTMLDivElement>(null);

	const sourceOptions = useMemo<Electron.SourcesOptions>(
		() => ({
			types: ["screen", "window"],
			thumbnailSize: { width: 480, height: 270 },
			fetchWindowIcons: true,
		}),
		[],
	);
	const {
		sources: rawSources,
		loading,
		loadError,
		diagnostics,
		refresh,
		accessState,
	} = useCaptureSourceAccess(sourceOptions);

	const sources: DesktopSource[] = useMemo(
		() =>
			rawSources.map((source) => {
				const metadata = parseSourceMetadata(source);
				return {
					id: source.id,
					name: metadata.displayName,
					thumbnail: source.thumbnail,
					display_id: source.display_id,
					appIcon: source.appIcon,
					originalName: source.name,
					sourceType: metadata.sourceType,
					appName: metadata.appName,
					windowTitle: metadata.windowTitle,
					width: source.width,
					height: source.height,
					isPrimary: source.isPrimary,
					isInternal: source.isInternal,
				};
			}),
		[rawSources],
	);

	const screenSources = useMemo(() => sources.filter((s) => s.sourceType === "screen"), [sources]);
	const windowSources = useMemo(() => sources.filter((s) => s.sourceType === "window"), [sources]);

	const filteredScreens = useMemo(
		() => filterByQuery(screenSources, search),
		[screenSources, search],
	);
	const filteredWindows = useMemo(
		() => filterByQuery(windowSources, search),
		[windowSources, search],
	);

	const visibleSources = activeTab === "screens" ? filteredScreens : filteredWindows;
	const otherTabHasMatches =
		search.trim().length > 0 &&
		(activeTab === "screens" ? filteredWindows.length > 0 : filteredScreens.length > 0);

	useEffect(() => {
		if (loading) return;
		if (screenSources.length === 0 && windowSources.length > 0) {
			setActiveTab("windows");
		} else if (windowSources.length === 0 && screenSources.length > 0) {
			setActiveTab("screens");
		}
	}, [loading, screenSources.length, windowSources.length]);

	useEffect(() => {
		setFocusIndex(0);
	}, [activeTab, search]);

	useEffect(() => {
		if (focusIndex >= visibleSources.length) {
			setFocusIndex(Math.max(0, visibleSources.length - 1));
		}
	}, [visibleSources.length, focusIndex]);

	const handleShare = useCallback(async () => {
		const target = visibleSources.find((s) => s.id === selectedId);
		if (target) await window.electronAPI.selectSource(target);
	}, [selectedId, visibleSources]);

	const handleCancel = useCallback(() => {
		window.close();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				handleCancel();
				return;
			}
			if (e.key === "Enter") {
				if (selectedId) {
					e.preventDefault();
					void handleShare();
				} else if (visibleSources[focusIndex]) {
					e.preventDefault();
					setSelectedId(visibleSources[focusIndex].id);
				}
				return;
			}
			if (e.key === "Tab") {
				e.preventDefault();
				setActiveTab((prev) => (prev === "screens" ? "windows" : "screens"));
				return;
			}
			if (!visibleSources.length) return;

			const cardWidth = activeTab === "screens" ? DISPLAY_CARD_MIN : WINDOW_CARD_MIN;
			const cols = Math.max(1, Math.floor((gridRef.current?.clientWidth ?? 0) / cardWidth));

			const moveFocus = (next: number) => {
				const clamped = Math.max(0, Math.min(visibleSources.length - 1, next));
				setFocusIndex(clamped);
				setSelectedId(visibleSources[clamped]?.id ?? null);
			};

			if (e.key === "ArrowRight") {
				e.preventDefault();
				moveFocus(focusIndex + 1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				moveFocus(focusIndex - 1);
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				moveFocus(focusIndex + cols);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				moveFocus(focusIndex - cols);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeTab, focusIndex, handleCancel, handleShare, selectedId, visibleSources]);

	const onCardClick = useCallback(
		(source: DesktopSource, index: number) => {
			if (selectedId === source.id) {
				void handleShare();
				return;
			}
			setSelectedId(source.id);
			setFocusIndex(index);
		},
		[handleShare, selectedId],
	);

	const onCardDoubleClick = useCallback(
		(source: DesktopSource) => {
			setSelectedId(source.id);
			void handleShare();
		},
		[handleShare],
	);

	if (accessState && !accessState.canProbeSources) {
		return (
			<div className={styles.shell}>
				<div className={styles.permissionWrap}>
					<CaptureAccessNotice
						title={t("permissions.screenPermissionTitle", "Allow Screen & System Audio Recording")}
						description={t(
							"permissions.sourceSelectorPermissionDescription",
							"ScreenMint needs macOS Screen & System Audio Recording permission before it can list screens and windows.",
						)}
						hint={t(
							"permissions.screenPermissionHint",
							"After granting access, quit and reopen ScreenMint, then retry.",
						)}
						openSettingsLabel={t("permissions.openSettings", "Open Settings")}
						retryLabel={t("permissions.retry", "Retry")}
						onOpenSettings={() => void window.electronAPI.openDisplayCapturePreferences()}
						onRetry={() => void refresh()}
					/>
				</div>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className={styles.shell}>
				<div className={styles.permissionWrap}>
					<CaptureAccessNotice
						title={t("permissions.captureLoadFailedTitle", "Could not load capture sources")}
						description={t(
							"permissions.captureLoadFailedDescription",
							"ScreenMint ran into an unexpected macOS capture error while loading sources.",
						)}
						details={loadError ?? diagnostics?.sourceProbe.desktopError ?? null}
						openSettingsLabel={t("permissions.openSettings", "Open Settings")}
						retryLabel={t("permissions.retry", "Retry")}
						onOpenSettings={() => void window.electronAPI.openDisplayCapturePreferences()}
						onRetry={() => void refresh()}
					/>
				</div>
			</div>
		);
	}

	const primaryLabel = t("sourceSelector.primary", "Primary");
	const untitledLabel = t("sourceSelector.untitledWindow", "Untitled window");
	const showSearchHint = search.trim().length > 0 && otherTabHasMatches;

	return (
		<div className={styles.shell}>
			<div className={`${styles.header} ${styles.dragHandle}`}>
				<div className={styles.titleBlock}>
					<div className={styles.eyebrow}>
						<span className={styles.eyebrowDot} />
						{t("sourceSelector.eyebrow", "Ready to record")}
					</div>
					<div className={styles.title}>{t("sourceSelector.title", "Choose what to share")}</div>
					<div className={styles.subtitle}>
						{t("sourceSelector.subtitle", "Pick a screen or window to start recording")}
					</div>
				</div>
				<button
					type="button"
					className={`${styles.closeBtn} ${styles.noDrag}`}
					onClick={handleCancel}
					aria-label={t("sourceSelector.cancel", "Cancel")}
				>
					<FiX size={15} />
				</button>
			</div>

			<div className={`${styles.controlsRow} ${styles.noDrag}`}>
				<div className={styles.tabsList} role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "screens"}
						className={`${styles.tabBtn} ${activeTab === "screens" ? styles.tabBtnActive : ""}`}
						onClick={() => setActiveTab("screens")}
					>
						<span className={styles.tabIcon}>
							<FiMonitor size={15} />
						</span>
						{t("sourceSelector.screens", "Screens")}
						<span className={styles.tabCount}>{filteredScreens.length}</span>
						{search.trim().length > 0 &&
							activeTab !== "screens" &&
							filteredScreens.length > 0 && <span className={styles.tabMatchDot} />}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "windows"}
						className={`${styles.tabBtn} ${activeTab === "windows" ? styles.tabBtnActive : ""}`}
						onClick={() => setActiveTab("windows")}
					>
						<span className={styles.tabIcon}>
							<FiSquare size={14} />
						</span>
						{t("sourceSelector.windows", "Windows")}
						<span className={styles.tabCount}>{filteredWindows.length}</span>
						{search.trim().length > 0 &&
							activeTab !== "windows" &&
							filteredWindows.length > 0 && <span className={styles.tabMatchDot} />}
					</button>
				</div>
				<div className={styles.searchWrap}>
					<FiSearch className={styles.searchIcon} size={14} />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("sourceSelector.searchPlaceholder", "Search displays and windows…")}
						className={styles.searchInput}
					/>
					{search && (
						<button
							type="button"
							className={styles.searchClearBtn}
							onClick={() => setSearch("")}
							aria-label="Clear search"
						>
							<FiX size={11} strokeWidth={3} />
						</button>
					)}
				</div>
			</div>

			<div className={styles.gridScroll} ref={gridRef}>
				{showSearchHint && (
					<div className={styles.searchHint}>
						<span className={styles.searchHintDot} />
						{t("sourceSelector.searchingAllSources", "Searching all sources")}
					</div>
				)}
				{loading && <SkeletonGrid variant={activeTab} />}
				{!loading && visibleSources.length === 0 && (
					<div className={styles.emptyState}>
						<div className={styles.emptyIcon}>
							{activeTab === "screens" ? <FiMonitor size={26} /> : <FiSquare size={24} />}
						</div>
						<div className={styles.emptyTitle}>
							{search
								? t("sourceSelector.noMatches", "No matches")
								: activeTab === "screens"
									? t("sourceSelector.noScreens", "No screens detected")
									: t("sourceSelector.noWindows", "No windows available")}
						</div>
						<div className={styles.emptyHint}>
							{search
								? t("sourceSelector.noMatchesHint", "Try a different search term.")
								: activeTab === "screens"
									? t(
											"sourceSelector.noScreensHint",
											"Connect a display or grant screen recording permission.",
										)
									: t(
											"sourceSelector.noWindowsHint",
											"Open an app and bring its window to the front, then retry.",
										)}
						</div>
					</div>
				)}
				{!loading && visibleSources.length > 0 && activeTab === "screens" && (
					<div className={styles.displayGrid}>
						{visibleSources.map((source, index) => (
							<DisplayCard
								key={source.id}
								source={source}
								selected={selectedId === source.id}
								focused={focusIndex === index}
								onClick={() => onCardClick(source, index)}
								onDoubleClick={() => onCardDoubleClick(source)}
								primaryLabel={primaryLabel}
							/>
						))}
					</div>
				)}
				{!loading && visibleSources.length > 0 && activeTab === "windows" && (
					<div className={styles.windowGrid}>
						{visibleSources.map((source, index) => (
							<WindowCard
								key={source.id}
								source={source}
								selected={selectedId === source.id}
								focused={focusIndex === index}
								onClick={() => onCardClick(source, index)}
								onDoubleClick={() => onCardDoubleClick(source)}
								untitledLabel={untitledLabel}
							/>
						))}
					</div>
				)}
			</div>

			<div className={styles.footer}>
				<div className={styles.kbdHint}>
					<span className={styles.kbdGroup}>
						<kbd className={styles.kbd}>↑</kbd>
						<kbd className={styles.kbd}>↓</kbd>
						<kbd className={styles.kbd}>←</kbd>
						<kbd className={styles.kbd}>→</kbd>
						{t("sourceSelector.kbdNavigate", "navigate")}
					</span>
					<span className={styles.kbdGroup}>
						<kbd className={styles.kbd}>tab</kbd>
						{t("sourceSelector.kbdSwitch", "switch tab")}
					</span>
					<span className={styles.kbdGroup}>
						<kbd className={styles.kbd}>↵</kbd>
						{t("sourceSelector.kbdShare", "share")}
					</span>
					<span className={styles.kbdGroup}>
						<kbd className={styles.kbd}>esc</kbd>
						{t("sourceSelector.kbdClose", "close")}
					</span>
				</div>
				<div className={styles.actions}>
					<button type="button" className={styles.btnGhost} onClick={handleCancel}>
						{t("sourceSelector.cancel", "Cancel")}
					</button>
					<button
						type="button"
						className={styles.btnPrimary}
						onClick={() => void handleShare()}
						disabled={!selectedId}
					>
						<FiCheck size={14} strokeWidth={3.5} />
						{t("sourceSelector.share", "Share")}
					</button>
				</div>
			</div>
		</div>
	);
}
