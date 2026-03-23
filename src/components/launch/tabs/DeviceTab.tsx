import { MdPhoneIphone, MdTabletMac } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";

export function DeviceTab() {
	const t = useScopedT("launch");

	return (
		<div className="flex flex-col items-center gap-5 py-10 px-6">
			<div className="flex flex-col items-center gap-3">
				<div className="flex items-center gap-3 text-white/20 text-xs">
					<MdPhoneIphone size={18} className="shrink-0" />
					<span>{t("device.noIosDevices")}</span>
				</div>
				<div className="flex items-center gap-3 text-white/20 text-xs">
					<MdTabletMac size={18} className="shrink-0" />
					<span>{t("device.noIpadDevices")}</span>
				</div>
			</div>
			<span className="text-[10px] text-white/25 mt-1">{t("device.howToRecord")}</span>
		</div>
	);
}
