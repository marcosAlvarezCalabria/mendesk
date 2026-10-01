import { en } from "@/i18n/dictionaries/en";
import { uk } from "@/i18n/dictionaries/uk";
import type { Locale } from "@/i18n/locale";

export type DictKey = keyof typeof en;

export const dictionaries: Record<Locale, Record<DictKey, string>> = { en, uk };
