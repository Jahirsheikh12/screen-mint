import { MdPhoneIphone, MdTabletMac } from "react-icons/md";
import { useScopedT } from "@/contexts/I18nContext";

export function DeviceTab() {
	const t = useScopedT("launch");

	return (
		<div className="flex flex-col items-center gap-5 py-10 px-6">
			<div className="flex flex-col items-center gap-3">
				<div className="flex items-center gap-3 text-fg-disabled text-label">
					<MdPhoneIphone size={18} className="shrink-0" />
					<span>{t("device.noIosDevices")}</span>
				</div>
				<div className="flex items-center gap-3 text-fg-disabled text-label">
					<MdTabletMac size={18} className="shrink-0" />
					<span>{t("device.noIpadDevices")}</span>
				</div>
			</div>
			<span className="text-micro text-fg-disabled mt-1">{t("device.howToRecord")}</span>
		</div>
	);
}
