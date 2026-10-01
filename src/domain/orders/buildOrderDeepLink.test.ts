import { describe, expect, it } from "vitest";

import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { buildOrderDeepLink } from "@/domain/orders/buildOrderDeepLink";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("buildOrderDeepLink", () => {
  it("builds a dashboard deep-link for the order number", () => {
    expect(buildOrderDeepLink(makeOrder(), "https://panel.example")).toBe(
      "https://panel.example/orders/260819-0142",
    );
  });

  it("does not generate a double slash when panelUrl has a trailing slash", () => {
    expect(buildOrderDeepLink(makeOrder(), "https://panel.example/")).toBe(
      "https://panel.example/orders/260819-0142",
    );
  });
});

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Ada Lovelace",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
  };
}

function makeGarment(): Garment {
  return {
    id: "garment-1",
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    description: "Blue dress",
    alterationType: "hem",
    price: Money.fromEuros(25),
  };
}

function makeOrder(): Order {
  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate: new Date("2026-08-19T09:00:00.000Z"),
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T00:00:00.000Z"),
    garments: [makeGarment()],
    payments: [],
  };
}
