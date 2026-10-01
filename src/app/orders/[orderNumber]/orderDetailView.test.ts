import { describe, expect, it } from "vitest";

import { garmentActionRowClassName, orderBalanceView, orderDetailDate, orderSummaryClassName } from "@/app/orders/[orderNumber]/orderDetailView";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { Money } from "@/domain/values/Money";

describe("order detail view", () => {
  it.each([
    [OrderStatus.RECEIVED, "bg-primary"],
    [OrderStatus.READY, "bg-status-ready"],
    [OrderStatus.COLLECTED, "bg-status-collected"],
    [OrderStatus.CANCELLED, "bg-status-cancelled"],
  ])("uses the persisted status tone for %s", (status, expectedClass) => {
    expect(orderSummaryClassName(status.value)).toContain(expectedClass);
  });

  it("uses collected_at for a collected order", () => {
    const dueDate = new Date("2026-09-10T09:00:00.000Z");
    const collectedAt = new Date("2026-09-12T14:00:00.000Z");

    expect(orderDetailDate({ status: OrderStatus.COLLECTED.value, dueDate, collectedAt })).toEqual({
      date: collectedAt,
      kind: "collected",
    });
  });

  it.each([OrderStatus.RECEIVED, OrderStatus.READY, OrderStatus.CANCELLED])("keeps the due date for %s", (status) => {
    const dueDate = new Date("2026-09-10T09:00:00.000Z");

    expect(orderDetailDate({ status: status.value, dueDate })).toEqual({ date: dueDate, kind: "due" });
  });

  it("shows a persisted zero balance as paid in full", () => {
    expect(orderBalanceView(Money.zero(), { outstanding: "Outstanding", paid: "Paid", paidInFull: "Paid in full." })).toEqual({
      label: "Paid",
      value: "Paid in full.",
    });
  });

  it("shows a positive persisted balance as outstanding money", () => {
    expect(orderBalanceView(Money.fromEuros(20), { outstanding: "Outstanding", paid: "Paid", paidInFull: "Paid in full." })).toEqual({
      label: "Outstanding",
      value: "€20.00",
    });
  });

  it("keeps garment actions together in a compact row", () => {
    expect(garmentActionRowClassName()).toContain("flex");
    expect(garmentActionRowClassName()).toContain("gap-1");
  });
});
