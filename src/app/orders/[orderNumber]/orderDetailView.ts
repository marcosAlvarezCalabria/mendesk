import type { Order } from "@/domain/entities/Order";
import type { Money } from "@/domain/values/Money";

type OrderStatusValue = Order["status"]["value"];

export function orderSummaryClassName(status: OrderStatusValue): string {
  const base = "rounded-xl p-3.5 text-white shadow-[0_4px_16px_rgba(31,27,23,0.12)]";

  if (status === "ready") return `${base} bg-status-ready`;
  if (status === "collected") return `${base} bg-status-collected`;
  if (status === "cancelled") return `${base} bg-status-cancelled`;
  return `${base} bg-primary`;
}

export function orderDetailDate(order: Pick<Order, "dueDate" | "collectedAt"> & { status: OrderStatusValue }): { date: Date; kind: "due" | "collected" } {
  if (order.status === "collected" && order.collectedAt) {
    return { date: order.collectedAt, kind: "collected" };
  }

  return { date: order.dueDate, kind: "due" };
}

export function orderBalanceView(balance: Money, texts: { outstanding: string; paid: string; paidInFull: string }): { label: string; value: string } {
  if (balance.cents === 0) {
    return { label: texts.paid, value: texts.paidInFull };
  }

  return { label: texts.outstanding, value: `€${balance.toString()}` };
}

export function garmentActionRowClassName(): string {
  return "mt-1 flex flex-wrap items-start gap-1 border-t border-outline-variant/40 pt-1";
}
