import { describe, expect, it } from "vitest";

import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { buildTicket } from "@/domain/orders/buildTicket";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("buildTicket", () => {
  it("builds the economic ticket contract with its canonical order QR payload", () => {
    const order = makeOrder();
    const garment = makeGarment({ measurements: "Hem 4cm" });

    expect(buildTicket(order, garment, "https://demo.mendesk.example")).toEqual({
      orderNumber: order.orderNumber.value,
      clientName: order.client.name,
      garmentDescription: garment.description,
      alterationType: garment.alterationType,
      measurements: garment.measurements,
      price: garment.price.toString(),
      depositPaid: "10.00",
      outstanding: "15.00",
      dueDate: order.dueDate,
      deepLinkUrl: "https://demo.mendesk.example/orders/260819-0142",
    });
  });

  it("uses null for absent measurements", () => {
    expect(buildTicket(makeOrder(), makeGarment(), "https://demo.mendesk.example").measurements).toBeNull();
  });

  it("counts only deposit payments as the paid deposit while all payments reduce Outstanding", () => {
    const order = makeOrder({ payments: [payment("deposit", 8), payment("final", 5)] });

    const ticket = buildTicket(order, makeGarment(), "https://demo.mendesk.example");

    expect(ticket.depositPaid).toBe("8.00");
    expect(ticket.outstanding).toBe("12.00");
  });
});

function makeClient(): Client {
  return { id: "client-1", name: "Ada Lovelace", phone: PhoneNumber.fromRaw("085 200 9225"), gdprConsent: true };
}

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return { id: "garment-1", description: "Blue dress", alterationType: "hem", price: Money.fromEuros(25), ...overrides, dateUpdated: new Date("2026-09-05T10:00:00.000Z") };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate: new Date("2026-08-19T09:00:00.000Z"),
    dateUpdated: new Date("2026-08-19T10:05:00.000Z"),
    dueDate: new Date("2026-08-21T00:00:00.000Z"),
    garments: [makeGarment()],
    payments: [payment("deposit", 10)],
    ...overrides,
  };
}

function payment(type: "deposit" | "final", euros: number) {
  return { id: `payment-${type}`, type, amount: Money.fromEuros(euros), method: "cash" as const, createdAt: new Date("2026-08-19T10:00:00.000Z") };
}
