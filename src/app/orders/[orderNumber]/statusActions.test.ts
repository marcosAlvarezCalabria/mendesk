import { describe, expect, it } from "vitest";

import { availableStatusActions, isStatusAction } from "@/app/orders/[orderNumber]/statusActions";
import type { Client } from "@/domain/entities/Client";
import type { Order } from "@/domain/entities/Order";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("availableStatusActions", () => {
  it("returns ready and cancelled for received orders", () => {
    expect(availableStatusActions(makeOrder({ status: OrderStatus.RECEIVED }))).toEqual(["ready", "cancelled"]);
  });

  it("returns collected and cancelled for ready orders", () => {
    expect(availableStatusActions(makeOrder({ status: OrderStatus.READY }))).toEqual(["collected", "cancelled"]);
  });

  it("returns no actions for collected orders", () => {
    expect(availableStatusActions(makeOrder({ status: OrderStatus.COLLECTED }))).toEqual([]);
  });

  it("returns no actions for cancelled orders", () => {
    expect(availableStatusActions(makeOrder({ status: OrderStatus.CANCELLED }))).toEqual([]);
  });
});

describe("isStatusAction", () => {
  it.each(["ready", "collected", "cancelled"])("accepts %s", (value) => {
    expect(isStatusAction(value)).toBe(true);
  });

  it.each(["", "received", "other"])("rejects %s", (value) => {
    expect(isStatusAction(value)).toBe(false);
  });
});

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
  };
}

function makeOrder(overrides: Partial<Order>): Order {
  const receivedDate = new Date("2026-08-19T10:00:00.000Z");

  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [],
    payments: [],
    ...overrides,
  };
}
