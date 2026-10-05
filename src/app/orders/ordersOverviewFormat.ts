import { dictionaries, type DictKey } from "@/i18n/dictionaries";
import { toIntlLocale, type Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";

function date(value: string): Date {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new RangeError("Invalid date");
  return result;
}
function integer(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid amount or count");
}
export function formatOrdersDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { timeZone: "Europe/Dublin", day: "2-digit", month: "short", year: "numeric" }).format(date(value));
}
export function formatOrdersToday(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date(value));
}
export function formatOrdersMoney(cents: number, locale: Locale): string {
  integer(cents);
  return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency: "EUR" }).format(cents / 100);
}
function plural(kind: "garments" | "days", count: number, locale: Locale): string {
  integer(count);
  const category = new Intl.PluralRules(toIntlLocale(locale)).select(count);
  const suffix = ["one", "few", "many"].includes(category) ? category : "other";
  return t(dictionaries[locale], `orders.overview.${kind}_${suffix}` as DictKey, { count: String(count) });
}
export function formatOrdersGarmentCount(count: number, locale: Locale): string { return plural("garments", count, locale); }
export function formatOrdersOverdueDays(count: number, locale: Locale): string { return plural("days", count, locale); }
