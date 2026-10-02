import { cookies } from "next/headers";

import { technicalKeys } from "@/config/technicalKeys";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "@/i18n/locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get(technicalKeys.localeCookie)?.value;

  return locale && isValidLocale(locale) ? locale : DEFAULT_LOCALE;
}
