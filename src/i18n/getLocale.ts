import { cookies } from "next/headers";

import { technicalKeys } from "@/config/technicalKeys";
import { storeConfig } from "@/config/currentStore";
import { isValidLocale, type Locale } from "@/i18n/locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get(technicalKeys.localeCookie)?.value;

  return locale && isValidLocale(locale) && storeConfig.localization.locales.includes(locale)
    ? locale
    : storeConfig.localization.defaultLocale;
}
