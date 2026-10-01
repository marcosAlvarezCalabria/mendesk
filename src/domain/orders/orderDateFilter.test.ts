import { describe, expect, it } from "vitest";

import type { Order } from "@/domain/entities/Order";
import { matchesOrderDateFilter, parseOrderDateFilter } from "@/domain/orders/orderDateFilter";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

const today = new Date(Date.UTC(2026, 7, 19, 10));


describe("parseOrderDateFilter", () => {
  it("defaults missing and unknown values to all", () => {
    expect(parseOrderDateFilter(undefined)).toBe("all");
    expect(parseOrderDateFilter("zzz")).toBe("all");
  });

  it("keeps known date filter values", () => {
    expect(parseOrderDateFilter("overdue")).toBe("overdue");
  });
});
describe("matchesOrderDateFilter", () => {
  it("includes only today through today plus six days for this_week", () => {
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-19") }), "this_week", today)).toBe(true);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-25") }), "this_week", today)).toBe(true);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-26") }), "this_week", today)).toBe(false);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-18") }), "this_week", today)).toBe(false);
  });

  it("matches overdue editable orders strictly before today", () => {
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-17"), status: OrderStatus.RECEIVED }), "overdue", today)).toBe(true);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-17"), status: OrderStatus.COLLECTED }), "overdue", today)).toBe(false);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-17"), status: OrderStatus.CANCELLED }), "overdue", today)).toBe(false);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-19"), status: OrderStatus.RECEIVED }), "overdue", today)).toBe(false);
  });

  it("matches orders due today", () => {
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-19") }), "today", today)).toBe(true);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-20") }), "today", today)).toBe(false);
  });

  it("matches orders due tomorrow", () => {
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-20") }), "tomorrow", today)).toBe(true);
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-08-19") }), "tomorrow", today)).toBe(false);
  });

  it("matches any order for all", () => {
    expect(matchesOrderDateFilter(makeOrder({ dueDate: date("2026-09-01") }), "all", today)).toBe(true);
  });
});

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: OrderNumber.fromString("260819-0142"),
    client: {
      id: "client-1",
      name: "Aoife Byrne",
      phone: PhoneNumber.fromRaw("085 200 9225"),
      gdprConsent: true,
    },
    status: OrderStatus.RECEIVED,
    receivedDate: date("2026-08-19"),
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: date("2026-08-19"),
    garments: [],
    payments: [],
    ...overrides,
  };
}

function date(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}