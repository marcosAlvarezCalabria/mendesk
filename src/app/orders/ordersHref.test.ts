import { describe, expect, it } from "vitest";

import { buildOrdersHref, parseOrdersPage } from "@/app/orders/ordersHref";

describe("buildOrdersHref", () => {
  it("omits default params", () => {
    expect(buildOrdersHref({})).toBe("/orders");
    expect(buildOrdersHref({ view: "active", date: "all", q: "" })).toBe("/orders");
  });

  it("includes a non-default view", () => {
    expect(buildOrdersHref({ view: "ready" })).toBe("/orders?view=ready");
  });

  it("includes and encodes all non-default filters", () => {
    const href = buildOrdersHref({ view: "ready", date: "today", q: "aoife", page: 2 });

    expect(href).toBe("/orders?view=ready&date=today&q=aoife&page=2");
  });

  it("preserves a logical row anchor with the complete list context", () => {
    const href = buildOrdersHref({ view: "ready", q: "aoife", page: 2, anchor: "order-1" });

    expect(href).toBe("/orders?view=ready&q=aoife&page=2&anchor=order-1");
  });

  it("normalizes missing and invalid pages to the first page", () => {
    expect(parseOrdersPage(undefined)).toBe(1);
    expect(parseOrdersPage("0")).toBe(1);
    expect(parseOrdersPage("abc")).toBe(1);
    expect(parseOrdersPage("2")).toBe(2);
  });
});
