import type { OrderListView } from "@/app/orders/orderListView";
import type { OrderListItem } from "@/application/dtos/OrderListItem";
import type { OrderDateFilter } from "@/domain/orders/orderDateFilter";

export const ORDER_DUE_GROUP_KEYS = ["late", "today", "next"] as const;

export type OrderDueGroupKey = (typeof ORDER_DUE_GROUP_KEYS)[number];

export type OrderDueGroup = {
  key: OrderDueGroupKey;
  items: readonly OrderListItem[];
};

export function shouldGroupOrdersByDue(view: OrderListView, date: OrderDateFilter): boolean {
  return view === "active" && date === "all";
}

export function groupOrdersByDue(items: readonly OrderListItem[], today: Date): OrderDueGroup[] {
  const todayDay = calendarDay(today);
  const grouped: Record<OrderDueGroupKey, OrderListItem[]> = {
    late: [],
    today: [],
    next: [],
  };

  for (const item of [...items].sort(compareDueDate)) {
    grouped[dueGroupKey(item.dueDate, todayDay)].push(item);
  }

  const groups: OrderDueGroup[] = [];

  for (const key of ORDER_DUE_GROUP_KEYS) {
    if (grouped[key].length > 0) {
      groups.push({ key, items: grouped[key] });
    }
  }

  return groups;
}

function dueGroupKey(dueDate: Date, todayDay: number): OrderDueGroupKey {
  const dueDay = calendarDay(dueDate);

  if (dueDay < todayDay) {
    return "late";
  }

  return dueDay === todayDay ? "today" : "next";
}

function compareDueDate(left: OrderListItem, right: OrderListItem): number {
  return left.dueDate.getTime() - right.dueDate.getTime();
}

function calendarDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
