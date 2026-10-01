import { describe, expect, it } from "vitest";

import { orderCardAction } from "@/app/orders/orderCardAction";
import type { OrderListItem } from "@/application/dtos/OrderListItem";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("orderCardAction", () => {
  it("offers Mark ready for a received order", () => {
    expect(orderCardAction(makeOrder(OrderStatus.RECEIVED, 20))).toEqual({
      kind: "status",
      target: "ready",
    });
  });

  it("opens the order to take an outstanding payment before collection", () => {
    expect(orderCardAction(makeOrder(OrderStatus.READY, 20))).toEqual({
      kind: "payment",
    });
  });

  it("offers Mark collected when a ready order is fully paid", () => {
    expect(orderCardAction(makeOrder(OrderStatus.READY, 0))).toEqual({
      kind: "status",
      target: "collected",
    });
  });

  it.each([OrderStatus.COLLECTED, OrderStatus.CANCELLED])("offers no next action for %s orders", (status) => {
    expect(orderCardAction(makeOrder(status, 0))).toBeNull();
  });
});

function makeOrder(status: OrderListItem["status"], outstanding: number): OrderListItem {
  return {
    id: "order-1",
    orderNumber: OrderNumber.fromString("260828-0001"),
    clientName: "Aoife Byrne",
    status,
    dueDate: new Date("2026-08-30T10:00:00.000Z"),
    garmentCount: 1,
    outstanding: Money.fromEuros(outstanding),
  };
}
