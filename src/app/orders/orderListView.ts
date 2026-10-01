import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type OrderListView = "active" | "received" | "ready" | "collected" | "cancelled" | "all";

export const ORDER_LIST_VIEWS: readonly OrderListView[] = ["active", "received", "ready", "collected", "cancelled", "all"];
export const ORDER_LIST_PRIMARY_VIEWS: readonly OrderListView[] = ["active", "ready", "collected", "all"];

export function parseOrderListView(value: string | undefined): OrderListView {
  return ORDER_LIST_VIEWS.includes(value as OrderListView) ? (value as OrderListView) : "active";
}

export function statusesForOrderListView(view: OrderListView): readonly OrderStatusValue[] | undefined {
  if (view === "all") {
    return undefined;
  }

  if (view === "active") {
    return ["received", "ready"];
  }

  return [view];
}
