import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { AppointmentStatusActions } from "@/app/appointments/AppointmentStatusActions";
import { AppointmentEditForm } from "@/app/appointments/AppointmentEditForm";
import { safeAppointmentReturnTo } from "@/app/appointments/appointmentHistory";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { withReturnTo } from "@/app/routeContext";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import { makeAppointmentRepository } from "@/composition/directus";
import type { Appointment } from "@/domain/entities/Appointment";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { toIntlLocale, type Locale } from "@/i18n/locale";
import { formatDublinDateTime } from "@/domain/time/dublinDateTime";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ returnTo?: string | string[] }> };

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-secondary-container text-on-secondary-container",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-error-container text-on-error-container",
};

export default async function AppointmentDetailPage({ params, searchParams = Promise.resolve({}) }: Props) {
  const { id } = await params;
  const returnTo = safeAppointmentReturnTo((await searchParams).returnTo);
  const currentPath = withReturnTo(`/appointments/${encodeURIComponent(id)}`, returnTo);
  const token = await getSessionToken();
  if (!token) redirect(`/login?${new URLSearchParams({ next: currentPath })}`);

  const locale = await getLocale();
  const text = dictionaries[locale];
  const appointment = await getAppointmentOrNotFound(token, id, currentPath);
  const clientName = appointment.client?.name ?? text["clients.deleted"];
  const fromHistory = returnTo.startsWith("/appointments/history");
  const localDateTime = formatDublinDateTime(appointment.scheduledAt);
  const [dateValue, timeWithSeconds] = localDateTime.split("T");

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <ReadSyncMarker readId={crypto.randomUUID()} />
      <AppHeader backHref={returnTo} backLabel={text[fromHistory ? "appointments.backToHistory" : "appointments.backToAgenda"]} title={text["appointments.detail.title"]} variant="back" />

      <div className="mx-auto w-full max-w-[640px] px-margin-mobile pb-8 pt-4">
        <section className="min-w-0 rounded-xl bg-surface-container-lowest p-4 shadow-[0_4px_16px_rgba(46,38,31,0.07)]" aria-labelledby="appointment-client">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-title-lg text-primary" id="appointment-client">{clientName}</h2>
              {appointment.client?.phone ? (
                <p className="mt-1 text-body-md text-on-surface-variant">{formatPhoneForDisplay(appointment.client.phone.value)}</p>
              ) : null}
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[appointment.status]}`}>{text[`appointments.status.${appointment.status}`]}</span>
          </div>

          <dl className="mt-5 grid gap-4 border-t border-outline-variant pt-4">
            <div>
              <dt className="text-sm font-semibold text-on-surface-variant">{text["appointments.dateTime"]}</dt>
              <dd className="mt-1 text-base font-bold text-on-surface">{formatAppointmentDateTime(appointment.scheduledAt, locale)}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-on-surface-variant">{text["orders.fields.notes"]}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-base text-on-surface">{appointment.notes ?? text["appointments.noNotes"]}</dd>
            </div>
            {appointment.order ? (
              <div>
                <dt className="text-sm font-semibold text-on-surface-variant">{text["appointments.linkedOrder"]}</dt>
                <dd className="mt-1 text-base font-bold text-on-surface">{appointment.order.orderNumber.value} · {text[`orders.status.${appointment.order.status.value}`]}</dd>
              </div>
            ) : null}
          </dl>

          {appointment.client ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-outline-variant px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-secondary" href={`/clients/${encodeURIComponent(appointment.client.id)}?${new URLSearchParams({ returnTo: currentPath })}`}>
              {appointment.client.name}
            </Link>
            {appointment.client.phone ? (
              <a className="inline-flex min-h-11 items-center rounded-lg border border-outline-variant px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-secondary" href={`https://wa.me/${appointment.client.phone.value}`}>WhatsApp</a>
            ) : null}
          </div>
          ) : null}

          {appointment.status === "scheduled" && appointment.client ? (
            <AppointmentEditForm
              appointmentId={appointment.id}
              clientId={appointment.client.id}
              initialOrders={appointment.order ? [{ id: appointment.order.id, orderNumber: appointment.order.orderNumber.value, status: appointment.order.status.value }] : []}
              initialValues={{ date: dateValue ?? "", time: timeWithSeconds?.slice(0, 5) ?? "", orderId: appointment.orderId ?? "", notes: appointment.notes ?? "" }}
              texts={{
                title: text["appointments.edit"],
                date: text["appointments.date"],
                time: text["appointments.time"],
                linkedOrder: text["appointments.linkedOrder"],
                noLinkedOrder: text["appointments.linkedOrder.none"],
                loadingOrders: text["appointments.linkedOrder.loading"],
                notes: text["orders.fields.notes"],
                notesPlaceholder: text["appointments.notesPlaceholder"],
                save: text["appointments.edit.save"],
                saving: text["appointments.edit.saving"],
                saved: text["appointments.edit.saved"],
                unsaved: text["orders.edit.unsaved"],
                error: text["appointments.error"],
                orderStatuses: { received: text["orders.status.received"], ready: text["orders.status.ready"], collected: text["orders.status.collected"], cancelled: text["orders.status.cancelled"] },
              }}
            />
          ) : null}

          {!fromHistory && appointment.status !== "cancelled" ? (
            <AppointmentStatusActions
              appointmentId={appointment.id}
              currentStatus={appointment.status}
              texts={{
                markCompleted: text["appointments.markCompleted"],
                markingCompleted: text["appointments.markingCompleted"],
                cancel: text["common.cancel"],
                cancelling: text["appointments.cancelling"],
                confirmCancel: text["appointments.cancel.confirm"],
                undoCompleted: text["appointments.undoCompleted"],
                undoingCompleted: text["appointments.undoingCompleted"],
                checkSaved: text["common.checkSaved"],
                checkingSaved: text["common.checkingSaved"],
                confirmedSaved: text["common.confirmedSaved"],
                error: text["appointments.error"],
              }}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

async function getAppointmentOrNotFound(token: string, id: string, currentPath: string): Promise<Appointment> {
  let appointment: Appointment | null;
  try {
    appointment = await makeAppointmentRepository(token).getById(id);
  } catch (error) {
    return redirectToLoginForAuthError(error, currentPath);
  }
  if (!appointment) notFound();
  return appointment;
}

function formatAppointmentDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  }).format(date);
}
