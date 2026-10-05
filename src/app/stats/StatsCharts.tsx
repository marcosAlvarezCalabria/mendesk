import type { IncomeBucket, IncomeBucketSize } from "@/application/useCases/GetIncomeStats";
import { toIntlLocale, type Locale } from "@/i18n/locale";

type MoneyChartProps = {
  buckets: IncomeBucket[];
  bucket: IncomeBucketSize;
  locale: Locale;
  ariaLabel: string;
  emptyLabel: string;
};

export function MoneyChart({ buckets, bucket, locale, ariaLabel, emptyLabel }: MoneyChartProps) {
  if (buckets.length === 0) {
    return (
      <div className="grid h-36 place-items-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 text-center" role="img" aria-label={emptyLabel}>
        <p className="text-sm font-semibold text-on-surface-variant">{emptyLabel}</p>
      </div>
    );
  }

  const maximum = Math.max(...buckets.map(item => item.amount.cents), 1);
  const labels = buckets.map(item => formatBucket(item.key, bucket, locale));
  const chartWidth = Math.max(300, buckets.length * 72);
  const yTicks = [maximum, maximum / 2, 0];

  return (
    <div aria-label={`${ariaLabel}. ${buckets.map((item, index) => `${labels[index]} ${formatCents(item.amount.cents, locale)}`).join(", ")}`} role="img">
      <div className="scrollbar-hidden overflow-x-auto pb-1">
        <div className="grid grid-cols-[3.75rem_1fr] gap-x-2" style={{ width: `${chartWidth + 68}px` }}>
          <div aria-hidden="true" className="flex h-32 flex-col justify-between text-right text-label-sm tabular-nums text-on-surface-variant" data-axis="y">
            {yTicks.map((value, index) => <span key={index}>{formatCents(value, locale)}</span>)}
          </div>

          <div aria-hidden="true" className="relative h-32 border-b border-l border-outline">
            <span className="absolute inset-x-0 top-0 border-t border-dashed border-outline-variant" />
            <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-outline-variant" />
            <div className="absolute inset-0 flex items-end gap-2 px-2">
              {buckets.map((item, index) => (
                <div className="flex h-full min-w-0 flex-1 items-end justify-center" key={item.key}>
                  <span
                    className={`w-full max-w-10 rounded-t-sm ${index === buckets.length - 1 ? "bg-primary" : "bg-secondary"}`}
                    style={{ height: `${Math.max(2, (item.amount.cents / maximum) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <span aria-hidden="true" />
          <div aria-hidden="true" className="grid gap-2 pt-2" data-axis="x" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
            {buckets.map((item, index) => (
              <span className="min-w-0 text-center" key={item.key}>
                <span className="block truncate text-label-sm text-on-surface-variant">{labels[index]}</span>
                <strong className="mt-0.5 block whitespace-nowrap text-label-sm tabular-nums text-on-surface">{formatCents(item.amount.cents, locale)}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusChart({ values, labels, emptyLabel }: { values: Record<string, number>; labels: Record<string, string>; emptyLabel: string }) {
  const statuses = ["received", "ready", "collected", "cancelled"];
  const total = statuses.reduce((sum, status) => sum + (values[status] ?? 0), 0);
  const colors: Record<string, string> = { received: "bg-status-received", ready: "bg-status-ready", collected: "bg-status-collected", cancelled: "bg-status-cancelled" };

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-container" role="img" aria-label={total === 0 ? emptyLabel : statuses.map(status => `${labels[status]} ${values[status] ?? 0}`).join(", ")}>
        {total > 0 && statuses.map(status => values[status] ? <span className={colors[status]} key={status} style={{ width: `${(values[status] / total) * 100}%` }} /> : null)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
        {statuses.map(status => (
          <div className="flex min-w-0 items-center gap-2 text-body-sm" key={status}>
            <span className={`size-2.5 shrink-0 rounded-sm ${colors[status]}`} />
            <span className="truncate text-on-surface-variant">{labels[status]}</span>
            <strong className="ml-auto text-on-surface">{values[status] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBucket(key: string, bucket: IncomeBucketSize, locale: Locale): string {
  if (bucket === "hour") return `${key.slice(-2)}:00`;
  return new Intl.DateTimeFormat(toIntlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

function formatCents(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}
