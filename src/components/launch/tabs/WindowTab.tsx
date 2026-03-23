import { useCallback, useEffect, useState } from "react";
import { MdMonitor } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";
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
};

export function WindowTab({ disabled, onSelectSource, onFallbackToDisplay }: WindowTabProps) {
	const t = useScopedT("launch");
	const [windows, setWindows] = useState<WindowSource[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const loadWindows = useCallback(async () => {
		try {
			const sources = await window.electronAPI.getSources({ types: ["window"] });
			setWindows(sources);
		} catch {
			setWindows([]);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void loadWindows();
		const interval = setInterval(() => void loadWindows(), 3000);
		return () => clearInterval(interval);
	}, [loadWindows]);

	const handleSelect = (source: WindowSource) => {
		if (disabled) return;
		setSelectedId(source.id);
		onSelectSource(source);
	};

	if (loading && windows.length === 0) {
		return (
			<div className="flex items-center justify-center py-12 text-white/40 text-xs">
				{t("window.loadingWindows")}
			</div>
		);
	}

	if (windows.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 py-12">
				<span className="text-white/40 text-xs">{t("window.noWindows")}</span>
				<button
					type="button"
					onClick={onFallbackToDisplay}
					className="text-white/50 text-xs hover:text-white/70 hover:underline cursor-pointer"
				>
					{t("window.recordEntireDisplay")}
				</button>
			</div>
		);
	}

	return (
		<div className="px-5 py-5">
			<h3 className="text-white/40 text-[11px] font-medium mb-4 uppercase tracking-widest">
				{t("window.selectWindow")}
			</h3>
			<div
				className={`grid grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1 ${styles.hudScrollArea}`}
			>
				{windows.map((source) => {
					const isSelected = selectedId === source.id;
					return (
						<button
							key={source.id}
							type="button"
							onClick={() => handleSelect(source)}
							disabled={disabled}
							className={`relative flex flex-col items-center gap-2.5 rounded-xl p-3 transition-all ${
								isSelected
									? "bg-white/[0.08] ring-1 ring-white/20"
									: "bg-white/[0.03] hover:bg-white/[0.06]"
							} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
						>
							{source.thumbnail ? (
								<img
									src={source.thumbnail}
									alt={source.name}
									className="w-full h-[90px] rounded-lg object-cover border border-white/[0.08]"
								/>
							) : (
								<div className="flex w-full h-[90px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
									<MdMonitor size={22} className="text-white/20" />
								</div>
							)}
							<div className="flex items-center gap-2 w-full px-0.5">
								{source.appIcon && (
									<img src={source.appIcon} alt="" className="h-4 w-4 rounded-sm shrink-0" />
								)}
								<span className="text-[11px] text-white/55 truncate leading-tight">
									{source.appName || source.name}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
