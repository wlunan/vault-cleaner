import { zhCN } from "./zh-CN";
import { enUS } from "./en-US";

export type Language = "zh-CN" | "en-US";

export type Translation = typeof zhCN;

const translations: Record<Language, Translation> = {
	"zh-CN": zhCN,
	"en-US": enUS,
};

let currentLanguage: Language = "en-US";

export function setLanguage(lang: Language): void {
	currentLanguage = lang;
}

export function getLanguage(): Language {
	return currentLanguage;
}

export function t(): Translation {
	return translations[currentLanguage];
}

export function getAvailableLanguages(): { code: Language; name: string }[] {
	return [
		{ code: "en-US", name: "English" },
		{ code: "zh-CN", name: "中文" },
	];
}
