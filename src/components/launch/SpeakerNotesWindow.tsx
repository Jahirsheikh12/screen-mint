import { useEffect, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";

export function SpeakerNotesWindow() {
	const t = useScopedT("launch");
	const [text, setText] = useState("");

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const result = await window.electronAPI.getHudSettings();
				if (!cancelled && result.success && result.settings) {
					const next =
						typeof result.settings["speakerNotesText"] === "string"
							? result.settings["speakerNotesText"]
							: "";
					setText(next);
				}
			} catch {
				// Ignore HUD settings read failures in the notes window.
			}
		})();

		const unsubscribe = window.electronAPI.onSpeakerNotesUpdated(({ text: nextText }) => {
			if (!cancelled) {
				setText(nextText);
			}
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	const persistText = (nextText: string) => {
		setText(nextText);
		void (async () => {
			const result = await window.electronAPI.getHudSettings();
			const current = result.success && result.settings ? result.settings : {};
			await window.electronAPI.setHudSettings({
				...current,
				speakerNotesEnabled: true,
				speakerNotesText: nextText,
			});
			await window.electronAPI.updateSpeakerNotesWindow({ text: nextText });
		})();
	};

	return (
		<div className="h-screen w-full rounded-xl bg-surface/90 p-3 text-fg shadow-dialog backdrop-blur-2xl">
			<div className="mb-2 flex items-center justify-between">
				<div className="text-caption font-semibold uppercase tracking-[0.18em] text-fg-subtle">
					{t("speakerNotes.title")}
				</div>
				<button
					type="button"
					onClick={() => void window.electronAPI.closeSpeakerNotesWindow()}
					className="rounded-md px-2 py-1 text-caption text-fg-subtle transition hover:bg-fill-hover hover:text-fg-muted"
				>
					{t("speakerNotes.close")}
				</button>
			</div>
			<textarea
				value={text}
				onChange={(event) => persistText(event.target.value)}
				placeholder={t("speakerNotes.placeholder")}
				className="h-[calc(100%-2rem)] w-full resize-none rounded-xl border border-line bg-sunken p-3 text-body leading-6 text-fg outline-none placeholder:text-fg-subtle"
			/>
		</div>
	);
}
