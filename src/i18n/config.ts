export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES = [
	"en",
	"es",
	"fr",
	"de",
	"it",
	"nl",
	"ko",
	"pt-BR",
	"zh-CN",
	"zh-TW",
] as const;

export const LOCALE_LABELS: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
	en: "EN",
	es: "ES",
	fr: "FR",
	de: "DE",
	it: "IT",
	nl: "NL",
	ko: "한국어",
	"pt-BR": "PT",
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
};

export const I18N_NAMESPACES = [
	"common",
	"launch",
	"editor",
	"timeline",
	"settings",
	"dialogs",
	"shortcuts",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];
