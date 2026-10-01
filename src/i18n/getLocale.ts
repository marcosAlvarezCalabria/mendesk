import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isValidLocale, type Locale } from "@/i18n/locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("koko_locale")?.value;

  return locale && isValidLocale(locale) ? locale : DEFAULT_LOCALE;
}
