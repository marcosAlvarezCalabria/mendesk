import { describe, expect, it } from "vitest";
import { mapOrdersOverviewItem, type OrdersOverviewRecord } from "./ordersOverviewMapper";
const record: OrdersOverviewRecord = { id: "00000000-0000-4000-8000-000000000001", order_number: "260907-0001", status: "ready", received_date: "2026-09-05T10:30:00Z", due_date: "2026-09-07T00:00:00Z", client: { name: "Test client" }, garments: [{ id: "g1", price: "12.35" }, { id: "g2", price: 0.65 }], payments: [{ id: "p1", amount: "2.10" }] };
describe("orders overview money mapping", () => {
  it("uses exact cents and only the contracted public data", () => {
    const result = mapOrdersOverviewItem(record);
    expect(result.balance).toEqual({ status: "ready", outstandingCents: 1090, paidCents: 210 });
    expect(result.garmentCount).toBe(2);
    expect(result.receivedDate).toBe("2026-09-05T10:30:00.000Z");
    expect(Object.keys(result).sort()).toEqual(["balance", "clientName", "dueDate", "garmentCount", "id", "orderNumber", "receivedDate", "status"]);
  });
  it("accepts Directus decimal padding when it does not contain sub-cents", () => {
    const result = mapOrdersOverviewItem({ ...record, garments: [{ id: "g", price: "190.0000" }], payments: [{ id: "p", amount: "50.0000" }] });
    expect(result.balance).toEqual({ status: "ready", outstandingCents: 14000, paidCents: 5000 });
  });
  it("distinguishes valid empty children and legacy null price", () => {
    expect(mapOrdersOverviewItem({ ...record, garments: [{ id: "g", price: null }], payments: [] }).balance).toEqual({ status: "ready", outstandingCents: 0, paidCents: 0 });
  });
  it.each([null, -1, "NaN", "", "1.001", Infinity, "900719925474099.99", "1e2"])("flags invalid payment %s without publishing zero", amount => {
    expect(mapOrdersOverviewItem({ ...record, payments: [{ id: "p", amount }] }).balance).toEqual({ status: "inconsistent", issue: { orderId: record.id, orderNumber: record.order_number, reason: "invalid-money" } });
  });
  it("reports overpayment before saturating or netting across orders", () => {
    expect(mapOrdersOverviewItem({ ...record, payments: [{ id: "p", amount: "13.01" }] }).balance).toMatchObject({ status: "inconsistent", issue: { reason: "overpaid" } });
  });
  it.each([{ garments: undefined }, { payments: undefined }, { received_date: "bad" }, { due_date: "bad" }, { status: "active" }, { client: null }, { client: { name: "" } }, { client: { name: "   " } }])("rejects incomplete records %j", invalid => {
    expect(() => mapOrdersOverviewItem({ ...record, ...invalid } as unknown as OrdersOverviewRecord)).toThrow();
  });
});
