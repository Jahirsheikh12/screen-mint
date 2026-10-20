import { useEffect, useMemo, useState } from "react";
import { MdCropFree } from "react-icons/md";
import { CaptureAccessNotice } from "@/components/launch/CaptureAccessNotice";
import { useScopedT } from "@/contexts/I18nContext";
import { useCaptureSourceAccess } from "@/hooks/useCaptureSourceAccess";
import { normalizeSelectedArea } from "@/lib/recording/session";

type AreaTabProps = {
	disabled: boolean;
	/** Whether an area is currently selected (kept in sync by the HUD). */
	hasArea: boolean;
	onPermissionDenied?: () => void;
};

export function AreaTab({ disabled, hasArea, onPermissionDenied }: AreaTabProps) {
	const t = useScopedT("launch");
	const [displayId, setDisplayId] = useState<number | null>(null);
	const sourceOptions = useMemo<Electron.SourcesOptions>(() => ({ types: ["screen"] }), []);
	const { sources, loading, loadError, refresh, accessState } =
		useCaptureSourceAccess(sourceOptions);
	const presets = [
		{ label: "1920 x 1080", width: 1920, height: 1080 },
		{ label: "1280 x 720", width: 1280, height: 720 },
		{ label: "800 x 600", width: 800, height: 600 },
	];

	// Target the display under the cursor and bring back the last area used on it.
	useEffect(() => {
		if (disabled || sources.length === 0) return;
		let cancelled = false;
		void window.electronAPI
			.prepareAreaCapture()
			.then((result) => {
				if (cancelled || !result.success) return;
				setDisplayId(result.displayId);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [disabled, sources.length]);

	// Auto-dismiss the overlay when permission is denied — the OS permission prompt
	// is already visible, so our custom notice is redundant and blocks the view.
	useEffect(() => {
		if (accessState && !accessState.canProbeSources && onPermissionDenied) {
			onPermissionDenied();
		}
	}, [accessState, onPermissionDenied]);

	if (loading && sources.length === 0) {
		return (
			<div className="flex items-center justify-center py-12 text-white/40 text-xs">
				{t("sourceSelector.loadingSources")}
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
					"permissions.areaLoadFailedDescription",
					"ScreenMint ran into an unexpected macOS capture error while preparing area capture.",
				)}
				details={loadError}
				openSettingsLabel={t("permissions.openSettings", "Open Settings")}
				retryLabel={t("permissions.retry", "Retry")}
				onOpenSettings={() => void window.electronAPI.openDisplayCapturePreferences()}
				onRetry={() => void refresh()}
			/>
		);
	}

	const openAreaSelector = () => {
		if (disabled) return;
		void (async () => {
			await window.electronAPI.beginAreaEdit(null);
			await window.electronAPI.createAreaOverlay(displayId ?? undefined);
		})();
	};

	const clearArea = () => {
		void (async () => {
			await window.electronAPI.closeAreaOverlay();
			await window.electronAPI.clearSelectedArea();
		})();
	};

	const applyPreset = (width: number, height: number) => {
		if (disabled) return;

		void (async () => {
			const displayInfo = await window.electronAPI.getDisplayInfo();
			const display =
				displayInfo.success && displayId !== null
					? (displayInfo.displays.find((candidate) => candidate.id === displayId) ?? null)
					: null;

			if (!display) {
				openAreaSelector();
				return;
			}

			const nextWidth = Math.min(width, display.width);
			const nextHeight = Math.min(height, display.height);
			const x = Math.max(0, Math.round((display.width - nextWidth) / 2));
			const y = Math.max(0, Math.round((display.height - nextHeight) / 2));
			const area = normalizeSelectedArea(
				{
					x: display.x + x,
					y: display.y + y,
					width: nextWidth,
					height: nextHeight,
				},
				display,
				display.id,
			);
			// Shown in the overlay for positioning; only kept if the user confirms it.
			await window.electronAPI.beginAreaEdit(area);
			await window.electronAPI.createAreaOverlay(display.id);
		})();
	};

	return (
		<div className="flex flex-col items-center gap-4 py-4 px-4">
			<button
				type="button"
				onClick={openAreaSelector}
				disabled={disabled}
				className={`flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-medium transition-all ${
					disabled
						? "bg-white/[0.04] text-white/25 cursor-not-allowed"
						: "bg-white/[0.08] text-white/70 hover:bg-white/[0.12] cursor-pointer border border-white/[0.1]"
				}`}
			>
				<MdCropFree size={18} />
				{hasArea ? t("area.adjustArea", "Adjust area") : t("area.selectArea")}
			</button>
			{hasArea ? (
				<button
					type="button"
					onClick={clearArea}
					disabled={disabled}
					className="-mt-2 text-[11px] text-white/40 transition-colors hover:text-white/75 disabled:cursor-not-allowed"
				>
					{t("area.clearArea", "Clear area")}
				</button>
			) : null}

			{/* Preset sizes */}
			<div className="flex items-center gap-2">
				{presets.map((preset) => (
					<button
						key={preset.label}
						type="button"
						onClick={() => applyPreset(preset.width, preset.height)}
						disabled={disabled}
						className={`rounded-md border px-2.5 py-1 text-[10px] transition ${
							disabled
								? "cursor-not-allowed border-white/[0.04] bg-white/[0.03] text-white/20"
								: "cursor-pointer border-white/[0.08] bg-white/[0.05] text-white/55 hover:bg-white/[0.08] hover:text-white/80"
						}`}
					>
						{preset.label}
					</button>
				))}
			</div>
		</div>
	);
}
