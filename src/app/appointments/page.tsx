import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { Icon } from "@/app/_ui/Icon";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { appointmentWeek, groupScheduledAppointments, type AppointmentWeek } from "@/app/appointments/appointmentWeek";
import { AppointmentDeleteButton } from "@/app/appointments/AppointmentDeleteButton";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import { ListAppointments } from "@/application/useCases/ListAppointments";
import { makeAppointmentListReader } from "@/composition/directus";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import type { Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";

type AppointmentsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ORDER_STATUS_STYLES: Record<OrderStatusValue, string> = {
  received: "bg-amber-100 text-amber-900",
  ready: "bg-emerald-100 text-emerald-900",
  collected: "bg-slate-200 text-slate-700",
  cancelled: "bg-rose-100 text-rose-800",
};

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const params = await searchParams;
  const requestedWeek = typeof params.week === "string" ? params.week : undefined;
  const week = appointmentWeek(requestedWeek);
  const returnTo = week.isCurrent ? "/appointments" : `/appointments?week=${week.key}`;
  const token = await getSessionToken();

  if (!token) redirect(`/login?${new URLSearchParams({ next: returnTo })}`);

  const locale = await getLocale();
  const dict = dictionaries[locale];
  const appointments = await listAppointmentsOrRedirect(token, week, returnTo);
  const groups = groupScheduledAppointments(appointments, week);

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <ReadSyncMarker readId={crypto.randomUUID()} />
      <AppHeader title={t(dict, "appointments.title")} />

      <div className="mx-auto w-full max-w-[640px] px-margin-mobile pb-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-primary">{t(dict, "appointments.title")}</h2>
          <Link className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-on-primary shadow-[0_3px_10px_rgba(46,38,31,0.18)] transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" href="/appointments/new">
            <Icon className="size-4" name="add_circle" />
            {t(dict, "appointments.new.title")}
          </Link>
        </div>

        <section aria-label={t(dict, "appointments.listTitle")} className="mt-5">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <WeekArrow href={`/appointments?week=${week.previousKey}`} label={t(dict, "appointments.week.previous")} icon="arrow_back" />
            <div className="text-center">
              <p className="text-sm font-bold text-primary">{week.isCurrent ? t(dict, "appointments.week.thisWeek") : formatWeekTitle(week, locale)}</p>
              <p className="mt-0.5 text-xs font-medium text-on-surface-variant">{formatWeekRange(week, locale)}</p>
            </div>
            <WeekArrow href={`/appointments?week=${week.nextKey}`} label={t(dict, "appointments.week.next")} icon="arrow_forward" />
          </div>

          <div className="mt-3 flex justify-center">
            {week.isCurrent ? (
              <Link className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary underline decoration-outline-variant underline-offset-4 hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" href="/appointments/history">{t(dict, "appointments.history")}</Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link className="inline-flex min-h-11 items-center rounded-full bg-surface-container-low px-4 text-sm font-semibold text-primary hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-secondary" href="/appointments">{t(dict, "appointments.week.thisWeek")}</Link>
                <Link className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary underline decoration-outline-variant underline-offset-4 hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" href="/appointments/history">{t(dict, "appointments.history")}</Link>
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="mt-6 rounded-[14px] bg-surface-container-lowest px-5 py-9 text-center shadow-[0_4px_16px_rgba(46,38,31,0.07)]">
              <Icon className="mx-auto size-7 text-on-surface-variant" name="event" />
              <p className="mt-3 text-sm font-medium text-on-surface-variant">{t(dict, "appointments.empty")}</p>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map(group => (
                <section key={group.key}>
                  <h3 className="mb-2 text-sm font-bold text-primary">{formatDay(group.items[0]!.scheduledAt, locale)}</h3>
                  <div className="overflow-hidden rounded-[14px] bg-surface-container-lowest shadow-[0_4px_16px_rgba(46,38,31,0.07)]">
                    {group.items.map((appointment, index) => (
                      <AppointmentRow
                        appointment={appointment}
                        key={appointment.id}
                        locale={locale}
                        divided={index > 0}
                        openLabel={t(dict, "appointments.openDetails")}
                        orderLabel={t(dict, "appointments.linkedOrder")}
                        orderStatuses={{ received: t(dict, "orders.status.received"), ready: t(dict, "orders.status.ready"), collected: t(dict, "orders.status.collected"), cancelled: t(dict, "orders.status.cancelled") }}
                        deleteTexts={{
                          delete: t(dict, "appointments.delete"),
                          deleting: t(dict, "appointments.deleting"),
                          confirm: t(dict, "appointments.delete.confirm"),
                          error: t(dict, "appointments.delete.error"),
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function listAppointmentsOrRedirect(token: string, week: AppointmentWeek, returnTo: string): Promise<AppointmentListItem[]> {
  try {
    return await new ListAppointments(makeAppointmentListReader(token)).execute({ from: week.visibleFrom, to: week.end, statuses: ["scheduled"] });
  } catch (error) {
    return await redirectToLoginForAuthError(error, returnTo);
  }
}

function WeekArrow({ href, label, icon }: { href: string; label: string; icon: string }) {
  return <Link aria-label={label} className="inline-flex size-11 items-center justify-center rounded-full text-primary hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" href={href}><Icon className="size-5" name={icon} /></Link>;
}

function AppointmentRow({ appointment, locale, divided, openLabel, orderLabel, orderStatuses, deleteTexts }: { appointment: AppointmentListItem; locale: Locale; divided: boolean; openLabel: string; orderLabel: string; orderStatuses: Record<OrderStatusValue, string>; deleteTexts: { delete: string; deleting: string; confirm: string; error: string } }) {
  return (
    <div className={`grid min-h-[72px] grid-cols-[54px_1fr_44px] items-center gap-3 px-4 py-3 ${divided ? "border-t border-outline-variant" : ""}`}>
      <time className="text-base font-bold tabular-nums text-primary">{formatTime(appointment.scheduledAt, locale)}</time>
      <Link aria-label={`${openLabel}: ${appointment.clientName}`} className="min-w-0 rounded-md transition hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-secondary" href={`/appointments/${appointment.id}`}>
        <span className="block truncate text-sm font-bold text-on-surface">{appointment.clientName}</span>
        {appointment.notes ? <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{appointment.notes}</span> : null}
        {appointment.linkedOrder ? <span className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-on-surface-variant"><span>{orderLabel}</span><span className="truncate">{appointment.linkedOrder.orderNumber}</span><span className={`rounded-full px-2 py-0.5 text-[0.6875rem] ${ORDER_STATUS_STYLES[appointment.linkedOrder.status]}`}>{orderStatuses[appointment.linkedOrder.status]}</span></span> : null}
      </Link>
      <AppointmentDeleteButton appointmentId={appointment.id} clientName={appointment.clientName} texts={deleteTexts} />
    </div>
  );
}

function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-IE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Dublin" }).format(date);
}

function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-IE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Dublin" }).format(date);
}

function formatWeekTitle(week: AppointmentWeek, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-IE", { month: "long", year: "numeric", timeZone: "Europe/Dublin" }).format(week.start);
}

function formatWeekRange(week: AppointmentWeek, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-IE", { day: "numeric", month: "short", timeZone: "Europe/Dublin" });
  return `${formatter.format(week.visibleFrom)} – ${formatter.format(new Date(week.end.getTime() - 1))}`;
}
