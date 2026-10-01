import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { AppointmentForm } from "@/app/appointments/AppointmentForm";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { GetClient } from "@/application/useCases/GetClient";
import { makeClientRepository } from "@/composition/directus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ clientId?: string | string[] }> }) {
  const token = await getSessionToken();
  if (!token) {
    redirect(`/login?${new URLSearchParams({ next: "/appointments/new" })}`);
  }

  const locale = await getLocale();
  const dict = dictionaries[locale];
  const rawClientId = (await searchParams).clientId;
  const clientId = typeof rawClientId === "string" ? rawClientId : undefined;
  const history = clientId ? await new GetClient(makeClientRepository(token)).execute(clientId).catch(error => redirectToLoginForAuthError(error, "/appointments/new")) : undefined;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <AppHeader backHref="/appointments" title={t(dict, "appointments.new.title")} variant="back" />
      <div className="mx-auto w-full max-w-[640px] px-margin-mobile pb-8 pt-4">
        <AppointmentForm
          appointmentId={crypto.randomUUID()}
          initialClient={history ? { id: history.client.id, name: history.client.name, phone: history.client.phone?.value ?? null } : undefined}
          initialOrders={history?.orders.map(order => ({ id: order.id, orderNumber: order.orderNumber.value, status: order.status.value }))}
          successHref="/appointments"
          texts={{ title: t(dict, "appointments.new.title"), client: t(dict, "clients.singular"), searchPlaceholder: t(dict, "clients.search.placeholder"), selected: t(dict, "common.selected"), searching: t(dict, "common.searching"), noClients: t(dict, "clients.empty"), dateTime: t(dict, "appointments.dateTime"), date: t(dict, "appointments.date"), time: t(dict, "appointments.time"), changeClient: t(dict, "appointments.changeClient"), newClient: t(dict, "appointments.newClient"), linkedOrder: t(dict, "appointments.linkedOrder"), noLinkedOrder: t(dict, "appointments.linkedOrder.none"), loadingOrders: t(dict, "appointments.linkedOrder.loading"), startOver: t(dict, "appointments.startOver"), notes: t(dict, "orders.fields.notes"), notesPlaceholder: t(dict, "appointments.notesPlaceholder"), schedule: t(dict, "appointments.schedule"), scheduling: t(dict, "appointments.scheduling"), checkSaved: t(dict, "common.checkSaved"), checkingSaved: t(dict, "common.checkingSaved"), confirmedAbsent: t(dict, "common.confirmedAbsent"), confirmedSaved: t(dict, "common.confirmedSaved"), error: t(dict, "appointments.error"), orderStatuses: { received: t(dict, "orders.status.received"), ready: t(dict, "orders.status.ready"), collected: t(dict, "orders.status.collected"), cancelled: t(dict, "orders.status.cancelled") } }}
        />
      </div>
    </main>
  );
}
