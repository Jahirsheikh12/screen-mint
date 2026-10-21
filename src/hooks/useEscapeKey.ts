import { useEffect, useRef } from "react";

/** Calls `onEscape` when Escape is pressed while `active`; for modals not built on Radix Dialog. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
	const handlerRef = useRef(onEscape);
	handlerRef.current = onEscape;

	useEffect(() => {
		if (!active) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) handlerRef.current();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [active]);
}
