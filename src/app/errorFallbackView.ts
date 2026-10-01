import { dictionaries } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/locale";
import { t } from "@/i18n/t";

export type ErrorFallbackTexts = {
  title: string;
  description: string;
  tryAgain: string;
  backToOrders: string;
};

export function errorFallbackTexts(documentLocale: string): ErrorFallbackTexts {
  const locale = isValidLocale(documentLocale) ? documentLocale : "en";
  const dict = dictionaries[locale];

  return {
    title: t(dict, "error.title"),
    description: t(dict, "error.description"),
    tryAgain: t(dict, "error.tryAgain"),
    backToOrders: t(dict, "error.backToOrders"),
  };
}
