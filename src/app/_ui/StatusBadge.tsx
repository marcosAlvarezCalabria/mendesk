import type { OrderStatus } from "@/domain/values/OrderStatus";
import { cx } from "@/app/_ui/classNames";

export type StatusBadgeLabels = Record<OrderStatus["value"], string> & {
  overdue: string;
};

type StatusBadgeProps = {
  status: OrderStatus;
  labels: StatusBadgeLabels;
  overdue?: boolean;
  className?: string;
};

type StatusBadgeView = {
  label: string;
  className: string;
};

const STATUS_BADGE_STYLES: Record<OrderStatus["value"], string> = {
  received: "border-status-received/30 bg-status-received/15 text-status-received",
  ready: "border-status-ready/30 bg-status-ready/15 text-status-ready",
  collected: "border-status-collected/30 bg-status-collected/15 text-status-collected",
  cancelled: "border-status-cancelled/30 bg-status-cancelled/15 text-status-cancelled",
};

export function getStatusBadgeView(status: OrderStatus, labels: StatusBadgeLabels): StatusBadgeView {
  return { label: labels[status.value], className: STATUS_BADGE_STYLES[status.value] };
}

export function StatusBadge({ status, labels, overdue = false, className }: StatusBadgeProps) {
  const view = getStatusBadgeView(status, labels);

  return (
    <span className={cx("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className={cx("inline-flex min-h-8 items-center rounded-full border px-2.5 text-label-sm", view.className)}>{view.label}</span>
      {overdue ? (
        <span className="inline-flex min-h-8 items-center rounded-full border border-status-overdue/30 bg-status-overdue/15 px-2.5 text-label-sm text-status-overdue">
          {labels.overdue}
        </span>
      ) : null}
    </span>
  );
}