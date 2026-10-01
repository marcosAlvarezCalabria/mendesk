import type { OrderAttention, OrdersSelection } from "@/application/dtos/OrdersOverview";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type OrdersOverviewParams = { selection: OrdersSelection; q: string; page: number; anchor?: string };
const attentions = ["overdue", "due_today", "due_tomorrow", "ready_for_pickup"];
const statuses = ["received", "ready", "collected", "cancelled"];
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export function parseOrdersOverviewParams(params: Record<string, string | string[] | undefined>): OrdersOverviewParams {
  const attention = single(params.attention); const view = single(params.view); const date = single(params.date);
  let selection: OrdersSelection = { kind: "active" };
  if (attention && attentions.includes(attention)) selection = { kind: "attention", value: attention as OrderAttention };
  else if (view && statuses.includes(view)) selection = { kind: "status", value: view as OrderStatusValue };
  else if (date === "overdue" || date === "today" || date === "tomorrow") selection = { kind: "attention", value: date === "today" ? "due_today" : date === "tomorrow" ? "due_tomorrow" : "overdue" };
  const rawPage = single(params.page) ?? "1";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && Number.isSafeInteger((parsedPage - 1) * 20) ? parsedPage : 1;
  const anchor = single(params.anchor);
  return { selection, q: (single(params.q) ?? "").trim(), page, ...(anchor && /^order-[A-Za-z0-9_-]+$/.test(anchor) ? { anchor } : {}) };
}

export function buildOrdersOverviewHref(params: OrdersOverviewParams): string {
  const query = new URLSearchParams();
  if (params.selection.kind === "attention") query.set("attention", params.selection.value);
  if (params.selection.kind === "status") query.set("view", params.selection.value);
  if (params.q.trim()) query.set("q", params.q.trim());
  if (params.page > 1) query.set("page", String(params.page));
  if (params.anchor && /^order-[A-Za-z0-9_-]+$/.test(params.anchor)) query.set("anchor", params.anchor);
  return query.size ? `/orders?${query}` : "/orders";
}
