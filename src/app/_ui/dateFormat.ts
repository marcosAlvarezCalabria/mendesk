import type { Locale } from "@/i18n/locale";
import { toIntlLocale } from "@/i18n/locale";

const shortDateFormatters = makeFormatters({ day: "2-digit", month: "short", year: "numeric" });

const shortDateTimeFormatters = makeFormatters({
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatShortDate(date: Date, locale: Locale): string {
  return shortDateFormatters[locale].format(date);
}

export function formatShortDateTime(date: Date, locale: Locale): string {
  return shortDateTimeFormatters[locale].format(date);
}

function makeFormatters(options: Intl.DateTimeFormatOptions): Record<Locale, Intl.DateTimeFormat> {
  return {
    en: new Intl.DateTimeFormat(toIntlLocale("en"), options),
    es: new Intl.DateTimeFormat(toIntlLocale("es"), options),
    uk: new Intl.DateTimeFormat(toIntlLocale("uk"), options),
  };
}
