import fs from "node:fs";
import path from "node:path";
import { type AppLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../src/i18n/config";
import de from "../src/i18n/locales/de/native.json";
import en from "../src/i18n/locales/en/native.json";
import es from "../src/i18n/locales/es/native.json";
import fr from "../src/i18n/locales/fr/native.json";
import it from "../src/i18n/locales/it/native.json";
import ko from "../src/i18n/locales/ko/native.json";
import nl from "../src/i18n/locales/nl/native.json";
import ptBR from "../src/i18n/locales/pt-BR/native.json";
import zhCN from "../src/i18n/locales/zh-CN/native.json";
import zhTW from "../src/i18n/locales/zh-TW/native.json";

/**
 * Translations for text the main process shows itself: menus, tray, native dialogs and caption
 * progress. The renderer owns the language choice and reports it via setMainLocale; it is kept in
 * userData so menus are right on the next launch before any window opens.
 */
const MESSAGES: Record<AppLocale, unknown> = {
	en,
	de,
	es,
	fr,
	it,
	ko,
	nl,
	"pt-BR": ptBR,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
};

let currentLocale: AppLocale = DEFAULT_LOCALE;

function isAppLocale(value: unknown): value is AppLocale {
	return SUPPORTED_LOCALES.includes(value as AppLocale);
}

function lookup(messages: unknown, key: string): string | undefined {
	let current = messages;
	for (const part of key.split(".")) {
		if (!current || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return typeof current === "string" ? current : undefined;
}

/** Translates a `native` namespace key, falling back to English, then to the key itself. */
export function tMain(key: string, vars?: Record<string, string | number>): string {
	const template = lookup(MESSAGES[currentLocale], key) ?? lookup(MESSAGES.en, key) ?? key;
	if (!vars) return template;
	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) =>
		vars[name] === undefined ? "" : String(vars[name]),
	);
}

export function getMainLocale(): AppLocale {
	return currentLocale;
}

/** Sets the language; returns true when it changed. Unknown values are ignored. */
export function setMainLocale(locale: unknown): boolean {
	if (!isAppLocale(locale) || locale === currentLocale) return false;
	currentLocale = locale;
	return true;
}

export function loadStoredLocale(userDataPath: string) {
	try {
		const stored = JSON.parse(fs.readFileSync(path.join(userDataPath, "locale.json"), "utf8"));
		setMainLocale(stored?.locale);
	} catch {
		// First launch or unreadable file: English until the renderer reports its language.
	}
}

export function saveLocale(userDataPath: string) {
	fs.promises
		.writeFile(path.join(userDataPath, "locale.json"), JSON.stringify({ locale: currentLocale }))
		.catch(() => undefined);
}
