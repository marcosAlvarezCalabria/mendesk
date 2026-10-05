import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { uk } from "@/i18n/dictionaries/uk";
import type { Locale } from "@/i18n/locale";

export type DictKey = keyof typeof en;

export const dictionaries: Record<Locale, Record<DictKey, string>> = { en, es, uk };
