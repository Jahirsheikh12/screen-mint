import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "screenmint.theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];
const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

/** Window background behind the first paint, per theme. Keep in sync with index.html. */
export const THEME_WINDOW_BACKGROUND: Record<ResolvedTheme, string> = {
	dark: "#0e0e10",
	light: "#f4f3f0",
};

export function normalizeThemePreference(value: unknown): ThemePreference {
	return THEME_PREFERENCES.includes(value as ThemePreference)
		? (value as ThemePreference)
		: DEFAULT_THEME_PREFERENCE;
}

export function readThemePreference(): ThemePreference {
	try {
		return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return DEFAULT_THEME_PREFERENCE;
	}
}

function systemPrefersDark(): boolean {
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
	if (preference === "system") return prefersDark ? "dark" : "light";
	return preference;
}

/** Selects the token set in index.css. Overlay windows stay transparent and only take the tokens. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
	const theme = resolveTheme(preference, systemPrefersDark());
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	if (root.hasAttribute("data-overlay")) return theme;
	root.style.background = THEME_WINDOW_BACKGROUND[theme];
	document.body.style.background = THEME_WINDOW_BACKGROUND[theme];
	const appRoot = document.getElementById("root");
	if (appRoot) appRoot.style.background = THEME_WINDOW_BACKGROUND[theme];
	return theme;
}

/** Preference shared by every window (localStorage + storage events). */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
	const [preference, setPreferenceState] = useState(readThemePreference);

	useEffect(() => {
		applyTheme(preference);
		if (preference !== "system") return;
		const media = window.matchMedia?.("(prefers-color-scheme: dark)");
		if (!media) return;
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [preference]);

	useEffect(() => {
		const onStorage = (event: StorageEvent) => {
			if (event.key === THEME_STORAGE_KEY) {
				setPreferenceState(normalizeThemePreference(event.newValue));
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const setPreference = useCallback((next: ThemePreference) => {
		try {
			window.localStorage.setItem(THEME_STORAGE_KEY, next);
		} catch {
			// Storage unavailable: the choice still applies to this window.
		}
		// Other hook instances in this window don't get the cross-window storage event.
		window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: next }));
		setPreferenceState(next);
	}, []);

	return [preference, setPreference];
}
