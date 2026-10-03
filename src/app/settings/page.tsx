/*
THESIS: Workshop settings are a calm maintenance surface, not a repeat of first-run onboarding.
OWN-WORLD: Mendesk's warm workbench background, ink-dark controls, compact fields, and one clear save action.
STORY: Staff confirm which installation they are editing, update its contact profile, and receive explicit confirmation.
FIRST VIEWPORT: The app header names Settings; a short installation note leads directly into the editable profile.
FORM: Operate-mode single-column maintenance page extending the existing panel and shared setup fields.
*/
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { makeShopProfileRepository } from "@/composition/directus";
import { getLocale } from "@/i18n/getLocale";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { SettingsForm } from "./SettingsForm";

const copy = {
  en: {
    title: "Workshop settings",
    intro: "Keep the workshop contact details for this installation up to date.",
    name: "Workshop name",
    email: "Contact email",
    phone: "Contact phone",
    whatsapp: "WhatsApp number (optional)",
    address: "Workshop address (optional)",
    hint: "These details stay inside this workshop installation. Product and logo settings will be added separately.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Workshop settings saved.",
  },
  uk: {
    title: "Налаштування майстерні",
    intro: "Підтримуйте контактні дані цієї інсталяції майстерні в актуальному стані.",
    name: "Назва майстерні",
    email: "Контактна електронна пошта",
    phone: "Контактний телефон",
    whatsapp: "Номер WhatsApp (необов’язково)",
    address: "Адреса майстерні (необов’язково)",
    hint: "Ці дані залишаються лише в цій інсталяції. Налаштування продукту й логотипу буде додано окремо.",
    save: "Зберегти зміни",
    saving: "Збереження…",
    saved: "Налаштування майстерні збережено.",
  },
} as const;

export default async function SettingsPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/settings");

  const [locale, profile] = await Promise.all([
    getLocale(),
    makeShopProfileRepository(token).get().catch(error => redirectToLoginForAuthError(error, "/settings")),
  ]);
  if (!profile) redirect("/setup?next=/settings");
  const text = copy[locale];

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <AppHeader title={text.title} />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-24 pt-5 sm:px-6">
        <section aria-labelledby="settings-heading">
          <h1 className="text-headline-md" id="settings-heading">{text.title}</h1>
          <p className="mt-2 max-w-[65ch] text-body-md text-on-surface-variant">{text.intro}</p>
          <div className="mt-6">
            <SettingsForm copy={text} initial={profile} />
          </div>
        </section>
      </div>
    </main>
  );
}
