"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { technicalKeys } from "@/config/technicalKeys";
import { storeConfig } from "@/config/currentStore";
import { isValidLocale } from "@/i18n/locale";

export async function setLocale(locale: string): Promise<void> {
  if (!isValidLocale(locale) || !storeConfig.localization.locales.includes(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(technicalKeys.localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  refresh();
}
