import React from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/_ui/AppHeader";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { GetOrdersOverview } from "@/application/useCases/GetOrdersOverview";
import { makeOrdersOverviewReader } from "@/composition/directus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { getLocale } from "@/i18n/getLocale";
import { dictionaries } from "@/i18n/dictionaries";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import { OrdersOverviewClient } from "./OrdersOverviewClient";
import { buildOrdersOverviewHref, parseOrdersOverviewParams } from "./ordersOverviewParams";

type OrdersPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = parseOrdersOverviewParams(await searchParams);
  const returnTo = buildOrdersOverviewHref(params);
  const token = await getSessionToken();
  if (!token) redirect(`/login?${new URLSearchParams({ next: returnTo })}`);
  const locale = await getLocale();
  const now = new Date();
  const overview = await new GetOrdersOverview(makeOrdersOverviewReader(token))
    .execute({ selection: params.selection, search: params.q, page: params.page, now })
    .catch(error => redirectToLoginForAuthError(error, returnTo));
  const readComplete = [overview.counts, overview.toCollect, overview.list].every(section => section.status === "ready");

  return <main className="min-h-screen bg-background text-on-surface">
    {readComplete && <ReadSyncMarker readId={crypto.randomUUID()} />}
    <AppHeader title={dictionaries[locale]["orders.overview.today"]} />
    <OrdersOverviewClient overview={overview} params={params} locale={locale} />
  </main>;
}
