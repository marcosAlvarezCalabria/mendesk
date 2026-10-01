import Link from "next/link";

import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

export default async function OrderTicketsNotFound() {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-xl bg-white px-6 py-8 text-center shadow-sm shadow-slate-200/70">
        <h1 className="text-2xl font-semibold">{t(dict, "orders.notFound.title")}</h1>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" href="/orders">
          {t(dict, "nav.backToOrders")}
        </Link>
      </div>
    </main>
  );
}
