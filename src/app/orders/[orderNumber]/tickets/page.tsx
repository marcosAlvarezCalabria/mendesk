import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { TicketPrintingPanel } from "@/app/orders/[orderNumber]/tickets/TicketPrintingPanel";
import { safeOrderDetailReturnTo, withReturnTo } from "@/app/routeContext";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import { PrintGarmentTickets } from "@/application/useCases/PrintGarmentTickets";
import { makeOrderRepository } from "@/composition/directus";
import { getCurrentStoreIdentity } from "@/composition/currentStoreIdentity";
import { storeConfig } from "@/config/currentStore";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import type { TicketData } from "@/domain/orders/buildTicket";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

type TicketsPageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function OrderTicketsPage({ params, searchParams }: TicketsPageProps) {
  const { orderNumber } = await params;
  const returnTo = safeOrderDetailReturnTo((await searchParams).returnTo, orderNumber);
  const currentHref = withReturnTo(`/orders/${orderNumber}/tickets`, returnTo);
  const token = await getSessionToken();

  if (!token) {
    redirect(`/login?next=${encodeURIComponent(currentHref)}`);
  }

  const [locale, identity] = await Promise.all([getLocale(), getCurrentStoreIdentity()]);
  const dict = dictionaries[locale];
  const tickets = await getTicketsOrNotFound(token, orderNumber, currentHref);
  const ticketViews = await Promise.all(
    tickets.map(async (ticket) => ({
      ticket: toSerializableTicket(ticket),
      qrSvg: await QRCode.toString(ticket.deepLinkUrl, { type: "svg", margin: 1, width: 160 }),
    })),
  );
  const moneyLabels = {
    en: { price: "Price", deposit: "Deposit paid", outstanding: "Outstanding" },
    es: { price: "Precio", deposit: "Señal pagada", outstanding: "Pendiente" },
    uk: { price: "Ціна", deposit: "Сплачений завдаток", outstanding: "До сплати" },
  }[locale];

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-on-surface sm:px-5 sm:py-6 print:bg-white print:px-0 print:py-0">
      <ReadSyncMarker readId={crypto.randomUUID()} />
      <div className="mx-auto w-full max-w-3xl print:max-w-none">
        <TicketPrintingPanel
          labels={{
            client: t(dict, "clients.singular"),
            garment: t(dict, "orders.garments.singular"),
            alteration: t(dict, "orders.garments.alterationType"),
            measurements: t(dict, "orders.garments.measurements"),
            due: t(dict, "orders.due"),
            ...moneyLabels,
          }}
          locale={locale}
          returnTo={returnTo}
          storeName={identity.name}
          tickets={ticketViews}
        />
      </div>
    </main>
  );
}

async function getTicketsOrNotFound(
  token: string,
  orderNumber: string,
  currentHref: string,
): Promise<TicketData[]> {
  try {
    return await new PrintGarmentTickets(makeOrderRepository(token), storeConfig.urls.panelBaseUrl).execute(orderNumber);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      notFound();
    }

    return await redirectToLoginForAuthError(error, currentHref);
  }
}

function toSerializableTicket(ticket: TicketData) {
  return { ...ticket, dueDate: ticket.dueDate.toISOString() };
}
