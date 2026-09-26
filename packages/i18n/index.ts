import en from "./en.json";
import ar from "./ar.json";

export type Locale = "en" | "ar";
export type MessageKey = keyof typeof en;

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { en, ar };

export const defaultLocale: Locale = "en";

export function dir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Every user-facing string goes through t(). Missing Arabic keys fall back to English.
 * Placeholders use {name}: t("greeting", { name: "Mona" }).
 */
export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = defaultLocale): string {
  const template = catalogs[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** True when the English catalog has this key (for labels looked up from data, e.g. a setting's key). */
export function hasMessage(key: string): key is MessageKey {
  return key in en;
}
