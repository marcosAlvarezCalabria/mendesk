import { describe, expect, it } from "vitest";

import { groupOrdersByDue, shouldGroupOrdersByDue } from "@/app/orders/orderDueGroups";
import type { OrderListItem } from "@/application/dtos/OrderListItem";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

const today = new Date("2026-08-28T12:00:00.000Z");

describe("groupOrdersByDue", () => {
  it("returns non-empty groups in Late, Today, Next order", () => {
    const groups = groupOrdersByDue(
      [
        makeItem("260901-0004", "2026-09-01T10:00:00.000Z"),
        makeItem("260827-0002", "2026-08-27T18:00:00.000Z"),
        makeItem("260828-0003", "2026-08-28T23:59:59.999Z"),
        makeItem("260826-0001", "2026-08-26T09:00:00.000Z"),
      ],
      today,
    );

    expect(groups.map((group) => group.key)).toEqual(["late", "today", "next"]);
    expect(groups.map((group) => group.items.map((item) => item.orderNumber.value))).toEqual([
      ["260826-0001", "260827-0002"],
      ["260828-0003"],
      ["260901-0004"],
    ]);
  });

  it("uses UTC calendar-day boundaries", () => {
    const groups = groupOrdersByDue(
      [
        makeItem("260827-0001", "2026-08-27T23:59:59.999Z"),
        makeItem("260828-0002", "2026-08-28T00:00:00.000Z"),
        makeItem("260829-0003", "2026-08-29T00:00:00.000Z"),
      ],
      today,
    );

    expect(groups.map((group) => [group.key, group.items.length])).toEqual([
      ["late", 1],
      ["today", 1],
      ["next", 1],
    ]);
  });

  it("omits empty groups", () => {
    const groups = groupOrdersByDue([makeItem("260901-0001", "2026-09-01T10:00:00.000Z")], today);

    expect(groups.map((group) => group.key)).toEqual(["next"]);
  });

  it("does not mutate the source order", () => {
    const later = makeItem("260901-0002", "2026-09-01T10:00:00.000Z");
    const sooner = makeItem("260829-0001", "2026-08-29T10:00:00.000Z");
    const items = [later, sooner];

    groupOrdersByDue(items, today);

    expect(items).toEqual([later, sooner]);
  });

  it("groups only the unfiltered active view", () => {
    expect(shouldGroupOrdersByDue("active", "all")).toBe(true);
    expect(shouldGroupOrdersByDue("active", "today")).toBe(false);
    expect(shouldGroupOrdersByDue("received", "all")).toBe(false);
    expect(shouldGroupOrdersByDue("collected", "all")).toBe(false);
  });
});

function makeItem(orderNumber: string, dueDate: string): OrderListItem {
  return {
    id: orderNumber,
    orderNumber: OrderNumber.fromString(orderNumber),
    clientName: "Aoife Byrne",
    status: OrderStatus.RECEIVED,
    dueDate: new Date(dueDate),
    garmentCount: 1,
    outstanding: Money.fromEuros(20),
  };
}
