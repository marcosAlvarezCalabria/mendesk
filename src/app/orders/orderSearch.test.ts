import { describe, expect, it } from "vitest";

import type { Order } from "@/domain/entities/Order";
import { matchesOrderSearch } from "@/app/orders/orderSearch";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("matchesOrderSearch", () => {
  it("matches by order number prefix", () => {
    expect(matchesOrderSearch(makeOrder(), "260819")).toBe(true);
  });

  it("matches by client name prefix case-insensitively", () => {
    expect(matchesOrderSearch(makeOrder(), "aOi")).toBe(true);
  });

  it("rejects matches found only in the middle of a value", () => {
    expect(matchesOrderSearch(makeOrder(), "0142")).toBe(false);
    expect(matchesOrderSearch(makeOrder(), "byrne")).toBe(false);
  });

  it("matches blank queries", () => {
    expect(matchesOrderSearch(makeOrder(), "")).toBe(true);
    expect(matchesOrderSearch(makeOrder(), "   ")).toBe(true);
  });

  it("rejects queries that match neither order number nor client name", () => {
    expect(matchesOrderSearch(makeOrder(), "zzz")).toBe(false);
  });
});

function makeOrder(): Order {
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
    receivedDate: new Date("2026-08-19T12:00:00.000Z"),
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-20T12:00:00.000Z"),
    garments: [],
    payments: [],
  };
}