import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useScopedT } from "@/contexts/I18nContext";

/** Shows each new entry of the hosted announcements feed once, until the user dismisses it. */
export function AnnouncementToasts() {
	const t = useScopedT("common");
	const requested = useRef(false);

	useEffect(() => {
		if (requested.current || !window.electronAPI?.getAnnouncements) return;
		requested.current = true;

		void window.electronAPI.getAnnouncements().then((announcements) => {
			for (const announcement of announcements) {
				if (announcement.presentation === "export") continue;
				const { id, title, body, url } = announcement;
				toast(title, {
					id: `announcement-${id}`,
					description: body || undefined,
					duration: Number.POSITIVE_INFINITY,
					closeButton: true,
					action: url
						? {
								label: t("announcements.learnMore", "Learn more"),
								onClick: () => void window.electronAPI.openExternalUrl(url),
							}
						: undefined,
					onDismiss: () => void window.electronAPI.dismissAnnouncement(id),
				});
			}
		});
	}, [t]);

	return null;
}
