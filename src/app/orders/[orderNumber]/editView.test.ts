import { describe, expect, it } from "vitest";

import { canEditOrder } from "@/app/orders/[orderNumber]/editView";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("canEditOrder", () => {
  it("allows editing a received order", () => {
    expect(canEditOrder(makeOrder({ status: OrderStatus.RECEIVED }))).toBe(true);
  });

  it("does not allow editing a collected order", () => {
    expect(canEditOrder(makeOrder({ status: OrderStatus.COLLECTED }))).toBe(false);
  });

  it("does not allow editing a cancelled order", () => {
    expect(canEditOrder(makeOrder({ status: OrderStatus.CANCELLED }))).toBe(false);
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

function makeGarment(): Garment {
  return {
    id: "garment-1",
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    description: "Dress",
    alterationType: "hem",
    price: Money.fromEuros(25),
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-08-19T10:00:00.000Z");

  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [makeGarment()],
    payments: [],
    ...overrides,
  };
}
