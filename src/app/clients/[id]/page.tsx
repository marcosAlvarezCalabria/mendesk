import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/app/_ui/AppHeader";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { AnonymizeClientForm } from "./AnonymizeClientForm";
import { ClientPhoto } from "./ClientPhoto";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { shouldOfferClientAnonymization } from "./anonymizationView";
import { safeClientsReturnTo, withReturnTo } from "@/app/routeContext";
import { buildOrderDetailHref } from "@/app/orders/orderNavigation";
import { formatOrdersDate, formatOrdersMoney } from "@/app/orders/ordersOverviewFormat";
import { ordersAttention } from "@/application/queries/ordersOverviewRules";
import { GetClient } from "@/application/useCases/GetClient";
import { makeClientRepository } from "@/composition/directus";
import type { Order } from "@/domain/entities/Order";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import type { Locale } from "@/i18n/locale";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> };
const STATUS_STYLES: Record<OrderStatusValue, string> = {
  received: "text-status-received", ready: "text-status-ready",
  collected: "text-status-collected", cancelled: "text-status-cancelled",
};
export default async function ClientDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const returnTo = safeClientsReturnTo((await searchParams).returnTo);
  const clientDetailHref = withReturnTo(`/clients/${id}`, returnTo);
  const token = await getSessionToken();
  if (!token) redirect(`/login?${new URLSearchParams({ next: clientDetailHref })}`);
  const locale = await getLocale(); const text = dictionaries[locale];
  const history = await getClientOrNotFound(token, id, clientDetailHref);
  const isAnonymized = history.client.name === ANONYMIZED_CLIENT_NAME;
  return <main className="min-h-screen bg-background text-on-surface">
    <ReadSyncMarker readId={crypto.randomUUID()} />
    <AppHeader title={history.client.name} />
    <div className="mx-auto max-w-[720px] px-margin-mobile pb-8">
      <header className="sticky top-0 z-10 space-y-3 border-b border-outline-variant bg-background py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="inline-flex min-h-11 items-center rounded-lg px-3 font-bold underline focus-visible:outline-2" href={returnTo}>{text["clients.backToClients"]}</Link>
          {shouldOfferClientAnonymization(history.client.name, history.orders) ? <AnonymizeClientForm clientId={history.client.id} clientName={history.client.name} returnTo={returnTo} locale={locale} texts={{ confirmation: text["clients.anonymize.confirmation"], submitting: text["clients.anonymize.submitting"], submit: text["clients.anonymize.submit"] }} /> : null}
        </div>
        {history.client.phone ? <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="break-words font-bold">{formatPhoneForDisplay(history.client.phone.value)}</p>
          <a href={`https://wa.me/${history.client.phone.value}`} className="inline-flex min-h-11 items-center rounded-lg border border-outline-variant px-3 font-bold focus-visible:outline-2">WhatsApp</a>
        </div> : <p>{text["clients.personalDetailsRemoved"]}</p>}
        {!isAnonymized && history.client.notes ? <p className="break-words text-body-sm">{history.client.notes}</p> : null}
      </header>
      <section className="mt-6 space-y-4" aria-labelledby="client-history">
        <h2 id="client-history" className="font-bold">{text["clients.orderHistory"]}</h2>
        {!history.orders.length ? <p>{text["clients.noOrders"]}</p> : history.orders.map(order => <OrderHistoryRow key={order.id} order={order} locale={locale} clientDetailHref={clientDetailHref} clientId={id} hidePhotos={isAnonymized} />)}
      </section>
    </div>
  </main>;
}
async function getClientOrNotFound(token: string, id: string, path: string) {
  try { return await new GetClient(makeClientRepository(token)).execute(id); }
  catch (error) { if (error instanceof ClientNotFoundError) notFound(); return redirectToLoginForAuthError(error, path); }
}
function OrderHistoryRow({ order, locale, clientDetailHref, clientId, hidePhotos }: { order: Order; locale: Locale; clientDetailHref: string; clientId: string; hidePhotos: boolean }) {
  const text = dictionaries[locale];
  const total = order.garments.reduce((sum, garment) => sum + garment.price.cents, 0);
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount.cents, 0);
  const balance = total - paid;
  const inconsistent = !Number.isSafeInteger(total) || !Number.isSafeInteger(paid) || balance < 0;
  const href = buildOrderDetailHref(order.orderNumber.value, clientDetailHref, clientId);
  return <article className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <Link href={href} className="block min-h-11 space-y-2 focus-visible:outline-2 focus-visible:outline-offset-2">
      <div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{order.orderNumber.value}</p>
        <span className={STATUS_STYLES[order.status.value] + " font-bold"}>{text[`orders.status.${order.status.value}`]}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-body-sm text-on-surface-variant">
        <time dateTime={order.receivedDate.toISOString()}>{text["orders.receivedOn"]} {formatOrdersDate(order.receivedDate.toISOString(), locale)}</time>
        <time dateTime={order.dueDate.toISOString()}>{text["orders.due"]} {formatOrdersDate(order.dueDate.toISOString(), locale)}</time>
      </div>
      <p className="font-bold">{inconsistent ? text["clients.financialIssue"] : balance === 0 ? text["orders.paid"] : formatOrdersMoney(balance, locale)}</p>
      {ordersAttention(order.status.value, order.dueDate, new Date()) === "overdue" ? <p className="font-bold text-status-overdue">{text["orders.status.overdue"]}</p> : null}
    </Link>
    {order.garments.map(garment => <div key={garment.id} className="flex items-center gap-3">
      {!hidePhotos && garment.photoId ? <ClientPhoto photoId={garment.photoId} description={garment.description} locale={locale} /> : null}
      <Link href={href} className="flex min-h-11 min-w-0 flex-1 items-center break-words focus-visible:outline-2">{garment.description}</Link>
    </div>)}
  </article>;
}
