import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type OrderAttention = "overdue" | "due_today" | "due_tomorrow" | "ready_for_pickup";
export type OrdersSelection = { kind: "active" } | { kind: "attention"; value: OrderAttention } | { kind: "status"; value: OrderStatusValue };
export type OrdersOverviewQuery = { selection: OrdersSelection; search: string; page: number; now: Date };
export type OrdersAttentionCounts = { overdue: number; dueToday: number; dueTomorrow: number; readyForPickup: number; active: number };
export type OrderBalanceIssue = { orderId: string; orderNumber: string; reason: "overpaid" | "invalid-money" };
export type OrdersBalance = { status: "ready"; outstandingCents: number; paidCents: number } | { status: "inconsistent"; issue: OrderBalanceIssue };
export type OrdersOverviewItem = {
  id: string; orderNumber: string; clientName: string; status: OrderStatusValue;
  receivedDate: string; dueDate: string; garmentCount: number; balance: OrdersBalance;
};
export type OrdersOverviewPage = { items: readonly OrdersOverviewItem[]; totalCount: number; page: number; pageSize: 8; hasNextPage: boolean };
export type ToCollectSummary = { status: "ready"; amountCents: number } | { status: "inconsistent"; issues: readonly OrderBalanceIssue[] };
export type OrdersReadSection<T> = { status: "ready"; data: T } | { status: "error" };
export type OrdersOverview = {
  asOf: string; counts: OrdersReadSection<OrdersAttentionCounts>;
  toCollect: OrdersReadSection<ToCollectSummary>; list: OrdersReadSection<OrdersOverviewPage>;
};
