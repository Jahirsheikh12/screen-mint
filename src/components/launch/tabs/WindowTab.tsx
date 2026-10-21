import { useEffect, useMemo, useState } from "react";
import { MdMonitor } from "react-icons/md";
import { CaptureAccessNotice } from "@/components/launch/CaptureAccessNotice";
import { useScopedT } from "@/contexts/I18nContext";
import { useCaptureSourceAccess } from "@/hooks/useCaptureSourceAccess";
import styles from "../LaunchWindow.module.css";

type WindowSource = {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
	appIcon: string | null;
	appName?: string;
	windowTitle?: string;
};

type WindowTabProps = {
	disabled: boolean;
	onSelectSource: (source: WindowSource) => void;
	onFallbackToDisplay: () => void;
	onPermissionDenied?: () => void;
};

export function WindowTab({
	disabled,
	onSelectSource,
	onFallbackToDisplay,
	onPermissionDenied,
}: WindowTabProps) {
	const t = useScopedT("launch");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const sourceOptions = useMemo<Electron.SourcesOptions>(
		() => ({ types: ["window"], thumbnailSize: { width: 600, height: 375 } }),
		[],
	);
	const { sources, loading, loadError, refresh, accessState } = useCaptureSourceAccess(
		sourceOptions,
		{
			refreshIntervalMs: 3000,
		},
	);
	const windows = sources as WindowSource[];

	const handleSelect = (source: WindowSource) => {
		if (disabled) return;
		setSelectedId(source.id);
		onSelectSource(source);
	};

	useEffect(() => {
		if (accessState && !accessState.canProbeSources && onPermissionDenied) {
			onPermissionDenied();
		}
	}, [accessState, onPermissionDenied]);

	if (loading && windows.length === 0) {
		return (
			<div className="flex items-center justify-center py-12 text-fg-subtle text-label font-medium">
				{t("window.loadingWindows", "Loading windows...")}
			</div>
		);
	}

	if (accessState && !accessState.canProbeSources) {
		return null;
	}

	if (loadError) {
		return (
			<CaptureAccessNotice
				title={t("permissions.captureLoadFailedTitle", "Could not load capture sources")}
				description={t(
					"permissions.windowLoadFailedDescription",
					"ScreenMint ran into an unexpected macOS capture error while loading windows.",
				)}
				details={loadError}
				openSettingsLabel={t("permissions.openSettings", "Open Settings")}
				retryLabel={t("permissions.retry", "Retry")}
				onOpenSettings={() => void window.electronAPI.openDisplayCapturePreferences()}
				onRetry={() => void refresh()}
			/>
		);
	}

	if (windows.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 py-12">
				<div className="w-12 h-12 rounded-lg bg-fill-subtle border border-line-strong flex items-center justify-center">
					<MdMonitor size={24} className="text-fg-disabled" />
				</div>
				<span className="text-fg-subtle text-label font-medium">
					{t("window.noWindows", "No available windows found")}
				</span>
				<button
					type="button"
					onClick={onFallbackToDisplay}
					className="px-4 py-1.5 rounded bg-fill-hover hover:bg-fill-pressed text-fg-muted text-caption font-medium transition-colors"
				>
					{t("window.recordEntireDisplay", "Record Entire Display Instead")}
				</button>
			</div>
		);
	}

	return (
		<div className="px-4 py-4">
			<div
				className={`grid grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-2 pb-2 ${styles.hudScrollArea}`}
			>
				{windows.map((source) => {
					const isSelected = selectedId === source.id;
					return (
						<button
							key={source.id}
							type="button"
							onClick={() => handleSelect(source)}
							disabled={disabled}
							className={`relative flex flex-col overflow-hidden rounded-md transition-colors text-left ${
								isSelected
									? "bg-fill-hover ring-1 ring-accent"
									: "bg-fill-subtle border border-transparent hover:bg-fill-hover"
							} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
						>
							<div className="flex items-center gap-1 px-2 h-5 bg-fill-subtle border-b border-line w-full">
								<div className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
								<div className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
								<div className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
							</div>

							<div className="relative w-full aspect-[16/10] bg-sunken overflow-hidden border-b border-line">
								{source.thumbnail ? (
									<img
										src={source.thumbnail}
										alt={source.name}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center">
										{source.appIcon ? (
											<img src={source.appIcon} alt="" className="w-8 h-8 opacity-40 grayscale" />
										) : (
											<MdMonitor size={20} className="text-fg-disabled" />
										)}
									</div>
								)}
							</div>

							<div className="flex items-center gap-2 w-full px-2 py-2">
								{source.appIcon ? (
									<div className="w-4 h-4 rounded-sm overflow-hidden shrink-0 bg-fill-subtle flex items-center justify-center p-[1px]">
										<img src={source.appIcon} alt="" className="w-full h-full object-contain" />
									</div>
								) : (
									<div className="w-4 h-4 rounded-sm shrink-0 bg-fill-subtle flex items-center justify-center">
										<div className="w-1.5 h-1.5 border border-line-strong rounded-[1px]" />
									</div>
								)}
								<div className="flex flex-col min-w-0">
									<span
										className={`text-caption font-medium truncate leading-none ${isSelected ? "text-fg" : "text-fg"}`}
									>
										{source.appName || source.name}
									</span>
									{source.windowTitle && source.windowTitle !== source.appName && (
										<span className="text-micro truncate leading-none text-fg-subtle mt-0.5">
											{source.windowTitle}
										</span>
									)}
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
