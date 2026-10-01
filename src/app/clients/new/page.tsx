import { redirect } from "next/navigation";
import { AppHeader } from "@/app/_ui/AppHeader";
import { safeNewClientReturnTo, withReturnTo } from "@/app/routeContext";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { getLocale } from "@/i18n/getLocale";
import { dictionaries } from "@/i18n/dictionaries";
import { NewClientForm } from "./NewClientForm";
export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const returnTo = safeNewClientReturnTo((await searchParams).returnTo);
  if (!await getSessionToken()) redirect(`/login?${new URLSearchParams({ next: withReturnTo("/clients/new", "/clients") })}`);
  const locale = await getLocale();
  return <main className="min-h-screen bg-background text-on-surface"><AppHeader title={dictionaries[locale]["clients.new.title"]} />
    <div className="mx-auto max-w-[720px] px-margin-mobile pb-8"><NewClientForm locale={locale} returnTo={returnTo} /></div>
  </main>;
}
