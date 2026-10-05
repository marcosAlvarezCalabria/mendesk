export type Locale = "en" | "es" | "uk";

export const DEFAULT_LOCALE: Locale = "en";

export function isValidLocale(value: string): value is Locale {
  return value === "en" || value === "es" || value === "uk";
}

export function toIntlLocale(locale: Locale): "en-IE" | "es-ES" | "uk-UA" {
  if (locale === "es") return "es-ES";
  if (locale === "uk") return "uk-UA";
  return "en-IE";
}
