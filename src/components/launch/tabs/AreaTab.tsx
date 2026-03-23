import { useEffect, useState } from "react";
import { MdCropFree } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";

type AreaTabProps = {
	disabled: boolean;
};

export function AreaTab({ disabled }: AreaTabProps) {
	const t = useScopedT("launch");
	const [hasArea, setHasArea] = useState(false);

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
		setHasArea(true);
		void window.electronAPI.createAreaOverlay();
	};

	const presets = ["1920 x 1080", "1280 x 720", "800 x 600"];

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
				{hasArea ? t("area.selectArea") : t("area.selectArea")}
			</button>

			{/* Preset sizes */}
			<div className="flex items-center gap-2">
				{presets.map((preset) => (
					<span
						key={preset}
						className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/30 border border-white/[0.06]"
					>
						{preset}
					</span>
				))}
			</div>
		</div>
	);
}
