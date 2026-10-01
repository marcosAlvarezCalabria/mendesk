import type { Order } from "@/domain/entities/Order";
import { isOverdue } from "@/domain/orders/orderRules";

export type OrderDateFilter = "all" | "today" | "tomorrow" | "this_week" | "overdue";

export const ORDER_DATE_FILTERS: readonly OrderDateFilter[] = ["all", "today", "tomorrow", "this_week", "overdue"];

export function parseOrderDateFilter(value: string | undefined): OrderDateFilter {
  return ORDER_DATE_FILTERS.includes(value as OrderDateFilter) ? (value as OrderDateFilter) : "all";
}

export function matchesOrderDateFilter(order: Order, filter: OrderDateFilter, today: Date): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "overdue") {
    return isOverdue(order, today);
  }

  const dueDay = calendarDay(order.dueDate);
  const todayDay = calendarDay(today);

  if (filter === "today") {
    return dueDay === todayDay;
  }

  if (filter === "tomorrow") {
    return dueDay === addDays(todayDay, 1);
  }

  return dueDay >= todayDay && dueDay <= addDays(todayDay, 6);
}

function calendarDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addDays(day: number, days: number): number {
  return day + days * 24 * 60 * 60 * 1000;
}