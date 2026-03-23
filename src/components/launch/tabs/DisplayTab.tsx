import { useCallback, useEffect, useRef, useState } from "react";
import { MdMonitor } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";

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
};

export function DisplayTab({ disabled, onSelectSource }: DisplayTabProps) {
	const t = useScopedT("launch");
	const [displays, setDisplays] = useState<DisplaySource[]>([]);
	const [displayInfo, setDisplayInfo] = useState<DisplayInfo[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const onSelectSourceRef = useRef(onSelectSource);
	onSelectSourceRef.current = onSelectSource;

	const loadDisplays = useCallback(async () => {
		try {
			const sources = await window.electronAPI.getSources({ types: ["screen"] });
			setDisplays(sources);
			return sources;
		} catch {
			// getSources may fail if no permission granted yet
			return [];
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const sources = await loadDisplays();
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

			if (!cancelled) setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [loadDisplays]);

	const handleSelect = (source: DisplaySource) => {
		if (disabled) return;
		setSelectedId(source.id);
		onSelectSource(source);
	};

	const getInfoForDisplay = (source: DisplaySource): DisplayInfo | undefined => {
		return displayInfo.find((d) => String(d.id) === source.display_id);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12 text-white/40 text-xs">
				{t("sourceSelector.loadingSources")}
			</div>
		);
	}

	return (
		<div className="px-6 py-6">
			<h3 className="text-white/40 text-[11px] font-medium mb-4 uppercase tracking-widest">
				{t("display.selectDisplay")}
			</h3>
			<div className="flex gap-3 justify-center flex-wrap">
				{displays.map((source) => {
					const info = getInfoForDisplay(source);
					const isSelected = selectedId === source.id;
					return (
						<button
							key={source.id}
							type="button"
							onClick={() => handleSelect(source)}
							disabled={disabled}
							className={`relative flex flex-col items-center gap-3 rounded-xl p-4 transition-all min-w-[150px] ${
								isSelected
									? "bg-white/[0.08] ring-1 ring-white/20"
									: "bg-white/[0.03] hover:bg-white/[0.06]"
							} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
						>
							{source.thumbnail ? (
								<img
									src={source.thumbnail}
									alt={source.name}
									className="h-[76px] w-[124px] rounded-lg object-cover border border-white/[0.08]"
								/>
							) : (
								<div className="flex h-[76px] w-[124px] items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
									<MdMonitor size={26} className="text-white/20" />
								</div>
							)}
							<div className="flex flex-col items-center gap-1">
								<span className="text-[11px] text-white/65 max-w-[124px] truncate font-medium">
									{source.name}
								</span>
								{info && (
									<span className="text-[10px] text-white/30">
										{info.width} x {info.height} @ {info.refreshRate}Hz
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
