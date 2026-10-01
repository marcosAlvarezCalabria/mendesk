import Link from "next/link";

import { Card } from "@/app/_ui/Card";
import { Icon } from "@/app/_ui/Icon";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";
import { storeConfig } from "@/config/currentStore";

export default async function OrderNotFound() {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-margin-mobile py-12 text-on-surface">
      <Card as="section" className="w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Icon name="search_off" />
        </div>
        <p className="mt-4 font-wordmark text-wordmark text-primary">{storeConfig.identity.name}</p>
        <h1 className="mt-2 text-title-lg text-on-surface">{t(dict, "orders.notFound.title")}</h1>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-label-md text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background" href="/orders">
          <Icon name="arrow_back" />
          <span>{t(dict, "nav.backToOrders")}</span>
        </Link>
      </Card>
    </main>
  );
}
