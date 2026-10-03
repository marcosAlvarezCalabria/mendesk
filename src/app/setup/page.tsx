import { redirect } from "next/navigation";
import { safeNextPath } from "@/app/safeNextPath";
import { SetupForm } from "./SetupForm";
import { makeShopProfileRepository } from "@/composition/directus";
import { getLocale } from "@/i18n/getLocale";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

const copy = {
  en: { title: "Make Mendesk yours", intro: "Add the workshop details used by your team. You can change them later in Settings.", name: "Workshop name", email: "Contact email", phone: "Contact phone", whatsapp: "WhatsApp number (optional)", address: "Workshop address (optional)", hint: "These details stay inside this workshop installation.", save: "Save and continue", saving: "Saving…", saved: "Workshop details saved.", skip: "I’ll do this later" },
  uk: { title: "Налаштуйте Mendesk для себе", intro: "Додайте дані майстерні для вашої команди. Їх можна змінити пізніше.", name: "Назва майстерні", email: "Контактна електронна пошта", phone: "Контактний телефон", whatsapp: "Номер WhatsApp (необов’язково)", address: "Адреса майстерні (необов’язково)", hint: "Ці дані залишаються лише в цій інсталяції майстерні.", save: "Зберегти й продовжити", saving: "Збереження…", saved: "Дані майстерні збережено.", skip: "Зроблю це пізніше" },
} as const;

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/setup");
  const nextPath = safeNextPath((await searchParams).next);
  const [locale, initial] = await Promise.all([getLocale(), makeShopProfileRepository(token).get()]);
  return <SetupForm copy={copy[locale]} initial={initial} nextPath={nextPath} />;
}
