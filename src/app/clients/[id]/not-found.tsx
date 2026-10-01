import Link from "next/link";

import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

export default async function ClientNotFound() {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <section className="rounded-xl bg-white px-5 py-10 text-center shadow-sm shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-slate-950">{t(dict, "clients.notFound.title")}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">{t(dict, "clients.notFound.description")}</p>
          <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" href="/clients">
            {t(dict, "clients.backToClients")}
          </Link>
        </section>
      </div>
    </main>
  );
}
