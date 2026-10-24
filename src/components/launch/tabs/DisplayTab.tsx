import { Monitor } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureAccessNotice } from "@/components/launch/CaptureAccessNotice";
import { useScopedT } from "@/contexts/I18nContext";
import { useCaptureSourceAccess } from "@/hooks/useCaptureSourceAccess";

type DisplaySource = {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
};

type DisplayInfo = {
	id: number;
	label: string;
	width: number;
	height: number;
	refreshRate: number;
};

type DisplayTabProps = {
	disabled: boolean;
	onSelectSource: (source: DisplaySource) => void;
	onPermissionDenied?: () => void;
};

export function DisplayTab({ disabled, onSelectSource, onPermissionDenied }: DisplayTabProps) {
	const t = useScopedT("launch");
	const [displayInfo, setDisplayInfo] = useState<DisplayInfo[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const onSelectSourceRef = useRef(onSelectSource);
	onSelectSourceRef.current = onSelectSource;
	const sourceOptions = useMemo<Electron.SourcesOptions>(
		() => ({ types: ["screen"], thumbnailSize: { width: 600, height: 375 } }),
		[],
	);
	const { sources, loading, loadError, refresh, accessState } =
		useCaptureSourceAccess(sourceOptions);
	const displays = sources as DisplaySource[];

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const sources = displays;
			if (!cancelled && sources.length > 0) {
				setSelectedId((prev) => {
					if (!prev) {
						onSelectSourceRef.current(sources[0]);
						return sources[0].id;
					}
					return prev;
				});
			}

			try {
				const info = await window.electronAPI.getDisplayInfo();
				if (!cancelled && info.success) {
					setDisplayInfo(info.displays);
				}
			} catch {
				// getDisplayInfo may not be available on all platforms
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [displays]);

	const handleSelect = (source: DisplaySource) => {
		if (disabled) return;
		setSelectedId(source.id);
		onSelectSource(source);
	};

	const getInfoForDisplay = (source: DisplaySource): DisplayInfo | undefined => {
		return displayInfo.find((d) => String(d.id) === source.display_id);
	};

	useEffect(() => {
		if (accessState && !accessState.canProbeSources && onPermissionDenied) {
			onPermissionDenied();
		}
	}, [accessState, onPermissionDenied]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12 text-fg-subtle text-label font-medium">
				{t("sourceSelector.loadingSources", "Loading displays...")}
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
					"permissions.captureLoadFailedDescription",
					"ScreenMint ran into an unexpected macOS capture error while loading displays.",
				)}
				details={loadError}
				openSettingsLabel={t("permissions.openSettings", "Open Settings")}
				retryLabel={t("permissions.retry", "Retry")}
				onOpenSettings={() => void window.electronAPI.openDisplayCapturePreferences()}
				onRetry={() => void refresh()}
			/>
		);
	}

	return (
		<div className="px-4 py-4">
			<div className="grid grid-cols-2 gap-4 justify-center">
				{displays.map((source) => {
					const info = getInfoForDisplay(source);
					const isSelected = selectedId === source.id;
					return (
						<button
							key={source.id}
							type="button"
							onClick={() => handleSelect(source)}
							disabled={disabled}
							className={`relative flex flex-col items-center gap-3 rounded-lg p-3 transition-colors text-left overflow-hidden ${
								isSelected
									? "bg-fill-hover ring-1 ring-accent"
									: "bg-fill-subtle border border-transparent hover:bg-fill-hover"
							} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
						>
							<div className="relative w-full aspect-[16/10] rounded border border-line-strong overflow-hidden bg-fill-subtle">
								{source.thumbnail ? (
									<img
										src={source.thumbnail}
										alt={source.name}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<Monitor size={24} className="text-fg-disabled" />
									</div>
								)}
							</div>

							<div className="flex flex-col items-center gap-0.5 w-full">
								<span
									className={`text-label font-medium truncate w-full text-center ${isSelected ? "text-fg" : "text-fg-muted"}`}
								>
									{source.name}
								</span>
								{info && (
									<span className="text-micro text-fg-subtle tabular-nums">
										{info.width} &times; {info.height} &bull; {Math.round(info.refreshRate)}Hz
									</span>
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
