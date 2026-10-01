import { describe, expect, it } from "vitest";
import { buildOrdersOverviewHref, parseOrdersOverviewParams } from "./ordersOverviewParams";
describe("overview URL contract", () => {
  it.each(["overdue", "due_today", "due_tomorrow", "ready_for_pickup"])("round trips attention %s with complete return context", attention => {
    const params = parseOrdersOverviewParams({ attention, q: "  Ada & Bob  ", page: "2", anchor: "order-abc" });
    const href = buildOrdersOverviewHref(params);
    expect(href).toBe(`/orders?attention=${attention}&q=Ada+%26+Bob&page=2&anchor=order-abc`);
    expect(parseOrdersOverviewParams(Object.fromEntries(new URL(href, "https://test.invalid").searchParams))).toEqual(params);
  });
  it.each(["received", "ready", "collected", "cancelled"])("preserves exclusive %s status", view => {
    expect(parseOrdersOverviewParams({ view, date: "today" }).selection).toEqual({ kind: "status", value: view });
  });
  it("gives canonical attention priority and does not accept duplicate inputs", () => {
    expect(parseOrdersOverviewParams({ attention: "overdue", view: "ready" }).selection).toEqual({ kind: "attention", value: "overdue" });
    expect(parseOrdersOverviewParams({ attention: ["overdue", "due_today"], view: ["ready", "received"], q: ["A", "B"], page: ["2", "3"] })).toEqual({ selection: { kind: "active" }, q: "", page: 1 });
  });
  it.each(["0", "-2", "1.5", "NaN", "Infinity", "9007199254740991", "1e2", "0x10"])("rejects page %s", page => {
    expect(parseOrdersOverviewParams({ page }).page).toBe(1);
  });
  it.each([["today", "due_today"], ["overdue", "overdue"]])("maps legacy date %s", (date, attention) => {
    expect(buildOrdersOverviewHref(parseOrdersOverviewParams({ date, view: "all", q: "Ada" }))).toBe(`/orders?attention=${attention}&q=Ada`);
  });
  it.each(["this_week", "all", "invalid"])("removes unsupported legacy date %s", date => {
    expect(buildOrdersOverviewHref(parseOrdersOverviewParams({ date, view: "all" }))).toBe("/orders");
  });
  it("maps the legacy tomorrow date to the canonical attention", () => {
    expect(buildOrdersOverviewHref(parseOrdersOverviewParams({ date: "tomorrow" }))).toBe("/orders?attention=due_tomorrow");
  });
  it("rejects anchors with unsafe shape and discards unrelated keys", () => {
    expect(buildOrdersOverviewHref(parseOrdersOverviewParams({ anchor: "#bad", next: "https://bad.invalid" }))).toBe("/orders");
  });
});
