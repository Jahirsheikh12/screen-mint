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
};

type TabKey = "screens" | "windows";

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

function SkeletonGrid() {
	return (
		<div className={styles.skeletonGrid}>
			{Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((key) => (
				<div key={key} className={styles.skeletonCard}>
					<div className={styles.skeletonThumb} />
					<div className={styles.skeletonText} />
				</div>
			))}
		</div>
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
				};
			}),
		[rawSources],
	);

	const screenSources = useMemo(() => sources.filter((s) => s.sourceType === "screen"), [sources]);
	const windowSources = useMemo(() => sources.filter((s) => s.sourceType === "window"), [sources]);

	const visibleSources = useMemo(() => {
		const list = activeTab === "screens" ? screenSources : windowSources;
		const q = search.trim().toLowerCase();
		if (!q) return list;
		return list.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.appName?.toLowerCase().includes(q) ||
				s.originalName.toLowerCase().includes(q),
		);
	}, [activeTab, screenSources, windowSources, search]);

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
		setSelectedId(null);
	}, [activeTab]);

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

			const cols = Math.max(
				1,
				Math.floor((gridRef.current?.clientWidth ?? 0) / (activeTab === "screens" ? 232 : 192)),
			);

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

	const isMac =
		typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");
	const cmdLabel = isMac ? "↵" : "↵";

	return (
		<div className={styles.shell}>
			<div className={`${styles.header} ${styles.dragHandle}`}>
				<div className={styles.titleBlock}>
					<div className={styles.title}>{t("sourceSelector.title", "Choose what to share")}</div>
					<div className={styles.subtitle}>
						{t("sourceSelector.subtitle", "Pick a screen or window to start recording")}
					</div>
				</div>
				<button
					type="button"
					className={`${styles.closeBtn} ${styles.noDrag}`}
					onClick={handleCancel}
					aria-label={t("sourceSelector.cancel")}
				>
					<FiX size={14} />
				</button>
			</div>

			<div className={`${styles.tabBar} ${styles.noDrag}`}>
				<div className={styles.tabsList}>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "screens" ? styles.tabBtnActive : ""}`}
						onClick={() => setActiveTab("screens")}
					>
						<FiMonitor size={13} />
						{t("sourceSelector.screens")}
						<span className={styles.tabCount}>{screenSources.length}</span>
					</button>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "windows" ? styles.tabBtnActive : ""}`}
						onClick={() => setActiveTab("windows")}
					>
						<FiSquare size={13} />
						{t("sourceSelector.windows")}
						<span className={styles.tabCount}>{windowSources.length}</span>
					</button>
				</div>
				{activeTab === "windows" && (
					<div className={styles.searchWrap}>
						<FiSearch className={styles.searchIcon} size={13} />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("sourceSelector.searchPlaceholder", "Search windows…")}
							className={styles.searchInput}
						/>
					</div>
				)}
			</div>

			{activeTab === "windows" && !loading && windowSources.length > 0 && (
				<p className={styles.windowsNote}>{t("sourceSelector.windowsNote")}</p>
			)}

			<div className={styles.gridScroll} ref={gridRef}>
				{loading && <SkeletonGrid />}
				{!loading && visibleSources.length === 0 && (
					<div className={styles.emptyState}>
						<div className={styles.emptyIcon}>
							{activeTab === "screens" ? <FiMonitor size={24} /> : <FiSquare size={24} />}
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
				{!loading && visibleSources.length > 0 && (
					<div className={`${styles.grid} ${activeTab === "screens" ? styles.gridScreens : ""}`}>
						{visibleSources.map((source, index) => {
							const isSelected = selectedId === source.id;
							const isFocused = focusIndex === index;
							return (
								<button
									key={source.id}
									type="button"
									className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${
										isFocused && !isSelected ? styles.cardFocused : ""
									}`}
									onClick={() => onCardClick(source, index)}
									onDoubleClick={() => {
										setSelectedId(source.id);
										void handleShare();
									}}
								>
									<div className={styles.thumbWrap}>
										{source.thumbnail ? (
											<img
												src={source.thumbnail}
												alt={source.name}
												className={styles.thumb}
												draggable={false}
											/>
										) : (
											<div className={styles.thumbPlaceholder}>
												<div className={styles.placeholderIcon}>
													{source.appIcon ? (
														<img src={source.appIcon} alt="" />
													) : (
														<FiSquare size={20} />
													)}
												</div>
												<div className={styles.placeholderLabel}>
													{t("sourceSelector.windowPlaceholder")}
												</div>
											</div>
										)}
										<div className={styles.checkBadge}>
											<FiCheck size={12} strokeWidth={3} />
										</div>
									</div>
									<div className={styles.cardMeta}>
										{source.appIcon && source.thumbnail && (
											<img src={source.appIcon} alt="" className={styles.appIcon} />
										)}
										<div className={styles.cardName}>{source.name}</div>
									</div>
								</button>
							);
						})}
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
						<kbd className={styles.kbd}>{cmdLabel}</kbd>
						{t("sourceSelector.kbdShare", "share")}
					</span>
					<span className={styles.kbdGroup}>
						<kbd className={styles.kbd}>esc</kbd>
						{t("sourceSelector.kbdClose", "close")}
					</span>
				</div>
				<div className={styles.actions}>
					<button type="button" className={styles.btnGhost} onClick={handleCancel}>
						{t("sourceSelector.cancel")}
					</button>
					<button
						type="button"
						className={styles.btnPrimary}
						onClick={() => void handleShare()}
						disabled={!selectedId}
					>
						<FiCheck size={13} strokeWidth={3} />
						{t("sourceSelector.share")}
					</button>
				</div>
			</div>
		</div>
	);
}
