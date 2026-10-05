/*
THESIS: Stats is the workshop ledger at a glance, not a generic KPI-card dashboard.
OWN-WORLD: Warm paper, tailor's ink, amber cash bars, green card receipts, and one compact payment band.
STORY: Pick a period, see real money received, then understand value, payment completion, clients, and method mix.
FIRST VIEWPORT: Four period controls lead into the amount, cartesian timeline, four workshop measures, and payment split.
FORM: Operate-mode money-first ledger; explicit euro and time values stay readable on hurried touch screens.
*/
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { MoneyChart } from "@/app/stats/StatsCharts";
import { normalizeStatsPreset, resolveStatsBucket, resolveStatsRange } from "@/app/stats/statsRange";
import { statsCopy } from "@/app/stats/statsCopy";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import { GetIncomeStats, type IncomeStats } from "@/application/useCases/GetIncomeStats";
import { makeStatsProvider } from "@/composition/directus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { toIntlLocale, type Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";

type StatsPageProps = { searchParams: Promise<{ preset?: string | string[]; from?: string | string[]; to?: string | string[] }> };

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const locale = await getLocale();
  const copy = statsCopy(locale);
  const dict = dictionaries[locale];
  const params = await searchParams;
  const fromValue = readParam(params.from);
  const toValue = readParam(params.to);
  const preset = normalizeStatsPreset(readParam(params.preset));
  const range = resolveStatsRange(preset, fromValue, toValue, new Date());
  const bucket = resolveStatsBucket(preset, fromValue, toValue);
  const stats = await getStatsOrRedirect(token, range.from, range.to, bucket);
  const periodLabel = `${formatDublinDate(range.from, locale)} – ${formatDublinDate(new Date(range.to.getTime() - 1), locale)}`;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <ReadSyncMarker readId={crypto.randomUUID()} />
      <AppHeader title={t(dict, "stats.title")} />
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-margin-mobile pb-24 pt-3">
        <nav className="scrollbar-hidden -mx-1 flex gap-1 overflow-x-auto px-1" aria-label={t(dict, "stats.period")}>
          <PeriodLink active={preset === "today"} href="/stats?preset=today" label={copy.today} />
          <PeriodLink active={preset === "this_week"} href="/stats?preset=this_week" label={copy.thisWeek} />
          <PeriodLink active={preset === "this_month"} href="/stats?preset=this_month" label={copy.thisMonth} />
          <PeriodLink active={preset === "more"} href={moreHref(fromValue, toValue)} label={copy.more} />
        </nav>

        {preset === "more" ? (
          <form action="/stats" className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl bg-surface-container-low p-2" method="get">
            <input name="preset" type="hidden" value="more" />
            <DateField defaultValue={fromValue ?? localInputDate(range.from)} label={copy.from} name="from" />
            <DateField defaultValue={toValue ?? localInputDate(new Date(range.to.getTime() - 1))} label={copy.to} name="to" />
            <button className="min-h-11 self-end rounded-full bg-primary px-4 text-label-sm text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" type="submit">{copy.apply}</button>
          </form>
        ) : null}

        <section className="mt-3 overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(31,27,23,0.07)]" aria-labelledby="money-heading">
          <div className="px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-label-md text-on-surface-variant" id="money-heading">{copy.moneyReceived}</h1>
                <p className="mt-1 text-headline-lg font-extrabold leading-none tracking-[-0.03em] text-on-surface">{formatMoney(stats.totalIncome.toEuros(), locale)}</p>
              </div>
              <p className="max-w-40 text-right text-[0.6875rem] font-semibold leading-4 text-on-surface-variant">{periodLabel}</p>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">{copy.moneyHint}</p>
          </div>

          <div className="border-t border-outline-variant px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-label-sm text-on-surface">{copy.cashflow}</h2>
              <span className="text-[0.6875rem] font-semibold text-on-surface-variant">{bucketLabel(bucket, locale)}</span>
            </div>
            <MoneyChart ariaLabel={`${copy.cashflow}: ${formatMoney(stats.totalIncome.toEuros(), locale)}`} bucket={bucket} buckets={stats.incomeBuckets} emptyLabel={copy.noPayments} locale={locale} />
          </div>
        </section>

        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricStat label={copy.stillToCollect} value={formatMoney(stats.outstandingBalance.toEuros(), locale)} />
          <MetricStat label={copy.averageOrder} value={formatMoney(stats.averageOrderValue.toEuros(), locale)} />
          <MetricStat label={copy.ordersPaid} value={String(stats.paidOrders)} />
          <MetricStat label={copy.newClients} value={String(stats.newClients)} />
        </dl>

        <section className="mt-3 rounded-xl bg-surface-container-lowest p-4 shadow-[0_8px_24px_rgba(31,27,23,0.06)]" aria-labelledby="payment-methods-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-title-sm text-on-surface" id="payment-methods-heading">{copy.paymentMethods}</h2>
            <span className="text-[0.6875rem] font-semibold text-on-surface-variant">{stats.paymentsCount} · {copy.paymentsRecorded}</span>
          </div>
          <PaymentMethodBreakdown
            ariaLabel={copy.paymentBreakdown}
            cardCents={stats.incomeByMethod.card.cents}
            cardLabel={copy.card}
            cashCents={stats.incomeByMethod.cash.cents}
            cashLabel={copy.cash}
            emptyLabel={copy.noPaymentMethods}
            locale={locale}
          />
        </section>
      </div>
    </main>
  );
}

function PeriodLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3 text-label-sm transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 ${active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface shadow-[0_2px_8px_rgba(31,27,23,0.06)] hover:bg-surface-container-low"}`} href={href}>{label}</Link>;
}

function DateField({ defaultValue, label, name }: { defaultValue: string; label: string; name: string }) {
  return <label className="grid min-w-0 gap-1 text-[0.6875rem] font-bold text-on-surface-variant">{label}<input className="min-h-11 min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20" defaultValue={defaultValue} name={name} required type="date" /></label>;
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-24 rounded-xl bg-surface-container-lowest p-3 shadow-[0_5px_18px_rgba(31,27,23,0.06)]">
      <dt className="text-xs font-semibold leading-4 text-on-surface-variant">{label}</dt>
      <dd className="mt-2 text-xl font-extrabold tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}

function PaymentMethodBreakdown({ ariaLabel, cardCents, cardLabel, cashCents, cashLabel, emptyLabel, locale }: { ariaLabel: string; cardCents: number; cardLabel: string; cashCents: number; cashLabel: string; emptyLabel: string; locale: Locale }) {
  const totalCents = cardCents + cashCents;
  if (totalCents === 0) return <div className="grid min-h-20 place-items-center rounded-lg bg-surface-container-low px-4 text-center text-sm font-semibold text-on-surface-variant" role="img" aria-label={emptyLabel}>{emptyLabel}</div>;

  return (
    <div role="img" aria-label={`${ariaLabel}: ${cardLabel} ${formatMoney(cardCents / 100, locale)}, ${cashLabel} ${formatMoney(cashCents / 100, locale)}`}>
      <div className="flex h-4 overflow-hidden rounded-md bg-surface-container" aria-hidden="true">
        <span className="bg-status-ready" style={{ width: `${(cardCents / totalCents) * 100}%` }} />
        <span className="bg-secondary" style={{ width: `${(cashCents / totalCents) * 100}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs font-semibold text-on-surface-variant">
        <span>{cardLabel} · {formatMoney(cardCents / 100, locale)}</span>
        <span>{cashLabel} · {formatMoney(cashCents / 100, locale)}</span>
      </div>
    </div>
  );
}

async function getStatsOrRedirect(token: string, from: Date, to: Date, bucket: "hour" | "day" | "week"): Promise<IncomeStats> {
  try {
    return await new GetIncomeStats(makeStatsProvider(token)).execute({ from, to, bucket });
  } catch (error) {
    return await redirectToLoginForAuthError(error, "/stats");
  }
}

function moreHref(from: string | undefined, to: string | undefined): string {
  const query = new URLSearchParams({ preset: "more" });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return `/stats?${query.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
}

function formatDublinDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { day: "numeric", month: "short", timeZone: "Europe/Dublin" }).format(value);
}

function localInputDate(value: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function bucketLabel(bucket: "hour" | "day" | "week", locale: Locale): string {
  const labels: Record<Locale, Record<"hour" | "day" | "week", string>> = {
    en: { hour: "by hour", day: "by day", week: "by week" },
    es: { hour: "por hora", day: "por día", week: "por semana" },
    uk: { hour: "за годинами", day: "за днями", week: "за тижнями" },
  };
  return labels[locale][bucket];
}
