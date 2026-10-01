"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { isValidLocale } from "@/i18n/locale";

export async function setLocale(locale: string): Promise<void> {
  if (!isValidLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set("koko_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  refresh();
}
