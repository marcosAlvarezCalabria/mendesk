import type { Locale } from "@/i18n/locale";

const shortDateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  uk: new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
};

const shortDateTimeFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  uk: new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
};

export function formatShortDate(date: Date, locale: Locale): string {
  return shortDateFormatters[locale].format(date);
}

export function formatShortDateTime(date: Date, locale: Locale): string {
  return shortDateTimeFormatters[locale].format(date);
}
