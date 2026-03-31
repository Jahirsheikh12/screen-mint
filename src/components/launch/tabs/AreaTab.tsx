import { useEffect, useState } from "react";
import { MdCropFree } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";
import { normalizeSelectedArea } from "@/lib/recording/session";

type AreaTabProps = {
	disabled: boolean;
};

export function AreaTab({ disabled }: AreaTabProps) {
	const t = useScopedT("launch");
	const [hasArea, setHasArea] = useState(false);
	const presets = [
		{ label: "1920 x 1080", width: 1920, height: 1080 },
		{ label: "1280 x 720", width: 1280, height: 720 },
		{ label: "800 x 600", width: 800, height: 600 },
	];

	// Auto-select the primary display as source when Area tab is active
	useEffect(() => {
		if (disabled) return;
		void (async () => {
			try {
				const sources = await window.electronAPI.getSources({ types: ["screen"] });
				if (sources.length > 0) {
					await window.electronAPI.selectSource(sources[0]);
				}
			} catch {
				// ignore
			}
		})();
	}, [disabled]);

	const openAreaSelector = () => {
		if (disabled) return;
		void (async () => {
			await window.electronAPI.createAreaOverlay();
			setHasArea(true);
		})();
	};

	const applyPreset = (width: number, height: number) => {
		if (disabled) return;

		void (async () => {
			const [source, displayInfo] = await Promise.all([
				window.electronAPI.getSelectedSource(),
				window.electronAPI.getDisplayInfo(),
			]);
			const displayId = Number(source?.display_id);
			const display =
				displayInfo.success && Number.isFinite(displayId)
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
			await window.electronAPI.setSelectedArea(area);
			setHasArea(true);
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
				{hasArea ? t("area.adjustArea", "Adjust Area") : t("area.selectArea")}
			</button>

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
