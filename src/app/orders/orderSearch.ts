import type { Order } from "@/domain/entities/Order";

export function matchesOrderSearch(order: Order, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return order.orderNumber.value.toLowerCase().startsWith(normalizedQuery) || order.client.name.toLowerCase().startsWith(normalizedQuery);
}