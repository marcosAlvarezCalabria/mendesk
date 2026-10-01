import { describe, expect, it } from "vitest";

import { ORDER_LIST_PRIMARY_VIEWS, parseOrderListView, statusesForOrderListView } from "@/app/orders/orderListView";

describe("ORDER_LIST_PRIMARY_VIEWS", () => {
  it("keeps the mobile navigation focused on the four essential views", () => {
    expect(ORDER_LIST_PRIMARY_VIEWS).toEqual(["active", "ready", "collected", "all"]);
  });
});

describe("parseOrderListView", () => {
  it("defaults missing and unknown values to active", () => {
    expect(parseOrderListView(undefined)).toBe("active");
    expect(parseOrderListView("zzz")).toBe("active");
  });

  it("keeps known view values", () => {
    expect(parseOrderListView("collected")).toBe("collected");
  });
});

describe("statusesForOrderListView", () => {
  it("maps active to received and ready", () => {
    expect(statusesForOrderListView("active")).toEqual(["received", "ready"]);
  });

  it("maps an exact view to one status", () => {
    expect(statusesForOrderListView("collected")).toEqual(["collected"]);
  });

  it("omits the status filter for all", () => {
    expect(statusesForOrderListView("all")).toBeUndefined();
  });
});
