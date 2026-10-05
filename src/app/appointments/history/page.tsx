/*
THESIS: History is a compact chronological ledger, never a second weekly agenda.
OWN-WORLD: Warm canvas, white paper rows, ink controls, green completion and red cancellation.
STORY: Search or filter terminal appointments, scan newest first, then open a read-only record.
FIRST VIEWPORT: Back header, strong History title, search, three equal filters and recent rows.
FORM: Approved single-column atelier ledger from appointment-history-approved-v1.png.
*/
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { Icon } from "@/app/_ui/Icon";
import {
  buildAppointmentHistoryHref,
  groupAppointmentHistory,
  parseAppointmentHistoryParams,
} from "@/app/appointments/appointmentHistory";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { withReturnTo } from "@/app/routeContext";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentHistoryPage } from "@/application/ports/AppointmentHistoryReader";
import { ListAppointmentHistory } from "@/application/useCases/ListAppointmentHistory";
import { makeAppointmentHistoryReader } from "@/composition/directus";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { toIntlLocale, type Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUS_STYLES = {
  completed: "text-emerald-800",
  cancelled: "text-error",
} as const;

const ORDER_STATUS_STYLES: Record<OrderStatusValue, string> = {
  received: "text-amber-900",
  ready: "text-emerald-800",
  collected: "text-slate-700",
  cancelled: "text-error",
};

export default async function AppointmentHistoryPage({ searchParams }: Props) {
  const params = parseAppointmentHistoryParams(await searchParams);
  const currentHref = buildAppointmentHistoryHref(params);
  const token = await getSessionToken();
  if (!token) redirect(`/login?${new URLSearchParams({ next: currentHref })}`);

  const locale = await getLocale();
  const dict = dictionaries[locale];
  let history: AppointmentHistoryPage = { items: [], hasEarlier: false };
  let initialError = false;

  try {
    history = await new ListAppointmentHistory(makeAppointmentHistoryReader(token)).execute({
      page: params.page,
      filter: params.filter,
      search: params.q,
    });
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, currentHref);
    initialError = true;
  }

  const groups = groupAppointmentHistory(history.items);
  const hasCriteria = Boolean(params.q) || params.filter !== "all";

  return (
    <main className="min-h-screen bg-background text-on-surface">
      {initialError ? null : <ReadSyncMarker readId={crypto.randomUUID()} />}
      <AppHeader backHref="/appointments" backLabel={t(dict, "appointments.backToAgenda")} title={t(dict, "appointments.history")} variant="back" />

      <div className="mx-auto w-full max-w-[640px] px-margin-mobile pb-8 pt-4">
        <h2 className="text-3xl font-bold tracking-[-0.025em] text-primary">{t(dict, "appointments.history")}</h2>

        <form action="/appointments/history" className="mt-4 flex min-h-12 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 focus-within:ring-2 focus-within:ring-secondary" method="get" role="search">
          <Icon className="size-5 shrink-0 text-on-surface-variant" name="search" />
          <label className="sr-only" htmlFor="appointment-history-search">{t(dict, "appointments.history.search.label")}</label>
          <input className="min-w-0 flex-1 bg-transparent py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" defaultValue={params.q} id="appointment-history-search" name="q" placeholder={t(dict, "appointments.history.search.placeholder")} type="search" />
          <input name="status" type="hidden" value={params.filter} />
          <button className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-bold text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary" type="submit">{t(dict, "appointments.history.search.submit")}</button>
        </form>

        <nav aria-label={t(dict, "appointments.history.filters")} className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <HistoryFilterLink active={params.filter === "all"} href={buildAppointmentHistoryHref({ ...params, filter: "all", page: 1 })} label={t(dict, "appointments.history.filter.all")} />
          <HistoryFilterLink active={params.filter === "completed"} href={buildAppointmentHistoryHref({ ...params, filter: "completed", page: 1 })} label={t(dict, "appointments.status.completed")} />
          <HistoryFilterLink active={params.filter === "cancelled"} href={buildAppointmentHistoryHref({ ...params, filter: "cancelled", page: 1 })} label={t(dict, "appointments.status.cancelled")} />
        </nav>

        {initialError ? (
          <HistoryMessage icon="error" message={t(dict, "appointments.history.error")} actionHref={currentHref} actionLabel={t(dict, "appointments.history.retry")} />
        ) : groups.length === 0 ? (
          <HistoryMessage
            icon={hasCriteria ? "search_off" : "event_busy"}
            message={t(dict, hasCriteria ? "appointments.history.noResults" : "appointments.history.empty")}
            actionHref={hasCriteria ? "/appointments/history" : "/appointments"}
            actionLabel={t(dict, hasCriteria ? "appointments.history.clear" : "appointments.backToAgenda")}
          />
        ) : (
          <section aria-label={t(dict, "appointments.history.recent", { count: String(history.items.length) })} className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t(dict, "appointments.history.recent", { count: String(history.items.length) })}</h3>
            <div className="mt-3 divide-y divide-outline-variant border-y border-outline-variant">
              {groups.map(group => (
                <section key={group.key}>
                  <h4 className="bg-surface-container-low px-1 py-2 text-xs font-bold uppercase text-on-surface-variant">{formatDay(group.items[0]!.scheduledAt, locale)}</h4>
                  <div className="divide-y divide-outline-variant">
                    {group.items.map(item => <HistoryRow currentHref={currentHref} dict={dict} item={item} key={item.id} locale={locale} />)}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        {!initialError && history.hasEarlier ? (
          <Link className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-secondary px-4 text-sm font-bold text-primary transition hover:bg-secondary-container focus:outline-none focus:ring-2 focus:ring-secondary" href={buildAppointmentHistoryHref({ ...params, page: params.page + 1 })}>
            {t(dict, "appointments.history.loadEarlier")}
          </Link>
        ) : null}
      </div>
    </main>
  );
}

function HistoryFilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center justify-center border-r border-outline-variant px-2 text-sm font-bold last:border-r-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-secondary ${active ? "bg-secondary text-on-secondary" : "text-primary hover:bg-surface-container-low"}`} href={href}>{label}</Link>;
}

function HistoryRow({ currentHref, dict, item, locale }: { currentHref: string; dict: typeof dictionaries.en; item: AppointmentListItem; locale: Locale }) {
  const clientName = item.clientId ? item.clientName : t(dict, "clients.deleted");
  const status = item.status === "cancelled" ? "cancelled" : "completed";
  return (
    <Link aria-label={`${t(dict, "appointments.openDetails")}: ${clientName}`} className="grid min-h-[76px] grid-cols-[54px_minmax(0,1fr)_auto_20px] items-center gap-3 bg-surface-container-lowest px-1 py-3 transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-inset focus:ring-secondary" href={withReturnTo(`/appointments/${encodeURIComponent(item.id)}`, currentHref)}>
      <time className="text-base font-bold tabular-nums text-primary">{formatTime(item.scheduledAt, locale)}</time>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-on-surface">{clientName}</span>
        {item.notes ? <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{item.notes}</span> : null}
        {item.linkedOrder ? <span className={`mt-1 block truncate text-xs font-semibold ${ORDER_STATUS_STYLES[item.linkedOrder.status]}`}>{item.linkedOrder.orderNumber} · {t(dict, `orders.status.${item.linkedOrder.status}`)}</span> : null}
      </span>
      <span className={`text-xs font-bold ${STATUS_STYLES[status]}`}>{t(dict, `appointments.status.${status}`)}</span>
      <Icon className="size-5 text-on-surface-variant" name="chevron_right" />
    </Link>
  );
}

function HistoryMessage({ icon, message, actionHref, actionLabel }: { icon: string; message: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="mt-6 rounded-xl bg-surface-container-lowest px-5 py-9 text-center shadow-[0_4px_16px_rgba(46,38,31,0.07)]">
      <Icon className="mx-auto size-7 text-on-surface-variant" name={icon} />
      <p className="mt-3 text-sm font-medium text-on-surface-variant">{message}</p>
      <Link className="mt-4 inline-flex min-h-11 items-center rounded-full border border-outline-variant px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-secondary" href={actionHref}>{actionLabel}</Link>
    </div>
  );
}

function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Dublin" }).format(date);
}

function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Dublin" }).format(date);
}
