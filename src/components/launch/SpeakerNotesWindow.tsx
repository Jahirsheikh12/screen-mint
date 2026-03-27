import { useEffect, useState } from "react";

export function SpeakerNotesWindow() {
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
		<div className="h-full w-full rounded-2xl border border-white/10 bg-[rgba(14,14,16,0.88)] p-3 text-white shadow-2xl backdrop-blur-2xl">
			<div className="mb-2 flex items-center justify-between">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
					Speaker Notes
				</div>
				<button
					type="button"
					onClick={() => void window.electronAPI.closeSpeakerNotesWindow()}
					className="rounded-md px-2 py-1 text-[11px] text-white/45 transition hover:bg-white/10 hover:text-white/80"
				>
					Close
				</button>
			</div>
			<textarea
				value={text}
				onChange={(event) => persistText(event.target.value)}
				placeholder="Write talking points, reminders, or a script here..."
				className="h-[calc(100%-2rem)] w-full resize-none rounded-xl border border-white/8 bg-black/20 p-3 text-sm leading-6 text-white/90 outline-none placeholder:text-white/25"
			/>
		</div>
	);
}
