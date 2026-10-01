export type Locale = "en" | "uk";

export const DEFAULT_LOCALE: Locale = "en";

export function isValidLocale(value: string): value is Locale {
  return value === "en" || value === "uk";
}
