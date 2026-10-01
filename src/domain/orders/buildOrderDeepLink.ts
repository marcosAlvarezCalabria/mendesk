import type { Order } from "@/domain/entities/Order";

export function buildOrderDeepLink(order: Order, panelUrl: string): string {
  return `${withoutTrailingSlash(panelUrl)}/orders/${order.orderNumber}`;
}

function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}